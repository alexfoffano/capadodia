/* Mantém data/calendar.json — a ordem dos álbuns de cada versão do jogo.
 *
 *   node tools/calendar.mjs --init     cria o arquivo a partir do sorteio atual
 *   node tools/calendar.mjs            encaixa o que mudou no acervo
 *   node tools/calendar.mjs --margem 7 deixa 7 dias intocados em vez de 3
 *   node tools/calendar.mjs --check    só relata, não grava
 *
 * Por que um arquivo em vez de uma conta: o embaralhamento por semente depende
 * do tamanho da lista, então cada álbum novo trocava o disco de TODOS os dias —
 * inclusive o de hoje, apagando a partida de quem estivesse jogando, e fazendo
 * o "nº 261" que alguém compartilhou apontar para outro disco. Com o calendário
 * congelado, o passado fica como está e o que muda é só o futuro.
 *
 * A regra é uma só: nunca mexer num dia que já aconteceu, nem nos próximos
 * dias de margem (o dia vira em fuso local, então quem está no Japão já pode
 * estar jogando o dia seguinte ao daqui).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODES = require(join(root, 'js/modes.js'));

const albumsPath = join(root, 'data/albums.json');
const calendarPath = join(root, 'data/calendar.json');

const albums = JSON.parse(readFileSync(albumsPath, 'utf8'));
const args = process.argv.slice(2);
const init = args.includes('--init');
const check = args.includes('--check');
const margemIdx = args.indexOf('--margem');
const MARGEM = margemIdx !== -1 ? parseInt(args[margemIdx + 1], 10) : 3;

/* A data do dia 1 vem do próprio jogo: duas cópias dessa constante um dia iam
   divergir, e o script escreveria no futuro achando que era o passado. */
const EPOCH = (function () {
  const js = readFileSync(join(root, 'js/game.js'), 'utf8');
  const m = js.match(/epoch:\s*'([\d-]+)'/);
  if (!m) throw new Error('não achei CONFIG.epoch em js/game.js');
  return m[1];
})();

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function diaDeHoje() {
  const start = new Date(EPOCH + 'T00:00:00');
  const now = new Date();
  const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((hoje - start) / 86400000) + 1;
}

function acervoDe(modo) {
  return albums.filter(MODES[modo].filter).filter(a => !a.noCover);
}

/* O mesmo embaralhamento do jogo, para o --init sair idêntico ao calendário
   que está no ar hoje — congelar não pode trocar o álbum de ninguém. */
function ordemPorSemente(modo) {
  const pool = acervoDe(modo);
  const order = pool.map((a, i) => i);
  const rnd = mulberry32(MODES[modo].seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map(i => pool[i].id);
}

/* ------------------------------------------------------------------ ações */

const hoje = diaDeHoje();
/* Índices 0..congelado-1 estão fechados: já foram jogados ou estão perto
   demais. O resto é futuro e pode ser mexido à vontade. */
const congelado = hoje + MARGEM;

function inicializar() {
  const cal = {};
  for (const modo of Object.keys(MODES)) cal[modo] = ordemPorSemente(modo);
  return cal;
}

function reconciliar(cal) {
  const relatorio = [];

  for (const modo of Object.keys(MODES)) {
    const lista = cal[modo] || [];
    const acervo = acervoDe(modo);
    const ids = new Set(acervo.map(a => a.id));
    const naLista = new Set(lista);

    const novos = acervo.filter(a => !naLista.has(a.id)).map(a => a.id);
    const sumidos = lista.filter((id, i) => !ids.has(id) && i >= congelado);
    const sumidosNoPassado = lista.filter((id, i) => !ids.has(id) && i < congelado);

    /* tira do futuro quem saiu do acervo; no passado o id fica, porque aquele
       dia já foi jogado e reescrevê-lo seria mentir sobre o que aconteceu */
    let nova = lista.filter((id, i) => i < congelado || ids.has(id));

    /* e encaixa os novos em posições sorteadas do futuro */
    const rnd = mulberry32(MODES[modo].seed ^ novos.length ^ nova.length);
    for (const id of novos) {
      const vagas = nova.length - congelado;
      const pos = vagas > 0
        ? congelado + Math.floor(rnd() * (vagas + 1))
        : nova.length;
      nova.splice(pos, 0, id);
    }

    cal[modo] = nova;
    relatorio.push({
      modo, entraram: novos, sairam: sumidos, presos: sumidosNoPassado, total: nova.length
    });
  }

  return relatorio;
}

/* ---------------------------------------------------------------- execução */

let cal;
if (init || !existsSync(calendarPath)) {
  if (!init) {
    console.log('data/calendar.json não existe — criando a partir do sorteio atual.');
  }
  cal = inicializar();
  for (const modo of Object.keys(cal)) {
    console.log(`${modo}: ${cal[modo].length} álbuns, dia 1 = ${cal[modo][0]}`);
  }
} else {
  cal = JSON.parse(readFileSync(calendarPath, 'utf8'));
  const relatorio = reconciliar(cal);
  console.log(`hoje é o dia ${hoje}; dias 1 a ${congelado} estão fechados ` +
    `(margem de ${MARGEM}).\n`);
  for (const r of relatorio) {
    console.log(`${r.modo}: ${r.total} álbuns no calendário`);
    if (r.entraram.length) console.log(`  entraram (em dias futuros): ${r.entraram.join(', ')}`);
    if (r.sairam.length) console.log(`  saíram do futuro: ${r.sairam.join(', ')}`);
    if (r.presos.length) {
      console.log(`  ATENÇÃO — saíram do acervo mas já foram jogados: ${r.presos.join(', ')}`);
      console.log('    esses dias ficam sem álbum; devolva-os ao acervo ou aceite que');
      console.log('    o jogo vai cair no sorteio por semente naquele dia.');
    }
    if (!r.entraram.length && !r.sairam.length && !r.presos.length) console.log('  nada mudou');
  }
}

if (check) {
  console.log('\n--check: nada foi gravado.');
} else {
  writeFileSync(calendarPath, JSON.stringify(cal, null, 0) + '\n', 'utf8');
  console.log('\ndata/calendar.json gravado. Rode `npm run build` para gerar o .js.');
}
