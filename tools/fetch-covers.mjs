/* Baixa as capas para assets/covers/<id>.jpg usando MusicBrainz + Cover Art Archive.
 *
 *   node tools/fetch-covers.mjs            baixa só o que falta
 *   node tools/fetch-covers.mjs --force    rebaixa tudo
 *   node tools/fetch-covers.mjs --only pink-floyd-the-wall
 *
 * A MusicBrainz exige User-Agent identificável e ~1 requisição por segundo.
 * Ajuste CONTACT abaixo antes de rodar em volume.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CONTACT = 'capadodia (contato: seu-email@exemplo.com)';
const UA = `CapaDoDia/1.0 ( ${CONTACT} )`;
const MB_DELAY = 1100;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'data/albums.json');
const coversDir = join(root, 'assets/covers');
mkdirSync(coversDir, { recursive: true });

const albums = JSON.parse(readFileSync(dataPath, 'utf8'));
const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* A MusicBrainz devolve 503 quando o IP passou do limite, e a conexão às vezes
   simplesmente cai. Os dois casos merecem nova tentativa com espera crescente. */
async function fetchRetry(url, tries = 4) {
  let wait = 2000;
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (res.status !== 503) return res;
    } catch (e) {
      lastErr = e;                      // queda de rede: tenta de novo
    }
    await sleep(wait);
    wait *= 2;
  }
  if (lastErr) throw lastErr;
  return fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
}

/* Tipos secundários que desqualificam um release-group: não é o disco de
   estúdio, e a arte é outra. O caso que ensinou a lista: o mbid de Tapestry
   apontava para um ao vivo de 1971 — ano certo, capa errada. */
const EXTRAS_FORA = ['Live', 'Compilation', 'Remix', 'DJ-mix', 'Demo',
  'Interview', 'Spokenword', 'Audiobook', 'Mixtape/Street', 'Bootleg'];

/* Vale como disco: álbum de estúdio. EP, ao vivo, coletânea e remixes ficam
   de fora — o acervo do jogo é de álbuns, e essas versões trazem outra arte. */
function estudio(g) {
  const tipo = g['primary-type'];
  const extras = g['secondary-types'] || [];
  return tipo === 'Album' &&
    !extras.some(t => EXTRAS_FORA.includes(t));
}

/* searchTitle/searchArtist são escapes opcionais no JSON, para quando o nome
   usado no jogo não é o que está catalogado na MusicBrainz — títulos com
   anotação ("Cartola (1974)") ou grafias diferentes do artista. */
async function mbSearch(album) {
  const title = album.searchTitle || album.title;
  const artist = album.searchArtist || album.artist;
  const q = `release:"${title}" AND artist:"${artist}"`;
  const url = 'https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=10&query=' + encodeURIComponent(q);
  const res = await fetchRetry(url);
  if (!res.ok) throw new Error(`MusicBrainz HTTP ${res.status}`);
  const json = await res.json();
  const groups = (json['release-groups'] || []).filter(estudio);
  if (!groups.length) return null;

  // com vários homônimos (o caso dos álbuns autointitulados), o ano decide
  const sameYear = groups.find(g => (g['first-release-date'] || '').startsWith(String(album.year)));
  return (sameYear || groups[0]).id;
}

/* A busca textual erra quando o título é genérico ("Blur", "Night Beat") ou
   quando o crédito do artista é diferente. Ir pela discografia oficial acha. */
async function byDiscography(album) {
  const nome = album.searchArtist || album.artist;
  const busca = await fetchRetry('https://musicbrainz.org/ws/2/artist?fmt=json&limit=1&query=' + encodeURIComponent(nome));
  await sleep(MB_DELAY);
  if (!busca.ok) return null;
  const artista = (await busca.json()).artists?.[0];
  if (!artista) return null;

  const res = await fetchRetry(`https://musicbrainz.org/ws/2/release-group?fmt=json&limit=100&artist=${artista.id}`);
  await sleep(MB_DELAY);
  if (!res.ok) return null;

  const titulo = (album.searchTitle || album.title).toLowerCase();
  const grupos = ((await res.json())['release-groups'] || []).filter(estudio).filter(g => {
    const t = g.title.toLowerCase();
    const ano = parseInt((g['first-release-date'] || '').slice(0, 4), 10);
    return (t === titulo || t.includes(titulo)) && ano && Math.abs(ano - album.year) <= 1;
  });
  return grupos.length ? grupos[0].id : null;
}

async function tryCover(kind, mbid, dest) {
  for (const size of ['front-500', 'front-1200', 'front']) {
    const res = await fetchRetry(`https://coverartarchive.org/${kind}/${mbid}/${size}`, 2);
    if (res.ok) {
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return true;
    }
    if (res.status !== 404) await sleep(400);
  }
  return false;
}

/* Muito release-group não tem capa própria no Cover Art Archive, mas algum
   dos seus lançamentos tem. Vale tentar os releases um a um. */
async function releasesOf(groupMbid) {
  const url = `https://musicbrainz.org/ws/2/release?fmt=json&limit=12&release-group=${groupMbid}`;
  const res = await fetchRetry(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.releases || []).map(r => r.id);
}

async function downloadCover(mbid, dest) {
  if (await tryCover('release-group', mbid, dest)) return true;

  await sleep(MB_DELAY);
  for (const releaseId of await releasesOf(mbid)) {
    if (await tryCover('release', releaseId, dest)) return true;
    await sleep(250);
  }
  return false;
}

let ok = 0, skipped = 0, failed = [];

for (const album of albums) {
  if (only && album.id !== only) continue;
  const dest = join(coversDir, album.id + '.jpg');

  if (!force && existsSync(dest)) { skipped++; continue; }

  try {
    let mbid = album.mbid || await mbSearch(album);
    await sleep(MB_DELAY);
    if (!mbid) mbid = await byDiscography(album);
    if (!mbid) { failed.push([album.id, 'não encontrado na MusicBrainz']); continue; }

    album.mbid = mbid;                       // guarda para as próximas rodadas
    let got = await downloadCover(mbid, dest);

    if (!got) {                              // talvez o grupo achado seja o errado
      const alternativo = await byDiscography(album);
      if (alternativo && alternativo !== mbid) {
        got = await downloadCover(alternativo, dest);
        if (got) album.mbid = alternativo;
      }
    }

    if (got) { ok++; console.log(`ok   ${album.id}`); }
    else { failed.push([album.id, 'sem capa no Cover Art Archive']); console.log(`--   ${album.id} (sem capa)`); }
  } catch (e) {
    failed.push([album.id, e.message]);
    console.log(`erro ${album.id}: ${e.message}`);
  }
  await sleep(300);
}

writeFileSync(dataPath, JSON.stringify(albums, null, 0).replace(/^\[/, '[\n').replace(/},{/g, '},\n{').replace(/\]$/, '\n]\n'), 'utf8');

console.log(`\nbaixadas: ${ok} | já existiam: ${skipped} | falharam: ${failed.length}`);
if (failed.length) {
  console.log('\nSem capa automática (baixe manualmente para assets/covers/<id>.jpg):');
  for (const [id, why] of failed) console.log(`  - ${id}: ${why}`);
}
