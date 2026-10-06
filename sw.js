/* Service worker do Capa do Dia.
 *
 * Duas políticas, porque os dois tipos de arquivo daqui envelhecem de um
 * jeito bem diferente:
 *
 *   casca (html, css, js, data/*.js)  -> rede primeiro, cache como reserva
 *   capas (assets/covers/*.jpg)       -> cache primeiro
 *
 * A casca precisa de rede primeiro porque o acervo cresce: servir um
 * data/albums.js velho faria o jogo comparar o palpite com outro álbum, ou
 * procurar uma capa que o calendário novo nem usa mais. Já uma capa, uma vez
 * baixada, nunca muda — o nome do arquivo é o id do álbum, e trocar a arte de
 * um álbum é raro o bastante para não valer uma requisição por partida.
 *
 * Ao trocar o VERSAO, o cache antigo inteiro é descartado no activate.
 */
const VERSAO = 'capadodia-v1';
const CASCA = VERSAO + '-casca';
const CAPAS = VERSAO + '-capas';

/* O que é preciso ter em cache para o jogo abrir sem rede nenhuma. */
const ESSENCIAL = [
  './',
  'index.html',
  'css/style.css',
  'js/modes.js',
  'js/i18n.js',
  'js/taxonomy.js',
  'js/game.js',
  'js/pwa.js',
  'data/albums.js',
  'data/calendar.js',
  'data/extras.js',
  'manifest.webmanifest',
  'assets/icon-192.png',
  'assets/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CASCA)
      /* addAll falha inteiro se um item falhar; aqui cada um vai por conta
         própria, para uma fonte fora do ar não impedir a instalação */
      .then(function (c) {
        return Promise.all(ESSENCIAL.map(function (u) {
          return c.add(u).catch(function () { /* esse fica para a primeira visita */ });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (nomes) {
        return Promise.all(nomes
          .filter(function (n) { return n !== CASCA && n !== CAPAS; })
          .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Google Fonts etc.

  /* capa: cache primeiro */
  if (url.pathname.indexOf('/assets/covers/') !== -1) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          if (res.ok) {
            var copia = res.clone();
            caches.open(CAPAS).then(function (c) { c.put(req, copia); });
          }
          return res;
        });
      })
    );
    return;
  }

  /* casca: rede primeiro, cache como reserva */
  e.respondWith(
    fetch(req)
      .then(function (res) {
        if (res.ok) {
          var copia = res.clone();
          caches.open(CASCA).then(function (c) { c.put(req, copia); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) {
          /* navegação sem rede e sem essa URL em cache cai na página inicial,
             que é a única que o jogo tem */
          return hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined);
        });
      })
  );
});
