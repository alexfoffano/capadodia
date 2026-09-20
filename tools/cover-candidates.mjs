/* Baixa TODAS as capas frontais disponíveis para um álbum e monta uma folha de
 * contato, para escolher a melhor a olho.
 *
 *   node tools/cover-candidates.mjs carole-king-tapestry led-zeppelin-iv
 *   node tools/cover-candidates.mjs --aplicar carole-king-tapestry 3
 *
 * O Cover Art Archive guarda a capa por RELEASE, e o release-group só aponta
 * para uma delas — que às vezes é de um ao vivo, de uma reedição ou a foto que
 * alguém tirou do vinil em cima da mesa. As outras edições costumam ter a arte
 * original, em resolução melhor; esta ferramenta põe todas lado a lado.
 *
 * Os candidatos ficam em .candidatos/<id>/ com um contato.jpg. `--aplicar <id>
 * <n>` copia o candidato n para assets/covers/<id>.jpg.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const UA = 'CapaDoDia/1.0 ( capadodia (contato: seu-email@exemplo.com) )';
const MB_DELAY = 1100;
const CAA_DELAY = 250;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const albums = JSON.parse(readFileSync(join(root, 'data/albums.json'), 'utf8'));
const base = join(root, '.candidatos');

const args = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(url, tries = 4) {
  let wait = 1500;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 404) return null;
      if (r.ok) return r.json();
    } catch (e) { /* rede */ }
    await sleep(wait); wait *= 2;
  }
  return null;
}

/* dimensões do JPEG sem depender de biblioteca */
function tamanho(buf) {
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

async function baixa(url, destino) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 3072) return null;
    writeFileSync(destino, buf);
    return tamanho(buf);
  } catch (e) { return null; }
}

async function candidatos(album) {
  const dir = join(base, album.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  /* o mbid do acervo pode ser de grupo ou de release */
  let grupo = album.mbid;
  const g = await api(`https://musicbrainz.org/ws/2/release-group/${grupo}?fmt=json`);
  if (!g) {
    const rel = await api(`https://musicbrainz.org/ws/2/release/${grupo}?inc=release-groups&fmt=json`);
    grupo = rel && rel['release-group'] && rel['release-group'].id;
    if (!grupo) return [];
    await sleep(MB_DELAY);
  }

  const lista = await api(`https://musicbrainz.org/ws/2/release?release-group=${grupo}&fmt=json&limit=100`);
  const releases = (lista && lista.releases) || [];
  releases.sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));

  const achados = [];
  const vistos = new Set();

  /* a capa que o grupo aponta entra como candidato 1 */
  const arquivos = [{ tipo: 'grupo', id: grupo, data: '' }]
    .concat(releases.map(r => ({ tipo: 'release', id: r.id, data: r.date || '?', pais: r.country || '' })));

  for (const item of arquivos) {
    await sleep(CAA_DELAY);
    const art = await api(`https://coverartarchive.org/${item.tipo === 'grupo' ? 'release-group' : 'release'}/${item.id}`);
    const front = ((art && art.images) || []).find(i => i.front);
    if (!front) continue;
    const chave = String(front.image).split('/').pop();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const n = achados.length + 1;
    const destino = join(dir, String(n).padStart(2, '0') + '.jpg');
    const dim = await baixa(`https://coverartarchive.org/${item.tipo === 'grupo' ? 'release-group' : 'release'}/${item.id}/front-1200`, destino);
    if (!dim) continue;
    achados.push({ n, tipo: item.tipo, data: item.data, pais: item.pais || '', dim, arquivo: destino });
    if (achados.length >= 12) break;
  }
  return { dir, achados };
}

/* folha de contato com os candidatos numerados */
function contato(dir, achados) {
  if (!achados.length) return;
  const norm = join(dir, 'norm');
  mkdirSync(norm, { recursive: true });
  achados.forEach((c, i) => {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', c.arquivo,
      '-vf', 'scale=260:260:force_original_aspect_ratio=increase,crop=260:260,pad=272:272:6:6:0xff2d55',
      '-q:v', '3', join(norm, String(i + 1).padStart(4, '0') + '.jpg'), '-y']);
  });
  const colunas = Math.min(achados.length, 4);
  const linhas = Math.ceil(achados.length / colunas);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-framerate', '25',
    '-start_number', '1', '-i', join(norm, '%04d.jpg'),
    '-vf', `tile=${colunas}x${linhas}`, '-q:v', '3', join(dir, 'contato.jpg'), '-y']);
}

/* ------------------------------------------------------------------ ações */

if (args[0] === '--aplicar') {
  const id = args[1], n = args[2];
  const origem = join(base, id, String(n).padStart(2, '0') + '.jpg');
  if (!existsSync(origem)) throw new Error('candidato não existe: ' + origem);
  copyFileSync(origem, join(root, 'assets/covers', id + '.jpg'));
  console.log(`assets/covers/${id}.jpg <- candidato ${n}`);
} else {
  for (const id of args) {
    const album = albums.find(a => a.id === id);
    if (!album) { console.log('?? ' + id); continue; }
    const { dir, achados } = await candidatos(album);
    contato(dir, achados);
    console.log(`\n${album.artist} — ${album.title} (${album.year})  [${achados.length} candidatos]`);
    for (const c of achados) {
      console.log(`  ${String(c.n).padStart(2)}  ${String(c.dim.w) + 'x' + c.dim.h}`.padEnd(14) +
        `${c.tipo === 'grupo' ? 'capa do grupo' : c.data + ' ' + c.pais}`);
    }
    if (achados.length) console.log('  contato: ' + join(dir, 'contato.jpg'));
    await sleep(MB_DELAY);
  }
}
