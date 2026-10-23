// Pixel-Sprites aus Text: Jede Zeile ist eine Pixelreihe, jedes Zeichen eine Farbe aus der Legende.
// Daraus werden kleine Canvas-Bilder in Originalgröße; vergrößert wird erst beim Zeichnen, ohne Weichzeichnen.

export const OUTLINE = '#140f1c';

const cache = new Map();

export function makeCanvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Halbe Sprites spiegeln: Symmetrische Figuren werden nur links gezeichnet.
// Ist die Breite ungerade, bleibt die mittlere Spalte einfach.
export function mirrorRows(rows, odd = false) {
  return rows.map((row) => row + [...row].reverse().slice(odd ? 1 : 0).join(''));
}

// def: { rows: ['..oo..', ...], legend: { o: '#140f1c', ... } }
// colors: ersetzt Farben der Legende (z. B. Drachenfarben je Art)
export function sprite(def, { colors = null, silhouette = null, key = null } = {}) {
  const id = key ?? null;
  if (id && cache.has(id)) return cache.get(id);
  const rows = def.rows;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const legend = { ...def.legend, ...(colors ?? {}) };
  const rgb = {};
  for (const [ch, hex] of Object.entries(legend)) if (hex) rgb[ch] = hexToRgb(hex);
  const sil = silhouette ? hexToRgb(silhouette) : null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const col = rgb[rows[y][x]];
      if (!col) continue;
      const i = (y * w + x) * 4;
      const [r, gg, b] = sil ?? col;
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (id) cache.set(id, c);
  return c;
}

// Zeichnet mit Canvas-Pfaden in Originalgröße und macht daraus saubere Pixel-Art:
// harte Kanten, nur Farben aus der Rampe, auf Wunsch eine dunkle Umrandung.
export function pixelize(w, h, draw, { ramp, outline = OUTLINE, threshold = 0.45 } = {}) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  draw(g, w, h);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const pal = ramp?.map(hexToRgb) ?? null;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < threshold * 255) {
      d[i + 3] = 0;
      continue;
    }
    // Halbtransparente Kante: Farbe so lesen, als wäre sie deckend
    const a = d[i + 3] / 255;
    let r = d[i] / a;
    let gg = d[i + 1] / a;
    let b = d[i + 2] / a;
    if (pal) {
      let best = pal[0];
      let bestD = Infinity;
      for (const p of pal) {
        const dist = (p[0] - r) ** 2 * 0.3 + (p[1] - gg) ** 2 * 0.59 + (p[2] - b) ** 2 * 0.11;
        if (dist < bestD) {
          bestD = dist;
          best = p;
        }
      }
      [r, gg, b] = best;
    }
    d[i] = r;
    d[i + 1] = gg;
    d[i + 2] = b;
    d[i + 3] = 255;
  }
  if (outline) addOutline(img, w, h, hexToRgb(outline));
  g.putImageData(img, 0, 0);
  return c;
}

// Dunkle Umrandung um alle deckenden Pixel (nur waagerecht und senkrecht, wie in Hand-Pixel-Art)
function addOutline(img, w, h, [r, g, b]) {
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid[y * w + x]) continue;
      const near = (x > 0 && solid[y * w + x - 1]) || (x < w - 1 && solid[y * w + x + 1]) || (y > 0 && solid[(y - 1) * w + x]) || (y < h - 1 && solid[(y + 1) * w + x]);
      if (!near) continue;
      const i = (y * w + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
}

// Gibt eine einfarbige Version zurück (Schattenriss für Unbekanntes im Hortbuch, Trefferblitz)
export function tint(src, color, key = null) {
  if (key && cache.has(key)) return cache.get(key);
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  if (key) cache.set(key, c);
  return c;
}

export function flipX(src, key = null) {
  if (key && cache.has(key)) return cache.get(key);
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  if (key) cache.set(key, c);
  return c;
}

export function cached(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}
