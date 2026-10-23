// Zeichnet das App-Symbol aus den Pixel-Sprites des Spiels (Golddrache über seinem Hort) und speichert es
// als build/icon.png (512 × 512) für die Desktop-Fassung. Braucht Playwright.
//
//   node tools/icon.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const browser = await playwright.chromium.launch();
const page = await browser.newPage();
await page.route('http://hort.test/**', (route) => {
  const file = path.join(root, new URL(route.request().url()).pathname);
  if (!file.startsWith(root)) return route.abort();
  if (file.endsWith('.html')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Symbol</title>' });
  return route.fulfill({ path: file, contentType: 'text/javascript' });
});
await page.goto('http://hort.test/blank.html');

const dataUrl = await page.evaluate(async () => {
  const { dragonImage } = await import('/src/pixel/dragon.js');
  const { treasureImg } = await import('/src/pixel/images.js');
  const { SPECIES } = await import('/src/data.js');
  // Erst in Pixelgröße zusammensetzen (128 × 128), dann scharf auf 512 vergrößern
  const N = 128;
  const small = document.createElement('canvas');
  small.width = N;
  small.height = N;
  const g = small.getContext('2d');
  g.fillStyle = '#120e19';
  g.fillRect(0, 0, N, N);
  // Warmer Schein des Horts
  const glow = g.createRadialGradient(64, 92, 4, 64, 88, 70);
  glow.addColorStop(0, '#6b4316');
  glow.addColorStop(0.5, '#2b1d22');
  glow.addColorStop(1, '#120e19');
  g.fillStyle = glow;
  g.fillRect(0, 0, N, N);
  // Goldhügel
  g.fillStyle = '#5e3a14';
  g.beginPath();
  g.ellipse(64, 122, 60, 24, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#8a5a1c';
  g.beginPath();
  g.ellipse(64, 124, 50, 16, 0, 0, Math.PI * 2);
  g.fill();
  for (const [id, x, y] of [['muenzen', 24, 92], ['kelch', 88, 90], ['krone', 40, 102], ['ei', 56, 94], ['barren', 72, 104]]) g.drawImage(treasureImg(id), x, y);
  g.drawImage(dragonImage(SPECIES.gold.palettes[0], { awake: true, spread: 1 }), 0, 30);
  // Kanten der Pixel hart halten: Alpha wegrunden
  const img = g.getImageData(0, 0, N, N);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
  g.putImageData(img, 0, 0);
  const S = 512;
  const big = document.createElement('canvas');
  big.width = S;
  big.height = S;
  const b = big.getContext('2d');
  // Abgerundete Ecken wie bei App-Symbolen üblich
  const r = 96;
  b.beginPath();
  b.moveTo(r, 0);
  b.arcTo(S, 0, S, S, r);
  b.arcTo(S, S, 0, S, r);
  b.arcTo(0, S, 0, 0, r);
  b.arcTo(0, 0, S, 0, r);
  b.closePath();
  b.clip();
  b.imageSmoothingEnabled = false;
  b.drawImage(small, 0, 0, S, S);
  return big.toDataURL('image/png');
});

fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'icon.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
await browser.close();
console.log('build/icon.png gezeichnet');
