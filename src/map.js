// Geometrie der Höhle: Der Berg besteht aus 5 × 5 Abschnitten zu je 3 × 3 Feldern.
// Darüber liegt eine Reihe „draußen“ mit dem Höhlenmund. Jeden Tag graben die Kobolde
// einen Abschnitt weiter, und die Hortkammer zieht in den nächsten.
//
// Feldarten (state.tiles):
//   ~ draußen · E Höhlenmund · # Fels · . Gang · n Nische (bebaubar) · l Felsvorsprung (bebaubar)
//   v Goldader · e Durchbruch (Eingang) · h Hortkammer

export const K = 3; // Felder je Abschnitt
export const CW = 5; // Abschnitte nebeneinander
export const CH = 5; // Abschnitte untereinander
export const SKY = 1; // Reihen draußen über dem Berg
export const COLS = CW * K;
export const ROWS = SKY + CH * K;

export const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const DIR_ORDER = ['W', 'S', 'E', 'N'];

export const idx = (c, r) => r * COLS + c;
export const inside = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
export const insideChunk = (cx, cy) => cx >= 0 && cy >= 0 && cx < CW && cy < CH;

// Linke obere Ecke eines Abschnitts in Feldern
export const chunkOrigin = (cx, cy) => ({ c: cx * K, r: SKY + cy * K });
export const chunkOf = (c, r) => ({ cx: Math.floor(c / K), cy: Math.floor((r - SKY) / K) });

// Der Höhlenmund liegt draußen über dem mittleren Abschnitt der obersten Reihe
export const START_CHUNK = { cx: 2, cy: 0 };
export const MOUTH = { c: START_CHUNK.cx * K + 1, r: 0 };

// Feld in der Mitte einer Seite eines Abschnitts (lokal 0..2)
const EDGE = { N: [1, 0], S: [1, 2], E: [2, 1], W: [0, 1] };

export function edgeTile(cx, cy, side) {
  const o = chunkOrigin(cx, cy);
  return { c: o.c + EDGE[side][0], r: o.r + EDGE[side][1] };
}

export function centerTile(cx, cy) {
  const o = chunkOrigin(cx, cy);
  return { c: o.c + 1, r: o.r + 1 };
}

export function chunkTiles(cx, cy) {
  const o = chunkOrigin(cx, cy);
  const out = [];
  for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) out.push({ c: o.c + x, r: o.r + y });
  return out;
}

export const WALKABLE = new Set(['.', 'E', 'e', 'h']);
export const BUILDABLE = new Set(['n', 'l']);

export const tileAt = (tiles, c, r) => (inside(c, r) ? tiles[idx(c, r)] : '#');
export const walkableAt = (tiles, c, r) => WALKABLE.has(tileAt(tiles, c, r));

export function newTiles() {
  const tiles = new Array(COLS * ROWS).fill('#');
  for (let c = 0; c < COLS; c++) tiles[idx(c, 0)] = '~';
  tiles[idx(MOUTH.c, MOUTH.r)] = 'E';
  return tiles;
}
