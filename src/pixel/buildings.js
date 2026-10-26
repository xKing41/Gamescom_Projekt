// Was die Kobolde bauen und was die Kobolde graben: Türme, Fallen, Köder, Durchbrüche.
// Gezeichnet mit ganzen Pixeln (Rechtecke auf festen Koordinaten), danach bekommt alles eine dunkle Umrandung.
// Türme sind 16 × 20 Pixel groß und stehen unten auf ihrem Feld; Fallen und Durchbrüche füllen ein Feld (16 × 16).

import { pixelize, cached, makeCanvas } from './sprite.js';

const WOOD = ['#d9a066', '#b97d4a', '#7d5230', '#4b3020'];
const IRON = ['#a9b5c8', '#6d788c', '#3c4456', '#1f2430'];
const STONE = ['#c9c1d6', '#9a92ad', '#6f6882', '#45405a'];
const KOBOLD = ['#f2915a', '#c4643a', '#7c3520', '#ffe066'];
const FLAME = ['#fff6c0', '#ffe08a', '#ff9a3c', '#e0531f', '#8a2a1a'];
const GOLD = ['#fff2b0', '#f7d35e', '#e0a42e', '#b8741f', '#6e4216'];
const RUNE = ['#f4e4ff', '#d0a8ff', '#9a62e0', '#5a2e96'];

function painter(g) {
  const R = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  return { R, P };
}

// Ein kleiner Kobold (5 × 7), der den Turm bedient: spitze Ohren, gelbe Augen
function kobold(R, P, x, y, flip = false) {
  const [l, m, d, eye] = KOBOLD;
  const fx = (dx) => (flip ? x + 4 - dx : x + dx);
  // Ohren
  P(fx(0), y, m);
  P(fx(4), y, m);
  P(fx(0), y + 1, l);
  P(fx(4), y + 1, d);
  // Kopf
  for (let dx = 1; dx <= 3; dx++) P(fx(dx), y + 1, dx === 3 ? m : l);
  for (let dx = 0; dx <= 4; dx++) P(fx(dx), y + 2, dx === 4 ? m : l);
  P(fx(1), y + 2, eye);
  P(fx(3), y + 2, eye);
  for (let dx = 1; dx <= 3; dx++) P(fx(dx), y + 3, dx === 3 ? d : m);
  // Körper mit Lederschurz
  for (let dx = 1; dx <= 3; dx++) P(fx(dx), y + 4, dx === 1 ? m : d);
  for (let dx = 1; dx <= 3; dx++) P(fx(dx), y + 5, WOOD[2]);
  P(fx(1), y + 6, d);
  P(fx(3), y + 6, d);
}

// Schwerter für die Ausrüstung: Klinge diagonal von rechts oben nach links unten
function sword(R, P, { blade, edge, guard, grip, pommel, length = 8 }) {
  const x0 = 13;
  const y0 = 2;
  P(x0 + 1, y0 - 1, blade[0]);
  for (let i = 0; i < length; i++) {
    P(x0 - i, y0 + i, blade[0]);
    P(x0 + 1 - i, y0 + i, edge);
  }
  const gx = x0 - length;
  const gy = y0 + length;
  // Parierstange quer zur Klinge
  for (let k = -2; k <= 2; k++) P(gx + k, gy + k, k === 0 ? guard[0] : guard[1]);
  // Griff und Knauf
  P(gx - 1, gy + 1, grip);
  P(gx - 2, gy + 2, grip);
  P(gx - 3, gy + 3, pommel);
  R(gx - 4, gy + 3, 1, 1, pommel);
}

const DRAW = {
  // Speerschleuder: eine Balliste auf einem Dreibein, der Speer zeigt nach oben
  speer(g) {
    const { R, P } = painter(g);
    // Dreibein
    R(4, 16, 1, 3, WOOD[2]);
    R(11, 16, 1, 3, WOOD[3]);
    R(7, 15, 2, 4, WOOD[2]);
    R(5, 15, 6, 1, WOOD[3]);
    // Pfosten und Schaft
    R(7, 9, 2, 6, WOOD[1]);
    P(7, 9, WOOD[0]);
    R(6, 12, 4, 2, WOOD[2]);
    // Bogen
    R(2, 9, 12, 1, WOOD[0]);
    R(2, 10, 12, 1, WOOD[2]);
    R(1, 7, 1, 3, WOOD[1]);
    R(14, 7, 1, 3, WOOD[2]);
    P(1, 6, WOOD[0]);
    P(14, 6, WOOD[1]);
    // Sehne
    for (let x = 2; x <= 6; x++) P(x, 11 - Math.floor((x - 2) / 3), '#e8dcc0');
    for (let x = 9; x <= 13; x++) P(x, 11 - Math.floor((13 - x) / 3), '#cfc6b0');
    // Speer
    R(7, 3, 2, 6, '#e8c89a');
    P(8, 3, '#b9925e');
    R(6, 2, 4, 1, IRON[1]);
    R(7, 1, 2, 1, IRON[0]);
    P(7, 0, '#ffffff');
    P(8, 0, IRON[0]);
    // Kobold rechts daneben
    kobold(R, P, 11, 11, true);
  },
  // Steinwerfer: ein kleines Katapult mit einem Brocken in der Schale
  stein(g) {
    const { R, P } = painter(g);
    // Gestell und Räder
    R(1, 15, 12, 2, WOOD[2]);
    R(1, 15, 12, 1, WOOD[1]);
    R(2, 17, 3, 2, WOOD[3]);
    R(9, 17, 3, 2, WOOD[3]);
    P(3, 17, IRON[1]);
    P(10, 17, IRON[1]);
    // Ständer
    R(8, 10, 2, 5, WOOD[1]);
    P(8, 10, WOOD[0]);
    R(7, 9, 4, 1, WOOD[2]);
    // Wurfarm schräg nach oben
    for (let i = 0; i < 9; i++) {
      const x = 3 + i;
      const y = 14 - i;
      R(x, y, 2, 1, i % 3 === 0 ? WOOD[0] : WOOD[1]);
    }
    // Schale mit Stein
    R(11, 3, 4, 3, WOOD[2]);
    R(11, 5, 4, 1, WOOD[3]);
    R(11, 1, 4, 3, STONE[2]);
    R(12, 1, 2, 1, STONE[0]);
    P(11, 2, STONE[1]);
    P(14, 2, STONE[3]);
    P(14, 3, STONE[3]);
    // Seil
    P(4, 13, '#e8dcc0');
    P(3, 12, '#e8dcc0');
    // Kobold links, zieht am Seil
    kobold(R, P, 0, 7);
  },
  // Feuertopf: ein Eisenkessel auf kurzen Beinen, darüber Flammen
  feuer(g) {
    const { R, P } = painter(g);
    // Flammen
    R(5, 6, 6, 4, FLAME[3]);
    R(5, 5, 6, 3, FLAME[2]);
    R(6, 3, 4, 4, FLAME[2]);
    R(6, 4, 4, 3, FLAME[1]);
    R(7, 2, 2, 3, FLAME[1]);
    R(7, 4, 2, 3, FLAME[0]);
    P(7, 1, FLAME[2]);
    P(4, 7, FLAME[2]);
    P(11, 6, FLAME[3]);
    P(10, 2, FLAME[2]);
    P(5, 3, FLAME[3]);
    // Kessel
    R(2, 10, 12, 2, IRON[1]);
    R(2, 10, 12, 1, IRON[0]);
    R(3, 11, 10, 1, '#1a1018');
    R(3, 12, 10, 4, IRON[2]);
    R(3, 12, 2, 3, IRON[1]);
    R(4, 16, 8, 1, IRON[3]);
    R(11, 12, 2, 4, IRON[3]);
    // Glut am Rand
    P(6, 11, FLAME[2]);
    P(9, 11, FLAME[1]);
    // Beine
    R(4, 17, 1, 2, IRON[3]);
    R(11, 17, 1, 2, IRON[3]);
    R(7, 17, 2, 1, IRON[3]);
  },
  // Fluchstein: ein aufgerichteter Stein mit glimmenden Runen und einem Schädel obenauf
  fluch(g) {
    const { R, P } = painter(g);
    // Stein
    R(4, 5, 8, 13, STONE[2]);
    R(5, 4, 6, 1, STONE[2]);
    R(4, 5, 2, 12, STONE[1]);
    R(5, 4, 1, 2, STONE[0]);
    R(10, 5, 2, 13, STONE[3]);
    R(3, 17, 10, 2, STONE[3]);
    R(3, 17, 3, 1, STONE[2]);
    // Runen
    for (const [x, y] of [[7, 7], [8, 8], [7, 9], [6, 11], [7, 11], [8, 11], [9, 11], [8, 13], [7, 14], [8, 15]]) P(x, y, RUNE[1]);
    P(7, 7, RUNE[0]);
    P(8, 11, RUNE[0]);
    // Schädel
    R(6, 1, 4, 3, '#f4ecda');
    R(6, 3, 4, 1, '#c7bca2');
    P(6, 2, '#2a1f2e');
    P(9, 2, '#2a1f2e');
    P(7, 0, '#f4ecda');
    P(8, 0, '#f4ecda');
    P(7, 2, RUNE[1]);
    P(8, 2, RUNE[1]);
  },

  // ── Fallen (16 × 16, flach auf dem Boden) ──
  baerenfalle(g) {
    const { R, P } = painter(g);
    // Zwei Bügel mit Zähnen, offen
    R(3, 5, 10, 1, IRON[1]);
    R(3, 11, 10, 1, IRON[2]);
    R(2, 6, 1, 5, IRON[1]);
    R(13, 6, 1, 5, IRON[2]);
    for (let x = 3; x <= 12; x += 2) {
      P(x, 6, IRON[0]);
      P(x + 1, 10, IRON[0]);
    }
    // Teller in der Mitte
    R(6, 7, 4, 3, IRON[2]);
    R(7, 8, 2, 1, '#c8323c');
    // Kette
    for (let i = 0; i < 3; i++) P(13 + (i % 2), 12 + i, IRON[1]);
  },
  stacheln(g) {
    const { R, P } = painter(g);
    R(2, 3, 12, 10, '#140d14');
    R(3, 4, 10, 8, '#0b0910');
    R(2, 3, 12, 1, '#2a2236');
    for (const [x, y] of [[4, 6], [7, 5], [10, 6], [5, 9], [8, 8], [11, 9], [6, 11], [9, 11]]) {
      P(x, y, IRON[0]);
      P(x, y + 1, IRON[1]);
      P(x, y + 2, IRON[2]);
    }
  },
  oel(g) {
    const { R, P } = painter(g);
    R(3, 5, 10, 7, '#141018');
    R(2, 7, 12, 3, '#141018');
    R(5, 4, 6, 1, '#141018');
    R(5, 12, 7, 1, '#141018');
    R(4, 6, 3, 1, '#3a3450');
    P(5, 7, '#7a7096');
    P(10, 9, '#4a3a6a');
    P(11, 8, '#2e4a5a');
    P(9, 10, '#5a3a3a');
  },
  steinschlag(g) {
    const { R, P } = painter(g);
    // Lose Brocken in einem Ring, ein Riss im Boden
    for (const [x, y, s] of [[2, 4, 3], [10, 3, 3], [12, 9, 3], [3, 11, 3], [7, 12, 2], [7, 2, 2]]) {
      R(x, y, s, s - 1, STONE[2]);
      P(x, y, STONE[1]);
      R(x + s - 1, y, 1, s - 1, STONE[3]);
    }
    for (const [x, y] of [[6, 6], [7, 7], [8, 7], [9, 8], [8, 9]]) P(x, y, '#0b0910');
  },

  // ── Köder ──
  mimik(g) {
    const { R, P } = painter(g);
    // Truhe mit offenem Maul
    R(1, 7, 14, 7, WOOD[2]);
    R(1, 7, 14, 1, WOOD[1]);
    R(1, 13, 14, 1, WOOD[3]);
    R(1, 2, 14, 4, WOOD[1]);
    R(1, 2, 14, 1, WOOD[0]);
    R(1, 5, 14, 1, WOOD[2]);
    // Beschläge
    R(3, 2, 1, 12, IRON[1]);
    R(12, 2, 1, 12, IRON[2]);
    // Maul
    R(2, 6, 12, 2, '#3a0d12');
    for (let x = 2; x <= 12; x += 2) {
      P(x, 6, '#fff6e8');
      P(x + 1, 7, '#fff6e8');
    }
    R(6, 7, 4, 1, '#c8323c');
    // Augen auf dem Deckel
    P(6, 3, '#ffe066');
    P(9, 3, '#ffe066');
    P(6, 4, '#c8323c');
    P(9, 4, '#c8323c');
  },

  // ── Ausrüstung ──
  klinge(g) {
    const { R, P } = painter(g);
    sword(R, P, { blade: [IRON[0]], edge: IRON[1], guard: [IRON[1], IRON[2]], grip: WOOD[2], pommel: IRON[2] });
  },
  balmung(g) {
    const { R, P } = painter(g);
    sword(R, P, { blade: ['#fffbe8'], edge: GOLD[1], guard: [GOLD[0], GOLD[2]], grip: '#741c2c', pommel: '#ff6b5a', length: 9 });
    P(12, 2, '#ffffff');
    P(9, 6, '#fff2b0');
  },

  // ── Durchbrüche (16 × 16, wo die Kobolde durchgebrochen sind) ──
  brunnen(g) {
    const { R, P } = painter(g);
    // Steinkranz eines Schachts, von oben gesehen
    R(3, 3, 10, 10, STONE[2]);
    R(2, 5, 12, 6, STONE[2]);
    R(5, 2, 6, 12, STONE[2]);
    R(3, 3, 10, 1, STONE[1]);
    R(5, 5, 6, 6, '#06050a');
    R(4, 6, 8, 4, '#06050a');
    R(6, 4, 4, 8, '#06050a');
    // Seil mit Eimer
    R(8, 1, 1, 8, '#cfa54e');
    R(7, 9, 3, 2, WOOD[1]);
    P(7, 9, WOOD[0]);
  },
  zwerge(g) {
    const { R, P } = painter(g);
    // Stollen mit Holzrahmen
    R(3, 3, 10, 13, '#06050a');
    R(2, 2, 2, 14, WOOD[1]);
    R(12, 2, 2, 14, WOOD[2]);
    R(1, 1, 14, 2, WOOD[1]);
    R(1, 1, 14, 1, WOOD[0]);
    P(2, 2, WOOD[0]);
    // Schienen
    R(5, 10, 1, 6, IRON[2]);
    R(10, 10, 1, 6, IRON[2]);
    for (let y = 11; y < 16; y += 2) R(5, y, 6, 1, WOOD[3]);
    // Laterne
    P(11, 4, IRON[1]);
    R(10, 5, 3, 2, '#ffd166');
    P(11, 5, '#fff6c0');
  },
  gruft(g) {
    const { R, P } = painter(g);
    // Steinbogen, dahinter Dunkel, ein Kreuz obenauf
    R(2, 4, 12, 12, STONE[2]);
    R(4, 7, 8, 9, '#06050a');
    R(5, 6, 6, 1, '#06050a');
    R(2, 4, 12, 1, STONE[1]);
    R(2, 4, 2, 12, STONE[1]);
    R(12, 4, 2, 12, STONE[3]);
    for (const [x, y] of [[4, 9], [11, 8], [3, 13], [12, 12]]) P(x, y, STONE[3]);
    // Kreuz
    R(7, 0, 2, 5, STONE[0]);
    R(5, 1, 6, 1, STONE[0]);
    // Kerzenschein
    P(5, 14, '#ffd166');
    P(10, 14, '#ffd166');
  },
};

const SIZE = { speer: [16, 20], stein: [16, 20], feuer: [16, 20], fluch: [16, 20] };

export function buildingImg(id) {
  return cached(`b:${id}`, () => {
    const [w, h] = SIZE[id] ?? [16, 16];
    return pixelize(w, h, DRAW[id]);
  });
}

export const hasBuildingArt = (id) => !!DRAW[id];

// Narrengold: Katzengold, aber heller und weißer
export function narrengoldImg(base) {
  return cached('lure:narrengold', () => {
    const c = makeCanvas(base.width, base.height);
    const g = c.getContext('2d');
    g.drawImage(base, 0, 0);
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      if (d[i] < 40 && d[i + 1] < 40) continue; // Umrandung bleibt
      d[i] = Math.min(255, d[i] * 0.85 + 60);
      d[i + 1] = Math.min(255, d[i + 1] * 0.9 + 50);
      d[i + 2] = Math.min(255, d[i + 2] * 0.7 + 80);
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

export { GOLD };
