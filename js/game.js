/* Capa do Dia — um álbum por dia, 6 tentativas. */
(function () {
  'use strict';

  var ALBUMS = window.ALBUMS || [];
  var COLUMNS = window.Taxonomy.COLUMNS;

  /* As versões do jogo vêm de js/modes.js, compartilhado com as ferramentas em
     Node. Cada uma tem seu acervo, seu calendário e seu histórico; a ordem em
     que estão declaradas é a ordem do menu da engrenagem. */
  var MODES = window.MODES;

  var CONFIG = {
    maxGuesses: 6,
    epoch: '2026-09-01',          // dia 1 do jogo
    coverDir: 'assets/covers/',
    coverExt: '.jpg',
    storagePrefix: 'capadodia.',
    defaultMode: 'intl',
    /* Endereço do jogo publicado, que entra no fim do texto compartilhado.
       Vazio: usa o endereço da própria página. */
    shareUrl: '',
    /* Para onde vai um pedido de remoção de capa. Aparece no rodapé e no
       painel de ajuda; é o canal que faz o aviso de direitos valer alguma
       coisa, então não deve ficar vazio num jogo publicado. */
    contactEmail: 'apoiocapadodia@gmail.com',
    /* false: o recorte inicial cai em qualquer lugar da capa — inclusive numa
       área toda preta, que também é dica. true: procura a região de maior
       contraste da imagem. */
    smartCrop: false
  };

  /* Quanto a capa é revelada a cada erro. index = nº de erros já cometidos. */
  var STAGES = [
    { blocks: 3,  blur: 11, crop: 0.26 },
    { blocks: 5,  blur: 8,  crop: 0.40 },
    { blocks: 8,  blur: 5,  crop: 0.56 },
    { blocks: 14, blur: 3,  crop: 0.74 },
    { blocks: 26, blur: 1.6, crop: 0.90 },
    { blocks: 48, blur: 0.8, crop: 1.00 }
  ];

  /* ------------------------------------------------------------------ utils */

  function norm(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* chaves de partida e estatística ficam sob o modo; preferências são globais */
  function store(key, value) {
    var k = CONFIG.storagePrefix + key;
    try {
      if (value === undefined) {
        var raw = localStorage.getItem(k);
        return raw ? JSON.parse(raw) : null;
      }
      localStorage.setItem(k, JSON.stringify(value));
    } catch (e) { /* modo privado / storage bloqueado: joga sem salvar */ }
    return null;
  }

  function drop(key) {
    try { localStorage.removeItem(CONFIG.storagePrefix + key); } catch (e) { /* idem */ }
  }

  /* --------------------------------------------------- modo e idioma */

  function paramOf(name) {
    var m = location.search.match(new RegExp('[?&]' + name + '=([a-zA-Z]+)'));
    return m ? m[1] : null;
  }

  var mode = paramOf('v') || store('mode') || CONFIG.defaultMode;
  if (!MODES[mode]) mode = CONFIG.defaultMode;
  store('mode', mode);

  var lang = I18n.detect(paramOf('lang') || store('lang'));
  I18n.set(lang);
  store('lang', lang);

  function t(key) { return I18n.t(key); }

  /* o acervo desta versão */
  var POOL = ALBUMS.filter(MODES[mode].filter).filter(function (a) { return !a.noCover; });

  /* estado e estatística são separados por versão */
  function modeStore(key, value) { return store(mode + '.' + key, value); }

  /* ------------------------------------------------------- dia do jogo */

  /* O dia 1 é CONFIG.epoch, e a conta é feita na data local: o jogo vira à
     meia-noite de quem joga, não à de um fuso escolhido. */
  function hojeNumero() {
    var start = new Date(CONFIG.epoch + 'T00:00:00');
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(1, Math.floor((today - start) / 86400000) + 1);
  }

  var hoje = hojeNumero();

  /* ?dia=N abre um dia do arquivo — é assim que o calendário leva a pessoa
     para uma partida antiga. Acima de hoje o parâmetro continua servindo para
     conferir uma capa que ainda vai entrar, mas aí nada é salvo nem contado. */
  var day = (function () {
    var m = location.search.match(/[?&]dia=(\d+)/);
    var n = m ? parseInt(m[1], 10) : hoje;
    return n >= 1 ? n : hoje;
  })();
  var futuro = day > hoje;
  var arquivo = day !== hoje;

  /* ?reset apaga a partida aberta desta versão; ?reset=tudo apaga o arquivo
     inteiro das duas versões. Serve para testar à vontade. O parâmetro sai
     da URL em seguida — assim um F5 não apaga a partida que você acabou de começar. */
  var resetMsg = (function () {
    var m = location.search.match(/[?&]reset(?:=([a-z]+))?(?=&|$)/i);
    if (!m) return null;
    var tudo = /^(tudo|all)$/i.test(m[1] || '');
    Object.keys(MODES).forEach(function (id) {
      drop(id + '.state');                     // formato antigo, de uma partida só
      if (tudo) { drop(id + '.jogos'); drop(id + '.stats'); return; }
      if (id !== mode) return;
      var js = store(id + '.jogos') || {};
      delete js[day];
      store(id + '.jogos', js);
    });
    try {
      var resto = location.search.replace(/^\?/, '').split('&').filter(function (par) {
        return par && !/^reset(=|$)/i.test(par);
      });
      history.replaceState(null, '', location.pathname +
        (resto.length ? '?' + resto.join('&') : '') + location.hash);
    } catch (e) {
      /* abrindo por file:// o Chrome pode recusar mexer na URL; aí só
         o F5 apaga de novo, e o jogo segue funcionando. */
    }
    return tudo ? 'resetAll' : 'resetGame';
  })();

  /* ------------------------------------------------------- álbum do dia */

  /* O calendário é um arquivo (data/calendar.js), não uma conta: assim o álbum
     de um dia que já passou continua sendo aquele mesmo depois de o acervo
     crescer. Sem o arquivo — ou com um id que saiu do acervo — cai no
     embaralhamento por semente, que é como o jogo funcionava antes. */
  function dailyAlbum(day) {
    var lista = (window.CALENDAR || {})[mode];
    if (lista && lista.length) {
      var id = lista[((day - 1) % lista.length + lista.length) % lista.length];
      var achado = POOL.find(function (a) { return a.id === id; });
      if (achado) return achado;
    }
    return sorteioPorSemente(day);
  }

  function sorteioPorSemente(day) {
    var pool = POOL;
    var order = pool.map(function (a, i) { return i; });
    var rnd = mulberry32(MODES[mode].seed);
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = order[i]; order[i] = order[j]; order[j] = t;
    }
    var idx = ((day - 1) % order.length + order.length) % order.length;
    return pool[order[idx]];
  }

  /* ------------------------------------------------------------ capa */

  var canvas = document.getElementById('cover');
  var coverFrame = document.querySelector('.cover-frame');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var coverImage = null;     // HTMLImageElement ou canvas procedural
  var focal = { x: 0.5, y: 0.5 };

  function proceduralCover(album) {
    /* Sem arquivo de capa? Desenha uma capa falsa estável a partir do id,
       para o jogo continuar jogável (útil antes de baixar as imagens). */
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var rnd = mulberry32(hashStr(album.id));
    var h1 = Math.floor(rnd() * 360), h2 = (h1 + 40 + Math.floor(rnd() * 200)) % 360;
    var grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, 'hsl(' + h1 + ',62%,46%)');
    grad.addColorStop(1, 'hsl(' + h2 + ',58%,22%)');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    for (var i = 0; i < 5; i++) {
      g.globalAlpha = 0.12 + rnd() * 0.2;
      g.fillStyle = 'hsl(' + Math.floor(rnd() * 360) + ',70%,' + (30 + rnd() * 50) + '%)';
      g.beginPath();
      g.arc(rnd() * W, rnd() * H, 60 + rnd() * 240, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    return c;
  }

  /* Alternativa ligada por CONFIG.smartCrop: começa o recorte pela região de
     maior contraste da capa, em vez de um ponto qualquer. */
  function pickFocal(img, album) {
    var N = 10, fallback = { x: 0.5, y: 0.5 };
    var sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
    var side = Math.min(sw, sh);
    var c = document.createElement('canvas');
    c.width = N; c.height = N;
    var g = c.getContext('2d');
    g.drawImage(img, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, N, N);

    var data;
    try { data = g.getImageData(0, 0, N, N).data; } catch (e) { return fallback; }

    var lum = [];
    for (var i = 0; i < N * N; i++) {
      lum.push(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
    }

    var spots = [];
    for (var y = 1; y < N - 1; y++) {
      for (var x = 1; x < N - 1; x++) {
        var vals = [];
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) vals.push(lum[(y + dy) * N + (x + dx)]);
        }
        var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        var varc = vals.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / vals.length;
        spots.push({ x: (x + 0.5) / N, y: (y + 0.5) / N, v: varc });
      }
    }
    if (!spots.length) return fallback;
    spots.sort(function (a, b) { return b.v - a.v; });

    // sorteia entre os três pontos mais informativos, de forma estável por álbum
    var rnd = mulberry32(hashStr(album.id) ^ 0x9E3779B9);
    var p = spots[Math.floor(rnd() * Math.min(3, spots.length))] || fallback;
    return {
      x: Math.min(0.74, Math.max(0.26, p.x)),
      y: Math.min(0.74, Math.max(0.26, p.y))
    };
  }

  function randomFocal(album) {
    var rnd = mulberry32(hashStr(album.id) ^ 0x9E3779B9);
    return { x: 0.30 + rnd() * 0.40, y: 0.30 + rnd() * 0.40 };
  }

  function loadCover(album, done) {
    focal = randomFocal(album);

    function settle(image) {
      coverImage = image;
      focal = CONFIG.smartCrop ? pickFocal(image, album) : randomFocal(album);
      done();
    }

    var img = new Image();
    img.onload = function () { settle(img); };
    img.onerror = function () { settle(proceduralCover(album)); };
    img.src = CONFIG.coverDir + album.id + CONFIG.coverExt;
  }

  function drawCover(stageIndex) {
    if (!coverImage) return;
    var sw = coverImage.naturalWidth || coverImage.width;
    var sh = coverImage.naturalHeight || coverImage.height;
    var side = Math.min(sw, sh);

    ctx.save();
    ctx.filter = 'none';
    ctx.clearRect(0, 0, W, H);

    if (stageIndex == null) {                 // revelado
      var ox = (sw - side) / 2, oy = (sh - side) / 2;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(coverImage, ox, oy, side, side, 0, 0, W, H);
      ctx.restore();
      return;
    }

    var st = STAGES[Math.min(stageIndex, STAGES.length - 1)];
    var win = side * st.crop;
    var cx = (sw - side) / 2 + focal.x * side;
    var cy = (sh - side) / 2 + focal.y * side;
    var sx = Math.max((sw - side) / 2, Math.min(cx - win / 2, (sw - side) / 2 + side - win));
    var sy = Math.max((sh - side) / 2, Math.min(cy - win / 2, (sh - side) / 2 + side - win));

    // 1) reduz o recorte a pouquíssimos pixels
    var small = document.createElement('canvas');
    small.width = st.blocks; small.height = st.blocks;
    var sg = small.getContext('2d');
    sg.imageSmoothingEnabled = true;
    sg.drawImage(coverImage, sx, sy, win, win, 0, 0, st.blocks, st.blocks);

    // 2) amplia sem suavizar (pixelado) + desfoque, com sangria nas bordas
    var bleed = st.blur * 3;
    ctx.imageSmoothingEnabled = false;
    ctx.filter = 'blur(' + st.blur + 'px)';
    ctx.drawImage(small, 0, 0, st.blocks, st.blocks,
                  -bleed, -bleed, W + bleed * 2, H + bleed * 2);
    ctx.restore();
  }

  function coverPath(album) {
    return CONFIG.coverDir + album.id + CONFIG.coverExt;
  }

  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ------------------------------------- links e resumo do álbum revelado */

  /* data/extras.js é opcional e carrega com defer, depois deste arquivo: por
     isso a leitura é na hora do uso, não aqui. Sem ele, os botões caem na
     busca de cada site e o resumo simplesmente não aparece. */
  function extraOf(album) { return (window.EXTRAS || {})[album.id] || {}; }

  function termoBusca(album) {
    return album.artist + ' ' + album.title.replace(/\s*\(\d{4}\)$/, '');
  }

  /* Loja da Amazon por país do navegador, não pelo idioma escolhido no jogo:
     quem joga em inglês no Brasil ainda compra na amazon.com.br. */
  var LOJAS = {
    BR: 'amazon.com.br', US: 'amazon.com', GB: 'amazon.co.uk', CA: 'amazon.ca',
    MX: 'amazon.com.mx', DE: 'amazon.de', AT: 'amazon.de', FR: 'amazon.fr',
    ES: 'amazon.es', PT: 'amazon.es', IT: 'amazon.it', NL: 'amazon.nl',
    BE: 'amazon.com.be', SE: 'amazon.se', PL: 'amazon.pl', TR: 'amazon.com.tr',
    JP: 'amazon.co.jp', AU: 'amazon.com.au', IN: 'amazon.in', SG: 'amazon.sg',
    AE: 'amazon.ae', SA: 'amazon.sa', EG: 'amazon.eg', IE: 'amazon.co.uk'
  };
  var LOJA_POR_IDIOMA = {
    pt: 'BR', en: 'US', es: 'ES', de: 'DE', fr: 'FR', it: 'IT',
    nl: 'NL', sv: 'SE', pl: 'PL', tr: 'TR', ja: 'JP', ar: 'AE', hi: 'IN'
  };

  function amazonHost() {
    var tags = navigator.languages && navigator.languages.length
      ? navigator.languages : [navigator.language || ''];
    var i, m;
    for (i = 0; i < tags.length; i++) {          // pt-BR, en-GB… o país manda
      m = String(tags[i]).match(/-([A-Za-z]{2})$/);
      if (m && LOJAS[m[1].toUpperCase()]) return LOJAS[m[1].toUpperCase()];
    }
    for (i = 0; i < tags.length; i++) {          // só "pt", só "de": chuta pelo idioma
      var pais = LOJA_POR_IDIOMA[String(tags[i]).slice(0, 2).toLowerCase()];
      if (pais) return LOJAS[pais];
    }
    return 'amazon.com';
  }

  function spotifyURL(album) {
    var id = extraOf(album).spotify;
    return id
      ? 'https://open.spotify.com/album/' + encodeURIComponent(id)
      : 'https://open.spotify.com/search/' + encodeURIComponent(termoBusca(album));
  }

  function amazonURL(album) {
    return 'https://www.' + amazonHost() + '/s?k=' + encodeURIComponent(termoBusca(album));
  }

  /* Artigo no idioma do jogo; sem ele, o do outro idioma; sem nenhum, a busca.
     Vale mais mandar para o verbete em inglês do que não mandar para nada. */
  function wikiURL(album) {
    var wiki = extraOf(album).wiki || {};
    var ordem = lang === 'pt' ? ['pt', 'en'] : ['en', 'pt'];
    for (var i = 0; i < ordem.length; i++) {
      if (wiki[ordem[i]]) {
        return 'https://' + ordem[i] + '.wikipedia.org/wiki/' +
          encodeURIComponent(wiki[ordem[i]].replace(/ /g, '_'));
      }
    }
    return 'https://' + lang + '.wikipedia.org/w/index.php?search=' +
      encodeURIComponent(termoBusca(album));
  }

  function blurbOf(album) {
    var b = extraOf(album).blurb || {};
    return b[lang] || b[lang === 'pt' ? 'en' : 'pt'] || null;
  }

  /* ------------------------------------------------------------ estado */

  var target = dailyAlbum(day);

  /* Todas as partidas desta versão, guardadas por dia. É daqui que o arquivo
     tira a cor de cada quadradinho e de onde a estatística é somada — uma
     fonte só, para o calendário e os números nunca discordarem. */
  var jogos = modeStore('jogos') || {};

  /* Antes existia uma partida solta, sem dia, sobrescrita a cada virada. Quem
     já tem uma guardada não a perde: ela vira a entrada do dia dela. */
  var solta = modeStore('state');
  if (solta) {
    if (solta.day && !jogos[solta.day]) {
      jogos[solta.day] = solta;
      modeStore('jogos', jogos);
    }
    drop(mode + '.state');
  }

  var state = jogos[day] || {};

  /* O álbum de cada dia sai da lista inteira, então editar o acervo troca o alvo
     dos dias. Sem guardar de quem era a partida, um jogo salvo voltaria a ser
     comparado com outro álbum — e o palpite certo de ontem apareceria errado.
     Por isso o alvo entra no estado: se mudou, a partida recomeça limpa. */
  if (state.day !== day || state.target !== target.id) {
    state = { day: day, target: target.id, guesses: [], done: false, won: false };
  } else {
    /* palpite que saiu do acervo não some silenciosamente da conta: se não dá
       para mostrar a linha, ele também não gasta tentativa */
    state.guesses = state.guesses.filter(function (id) {
      return String(id).indexOf('__skip__') === 0 ||
        POOL.some(function (a) { return a.id === id; });
    });
  }

  function save() {
    if (futuro) return;     // espiar um dia que ainda não chegou não deixa rastro
    jogos[day] = state;
    modeStore('jogos', jogos);
  }

  function guessedAlbums() {
    return state.guesses.map(function (id) {
      return POOL.find(function (a) { return a.id === id; });
    }).filter(Boolean);
  }

  /* ------------------------------------------------------- estatísticas */

  /* Somadas do arquivo a cada consulta, em vez de mantidas num contador à
     parte. Custa uma passada por umas centenas de entradas e resolve de graça
     o caso que o contador não resolvia: jogar os dias fora de ordem. */
  function getStats() {
    var s = { played: 0, wins: 0, streak: 0, best: 0, dist: {} };
    var ganhos = {};

    Object.keys(jogos).forEach(function (chave) {
      var d = Number(chave), j = jogos[chave];
      if (!j || !j.done || !(d >= 1 && d <= hoje)) return;
      s.played++;
      if (j.won) {
        ganhos[d] = true;
        s.wins++;
        s.dist[j.guesses.length] = (s.dist[j.guesses.length] || 0) + 1;
      } else {
        s.dist.fail = (s.dist.fail || 0) + 1;
      }
    });

    /* Sequência: dias seguidos acertados terminando em hoje. Enquanto a partida
       de hoje está em aberto ela conta a partir de ontem — o dia que ainda dá
       para jogar não quebra a sequência; o dia perdido, sim. */
    var deHoje = jogos[hoje];
    var fim = ganhos[hoje] ? hoje : (deHoje && deHoje.done) ? 0 : hoje - 1;
    while (ganhos[fim]) { s.streak++; fim--; }

    /* Recorde: a maior sequência de qualquer época, inclusive as fechadas
       depois, jogando pelo calendário. */
    var corrida = 0;
    Object.keys(ganhos).map(Number).sort(function (a, b) { return a - b; })
      .forEach(function (d, i, lista) {
        corrida = (i && lista[i - 1] === d - 1) ? corrida + 1 : 1;
        if (corrida > s.best) s.best = corrida;
      });

    return s;
  }

  /* ------------------------------------------------------------- board */

  var board = document.getElementById('board');
  var stageLabel = document.getElementById('stage-label');
  var pips = document.getElementById('pips');
  var counter = document.getElementById('counter');
  var input = document.getElementById('guess-input');
  var suggestions = document.getElementById('suggestions');
  var btnGuess = document.getElementById('btn-guess');
  var btnSkip = document.getElementById('btn-skip');

  function renderRow(album, animate) {
    var card = el('div', 'guess-card');
    if (!animate) card.style.animation = 'none';

    var head = el('div', 'guess-head');
    head.appendChild(el('span', 'n', '#' + (board.children.length + 1)));
    head.appendChild(el('span', 't', album.title + ' — ' + album.artist));
    card.appendChild(head);

    var cells = el('div', 'cells');
    window.Taxonomy.evaluate(album, target).forEach(function (r, i) {
      var cell = el('div', 'cell ' + r.state);
      if (animate) cell.style.animationDelay = (i * 45) + 'ms';
      else cell.style.animation = 'none';
      cell.appendChild(el('div', 'k', I18n.column(r.key)));
      cell.appendChild(el('div', 'v', I18n.value(r.text) + (r.arrow ? ' ' + r.arrow : '')));
      cells.appendChild(cell);
    });
    card.appendChild(cells);
    board.insertBefore(card, board.firstChild);
  }

  function renderSkipRow() {
    var card = el('div', 'guess-card');
    card.style.animation = 'none';
    var head = el('div', 'guess-head');
    head.appendChild(el('span', 'n', '#' + (board.children.length + 1)));
    head.appendChild(el('span', 't', t('skipped')));
    card.appendChild(head);
    board.insertBefore(card, board.firstChild);
  }

  /* Perdeu as seis: a última linha mostra as respostas certas, coluna por
     coluna. Verde só no que a pessoa chegou a acertar em algum palpite; o resto
     fica neutro, que é justamente o que faltou descobrir. */
  function renderAnswerRow() {
    var acertou = {};
    guessedAlbums().forEach(function (a) {
      window.Taxonomy.evaluate(a, target).forEach(function (r) {
        if (r.state === 'hit') acertou[r.key] = true;
      });
    });

    var card = el('div', 'guess-card answer-card');
    card.style.animation = 'none';

    var head = el('div', 'guess-head');
    head.appendChild(el('span', 'n resp', t('answer')));
    head.appendChild(el('span', 't', target.title + ' — ' + target.artist));
    card.appendChild(head);

    var cells = el('div', 'cells');
    /* comparar o álbum com ele mesmo devolve o valor certo de cada coluna */
    window.Taxonomy.evaluate(target, target).forEach(function (r) {
      var cell = el('div', 'cell ' + (acertou[r.key] ? 'hit' : 'blank'));
      cell.style.animation = 'none';
      cell.appendChild(el('div', 'k', I18n.column(r.key)));
      cell.appendChild(el('div', 'v', I18n.value(r.text)));
      cells.appendChild(cell);
    });
    card.appendChild(cells);
    board.insertBefore(card, board.firstChild);
  }

  function isSkip(id) { return String(id).indexOf('__skip__') === 0; }

  function renderPips() {
    pips.innerHTML = '';
    for (var i = 0; i < CONFIG.maxGuesses; i++) {
      var p = el('i');
      if (i < state.guesses.length) {
        var g = state.guesses[i];
        p.className = (g === target.id) ? 'hit' : 'used';
      }
      pips.appendChild(p);
    }
  }

  function renderStatus() {
    renderPips();
    var left = CONFIG.maxGuesses - state.guesses.length;
    if (state.done) {
      stageLabel.textContent = state.won ? t('wonIn')(state.guesses.length) : t('gameOver');
    } else {
      stageLabel.textContent = t('attempt')(state.guesses.length + 1, CONFIG.maxGuesses);
    }
    counter.textContent = state.done
      ? t('finished')(day, POOL.length)
      : t('remaining')(left, POOL.length);
    input.disabled = btnGuess.disabled = btnSkip.disabled = state.done;
  }

  /* ------------------------------------------------------- autocomplete */

  /* Só vale chutar o que pode cair nesta versão — no modo internacional,
     sugerir um disco brasileiro gastaria a tentativa à toa. */
  var searchIndex = POOL.map(function (a) {
    return { album: a, hay: norm(a.title + ' ' + a.artist) };
  });
  var activeIdx = -1;
  var currentList = [];

  function search(q) {
    var nq = norm(q);
    if (!nq) return [];
    var starts = [], contains = [];
    for (var i = 0; i < searchIndex.length; i++) {
      var pos = searchIndex[i].hay.indexOf(nq);
      if (pos === 0) starts.push(searchIndex[i].album);
      else if (pos > 0) contains.push(searchIndex[i].album);
      if (starts.length + contains.length > 60) break;
    }
    return starts.concat(contains).slice(0, 8);
  }

  function renderSuggestions(list) {
    currentList = list;
    activeIdx = -1;
    suggestions.innerHTML = '';
    if (!list.length) { suggestions.classList.remove('open'); return; }
    list.forEach(function (a, i) {
      var li = el('li');
      li.setAttribute('role', 'option');
      li.appendChild(document.createTextNode(a.title));
      li.appendChild(el('small', null, a.artist));
      li.addEventListener('mousedown', function (e) { e.preventDefault(); pick(i); });
      suggestions.appendChild(li);
    });
    suggestions.classList.add('open');
  }

  function highlight(i) {
    Array.prototype.forEach.call(suggestions.children, function (li, k) {
      li.setAttribute('aria-selected', k === i ? 'true' : 'false');
    });
    if (suggestions.children[i]) suggestions.children[i].scrollIntoView({ block: 'nearest' });
  }

  function pick(i) {
    var a = currentList[i];
    if (!a) return;
    input.value = a.title;
    closeSuggestions();
    submitGuess(a);
  }

  function closeSuggestions() {
    suggestions.classList.remove('open');
    suggestions.innerHTML = '';
    currentList = [];
    activeIdx = -1;
  }

  input.addEventListener('input', function () { renderSuggestions(search(input.value)); });
  input.addEventListener('blur', function () { setTimeout(closeSuggestions, 120); });
  input.addEventListener('keydown', function (e) {
    if (!currentList.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = (activeIdx + 1) % currentList.length; highlight(activeIdx); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = (activeIdx - 1 + currentList.length) % currentList.length; highlight(activeIdx); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(activeIdx); }
    else if (e.key === 'Escape') closeSuggestions();
  });

  /* ------------------------------------------------------------ palpite */

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function submitGuess(album) {
    if (state.done || !album) return;
    if (state.guesses.indexOf(album.id) !== -1) { toast(t('alreadyGuessed')); return; }

    state.guesses.push(album.id);
    input.value = '';
    renderRow(album, true);

    if (album.id === target.id) { state.done = true; state.won = true; }
    else if (state.guesses.length >= CONFIG.maxGuesses) { state.done = true; state.won = false; }

    save();
    drawCover(state.done ? null : state.guesses.length);
    if (state.done) encerrar();
    renderStatus();

    if (state.done) {
      setTimeout(function () { showResult(getStats()); }, 850);
    }
  }

  document.getElementById('guess-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (activeIdx >= 0) { pick(activeIdx); return; }
    /* campo vazio não é palpite errado: avisa o que falta e devolve o foco */
    if (!input.value.trim()) { toast(t('emptyGuess')); input.focus(); return; }
    var list = search(input.value);
    if (!list.length) { toast(t('notFound')); return; }
    var nq = norm(input.value);
    var exactMatch = list.find(function (a) { return norm(a.title) === nq; });
    submitGuess(exactMatch || list[0]);
    closeSuggestions();
  });

  btnSkip.addEventListener('click', function () {
    if (state.done) return;
    state.guesses.push('__skip__' + state.guesses.length);
    renderSkipRow();

    if (state.guesses.length >= CONFIG.maxGuesses) { state.done = true; state.won = false; }
    save();
    drawCover(state.done ? null : state.guesses.length);
    if (state.done) encerrar();
    renderStatus();
    if (state.done) {
      setTimeout(function () { showResult(getStats()); }, 500);
    }
  });

  /* ------------------------------------------------------------ modais */

  var backdrop = document.getElementById('modal-backdrop');
  var modalBody = document.getElementById('modal-body');

  function openModal(html) {
    modalBody.innerHTML = html;
    backdrop.hidden = false;
  }
  function closeModal() { backdrop.hidden = true; }

  document.getElementById('modal-close').addEventListener('click', closeModal);
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); closeMenu(); }
  });

  document.getElementById('btn-help').addEventListener('click', function () {
    openModal(
      '<h2>' + t('helpTitle') + '</h2>' +
      '<p>' + t('helpIntro')(CONFIG.maxGuesses) + '</p>' +
      '<p>' + t('helpCompare') + '</p>' +
      '<div class="legend">' +
        '<div><span class="swatch hit"></span> ' + t('legendHit') + '</div>' +
        '<div><span class="swatch near"></span> ' + t('legendNear')(window.Taxonomy.YEAR_NEAR) + '</div>' +
        '<div><span class="swatch miss"></span> ' + t('legendMiss') + '</div>' +
      '</div>' +
      '<p>' + t('helpArrow') + '</p>' +
      '<h3>' + t('helpColumns') + '</h3>' +
      '<ul>' + COLUMNS.map(function (c) { return '<li>' + I18n.column(c.key) + '</li>'; }).join('') + '</ul>' +
      '<h3>' + t('helpModes') + '</h3>' +
      '<p>' + t('helpModesText') + '</p>' +
      '<h3>' + t('aboutTitle') + '</h3>' +
      '<p class="sobre">' + t('aboutText')(CONFIG.contactEmail) + '</p>'
    );
  });

  /* ---------------------------------------------------------- arquivo */

  /* Um quadradinho por dia desde o dia 1, agrupado por mês. A cor diz o que
     aconteceu: escuro é dia que ainda não chegou, claro é dia que dá para
     jogar, e preenchido é dia fechado — verde acertou, vermelho não. */

  function hrefDia(n) {
    return n === hoje ? location.pathname : location.pathname + '?dia=' + n;
  }

  function dataDoDia(n) {
    var d = new Date(CONFIG.epoch + 'T00:00:00');
    d.setDate(d.getDate() + n - 1);
    return d;
  }

  function nomeDoMes(d) {
    try {
      var nome = d.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US',
        { month: 'long', year: 'numeric' });
      return nome.charAt(0).toUpperCase() + nome.slice(1);
    } catch (e) {
      return (d.getMonth() + 1) + '/' + d.getFullYear();
    }
  }

  function estadoDoDia(n) {
    if (n > hoje) return 'soon';
    var j = jogos[n];
    if (!j) return 'open';
    if (!j.done) return j.guesses.length ? 'doing' : 'open';
    return j.won ? 'won' : 'lost';
  }

  /* O mês corrente aparece inteiro, com os dias que ainda não chegaram
     apagados: sem eles o calendário terminaria no meio de uma linha e pareceria
     cortado. */
  function mesesDoArquivo() {
    var ultimo = dataDoDia(hoje);
    var diasNoMes = new Date(ultimo.getFullYear(), ultimo.getMonth() + 1, 0).getDate();
    var ate = hoje + (diasNoMes - ultimo.getDate());
    var meses = [], atual = null, chaveAtual = null;

    for (var n = 1; n <= ate; n++) {
      var d = dataDoDia(n);
      var chave = d.getFullYear() + '-' + d.getMonth();
      if (chave !== chaveAtual) {
        chaveAtual = chave;
        atual = { titulo: nomeDoMes(d), dias: [] };
        meses.push(atual);
      }
      atual.dias.push({ n: n, dom: d.getDate() });
    }
    return meses.reverse();      // o mês de agora em cima
  }

  function legendaHTML() {
    return '<div class="legend cal-legend">' +
      '<div><span class="cal-day open"></span> ' + esc(t('legendOpen')) + '</div>' +
      '<div><span class="cal-day won"></span> ' + esc(t('legendWon')) + '</div>' +
      '<div><span class="cal-day lost"></span> ' + esc(t('legendLost')) + '</div>' +
      '<div><span class="cal-day soon"></span> ' + esc(t('legendSoon')) + '</div>' +
      '</div>';
  }

  function archiveHTML() {
    var feitos = 0;
    for (var k = 1; k <= hoje; k++) if (jogos[k] && jogos[k].done) feitos++;

    var grades = mesesDoArquivo().map(function (m) {
      var quadros = m.dias.map(function (dia) {
        var st = estadoDoDia(dia.n);
        var marca = (dia.n === hoje ? ' hoje' : '') + (dia.n === day ? ' aqui' : '');
        var rotulo = t('archiveDay')(dia.n) + ' · ' + t('legend' +
          st.charAt(0).toUpperCase() + st.slice(1));
        if (st === 'soon') {
          return '<span class="cal-day soon" aria-hidden="true">' + dia.dom + '</span>';
        }
        return '<a class="cal-day ' + st + marca + '" href="' + esc(hrefDia(dia.n)) +
          '" title="' + esc(rotulo) + '" aria-label="' + esc(rotulo) + '">' + dia.dom + '</a>';
      }).join('');
      return '<div class="cal-month"><h3>' + esc(m.titulo) + '</h3>' +
        '<div class="cal-grid">' + quadros + '</div></div>';
    }).join('');

    return '<h2>' + esc(t('archiveTitle')) + '</h2>' +
      '<p>' + esc(t('archiveIntro')) + '</p>' +
      '<p class="cal-count">' + esc(t('archiveCount')(feitos, hoje)) + '</p>' +
      grades + legendaHTML();
  }

  document.getElementById('btn-archive').addEventListener('click', function () {
    openModal(archiveHTML());
  });

  function distRow(label, count, max) {
    var pct = max ? Math.round((count / max) * 100) : 0;
    return '<div class="dist-row"><span>' + label + '</span>' +
      '<div class="dist-bar' + (count ? '' : ' zero') + '" style="width:' + Math.max(pct, 8) + '%">' + count + '</div></div>';
  }

  function statsHTML(s) {
    var max = Math.max.apply(null, [1].concat(Object.keys(s.dist).map(function (k) { return s.dist[k]; })));
    var rows = '';
    for (var i = 1; i <= CONFIG.maxGuesses; i++) rows += distRow(String(i), s.dist[i] || 0, max);
    rows += distRow('✗', s.dist.fail || 0, max);
    return '<div class="stats-grid">' +
        '<div class="stat"><b>' + s.played + '</b><span>' + t('played') + '</span></div>' +
        '<div class="stat"><b>' + (s.played ? Math.round(s.wins / s.played * 100) : 0) + '%</b><span>' + t('winRate') + '</span></div>' +
        '<div class="stat"><b>' + s.streak + '</b><span>' + t('streak') + '</span></div>' +
        '<div class="stat"><b>' + s.best + '</b><span>' + t('best') + '</span></div>' +
      '</div><div class="dist">' + rows + '</div>';
  }

  /* Com a partida do dia encerrada, o botão de compartilhar aparece aqui
     também: depois de fechar a tela de resultado, este é o caminho de volta. */
  document.getElementById('btn-stats').addEventListener('click', function () {
    openModal('<h2>' + t('statsTitle') + '</h2>' + statsHTML(getStats()) +
      (state.done ? shareRowHTML(t('shareToday')) : ''));
    if (state.done) ligarShare();
  });

  /* Link do jogo no fim do texto. Vale o CONFIG.shareUrl quando preenchido;
     sen\u00E3o, o pr\u00F3prio endere\u00E7o aberto, sem os par\u00E2metros de teste. A vers\u00E3o vai
     junto porque o n\u00BA 5 de uma vers\u00E3o \u00E9 outro \u00E1lbum na outra \u2014 quem abrir o
     link tem de cair no mesmo jogo. Abrindo o arquivo do disco (file://) n\u00E3o
     existe link que sirva para outra pessoa, ent\u00E3o a linha n\u00E3o aparece. */
  function shareURL() {
    var base = CONFIG.shareUrl;
    if (!base) {
      if (location.protocol !== 'http:' && location.protocol !== 'https:') return '';
      base = location.origin + location.pathname;
    }
    var params = [];
    if (mode !== CONFIG.defaultMode) params.push('v=' + mode);
    /* num dia do arquivo o link tem de levar àquele dia, senão quem clicar cai
       no álbum de hoje e a grade de emojis não bate com nada */
    if (arquivo && !futuro) params.push('dia=' + day);
    if (!params.length) return base;
    return base + (base.indexOf('?') === -1 ? '?' : '&') + params.join('&');
  }

  function shareText() {
    var grid = state.guesses.map(function (id) {
      if (isSkip(id)) return new Array(COLUMNS.length + 1).join('\u2B1B');
      var a = POOL.find(function (x) { return x.id === id; });
      if (!a) return '';
      return window.Taxonomy.evaluate(a, target).map(function (r) {
        return r.state === 'hit' ? '\u{1F7E9}' : r.state === 'near' ? '\u{1F7E8}' : '\u{1F7E5}';
      }).join('');
    }).filter(Boolean).join('\n');

    var partes = [
      t('shareHead')(day, state.guesses.length, state.won, CONFIG.maxGuesses),
      '',
      grid
    ];
    var url = shareURL();
    if (url) partes.push('', url);
    return partes.join('\n');
  }

  /* navigator.clipboard não existe em todo contexto (abrir o arquivo direto do
     disco é um deles), então há um plano B com textarea + execCommand. */
  function copiar(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast(t('copied')); },
        function () { copiarFallback(text); }
      );
      return;
    }
    copiarFallback(text);
  }

  function copiarFallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    toast(ok ? t('copied') : t('copyFailed'));
  }

  /* Fim de jogo: a capa dá o pulinho e passa a ser um botão — clicar nela traz
     de volta a tela de resultado, que é o caminho natural depois de fechá-la
     sem querer. Enquanto a partida corre, a capa não é clicável. */
  /* tudo o que acontece quando a partida acaba, ganhando ou perdendo */
  function encerrar() {
    encerrarCapa();
    if (!state.won) renderAnswerRow();
  }

  function encerrarCapa() {
    coverFrame.classList.add('reveal', 'clicavel');
    coverFrame.setAttribute('role', 'button');
    coverFrame.setAttribute('tabindex', '0');
    coverFrame.setAttribute('aria-label', t('seeResult'));
    coverFrame.setAttribute('title', t('seeResult'));
  }

  coverFrame.addEventListener('click', function () {
    if (state.done) showResult(getStats());
  });

  coverFrame.addEventListener('keydown', function (e) {
    if (!state.done) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      showResult(getStats());
    }
  });

  /* ícones dos links: traço fino, no mesmo desenho dos do cabeçalho */
  var ICONE_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>' +
    '<path d="M10 8.5 L16 12 L10 15.5 Z"/></svg>';
  var ICONE_CARRINHO = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M3 4h2.2l2.4 10.2h9.6l2-7.2H6.2"/><circle cx="9.5" cy="19" r="1.4"/>' +
    '<circle cx="16.5" cy="19" r="1.4"/></svg>';
  var ICONE_LIVRO = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M4 5.2c2.9-1 5.4-1 8 .6 2.6-1.6 5.1-1.6 8-.6v13c-2.9-1-5.4-1-8 .6-2.6-1.6-5.1-1.6-8-.6Z"/>' +
    '<path d="M12 5.8v13"/></svg>';

  function chip(url, label, icone) {
    return '<a class="chip" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
      icone + '<span>' + esc(label) + '</span></a>';
  }

  /* Resumo e link vêm da Wikipédia (CC BY-SA), então a fonte aparece junto. */
  function albumHTML(album) {
    var texto = blurbOf(album);
    var url = wikiURL(album);
    var html = '';
    if (texto) {
      html += '<p class="result-blurb">' + esc(texto) +
        ' <a class="more" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
        esc(t('readMore')) + ' ↗</a></p>';
    }
    html += '<div class="link-row">' +
      chip(spotifyURL(album), t('listen'), ICONE_PLAY) +
      chip(amazonURL(album), t('buy'), ICONE_CARRINHO) +
      (texto ? '' : chip(url, t('readMore'), ICONE_LIVRO)) +
      '</div>';
    return html;
  }

  /* navigator.share também existe no Chrome do Windows, e lá ele abre a janela
     de compartilhamento do sistema — que atrapalha mais do que ajuda, porque no
     computador o que se espera é o texto na área de transferência, para colar
     onde a pessoa quiser. Então o compartilhamento do sistema fica só onde ele
     é de fato melhor: em tela de toque. */
  function compartilhamentoNativo() {
    if (!navigator.share) return false;
    var toque = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return !!toque && (navigator.maxTouchPoints || 0) > 0;
  }

  /* O rótulo muda de lugar para lugar: na tela de resultado o contexto é
     óbvio, mas no painel de estatísticas, que mostra o histórico todo, precisa
     dizer que o que vai ser compartilhado é a partida de hoje. */
  function shareRowHTML(label) {
    return '<div class="share-row">' +
      '<button class="btn primary" id="btn-share">' + esc(label) + '</button></div>';
  }

  function ligarShare() {
    var btn = document.getElementById('btn-share');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var text = shareText();
      if (compartilhamentoNativo()) {
        navigator.share({ text: text }).catch(function () {});
        return;
      }
      copiar(text);
    });
  }

  function showResult(stats) {
    openModal(
      '<h2>' + (state.won ? t('won') : t('lost')) + '</h2>' +
      '<img class="result-cover" src="' + esc(coverPath(target)) + '" alt="Capa de ' + esc(target.title) +
        '" onerror="this.hidden=true">' +
      '<p class="result-title">' + esc(target.title) + '</p>' +
      '<p class="result-sub">' + esc(target.artist) + ' · ' + target.year + ' · ' + esc(I18n.value(target.subgenre)) + '</p>' +
      albumHTML(target) +
      statsHTML(stats) +
      shareRowHTML(t('share')) +
      /* num dia do arquivo não há próximo álbum para esperar: o que a pessoa
         quer dali é voltar para o dia de hoje ou pegar outro dia na grade */
      (arquivo
        ? '<p class="next-timer"><a class="volta-hoje" href="' + esc(hrefDia(hoje)) + '">' +
            esc(t('backToToday')) + ' →</a></p>'
        : '<p class="next-timer">' + t('nextIn') + ' <b id="next-timer">--:--:--</b></p>')
    );

    ligarShare();
    if (!arquivo) tickTimer();
  }

  var timerInterval;
  function tickTimer() {
    clearInterval(timerInterval);
    function update() {
      var node = document.getElementById('next-timer');
      if (!node) { clearInterval(timerInterval); return; }
      var now = new Date();
      var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      var s = Math.max(0, Math.floor((next - now) / 1000));
      var h = String(Math.floor(s / 3600)).padStart(2, '0');
      var m = String(Math.floor(s % 3600 / 60)).padStart(2, '0');
      var sec = String(s % 60).padStart(2, '0');
      node.textContent = h + ':' + m + ':' + sec;
    }
    update();
    timerInterval = setInterval(update, 1000);
  }

  /* -------------------------------------------------------------- boot */

  /* ------------------------------------------- textos fixos e seletores */

  function rotular(node, text) {
    node.title = text;
    node.setAttribute('aria-label', text);
  }

  function applyLanguage() {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    document.title = t('docTitle');
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t('tagline'));

    var logo = document.getElementById('logo');
    var parts = t('logo');
    logo.innerHTML = '';
    logo.appendChild(document.createTextNode(parts[0]));
    logo.appendChild(el('span', null, parts[1]));
    logo.appendChild(document.createTextNode(parts[2]));

    rotular(document.getElementById('btn-help'), t('help'));
    rotular(document.getElementById('btn-archive'), t('archive'));
    rotular(document.getElementById('btn-stats'), t('stats'));

    input.placeholder = t('placeholder');
    input.setAttribute('aria-label', t('yourGuess'));
    btnGuess.textContent = t('guess');
    btnSkip.textContent = t('skip');
    btnSkip.title = t('skipTitle');
    canvas.setAttribute('aria-label', t('coverAlt'));
    document.getElementById('modal-close').setAttribute('aria-label', t('close'));
    rotular(document.getElementById('btn-lang'), t('langLabel'));
    rotular(document.getElementById('btn-mode'), t('modeLabel'));

    document.getElementById('rodape').innerHTML = t('creditLine')(CONFIG.contactEmail);
  }

  /* Menu ancorado ao ícone: uma lista curta, marcando a opção atual. */
  var menu = document.getElementById('menu');
  var menuOwner = null;

  function closeMenu() {
    menu.hidden = true;
    menu.innerHTML = '';
    if (menuOwner) menuOwner.setAttribute('aria-expanded', 'false');
    menuOwner = null;
  }

  function openMenu(anchor, title, items, currentValue, onPick) {
    if (menuOwner === anchor) { closeMenu(); return; }
    closeMenu();

    menu.appendChild(el('h4', null, title));
    items.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'menuitemradio');
      btn.setAttribute('aria-checked', item.value === currentValue ? 'true' : 'false');
      btn.appendChild(el('span', 'tick', '✓'));
      btn.appendChild(el('span', null, item.label));
      btn.addEventListener('click', function () {
        closeMenu();
        if (item.value !== currentValue) onPick(item.value);
      });
      menu.appendChild(btn);
    });

    menu.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    menuOwner = anchor;

    /* alinhado à direita do ícone, sem escapar da janela */
    var r = anchor.getBoundingClientRect();
    var largura = menu.offsetWidth;
    var esquerda = Math.min(
      Math.max(8, r.right - largura),
      document.documentElement.clientWidth - largura - 8
    );
    menu.style.top = (r.bottom + window.scrollY + 6) + 'px';
    menu.style.left = (esquerda + window.scrollX) + 'px';
  }

  document.addEventListener('click', function (e) {
    if (menuOwner && !menu.contains(e.target) && !menuOwner.contains(e.target)) closeMenu();
  });

  /* trocar versão ou idioma recarrega: o acervo, o calendário e todos os
     textos mudam de uma vez, e a partida salva de cada versão é preservada */
  function reloadWith(key, value) {
    store(key, value);
    var keep = (location.search.match(/[?&]dia=(\d+)/) || [])[1];
    location.href = location.pathname + (keep ? '?dia=' + keep : '');
  }

  function setupSwitchers() {
    document.getElementById('btn-lang').addEventListener('click', function (e) {
      e.stopPropagation();
      openMenu(this, t('langLabel'), [
        { value: 'pt', label: 'Português' },
        { value: 'en', label: 'English' }
      ], lang, function (v) { reloadWith('lang', v); });
    });

    document.getElementById('btn-mode').addEventListener('click', function (e) {
      e.stopPropagation();
      var items = Object.keys(MODES).map(function (id) {
        return { value: id, label: I18n.mode(id) };
      });
      openMenu(this, t('modeLabel'), items, mode, function (v) { reloadWith('mode', v); });
    });
  }

  /* Fora do dia de hoje, o aviso de que se está no arquivo fica visível o tempo
     todo: sem ele a pessoa abre o jogo amanhã pelo histórico do navegador e não
     entende por que a capa é a de ontem. */
  function renderArchiveBar() {
    var bar = document.getElementById('archive-bar');
    if (!arquivo) { bar.hidden = true; return; }
    bar.innerHTML = '<span>' + esc(t('playingDay')(day)) + '</span>' +
      '<a href="' + esc(hrefDia(hoje)) + '">' + esc(t('backToToday')) + ' →</a>';
    bar.hidden = false;
  }

  function boot() {
    applyLanguage();
    setupSwitchers();
    renderArchiveBar();

    if (resetMsg) toast(t(resetMsg));

    if (!ALBUMS.length) {
      stageLabel.textContent = t('noAlbums');
      return;
    }

    state.guesses.forEach(function (id) {
      if (isSkip(id)) { renderSkipRow(); return; }
      var a = POOL.find(function (x) { return x.id === id; });
      if (a) renderRow(a, false);
    });
    renderStatus();

    loadCover(target, function () {
      drawCover(state.done ? null : state.guesses.length);
      if (state.done) encerrar();
    });

    if (state.done) setTimeout(function () { showResult(getStats()); }, 400);
    else if (!store('seen-help')) {
      store('seen-help', true);
      document.getElementById('btn-help').click();
    }
  }

  boot();
})();
