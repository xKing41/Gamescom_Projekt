// Winzige Pixel-Ziffern (3 × 5) für Glanz-Zahlen und Schaden direkt in der Höhle, mit dunklem Rand.

const GLYPHS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
};

export const digitWidth = (text) => [...String(text)].length * 4 - 1;

// Zeichnet Ziffern pixelgenau; (x, y) ist die linke obere Ecke
export function drawDigits(ctx, text, x, y, color, outline = '#140f1c') {
  const chars = [...String(text)];
  const w = digitWidth(text);
  ctx.fillStyle = outline;
  for (let i = 0; i < chars.length; i++) {
    const g = GLYPHS[chars[i]];
    if (!g) continue;
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) {
      if (g[gy][gx] !== '1') continue;
      ctx.fillRect(x + i * 4 + gx - 1, y + gy - 1, 3, 3);
    }
  }
  ctx.fillStyle = color;
  for (let i = 0; i < chars.length; i++) {
    const g = GLYPHS[chars[i]];
    if (!g) continue;
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) if (g[gy][gx] === '1') ctx.fillRect(x + i * 4 + gx, y + gy, 1, 1);
  }
  return w;
}
