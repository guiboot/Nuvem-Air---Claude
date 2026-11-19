#!/usr/bin/env node
/* Gerador estático da loja.  `npm run build`
 *
 * Por que existe: as páginas da loja precisam sair prontas em HTML. Quando o
 * catálogo era montado no navegador, /loja chegava ao Googlebot com zero
 * produto e zero preço — a vitrine inteira era invisível para busca.
 *
 * Fonte única de cálculo: este gerador importa o MESMO assets/js/loja-core.js
 * que api/checkout.js usa para cobrar. Nenhuma conta de dinheiro é
 * reimplementada aqui, então o preço impresso e o preço cobrado não podem
 * divergir.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const core = require('../loja/assets/js/loja-core.js');
const eventosDados = require('./eventos-dados.js');
/* SITE: a loja passou a morar em nuvemair.com.br/loja para herdar a
   autoridade do domínio principal, em vez de começar do zero num
   subdomínio. SITE_URL permite gerar para outro host sem editar código. */
const { SITE, esc, wa } = require('./site-comum.js');

const RAIZ = path.join(__dirname, '..');
const CSS_V = '20261119-1';

/* A loja está temporariamente fora do ar. Quem fecha a porta é o vercel.json
   (tudo em /loja redireciona para /loja-indisponivel) e o api/checkout.js, que
   recusa qualquer pedido. As páginas da loja continuam sendo geradas — só o
   caminho até elas é que está fechado —, mas o que aponta para fora precisa
   saber: a 404 da raiz e o sitemap.

   Para reabrir a loja, os três andam juntos: volte esta chave para true, ligue
   LOJA_ATIVA em api/checkout.js e tire as regras de /loja do vercel.json. */
const LOJA_ATIVA = true;

const cat = JSON.parse(fs.readFileSync(path.join(RAIZ, 'loja/catalogo.json'), 'utf8'));
/* Categoria com "oculta": true no catálogo some da loja inteira — vitrine,
   banner, páginas de ambiente e sitemap —, junto com os produtos dela. Serve
   para tirar uma linha do ar sem apagar o cadastro. */
for (const k of Object.keys(cat.categorias)) {
  if (!cat.categorias[k].oculta) continue;
  delete cat.categorias[k];
  for (const s of Object.keys(cat.produtos)) if (cat.produtos[s].categoria === k) delete cat.produtos[s];
}
const apps = JSON.parse(fs.readFileSync(path.join(RAIZ, 'loja/aplicacoes.json'), 'utf8')).aplicacoes;
const lerParcial = (n) => fs.readFileSync(path.join(RAIZ, 'loja', n), 'utf8').trimEnd();

/* ---------------------------------------------------------------- utilidades */

const footer = lerParcial('_rodape.html');
const waFloat = lerParcial('_whatsapp.html');

const SVG = {
  local: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  busca: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>',
  conta: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
  carrinho: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.2l2 11.2A2 2 0 0 0 9.2 17h8.2a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20.4" r="1.1"/><circle cx="18" cy="20.4" r="1.1"/></svg>',
  pix: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8 21.2 12 12 21.2 2.8 12z"/><path d="M8.4 8.4 12 12l3.6-3.6"/></svg>',
  cartao: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19"/></svg>',
  entrega: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5h4l3 3v3h-7z"/><circle cx="6.5" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg>',
};

/* -------------------------------------------------------------- componentes */

function header() {
  /* Topo em duas linhas, no padrão de marketplace: logo, busca e o gancho de
     oferta em cima; entrega, categorias e ações embaixo. A faixa inteira é
     azul da marca e continua no banner logo abaixo. */
  const links = [['/loja', 'Todos'], ['/loja#ofertas', 'Ofertas']]
    .concat(Object.keys(cat.categorias).map((k) => ['/loja#' + k, cat.categorias[k].titulo]))
    .concat([['/loja/aplicacoes', 'Por ambiente'], [wa('Olá! Vim pela loja da Nuvem Air e quero falar com um especialista.'), 'Contato']])
    .map(([h, r]) => `        <a href="${h}"${h.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(r)}</a>`).join('\n');

  const promo = maiorDesconto()
    ? `<a class="lojahdr__promo" href="/loja#ofertas"><strong>Até ${maiorDesconto()}% OFF</strong><span>em climatizadores</span></a>`
    : (cat.parcelamentoMax >= 2 ? `<a class="lojahdr__promo" href="/loja#ofertas"><strong>${cat.parcelamentoMax}x sem juros</strong><span>no cartão</span></a>` : '');

  return `  <header class="lojahdr">
    <div class="container lojahdr__topo">
      <a class="lojahdr__logo" href="/loja" aria-label="Loja Nuvem Air">
        <img src="/loja/assets/img/logo-loja.png?v=${CSS_V}" alt="Nuvem Air" width="154" height="28" />
      </a>

      <form class="lojahdr__busca" role="search" data-busca>
        <label class="sr-only" for="busca">Buscar produtos</label>
        <input type="search" id="busca" name="q" placeholder="Buscar climatizadores, aquecedores e muito mais&hellip;" autocomplete="off" />
        <button type="submit" aria-label="Buscar">${SVG.busca}</button>
      </form>

      ${promo}
    </div>

    <div class="container lojahdr__linha">
      <span class="lojahdr__envio">${SVG.local}<span><small>Enviamos para</small>Todo o Brasil</span></span>

      <nav class="lojahdr__cats" aria-label="Categorias">
${links}
      </nav>

      <div class="lojahdr__acoes">
        <a class="lojahdr__voltar" href="/">Site Nuvem Air</a>
        <a class="lojahdr__icone" href="${wa('Olá! Vim pela loja da Nuvem Air e quero falar com um especialista.')}" target="_blank" rel="noopener" aria-label="Falar com um especialista no WhatsApp">${SVG.conta}</a>
        <a class="lojahdr__icone" href="/loja/carrinho" aria-label="Carrinho">
          ${SVG.carrinho}
          <span class="lojahdr__badge" data-carrinho-contador hidden>0</span>
        </a>
      </div>
    </div>
  </header>`;
}

/* Maior desconto (preço "de" contra o preço) entre os produtos à venda. Alimenta
   o gancho do topo e o primeiro slide do banner; sem nenhum preço riscado no
   catálogo, os dois somem sozinhos. */
function maiorDesconto() {
  return Object.keys(cat.produtos)
    .map((s) => core.descontoPercentual(cat, s) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
}

/* Preço no formato de marketplace: reais grandes, centavos sobrescritos e
   só quando existem ("R$ 4.490", "R$ 1.122⁵⁰"). */
function valorML(centavos) {
  const reais = Math.floor(centavos / 100).toLocaleString('pt-BR');
  const cents = String(centavos % 100).padStart(2, '0');
  return `R$ ${reais}${cents === '00' ? '' : `<sup>${cents}</sup>`}`;
}

/* Bloco de preço dos cards e do banner: "de" riscado em cima, preço com o
   "% OFF" em verde ao lado e o parcelamento embaixo. A página de produto
   continua com blocoPreco(), que mostra também o Pix. */
function precoML(sku) {
  const p = cat.produtos[sku];
  if (!core.disponivel(cat, sku)) return `<div class="ml-preco ml-preco--consulta">Esgotado</div>`;
  if (!core.temPrecoDefinido(cat, sku)) return `<div class="ml-preco ml-preco--consulta">Sob consulta</div>`;
  const pix = core.precoPixCentavos(cat, sku);
  const desc = core.descontoPercentual(cat, sku);
  const parcela = core.parcelaCentavos(cat, sku);
  return `<div class="ml-preco">${desc ? `<s class="ml-preco__de">${valorML(p.precoDeCentavos)}</s>` : ''}`
    + `<div class="ml-preco__linha"><span class="ml-preco__valor">${valorML(pix !== null ? pix : p.precoCentavos)}</span>`
    + `${pix !== null ? '<span class="ml-preco__pix">no Pix</span>' : ''}${desc ? `<span class="ml-preco__off">${desc}% OFF</span>` : ''}</div>`
    + `${parcela !== null ? `<span class="ml-preco__parc">em ${cat.parcelamentoMax}x ${valorML(parcela)} sem juros</span>` : ''}</div>`;
}

/* O bloco de preço sai pronto no HTML. Antes era montado por JS, então preço
   e parcelamento não existiam para o Googlebot nem no primeiro paint. */
function blocoPreco(sku) {
  const p = cat.produtos[sku];
  if (!core.disponivel(cat, sku)) {
    return `<div class="loja-preco loja-preco--consulta"><span class="loja-preco__valor">Esgotado</span></div>`;
  }
  if (!core.temPrecoDefinido(cat, sku)) {
    return `<div class="loja-preco loja-preco--consulta"><span class="loja-preco__valor">Sob consulta</span></div>`;
  }
  const pix = core.precoPixCentavos(cat, sku);
  const desc = core.descontoPercentual(cat, sku);
  const parcela = core.parcelaCentavos(cat, sku);
  const linhas = [];

  if (pix !== null) {
    linhas.push(`<div class="loja-preco__pix"><strong class="loja-preco__valor">${core.formatarBRL(pix)}</strong><span class="loja-preco__pix-rotulo">no Pix</span></div>`);
    linhas.push(`<div class="loja-preco__cheio">${core.formatarBRL(p.precoCentavos)}</div>`);
  } else {
    linhas.push(`<strong class="loja-preco__valor">${core.formatarBRL(p.precoCentavos)}</strong>`);
  }
  if (desc) {
    linhas.push(`<div class="loja-preco__de"><s>${core.formatarBRL(p.precoDeCentavos)}</s><span class="loja-preco__selo">-${desc}%</span></div>`);
  }
  if (parcela !== null) {
    linhas.push(`<div class="loja-preco__parcela">${cat.parcelamentoMax}x de ${core.formatarBRL(parcela)} sem juros</div>`);
  }
  return `<div class="loja-preco">${linhas.join('')}</div>`;
}

/* A observação anda colada no preço, porque é o que o preço não inclui. Sai no
   card, na página do produto e no carrinho (esse último é desenhado por
   loja.js). Omitir em qualquer um dos três deixa a pessoa fechar o pedido
   achando que a instalação estava dentro. */
function blocoObservacao(sku) {
  const p = cat.produtos[sku];
  if (!p.observacao) return '';
  const link = wa(`Olá! Quero orçamento de instalação e duto para o ${p.nome}.`);
  return `<p class="loja-obs">${esc(p.observacao)} <a href="${link}" target="_blank" rel="noopener">Peça o orçamento pelo WhatsApp</a>.</p>`;
}

function card(sku) {
  const p = cat.produtos[sku];
  const disp = core.disponivel(cat, sku);
  const tem = disp && core.temPrecoDefinido(cat, sku);
  const aviso = !disp
    ? `<span class="loja-badge-consulta">Sem estoque no momento. <a href="${wa('Olá! Quero ser avisado quando o ' + p.nome + ' voltar ao estoque.')}" target="_blank" rel="noopener">Avise-me quando voltar</a>.</span>`
    : (tem ? '' :
      `<span class="loja-badge-consulta"><a href="${wa('Olá! Quero o preço do ' + p.nome + '.')}" target="_blank" rel="noopener">Peça o valor pelo WhatsApp</a></span>`);

  /* O card inteiro é o link, como em marketplace. O aviso fica fora dele
     porque tem link próprio, e link dentro de link não é HTML válido. */
  return `        <article class="loja-card${disp ? '' : ' loja-card--esgotado'}" data-sku="${sku}" data-categoria="${p.categoria}" data-preco="${p.precoCentavos === null ? '' : p.precoCentavos}" data-nome="${esc(p.nome)}">
          <a class="loja-card__link" href="/loja/${p.slug}">
            <span class="loja-card__img"><img src="${p.imagem}" alt="${esc(p.nome)}" loading="lazy" width="400" height="400" /></span>
            <span class="loja-card__body">
              <span class="loja-card__tag">${esc(p.tag)}</span>${disp ? '' : '\n              <span class="loja-selo-esgotado">Esgotado</span>'}
              <h3>${esc(p.nome)}</h3>
              ${precoML(sku)}
              ${tem ? '<span class="loja-card__envio">Envio para todo o Brasil</span>' : ''}
            </span>
          </a>${blocoObservacao(sku) ? `\n          ${blocoObservacao(sku)}` : ''}${aviso ? `\n          ${aviso}` : ''}
        </article>`;
}

/* ------------------------------------------------------------------- <head> */

function head({ titulo, descricao, url, imagem, extra = '', noindex = false, siteName = 'Loja Nuvem Air' }) {
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

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${esc(siteName)}" />
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
  <link rel="icon" type="image/png" sizes="96x96" media="(prefers-color-scheme: dark)" href="/assets/img/favicon-dark-96.png?v=20260905-2" />
  <link rel="icon" type="image/png" sizes="48x48" media="(prefers-color-scheme: dark)" href="/assets/img/favicon-dark-48.png?v=20260905-2" />
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png?v=20260905-2" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/loja/assets/css/styles.css?v=${CSS_V}" />
  <link rel="stylesheet" href="/loja/assets/css/loja.css?v=${CSS_V}" />
${extra}</head>
<body class="loja-page">

`;
}

/* Cabeçalho enxuto para as páginas que vivem fora da loja: sem busca no
   catálogo e sem carrinho, que só fazem sentido com a loja no ar. */
const ESTILO_HDR_SIMPLES = `  <style>
    /* Sem busca e sem carrinho, o grid de 3 colunas do header vira flex. */
    .lojahdr__topo--simples { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
  </style>
`;

const headerSimples = () => `  <header class="lojahdr">
    <div class="container lojahdr__topo lojahdr__topo--simples">
      <a class="lojahdr__logo" href="/" aria-label="Nuvem Air">
        <img src="/loja/assets/img/logo-loja.png?v=${CSS_V}" alt="Nuvem Air" width="154" height="28" />
      </a>
      <a class="lojahdr__voltar" href="/">Site da Nuvem Air &rarr;</a>
    </div>
  </header>`;

/* Sem loja.js nem loja-carrinho.js: os dois leem o catálogo e montam a
   vitrine, que agora está fora do ar. */
const SCRIPTS_SIMPLES = `
  <script>document.getElementById('year').textContent = new Date().getFullYear();</script>
</body>
</html>
`;

const SCRIPTS = `
  <script src="/loja/assets/js/loja-core.js?v=${CSS_V}"></script>
  <script src="/loja/assets/js/loja-carrinho.js?v=${CSS_V}"></script>
  <script src="/loja/assets/js/loja.js?v=${CSS_V}"></script>
  <script>
    document.getElementById('year').textContent = new Date().getFullYear();
    Loja.init();
  </script>
</body>
</html>
`;

const urls = [];

/* Cada página vira um diretório com index.html, para que /loja/nu18 funcione
   sem depender de cleanUrls — ligar isso no site principal mudaria o
   comportamento das URLs que já estão no ar. */
function pagina(nome, opcoes, main, { indexar = true, prioridade = '0.7' } = {}) {
  const html = head(opcoes) + header() + '\n\n' + main + '\n\n' + footer + '\n\n' + waFloat + SCRIPTS;
  const base = nome.replace(/\.html$/, '');
  const destino = base === 'index'
    ? path.join(RAIZ, 'loja', 'index.html')
    : path.join(RAIZ, 'loja', base, 'index.html');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, html);
  if (indexar) urls.push({ loc: opcoes.url, prioridade });
  console.log('  ->', path.relative(RAIZ, destino));
}

function ld(obj) {
  return '  <script type="application/ld+json">\n  '
    + JSON.stringify(obj, null, 2).replace(/\n/g, '\n  ') + '\n  </script>\n';
}

function breadcrumb(itens) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: itens.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.nome, item: it.url,
    })),
  };
}

function blocoFaq(faq) {
  return faq.map(([q, a]) => `            <details>
              <summary>${esc(q)}</summary>
              <p>${a}</p>
            </details>`).join('\n');
}

function faqLd(faq) {
  return {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') },
    })),
  };
}

/* ------------------------------------------------------------------ vitrine */

console.log('gerando:');

const pixPct = cat.descontoPixPercentual;
const parcelas = cat.parcelamentoMax;

const selo = (icone, titulo, sub) =>
  `        <div class="loja-selo">${SVG[icone]}<div><strong>${titulo}</strong><span>${sub}</span></div></div>`;

const selos = [
  selo('pix', pixPct ? `${pixPct}% OFF` : 'Pix', pixPct ? 'Para pagamentos no Pix' : 'Aprovação na hora'),
  selo('cartao', 'Parcelamento', parcelas ? `Até ${parcelas}x sem juros` : 'Cartão de crédito'),
  selo('entrega', 'Nota fiscal e garantia', 'Enviamos para todo o Brasil'),
].join('\n');

const skus = Object.keys(cat.produtos);

/* Sem os centavos: num banner o ",00" é só ruído. Se algum dia um
   preço quebrado entrar no catálogo, ele aparece por extenso mesmo. */
const semCentavos = (centavos) => core.formatarBRL(centavos).replace(/,00$/, '');

/* Seções por categoria, todas no HTML. O filtro do navegador só mostra e
   esconde o que já veio pronto — nada é montado por JS. */
const secoes = Object.keys(cat.categorias).map((chave) => {
  const meta = cat.categorias[chave];
  const doGrupo = skus.filter((s) => cat.produtos[s].categoria === chave);
  if (!doGrupo.length) return '';
  return `      <section class="loja-secao ml-painel__caixa" id="${chave}" data-secao="${chave}">
        <div class="ml-painel__cab"><h2 class="loja-secao__titulo">${esc(meta.titulo)}</h2></div>
        <p class="loja-secao__resumo">${esc(meta.resumo)}</p>
        <div class="loja-grid">
${doGrupo.map(card).join('\n')}
        </div>
      </section>`;
}).filter(Boolean).join('\n\n');

/* ------------------------------------------------------ banner rotativo */

/* Slides de promoção, no padrão de marketplace: selo, chamada grande, pílula
   de condição e a foto recortada do produto. Cada slide depende de um SKU
   estar no catálogo — produto oculto ou removido leva o slide junto. O texto
   de preço sai do catálogo, nunca chumbado aqui. */
const desc = (s) => core.descontoPercentual(cat, s);
const ofertas = skus.filter((s) => desc(s)).sort((a, b) => desc(b) - desc(a));
const parcelaTxt = (s) => {
  const v = core.parcelaCentavos(cat, s);
  return v === null ? '' : `em ${cat.parcelamentoMax}x de ${core.formatarBRL(v)} sem juros`;
};

const SLIDES = [
  ofertas.length && {
    href: '/loja#ofertas', tema: 'oferta',
    selo: ['Ofertas', 'Nuvem Air'],
    pre: 'Climatizadores com até',
    grande: `<em>${desc(ofertas[0])}%</em>OFF`,
    pilula: cat.parcelamentoMax >= 2 ? `Em até <b>${cat.parcelamentoMax}x sem juros</b> no cartão` : 'Com nota fiscal e garantia',
    pos: '+ Nota fiscal e garantia',
    fotos: ofertas.slice(0, 2),
  },
  cat.produtos.NU6PRO && {
    href: '/loja/nu6pro', tema: 'lancamento',
    selo: ['Lançamento', 'NU6PRO'],
    pre: 'Climatizador portátil por',
    grande: `<em>${semCentavos(cat.produtos.NU6PRO.precoCentavos)}</em>`,
    pilula: parcelaTxt('NU6PRO'),
    pos: '110V ou 220V · reservatório de 60 L',
    fotos: ['NU6PRO'],
  },
  cat.produtos.NU9PRO && {
    href: '/loja/nu9pro', tema: 'pro',
    selo: ['Linha PRO', 'NU9PRO'],
    pre: desc('NU9PRO') ? `De ${semCentavos(cat.produtos.NU9PRO.precoDeCentavos)} por` : 'Climatizador portátil por',
    grande: `<em>${semCentavos(cat.produtos.NU9PRO.precoCentavos)}</em>`,
    pilula: parcelaTxt('NU9PRO'),
    pos: desc('NU9PRO') ? `${desc('NU9PRO')}% OFF · Envio para todo o Brasil` : 'Envio para todo o Brasil',
    fotos: ['NU9PRO'],
  },
  cat.produtos.NU21 && {
    href: '/loja/nu21', tema: 'bigtank',
    selo: ['Big Tank', 'NU21'],
    pre: '21.000 m³/h para até 250 m²',
    grande: `<em>${semCentavos(cat.produtos.NU21.precoCentavos)}</em>`,
    pilula: parcelaTxt('NU21'),
    pos: 'Reservatório de 200 L · com duto',
    fotos: ['NU21'],
  },
].filter(Boolean);

const slidesHtml = SLIDES.map((sl, i) => `        <a class="ml-hero__slide ml-hero__slide--${sl.tema}${i ? '' : ' is-ativo'}" href="${sl.href}" data-slide${i ? ' aria-hidden="true" tabindex="-1"' : ''}>
          <span class="container ml-hero__inner">
            <span class="ml-hero__texto">
              <span class="ml-hero__selo"><b>${esc(sl.selo[0])}</b><span>${esc(sl.selo[1])}</span></span>
              <span class="ml-hero__pre">${esc(sl.pre)}</span>
              <span class="ml-hero__grande">${sl.grande}</span>
              ${sl.pilula ? `<span class="ml-hero__pilula">${sl.pilula}</span>` : ''}
              <span class="ml-hero__pos">${esc(sl.pos)}</span>
            </span>
            <span class="ml-hero__fotos ml-hero__fotos--${sl.fotos.length}">
${sl.fotos.map((s) => `              <img src="${cat.produtos[s].imagem}" alt="${esc(cat.produtos[s].nome)}" width="400" height="500"${i ? ' loading="lazy"' : ' fetchpriority="high"'} />`).join('\n')}
            </span>
          </span>
        </a>`).join('\n');

const pontos = SLIDES.map((_, i) =>
  `<button type="button" class="ml-hero__ponto${i ? '' : ' is-ativo'}" data-ponto="${i}" aria-label="Promoção ${i + 1} de ${SLIDES.length}"></button>`).join('');

/* ----------------------------------------------------- atalhos sob o banner */

/* A fileira de cartões que sobe por cima do banner. Quatro produtos (o de
   maior desconto, os lançamentos e o Big Tank) e dois de serviço. */
const atalhoProd = (titulo, sku) => {
  const p = cat.produtos[sku];
  return `        <a class="ml-atalho" href="/loja/${p.slug}">
          <h2>${esc(titulo)}</h2>
          <span class="ml-atalho__img"><img src="${p.imagem}" alt="" width="400" height="500" /></span>
          <span class="ml-atalho__nome">${esc(p.nome)}</span>
          ${precoML(sku)}
        </a>`;
};
const atalhoInfo = (titulo, icone, texto, botao, href) => `        <a class="ml-atalho ml-atalho--info" href="${href}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>
          <h2>${esc(titulo)}</h2>
          <span class="ml-atalho__icone">${SVG[icone]}</span>
          <span class="ml-atalho__texto">${esc(texto)}</span>
          <span class="ml-atalho__botao">${esc(botao)}</span>
        </a>`;

const usados = new Set();
const escolhe = (titulo, sku) => {
  if (!sku || !cat.produtos[sku] || usados.has(sku)) return '';
  usados.add(sku);
  return atalhoProd(titulo, sku);
};
const atalhos = [
  escolhe('Maior desconto', ofertas[0]),
  escolhe('Lançamento', 'NU6PRO'),
  escolhe('Linha PRO', 'NU9PRO'),
  escolhe('Big Tank', 'NU21'),
  atalhoInfo('Meios de pagamento', 'cartao', parcelas ? `Pix ou cartão em até ${parcelas}x sem juros.` : 'Pix e cartão de crédito.', 'Mostrar meios', '#pagamento'),
  atalhoInfo('Por ambiente', 'local', 'Galpão, igreja, academia: veja o modelo certo.', 'Mostrar ambientes', '/loja/aplicacoes'),
].filter(Boolean).join('\n');

/* Vitrine de ofertas: todos os produtos com preço riscado, maior desconto
   primeiro. Fica fora de [data-vitrine] para a busca e a contagem não
   contarem o mesmo produto duas vezes. */
const painelOfertas = ofertas.length ? `
    <section class="ml-painel" id="ofertas">
      <div class="container">
        <div class="ml-painel__caixa">
          <div class="ml-painel__cab"><h2>Ofertas</h2><a href="#portateis">Mostrar todos</a></div>
          <div class="ml-ofertas">
${ofertas.map((s) => atalhoProd(`${desc(s)}% OFF`, s).replace('class="ml-atalho"', 'class="ml-atalho ml-atalho--oferta"')).join('\n')}
          </div>
        </div>
      </div>
    </section>` : '';

const vitrineMain = `  <main class="ml-home">
    <section class="ml-hero" data-carrossel aria-roledescription="carrossel" aria-label="Promoções">
      <div class="ml-hero__slides">
${slidesHtml}
      </div>
      ${SLIDES.length > 1 ? `<button type="button" class="ml-hero__seta ml-hero__seta--ant" data-anterior aria-label="Promoção anterior">&#8249;</button>
      <button type="button" class="ml-hero__seta ml-hero__seta--prox" data-proximo aria-label="Próxima promoção">&#8250;</button>
      <div class="ml-hero__pontos">${pontos}</div>` : ''}
    </section>

    <section class="ml-atalhos" aria-label="Destaques">
      <div class="container ml-atalhos__grade">
${atalhos}
      </div>
    </section>
${painelOfertas}

    <section class="ml-painel" id="pagamento" aria-label="Condições de compra">
      <div class="container">
        <div class="ml-painel__caixa loja-selos__inner">
${selos}
        </div>
      </div>
    </section>

    <section class="loja-vitrine">
      <div class="container" data-vitrine>
        <div class="loja-vitrine__cab" hidden>
          <span class="loja-vitrine__cont" data-contagem>${skus.length} produtos</span>
        </div>
        <p class="loja-vitrine__nada" data-nada hidden>Nenhum produto encontrado. Tente outra busca.</p>

${secoes}
      </div>
    </section>
  </main>`;

pagina('index.html', {
  titulo: 'Loja Nuvem Air | Climatizadores Evaporativos e Aquecedores a Gás',
  descricao: `Compre climatizadores evaporativos industriais, portáteis e aquecedores a gás direto da Nuvem Air.${pixPct ? ` ${pixPct}% de desconto no Pix` : ''}${parcelas ? `, até ${parcelas}x sem juros` : ''}, nota fiscal e envio para todo o Brasil.`,
  url: SITE + '/loja',
  imagem: SITE + '/assets/img/model-industrial.png',
  extra: ld(breadcrumb([
    { nome: 'Início', url: SITE + '/' },
    { nome: 'Loja', url: SITE + '/loja' },
  ])),
}, vitrineMain, { prioridade: '0.9' });

/* ------------------------------------------------------- páginas de produto */

/* FAQ derivada das especificações reais do produto — nada é inventado. */
function faqDoProduto(sku) {
  const p = cat.produtos[sku];
  const ehClima = p.categoria !== 'aquecedores';
  const perguntas = [];

  const area = (p.specs.find((s) => /m²/.test(s)) || '').replace(/^[^0-9]*/, '');
  if (area) {
    perguntas.push([
      `Que tamanho de ambiente o ${p.nome} atende?`,
      `A cobertura indicada é de ${area}. Em ambientes com pé-direito alto, muita gente circulando ou fontes de calor, o ideal é combinar mais de um equipamento — nossa equipe faz esse dimensionamento sem custo.`,
    ]);
  }

  const eletrica = p.specs.find((s) => /220V|110V|W\b|trifásic|fase simples/i.test(s));
  if (eletrica) {
    perguntas.push([
      `Qual a alimentação elétrica do ${p.nome}?`,
      `${eletrica}. Confirme a rede disponível no local antes da compra; se tiver dúvida, mande uma foto do quadro que a gente confere junto.`,
    ]);
  }

  if (ehClima) {
    perguntas.push([
      'O climatizador evaporativo funciona em ambiente aberto?',
      'Funciona, e é justamente onde ele leva vantagem sobre o ar-condicionado: ele resfria por evaporação e precisa de renovação de ar. Em galpões, o resultado melhora com portões ou aberturas que deixem o ar circular.',
    ]);
    perguntas.push([
      `O ${p.nome} tem garantia e nota fiscal?`,
      'Sim: 2 anos de garantia, a maior do mercado, e nota fiscal emitida junto com o despacho.',
    ]);
  } else {
    perguntas.push([
      `O ${p.nome} usa qual tipo de gás?`,
      'Cilindro de GLP P13, o botijão comum de 13 kg, que fica embutido na própria torre. O botijão não acompanha o equipamento.',
    ]);
    perguntas.push([
      'Pode usar aquecedor a gás em área coberta?',
      'Em área externa ou bem ventilada, sim. Ambiente fechado exige ventilação adequada — na dúvida, fale com a gente antes de comprar.',
    ]);
  }

  perguntas.push([
    'Como funciona a entrega?',
    'Enviamos para todo o Brasil a partir dos nossos hubs no Paraná. O frete é calculado no carrinho pelo seu CEP; onde ainda não temos tabela fechada, você paga só o equipamento e combinamos o frete antes do despacho.',
  ]);

  return perguntas;
}

const RELACIONADOS = 3;

for (const sku of skus) {
  const p = cat.produtos[sku];
  const disp = core.disponivel(cat, sku);
  const tem = disp && core.temPrecoDefinido(cat, sku);
  const categoria = (cat.categorias[p.categoria] || {}).titulo || 'Produtos';
  const url = `${SITE}/loja/${p.slug}`;
  const imagemAbs = SITE + p.imagem;
  const galeria = p.galeria && p.galeria.length ? p.galeria : [p.imagem];
  const faq = faqDoProduto(sku);

  const garantia = p.categoria === 'aquecedores' ? 'Garantia do fabricante' : '2 anos de garantia';

  const produtoLd = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.nome, sku, description: p.resumo,
    image: galeria.length > 1 ? galeria.map((src) => SITE + src) : imagemAbs,
    brand: { '@type': 'Brand', name: 'Nuvem Air' },
  };
  if (core.temPrecoDefinido(cat, sku)) {
    produtoLd.offers = {
      '@type': 'Offer', priceCurrency: 'BRL',
      price: (p.precoCentavos / 100).toFixed(2),
      availability: disp ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url,
      seller: { '@type': 'Organization', name: 'Nuvem Air' },
    };
  }

  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const extra = ld(produtoLd) + ld(faqLd) + ld(breadcrumb([
    { nome: 'Início', url: SITE + '/' },
    { nome: 'Loja', url: SITE + '/loja' },
    { nome: categoria, url: `${SITE}/loja#${p.categoria}` },
    { nome: p.nome, url },
  ]));

  const relacionados = skus
    .filter((s) => s !== sku && cat.produtos[s].categoria === p.categoria)
    .concat(skus.filter((s) => s !== sku && cat.produtos[s].categoria !== p.categoria))
    .slice(0, RELACIONADOS);

  /* Link de volta: se uma página de aplicação recomenda este modelo, o
     produto aponta para ela. Sem isso o link interno é de mão única e o
     Google não liga os dois lados. */
  const usadoEm = apps.filter((a) => a.modelos.indexOf(sku) !== -1);

  const msgWa = `Olá! Vim pelo site da Nuvem Air e tenho interesse no ${p.nome}. Gostaria de receber mais informações.`;
  const msgOrc = `Olá! Quero um orçamento do ${p.nome} para o meu ambiente.`;

  const main = `  <main class="loja-produto" data-produto data-sku="${sku}">
    <div class="container">
      <nav class="loja-breadcrumb" aria-label="Você está em">
        <a href="/loja">Início</a><span aria-hidden="true">&middot;</span>
        <a href="/loja#${p.categoria}">${esc(categoria)}</a><span aria-hidden="true">&middot;</span>
        <strong aria-current="page">${esc(p.nome)}</strong>
      </nav>

      <div class="loja-produto__inner">
        <div class="loja-produto__media${galeria.length > 1 ? ' loja-produto__media--galeria' : ''}" data-galeria>
          <img src="${galeria[0]}" alt="${esc(p.nome)} — ${esc(p.tag)}" width="600" height="600" data-galeria-principal />${galeria.length > 1 ? `
          <div class="loja-galeria__miniaturas" role="list">
${galeria.map((src, i) => `            <button type="button" class="loja-galeria__mini${i === 0 ? ' is-ativa' : ''}" role="listitem" data-galeria-src="${src}" aria-label="Foto ${i + 1} de ${galeria.length}"${i === 0 ? ' aria-current="true"' : ''}><img src="${src}" alt="" width="80" height="80" loading="lazy" /></button>`).join('\n')}
          </div>` : ''}
        </div>

        <div class="loja-produto__info">
          <span class="loja-card__tag">${esc(p.tag)}</span>${disp ? '' : '\n          <span class="loja-selo-esgotado">Esgotado</span>'}
          <h1>${esc(p.nome)}</h1>
          <p class="loja-produto__resumo">${esc(p.resumo)}</p>

          <div class="loja-produto__compra">
            ${blocoPreco(sku)}
            ${blocoObservacao(sku)}${p.freteGratisAteCentavos ? `
            <p class="loja-frete-gratis"><strong>Frete grátis</strong> em boa parte do Brasil: pagamos até ${core.formatarBRL(p.freteGratisAteCentavos)} da entrega e você só paga o que passar disso. Confira no carrinho com o seu CEP.</p>` : ''}

            ${disp ? `<div class="loja-qtd">
              <label for="qtd-${p.slug}">Quantidade</label>
              <input type="number" id="qtd-${p.slug}" data-qtd value="1" min="1" max="20" />
            </div>` : `<p class="loja-badge-consulta">Sem estoque no momento. <a href="${wa('Olá! Quero ser avisado quando o ' + p.nome + ' voltar ao estoque.')}" target="_blank" rel="noopener">Avise-me quando voltar</a>.</p>`}

            <button type="button" class="btn btn--primary btn--lg full loja-produto__btn" data-comprar${tem ? '' : ' disabled'}>${!disp ? 'Esgotado' : (tem ? 'Adicionar ao carrinho' : 'Sob consulta')}</button>

            <div class="loja-produto__ctas">
              <a class="btn btn--ghost" href="${wa(msgWa)}" target="_blank" rel="noopener" data-evento="whatsapp-produto">Falar com especialista</a>
              <a class="btn btn--ghost" href="${wa(msgOrc)}" target="_blank" rel="noopener" data-evento="orcamento-produto">Solicitar orçamento</a>
            </div>

            <p class="loja-produto__garantia">${garantia} &middot; Nota fiscal &middot; Suporte técnico Nuvem Air. Frete calculado no carrinho pelo seu CEP.</p>
          </div>
        </div>
      </div>

      <div class="loja-produto__conteudo">
        <section class="loja-bloco">
          <h2>Especificações técnicas</h2>
          <ul class="loja-produto__specs">
${p.specs.map((s) => `            <li>${esc(s)}</li>`).join('\n')}
${p.pesoKg ? `            <li>Peso: ${p.pesoKg} kg</li>` : ''}
          </ul>
        </section>

        <section class="loja-bloco">
          <h2>Perguntas frequentes</h2>
          <div class="loja-faq">
${faq.map(([q, a]) => `            <details>
              <summary>${esc(q)}</summary>
              <p>${esc(a)}</p>
            </details>`).join('\n')}
          </div>
        </section>

${usadoEm.length ? `        <section class="loja-bloco">
          <h2>Onde esse modelo é usado</h2>
          <ul class="loja-apps loja-apps--compacta">
${usadoEm.map((a) => `            <li><a href="/loja/${a.slug}"><strong>${esc(a.titulo)}</strong></a></li>`).join('\n')}
          </ul>
        </section>

` : ''}        <section class="loja-bloco">
          <h2>Veja também</h2>
          <div class="loja-grid loja-grid--relacionados">
${relacionados.map(card).join('\n')}
          </div>
        </section>
      </div>
    </div>
  </main>`;

  /* Sem desconto no Pix, precoPixCentavos é null e o preço anunciado passa a
     ser o cheio — então o "no Pix" tem de sair junto, senão a descrição promete
     uma condição que não existe mais. */
  const precoMeta = core.precoPixCentavos(cat, sku);
  const frasePreco = tem
    ? ` A partir de ${core.formatarBRL(precoMeta === null ? p.precoCentavos : precoMeta)}${precoMeta === null ? '' : ' no Pix'}.`
    : ' Peça o preço pelo WhatsApp.';
  const descricao = `${p.nome}: ${p.specs.slice(0, 2).join(', ').toLowerCase()}.${frasePreco} Nota fiscal, ${garantia.toLowerCase()} e envio para todo o Brasil.`;

  pagina(p.slug + '.html', {
    titulo: `${p.nome} | Nuvem Air`,
    descricao,
    url,
    imagem: imagemAbs,
    extra,
  }, main, { prioridade: '0.8' });
}

/* ----------------------------------------------------------------- carrinho */

/* O Pix é sempre oferecido. O que o desconto muda é só a legenda: ele deixou
   de existir, o meio de pagamento não. */
const opcaoPix = `
              <label class="loja-pagto">
                <input type="radio" name="pagamento" value="pix" checked />
                <span class="loja-pagto__corpo">
                  <strong>Pix</strong>
                  <span>${pixPct ? `${pixPct}% de desconto &middot; aprovação na hora` : 'aprovação na hora'}</span>
                </span>
              </label>`;

const carrinhoMain = `  <main class="loja-carrinho" data-carrinho>
    <div class="container">

      <nav class="loja-breadcrumb" aria-label="Você está em">
        <a href="/loja">Início</a><span aria-hidden="true">&middot;</span><strong aria-current="page">Carrinho</strong>
      </nav>
      <h1 class="loja-titulo" data-titulo-carrinho>Finalize sua compra</h1>

      <div data-vazio hidden>
        <div class="loja-vazio">
          <p>Seu carrinho está vazio. Escolha um climatizador ou aquecedor para começar.</p>
          <a class="btn btn--primary btn--lg" href="/loja">Ver os produtos</a>
        </div>
      </div>

      <div data-conteudo hidden>
        <div class="loja-carrinho__inner">
          <div class="loja-carrinho__tabela-wrap">
            <table class="loja-carrinho__tabela">
              <thead>
                <tr>
                  <th scope="col">Produto</th><th scope="col">Preço</th><th scope="col">Qtd</th>
                  <th scope="col">Subtotal</th><th scope="col"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody data-itens></tbody>
            </table>
          </div>

          <form class="loja-resumo" data-checkout novalidate>
            <h2>Resumo do pedido</h2>

            <div class="loja-pagtos" role="radiogroup" aria-label="Forma de pagamento">${opcaoPix}
              <label class="loja-pagto">
                <input type="radio" name="pagamento" value="cartao" />
                <span class="loja-pagto__corpo">
                  <strong>Cartão ou boleto</strong>
                  <span>${parcelas ? `até ${parcelas}x sem juros` : 'crédito ou boleto'}</span>
                </span>
              </label>
            </div>

            <div class="loja-form">
              <label class="full"><span>Nome completo</span>
                <input type="text" id="ck-nome" required autocomplete="name" placeholder="Seu nome completo" /></label>
              <label class="full"><span>E-mail</span>
                <input type="email" id="ck-email" required autocomplete="email" placeholder="voce@empresa.com" /></label>
              <label><span>Telefone</span>
                <input type="tel" id="ck-telefone" required autocomplete="tel" placeholder="(00) 0 0000-0000" /></label>
              <label><span>CPF / CNPJ</span>
                <input type="text" id="ck-documento" inputmode="numeric" placeholder="Somente números" /></label>
              <label class="full"><span>CEP de entrega</span>
                <input type="text" id="ck-cep" required inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" /></label>
            </div>

            <fieldset class="loja-frete" data-frete-opcoes hidden><legend class="sr-only">Opções de entrega</legend></fieldset>

            <div class="loja-resumo__linha"><span>Subtotal</span><strong data-subtotal>&mdash;</strong></div>
            <div class="loja-resumo__linha loja-resumo__linha--desconto" data-linha-desconto hidden><span>Desconto no Pix</span><strong data-desconto>&mdash;</strong></div>
            <div class="loja-resumo__linha"><span>Frete</span><strong data-frete>&mdash;</strong></div>
            <p class="loja-resumo__frete-nota" data-frete-nota hidden></p>
            <div class="loja-resumo__linha loja-resumo__linha--total"><span>Total</span><strong data-total>&mdash;</strong></div>
            <p class="loja-resumo__frete-nota" data-parcela-nota hidden></p>

            <div class="loja-erro" role="alert" hidden></div>

            <button type="submit" class="btn btn--primary btn--lg full">Ir para o pagamento</button>

            <p class="loja-resumo__frete-nota">Pagamento pelo Mercado Pago. Nota fiscal inclusa.</p>
          </form>
        </div>
      </div>

    </div>
  </main>`;

pagina('carrinho.html', {
  titulo: 'Carrinho | Loja Nuvem Air',
  descricao: 'Finalize a compra do seu climatizador ou aquecedor Nuvem Air com Pix ou cartão parcelado.',
  url: SITE + '/loja/carrinho',
  imagem: SITE + '/assets/img/model-industrial.png',
  noindex: true,
}, carrinhoMain, { indexar: false });

/* ----------------------------------------------------------------- retornos */

function retorno(nome, icone, titulo, paragrafos, acoes, limpar = false) {
  const main = `  <main class="loja-retorno container"${limpar ? ' data-limpar-carrinho' : ''}>
      <div class="loja-retorno__icone" aria-hidden="true">${icone}</div>
      <h1>${titulo}</h1>
${paragrafos.map((x) => `      <p>${x}</p>`).join('\n')}
      <div class="loja-retorno__acoes">
${acoes.map(([c, h, t, txt]) => `        <a class="${c}" href="${h}"${t}>${txt}</a>`).join('\n')}
      </div>
  </main>`;
  pagina(nome, {
    titulo: `${titulo} | Loja Nuvem Air`,
    descricao: paragrafos[0].replace(/<[^>]+>/g, '').slice(0, 150),
    url: `${SITE}/loja/${nome.replace('.html', '')}`,
    imagem: SITE + '/assets/img/model-industrial.png',
    noindex: true,
  }, main, { indexar: false });
}

const waGeral = wa('Olá! Vim pela loja da Nuvem Air e preciso de ajuda com o meu pedido.');

retorno('sucesso.html', '&#10003;', 'Pagamento aprovado!',
  ['Recebemos seu pedido e já estamos preparando o envio. Você vai receber a confirmação por e-mail com todos os detalhes.',
    'A nota fiscal é emitida junto com o despacho. Qualquer dúvida sobre prazo ou instalação, fale com a gente pelo WhatsApp.'],
  [['btn btn--primary', '/loja', '', 'Continuar comprando'],
    ['btn btn--ghost', waGeral, ' target="_blank" rel="noopener"', 'Falar no WhatsApp']], true);

retorno('pendente.html', '&#8987;', 'Estamos aguardando o pagamento.',
  ['Se você escolheu <strong>Pix</strong>, a confirmação costuma sair em poucos minutos. No <strong>boleto</strong>, o banco leva até 3 dias úteis para compensar.',
    'Assim que o pagamento cair, a gente te avisa por e-mail e começa a preparar o envio. Seu carrinho foi mantido caso você precise refazer o pedido.'],
  [['btn btn--primary', '/loja/carrinho', '', 'Voltar ao carrinho'],
    ['btn btn--ghost', waGeral, ' target="_blank" rel="noopener"', 'Falar no WhatsApp']]);

retorno('erro.html', '&#9888;', 'O pagamento não foi concluído.',
  ['O Mercado Pago não aprovou essa tentativa. Pode ter sido limite, dado do cartão ou uma recusa do banco — nada foi cobrado.',
    '<strong>Seu carrinho continua do jeito que estava</strong>, então é só tentar de novo, por Pix ou com outro cartão.'],
  [['btn btn--primary', '/loja/carrinho', '', 'Tentar de novo'],
    ['btn btn--ghost', waGeral, ' target="_blank" rel="noopener"', 'Comprar pelo WhatsApp']]);

/* ---------------------------------------------------------------- 404 */

/* Fica na raiz (a Vercel serve /404.html automaticamente), então os caminhos
   relativos ../assets precisam virar /assets. */
const acoes404 = LOJA_ATIVA
  ? `        <a class="btn btn--primary" href="/loja">Ver a loja</a>
        <a class="btn btn--ghost" href="/">Ir para o site</a>`
  : `        <a class="btn btn--primary" href="/comprar">Ver os modelos</a>
        <a class="btn btn--ghost" href="/">Ir para o site</a>`;

const main404 = `  <main class="loja-retorno container">
      <div class="loja-retorno__icone" aria-hidden="true">&#128269;</div>
      <h1>Página não encontrada</h1>
      <p>O endereço que você abriu não existe ou foi movido. Pode ser um link antigo.</p>
      <p>${LOJA_ATIVA
        ? 'Se você procurava um climatizador ou aquecedor, a loja está logo ali.'
        : 'Se você procurava um climatizador ou aquecedor, veja os modelos ou chame a gente no WhatsApp.'}</p>
      <div class="loja-retorno__acoes">
${acoes404}
        <a class="btn btn--ghost" href="${wa('Olá! Não encontrei o que procurava no site da Nuvem Air.')}" target="_blank" rel="noopener">Falar no WhatsApp</a>
      </div>
  </main>`;

const html404 = head({
  titulo: 'Página não encontrada | Nuvem Air',
  descricao: LOJA_ATIVA
    ? 'A página que você procurava não existe. Veja os climatizadores e aquecedores da loja Nuvem Air.'
    : 'A página que você procurava não existe. Veja os climatizadores e aquecedores da Nuvem Air.',
  url: SITE + '/404',
  imagem: SITE + '/assets/img/model-industrial.png',
  noindex: true,
  siteName: LOJA_ATIVA ? 'Loja Nuvem Air' : 'Nuvem Air',
  extra: LOJA_ATIVA ? '' : ESTILO_HDR_SIMPLES,
}) + (LOJA_ATIVA ? header() : headerSimples()) + '\n\n' + main404 + '\n\n' + footer + '\n\n'
  + waFloat + (LOJA_ATIVA ? SCRIPTS : SCRIPTS_SIMPLES);

fs.writeFileSync(path.join(RAIZ, '404.html'), html404);
console.log('  -> 404.html');

/* -------------------------------------------------- páginas de aplicação */

/* Uma página por ambiente. Existem porque a busca real é "climatizador para
   galpão", não "NU56DS" — e quem procura assim ainda não sabe qual modelo
   quer. Cada página resolve a dúvida e leva ao produto certo. */

const indiceApps = apps.map((a) =>
  `        <li><a href="/loja/${a.slug}"><strong>${esc(a.titulo)}</strong><span>${esc(a.resumo.slice(0, 110))}…</span></a></li>`).join('\n');

pagina('aplicacoes.html', {
  titulo: 'Climatizador por ambiente | Galpão, igreja, restaurante e mais',
  descricao: 'Qual climatizador usar em galpão, igreja, restaurante, academia ou evento. Veja o problema de cada ambiente, os modelos indicados e como dimensionar.',
  url: SITE + '/loja/aplicacoes',
  imagem: SITE + '/assets/img/model-industrial.png',
  extra: ld(breadcrumb([
    { nome: 'Início', url: SITE + '/' },
    { nome: 'Loja', url: SITE + '/loja' },
    { nome: 'Por ambiente', url: SITE + '/loja/aplicacoes' },
  ])),
}, `  <main class="loja-conteudo">
    <div class="container">
      <nav class="loja-breadcrumb" aria-label="Você está em">
        <a href="/loja">Início</a><span aria-hidden="true">&middot;</span>
        <strong aria-current="page">Por ambiente</strong>
      </nav>

      <h1 class="loja-titulo">Qual climatizador usar em cada ambiente</h1>
      <p class="loja-conteudo__intro">Galpão, igreja e restaurante têm problemas de calor diferentes — e a escolha do equipamento muda com isso. Escolha o seu ambiente para ver o que costuma dar certo, quais modelos indicamos e como dimensionar.</p>

      <ul class="loja-apps">
${indiceApps}
      </ul>
    </div>
  </main>`, { prioridade: '0.8' });

for (const app of apps) {
  const url = `${SITE}/loja/${app.slug}`;
  const outras = apps.filter((o) => o.slug !== app.slug);

  const modelos = app.modelos.filter((s) => cat.produtos[s]);

  const main = `  <main class="loja-conteudo">
    <div class="container">
      <nav class="loja-breadcrumb" aria-label="Você está em">
        <a href="/loja">Início</a><span aria-hidden="true">&middot;</span>
        <a href="/loja/aplicacoes">Por ambiente</a><span aria-hidden="true">&middot;</span>
        <strong aria-current="page">${esc(app.titulo)}</strong>
      </nav>

      <h1 class="loja-titulo">${esc(app.h1)}</h1>
      <p class="loja-conteudo__intro">${esc(app.resumo)}</p>

      <div class="loja-conteudo__corpo">
        <section class="loja-bloco">
          <h2>O problema nesse tipo de ambiente</h2>
          <ul class="loja-lista-problema">
${app.problema.map((x) => `            <li>${esc(x)}</li>`).join('\n')}
          </ul>
        </section>

        <section class="loja-bloco">
          <h2>Por que o climatizador evaporativo resolve</h2>
          <p class="loja-texto">${app.solucao}</p>
        </section>

        <section class="loja-bloco">
          <h2>Modelos indicados</h2>
          <div class="loja-grid loja-grid--relacionados">
${modelos.map(card).join('\n')}
          </div>
        </section>

        <section class="loja-bloco">
          <h2>Como dimensionar</h2>
          <p class="loja-texto">${esc(app.dimensionamento)}</p>
          <div class="loja-cta-inline">
            <p><strong>Não sabe quantos precisa?</strong> Mande a metragem e o pé-direito no WhatsApp. O dimensionamento é gratuito e respondemos em até 2 horas úteis.</p>
            <a class="btn btn--primary btn--lg" href="${wa('Olá! Preciso de ajuda para dimensionar climatização para ' + app.titulo.toLowerCase() + '. Meu ambiente tem aproximadamente ___ m².')}" target="_blank" rel="noopener" data-evento="orcamento-aplicacao">Pedir dimensionamento no WhatsApp</a>
          </div>
        </section>

        <section class="loja-bloco">
          <h2>Perguntas frequentes</h2>
          <div class="loja-faq">
${blocoFaq(app.faq)}
          </div>
        </section>

        <section class="loja-bloco">
          <h2>Outros ambientes</h2>
          <ul class="loja-apps loja-apps--compacta">
${outras.map((o) => `            <li><a href="/loja/${o.slug}"><strong>${esc(o.titulo)}</strong></a></li>`).join('\n')}
          </ul>
        </section>
      </div>
    </div>
  </main>`;

  pagina(app.slug + '.html', {
    titulo: `${app.titulo} | Nuvem Air`,
    descricao: app.resumo.slice(0, 155),
    url,
    imagem: SITE + (cat.produtos[modelos[0]] || {}).imagem?.replace('..', '') || '/assets/img/model-industrial.png',
    extra: ld(faqLd(app.faq)) + ld(breadcrumb([
      { nome: 'Início', url: SITE + '/' },
      { nome: 'Loja', url: SITE + '/loja' },
      { nome: 'Por ambiente', url: SITE + '/loja/aplicacoes' },
      { nome: app.titulo, url },
    ])),
  }, main, { prioridade: '0.8' });
}

/* ------------------------------------------------- sitemap, robots e 404 */

const hoje = new Date().toISOString().slice(0, 10);
/* Páginas do site que não passam por este gerador, mas precisam estar no
   sitemap: a home da locação e a landing de venda. O totem de LED virou uma
   seção da home (/#totem-led); /painel-de-led agora é 301 e saiu daqui. */
const PAGINAS_FIXAS = [
  { loc: SITE + '/', prioridade: '1.0' },
  { loc: SITE + '/comprar', prioridade: '0.9' },
];
/* Com a loja fora do ar, as URLs de /loja redirecionam — e sitemap cheio de
   redirect é erro no Search Console. Ficam de fora até a loja voltar. */
/* As URLs de evento vêm do módulo de dados, não de uma lista mantida aqui:
   página nova entrando no site sem entrar no sitemap é o erro clássico.
   Com publicar:false, urlsSitemap devolve vazio — mesma disciplina da loja
   fora do ar, que também fica fora daqui. */
const urlsEventos = eventosDados.urlsSitemap(eventosDados.validar(eventosDados.carregar(), { raiz: RAIZ }), SITE);
const todasUrls = (LOJA_ATIVA ? PAGINAS_FIXAS.concat(urls) : PAGINAS_FIXAS.slice()).concat(urlsEventos);

fs.writeFileSync(path.join(RAIZ, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${todasUrls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${hoje}</lastmod>
    <priority>${u.prioridade}</priority>
  </url>`).join('\n')}
</urlset>
`);
console.log('  -> sitemap.xml (%d URLs)', todasUrls.length);

fs.writeFileSync(path.join(RAIZ, 'robots.txt'),
  `User-agent: *
Allow: /

# Páginas de fluxo de compra não têm o que indexar
Disallow: /loja/carrinho
Disallow: /loja/sucesso
Disallow: /loja/pendente
Disallow: /loja/erro
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`);
console.log('  -> robots.txt');
