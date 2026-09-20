/* Gera data/albums.js e data/extras.js a partir dos .json correspondentes.
   O jogo carrega o .js (e não o .json) para funcionar abrindo o index.html
   direto do disco, sem servidor — fetch() de arquivo local é bloqueado. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const albums = JSON.parse(readFileSync(join(root, 'data/albums.json'), 'utf8'));

const required = ['id', 'title', 'artist', 'artistType', 'country', 'region', 'year', 'genre', 'subgenre', 'label', 'labelGroup'];
const seen = new Set();
const problems = [];

for (const a of albums) {
  for (const f of required) if (a[f] === undefined || a[f] === '') problems.push(`${a.id || '(sem id)'}: campo "${f}" vazio`);
  if (seen.has(a.id)) problems.push(`id duplicado: ${a.id}`);
  seen.add(a.id);
}

if (problems.length) {
  console.error('Problemas na base:\n' + problems.map(p => '  - ' + p).join('\n'));
  process.exit(1);
}

const body = albums.map(a => '  ' + JSON.stringify(a)).join(',\n');
writeFileSync(
  join(root, 'data/albums.js'),
  `/* GERADO por tools/build.mjs — edite data/albums.json e rode: npm run build */\nwindow.ALBUMS = [\n${body}\n];\n`,
  'utf8'
);

/* extras (Spotify, artigo e resumo) ficam num arquivo separado: só a tela de
   resultado usa, e assim o acervo em si continua leve. */
const extrasPath = join(root, 'data/extras.json');
const extras = existsSync(extrasPath) ? JSON.parse(readFileSync(extrasPath, 'utf8')) : {};
const enxuto = {};
for (const a of albums) {
  const e = extras[a.id];
  if (!e) continue;
  const item = {};
  if (e.spotify) item.spotify = e.spotify;
  if (e.wiki && (e.wiki.pt || e.wiki.en)) item.wiki = e.wiki;
  if (e.blurb && (e.blurb.pt || e.blurb.en)) item.blurb = e.blurb;
  if (Object.keys(item).length) enxuto[a.id] = item;
}
writeFileSync(
  join(root, 'data/extras.js'),
  `/* GERADO por tools/build.mjs — vem de data/extras.json (npm run extras).\n` +
  `   Resumos e links de artigo: Wikipédia, CC BY-SA. */\n` +
  `window.EXTRAS = ${JSON.stringify(enxuto)};\n`,
  'utf8'
);

/* calendário congelado: a ordem dos dias de cada versão (tools/calendar.mjs) */
const calendarPath = join(root, 'data/calendar.json');
if (existsSync(calendarPath)) {
  const cal = JSON.parse(readFileSync(calendarPath, 'utf8'));
  const idsValidos = new Set(albums.filter(a => !a.noCover).map(a => a.id));
  const orfaos = [];
  for (const [modo, lista] of Object.entries(cal)) {
    const fora = lista.filter(id => !idsValidos.has(id));
    if (fora.length) orfaos.push(`${modo}: ${fora.length} (${fora.slice(0, 3).join(', ')}…)`);
  }
  writeFileSync(
    join(root, 'data/calendar.js'),
    `/* GERADO por tools/build.mjs — vem de data/calendar.json (npm run calendar).\n` +
    `   Ordem dos dias de cada versão; não edite à mão. */\n` +
    `window.CALENDAR = ${JSON.stringify(cal)};\n`,
    'utf8'
  );
  console.log('data/calendar.js gerado: ' +
    Object.entries(cal).map(([m, l]) => `${m} ${l.length}`).join(', ') + '.');
  if (orfaos.length) {
    console.warn('  aviso — ids no calendário que não estão mais jogáveis: ' + orfaos.join(' | '));
    console.warn('  rode: npm run calendar');
  }
} else {
  console.warn('data/calendar.json não existe — o jogo vai sortear por semente, ' +
    'e o calendário muda toda vez que o acervo muda. Rode: npm run calendar -- --init');
}

const fora = albums.filter(a => a.noCover).length;
console.log(`data/albums.js gerado com ${albums.length} álbuns` +
  (fora ? ` (${fora} sem capa, fora do sorteio diário).` : '.'));

const comExtra = Object.keys(enxuto).length;
console.log(`data/extras.js gerado com ${comExtra} álbum(ns) ` +
  `(${albums.length - comExtra} ainda sem resumo/link — rode: npm run extras).`);
