// Die fertigen Pixel-Bilder für Höhle und Tafel: Schätze, Ausrüstung, Helden, Bauten, Fähigkeiten, Drachen.
// Was noch keine Handzeichnung hat, wird aus der alten Vektorzeichnung verpixelt.

import { TREASURES, BUILDINGS } from '../data.js';
import { drawTreasure, drawHero } from '../icons.js';
import { sprite, pixelize, cached, tint, makeCanvas } from './sprite.js';
import { INK, TREASURE_ART, HERO_ART, GUARDIAN_ART, CARD_ART } from './art.js';
import { dragonImage } from './dragon.js';
import { buildingImg, hasBuildingArt, narrengoldImg } from './buildings.js';

const legendOf = (def) => ({ ...INK, ...(def.legend ?? {}) });

// Schätze und Ausrüstung (16 × 16)
export function treasureImg(id) {
  return cached(`t:${id}`, () => {
    const def = TREASURE_ART[id];
    if (def) return sprite({ rows: def.rows, legend: legendOf(def) });
    if (id === 'narrengold') return narrengoldImg(treasureImg('katzengold'));
    if (hasBuildingArt(id)) return buildingImg(id);
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

// Was auf einem Bauplan steht und in der Höhle steht: Türme, Fallen, Köder
export function blueprintImg(id) {
  if (id === 'katzengold' || id === 'narrengold') return treasureImg(id);
  return buildingImg(id);
}

export { buildingImg };

// Bilder der Fähigkeiten des Drachen: von Hand gezeichnet oder aus Formen gerastert
const ABILITY_DRAW = {
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
};

export function abilityImg(id) {
  return cached(`ab:${id}`, () => {
    const def = CARD_ART[id];
    if (def) return sprite({ rows: def.rows, legend: legendOf(def) });
    const [ramp, draw] = ABILITY_DRAW[id] ?? [['#ff9a3c'], (g) => g.fillRect(4, 4, 8, 8)];
    return pixelize(16, 16, draw, { ramp });
  });
}

// Typische Lichtfarbe eines Schatzes (für den Schein in der Nacht)
export function treasureLight(id) {
  if (id === 'ei') return [120, 240, 200];
  if (id.startsWith('rubin')) return [255, 90, 110];
  if (id.startsWith('saphir')) return [110, 170, 255];
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
    else if (kind === 'building') img = BUILDINGS[id] ? blueprintImg(id) : buildingImg(id);
    else if (kind === 'ability') img = abilityImg(id);
    else img = dragonImage(palette, { awake: true, spread: 0.5, scars });
    if (silhouette) img = tint(img, '#4a3f52');
    const c = makeCanvas(img.width, img.height);
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL();
  });
}
