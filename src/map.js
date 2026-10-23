// Die Drachenhöhle als Kachelkarte.
// # Fels · D Drache · H Hortfeld · . Boden · E Eingang
export const MAP = [
  '############',
  '#...DDDD...#',
  '#..HHHHHH..#',
  '#..HHHHHH..#',
  '#..HHHHHH..#',
  '#..HHHHHH..#',
  '#..........#',
  '#.#......#.#',
  '#..........#',
  '#..........#',
  '#####EE#####',
];

export const ROWS = MAP.length;
export const COLS = MAP[0].length;
export const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const idx = (c, r) => r * COLS + c;
export const inside = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
export const kindAt = (c, r) => (inside(c, r) ? MAP[r][c] : '#');
export const isHoardCell = (c, r) => kindAt(c, r) === 'H';

function cellsOf(kind) {
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (MAP[r][c] === kind) out.push({ c, r });
  return out;
}

export const HOARD_CELLS = cellsOf('H');
export const DRAGON_CELLS = cellsOf('D');
export const ENTRANCES = cellsOf('E');

const mean = (values) => values.reduce((s, v) => s + v, 0) / values.length;
export const DRAGON_CENTER = {
  x: mean(DRAGON_CELLS.map((d) => d.c)) + 0.5,
  y: mean(DRAGON_CELLS.map((d) => d.r)) + 0.5,
};

// Hier können sich Zwerge hochgraben: der Hort und der Ring davor
export const DIG_AREA = [];
for (let r = 2; r <= 6; r++) for (let c = 2; c <= 9; c++) if ('.H'.includes(MAP[r][c])) DIG_AREA.push({ c, r });
