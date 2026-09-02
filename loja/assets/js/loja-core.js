/* Lógica pura da loja: preço, total, frete e validação.
   Sem DOM e sem rede — roda igual no navegador e no Node, e é por isso
   que api/checkout.js consegue recalcular o total com as mesmas regras
   que a página mostrou ao cliente. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LojaCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var QTD_MAX = 20;

  function formatarBRL(centavos) {
    if (centavos === null || centavos === undefined) return 'Sob consulta';
    var neg = centavos < 0;
    var abs = Math.abs(Math.round(centavos));
    var reais = String(Math.floor(abs / 100));
    var cents = String(abs % 100).padStart(2, '0');
    var comMilhar = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + 'R$ ' + comMilhar + ',' + cents;
  }

  function produto(catalogo, sku) {
    if (!catalogo || !catalogo.produtos) return null;
    return catalogo.produtos[sku] || null;
  }

  function temPrecoDefinido(catalogo, sku) {
    var p = produto(catalogo, sku);
    return !!p && typeof p.precoCentavos === 'number';
  }

  /* Esgotado é independente de preço: o produto pode ter valor publicado e
     mesmo assim não estar à venda. Por isso não dá para deduzir estoque de
     precoCentavos — quem responde é a chave esgotado do catálogo. */
  function disponivel(catalogo, sku) {
    var p = produto(catalogo, sku);
    return !!p && p.esgotado !== true;
  }

  /* O preço vem SEMPRE do catálogo. Qualquer precoCentavos que venha
     junto do item é descartado de propósito. */
  function subtotalCentavos(catalogo, itens) {
    return (itens || []).reduce(function (soma, item) {
      var p = produto(catalogo, item.sku);
      if (!p || typeof p.precoCentavos !== 'number') return soma;
      return soma + p.precoCentavos * item.qtd;
    }, 0);
  }

  /* precoDeCentavos é só vitrine: o preço "de", riscado. Nunca entra em
     conta nenhuma — quem cobra é sempre precoCentavos. */
  function descontoPercentual(catalogo, sku) {
    var p = produto(catalogo, sku);
    if (!p) return null;
    if (typeof p.precoCentavos !== 'number' || typeof p.precoDeCentavos !== 'number') return null;
    if (p.precoDeCentavos <= p.precoCentavos) return null;
    return Math.round((1 - p.precoCentavos / p.precoDeCentavos) * 100);
  }

  /* ---------- Pagamento ---------- */

  /* O desconto do Pix é real: quando o cliente escolhe Pix, é este valor que
     o servidor manda para o Mercado Pago, restringindo o checkout ao Pix.
     Anunciar "no Pix" e cobrar o cheio seria propaganda enganosa. */
  function descontoPixCentavos(catalogo, valorCentavos) {
    var pct = catalogo && catalogo.descontoPixPercentual;
    if (typeof pct !== 'number' || pct <= 0) return 0;
    return Math.round(valorCentavos * pct / 100);
  }

  function precoPixCentavos(catalogo, sku) {
    var p = produto(catalogo, sku);
    if (!p || typeof p.precoCentavos !== 'number') return null;
    var desc = descontoPixCentavos(catalogo, p.precoCentavos);
    return desc > 0 ? p.precoCentavos - desc : null;
  }

  function parcelaCentavos(catalogo, sku) {
    var p = produto(catalogo, sku);
    var n = catalogo && catalogo.parcelamentoMax;
    if (!p || typeof p.precoCentavos !== 'number') return null;
    if (typeof n !== 'number' || n < 2) return null;
    return Math.ceil(p.precoCentavos / n);
  }

  /* O desconto incide só sobre os produtos — nunca sobre o frete. E é
     calculado item a item, exatamente como api/checkout.js faz ao montar a
     preferência: se um arredondasse no total e o outro por item, o carrinho
     mostraria um valor e o Mercado Pago cobraria outro. */
  function totalCentavos(catalogo, itens, freteCentavos, pagamento) {
    var subtotal = subtotalCentavos(catalogo, itens);
    var frete = typeof freteCentavos === 'number' ? freteCentavos : 0;
    var desconto = 0;
    if (pagamento === 'pix') {
      (itens || []).forEach(function (item) {
        var pix = precoPixCentavos(catalogo, item.sku);
        var p = produto(catalogo, item.sku);
        if (pix === null || !p) return;
        desconto += (p.precoCentavos - pix) * item.qtd;
      });
    }
    return { subtotal: subtotal, frete: frete, desconto: desconto, total: subtotal - desconto + frete };
  }

  function normalizarCep(cep) {
    if (typeof cep !== 'string' && typeof cep !== 'number') return null;
    var so = String(cep).replace(/\D/g, '');
    return so.length === 8 ? so : null;
  }

  function resolverFrete(catalogo, cep) {
    var n = normalizarCep(cep);
    if (!n) return { tipo: 'cep-invalido' };
    var faixas = (catalogo && catalogo.frete && catalogo.frete.faixas) || [];
    for (var i = 0; i < faixas.length; i++) {
      var f = faixas[i];
      if (n >= f.de && n <= f.ate) return { tipo: 'fixo', valorCentavos: f.valorCentavos };
    }
    return { tipo: 'a-combinar' };
  }

  function validarItens(catalogo, itens) {
    if (!Array.isArray(itens) || itens.length === 0) {
      return { ok: false, erro: 'O carrinho está vazio.' };
    }
    var limpos = [];
    for (var i = 0; i < itens.length; i++) {
      var item = itens[i] || {};
      var p = produto(catalogo, item.sku);
      if (!p) return { ok: false, erro: 'Produto desconhecido: ' + item.sku };
      if (p.esgotado === true) {
        return { ok: false, erro: 'O produto ' + item.sku + ' está esgotado.' };
      }
      if (typeof p.precoCentavos !== 'number') {
        return { ok: false, erro: 'O produto ' + item.sku + ' está sem preço definido.' };
      }
      var qtd = item.qtd;
      if (!Number.isInteger(qtd) || qtd < 1 || qtd > QTD_MAX) {
        return { ok: false, erro: 'Quantidade inválida para ' + item.sku + '.' };
      }
      limpos.push({ sku: item.sku, qtd: qtd });
    }
    return { ok: true, itens: limpos };
  }

  return {
    QTD_MAX: QTD_MAX,
    formatarBRL: formatarBRL,
    produto: produto,
    temPrecoDefinido: temPrecoDefinido,
    disponivel: disponivel,
    subtotalCentavos: subtotalCentavos,
    descontoPercentual: descontoPercentual,
    descontoPixCentavos: descontoPixCentavos,
    precoPixCentavos: precoPixCentavos,
    parcelaCentavos: parcelaCentavos,
    totalCentavos: totalCentavos,
    normalizarCep: normalizarCep,
    resolverFrete: resolverFrete,
    validarItens: validarItens
  };
});
