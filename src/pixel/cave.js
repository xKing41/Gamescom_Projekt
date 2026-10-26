// Die Höhle als Pixel-Bild in 3/4-Ansicht: draußen Gras und der Höhlenmund, drinnen Fels mit sichtbaren Wänden,
// gegrabene Gänge mit Steinboden, Nischen für Türme, Felsvorsprünge, Goldadern und die Hortkammer.
// Wird neu gebaut, sobald die Kobolde gegraben haben. Alles ist aus der Lage der Felder abgeleitet
// und sieht bei gleicher Höhle immer gleich aus.

import { COLS, ROWS, tileAt, MOUTH } from '../map.js';
import { makeCanvas, hexToRgb } from './sprite.js';

export const TS = 16;

export const CAVE = {
  void: '#0b0910',
  r0: '#1a1524',
  r1: '#221c2e',
  r2: '#2b2439',
  r3: '#352c45',
  w0: '#1c1727', // Fuge um bearbeiteten Fels
  w1: '#302943', // bearbeiteter Fels (Nischen)
  w2: '#3a3250',
  w3: '#463d5e',
  f0: '#2c2322',
  f1: '#3a2f2c',
  f2: '#463934',
  f3: '#54453e',
  e1: '#5d4f75',
  e2: '#7a6b95',
  g0: '#3d230f',
  g1: '#5e3a14',
  g2: '#8a5a1c',
  g3: '#b9822a',
  g4: '#e2b444',
  g5: '#fbe38a',
  gr0: '#18261c',
  gr1: '#22352a',
  gr2: '#2d4434',
  gr3: '#3c5a42',
  dirt: '#4a3a2c',
  dirtL: '#5e4a36',
  stair: '#1a1622',
  stairL: '#2c2638',
};

function hash(a, b, k = 0) {
  let h = (a * 374761393 + b * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const FLOOR = new Set(['.', 'h', 'E']);
const SOLID = new Set(['#', 'n', 'l', 'v', 'e']);

export function buildCave(tiles) {
  const W = COLS * TS;
  const H = ROWS * TS;
  const canvas = makeCanvas(W, H);
  const g = canvas.getContext('2d');
  const img = g.createImageData(W, H);
  const d = img.data;
  const rgb = Object.fromEntries(Object.entries(CAVE).map(([k, v]) => [k, hexToRgb(v)]));
  const set = (x, y, col) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    const [r, gg, b] = rgb[col];
    d[i] = r;
    d[i + 1] = gg;
    d[i + 2] = b;
    d[i + 3] = 255;
  };
  const shade = (x, y, k) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    d[i] *= k;
    d[i + 1] *= k;
    d[i + 2] *= k;
  };
  const at = (c, r) => tileAt(tiles, c, r);
  const floorBelow = (c, r) => FLOOR.has(at(c, r + 1));

  // Erst Boden und draußen, dann der Fels darüber – so fallen Schatten und Tropfsteine auf den fertigen Boden
  for (const pass of [0, 1]) for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = at(c, r);
      const x0 = c * TS;
      const y0 = r * TS;
      if (SOLID.has(t) !== (pass === 1)) continue;
      if (t === '~' || t === 'E') {
        // Draußen: Gras, zum Höhlenmund hin ein Trampelpfad
        for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
          const n = hash(x0 + x, y0 + y, 81);
          set(x0 + x, y0 + y, n < 0.15 ? 'gr0' : n > 0.93 ? 'gr3' : n > 0.7 ? 'gr2' : 'gr1');
        }
        const dist = Math.abs(c - MOUTH.c);
        if (dist <= 1) {
          for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
            const px = x0 + x - (MOUTH.c * TS + 8);
            const wPath = 5 + Math.sin((y0 + y) * 0.4) * 1.5;
            if (Math.abs(px) < wPath) set(x0 + x, y0 + y, hash(x0 + x, y0 + y, 82) > 0.8 ? 'dirtL' : 'dirt');
          }
        }
        if (t === 'E') {
          // Stufen hinunter in den Berg
          for (let y = 8; y < TS; y++) for (let x = 3; x < 13; x++) set(x0 + x, y0 + y, y % 3 === 2 ? 'stairL' : y > 13 ? 'void' : 'stair');
        }
        continue;
      }
      if (FLOOR.has(t)) {
        // Steinboden mit Sprenkeln, Fugen und Kieseln
        for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
          const n = hash(x0 + x, y0 + y, 1);
          set(x0 + x, y0 + y, n < 0.12 ? 'f0' : n > 0.95 ? 'f3' : n > 0.8 ? 'f2' : 'f1');
        }
        if (hash(c, r, 2) > 0.35) {
          const yy = Math.floor(hash(c, r, 3) * 12) + 2;
          for (let x = 0; x < TS; x++) if (hash(x0 + x, r, 4) > 0.25) set(x0 + x, y0 + yy, 'f0');
        }
        for (let k = 0; k < 2; k++) {
          if (hash(c, r, 10 + k) < 0.6) continue;
          const x = x0 + 2 + Math.floor(hash(c, r, 12 + k) * 11);
          const y = y0 + 2 + Math.floor(hash(c, r, 14 + k) * 11);
          set(x, y, 'e1');
          set(x + 1, y, 'f3');
          set(x, y + 1, 'f0');
          set(x + 1, y + 1, 'f0');
        }
        if (t === 'h') {
          // Hortkammer: verstreute Münzen, zur Mitte hin dichter
          for (let k = 0; k < 7; k++) {
            if (hash(c, r, 60 + k) < 0.35) continue;
            const x = x0 + 1 + Math.floor(hash(c, r, 70 + k) * 13);
            const y = y0 + 2 + Math.floor(hash(c, r, 80 + k) * 12);
            const bright = hash(c, r, 90 + k);
            set(x, y, bright > 0.7 ? 'g4' : 'g3');
            set(x + 1, y, bright > 0.9 ? 'g5' : 'g2');
            set(x, y + 1, 'g1');
            set(x + 1, y + 1, 'g0');
          }
        }
        continue;
      }
      // Fels: oben die raue Oberseite, wo darunter Boden liegt, eine Wand mit Schichten
      const worked = t === 'n' || t === 'l' || t === 'v' || t === 'e';
      const face = floorBelow(c, r) ? (t === 'l' ? 11 : 9) : 0;
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const px = x0 + x;
        const py = y0 + y;
        const n = hash(px, py, 51);
        if (y >= TS - face) {
          const k = (y - (TS - face)) / face;
          const strata = (py + Math.floor(hash(c, r, 52) * 3)) % 4 === 0;
          const base = k < 0.15 ? 'e2' : k < 0.45 ? 'r3' : k < 0.8 ? 'r2' : 'r1';
          set(px, py, strata && k > 0.15 ? 'r1' : n > 0.9 ? 'r3' : base);
        } else if (t === 'l') {
          // Felsvorsprung: heller, glatter, mit Kante
          set(px, py, y === 0 || x === 0 ? 'e1' : x === TS - 1 ? 'w1' : n < 0.2 ? 'w2' : n > 0.9 ? 'e1' : 'w3');
        } else if (worked) {
          // Bearbeiteter Block: Fuge rundherum, Licht oben links
          const edge = x === 0 || y === 0 || x === TS - 1 || y === TS - face - 1;
          set(px, py, edge ? 'w0' : x === 1 || y === 1 ? 'w3' : n < 0.25 ? 'w1' : n > 0.92 ? 'w3' : 'w2');
        } else {
          set(px, py, n < 0.2 ? 'r0' : n > 0.9 ? 'r2' : n > 0.97 ? 'r3' : 'r1');
        }
      }
      if (!worked && !face) {
        // Risse und Kiesel im unberührten Fels
        if (hash(c, r, 120) > 0.55) {
          let x = x0 + 2 + Math.floor(hash(c, r, 121) * 10);
          let y = y0 + 2 + Math.floor(hash(c, r, 122) * 8);
          for (let i = 0; i < 6; i++) {
            set(x, y, 'r0');
            x += hash(c, r, 130 + i) > 0.5 ? 1 : 0;
            y += 1;
            if (y >= y0 + TS) break;
          }
        }
        for (let k = 0; k < 2; k++) {
          if (hash(c, r, 140 + k) < 0.55) continue;
          const x = x0 + 2 + Math.floor(hash(c, r, 142 + k) * 11);
          const y = y0 + 2 + Math.floor(hash(c, r, 144 + k) * 11);
          set(x, y, 'r3');
          set(x + 1, y, 'r2');
          set(x, y + 1, 'r0');
        }
      }
      // Kanten zum Boden an den Seiten
      for (const [dc, xEdge] of [[-1, 0], [1, TS - 1]]) {
        if (!FLOOR.has(at(c + dc, r))) continue;
        for (let y = 0; y < TS - face; y++) set(x0 + xEdge, y0 + y, worked ? 'e1' : 'r3');
      }
      if (t === 'v') {
        // Goldader: schräge Bänder aus Gold im Fels
        for (let k = 0; k < 3; k++) {
          const sx = Math.floor(hash(c, r, 100 + k) * 10) + 2;
          const sy = Math.floor(hash(c, r, 110 + k) * 4) + 1 + k * 3;
          for (let i = 0; i < 6; i++) {
            const x = x0 + sx + i - 2;
            const y = y0 + sy + Math.floor(i / 2);
            if (y >= y0 + TS - face) break;
            set(x, y, i % 3 === 0 ? 'g4' : 'g3');
            set(x, y + 1, 'g1');
          }
        }
        set(x0 + 5, y0 + 3, 'g5');
        set(x0 + 11, y0 + 8, 'g5');
      }
      // Tropfsteine hängen von Wänden über Gängen
      if (face && !worked && hash(c, r, 53) > 0.55) {
        const x = x0 + 3 + Math.floor(hash(c, r, 54) * 9);
        const len = 2 + Math.floor(hash(c, r, 55) * 3);
        for (let i = 0; i < len; i++) set(x, y0 + TS + i, i === len - 1 ? 'r3' : 'r2');
      }
      // Schatten der Wand auf dem Boden darunter
      if (face) for (let x = 0; x < TS; x++) {
        shade(x0 + x, y0 + TS, 0.55);
        shade(x0 + x, y0 + TS + 1, 0.8);
      }
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}
