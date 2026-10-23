// Die fertigen Pixel-Bilder für Höhle und Tafel: Schätze, Helden, Wächter, Drachen.
// Was noch keine Handzeichnung hat, wird aus der alten Vektorzeichnung verpixelt.

import { TREASURES } from '../data.js';
import { drawTreasure, drawHero } from '../icons.js';
import { sprite, pixelize, cached, tint, makeCanvas } from './sprite.js';
import { INK, TREASURE_ART, HERO_ART, GUARDIAN_ART, CARD_ART } from './art.js';
import { dragonImage } from './dragon.js';

const legendOf = (def) => ({ ...INK, ...(def.legend ?? {}) });

export function treasureImg(id) {
  return cached(`t:${id}`, () => {
    const def = TREASURE_ART[id];
    if (def) return sprite({ rows: def.rows, legend: legendOf(def) });
    return pixelize(16, 16, (g) => drawTreasure(g, id, 8, 8, 15, 0));
  });
}

export function heroImg(type) {
  return cached(`h:${type}`, () => {
    const def = HERO_ART[type];
    if (def) return sprite({ rows: def.rows, legend: legendOf(def) });
    return pixelize(16, 20, (g) => drawHero(g, type, 8, 11, 16));
  });
}

export const guardianImg = () => cached('guardian', () => sprite({ rows: GUARDIAN_ART.rows, legend: legendOf(GUARDIAN_ART) }));

// Bilder der Atem-Karten: von Hand gezeichnet oder aus Formen gerastert
const TAU = Math.PI * 2;
const CARD_DRAW = {
  fluegel: [['#b97d4a', '#7d5230', '#c8323c', '#741c2c', '#ecebf2'], (g) => {
    g.fillStyle = '#c8323c';
    g.beginPath();
    g.moveTo(14, 2);
    g.lineTo(3, 6);
    g.quadraticCurveTo(6, 8, 4, 11);
    g.quadraticCurveTo(8, 10, 9, 13);
    g.quadraticCurveTo(11, 10, 14, 11);
    g.closePath();
    g.fill();
    g.strokeStyle = '#b97d4a';
    g.lineWidth = 1.5;
    g.beginPath();
    for (const [x, y] of [[3, 6], [4, 11], [9, 13]]) {
      g.moveTo(14, 2);
      g.lineTo(x, y);
    }
    g.stroke();
    g.strokeStyle = '#ecebf2';
    g.lineWidth = 1.2;
    for (const y of [12.5, 15]) {
      g.beginPath();
      g.moveTo(1, y);
      g.lineTo(6, y);
      g.stroke();
    }
  }],
  bruellen: [['#ffe08a', '#ff9a3c', '#e0531f'], (g) => {
    g.lineWidth = 2;
    for (const [r, col] of [[3.5, '#ffe08a'], [7.5, '#ff9a3c'], [11.5, '#e0531f']]) {
      g.strokeStyle = col;
      g.beginPath();
      g.arc(2, 8, r, -0.95, 0.95);
      g.stroke();
    }
  }],
  rauch: [['#ecebf2', '#b4adc2', '#6f6882'], (g) => {
    g.fillStyle = '#6f6882';
    for (const [x, y, r] of [[5, 10.5, 3.6], [9, 9, 4.6], [12.2, 11, 3.2], [8, 12.4, 3.2]]) {
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#b4adc2';
    for (const [x, y, r] of [[5, 9.5, 2.6], [9, 8, 3.6], [12, 10, 2.2]]) {
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#ecebf2';
    g.beginPath();
    g.arc(8.2, 6.6, 1.8, 0, TAU);
    g.fill();
  }],
  schwanz: [['#f2c94c', '#b97d4a', '#7d5230', '#ecebf2'], (g) => {
    g.strokeStyle = '#b97d4a';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(2, 14);
    g.quadraticCurveTo(4, 5, 11, 4.5);
    g.stroke();
    g.fillStyle = '#7d5230';
    g.beginPath();
    g.moveTo(10, 1.5);
    g.lineTo(15, 4.5);
    g.lineTo(10, 7.5);
    g.closePath();
    g.fill();
    g.strokeStyle = '#ecebf2';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(6, 11, 6.5, -1.9, -0.6);
    g.stroke();
  }],
  glutregen: [['#ffe08a', '#ff9a3c', '#e0531f', '#6f6882'], (g) => {
    g.fillStyle = '#6f6882';
    g.fillRect(2, 1, 12, 3);
    g.fillRect(4, 0, 8, 1);
    for (const [x, y, col] of [[3, 6, '#ffe08a'], [7, 7, '#ff9a3c'], [11, 6, '#e0531f'], [5, 10, '#ff9a3c'], [9, 11, '#ffe08a'], [13, 10, '#ff9a3c'], [3, 13, '#e0531f'], [7, 14, '#ffe08a'], [11, 14, '#e0531f']]) {
      g.fillStyle = col;
      g.fillRect(x, y, 2, 2);
    }
  }],
};

export function cardImg(id) {
  return cached(`card:${id}`, () => {
    const def = CARD_ART[id];
    if (def) return sprite({ rows: def.rows, legend: legendOf(def) });
    const [ramp, draw] = CARD_DRAW[id] ?? [['#ff9a3c'], (g) => g.fillRect(4, 4, 8, 8)];
    return pixelize(16, 16, draw, { ramp });
  });
}

// Typische Lichtfarbe eines Schatzes (für den Schein in der Nacht)
export function treasureLight(id) {
  if (id === 'ei') return [120, 240, 200];
  if (id.startsWith('rubin')) return [255, 90, 110];
  if (id.startsWith('saphir')) return [110, 170, 255];
  if (id === 'stab') return [190, 140, 255];
  return TREASURES[id]?.value > 0 ? [255, 210, 120] : [230, 220, 170];
}

// Kleines Bild für die Tafel: Pixel-Sprite als data-URL, vergrößert wird per CSS (image-rendering: pixelated)
export function iconURL(kind, id, _px, { silhouette = false, palette = null, scars = 0 } = {}) {
  const key = `url:${kind}:${id}:${silhouette ? 1 : 0}:${scars}:${palette?.body?.join() ?? ''}`;
  return cached(key, () => {
    let img;
    if (kind === 't') img = treasureImg(id);
    else if (kind === 'hero') img = heroImg(id);
    else if (kind === 'guardian') img = guardianImg();
    else if (kind === 'card') img = cardImg(id);
    else img = dragonImage(palette, { awake: true, spread: 0.5, scars });
    if (silhouette) img = tint(img, '#4a3f52');
    const c = makeCanvas(img.width, img.height);
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL();
  });
}
