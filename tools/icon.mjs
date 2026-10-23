// Zeichnet das App-Symbol mit dem Code des Spiels (Golddrache auf seinem Hort) und speichert es
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
  const { drawDragon, drawTreasure } = await import('/src/icons.js');
  const { SPECIES } = await import('/src/data.js');
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  // Abgerundete Höhle mit goldenem Schein
  const r = S * 0.2;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(S, 0, S, S, r);
  ctx.arcTo(S, S, 0, S, r);
  ctx.arcTo(0, S, 0, 0, r);
  ctx.arcTo(0, 0, S, 0, r);
  ctx.closePath();
  const bg = ctx.createRadialGradient(S / 2, S * 0.62, S * 0.05, S / 2, S * 0.55, S * 0.62);
  bg.addColorStop(0, '#5a3d1c');
  bg.addColorStop(0.45, '#2b2025');
  bg.addColorStop(1, '#15121a');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Der Hort: ein Goldhügel mit Schätzen darauf
  const mound = ctx.createRadialGradient(S / 2, S * 0.86, S * 0.02, S / 2, S * 0.9, S * 0.36);
  mound.addColorStop(0, '#f3d98d');
  mound.addColorStop(0.5, '#c8922e');
  mound.addColorStop(1, 'rgba(120,70,20,0)');
  ctx.fillStyle = mound;
  ctx.beginPath();
  ctx.ellipse(S / 2, S * 0.9, S * 0.42, S * 0.19, 0, 0, Math.PI * 2);
  ctx.fill();
  const T = S * 0.16;
  for (const [id, x, y, k] of [['muenzen', 0.31, 0.8, 0.9], ['kelch', 0.69, 0.78, 0.95], ['barren', 0.5, 0.74, 1.1], ['ei', 0.5, 0.86, 0.85], ['muenzen', 0.64, 0.9, 0.85], ['krone', 0.36, 0.9, 0.85]]) {
    drawTreasure(ctx, id, S * x, S * y, T * k, 0);
  }
  drawDragon(ctx, S / 2, S * 0.4, S * 0.128, 0.6, { awake: true, spread: 0.7, mouth: 0, shake: 0, palette: SPECIES.gold.palettes[0], scars: 0 });
  ctx.restore();
  return canvas.toDataURL('image/png');
});

fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'icon.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
await browser.close();
console.log('build/icon.png gezeichnet');
