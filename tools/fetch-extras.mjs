/* Preenche data/extras.json com o que a tela de resultado mostra além da capa:
 * o link do álbum no Spotify, o artigo da Wikipédia e um resumo de duas frases.
 *
 *   node tools/fetch-extras.mjs              completa só o que falta
 *   node tools/fetch-extras.mjs --force      refaz tudo
 *   node tools/fetch-extras.mjs --only led-zeppelin-iv
 *
 * O caminho é Wikidata -> Wikipédia, e não busca por texto: o mbid que já está
 * no acervo identifica o item do Wikidata, que dá o id do Spotify (P2205) e o
 * título exato do artigo nos dois idiomas. Buscar "Clube da Esquina" pelo nome,
 * por exemplo, cai no artigo do coletivo mineiro, não no do disco.
 *
 * O resumo vem da Wikipédia (CC BY-SA) — por isso a tela credita a fonte e
 * linka o artigo. Duas frases, nada de copiar o verbete.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CONTACT = 'capadodia (contato: seu-email@exemplo.com)';
const UA = `CapaDoDia/1.0 ( ${CONTACT} )`;
const MB_DELAY = 1100;          // a MusicBrainz pede ~1 requisição por segundo
const WIKI_DELAY = 200;         // a Wikipédia é folgada, mas não custa esperar
const LOTE_SPARQL = 150;        // mbids por consulta
const MAX_BLURB = 260;          // a 2ª frase entra só se o texto couber nisso

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const albumsPath = join(root, 'data/albums.json');
const extrasPath = join(root, 'data/extras.json');

const albums = JSON.parse(readFileSync(albumsPath, 'utf8'));
const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

const extras = existsSync(extrasPath) ? JSON.parse(readFileSync(extrasPath, 'utf8')) : {};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const salvar = () => writeFileSync(extrasPath, JSON.stringify(extras, null, 2) + '\n', 'utf8');
const juntar = (id, dados) => { extras[id] = Object.assign({}, extras[id], dados); };

/* 503 é limite de requisições e a conexão às vezes cai: os dois pedem espera. */
async function api(url, tries = 4) {
  let wait = 2000;
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.status === 404) return null;
      if (res.status !== 503 && res.ok) return res.json();
    } catch (e) {
      lastErr = e;
    }
    await sleep(wait);
    wait *= 2;
  }
  if (lastErr) throw lastErr;
  return null;
}

/* ------------------------------- 1. do mbid ao item do Wikidata, em lote */

/* Uma consulta SPARQL resolve centenas de mbids de uma vez pela propriedade
   P436 (id do release-group na MusicBrainz) e já devolve o Spotify e os
   títulos dos artigos. O caminho pela MusicBrainz, uma requisição por álbum a
   1 por segundo, levava mais de uma hora para o acervo inteiro. */
function sparql(mbids) {
  const valores = mbids.map(m => JSON.stringify(m)).join(' ');
  return `SELECT ?mbid ?item ?spotify ?pt ?en WHERE {
  VALUES ?mbid { ${valores} }
  ?item wdt:P436 ?mbid .
  OPTIONAL { ?item wdt:P2205 ?spotify }
  OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://pt.wikipedia.org/> ; schema:name ?pt }
  OPTIONAL { ?b schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?en }
}`;
}

/* O mesmo mbid às vezes aparece em dois itens: o álbum e a "50th Anniversary
   Edition". Fica o que parece ser o disco — sem palavra de reedição no título e
   com artigo em português; no empate, o item mais antigo (Q menor). */
function nota(b) {
  const titulo = (b.pt && b.pt.value) || (b.en && b.en.value) || '';
  let n = 0;
  if (/anniversary|deluxe|remaster|super\s|box set|edition|edição/i.test(titulo)) n -= 5;
  if (b.pt) n += 2;
  if (b.en) n += 1;
  return n;
}

function qNum(b) { return parseInt(String(b.item.value).split('/Q').pop(), 10) || 1e9; }

async function porSparql(lista) {
  const achados = {};
  for (let k = 0; k < lista.length; k += LOTE_SPARQL) {
    const fatia = lista.slice(k, k + LOTE_SPARQL);
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql(fatia.map(a => a.mbid)))}`;
    const j = await api(url);
    const porMbid = {};
    for (const b of ((j && j.results && j.results.bindings) || [])) {
      const m = b.mbid.value;
      const atual = porMbid[m];
      if (!atual) { porMbid[m] = b; continue; }
      const dif = nota(b) - nota(atual);
      if (dif > 0 || (dif === 0 && qNum(b) < qNum(atual))) porMbid[m] = b;
    }
    for (const a of fatia) {
      const b = porMbid[a.mbid];
      if (!b) continue;
      achados[a.id] = {
        wikidata: String(b.item.value).split('/').pop(),
        spotify: (b.spotify && b.spotify.value) || null,
        wiki: { pt: (b.pt && b.pt.value) || null, en: (b.en && b.en.value) || null }
      };
    }
    console.log(`wikidata ${Math.min(k + LOTE_SPARQL, lista.length)}/${lista.length} ` +
      `(${Object.keys(achados).length} resolvidos)`);
    await sleep(WIKI_DELAY);
  }
  return achados;
}

/* ------------------------- 2. sobras: o caminho lento, pela MusicBrainz */

/* Acontece quando o item do Wikidata não tem o P436 preenchido, ou quando o
   mbid do acervo é de release e não de release-group. */
async function grupoDe(mbid) {
  const g = await api(`https://musicbrainz.org/ws/2/release-group/${mbid}?inc=url-rels&fmt=json`);
  if (g) return g;
  const r = await api(`https://musicbrainz.org/ws/2/release/${mbid}?inc=release-groups&fmt=json`);
  const id = r && r['release-group'] && r['release-group'].id;
  if (!id) return null;
  await sleep(MB_DELAY);
  return api(`https://musicbrainz.org/ws/2/release-group/${id}?inc=url-rels&fmt=json`);
}

async function wikidataPorMusicBrainz(album) {
  if (!album.mbid) return null;
  const g = await grupoDe(album.mbid);
  const rel = ((g && g.relations) || []).find(x => x.type === 'wikidata');
  const url = rel && rel.url && rel.url.resource;
  const m = url && url.match(/(Q\d+)/);
  return m ? m[1] : null;
}

/* ------------------------- 2b. últimas sobras: busca validada na Wikipédia */

/* Alguns itens do Wikidata não têm o P436 e o release-group não tem o link do
   Wikidata — "Hotel California" e o Álbum Branco caem aí. Só resta buscar por
   nome, e aí a busca devolve de tudo: o artigo da banda ("Eagles"), a
   discografia, o disco ao vivo homônimo, o Vol. 1 quando queremos o Vol. 2.
   Por isso o candidato precisa passar em três testes — o título do artigo tem
   de ser o do álbum (ignorando o parêntese de desambiguação), o resumo tem de
   citar o artista e tem de dizer que é álbum. */
function palavraChave(artista) {
  const partes = artista.replace(/&|\band\b|\bthe\b/gi, ' ').split(/[\s,]+/).filter(Boolean);
  return partes.sort((a, b) => b.length - a.length)[0] || artista;
}

function normalizar(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* sem acento, sem pontuação: "Sgt. Pepper's Lonely…" e "sgt peppers lonely…"
   têm de casar, senão a comparação falha por causa de um apóstrofo */
function achatar(s) {
  return normalizar(s).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/* "Blur (Blur album)", "Tapestry (álbum)" e "Secos & Molhados (álbum de 1973)"
   viram "blur", "tapestry" e "secos & molhados" — e o mesmo vale para o título
   do jogo, que carrega "(1973)" ou "(Álbum Branco)" para diferenciar homônimos. */
function tituloBase(s) {
  return achatar(String(s).replace(/\s*\([^()]*\)\s*$/, ''));
}

/* O artigo pode trazer o nome do artista na frente ("Tim Maia Racional, Vol.
   1"), então além da igualdade vale o título do álbum aparecer inteiro dentro
   do do artigo — e só com 10 caracteres ou mais, senão um título curto como
   "Elis" casaria com o artigo da cantora. */
function mesmoAlbum(tituloArtigo, tituloAlbum) {
  const artigo = tituloBase(tituloArtigo);
  const album = tituloBase(tituloAlbum);
  if (artigo === album) return true;
  return album.length >= 10 && (' ' + artigo + ' ').indexOf(' ' + album + ' ') !== -1;
}

async function buscarCandidatos(lang, album) {
  const termo = album.title.replace(/\s*\(\d{4}\)$/, '') + ' ' + album.artist;
  const busca = await api(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(termo)}&srlimit=5&format=json&formatversion=2`);
  const titulos = (((busca && busca.query) || {}).search || []).map(h => h.title);
  if (!titulos.length) return null;

  const detalhe = await api(`https://${lang}.wikipedia.org/w/api.php?action=query` +
    '&prop=extracts|pageprops&ppprop=wikibase_item&exintro=1&explaintext=1&exsentences=2' +
    `&exlimit=20&redirects=1&format=json&formatversion=2&titles=${titulos.map(encodeURIComponent).join('|')}`);
  const paginas = ((detalhe && detalhe.query) || {}).pages || [];
  const chave = normalizar(palavraChave(album.artist));

  for (const titulo of titulos) {                 // respeita a ordem da busca
    const p = paginas.find(x => x.title === titulo);
    const texto = normalizar((p && p.extract) || '');
    if (!texto) continue;
    const q = p.pageprops && p.pageprops.wikibase_item;
    const mesmoTitulo = mesmoAlbum(p.title, album.title);
    const citaArtista = texto.indexOf(chave) !== -1;
    const ehDisco = /\balbum\b|\bdisco\b/.test(texto);
    if (q && mesmoTitulo && citaArtista && ehDisco) return { q: q, titulo: p.title, lang: lang };
  }
  return null;
}

/* Com o Q na mão, a API do Wikidata devolve Spotify e artigos em lotes de 50. */
async function wikidataLote(ids) {
  const url = 'https://www.wikidata.org/w/api.php?action=wbgetentities' +
    `&ids=${ids.join('|')}&props=sitelinks|claims&sitefilter=ptwiki|enwiki` +
    '&format=json&formatversion=2';
  const j = await api(url);
  const out = {};
  for (const [id, e] of Object.entries((j && j.entities) || {})) {
    const sl = e.sitelinks || {};
    const spot = ((e.claims || {}).P2205 || [])
      .map(c => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value)
      .filter(Boolean)[0] || null;
    out[id] = {
      spotify: spot,
      wiki: {
        pt: (sl.ptwiki && sl.ptwiki.title) || null,
        en: (sl.enwiki && sl.enwiki.title) || null
      }
    };
  }
  return out;
}

/* ------------------------------------------------------------ 3. resumos */

/* Tira a pronúncia entre parênteses ("(Brazilian Portuguese pronunciation:
   [akaˈbow ʃoˈɾaɾi], 'No More Crying')") e corta na 1ª frase se as duas
   passarem do limite — a tela de resultado não é lugar de parágrafo. */
function limpar(texto) {
  if (!texto) return null;
  const s = texto
    .replace(/\s*\([^()]*(?:pronunciation|pronúncia|pronuncia)[^()]*\)/gi, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return null;
  if (s.length <= MAX_BLURB) return s;
  const corte = s.slice(0, MAX_BLURB).lastIndexOf('. ');
  if (corte > 60) return s.slice(0, corte + 1);
  return s.slice(0, MAX_BLURB).replace(/\s+\S*$/, '') + '…';
}

/* O título pedido às vezes é um redirect para outra página: "Holy Land" e "A
   Voz do Samba" caem na discografia da banda, "Violência Gera Violência" cai na
   biografia do Bezerra. O resumo só passa se falar do disco — e um texto curto
   demais (o verbete do Megadeth começa e termina no próprio título) não serve. */
function resumoValido(texto, album) {
  if (!texto || texto.length < 45) return false;
  const t = achatar(texto);

  /* citar o próprio título é o sinal mais forte de que o texto é do disco */
  const titulo = tituloBase(album.title);
  if (titulo.length >= 4 && t.indexOf(titulo) !== -1) return true;

  /* título curto ("21", "2112", "Aja") pode não aparecer; aí exige o artista,
     uma palavra de álbum e que não seja página de discografia nem biografia */
  if (t.indexOf(achatar(palavraChave(album.artist))) === -1) return false;
  const inicio = t.slice(0, 160);
  if (/discografia|discography|lista d|^esta e|^este e|^aqui uma/.test(inicio)) return false;
  if (/(e|foi) (um|uma) (banda|grupo|dupla|supergrupo|cantor|cantora|rapper|musico|compositor|guitarrista|saxofonista|pianista|produtor)/.test(inicio)) return false;
  return /\balbum|\balbuns|\bdisco\b|\blp\b/.test(t);
}

async function resumosLote(lang, titulos) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts` +
    '&exintro=1&explaintext=1&exsentences=2&exlimit=20&redirects=1' +
    `&format=json&formatversion=2&titles=${titulos.map(encodeURIComponent).join('|')}`;
  const j = await api(url);
  const out = {};
  /* redirects=1 pode devolver a página com outro título; os mapas de
     normalized e redirects dizem de qual pedido cada página veio. */
  const apelido = {};
  for (const r of ((j && j.query && j.query.redirects) || [])) apelido[r.to] = r.from;
  for (const n of ((j && j.query && j.query.normalized) || [])) apelido[n.to] = n.from;
  for (const p of ((j && j.query && j.query.pages) || [])) {
    const texto = limpar(p.extract);
    if (!texto) continue;
    out[p.title] = texto;
    if (apelido[p.title]) out[apelido[p.title]] = texto;
  }
  return out;
}

/* ----------------------------------------------------------------- execução */

const alvo = albums.filter(a => {
  if (only) return a.id === only;
  if (force) return true;
  const e = extras[a.id];
  return !e || !e.wiki;
});

console.log(`${alvo.length} álbum(ns) a completar.`);
if (!alvo.length) process.exit(0);

/* Entrada do zero para quem vai ser refeito: os campos são gravados por
   merge, então um resumo recusado agora continuaria salvo da rodada anterior. */
for (const a of alvo) delete extras[a.id];

/* fase 1 — SPARQL */
const comMbid = alvo.filter(a => a.mbid);
const achados = await porSparql(comMbid);
for (const [id, dados] of Object.entries(achados)) juntar(id, dados);
salvar();

/* fase 2 — o que o SPARQL não resolveu vai pela MusicBrainz */
const sobras = alvo.filter(a => !extras[a.id] || !extras[a.id].wiki);
if (sobras.length) {
  console.log(`\n${sobras.length} sem P436 no Wikidata; tentando pela MusicBrainz (~1/s).`);
  let i = 0;
  for (const a of sobras) {
    i++;
    try {
      const q = extras[a.id] && extras[a.id].wikidata
        ? extras[a.id].wikidata
        : await wikidataPorMusicBrainz(a);
      juntar(a.id, { wikidata: q });
      console.log(`${String(i).padStart(3)}/${sobras.length} ${q ? q.padEnd(10) : 'sem wikidata'} ${a.id}`);
    } catch (e) {
      console.log(`${String(i).padStart(3)}/${sobras.length} ERRO      ${a.id}: ${e.message}`);
    }
    if (i % 20 === 0) salvar();
    await sleep(MB_DELAY);
  }
  salvar();

  /* quem ainda não tem Q: busca validada, em português e depois em inglês */
  const teimosos = sobras.filter(a => !(extras[a.id] && extras[a.id].wikidata));
  if (teimosos.length) {
    console.log(`\n${teimosos.length} sem link no Wikidata; buscando por nome na Wikipédia.`);
    for (const a of teimosos) {
      let achado = null;
      for (const lang of ['pt', 'en']) {
        achado = await buscarCandidatos(lang, a);
        await sleep(WIKI_DELAY);
        if (achado) break;
      }
      if (achado) juntar(a.id, { wikidata: achado.q });
      console.log(`   ${achado ? achado.q.padEnd(10) + ' ' + achado.lang + ': ' + achado.titulo : 'nada encontrado'} <- ${a.id}`);
    }
    salvar();
  }

  const comQ = sobras.filter(a => extras[a.id] && extras[a.id].wikidata);
  for (let k = 0; k < comQ.length; k += 50) {
    const fatia = comQ.slice(k, k + 50);
    const dados = await wikidataLote([...new Set(fatia.map(a => extras[a.id].wikidata))]);
    for (const a of fatia) {
      const d = dados[extras[a.id].wikidata];
      if (d) juntar(a.id, d);
    }
    await sleep(WIKI_DELAY);
  }
  salvar();
}

/* fase 3 — resumos, em lotes de 20 por idioma */
const comTitulo = alvo.filter(a => extras[a.id] && extras[a.id].wiki);
for (const lang of ['pt', 'en']) {
  const fila = comTitulo.filter(a => extras[a.id].wiki[lang]);
  for (let k = 0; k < fila.length; k += 20) {
    const fatia = fila.slice(k, k + 20);
    const textos = await resumosLote(lang, fatia.map(a => extras[a.id].wiki[lang]));
    for (const a of fatia) {
      const texto = textos[extras[a.id].wiki[lang]];
      if (!texto) continue;
      if (!resumoValido(texto, a)) {
        console.log(`   descartado (${lang}) ${a.id}: ${texto.slice(0, 70)}`);
        continue;
      }
      const blurb = Object.assign({}, extras[a.id].blurb);
      blurb[lang] = texto;
      juntar(a.id, { blurb: blurb });
    }
    console.log(`resumo ${lang} ${Math.min(k + 20, fila.length)}/${fila.length}`);
    await sleep(WIKI_DELAY);
  }
}
salvar();

/* ------------------------------------------------------------------ balanço */

const tem = f => albums.filter(a => {
  const e = extras[a.id];
  if (!e) return false;
  return f === 'spotify' ? !!e.spotify : !!(e.blurb && e.blurb[f]);
}).length;

console.log(`\nde ${albums.length} álbuns: ${tem('spotify')} com Spotify, ` +
  `${tem('pt')} com resumo em português, ${tem('en')} em inglês.`);
