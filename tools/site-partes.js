/* Cabeçalho e rodapé do site, extraídos do index.html.
 *
 * Por que extrair em vez de duplicar: as páginas de evento precisam do mesmo
 * nav e do mesmo rodapé da home. Copiar o markup para dentro do gerador
 * garantiria que, no dia em que o menu mudar, metade do site fique para trás.
 *
 * O index.html usa caminhos relativos (assets/js/app.js). Uma página em
 * /eventos/<slug>/ está dois níveis abaixo — daí o absolutizar().
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function extrair(html, marcador) {
  const inicio = html.indexOf(`<!-- ${marcador}:INICIO -->`);
  const fim = html.indexOf(`<!-- ${marcador}:FIM -->`);
  if (inicio === -1 || fim === -1 || fim < inicio) {
    throw new Error(`marcador ${marcador} não encontrado no index.html — os comentários <!-- ${marcador}:INICIO --> e <!-- ${marcador}:FIM --> precisam existir`);
  }
  return html.slice(inicio + `<!-- ${marcador}:INICIO -->`.length, fim);
}

function absolutizar(html) {
  return html
    .replace(/(src|href)="assets\//g, '$1="/assets/')
    .replace(/href="#/g, 'href="/#');
}

function partes(opcoes = {}) {
  const raiz = opcoes.raiz || path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  return {
    nav: absolutizar(extrair(html, 'NAV')),
    rodape: absolutizar(extrair(html, 'RODAPE'))
  };
}

module.exports = { extrair, absolutizar, partes };
