/* Peças compartilhadas entre os geradores estáticos (gerar-eventos.js e
 * gerar-loja.js): domínio de destino, número de WhatsApp, escape de HTML e o
 * link "wa.me". Extraído porque as duas cópias tinham os mesmos valores e o
 * número de WhatsApp já mudou uma vez nesta branch — constante duplicada é
 * como esse tipo de bug entra de novo.
 */
'use strict';

/* Domínio de destino. SITE_URL permite gerar para outro host sem editar
   código (ex.: ambiente de teste). */
const SITE = process.env.SITE_URL || 'https://nuvemair.com.br';

const WA_NUM = '5544988117615';

/* Nulo e indefinido viram string vazia em vez de "null"/"undefined" no HTML —
   campo ausente (ex.: observação de produto, poster de imagem) deve
   desaparecer da página, nunca aparecer escrito por extenso. */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const wa = (texto) => 'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(texto);

module.exports = { SITE, WA_NUM, esc, wa };
