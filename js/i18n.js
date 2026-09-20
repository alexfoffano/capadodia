/* Idiomas do jogo.
   Além dos textos da interface, traduz os VALORES que aparecem nas células
   (gênero, subgênero, país, formação) — sem isso o jogo em inglês mostraria
   "Solo masculino" e "Rock progressivo" no meio das colunas.
   Nomes próprios (álbum, artista, gravadora) nunca são traduzidos. */
(function (global) {
  'use strict';

  var UI = {
    pt: {
      logo: ['capa', 'do', 'dia'],
      tagline: 'Um álbum novo por dia. Descubra a capa escondida em 6 tentativas.',
      docTitle: 'Capa do Dia — adivinhe o álbum',
      help: 'Como jogar',
      archive: 'Jogos anteriores',
      stats: 'Estatísticas',
      placeholder: 'Digite um álbum ou artista…',
      guess: 'Chutar',
      skip: 'Pular',
      skipTitle: 'Pular revela mais da capa e gasta uma tentativa',
      yourGuess: 'Seu palpite',
      coverAlt: 'Capa do álbum distorcida',
      attempt: function (n, total) { return 'Tentativa ' + n + ' de ' + total; },
      wonIn: function (n) { return 'Você acertou em ' + n + (n === 1 ? ' tentativa' : ' tentativas'); },
      gameOver: 'Fim de jogo — a capa era esta',
      answer: 'Resposta',
      remaining: function (n, total) {
        return n + (n === 1 ? ' tentativa restante' : ' tentativas restantes') + ' · ' + total + ' álbuns possíveis';
      },
      finished: function (day, total) { return 'Álbum #' + day + ' · ' + total + ' álbuns no acervo'; },
      alreadyGuessed: 'Você já chutou esse álbum',
      emptyGuess: 'Digite o nome de um álbum ou artista',
      notFound: 'Álbum não encontrado no acervo',
      skipped: 'Tentativa pulada',
      resetGame: 'Partida de hoje reiniciada',
      resetAll: 'Partidas e estatísticas apagadas',
      copied: 'Resultado copiado!',
      copyFailed: 'Não foi possível copiar',
      close: 'Fechar',

      helpTitle: 'Como jogar',
      helpIntro: function (n) {
        return 'Todo dia um álbum novo. A capa aparece distorcida e você tem <b>' + n +
          ' tentativas</b> para descobrir qual é — a cada erro, mais da capa é revelada.';
      },
      helpCompare: 'Cada palpite mostra os dados do álbum que você chutou, comparados com os do álbum do dia:',
      legendHit: 'Igual ao álbum do dia.',
      legendNear: function (y) {
        return 'Perto: gênero vizinho, subgênero da mesma família, mesmo continente, mesmo grupo de gravadoras ou até ' + y + ' anos de diferença.';
      },
      legendMiss: 'Longe.',
      helpArrow: 'No <b>Ano</b>, a seta diz para onde ir: ↑ o álbum do dia é mais recente, ↓ é mais antigo.',
      helpColumns: 'Colunas',
      helpModes: 'Versões',
      helpModesText: 'Cada versão tem seu próprio álbum do dia, suas estatísticas e seu acervo.',

      aboutTitle: 'Sobre as capas',
      aboutText: function (mail) {
        return 'As capas exibidas aqui são obras de seus respectivos autores, artistas e ' +
          'gravadoras, e aparecem apenas para identificar os álbuns, sem fim comercial. ' +
          'As imagens vêm do <a href="https://coverartarchive.org/" target="_blank" ' +
          'rel="noopener noreferrer">Cover Art Archive</a>; os resumos, da ' +
          '<a href="https://pt.wikipedia.org/" target="_blank" rel="noopener noreferrer">' +
          'Wikipédia</a> (CC BY-SA). Este site não tem vínculo com nenhuma gravadora ou ' +
          'artista. Se você detém direitos sobre alguma imagem e quer que ela saia, ' +
          'solicite a remoção pelo e-mail <a href="mailto:' + mail + '">' + mail +
          '</a> que ela será retirada.';
      },
      creditLine: function (mail) {
        return 'Capas: <a href="https://coverartarchive.org/" target="_blank" ' +
          'rel="noopener noreferrer">Cover Art Archive</a> · Resumos: ' +
          '<a href="https://pt.wikipedia.org/" target="_blank" rel="noopener noreferrer">' +
          'Wikipédia</a> (CC BY-SA) · <a href="mailto:' + mail +
          '">pedir a remoção de uma capa</a>';
      },

      archiveTitle: 'Jogos anteriores',
      archiveIntro: 'Cada quadradinho é um dia. Clique num dia que você ainda não jogou para jogar agora.',
      archiveCount: function (feitos, total) {
        return feitos + (feitos === 1 ? ' dia jogado' : ' dias jogados') + ' de ' + total;
      },
      archiveDay: function (n) { return 'Álbum nº ' + n; },
      legendOpen: 'Ainda não jogado',
      legendDoing: 'Começado',
      legendWon: 'Acertado',
      legendLost: 'Não acertado',
      legendSoon: 'Ainda não chegou',
      playingDay: function (n) { return 'Arquivo · álbum nº ' + n; },
      backToToday: 'Voltar para hoje',

      statsTitle: 'Estatísticas',
      played: 'jogos',
      winRate: 'vitórias',
      streak: 'sequência',
      best: 'recorde',
      won: 'Acertou! 🎉',
      lost: 'Quase lá',
      share: 'Compartilhar resultado',
      shareToday: 'Compartilhar resultado do dia',
      seeResult: 'Ver o resultado do dia',
      /* primeira linha do texto compartilhado */
      shareHead: function (dia, tentativas, ganhou, total) {
        var frase = !ganhou ? 'Eu não consegui hoje!'
          : tentativas === 1 ? 'Eu acertei de primeira!'
          : tentativas === 2 ? 'Eu acertei rápido!'
          : tentativas === total ? 'Eu acertei por pouco!'
          : tentativas === total - 1 ? 'Essa quase escapou!'
          : 'Eu acertei!';
        return 'Capa do Dia nº ' + dia + ' — ' + frase +
          ' (' + (ganhou ? tentativas : 'X') + '/' + total + ')';
      },
      listen: 'Ouvir no Spotify',
      buy: 'Comprar na Amazon',
      readMore: 'Leia mais na Wikipédia',
      nextIn: 'Próximo álbum em',
      noAlbums: 'Nenhum álbum carregado — rode "node tools/build.mjs".',

      modeLabel: 'Versão',
      langLabel: 'Idioma',
      columns: {
        genre: 'Gênero', subgenre: 'Subgênero', artist: 'Artista',
        artistType: 'Formação', country: 'País', year: 'Ano', label: 'Gravadora'
      }
    },

    en: {
      logo: ['cover ', 'of the', ' day'],
      tagline: 'A new album every day. Guess the hidden cover in 6 tries.',
      docTitle: 'Cover of the Day — guess the album',
      help: 'How to play',
      archive: 'Past games',
      stats: 'Statistics',
      placeholder: 'Type an album or artist…',
      guess: 'Guess',
      skip: 'Skip',
      skipTitle: 'Skipping reveals more of the cover and costs a try',
      yourGuess: 'Your guess',
      coverAlt: 'Distorted album cover',
      attempt: function (n, total) { return 'Try ' + n + ' of ' + total; },
      wonIn: function (n) { return 'You got it in ' + n + (n === 1 ? ' try' : ' tries'); },
      gameOver: 'Game over — this was the cover',
      answer: 'Answer',
      remaining: function (n, total) {
        return n + (n === 1 ? ' try left' : ' tries left') + ' · ' + total + ' possible albums';
      },
      finished: function (day, total) { return 'Album #' + day + ' · ' + total + ' albums in the pool'; },
      alreadyGuessed: 'You already guessed that album',
      emptyGuess: 'Type an album or artist name',
      notFound: 'Album not in the pool',
      skipped: 'Skipped',
      resetGame: 'Game reset',
      resetAll: 'Games and stats cleared',
      copied: 'Result copied!',
      copyFailed: 'Could not copy',
      close: 'Close',

      helpTitle: 'How to play',
      helpIntro: function (n) {
        return 'A new album every day. The cover shows up distorted and you get <b>' + n +
          ' tries</b> to name it — every wrong guess reveals a bit more.';
      },
      helpCompare: 'Each guess shows the data of the album you guessed, compared to the album of the day:',
      legendHit: 'Same as the album of the day.',
      legendNear: function (y) {
        return 'Close: neighbouring genre, subgenre in the same family, same continent, same label group, or within ' + y + ' years.';
      },
      legendMiss: 'Far off.',
      helpArrow: 'On <b>Year</b>, the arrow points the way: ↑ the album of the day is newer, ↓ it is older.',
      helpColumns: 'Columns',
      helpModes: 'Editions',
      helpModesText: 'Each edition has its own album of the day, its own stats and its own pool.',

      aboutTitle: 'About the covers',
      aboutText: function (mail) {
        return 'The covers shown here are the work of their respective authors, artists ' +
          'and labels, and appear only to identify the albums, with no commercial ' +
          'purpose. The images come from the <a href="https://coverartarchive.org/" ' +
          'target="_blank" rel="noopener noreferrer">Cover Art Archive</a>; the summaries, ' +
          'from <a href="https://en.wikipedia.org/" target="_blank" rel="noopener ' +
          'noreferrer">Wikipedia</a> (CC BY-SA). This site is not connected to any label ' +
          'or artist. If you hold rights to an image and want it taken down, request its ' +
          'removal at <a href="mailto:' + mail + '">' + mail + '</a> and it will be removed.';
      },
      creditLine: function (mail) {
        return 'Covers: <a href="https://coverartarchive.org/" target="_blank" ' +
          'rel="noopener noreferrer">Cover Art Archive</a> · Summaries: ' +
          '<a href="https://en.wikipedia.org/" target="_blank" rel="noopener noreferrer">' +
          'Wikipedia</a> (CC BY-SA) · <a href="mailto:' + mail +
          '">ask for a cover to be removed</a>';
      },

      archiveTitle: 'Past games',
      archiveIntro: 'Every square is a day. Click one you have not played to play it now.',
      archiveCount: function (done, total) {
        return done + (done === 1 ? ' day played' : ' days played') + ' out of ' + total;
      },
      archiveDay: function (n) { return 'Album #' + n; },
      legendOpen: 'Not played yet',
      legendDoing: 'Started',
      legendWon: 'Solved',
      legendLost: 'Missed',
      legendSoon: 'Not out yet',
      playingDay: function (n) { return 'Archive · album #' + n; },
      backToToday: 'Back to today',

      statsTitle: 'Statistics',
      played: 'played',
      winRate: 'wins',
      streak: 'streak',
      best: 'best',
      won: 'You got it! 🎉',
      lost: 'So close',
      share: 'Share result',
      shareToday: "Share today's result",
      seeResult: "See today's result",
      shareHead: function (day, tries, won, total) {
        var frase = !won ? 'I could not get it today!'
          : tries === 1 ? 'I got it on the first try!'
          : tries === 2 ? 'I got it fast!'
          : tries === total ? 'I got it by a hair!'
          : tries === total - 1 ? 'That was a close one!'
          : 'I got it!';
        return 'Cover of the Day #' + day + ' — ' + frase +
          ' (' + (won ? tries : 'X') + '/' + total + ')';
      },
      listen: 'Listen on Spotify',
      buy: 'Buy on Amazon',
      readMore: 'Read more on Wikipedia',
      nextIn: 'Next album in',
      noAlbums: 'No albums loaded — run "node tools/build.mjs".',

      modeLabel: 'Edition',
      langLabel: 'Language',
      columns: {
        genre: 'Genre', subgenre: 'Subgenre', artist: 'Artist',
        artistType: 'Act', country: 'Country', year: 'Year', label: 'Label'
      }
    }
  };

  /* Valores dos dados. Só o que muda de idioma entra aqui; o que é igual nos
     dois (Samba, Bossa nova, Merseybeat, Disco…) fica de fora e passa direto. */
  var DATA_EN = {
    // gêneros
    'Eletrônica': 'Electronic',
    'Latino': 'Latin',
    'MPB': 'MPB',
    // subgêneros
    'Rock progressivo': 'Progressive rock',
    'Rock psicodélico': 'Psychedelic rock',
    'Rock alternativo': 'Alternative rock',
    'Rock experimental': 'Experimental rock',
    'Rock nacional': 'Brazilian rock',
    'Rock gótico': 'Gothic rock',
    'Rock industrial': 'Industrial rock',
    'Rock latino': 'Latin rock',
    'Rock and roll': 'Rock and roll',
    'Pop barroco': 'Baroque pop',
    'Funk psicodélico': 'Psychedelic funk',
    'Funk carioca': 'Baile funk',
    'Jazz espiritual': 'Spiritual jazz',
    'Jazz vocal': 'Vocal jazz',
    'Jazz modal': 'Modal jazz',
    'Jazz fusion': 'Jazz fusion',
    'Blues de Chicago': 'Chicago blues',
    'Blues elétrico': 'Electric blues',
    'Hip-hop político': 'Political hip-hop',
    'Hip-hop experimental': 'Experimental hip-hop',
    'Rap alternativo': 'Alternative rap',
    'Rap abstrato': 'Abstract rap',
    'Rap nacional': 'Brazilian rap',
    'Rap hardcore': 'Hardcore rap',
    'R&B contemporâneo': 'Contemporary R&B',
    'R&B alternativo': 'Alternative R&B',
    'Samba experimental': 'Experimental samba',
    'Vanguarda paulista': 'São Paulo avant-garde',
    'Samba rock': 'Samba rock',
    'Sertanejo romântico': 'Romantic sertanejo',
    'Metal progressivo': 'Progressive metal',
    'Metal alternativo': 'Alternative metal',
    'Rock sinfônico': 'Symphonic rock',
    'Reggae nacional': 'Brazilian reggae',
    'Free jazz': 'Free jazz',
    'Cool jazz': 'Cool jazz',
    'Hard bop': 'Hard bop',
    'Jazz pop': 'Jazz pop',
    'Country outlaw': 'Outlaw country',
    'Country rock': 'Country rock',
    'Indie folk': 'Indie folk',
    'Indie rock': 'Indie rock',
    // países
    'Estados Unidos': 'United States',
    'Inglaterra': 'England',
    'Brasil': 'Brazil',
    'Alemanha': 'Germany',
    'França': 'France',
    'Irlanda': 'Ireland',
    'Irlanda do Norte': 'Northern Ireland',
    'Islândia': 'Iceland',
    'Suécia': 'Sweden',
    'Noruega': 'Norway',
    'Canadá': 'Canada',
    'Austrália': 'Australia',
    'Porto Rico': 'Puerto Rico',
    // formação
    'Banda': 'Band',
    'Solo masculino': 'Male solo',
    'Solo feminino': 'Female solo',
    'Dupla': 'Duo',
    'Coletivo': 'Group',
    // gravadora genérica
    'Independente': 'Independent'
  };

  var MODES = {
    tudo: { pt: 'Nacional e internacional', en: 'Brazilian & international' },
    intl: { pt: 'Só internacional', en: 'International only' }
  };

  var current = 'pt';

  global.I18n = {
    languages: ['pt', 'en'],

    /* idioma salvo > idioma do navegador > português */
    detect: function (saved) {
      if (saved && UI[saved]) return saved;
      var nav = (navigator.language || 'pt').toLowerCase();
      return nav.indexOf('pt') === 0 ? 'pt' : 'en';
    },

    set: function (lang) { current = UI[lang] ? lang : 'pt'; },
    get: function () { return current; },
    t: function (key) { return UI[current][key]; },
    column: function (key) { return UI[current].columns[key]; },
    mode: function (id) { return (MODES[id] || {})[current] || id; },

    /* traduz um valor de dado; o que não está no dicionário passa igual */
    value: function (text) {
      if (current === 'pt') return text;
      return DATA_EN[text] || text;
    }
  };
})(window);
