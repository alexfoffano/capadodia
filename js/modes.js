/* As versões do jogo, num arquivo só porque tanto o navegador quanto as
   ferramentas em Node precisam saber quais álbuns entram em cada uma.

   filter — quais álbuns compõem o acervo daquela versão.
   seed   — semente do embaralhamento inicial, usada quando ainda não existe
            calendário congelado (tools/calendar.mjs --init).

   Para criar uma versão nova, acrescente uma entrada aqui, dê nome a ela em
   js/i18n.js e rode `npm run calendar`. */
(function (root) {
  'use strict';

  var MODES = {
    intl: { filter: function (a) { return a.country !== 'Brasil'; }, seed: 0x1A7E51 },
    tudo: { filter: function () { return true; }, seed: 0x5EED1A }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = MODES;
  else root.MODES = MODES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
