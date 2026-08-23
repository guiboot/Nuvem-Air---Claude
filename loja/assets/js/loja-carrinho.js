/* Carrinho persistido. Recebe o storage por parâmetro para poder ser
   testado fora do navegador e para sobreviver a Safari privado, onde
   localStorage existe mas lança ao gravar. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./loja-core.js'));
  else root.LojaCarrinho = factory(root.LojaCore);
})(typeof self !== 'undefined' ? self : this, function (LojaCore) {
  'use strict';

  var CHAVE = 'nuvemair.carrinho';
  var QTD_MAX = LojaCore.QTD_MAX;

  function criarCarrinho(storage) {
    function ler() {
      var bruto;
      try { bruto = storage.getItem(CHAVE); } catch (e) { return []; }
      if (!bruto) return [];
      var dados;
      try { dados = JSON.parse(bruto); } catch (e) { return []; }
      if (!Array.isArray(dados)) return [];
      return dados.filter(function (i) {
        return i && typeof i.sku === 'string' && Number.isInteger(i.qtd) && i.qtd > 0;
      }).map(function (i) {
        return { sku: i.sku, qtd: Math.min(i.qtd, QTD_MAX) };
      });
    }

    function gravar(itens) {
      try { storage.setItem(CHAVE, JSON.stringify(itens)); } catch (e) { /* sessão sem storage: segue em memória */ }
      return itens;
    }

    function adicionar(sku, qtd) {
      var n = Number.isInteger(qtd) ? qtd : 1;
      var itens = ler();
      var existente = itens.find(function (i) { return i.sku === sku; });
      if (existente) existente.qtd = Math.min(existente.qtd + n, QTD_MAX);
      else itens.push({ sku: sku, qtd: Math.min(Math.max(n, 1), QTD_MAX) });
      return gravar(itens);
    }

    function definirQtd(sku, qtd) {
      if (!Number.isInteger(qtd) || qtd <= 0) return remover(sku);
      var itens = ler().map(function (i) {
        return i.sku === sku ? { sku: sku, qtd: Math.min(qtd, QTD_MAX) } : i;
      });
      return gravar(itens);
    }

    function remover(sku) {
      return gravar(ler().filter(function (i) { return i.sku !== sku; }));
    }

    function limpar() {
      try { storage.removeItem(CHAVE); } catch (e) { /* idem */ }
      return [];
    }

    function totalItens() {
      return ler().reduce(function (s, i) { return s + i.qtd; }, 0);
    }

    return {
      ler: ler,
      adicionar: adicionar,
      definirQtd: definirQtd,
      remover: remover,
      limpar: limpar,
      totalItens: totalItens
    };
  }

  return { CHAVE: CHAVE, criarCarrinho: criarCarrinho };
});
