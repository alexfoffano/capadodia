/* Instalação como app e o service worker.
   Fica separado do game.js porque não tem nada a ver com jogar: se este
   arquivo sumir, o jogo continua inteiro, só deixa de ser instalável. */
(function () {
  'use strict';

  /* ------------------------------------------------------ service worker */

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        /* sem service worker o jogo roda igual, só não abre sem internet */
      });
    });
  }

  /* --------------------------------------------------------- instalação */

  /* O Chrome avisa que dá para instalar e deixa a gente escolher a hora de
     perguntar. O Safari não tem esse evento: no iPhone a instalação é um
     item do menu de compartilhar, então lá o jeito é explicar. */
  var convite = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    convite = e;
    montar();
  });

  window.addEventListener('appinstalled', function () {
    convite = null;
    var linha = document.getElementById('instalar-linha');
    if (linha) linha.remove();
  });

  function jaEhApp() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      navigator.standalone === true;
  }

  function ehIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      /* iPad moderno se apresenta como Mac; o toque é o que o entrega */
      (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  }

  function montar() {
    if (jaEhApp()) return;
    if (document.getElementById('instalar-linha')) return;

    var rodape = document.getElementById('rodape');
    if (!rodape || !window.I18n) return;

    var linha = document.createElement('p');
    linha.className = 'instalar';
    linha.id = 'instalar-linha';

    var botao = document.createElement('button');
    botao.type = 'button';
    botao.textContent = window.I18n.t('install');
    botao.addEventListener('click', function () {
      if (convite && typeof convite.prompt === 'function') {
        try { convite.prompt(); } catch (e) { /* o navegador decide a hora */ }
        convite = null;
        linha.remove();
        return;
      }
      /* sem o evento (iPhone, ou Chrome que já perguntou): explica o caminho */
      var ajuda = document.getElementById('instalar-ajuda');
      if (ajuda) { ajuda.remove(); return; }
      ajuda = document.createElement('span');
      ajuda.id = 'instalar-ajuda';
      ajuda.className = 'instalar-ajuda';
      ajuda.textContent = window.I18n.t(ehIOS() ? 'installIOS' : 'installOutro');
      linha.appendChild(ajuda);
    });

    linha.appendChild(botao);
    rodape.parentNode.insertBefore(linha, rodape.nextSibling);
  }

  /* No iPhone não existe beforeinstallprompt, então o convite entra assim que
     a página fica pronta — é lá que instalar como app faz mais diferença. */
  window.addEventListener('load', function () {
    if (ehIOS()) montar();
  });
})();
