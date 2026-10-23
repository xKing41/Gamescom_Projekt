// Zeichnet alle Pixel-Sprites als Übersicht (8-fach vergrößert) und prüft die Raster:
// Jede Zeile muss gleich lang sein, jedes Zeichen braucht eine Farbe. Braucht Playwright.
//
//   node tools/sprites.mjs [Bilddatei]

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
const out = path.resolve(process.argv[2] ?? path.join(root, '.e2e', 'sprites.png'));
fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.route('http://hort.test/**', (route) => {
  const file = path.join(root, new URL(route.request().url()).pathname);
  if (!file.startsWith(root)) return route.abort();
  if (file.endsWith('.html')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Sprites</title><body style="margin:0;background:#120e19"></body>' });
  return route.fulfill({ path: file, contentType: 'text/javascript' });
});
await page.goto('http://hort.test/blank.html');

const result = await page.evaluate(async () => {
  const art = await import('/src/pixel/art.js');
  const { sprite } = await import('/src/pixel/sprite.js');
  const problems = [];
  const groups = [
    ['Schätze', art.TREASURE_ART],
    ['Helden', { ...art.HERO_ART, waechter: art.GUARDIAN_ART }],
    ['Karten', art.CARD_ART],
  ];
  // Raster prüfen
  for (const [, set] of groups) {
    for (const [id, def] of Object.entries(set)) {
      const legend = { ...art.INK, ...(def.legend ?? {}) };
      const w = def.rows[0].length;
      def.rows.forEach((row, y) => {
        if (row.length !== w) problems.push(`${id} Zeile ${y}: Länge ${row.length} statt ${w}`);
        for (const ch of row) if (!(ch in legend)) problems.push(`${id} Zeile ${y}: Zeichen „${ch}“ hat keine Farbe`);
      });
    }
  }
  const Z = 8;
  const pad = 16;
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 1800;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#120e19';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.font = '14px monospace';
  let y = 10;
  for (const [title, set] of groups) {
    ctx.fillStyle = '#f3d98d';
    ctx.fillText(title, 10, y + 14);
    y += 24;
    let x = 10;
    let rowH = 0;
    for (const [id, def] of Object.entries(set)) {
      const img = sprite({ rows: def.rows, legend: { ...art.INK, ...(def.legend ?? {}) } });
      const w = img.width * Z;
      const h = img.height * Z;
      if (x + w > canvas.width - 10) {
        x = 10;
        y += rowH + pad + 18;
        rowH = 0;
      }
      // Kachel-Hintergrund wie in der Höhle, damit man die Lesbarkeit sieht
      ctx.fillStyle = '#2a2236';
      ctx.fillRect(x, y, w, h);
      ctx.drawImage(img, x, y, w, h);
      ctx.fillStyle = '#b5a99b';
      ctx.fillText(id, x, y + h + 14);
      x += w + pad;
      rowH = Math.max(rowH, h);
    }
    y += rowH + pad + 24;
  }
  // Bilder der Atem-Karten
  const { cardImg } = await import('/src/pixel/images.js');
  const { CARDS } = await import('/src/data.js');
  ctx.fillStyle = '#f3d98d';
  ctx.fillText('Atem-Karten', 10, y + 14);
  y += 24;
  CARDS.forEach((card, i) => {
    ctx.fillStyle = '#3a1f16';
    ctx.fillRect(10 + i * 96, y, 80, 80);
    ctx.drawImage(cardImg(card.id), 10 + i * 96, y, 80, 80);
    ctx.fillStyle = '#b5a99b';
    ctx.fillText(card.id, 10 + i * 96, y + 94);
  });
  y += 110;
  // Alle Schätze aus dem Spiel, auch die noch nicht von Hand gezeichneten (automatisch verpixelt)
  const { treasureImg } = await import('/src/pixel/images.js');
  const { TREASURES } = await import('/src/data.js');
  ctx.fillStyle = '#f3d98d';
  ctx.fillText('Alle Schätze im Spiel (ohne Handzeichnung: verpixelt)', 10, y + 14);
  y += 24;
  let tx = 10;
  for (const id of Object.keys(TREASURES)) {
    const img = treasureImg(id);
    if (tx + 16 * 5 > canvas.width - 10) {
      tx = 10;
      y += 16 * 5 + 26;
    }
    ctx.fillStyle = art.TREASURE_ART[id] ? '#2a2236' : '#3a2230';
    ctx.fillRect(tx, y, 80, 80);
    ctx.drawImage(img, tx, y, 80, 80);
    ctx.fillStyle = '#b5a99b';
    ctx.fillText(id, tx, y + 94);
    tx += 96;
  }
  y += 16 * 5 + 34;
  // Drachen: jede Art in Ruhe, wach mit offenen Flügeln und mit offenem Maul
  const { dragonImage } = await import('/src/pixel/dragon.js');
  const { SPECIES } = await import('/src/data.js');
  ctx.fillStyle = '#f3d98d';
  ctx.fillText('Drachen', 10, y + 14);
  y += 24;
  const DZ = 3;
  let dx = 10;
  for (const [id, sp] of Object.entries(SPECIES)) {
    for (const [label, opts] of [['schläft', {}], ['wach', { awake: true, spread: 1 }], ['Maul', { awake: true, spread: 0.5, mouth: true, scars: 10 }]]) {
      const img = dragonImage(sp.palettes[0], opts);
      if (dx + img.width * DZ > canvas.width - 10) {
        dx = 10;
        y += img.height * DZ + 30;
      }
      ctx.fillStyle = '#2a2236';
      ctx.fillRect(dx, y, img.width * DZ, img.height * DZ);
      ctx.drawImage(img, dx, y, img.width * DZ, img.height * DZ);
      ctx.fillStyle = '#b5a99b';
      ctx.fillText(`${id} ${label}`, dx, y + img.height * DZ + 14);
      dx += img.width * DZ + 12;
    }
  }
  return { problems, url: canvas.toDataURL('image/png') };
});

fs.writeFileSync(out, Buffer.from(result.url.split(',')[1], 'base64'));
await browser.close();
for (const p of [...errors, ...result.problems]) console.log(`  · ${p}`);
console.log(`${result.problems.length ? `${result.problems.length} Probleme` : 'Raster in Ordnung'} – Bild: ${out}`);
process.exit(errors.length || result.problems.length ? 1 : 0);
