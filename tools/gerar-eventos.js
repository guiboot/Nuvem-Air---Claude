#!/usr/bin/env node
/* Gerador estático dos cases de evento.  Roda dentro do `npm run build`.
 *
 * Por que sai em HTML pronto e não montado no navegador: é o mesmo motivo do
 * gerar-loja.js — página montada por JS chega ao Googlebot vazia, e o valor
 * inteiro desta seção é orgânico.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dados = require('./eventos-dados.js');
const sitePartes = require('./site-partes.js');

const RAIZ = path.join(__dirname, '..');
const SITE = process.env.SITE_URL || 'https://nuvemair.com.br';
const WA_NUM = '5544988117615';
const CSS_V = '20260911-1';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const wa = (texto) => 'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(texto);

/* Campo que ainda não foi revisado não vai para a página: melhor a frase
   existir sem o número do que sair "REVISAR: 300 m²" no ar. */
const limpo = (v) => (String(v == null ? '' : v).startsWith('REVISAR') ? '' : String(v == null ? '' : v));

const TIPO_ROTULO = { evento: 'Evento', mensal: 'Locação mensal' };

/* `tipo` é o og:type. Página de case é "article"; a Task 5 reusa este mesmo
   head() para a listagem, que é uma CollectionPage e passa "website". */
function head({ titulo, descricao, url, imagem, jsonld = [], noindex, tipo = 'article' }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(descricao)}" />
  <meta name="author" content="Nuvem Air" />
  <meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type" content="${tipo}" />
  <meta property="og:site_name" content="Nuvem Air" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:title" content="${esc(titulo)}" />
  <meta property="og:description" content="${esc(descricao)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${imagem}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(titulo)}" />
  <meta name="twitter:description" content="${esc(descricao)}" />
  <meta name="twitter:image" content="${imagem}" />

  <meta name="theme-color" content="#1e2a78" />
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/img/favicon-192.png?v=20260905-2" />
  <link rel="icon" type="image/png" sizes="96x96" href="/assets/img/favicon-96.png?v=20260905-2" />
  <link rel="icon" type="image/png" sizes="48x48" href="/assets/img/favicon-48.png?v=20260905-2" />
  <link rel="icon" type="image/png" sizes="192x192" media="(prefers-color-scheme: dark)" href="/assets/img/favicon-dark-192.png?v=20260905-2" />
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png?v=20260905-2" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/css/styles.css?v=${CSS_V}" />
  <link rel="stylesheet" href="/assets/css/eventos.css?v=${CSS_V}" />
${jsonld.map((o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n  </script>`).join('\n')}
</head>
<body>

`;
}

/* Um item de mídia. Vídeo reaproveita o lazy-load que o assets/js/app.js já
   faz (IntersectionObserver com rootMargin de 300px) — nenhum JS novo.
   Mídia toda em retrato (900x1200 foto, 720x1280 vídeo) — daí width/height
   e o aspect-ratio do CSS em 3/4, não 4/3. */
function midia(c, m, primeiro) {
  const base = `/assets/eventos/${c.slug}/`;
  if (m.tipo === 'video') {
    return `        <figure class="case-midia__item">
          <video poster="${base}${esc(m.poster)}" class="lazy-video" data-src="${base}${esc(m.arquivo)}" muted loop playsinline preload="none" aria-label="${esc(m.alt)}"></video>
        </figure>`;
  }
  return `        <figure class="case-midia__item">
          <img src="${base}${esc(m.arquivo)}" alt="${esc(m.alt)}" width="900" height="1200" decoding="async" loading="${primeiro ? 'eager' : 'lazy'}" />
        </figure>`;
}

function ficha(c) {
  const linhas = [
    ['Tipo', TIPO_ROTULO[c.tipo]],
    ['Local', [limpo(c.cidade), limpo(c.uf)].filter(Boolean).join(' · ')],
    ['Quando', limpo(c.data)],
    ['Equipamento', (c.equipamento || []).join(', ')],
    ['Quantidade', limpo(c.quantidade)],
    ['Área', limpo(c.area)]
  ].filter(([, v]) => v);

  return `      <dl class="case-ficha">
${linhas.map(([r, v]) => `        <div class="case-ficha__linha"><dt>${esc(r)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
      </dl>`;
}

function paginaCase(conj, c, partes) {
  const url = `${SITE}/eventos/${c.slug}`;
  const capa = c.midia.find((m) => m.tipo === 'imagem') || c.midia[0];
  const imagem = `${SITE}/assets/eventos/${c.slug}/${capa.poster || capa.arquivo}`;
  const vizinhos = dados.irmaos(conj, c.slug, 2);
  const local = [limpo(c.cidade), limpo(c.uf)].filter(Boolean).join(' · ');

  /* Article, e não Event: o schema Event descreve evento futuro, com data e
     ingresso. Aplicá-lo a trabalho entregue gera rich result errado e é
     passível de ação manual no Search Console. */
  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: c.seo.h1,
      description: c.seo.descricao,
      image: imagem,
      inLanguage: 'pt-BR',
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      author: { '@type': 'Organization', name: 'Nuvem Air', url: SITE },
      publisher: { '@type': 'Organization', name: 'Nuvem Air', url: SITE }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Eventos', item: SITE + '/eventos' },
        { '@type': 'ListItem', position: 3, name: c.cliente, item: url }
      ]
    }
  ];

  const blocos = [
    ['O desafio', limpo(c.desafio)],
    ['O que fizemos', limpo(c.solucao)],
    ['O resultado', limpo(c.resultado)]
  ].filter(([, v]) => v);

  return head({ titulo: c.seo.titulo, descricao: c.seo.descricao, url, imagem, jsonld, noindex: !conj.publicar })
    + partes.nav + `

  <main class="case">
    <div class="container">
      <nav class="case-trilha" aria-label="Trilha de navegação">
        <a href="/">Início</a> <span aria-hidden="true">/</span>
        <a href="/eventos">Eventos</a> <span aria-hidden="true">/</span>
        <span aria-current="page">${esc(c.cliente)}</span>
      </nav>

      <span class="case-selo case-selo--${esc(c.tipo)}">${esc(TIPO_ROTULO[c.tipo])}</span>
      <h1 class="case-titulo">${esc(c.seo.h1)}</h1>
      ${local ? `<p class="case-local">${esc(local)}</p>` : ''}

${ficha(c)}

      <div class="case-midia">
${c.midia.map((m, i) => midia(c, m, i === 0)).join('\n')}
      </div>

${blocos.map(([t, v]) => `      <section class="case-bloco">
        <h2>${esc(t)}</h2>
        <p>${esc(v)}</p>
      </section>`).join('\n')}

      <section class="case-cta">
        <h2>Precisa do mesmo para o seu espaço?</h2>
        <p>A equipe calcula o número de equipamentos pelas dimensões do lugar e devolve o orçamento em até 2 horas.</p>
        <a class="btn btn--primary" href="${wa(`Olá! Vi o case ${c.cliente} no site e quero um orçamento.`)}" target="_blank" rel="noopener">Pedir orçamento no WhatsApp</a>
      </section>

      <section class="case-irmaos">
        <h2>Outros trabalhos</h2>
        <div class="case-irmaos__grade">
${vizinhos.map((v) => {
  const vc = v.midia.find((m) => m.tipo === 'imagem') || v.midia[0];
  return `          <a class="case-irmaos__card" href="/eventos/${esc(v.slug)}">
            <img src="/assets/eventos/${esc(v.slug)}/${esc(vc.poster || vc.arquivo)}" alt="${esc(vc.alt)}" width="420" height="560" loading="lazy" decoding="async" />
            <strong>${esc(v.cliente)}</strong>
            <span>${esc(TIPO_ROTULO[v.tipo])}</span>
          </a>`;
}).join('\n')}
        </div>
        <a class="case-voltar" href="/eventos">&larr; Ver todos os trabalhos</a>
      </section>
    </div>
  </main>

` + partes.rodape + `
  <script src="/assets/js/app.js?v=20260905-5"></script>
</body>
</html>
`;
}

function gerar() {
  const conj = dados.validar(dados.carregar(), { raiz: RAIZ });
  const partes = sitePartes.partes();

  for (const c of conj.cases) {
    const pasta = path.join(RAIZ, 'eventos', c.slug);
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, 'index.html'), paginaCase(conj, c, partes));
    console.log('  -> eventos/%s/index.html', c.slug);
  }

  console.log('%d cases gerados%s', conj.cases.length, conj.publicar ? '' : ' (noindex — publicar:false)');
}

module.exports = { paginaCase, gerar };

if (require.main === module) gerar();
