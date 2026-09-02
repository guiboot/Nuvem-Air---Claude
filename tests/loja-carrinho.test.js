const test = require('node:test');
const assert = require('node:assert');
const { criarCarrinho } = require('../loja/assets/js/loja-carrinho.js');

function storageFalso(inicial) {
  const dados = Object.assign({}, inicial);
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
    _dados: dados
  };
}

test('carrinho novo começa vazio', () => {
  const c = criarCarrinho(storageFalso());
  assert.deepStrictEqual(c.ler(), []);
  assert.strictEqual(c.totalItens(), 0);
});

test('adicionar insere o item', () => {
  const c = criarCarrinho(storageFalso());
  assert.deepStrictEqual(c.adicionar('NU18'), [{ sku: 'NU18', qtd: 1 }]);
});

test('adicionar duas vezes soma a quantidade', () => {
  const c = criarCarrinho(storageFalso());
  c.adicionar('NU18');
  c.adicionar('NU18', 2);
  assert.deepStrictEqual(c.ler(), [{ sku: 'NU18', qtd: 3 }]);
  assert.strictEqual(c.totalItens(), 3);
});

test('adicionar satura no máximo permitido', () => {
  const c = criarCarrinho(storageFalso());
  c.adicionar('NU18', 19);
  c.adicionar('NU18', 10);
  assert.deepStrictEqual(c.ler(), [{ sku: 'NU18', qtd: 20 }]);
});

test('definirQtd troca a quantidade', () => {
  const c = criarCarrinho(storageFalso());
  c.adicionar('NU18');
  c.definirQtd('NU18', 5);
  assert.deepStrictEqual(c.ler(), [{ sku: 'NU18', qtd: 5 }]);
});

test('definirQtd para zero remove o item', () => {
  const c = criarCarrinho(storageFalso());
  c.adicionar('NU18');
  c.definirQtd('NU18', 0);
  assert.deepStrictEqual(c.ler(), []);
});

test('remover tira só o item pedido', () => {
  const c = criarCarrinho(storageFalso());
  c.adicionar('NU18');
  c.adicionar('NU9PRO');
  c.remover('NU18');
  assert.deepStrictEqual(c.ler(), [{ sku: 'NU9PRO', qtd: 1 }]);
});

test('limpar esvazia o carrinho', () => {
  const c = criarCarrinho(storageFalso());
  c.adicionar('NU18');
  c.limpar();
  assert.deepStrictEqual(c.ler(), []);
});

test('carrinho persiste entre instâncias com o mesmo storage', () => {
  const s = storageFalso();
  criarCarrinho(s).adicionar('NU23', 2);
  assert.deepStrictEqual(criarCarrinho(s).ler(), [{ sku: 'NU23', qtd: 2 }]);
});

test('conteúdo corrompido no storage não quebra a loja', () => {
  const c = criarCarrinho(storageFalso({ 'nuvemair.carrinho': 'isto não é json' }));
  assert.deepStrictEqual(c.ler(), []);
});

test('storage com formato inesperado é descartado', () => {
  const c = criarCarrinho(storageFalso({ 'nuvemair.carrinho': '{"sku":"NU18"}' }));
  assert.deepStrictEqual(c.ler(), []);
});

test('itens malformados são filtrados na leitura', () => {
  const s = storageFalso({ 'nuvemair.carrinho': '[{"sku":"NU18","qtd":2},{"qtd":3},{"sku":"NU9PRO","qtd":0}]' });
  assert.deepStrictEqual(criarCarrinho(s).ler(), [{ sku: 'NU18', qtd: 2 }]);
});

test('storage indisponível não derruba a página', () => {
  const quebrado = {
    getItem: () => { throw new Error('bloqueado'); },
    setItem: () => { throw new Error('bloqueado'); },
    removeItem: () => { throw new Error('bloqueado'); }
  };
  const c = criarCarrinho(quebrado);
  assert.deepStrictEqual(c.ler(), []);
  assert.doesNotThrow(() => c.adicionar('NU18'));
});
