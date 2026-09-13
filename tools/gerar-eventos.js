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
const { SITE, esc, wa } = require('./site-comum.js');

const RAIZ = path.join(__dirname, '..');
const CSS_V = '20260911-1';

/* Campo que ainda não foi revisado não vai para a página: melhor a frase
   existir sem o número do que sair "REVISAR: 300 m²" no ar. */
const limpo = (v) => (String(v == null ? '' : v).startsWith('REVISAR') ? '' : String(v == null ? '' : v));

/* Local do case, para o subtítulo do <h1>, a linha "Local" da ficha técnica e
   a legenda dos cards da listagem. A UF só faz sentido colada à cidade — sem
   cidade (ainda "REVISAR", limpa para vazio), o local inteiro fica vazio em
   vez de imprimir a UF sozinha ("PR" solto não diz nada a quem lê). */
const localDe = (c) => {
  const cidade = limpo(c.cidade);
  return cidade ? [cidade, limpo(c.uf)].filter(Boolean).join(' · ') : '';
};

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
  <!-- Este site usa um ícone único; o conjunto favicon-* existe só na branch da loja. -->
  <link rel="icon" type="image/png" href="/assets/img/icon-primary.png" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/css/styles.css?v=${CSS_V}" />
  <link rel="stylesheet" href="/assets/css/eventos.css?v=${CSS_V}" />
${jsonld.map((o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2).replace(/</g, '\\u003c')}\n  </script>`).join('\n')}
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
    ['Local', localDe(c)],
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
  const local = localDe(c);

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

const CATEGORIA_ROTULO = {
  casamento: 'Casamentos',
  corporativo: 'Corporativos',
  industria: 'Indústria',
  galpao: 'Galpões'
};

function paginaListagem(conj, partes) {
  const url = SITE + '/eventos';
  /* Nem o título nem o subtítulo anunciam um total: o que está publicado é
     uma amostra do que já foi entregue, e prometer a lista completa seria
     falso — além de envelhecer mal a cada case novo que entra. */
  const titulo = 'Eventos e locações da Nuvem Air · alguns dos nossos trabalhos';
  const descricao = 'Alguns dos trabalhos da Nuvem Air: casamentos, feiras, galpões, indústrias e hospitais climatizados. Veja o equipamento usado em cada ambiente.';
  const capa = conj.cases[0];
  const capaMidia = capa.midia.find((m) => m.tipo === 'imagem') || capa.midia[0];

  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: titulo,
      description: descricao,
      url,
      inLanguage: 'pt-BR'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: conj.cases.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.cliente,
        url: `${SITE}/eventos/${c.slug}`
      }))
    }
  ];

  /* Os 16 cards vêm no HTML e o filtro só esconde. Conteúdo que só existe
     depois do JS não é indexado — e o orgânico é o ponto desta seção. */
  const categorias = dados.CATEGORIAS.filter((k) => conj.cases.some((c) => c.categoria === k));

  return head({ titulo, descricao, url, imagem: `${SITE}/assets/eventos/${capa.slug}/${capaMidia.poster || capaMidia.arquivo}`, jsonld, noindex: !conj.publicar, tipo: 'website' })
    + partes.nav + `

  <main class="lista">
    <div class="container">
      <nav class="case-trilha" aria-label="Trilha de navegação">
        <a href="/">Início</a> <span aria-hidden="true">/</span>
        <span aria-current="page">Eventos</span>
      </nav>

      <h1 class="lista__titulo">Onde a Nuvem Air já esteve.</h1>
      <p class="lista__sub">Estes foram alguns dos nossos trabalhos — não todos. De casamento em chácara a chão de fábrica, cada um com o equipamento que o ambiente pedia.</p>

      <div class="lista__filtros" role="group" aria-label="Filtrar trabalhos">
        <button class="lista__filtro is-ativo" data-filtro="todos">Todos</button>
        <button class="lista__filtro" data-filtro="mensal">Locação mensal</button>
${categorias.map((k) => `        <button class="lista__filtro" data-filtro="${esc(k)}">${esc(CATEGORIA_ROTULO[k])}</button>`).join('\n')}
      </div>

      <div class="lista__grade">
${conj.cases.map((c) => {
  const m = c.midia.find((x) => x.tipo === 'imagem') || c.midia[0];
  const local = localDe(c);
  return `        <a class="lista__card" href="/eventos/${esc(c.slug)}" data-tipo="${esc(c.tipo)}" data-categoria="${esc(c.categoria)}">
          <img src="/assets/eventos/${esc(c.slug)}/${esc(m.poster || m.arquivo)}" alt="${esc(m.alt)}" width="420" height="560" loading="lazy" decoding="async" />
          <span class="lista__card-selo">${esc(TIPO_ROTULO[c.tipo])}</span>
          <strong>${esc(c.cliente)}</strong>
          ${local ? `<span class="lista__card-local">${esc(local)}</span>` : ''}
        </a>`;
}).join('\n')}
      </div>

      <p class="lista__vazio" hidden>Nenhum trabalho nesta categoria ainda.</p>

      <section class="case-cta">
        <h2>O próximo pode ser o seu.</h2>
        <p>Diga as dimensões do espaço e o tipo de evento. A equipe calcula quantos equipamentos são necessários e devolve o orçamento em até 2 horas.</p>
        <a class="btn btn--primary" href="${wa('Olá! Vi os cases no site e quero um orçamento.')}" target="_blank" rel="noopener">Pedir orçamento no WhatsApp</a>
      </section>
    </div>
  </main>

` + partes.rodape + `
  <script src="/assets/js/app.js?v=20260905-5"></script>
  <script>
    /* Filtro da listagem. Os cards já estão no HTML; isto só esconde.
       Aceita ?categoria=industria e ?tipo=mensal vindos do mega-menu da home. */
    (function () {
      var cards = [].slice.call(document.querySelectorAll('.lista__card'));
      var botoes = [].slice.call(document.querySelectorAll('.lista__filtro'));
      var vazio = document.querySelector('.lista__vazio');

      function aplicar(filtro) {
        var visiveis = 0;
        cards.forEach(function (c) {
          var casa = filtro === 'todos' || c.dataset.categoria === filtro || c.dataset.tipo === filtro;
          c.hidden = !casa;
          if (casa) visiveis++;
        });
        botoes.forEach(function (b) { b.classList.toggle('is-ativo', b.dataset.filtro === filtro); });
        if (vazio) vazio.hidden = visiveis > 0;
      }

      botoes.forEach(function (b) {
        b.addEventListener('click', function () {
          aplicar(b.dataset.filtro);
          history.replaceState(null, '', b.dataset.filtro === 'todos' ? '/eventos' : '/eventos?categoria=' + b.dataset.filtro);
        });
      });

      var q = new URLSearchParams(location.search);
      var inicial = q.get('categoria') || q.get('tipo');
      if (inicial && botoes.some(function (b) { return b.dataset.filtro === inicial; })) aplicar(inicial);
    })();
  </script>
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

  fs.mkdirSync(path.join(RAIZ, 'eventos'), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, 'eventos', 'index.html'), paginaListagem(conj, partes));
  console.log('  -> eventos/index.html');

  console.log('%d cases gerados%s', conj.cases.length, conj.publicar ? '' : ' (noindex — publicar:false)');
}

module.exports = { paginaCase, paginaListagem, gerar };

if (require.main === module) gerar();
