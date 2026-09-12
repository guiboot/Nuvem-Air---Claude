/* Dados dos cases de evento — fonte única.
 *
 * Por que é um módulo e não leitura direta do JSON: quem escreve o
 * sitemap.xml é o tools/gerar-loja.js, não o gerador de eventos. Se cada um
 * mantivesse sua lista de URLs, página nova entraria no site sem entrar no
 * sitemap. Os dois importam daqui. É a mesma razão pela qual o gerar-loja.js
 * importa loja-core.js em vez de recalcular preço.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/* `institucional` existiu e foi fundida em `corporativo`: com um case só, o
   filtro virava uma vitrine de um card. Hospital e escola são evento
   corporativo para quem busca — a distinção não ajudava ninguém a achar. */
const CATEGORIAS = ['casamento', 'corporativo', 'industria', 'galpao'];
const TIPOS = ['evento', 'mensal'];
const SLUG_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/* Mesma exigência do slug, só que com ponto liberado para a extensão do
   arquivo. Nome de mídia acentuado existe no Mac de quem edita e dá 404 na
   Vercel — é o modo de falha documentado em accented-filenames-404-on-vercel. */
const NOME_MIDIA_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+$/;

/* Campos de texto que vão para a página e, por isso, não podem sair com
   marcação de revisão pendente. */
const CAMPOS_TEXTO = ['cliente', 'cidade', 'uf', 'data', 'quantidade', 'area', 'desafio', 'solucao', 'resultado'];

function carregar(opcoes = {}) {
  const raiz = opcoes.raiz || path.join(__dirname, '..');
  return JSON.parse(fs.readFileSync(path.join(raiz, 'eventos.json'), 'utf8'));
}

function validar(dados, opcoes = {}) {
  if (!dados || !Array.isArray(dados.cases)) throw new Error('eventos.json: "cases" precisa ser uma lista');

  const vistos = new Set();
  const titulos = new Set();

  for (const c of dados.cases) {
    if (!SLUG_VALIDO.test(String(c.slug || ''))) {
      throw new Error(`slug inválido: ${JSON.stringify(c.slug)} — use só a-z, 0-9 e hífen (acento vira 404 na Vercel)`);
    }
    if (vistos.has(c.slug)) throw new Error(`slug duplicado: ${c.slug}`);
    vistos.add(c.slug);

    if (!TIPOS.includes(c.tipo)) throw new Error(`${c.slug}: tipo inválido "${c.tipo}" — use ${TIPOS.join(' ou ')}`);
    if (!CATEGORIAS.includes(c.categoria)) {
      throw new Error(`${c.slug}: categoria inválida "${c.categoria}" — use uma de ${CATEGORIAS.join(', ')}`);
    }

    if (!Array.isArray(c.midia) || c.midia.length === 0) throw new Error(`${c.slug}: sem mídia`);

    for (const m of c.midia) {
      for (const [campo, nome] of [['arquivo', m.arquivo], ['poster', m.poster]]) {
        if (nome == null) continue;
        if (!NOME_MIDIA_VALIDO.test(String(nome))) {
          throw new Error(`${c.slug}: ${campo} de mídia inválido: ${JSON.stringify(nome)} — use só a-z, 0-9 e hífen (acento vira 404 na Vercel)`);
        }
      }
    }

    const seo = c.seo || {};
    for (const campo of ['titulo', 'descricao', 'h1']) {
      if (!String(seo[campo] || '').trim()) throw new Error(`${c.slug}: seo.${campo} vazio`);
    }
    if (titulos.has(seo.titulo)) throw new Error(`título de SEO repetido: "${seo.titulo}" — cada case precisa do seu`);
    titulos.add(seo.titulo);

    /* Com publicar:false as páginas saem noindex e fora do sitemap, então
       rascunho ainda é aceitável. Ligar publicar é o gesto que exige o
       conteúdo revisado. */
    if (dados.publicar) {
      for (const campo of CAMPOS_TEXTO.concat(['seo'])) {
        const valor = campo === 'seo' ? Object.values(seo).join(' ') : c[campo];
        if (String(valor == null ? '' : valor).includes('REVISAR')) {
          throw new Error(`${c.slug}: campo "${campo}" ainda tem REVISAR — revise antes de publicar`);
        }
      }
    }

    if (opcoes.raiz) {
      for (const m of c.midia) {
        for (const nome of [m.arquivo, m.poster].filter(Boolean)) {
          const caminho = path.join(opcoes.raiz, 'assets', 'eventos', c.slug, nome);
          if (!fs.existsSync(caminho)) throw new Error(`${c.slug}: mídia ausente em disco — ${caminho}`);
        }
      }
    }
  }

  return dados;
}

function urlsSitemap(dados, site) {
  if (!dados.publicar) return [];
  return [{ loc: site + '/eventos', prioridade: '0.8' }]
    .concat(dados.cases.map((c) => ({ loc: `${site}/eventos/${c.slug}`, prioridade: '0.7' })));
}

function irmaos(dados, slug, n = 2) {
  const eu = dados.cases.find((c) => c.slug === slug);
  const outros = dados.cases.filter((c) => c.slug !== slug);
  const mesma = outros.filter((c) => eu && c.categoria === eu.categoria);
  const resto = outros.filter((c) => !eu || c.categoria !== eu.categoria);
  return mesma.concat(resto).slice(0, n);
}

module.exports = { carregar, validar, urlsSitemap, irmaos, CATEGORIAS, TIPOS };
