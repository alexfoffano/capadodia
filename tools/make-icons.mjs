/* Gera os ícones do app (PWA, favicon, atalho do iOS).
 *
 *   node tools/make-icons.mjs
 *
 * O desenho é a própria mecânica do jogo: uma capa pixelada em 4x4 blocos,
 * que é exatamente o que a pessoa vê na primeira tentativa. As cores são as
 * do tema — fundo #0e0f12 e o amarelo do accent em dois blocos.
 *
 * Escreve PNG na unha, com zlib, para o projeto não ganhar dependência só
 * por causa de cinco imagens de retângulo chapado.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const FUNDO = [0x0e, 0x0f, 0x12];
const GRADE = [
  '2a1a20', '6e3328', 'a8491f', 'd9762a',
  '4a2328', '9c4423', 'f2c14e', 'c05f1e',
  '6e3328', 'c9752c', 'f2c14e', '8d3f45',
  '241820', '4a2328', '8f4021', '6e3036'
].map(h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);

/* ----------------------------------------------------------------- PNG */

const TABELA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(tipo, dados) {
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tam, corpo, crc]);
}

/* rgb = Buffer de tam*tam*3; devolve o PNG inteiro */
function png(tam, rgb) {
  const linhas = Buffer.alloc(tam * (tam * 3 + 1));
  for (let y = 0; y < tam; y++) {
    linhas[y * (tam * 3 + 1)] = 0;                       // filtro "none"
    rgb.copy(linhas, y * (tam * 3 + 1) + 1, y * tam * 3, (y + 1) * tam * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0);
  ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8;        // bits por canal
  ihdr[9] = 2;        // cor: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(linhas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* --------------------------------------------------------------- desenho */

/* Quanto do pixel (px,py) cai dentro do quadrado de cantos arredondados.
   Amostra 4x4 dentro do pixel: é o suficiente para a borda não serrilhar. */
function cobertura(px, py, off, lado, raio) {
  const A = 4;
  let dentro = 0;
  for (let sy = 0; sy < A; sy++) {
    for (let sx = 0; sx < A; sx++) {
      const x = px + (sx + 0.5) / A - off;
      const y = py + (sy + 0.5) / A - off;
      if (x < 0 || y < 0 || x > lado || y > lado) continue;
      const cx = x < raio ? raio : x > lado - raio ? lado - raio : x;
      const cy = y < raio ? raio : y > lado - raio ? lado - raio : y;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= raio * raio) dentro++;
    }
  }
  return dentro / (A * A);
}

function icone(tam, escala) {
  const rgb = Buffer.alloc(tam * tam * 3);
  const lado = tam * escala;
  const off = (tam - lado) / 2;
  const bloco = lado / 4;
  const raio = lado * 0.14;

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const c = cobertura(x, y, off, lado, raio);
      let cor = FUNDO;
      if (c > 0) {
        /* a amostragem da borda pode marcar um pixel cujo canto inteiro cai
           fora da grade, então os dois índices são presos entre 0 e 3 */
        const col = Math.max(0, Math.min(3, Math.floor((x - off) / bloco)));
        const lin = Math.max(0, Math.min(3, Math.floor((y - off) / bloco)));
        cor = GRADE[lin * 4 + col];
      }
      const i = (y * tam + x) * 3;
      for (let k = 0; k < 3; k++) rgb[i + k] = Math.round(FUNDO[k] * (1 - c) + cor[k] * c);
    }
  }
  return png(tam, rgb);
}

/* ------------------------------------------------------------------ saída */

/* O maskable usa grade menor: o Android recorta o ícone em círculo, losango
   ou squircle conforme o aparelho, e só os 80% centrais são zona segura. */
const saidas = [
  ['assets/icon-192.png', 192, 0.80],
  ['assets/icon-512.png', 512, 0.80],
  ['assets/icon-maskable-512.png', 512, 0.58],
  ['assets/apple-touch-icon.png', 180, 0.84],
  ['assets/favicon-32.png', 32, 0.88]
];

for (const [caminho, tam, escala] of saidas) {
  const buf = icone(tam, escala);
  writeFileSync(join(root, caminho), buf);
  console.log(`${caminho}  ${tam}x${tam}  ${(buf.length / 1024).toFixed(1)} KB`);
}
