// Zeichnet alle Pixel-Sprites als Übersicht (vergrößert) und prüft die Raster:
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
  const images = await import('/src/pixel/images.js');
  const { dragonImage, hoardDragonImage } = await import('/src/pixel/dragon.js');
  const data = await import('/src/data.js');
  const problems = [];
  // Raster der Handzeichnungen prüfen
  for (const set of [art.TREASURE_ART, art.HERO_ART, { waechter: art.GUARDIAN_ART }, art.CARD_ART]) {
    for (const [id, def] of Object.entries(set)) {
      const legend = { ...art.INK, ...(def.legend ?? {}) };
      const w = def.rows[0].length;
      def.rows.forEach((row, y) => {
        if (row.length !== w) problems.push(`${id} Zeile ${y}: Länge ${row.length} statt ${w}`);
        for (const ch of row) if (!(ch in legend)) problems.push(`${id} Zeile ${y}: Zeichen „${ch}“ hat keine Farbe`);
      });
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 1800;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#120e19';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.font = '13px monospace';
  let y = 10;
  const group = (title, entries, Z = 5) => {
    ctx.fillStyle = '#f3d98d';
    ctx.fillText(title, 10, y + 14);
    y += 22;
    let x = 10;
    let rowH = 0;
    for (const [id, img] of entries) {
      const w = img.width * Z;
      const h = img.height * Z;
      if (x + w > canvas.width - 10) {
        x = 10;
        y += rowH + 30;
        rowH = 0;
      }
      ctx.fillStyle = '#2a2236';
      ctx.fillRect(x, y, w, h);
      ctx.drawImage(img, x, y, w, h);
      ctx.fillStyle = '#b5a99b';
      ctx.fillText(id, x, y + h + 13);
      x += Math.max(w, ctx.measureText(id).width) + 14;
      rowH = Math.max(rowH, h);
    }
    y += rowH + 36;
  };
  group('Schätze', Object.keys(data.TREASURES).map((id) => [id, images.treasureImg(id)]));
  group('Ausrüstung', Object.keys(data.GEAR).map((id) => [id, images.treasureImg(id)]));
  group('Helden', [...Object.keys(data.HEROES).map((id) => [id, images.heroImg(id)]), ['waechter', images.guardianImg()]]);
  group('Baupläne', data.BUILDING_ORDER.map((id) => [id, images.blueprintImg(id)]));
  group('Durchbrüche', ['brunnen', 'zwerge', 'gruft'].map((id) => [id, images.buildingImg(id)]));
  group('Fähigkeiten', data.DRAGON.abilities.map((a) => [a.id, images.abilityImg(a.id)]));
  const dragons = [];
  for (const [id, sp] of Object.entries(data.SPECIES)) {
    dragons.push([`${id} schläft`, hoardDragonImage(sp.palettes[0], {})]);
    dragons.push([`${id} wach`, hoardDragonImage(sp.palettes[0], { awake: true, spread: 1, mouth: true })]);
  }
  group('Drache auf dem Hort', dragons, 4);
  group('Drache in der Höhle', Object.entries(data.SPECIES).map(([id, sp]) => [id, dragonImage(sp.palettes[0], { awake: true, spread: 1 })]), 2);
  return { problems, url: canvas.toDataURL('image/png') };
});

fs.writeFileSync(out, Buffer.from(result.url.split(',')[1], 'base64'));
await browser.close();
for (const p of [...errors, ...result.problems]) console.log(`  · ${p}`);
console.log(`${result.problems.length ? `${result.problems.length} Probleme` : 'Raster in Ordnung'} – Bild: ${out}`);
process.exit(errors.length || result.problems.length ? 1 : 0);
