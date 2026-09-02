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

const RAIZ = path.join(__dirname, '..');
/* Domínio de destino. A loja passou a morar em nuvemair.com.br/loja para
   herdar a autoridade do domínio principal, em vez de começar do zero num
   subdomínio. SITE_URL permite gerar para outro host sem editar código. */
const SITE = process.env.SITE_URL || 'https://nuvemair.com.br';
const WA_NUM = '5544988049444';
const CSS_V = '20260902-1';

/* A loja está temporariamente fora do ar. Quem fecha a porta é o vercel.json
   (tudo em /loja redireciona para /loja-indisponivel) e o api/checkout.js, que
   recusa qualquer pedido. As páginas da loja continuam sendo geradas — só o
   caminho até elas é que está fechado —, mas o que aponta para fora precisa
   saber: a 404 da raiz e o sitemap.

   Para reabrir a loja, os três andam juntos: volte esta chave para true, ligue
   LOJA_ATIVA em api/checkout.js e tire as regras de /loja do vercel.json. */
const LOJA_ATIVA = false;

const cat = JSON.parse(fs.readFileSync(path.join(RAIZ, 'loja/catalogo.json'), 'utf8'));
const apps = JSON.parse(fs.readFileSync(path.join(RAIZ, 'loja/aplicacoes.json'), 'utf8')).aplicacoes;
const lerParcial = (n) => fs.readFileSync(path.join(RAIZ, 'loja', n), 'utf8').trimEnd();

/* ---------------------------------------------------------------- utilidades */

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const wa = (texto) => 'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(texto);

const footer = lerParcial('_rodape.html');
const waFloat = lerParcial('_whatsapp.html');

const SVG = {
  busca: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>',
  conta: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
  carrinho: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.2l2 11.2A2 2 0 0 0 9.2 17h8.2a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20.4" r="1.1"/><circle cx="18" cy="20.4" r="1.1"/></svg>',
  pix: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8 21.2 12 12 21.2 2.8 12z"/><path d="M8.4 8.4 12 12l3.6-3.6"/></svg>',
  cartao: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19"/></svg>',
  entrega: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5h4l3 3v3h-7z"/><circle cx="6.5" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg>',
};

/* -------------------------------------------------------------- componentes */

function header() {
  const cats = [['/loja', 'Todos']]
    .concat(Object.keys(cat.categorias).map((k) => ['/loja#' + k, cat.categorias[k].titulo]))
    .concat([['/loja/aplicacoes', 'Por ambiente']])
    .map(([h, r]) => `      <a href="${h}">${esc(r)}</a>`).join('\n');

  return `  <header class="lojahdr">
    <div class="container lojahdr__topo">
      <a class="lojahdr__logo" href="/loja" aria-label="Loja Nuvem Air">
        <img src="/loja/assets/img/logo-loja.png?v=${CSS_V}" alt="Nuvem Air" width="154" height="28" />
      </a>

      <form class="lojahdr__busca" role="search" data-busca>
        <label class="sr-only" for="busca">Buscar produtos</label>
        <input type="search" id="busca" name="q" placeholder="Buscar climatizador, aquecedor&hellip;" autocomplete="off" />
        <button type="submit" aria-label="Buscar">${SVG.busca}</button>
      </form>

      <div class="lojahdr__acoes">
        <a class="lojahdr__icone" href="${wa('Olá! Vim pela loja da Nuvem Air e quero falar com um especialista.')}" target="_blank" rel="noopener" aria-label="Falar com um especialista no WhatsApp">${SVG.conta}</a>
        <a class="lojahdr__icone" href="/loja/carrinho" aria-label="Carrinho">
          ${SVG.carrinho}
          <span class="lojahdr__badge" data-carrinho-contador hidden>0</span>
        </a>
      </div>
    </div>

    <nav class="container lojahdr__cats" aria-label="Categorias">
${cats}
      <a class="lojahdr__voltar" href="/">&larr; Site da Nuvem Air</a>
    </nav>
  </header>`;
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
  const rotulo = !disp ? 'Esgotado' : (tem ? 'Comprar agora' : 'Sob consulta');
  const aviso = !disp
    ? `<span class="loja-badge-consulta">Sem estoque no momento. <a href="${wa('Olá! Quero ser avisado quando o ' + p.nome + ' voltar ao estoque.')}" target="_blank" rel="noopener">Avise-me quando voltar</a>.</span>`
    : (tem ? '' :
      `<span class="loja-badge-consulta">Ainda sem preço publicado. <a href="${wa('Olá! Quero o preço do ' + p.nome + '.')}" target="_blank" rel="noopener">Peça o valor pelo WhatsApp</a>.</span>`);

  return `        <article class="loja-card${disp ? '' : ' loja-card--esgotado'}" data-sku="${sku}" data-categoria="${p.categoria}" data-preco="${p.precoCentavos === null ? '' : p.precoCentavos}" data-nome="${esc(p.nome)}">
          <a class="loja-card__img" href="/loja/${p.slug}" tabindex="-1" aria-hidden="true">
            <img src="${p.imagem}" alt="${esc(p.nome)}" loading="lazy" width="400" height="400" />
          </a>
          <div class="loja-card__body">
            <span class="loja-card__tag">${esc(p.tag)}</span>${disp ? '' : '\n            <span class="loja-selo-esgotado">Esgotado</span>'}
            <h3><a href="/loja/${p.slug}">${esc(p.nome)}</a></h3>
            <div class="loja-card__rodape">
              ${blocoPreco(sku)}
              ${blocoObservacao(sku)}
              <a class="btn btn--primary full loja-card__btn" href="/loja/${p.slug}"${tem ? '' : ' disabled'}>${rotulo}</a>
              ${aviso}
            </div>
          </div>
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
  <link rel="icon" href="/loja/assets/img/icon-primary.png?v=${CSS_V}" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet" />
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

/* As três peças do banner em ordem de profundidade — fundo primeiro, frente por
   último —, porque quem vem depois no DOM pinta por cima. O plano de cada uma
   define escala e sombra no CSS: elas dividem uma linha de chão só, em vez de
   ficarem lado a lado no mesmo tamanho. */
/* As peças do banner usam recortes próprios (banner-*.webp), colados no
   contorno do produto. Os arquivos da vitrine não servem aqui: o do NU23 tem
   25% de área vazia embaixo e o do NU56DS tem 5%, então alinhar os quadros pelo
   pé deixava cada produto num chão diferente — que era o motivo de parecerem
   recortes soltos. Com o quadro rente, flex-end já põe os três no mesmo chão.

   `altura` é a proporção entre eles, em % da faixa: a torre a gás tem mais de
   dois metros e é de longe a mais alta. Não é a escala física exata, que faria
   os climatizadores sumirem do lado dela — é a ordem de grandeza real com a
   diferença comprimida.

   A ordem é do fundo para a frente, porque quem vem depois no DOM pinta por
   cima. `w`/`h` são as dimensões reais do arquivo, para o navegador reservar o
   espaço certo antes de a imagem chegar. */
const BANNER_PECAS = [
  { sku: 'NU56DS', plano: 'fundo', arquivo: 'banner-ni56ds', w: 542, h: 676, altura: 66 },
  { sku: 'AQ-PIRAMIDE-INOX', plano: 'meio', arquivo: 'banner-aq-piramide-inox', w: 295, h: 1078, altura: 100 },
  { sku: 'NU23', plano: 'frente', arquivo: 'banner-ni23', w: 302, h: 533, altura: 72 },
];

const bannerFotos = BANNER_PECAS
  .filter((peca) => cat.produtos[peca.sku])
  .map((peca) => `\n          <div class="loja-banner__peca loja-banner__peca--${peca.plano}" style="--altura:${peca.altura}%"><img src="/loja/assets/img/${peca.arquivo}.webp" alt="${esc(cat.produtos[peca.sku].nome)}" width="${peca.w}" height="${peca.h}" /></div>`)
  .join('');

/* Menor preço da vitrine para o gancho do banner. É o preço cheio, não o do
   Pix: o desconto continua valendo na vitrine, na página de produto e no
   checkout, mas o hero anuncia o valor sem condição atrelada.

   Sai do catálogo em vez de ficar chumbado aqui: sete dos dez produtos estão
   sob consulta e essa lista muda. Se um dia nenhum tiver preço, o gancho
   simplesmente não aparece. */
const precosVitrine = skus
  .map((s) => cat.produtos[s].precoCentavos)
  .filter((v) => typeof v === 'number');
const menorPreco = precosVitrine.length ? Math.min.apply(null, precosVitrine) : null;

/* Sem os centavos: num gancho de hero o ",00" é só ruído. Se algum dia um
   preço quebrado entrar no catálogo, ele aparece por extenso mesmo. */
const semCentavos = (centavos) => core.formatarBRL(centavos).replace(/,00$/, '');

const gancho = menorPreco
  ? `\n          <p class="loja-banner__gancho"><span>${skus.length} modelos &middot; a partir de ${semCentavos(menorPreco)}</span></p>`
  : '';

/* Seções por categoria, todas no HTML. O filtro do navegador só mostra e
   esconde o que já veio pronto — nada é montado por JS. */
const secoes = Object.keys(cat.categorias).map((chave) => {
  const meta = cat.categorias[chave];
  const doGrupo = skus.filter((s) => cat.produtos[s].categoria === chave);
  if (!doGrupo.length) return '';
  return `      <section class="loja-secao" id="${chave}" data-secao="${chave}">
        <h2 class="loja-secao__titulo">${esc(meta.titulo)}</h2>
        <p class="loja-secao__resumo">${esc(meta.resumo)}</p>
        <div class="loja-grid">
${doGrupo.map(card).join('\n')}
        </div>
      </section>`;
}).filter(Boolean).join('\n\n');

/* ---------------------------------------------------------------- cenário do banner */

/* O fundo do hero é um vão de galpão em perspectiva de um ponto, desenhado aqui
   em SVG. Não é foto porque não temos nenhuma em formato wide — as que existem
   são print de celular na vertical — e vetor resolve melhor de qualquer jeito:
   fica nítido em qualquer tela, pesa poucos KB inline e não custa um request.

   Ponto de fuga deslocado para a direita, atrás dos produtos, para a fuga das
   linhas empurrar o olho até eles. O pórtico mais próximo é maior que a viewBox
   de propósito: as laterais saem de quadro em vez de terminar dentro dele. */
const FUGA = { x: 1000, y: 300 };
const PORTICO = { esq: -400, dir: 1500, topo: -160, base: 700 };

const rumoX = (de, t) => de + (FUGA.x - de) * t;
const rumoY = (de, t) => de + (FUGA.y - de) * t;
const n = (v) => Number(v.toFixed(1));

/* Profundidades escolhidas na mão: o espaçamento aperta conforme recua, que é
   o que o olho espera de uma sequência de pórticos iguais indo embora. */
/* Profundidades escolhidas na mão: o espaçamento aperta conforme recua, que é
   o que o olho espera de uma sequência de pórticos iguais indo embora. */
const PROFUNDIDADES = [0.1, 0.31, 0.47, 0.6, 0.7];

const porticos = PROFUNDIDADES.map((t) => {
  const e = n(rumoX(PORTICO.esq, t));
  const d = n(rumoX(PORTICO.dir, t));
  const topo = n(rumoY(PORTICO.topo, t));
  const base = n(rumoY(PORTICO.base, t));
  /* A opacidade cai rápido: pórtico distante com o mesmo peso do da frente
     achata tudo num desenho técnico, que era o efeito da primeira versão. */
  const opacidade = n(0.9 - 0.9 * t);
  const traco = n(2.6 - 2 * t);
  return `            <path d="M${e} ${base}V${topo}H${d}V${base}" opacity="${opacidade}" stroke-width="${traco}" />`;
}).join('\n');

/* Treliça só nos dois pórticos da frente. Mais atrás o traço fica menor que um
   pixel e o zigue-zague vira um borrão cinza — na primeira versão parecia
   moiré atravessando o topo do banner. */
const trelicas = PROFUNDIDADES.slice(0, 2).map((t) => {
  const e = rumoX(PORTICO.esq, t);
  const d = rumoX(PORTICO.dir, t);
  const topo = rumoY(PORTICO.topo, t);
  const altura = 46 * (1 - t);
  const passos = 14;
  const pontos = [];
  for (let i = 0; i <= passos; i += 1) {
    const x = e + ((d - e) * i) / passos;
    pontos.push(`${n(x)},${n(i % 2 ? topo + altura : topo)}`);
  }
  return `            <polyline points="${pontos.join(' ')}" opacity="${n(0.55 - 0.8 * t)}" stroke-width="${n(1.8 - 1.2 * t)}" />`;
}).join('\n');

/* As quatro arestas do vão indo para a fuga. São elas que dizem "galpão" antes
   de qualquer outra coisa; os pórticos só dão ritmo. */
const arestas = [
  [PORTICO.esq, PORTICO.topo], [PORTICO.dir, PORTICO.topo],
  [PORTICO.esq, PORTICO.base], [PORTICO.dir, PORTICO.base],
].map(([x, y]) => `            <path d="M${x} ${y}L${FUGA.x} ${FUGA.y}" opacity=".52" stroke-width="1.7" />`).join('\n');

/* O piso: o triângulo entre as duas arestas de baixo e a fuga. Sem ele os
   produtos ficam sobre um degradê liso e nada segura o pé deles. */
const piso = `<path d="M${PORTICO.esq} ${PORTICO.base}L${FUGA.x} ${FUGA.y}L${PORTICO.dir} ${PORTICO.base}Z" fill="url(#lb-piso)" />`;

const cenarioGalpao = `        <svg class="loja-banner__cenario" viewBox="0 0 1440 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="lb-piso" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stop-color="#c6d2ff" stop-opacity=".16" />
              <stop offset="1" stop-color="#c6d2ff" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="lb-feixe" x1="0" y1="0" x2=".3" y2="1">
              <stop offset="0" stop-color="#eef2ff" stop-opacity=".26" />
              <stop offset=".55" stop-color="#eef2ff" stop-opacity=".08" />
              <stop offset="1" stop-color="#eef2ff" stop-opacity="0" />
            </linearGradient>
            <radialGradient id="lb-vao" cx=".5" cy=".5" r=".5">
              <stop offset="0" stop-color="#f2f6ff" stop-opacity=".34" />
              <stop offset=".55" stop-color="#cfd9ff" stop-opacity=".12" />
              <stop offset="1" stop-color="#cfd9ff" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="lb-poca" cx=".5" cy=".5" r=".5">
              <stop offset="0" stop-color="#dbe4ff" stop-opacity=".22" />
              <stop offset="1" stop-color="#dbe4ff" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="lb-vinheta" cx=".52" cy=".46" r=".74">
              <stop offset=".42" stop-color="#060a2a" stop-opacity="0" />
              <stop offset="1" stop-color="#060a2a" stop-opacity=".5" />
            </radialGradient>
            <filter id="lb-suave" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <linearGradient id="lb-lateral" x1="0" y1="0" x2="1" y2="0">
              <stop offset=".2" stop-color="#fff" stop-opacity="0" />
              <stop offset=".62" stop-color="#fff" stop-opacity="1" />
            </linearGradient>
            <mask id="lb-so-direita">
              <rect width="1440" height="520" fill="url(#lb-lateral)" />
            </mask>
          </defs>

          <!-- O fundo do vão, aberto e claro. Dá profundidade e, de quebra,
               recorta a silhueta dos produtos que ficam na frente dele. -->
          <ellipse cx="${FUGA.x}" cy="${FUGA.y}" rx="470" ry="250" fill="url(#lb-vao)" />

          <!-- Piso e estrutura entram mascarados: nascem do nada na altura do
               texto e só ganham corpo na metade direita, atrás dos produtos.
               Sem isso, a aresta de baixo cruzava o canto esquerdo como uma
               diagonal solta, passando bem debaixo dos botões. -->
          <g mask="url(#lb-so-direita)">
            ${piso}
            <g class="loja-banner__estrutura" fill="none" stroke="#b6c4ff" stroke-linejoin="round">
${arestas}
${porticos}
${trelicas}
            </g>
          </g>

          <!-- Poça de luz no piso, sob o grupo de produtos: é ela que faz a
               sombra de contato aparecer. Contra fundo escuro a sombra some, e
               os produtos voltam a parecer recortes flutuando. -->
          <ellipse cx="1035" cy="548" rx="310" ry="46" fill="url(#lb-poca)" />

          <g filter="url(#lb-suave)">
            <polygon points="298,-30 404,-30 986,550 806,550" fill="url(#lb-feixe)" />
            <polygon points="596,-30 654,-30 1206,550 1112,550" fill="url(#lb-feixe)" opacity=".7" />
          </g>

          <rect width="1440" height="520" fill="url(#lb-vinheta)" />
        </svg>`;

const vitrineMain = `  <main>
    <section class="loja-banner">
${cenarioGalpao}
      <div class="container loja-banner__inner">
        <div class="loja-banner__texto">${gancho}
          <h1>Climatização e aquecimento para grandes ambientes</h1>
          <p>Climatizadores evaporativos e torres a gás para indústrias, galpões, restaurantes e eventos. Com nota fiscal, garantia e envio para todo o Brasil.</p>
          <div class="loja-banner__acoes">
            <a class="btn btn--lg btn--white" href="#portateis">Ver climatizadores</a>
            <a class="btn btn--lg btn--vazado" href="${wa('Olá! Vim pela loja da Nuvem Air e quero um orçamento.')}" target="_blank" rel="noopener">Solicitar orçamento</a>
          </div>
        </div>
        <div class="loja-banner__fotos">${bannerFotos}
        </div>
      </div>
    </section>

    <section class="loja-selos" aria-label="Condições de compra">
      <div class="container loja-selos__inner">
${selos}
      </div>
    </section>

    <section class="loja-vitrine">
      <div class="container loja-vitrine__inner">
        <aside class="loja-lateral" data-lateral></aside>
        <div data-vitrine>
          <div class="loja-vitrine__cab">
            <span class="loja-vitrine__cont" data-contagem>${skus.length} produtos</span>
          </div>
          <p class="loja-vitrine__nada" data-nada hidden>Nenhum produto com esses filtros. Tente ampliar a faixa de preço ou limpar a busca.</p>

${secoes}
        </div>
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
  const faq = faqDoProduto(sku);

  const garantia = p.categoria === 'aquecedores' ? 'Garantia do fabricante' : '2 anos de garantia';

  const produtoLd = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.nome, sku, description: p.resumo, image: imagemAbs,
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
        <div class="loja-produto__media">
          <img src="${p.imagem}" alt="${esc(p.nome)} — ${esc(p.tag)}" width="600" height="600" />
        </div>

        <div class="loja-produto__info">
          <span class="loja-card__tag">${esc(p.tag)}</span>${disp ? '' : '\n          <span class="loja-selo-esgotado">Esgotado</span>'}
          <h1>${esc(p.nome)}</h1>
          <p class="loja-produto__resumo">${esc(p.resumo)}</p>

          <div class="loja-produto__compra">
            ${blocoPreco(sku)}
            ${blocoObservacao(sku)}

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
   sitemap: a home da locação, a landing de venda e o painel de LED. */
const PAGINAS_FIXAS = [
  { loc: SITE + '/', prioridade: '1.0' },
  { loc: SITE + '/comprar', prioridade: '0.9' },
  { loc: SITE + '/painel-de-led', prioridade: '0.7' },
];
/* Com a loja fora do ar, as URLs de /loja redirecionam — e sitemap cheio de
   redirect é erro no Search Console. Ficam de fora até a loja voltar. */
const todasUrls = LOJA_ATIVA ? PAGINAS_FIXAS.concat(urls) : PAGINAS_FIXAS.slice();

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
