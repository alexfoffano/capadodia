/* Taxonomia de proximidade — é isto que decide o que fica AMARELO.
   Tudo aqui é editável à mão: quanto melhor a taxonomia, mais justo o jogo. */
(function (global) {
  'use strict';

  /* Gêneros vizinhos. As relações são declaradas uma vez e espelhadas
     automaticamente (se Rock é vizinho de Punk, Punk é vizinho de Rock). */
  var GENRE_LINKS = {
    'Rock':      ['Punk', 'Metal', 'Folk', 'Pop'],
    'Punk':      ['Metal'],
    'Pop':       ['Soul/R&B', 'Eletrônica', 'Funk'],
    'Soul/R&B':  ['Funk', 'Hip-hop', 'Jazz'],
    'Funk':      ['Hip-hop'],
    'Jazz':      ['MPB', 'Blues'],
    'Blues':     ['Rock', 'Soul/R&B'],
    'Eletrônica':['Funk'],
    'Folk':      ['Country', 'MPB'],
    'Country':   ['Sertanejo'],
    'Sertanejo': ['Forró', 'MPB'],
    'MPB':       ['Samba', 'Axé'],
    'Samba':     ['Axé', 'Forró', 'Latino'],
    'Axé':       ['Forró'],
    'Reggae':    ['Latino', 'Soul/R&B']
  };

  /* Famílias de subgênero. Dois subgêneros diferentes que dividem ao menos
     uma família contam como "quase". */
  var SUBGENRE_FAMILIES = [
    ['Rock progressivo', 'Art rock', 'Rock experimental', 'Rock psicodélico', 'Pop barroco', 'Krautrock', 'Post-rock', 'Rock sinfônico'],
    ['Rock sinfônico', 'Pop barroco', 'Pop rock', 'Art rock'],
    ['Hard rock', 'Heavy metal', 'Glam rock', 'Blues rock', 'Rock and roll', 'Arena rock', 'Southern rock'],
    ['Stoner rock', 'Hard rock', 'Heavy metal', 'Rock psicodélico', 'Grunge', 'Metal alternativo'],
    ['Arena rock', 'Soft rock', 'Pop rock', 'Heartland rock'],
    ['Garage rock', 'Punk rock', 'Indie rock', 'Rock and roll'],
    ['Ska punk', 'Punk rock', 'Pop punk', 'Reggae'],
    ['Metal progressivo', 'Rock progressivo', 'Thrash metal', 'Heavy metal'],
    ['Southern rock', 'Country rock', 'Blues rock'],
    ['Merseybeat', 'Rock and roll', 'Pop rock', 'Folk rock'],
    ['Delta blues', 'Blues de Chicago', 'Blues elétrico', 'Blues rock'],
    ['Thrash metal', 'Groove metal', 'Power metal', 'Heavy metal'],
    ['Grunge', 'Rock alternativo', 'Indie rock', 'Shoegaze', 'Britpop', 'Post-punk'],
    ['Punk rock', 'Pop punk', 'Post-punk', 'Rock gótico', 'Hardcore punk'],
    ['Hardcore punk', 'Punk rock', 'Thrash metal', 'Ska punk'],
    ['Nu metal', 'Rap metal', 'Rap rock', 'Rock industrial', 'Funk rock', 'Metal alternativo'],
    ['Metal alternativo', 'Groove metal', 'Rock alternativo', 'Heavy metal'],
    ['East Coast', 'West Coast', 'G-funk', 'Gangsta rap', 'Old school', 'Southern rap', 'Rap hardcore', 'Hip-hop político'],
    ['Rap alternativo', 'Rap abstrato', 'Jazz rap', 'Hip-hop experimental', 'Rap nacional'],
    ['Soul', 'Neo soul', 'R&B contemporâneo', 'R&B alternativo', 'Pop soul'],
    ['Funk', 'Funk psicodélico', 'Funk rock', 'Funk carioca'],
    ['Pop dance', 'Dance-pop', 'Disco', 'Eletropop', 'Synth-pop', 'Europop', 'Art pop'],
    ['House', 'Ambient', 'Downtempo', 'Trip hop', 'Big beat', 'Eletropop'],
    ['Jazz modal', 'Hard bop', 'Cool jazz', 'Free jazz', 'Jazz espiritual', 'Jazz fusion', 'Jazz pop'],
    ['Jazz vocal', 'Jazz pop', 'Cool jazz', 'Soul'],
    ['Folk rock', 'Singer-songwriter', 'Indie folk', 'Country rock', 'Worldbeat'],
    ['Country', 'Country outlaw', 'Country rock', 'Sertanejo romântico'],
    ['Soft rock', 'Pop rock', 'Heartland rock', 'Folk rock'],
    ['Bossa nova', 'MPB', 'Tropicália', 'Samba rock'],
    ['Vanguarda paulista', 'Tropicália', 'MPB', 'Samba experimental', 'Rock experimental'],
    ['Samba', 'Samba rock', 'Samba experimental', 'Pagode', 'Partido-alto'],
    ['Rock nacional', 'Manguebeat', 'Tropicália', 'Rap rock'],
    ['Son cubano', 'Reggaeton', 'Roots reggae', 'Rock latino'],
    ['Reggae nacional', 'Roots reggae', 'Rock nacional', 'MPB'],
    ['Rock latino', 'Rock nacional', 'Worldbeat'],
    ['Axé', 'Baião', 'Sertanejo romântico', 'Forró']
  ];

  /* Tipos de artista que contam como "quase" entre si. */
  var ARTIST_TYPE_FAMILIES = [
    ['Solo masculino', 'Solo feminino'],
    ['Banda', 'Coletivo', 'Dupla']
  ];

  /* Tolerâncias numéricas */
  var YEAR_NEAR = 5;   // até 5 anos de diferença = amarelo

  /* ---------- índices ---------- */
  function buildGenreGraph() {
    var g = {};
    function link(a, b) {
      (g[a] || (g[a] = [])).push(b);
      (g[b] || (g[b] = [])).push(a);
    }
    Object.keys(GENRE_LINKS).forEach(function (k) {
      GENRE_LINKS[k].forEach(function (v) { link(k, v); });
    });
    return g;
  }

  function buildFamilyIndex(families) {
    var idx = {};
    families.forEach(function (fam, i) {
      fam.forEach(function (item) { (idx[item] || (idx[item] = [])).push(i); });
    });
    return idx;
  }

  var genreGraph = buildGenreGraph();
  var subgenreIdx = buildFamilyIndex(SUBGENRE_FAMILIES);
  var artistTypeIdx = buildFamilyIndex(ARTIST_TYPE_FAMILIES);

  function sharesFamily(idx, a, b) {
    var fa = idx[a], fb = idx[b];
    if (!fa || !fb) return false;
    return fa.some(function (i) { return fb.indexOf(i) !== -1; });
  }

  /* ---------- comparadores ----------
     Cada um devolve { state: 'hit' | 'near' | 'miss', text, arrow? } */

  function exact(guessValue, targetValue) {
    return { state: guessValue === targetValue ? 'hit' : 'miss', text: guessValue };
  }

  var compare = {
    genre: function (g, t) {
      if (g.genre === t.genre) return { state: 'hit', text: g.genre };
      var near = (genreGraph[g.genre] || []).indexOf(t.genre) !== -1;
      return { state: near ? 'near' : 'miss', text: g.genre };
    },

    subgenre: function (g, t) {
      if (g.subgenre === t.subgenre) return { state: 'hit', text: g.subgenre };
      if (sharesFamily(subgenreIdx, g.subgenre, t.subgenre)) return { state: 'near', text: g.subgenre };
      // subgêneros diferentes mas dentro do mesmo gênero ainda contam como quase
      if (g.genre === t.genre) return { state: 'near', text: g.subgenre };
      return { state: 'miss', text: g.subgenre };
    },

    artist: function (g, t) {
      return exact(g.artist, t.artist);
    },

    artistType: function (g, t) {
      if (g.artistType === t.artistType) return { state: 'hit', text: g.artistType };
      if (sharesFamily(artistTypeIdx, g.artistType, t.artistType)) return { state: 'near', text: g.artistType };
      return { state: 'miss', text: g.artistType };
    },

    country: function (g, t) {
      if (g.country === t.country) return { state: 'hit', text: g.country };
      return { state: g.region === t.region ? 'near' : 'miss', text: g.country };
    },

    year: function (g, t) {
      var diff = t.year - g.year;
      var state = diff === 0 ? 'hit' : (Math.abs(diff) <= YEAR_NEAR ? 'near' : 'miss');
      return { state: state, text: String(g.year), arrow: diff === 0 ? '' : (diff > 0 ? '↑' : '↓') };
    },

    label: function (g, t) {
      if (g.label === t.label) return { state: 'hit', text: g.label };
      return { state: g.labelGroup === t.labelGroup ? 'near' : 'miss', text: g.label };
    }
  };

  /* Ordem e rótulos das colunas do tabuleiro */
  var COLUMNS = [
    { key: 'genre',      label: 'Gênero' },
    { key: 'subgenre',   label: 'Subgênero' },
    { key: 'artist',     label: 'Artista' },
    { key: 'artistType', label: 'Formação' },
    { key: 'country',    label: 'País' },
    { key: 'year',       label: 'Ano' },
    { key: 'label',      label: 'Gravadora' }
  ];

  global.Taxonomy = {
    COLUMNS: COLUMNS,
    YEAR_NEAR: YEAR_NEAR,
    evaluate: function (guess, target) {
      return COLUMNS.map(function (col) {
        var r = compare[col.key](guess, target);
        return { key: col.key, label: col.label, state: r.state, text: r.text, arrow: r.arrow || '' };
      });
    }
  };
})(window);
