// Der Drache in Pixel-Art: Kopf und Klauen von Hand gesetzt, Körper, Flügel und Schwanz
// aus Formen gerastert. Die Farben kommen aus der Palette der Drachenart, damit jede Art
// und jede Farbvariante ohne eigene Zeichnung auskommt.

import { mirror } from './art.js';
import { sprite, pixelize, makeCanvas, hexToRgb, OUTLINE, cached } from './sprite.js';

// Größe des Drachenbilds und wo der Kopf darin sitzt
export const DRAGON_W = 128;
export const DRAGON_H = 56;
export const HEAD_X = 64; // Mitte
export const HEAD_Y = 21; // Oberkante des Kopfes

const HEAD_TOP = [
  '..o..........',
  '..oho........',
  '..ohHo.......',
  '...ohHo......',
  '...ohhHo.....',
  '....ohhHo.ooo',
  '.....ohHoo222',
  '......oo32211',
  '.....o3333321',
];
const EYES_OPEN = [
  '....o3ooo3221',
  '...o3oEpeo221',
  'o.o33oepeo222',
  '.o2333ooo3222',
];
const EYES_SHUT = [
  '....o33333221',
  '...o33ooo3221',
  'o.o3333333222',
  '.o23333333222',
];
const SNOUT = [
  '..o2333332222',
  '...o233322224',
  '....o23322244',
  '.....o2322444',
  '......o22o444',
];
const MOUTH_SHUT = [
  '......ot22444',
  '.......o23444',
  '........o3344',
  '.........oooo',
  '.............',
  '.............',
];
const MOUTH_OPEN = [
  '......ototot4',
  '.......ommmff',
  '.......ommfff',
  '........otmff',
  '........o3344',
  '.........oooo',
];

// Narben der Legende: helle Striche auf Braue, Wange und Schnauze
const SCARS = [
  [1, [[6, 7], [7, 8], [8, 9]]],
  [3, [[17, 12], [18, 13], [19, 14]]],
  [6, [[10, 15], [11, 16], [12, 16], [13, 16], [14, 17]]],
  [9, [[4, 11], [5, 12], [20, 8], [21, 9]]],
];

const CLAW = [
  '...ooooo....',
  '..o22111o...',
  '.o2222111o..',
  'o222221111o.',
  'o22o22o211o.',
  'o23o23o22o..',
  'otoottoottoo',
  '.t..t..t..t.',
];

const mix = (a, b, k) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
};

function colorsOf(pal) {
  const outline = mix(OUTLINE, pal.body[2], 0.3);
  return {
    o: outline,
    p: outline,
    1: pal.body[0],
    2: pal.body[1],
    3: pal.body[2],
    4: pal.head[0],
    5: pal.head[1],
    h: pal.horn,
    H: mix(pal.horn, pal.body[2], 0.45),
    e: pal.eye,
    E: '#fffbe8',
    t: '#fff6e8',
    m: '#3a0d12',
    f: '#ffb347',
    s: '#f4d6c8',
  };
}

function headRows({ awake, mouth, scars }) {
  const half = [...HEAD_TOP, ...(awake ? EYES_OPEN : EYES_SHUT), ...SNOUT, ...(mouth ? MOUTH_OPEN : MOUTH_SHUT)];
  const grid = mirror(half, { shade: false }).map((r) => [...r]);
  for (const [level, pts] of SCARS) {
    if (scars < level) continue;
    for (const [x, y] of pts) if (grid[y]?.[x] && !'.oEep'.includes(grid[y][x])) grid[y][x] = 's';
  }
  return grid.map((r) => r.join(''));
}

// Flügel als Fläche zwischen Knochen: spread 0 = angelegt, 1 = weit offen
function wing(pal, spread) {
  const lerp = (a, b) => a + (b - a) * spread;
  const S = [48, 17];
  const J = [lerp(40, 22), lerp(10, 3)];
  const tips = [
    [lerp(34, 2), lerp(22, 9)],
    [lerp(38, 7), lerp(30, 26)],
    [lerp(44, 22), lerp(33, 36)],
  ];
  const back = [46, 28];
  return pixelize(DRAGON_W / 2, DRAGON_H, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, DRAGON_H);
    grad.addColorStop(0, pal.wing[0]);
    grad.addColorStop(1, pal.wing[1]);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(...S);
    g.lineTo(...J);
    g.lineTo(...tips[0]);
    // Zwischen den Fingern buchtet die Haut nach innen
    for (let i = 1; i < tips.length; i++) {
      const a = tips[i - 1];
      const b = tips[i];
      g.quadraticCurveTo((a[0] + b[0]) / 2 + (J[0] - (a[0] + b[0]) / 2) * 0.35, (a[1] + b[1]) / 2 + (J[1] - (a[1] + b[1]) / 2) * 0.35, ...b);
    }
    g.quadraticCurveTo((tips[2][0] + back[0]) / 2, (tips[2][1] + back[1]) / 2 - 2, ...back);
    g.closePath();
    g.fill();
    g.strokeStyle = pal.wing[2];
    g.lineWidth = 2;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(...S);
    g.lineTo(...J);
    for (const t of tips) {
      g.moveTo(...J);
      g.lineTo(...t);
    }
    g.stroke();
    g.fillStyle = pal.wing[3];
    g.beginPath();
    g.arc(J[0], J[1], 1.6, 0, Math.PI * 2);
    g.fill();
  }, { ramp: [pal.wing[0], pal.wing[1], pal.wing[2], pal.wing[3]], outline: mix(OUTLINE, pal.wing[1], 0.3) });
}

function body(pal) {
  return pixelize(DRAGON_W, DRAGON_H, (g) => {
    // Schwanz: hinter dem Körper rechts herum, mit Spitze
    g.strokeStyle = pal.body[1];
    g.lineCap = 'round';
    for (const [w, a] of [[6, 0], [4, 0.45], [3, 0.8]]) {
      g.lineWidth = w;
      g.beginPath();
      const t0 = a;
      const pt = (t) => {
        const u = 1 - t;
        return [u * u * u * 82 + 3 * u * u * t * 114 + 3 * u * t * t * 122 + t * t * t * 106, u * u * u * 24 + 3 * u * u * t * 22 + 3 * u * t * t * 46 + t * t * t * 49];
      };
      const [x0, y0] = pt(t0);
      g.moveTo(x0, y0);
      for (let t = t0; t <= 1.001; t += 0.05) g.lineTo(...pt(Math.min(1, t)));
      g.stroke();
    }
    g.fillStyle = pal.body[2];
    g.beginPath();
    g.moveTo(106, 46);
    g.lineTo(98, 53);
    g.lineTo(108, 54);
    g.closePath();
    g.fill();
    // Rumpf: breite Schultern, Licht von oben
    const grad = g.createLinearGradient(0, 8, 0, 38);
    grad.addColorStop(0, pal.body[0]);
    grad.addColorStop(0.45, pal.body[1]);
    grad.addColorStop(1, pal.body[2]);
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(64, 21, 25, 11, 0, 0, Math.PI * 2);
    g.fill();
    // Rückenzacken
    g.fillStyle = pal.body[2];
    for (const x of [52, 58, 64, 70, 76]) {
      g.beginPath();
      g.moveTo(x - 2.5, 12 + Math.abs(x - 64) * 0.12);
      g.lineTo(x, 7 + Math.abs(x - 64) * 0.18);
      g.lineTo(x + 2.5, 12 + Math.abs(x - 64) * 0.12);
      g.closePath();
      g.fill();
    }
    // Hals und Brust mit Bauchplatten
    g.fillStyle = pal.body[1];
    g.beginPath();
    g.ellipse(64, 30, 12, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = pal.head[0];
    g.beginPath();
    g.ellipse(64, 37, 9, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = pal.head[1];
    g.lineWidth = 1;
    for (const y of [35.5, 38.5, 41.5]) {
      g.beginPath();
      g.moveTo(56, y);
      g.lineTo(72, y);
      g.stroke();
    }
  }, { ramp: [pal.body[0], pal.body[1], pal.body[2], pal.head[0], pal.head[1]], outline: mix(OUTLINE, pal.body[2], 0.3) });
}

// Das ganze Drachenbild für einen Zustand, zwischengespeichert
export function dragonImage(pal, { awake = false, spread = 0, mouth = false, scars = 0 } = {}) {
  const s = Math.round(spread * 4) / 4;
  const key = `dragon:${pal.body.join()}:${awake ? 1 : 0}:${s}:${mouth ? 1 : 0}:${Math.min(scars, 10)}`;
  return cached(key, () => {
    const c = makeCanvas(DRAGON_W, DRAGON_H);
    const g = c.getContext('2d');
    const w = cached(`wing:${pal.wing.join()}:${s}`, () => wing(pal, s));
    g.drawImage(w, 0, 0);
    g.save();
    g.translate(DRAGON_W, 0);
    g.scale(-1, 1);
    g.drawImage(w, 0, 0);
    g.restore();
    g.drawImage(cached(`body:${pal.body.join()}:${pal.head.join()}`, () => body(pal)), 0, 0);
    const colors = colorsOf(pal);
    const claw = sprite({ rows: CLAW, legend: {} }, { colors });
    g.drawImage(claw, 37, 39);
    g.save();
    g.translate(DRAGON_W, 0);
    g.scale(-1, 1);
    g.drawImage(claw, 37, 39);
    g.restore();
    const head = sprite({ rows: headRows({ awake, mouth, scars }), legend: {} }, { colors });
    g.drawImage(head, HEAD_X - head.width / 2, HEAD_Y);
    return c;
  });
}
