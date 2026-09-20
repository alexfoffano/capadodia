/* Confere se o mbid de cada álbum aponta para o lançamento ORIGINAL.
 *
 *   node tools/verify-releases.mjs              só relata
 *   node tools/verify-releases.mjs --fix        procura o release-group do ano
 *                                               certo e rebaixa a capa dele
 *
 * Por que isso importa: a busca da MusicBrainz costuma devolver reedições e
 * caixas comemorativas antes do disco original. Quando isso acontece, a capa
 * baixada pode ser a arte da reedição, e não a que a pessoa conhece.
 *
 * O ano do JSON é a curadoria do jogo e não é alterado aqui — quem é corrigido
 * é o mbid. Divergências de 1 ano costumam ser só data de lançamento regional.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const UA = 'CapaDoDia/1.0 ( contato: seu-email@exemplo.com )';
const TOLERANCIA = 1;          // anos de diferença aceitos sem reclamar
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'data/albums.json');
const coversDir = join(root, 'assets/covers');
const albums = JSON.parse(readFileSync(dataPath, 'utf8'));
const fix = process.argv.includes('--fix');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(url, tries = 4) {
  let wait = 1500;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (res.status !== 503) return res;
    } catch (e) { /* queda de rede: tenta de novo */ }
    await sleep(wait);
    wait *= 2;
  }
  return null;
}

async function firstReleaseYear(mbid) {
  const res = await api(`https://musicbrainz.org/ws/2/release-group/${mbid}?fmt=json`);
  if (!res || !res.ok) return null;
  const json = await res.json().catch(() => null);
  const date = json && json['first-release-date'];
  return date ? parseInt(date.slice(0, 4), 10) : null;
}

/* A busca textual da MusicBrainz pontua bootlegs e coletâneas acima do disco
   original. Ir pela discografia oficial do artista é bem mais preciso. */
async function discografia(album) {
  const nome = album.searchArtist || album.artist;
  const busca = await api('https://musicbrainz.org/ws/2/artist?fmt=json&limit=1&query=' + encodeURIComponent(nome));
  await sleep(1100);
  if (!busca || !busca.ok) return [];
  const j = await busca.json().catch(() => null);
  const artista = j && j.artists && j.artists[0];
  if (!artista) return [];

  const res = await api(`https://musicbrainz.org/ws/2/release-group?fmt=json&limit=100&artist=${artista.id}`);
  await sleep(1100);
  if (!res || !res.ok) return [];
  const lista = await res.json().catch(() => null);
  return ((lista && lista['release-groups']) || []).filter(estudio);
}

/* Tipos secundários que desqualificam um release-group: não é o disco de
   estúdio, e a arte é outra. O caso que ensinou a lista: o mbid de Tapestry
   apontava para um ao vivo de 1971 — ano certo, capa errada. */
const EXTRAS_FORA = ['Live', 'Compilation', 'Remix', 'DJ-mix', 'Demo',
  'Interview', 'Spokenword', 'Audiobook', 'Mixtape/Street', 'Bootleg'];

/* Vale como disco: álbum de estúdio. EP, ao vivo, coletânea e remixes ficam
   de fora — o acervo do jogo é de álbuns, e essas versões trazem outra arte. */
function estudio(g) {
  var tipo = g['primary-type'];
  var extras = g['secondary-types'] || [];
  return tipo === 'Album' &&
    !extras.some(function (t) { return EXTRAS_FORA.indexOf(t) !== -1; });
}

/* Existe na discografia um disco com ESTE título exato e ESTE ano exato? */
async function grupoComAnoExato(album) {
  const titulo = (album.searchTitle || album.title).toLowerCase();
  const lista = await discografia(album);
  const exato = lista.filter(g =>
    g.title.toLowerCase() === titulo &&
    (g['first-release-date'] || '').startsWith(String(album.year))
  );

  for (const g of exato) {
    const capa = await api(`https://coverartarchive.org/release-group/${g.id}/front-500`, 2);
    await sleep(600);
    if (capa && capa.ok) return { id: g.id, date: g['first-release-date'], buffer: Buffer.from(await capa.arrayBuffer()) };
  }
  return null;
}

function mesmoAno(g, album) {
  const ano = parseInt((g['first-release-date'] || '').slice(0, 4), 10);
  return ano && Math.abs(ano - album.year) <= TOLERANCIA;
}

/* procura o release-group do ano certo que tenha capa */
async function melhorCandidato(album) {
  const title = album.searchTitle || album.title;
  const artist = album.searchArtist || album.artist;
  const q = `release:"${title}" AND artist:"${artist}"`;
  const res = await api('https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=15&query=' + encodeURIComponent(q));
  await sleep(1100);
  if (!res || !res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json) return null;

  const grupos = (json['release-groups'] || []).filter(estudio).filter(g => mesmoAno(g, album));

  const titulo = (album.searchTitle || album.title).toLowerCase();
  const doArtista = (await discografia(album)).filter(g => mesmoAno(g, album));

  /* Título exato primeiro. "Hybrid Theory Instrumentals" contém "Hybrid
     Theory" e tem capa parecida, mas não é o disco — variantes assim só
     entram se não houver nada com o nome exato. */
  const exatos = doArtista.filter(g => g.title.toLowerCase() === titulo);
  const parciais = doArtista.filter(g => g.title.toLowerCase() !== titulo &&
    (g.title.toLowerCase().includes(titulo) || titulo.includes(g.title.toLowerCase())));

  for (const g of exatos.concat(grupos, parciais)) {
    const capa = await api(`https://coverartarchive.org/release-group/${g.id}/front-500`, 2);
    await sleep(600);
    if (capa && capa.ok) return { id: g.id, date: g['first-release-date'], buffer: Buffer.from(await capa.arrayBuffer()) };
  }
  return null;
}

let conferidos = 0, ok = 0, corrigidos = 0;
const suspeitos = [];

for (const album of albums) {
  if (!album.mbid) continue;
  const ano = await firstReleaseYear(album.mbid);
  await sleep(1100);
  if (ano === null) continue;
  conferidos++;

  if (ano === album.year) { ok++; continue; }

  /* Um ano de diferença quase sempre é lançamento em outro país — mas é também
     o que acontece quando o mbid é o do disco HOMÔNIMO do ano seguinte (foi o
     caso do Secos & Molhados: a capa vinha do disco de 1974, não da estreia de
     1973). Então a folga de um ano só vale se não existir nada com o ano exato. */
  if (Math.abs(ano - album.year) <= TOLERANCIA) {
    const exato = await grupoComAnoExato(album);
    if (!exato || exato.id === album.mbid) { ok++; continue; }

    console.log(`mbid de ${ano}, mas há "${album.title}" de ${album.year}  —  ${album.artist}`);
    suspeitos.push(album);
    if (fix) {
      album.mbid = exato.id;
      writeFileSync(join(coversDir, album.id + '.jpg'), exato.buffer);
      corrigidos++;
      console.log(`   trocado pelo lançamento de ${exato.date} e capa rebaixada`);
    }
    continue;
  }

  console.log(`mbid de ${ano}, álbum é de ${album.year}  —  ${album.artist} — ${album.title}`);
  suspeitos.push(album);

  if (fix) {
    const melhor = await melhorCandidato(album);
    if (melhor) {
      album.mbid = melhor.id;
      writeFileSync(join(coversDir, album.id + '.jpg'), melhor.buffer);
      corrigidos++;
      console.log(`   corrigido para ${melhor.date} e capa rebaixada`);
    } else {
      console.log('   nenhum release-group do ano certo com capa; mantido como está');
    }
  }
}

if (fix && corrigidos) {
  writeFileSync(dataPath, '[\n' + albums.map(a => JSON.stringify(a)).join(',\n') + '\n]\n', 'utf8');
  console.log('\nJSON atualizado. Rode "npm run build".');
}

console.log(`\nconferidos: ${conferidos} | coerentes: ${ok} | suspeitos: ${suspeitos.length}` +
  (fix ? ` | corrigidos: ${corrigidos}` : ''));
