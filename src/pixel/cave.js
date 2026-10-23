// Die Höhle als Pixel-Bild in 3/4-Ansicht: Fels mit sichtbaren Wänden, Steinboden,
// der Goldhaufen des Horts, zwei Säulen, Knochen früherer Helden und der Eingang.
// Wird einmal gebaut; alles ist aus dem Seed der Felder abgeleitet und sieht jedes Mal gleich aus.

import { COLS, ROWS, MAP, kindAt } from '../map.js';
import { makeCanvas, hexToRgb } from './sprite.js';

export const TS = 16;

export const CAVE = {
  void: '#0b0910',
  r0: '#15111d',
  r1: '#1d1827',
  r2: '#262032',
  r3: '#30283e',
  f0: '#2b2338',
  f1: '#352b44',
  f2: '#3f3450',
  f3: '#4c405f',
  e1: '#5d4f75',
  e2: '#7a6b95',
  g0: '#3d230f',
  g1: '#5e3a14',
  g2: '#8a5a1c',
  g3: '#b9822a',
  g4: '#e2b444',
  g5: '#fbe38a',
  bone: '#cfc6b0',
  boneD: '#8a8170',
  stair: '#1a1622',
  stairL: '#2c2638',
};

function hash(a, b, k = 0) {
  let h = (a * 374761393 + b * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const isRock = (c, r) => kindAt(c, r) === '#';

export function buildCave() {
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
  const get = (x, y) => {
    const i = (y * W + x) * 4;
    return [d[i], d[i + 1], d[i + 2]];
  };

  // Boden: Stein mit Sprenkeln, Kieseln und Rissen
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isRock(c, r)) continue;
      for (let y = 0; y < TS; y++) {
        for (let x = 0; x < TS; x++) {
          const n = hash(c * TS + x, r * TS + y, 1);
          set(c * TS + x, r * TS + y, n < 0.12 ? 'f0' : n > 0.95 ? 'f3' : n > 0.8 ? 'f2' : 'f1');
        }
      }
      // Fugen zwischen Steinplatten
      if (hash(c, r, 2) > 0.35) {
        const y0 = Math.floor(hash(c, r, 3) * 12) + 2;
        for (let x = 0; x < TS; x++) if (hash(c * TS + x, r, 4) > 0.25) set(c * TS + x, r * TS + y0, 'f0');
      }
      if (hash(c, r, 5) > 0.5) {
        const x0 = Math.floor(hash(c, r, 6) * 12) + 2;
        for (let y = 0; y < TS; y++) if (hash(c, r * TS + y, 7) > 0.3) set(c * TS + x0, r * TS + y, 'f0');
      }
      // Kiesel
      for (let k = 0; k < 2; k++) {
        if (hash(c, r, 10 + k) < 0.6) continue;
        const x = c * TS + 2 + Math.floor(hash(c, r, 12 + k) * 11);
        const y = r * TS + 2 + Math.floor(hash(c, r, 14 + k) * 11);
        set(x, y, 'e1');
        set(x + 1, y, 'f3');
        set(x, y + 1, 'f0');
        set(x + 1, y + 1, 'f0');
      }
    }
  }

  // Der Hort: Goldmünzen auf dem Boden, dicht in der Mitte, zum Rand hin verstreut
  const hx = 6 * TS;
  const hy = 3.9 * TS;
  // Abstand zum Rand der Hortfelder (0 innen): dort läuft das Gold ungleichmäßig aus
  const HX0 = 3 * TS;
  const HX1 = 9 * TS;
  const HY0 = 2 * TS;
  const HY1 = 6 * TS;
  const edgeDist = (x, y) => Math.hypot(Math.max(HX0 - x, 0, x - HX1 + 1), Math.max(HY0 - y, 0, y - HY1 + 1));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = Math.floor(x / TS);
      const r = Math.floor(y / TS);
      if (isRock(c, r)) continue;
      const n = hash(x, y, 21);
      const e = edgeDist(x, y) + hash(Math.floor(x / 3), Math.floor(y / 3), 22) * 5;
      const pile = Math.max(0, Math.min(1, 1 - e / 9));
      if (n < pile) set(x, y, n < pile * 0.55 ? 'g0' : n < pile * 0.93 ? 'g1' : 'g2');
      else {
        const dx = (x - hx) / (3.6 * TS);
        const dy = (y - hy) / (2.6 * TS);
        const spill = Math.max(0, 1.25 - Math.sqrt(dx * dx + dy * dy)) * 0.9;
        if (hash(x, y, 23) < spill * 0.1) set(x, y, 'g1');
      }
    }
  }
  // Einzelne Münzen: helle Oberseite, dunkle Kante
  for (let k = 0; k < 240; k++) {
    const x = Math.floor(hash(k, 1, 31) * W);
    const y = Math.floor(hash(k, 2, 32) * H);
    const c = Math.floor(x / TS);
    const r = Math.floor(y / TS);
    if (isRock(c, r) || isRock(Math.floor((x + 2) / TS), r)) continue;
    const inHoard = MAP[r][c] === 'H';
    const dx = (x - hx) / (3.6 * TS);
    const dy = (y - hy) / (2.6 * TS);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (!inHoard && hash(k, 3, 33) > Math.max(0, 1.1 - dist) * 0.45) continue;
    const bright = hash(k, 4, 34);
    set(x, y, bright > 0.8 ? 'g4' : 'g3');
    set(x + 1, y, bright > 0.92 ? 'g5' : 'g2');
    set(x + 2, y, 'g1');
    set(x, y + 1, 'g0');
    set(x + 1, y + 1, 'g1');
    set(x + 2, y + 1, 'g0');
  }

  // Knochen früherer Helden auf dem Boden vor dem Hort
  const bones = [[2, 8, 0], [9, 8, 1], [1, 4, 2], [10, 5, 3], [3, 9, 4], [8, 6, 5]];
  for (const [c, r, k] of bones) {
    if (isRock(c, r) || MAP[r][c] === 'H') continue;
    const x = c * TS + 3 + Math.floor(hash(k, 1, 41) * 8);
    const y = r * TS + 4 + Math.floor(hash(k, 2, 42) * 8);
    if (k % 3 === 0) {
      // Schädel
      for (const [ox, oy, col] of [[1, 0, 'bone'], [2, 0, 'bone'], [3, 0, 'bone'], [0, 1, 'bone'], [1, 1, 'r0'], [2, 1, 'bone'], [3, 1, 'r0'], [4, 1, 'boneD'], [0, 2, 'bone'], [1, 2, 'bone'], [2, 2, 'bone'], [3, 2, 'bone'], [4, 2, 'boneD'], [1, 3, 'boneD'], [2, 3, 'r0'], [3, 3, 'boneD']]) set(x + ox, y + oy, col);
    } else {
      // Knochen
      for (let i = 0; i < 6; i++) set(x + i, y + (k % 2 ? i >> 1 : 0), i === 0 || i === 5 ? 'bone' : 'boneD');
      set(x - 1, y - 1, 'bone');
      set(x + 6, y + (k % 2 ? 3 : 1), 'bone');
    }
  }

  // Fels: Oberseite dunkel und rau, wo darunter Boden liegt, eine sichtbare Wand mit Schichten
  const pillar = (c, r) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dc, dr]) => !isRock(c + dc, r + dr));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isRock(c, r)) continue;
      if (pillar(c, r)) {
        drawPillar(c, r);
        continue;
      }
      const below = r + 1 < ROWS && !isRock(c, r + 1);
      const face = below ? 9 : 0; // Höhe der Wand in Pixeln
      for (let y = 0; y < TS; y++) {
        for (let x = 0; x < TS; x++) {
          const px = c * TS + x;
          const py = r * TS + y;
          const n = hash(px, py, 51);
          if (y >= TS - face) {
            // Wand: oben heller, unten dunkler, waagerechte Schichten
            const k = (y - (TS - face)) / face;
            const strata = (py + Math.floor(hash(c, r, 52) * 3)) % 4 === 0;
            const base = k < 0.15 ? 'e2' : k < 0.45 ? 'r3' : k < 0.8 ? 'r2' : 'r1';
            set(px, py, strata && k > 0.15 ? 'r1' : n > 0.9 ? 'r3' : base);
          } else {
            set(px, py, n < 0.25 ? 'r0' : n > 0.92 ? 'r2' : 'r1');
          }
        }
      }
      // Kante zum Boden an den Seiten
      for (const [dc, xEdge] of [[-1, 0], [1, TS - 1]]) {
        if (c + dc < 0 || c + dc >= COLS || isRock(c + dc, r)) continue;
        for (let y = 0; y < TS - face; y++) set(c * TS + xEdge, r * TS + y, 'r3');
      }
      // Tropfsteine hängen von der oberen Wand
      if (below && r === 0 && hash(c, r, 53) > 0.35) {
        const x = c * TS + 3 + Math.floor(hash(c, r, 54) * 9);
        const len = 2 + Math.floor(hash(c, r, 55) * 4);
        for (let i = 0; i < len; i++) set(x, (r + 1) * TS + i, i === len - 1 ? 'r3' : 'r2');
        set(x + 1, (r + 1) * TS, 'r1');
      }
      // Schatten der Wand auf dem Boden darunter
      if (below) for (let x = 0; x < TS; x++) {
        const px = c * TS + x;
        const py = (r + 1) * TS;
        const [rr, gg, bb] = get(px, py);
        const i = (py * W + px) * 4;
        d[i] = rr * 0.55;
        d[i + 1] = gg * 0.55;
        d[i + 2] = bb * 0.55;
      }
    }
  }

  // Ein Tropfstein: runder Fuß, schmaler werdend, Licht von links
  function drawPillar(c, r) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const n = hash(c * TS + x, r * TS + y, 1);
      set(c * TS + x, r * TS + y, n < 0.12 ? 'f0' : n > 0.95 ? 'f3' : 'f1');
    }
    const cx = c * TS + 7.5;
    const top = r * TS - 6;
    const bottom = r * TS + 14;
    for (let y = top; y <= bottom; y++) {
      const k = (y - top) / (bottom - top);
      const half = 1.5 + k * 5.5 + (k > 0.85 ? (k - 0.85) * 12 : 0);
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const side = (x - cx) / half;
        const col = Math.abs(side) > 0.92 || y === top ? 'r0' : side < -0.35 ? 'e1' : side < 0.2 ? 'r3' : side < 0.65 ? 'r2' : 'r1';
        set(x, y, (y + Math.floor(hash(c, x, 56) * 3)) % 5 === 0 && Math.abs(side) < 0.9 ? 'r1' : col);
      }
    }
    // Schatten nach rechts unten
    for (let x = 0; x < 9; x++) set(Math.round(cx) + 3 + x, bottom + 1, 'f0');
  }

  // Eingang: eine Treppe nach draußen
  for (let c = 0; c < COLS; c++) {
    if (kindAt(c, ROWS - 1) !== 'E') continue;
    for (let y = 0; y < TS; y++) {
      for (let x = 0; x < TS; x++) {
        const step = Math.floor(y / 4);
        set(c * TS + x, (ROWS - 1) * TS + y, y % 4 === 0 ? 'stairL' : step > 2 ? 'void' : 'stair');
      }
    }
  }

  g.putImageData(img, 0, 0);
  return canvas;
}
