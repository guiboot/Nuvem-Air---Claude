const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const dados = require('../tools/eventos-dados.js');

function caseValido(extra) {
  return Object.assign({
    slug: 'casamento-em-loanda',
    tipo: 'evento',
    categoria: 'casamento',
    cliente: 'Casamento em Loanda',
    cidade: 'Loanda',
    uf: 'PR',
    data: '2025-11',
    equipamento: ['Climatizador Industrial Compacto'],
    quantidade: '4',
    area: '300 m²',
    desafio: 'Recepção ao ar livre em novembro.',
    solucao: 'Quatro climatizadores nas laterais da tenda.',
    resultado: 'Ambiente a 6 °C abaixo da temperatura externa.',
    midia: [{ tipo: 'imagem', arquivo: 'casamento-em-loanda-1.webp', poster: null, alt: 'Climatizador em casamento' }],
    seo: {
      titulo: 'Aluguel de climatizador para casamento em Loanda · Nuvem Air',
      descricao: 'Como a Nuvem Air climatizou um casamento em Loanda, no Paraná.',
      h1: 'Um casamento em Loanda sem ninguém abanando o leque'
    }
  }, extra);
}

const base = (cases, publicar = true) => ({ publicar, cases });

test('aceita um conjunto válido', () => {
  assert.doesNotThrow(() => dados.validar(base([caseValido()])));
});

test('recusa slug com acento', () => {
  assert.throws(() => dados.validar(base([caseValido({ slug: 'casamento-loandá' })])), /slug/i);
});

test('recusa slug com maiúscula ou espaço', () => {
  assert.throws(() => dados.validar(base([caseValido({ slug: 'Casamento Loanda' })])), /slug/i);
});

test('recusa slug duplicado', () => {
  assert.throws(() => dados.validar(base([caseValido(), caseValido()])), /duplicad/i);
});

test('recusa categoria fora do vocabulário', () => {
  assert.throws(() => dados.validar(base([caseValido({ categoria: 'festa' })])), /categoria/i);
});

test('recusa tipo fora do vocabulário', () => {
  assert.throws(() => dados.validar(base([caseValido({ tipo: 'anual' })])), /tipo/i);
});

test('recusa case sem mídia', () => {
  assert.throws(() => dados.validar(base([caseValido({ midia: [] })])), /mídia/i);
});

test('recusa nome de arquivo de mídia com acento', () => {
  const c = caseValido({ midia: [{ tipo: 'imagem', arquivo: 'casamento-loandá-1.webp', poster: null, alt: 'x' }] });
  assert.throws(() => dados.validar(base([c])), /arquivo/i);
});

test('recusa nome de poster com acento', () => {
  const c = caseValido({ midia: [{ tipo: 'video', arquivo: 'casamento-em-loanda-1.mp4', poster: 'capa-loandá.webp', alt: 'x' }] });
  assert.throws(() => dados.validar(base([c])), /poster/i);
});

test('recusa título de SEO vazio', () => {
  const c = caseValido();
  c.seo = Object.assign({}, c.seo, { titulo: '' });
  assert.throws(() => dados.validar(base([c])), /seo\.titulo/i);
});

test('recusa títulos de SEO repetidos entre cases', () => {
  const a = caseValido();
  const b = caseValido({ slug: 'outro-case' });
  assert.throws(() => dados.validar(base([a, b])), /t[ií]tulo/i);
});

test('recusa REVISAR pendente quando publicar é true', () => {
  assert.throws(() => dados.validar(base([caseValido({ cidade: 'REVISAR: Loanda' })])), /REVISAR/);
});

test('tolera REVISAR pendente quando publicar é false', () => {
  assert.doesNotThrow(() => dados.validar(base([caseValido({ cidade: 'REVISAR: Loanda' })], false)));
});

test('urlsSitemap devolve a listagem mais um por case quando publicar é true', () => {
  const u = dados.urlsSitemap(base([caseValido(), caseValido({ slug: 'outro', seo: Object.assign({}, caseValido().seo, { titulo: 'Outro título' }) })]), 'https://nuvemair.com.br');
  assert.strictEqual(u.length, 3);
  assert.strictEqual(u[0].loc, 'https://nuvemair.com.br/eventos');
  assert.strictEqual(u[0].prioridade, '0.8');
  assert.strictEqual(u[1].loc, 'https://nuvemair.com.br/eventos/casamento-em-loanda');
  assert.strictEqual(u[1].prioridade, '0.7');
});

test('urlsSitemap devolve vazio quando publicar é false', () => {
  assert.deepStrictEqual(dados.urlsSitemap(base([caseValido()], false), 'https://nuvemair.com.br'), []);
});

test('irmaos prefere a mesma categoria e nunca devolve o próprio', () => {
  const conj = base([
    caseValido({ slug: 'a' }),
    caseValido({ slug: 'b', categoria: 'industria', seo: { titulo: 'T b', descricao: 'd', h1: 'h' } }),
    caseValido({ slug: 'c', seo: { titulo: 'T c', descricao: 'd', h1: 'h' } }),
    caseValido({ slug: 'd', seo: { titulo: 'T d', descricao: 'd', h1: 'h' } })
  ]);
  const r = dados.irmaos(conj, 'a', 2);
  assert.strictEqual(r.length, 2);
  assert.ok(!r.some((x) => x.slug === 'a'));
  assert.deepStrictEqual(r.map((x) => x.categoria), ['casamento', 'casamento']);
});

test('o eventos.json real do projeto passa na validação, mídia em disco incluída', () => {
  const raiz = path.join(__dirname, '..');
  const reais = dados.carregar();

  /* Confere a contagem contra o manifesto da mídia em vez de um número
     cravado. Um número fixo aqui vira mentira na primeira vez que um case
     entra ou sai; amarrado ao manifesto, o teste continua verdadeiro e ainda
     pega o caso que importa — dado e mídia saírem de sincronia. */
  const manifesto = JSON.parse(fs.readFileSync(path.join(raiz, 'tools/manifest-eventos.json'), 'utf8'));
  assert.strictEqual(reais.cases.length, Object.keys(manifesto).length,
    'eventos.json e tools/manifest-eventos.json discordam na quantidade de cases');
  assert.ok(reais.cases.length > 0, 'nenhum case carregado');

  assert.doesNotThrow(() => dados.validar(reais, { raiz }));
});
