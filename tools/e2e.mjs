// Browser-Test: spielt in Chromium einen Tag und eine Nacht über die echte Oberfläche
// und speichert Bildschirmfotos. Braucht Playwright (lokal oder global installiert).
//
//   npm run build && npm run e2e [Ordner für Bilder]

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  try {
    playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
  } catch {
    console.error('Playwright fehlt. Installieren mit: npm i -D playwright');
    process.exit(1);
  }
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.resolve(process.argv[2] ?? path.join(root, '.e2e'));
fs.mkdirSync(outDir, { recursive: true });
const url = `${pathToFileURL(path.join(root, 'dist', 'hort.html')).href}#0HORT01`;

const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'handy', width: 390, height: 844, isMobile: true, hasTouch: true },
];

const browser = await playwright.chromium.launch();
let failed = false;

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text());
  });
  const shot = (name) => page.screenshot({ path: path.join(outDir, `${vp.name}-${name}.png`) });
  const tapCell = async (c, r) => {
    const p = await page.evaluate(([c2, r2]) => window.__hort.renderer.cellCenter(c2, r2), [c, r]);
    if (vp.hasTouch) await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
  };
  const phase = () => page.evaluate(() => window.__hort.app.state.phase);

  await page.goto(url);
  await page.waitForFunction(() => window.__hort?.app?.state);
  await page.waitForTimeout(400);
  await shot('1-tag');

  // Bildbreite darf auf dem Handy nicht über den Rand gehen
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) errors.push(`Seite ist ${overflow}px zu breit`);

  if (await page.locator('[data-action="intro-ok"]').count()) await page.click('[data-action="intro-ok"]');
  await page.click('[data-action="raid"][data-id="dorf"]');
  await page.click('[data-action="toggle-loot"][data-i="0"]');
  await page.click('[data-action="toggle-loot"][data-i="1"]');
  await page.click('[data-action="take-loot"]');

  // Beute aus dem Tablett auf freie Felder legen
  for (let k = 0; k < 2; k++) {
    if (!(await page.locator('[data-action="pick-tray"]').count())) break;
    await page.click('[data-action="pick-tray"][data-i="0"]');
    const free = await page.evaluate(() => {
      const { app, Sim } = window.__hort;
      for (let r = 2; r <= 5; r++) for (let c = 3; c <= 8; c++) if (!Sim.itemAt(app.state, c, r)) return { c, r };
      return null;
    });
    await tapCell(free.c, free.r);
  }
  // Ziehen per Maus: die Goldmünzen von (4,2) auf die Münzen bei (5,3) → Verschmelzen
  if (!vp.hasTouch) {
    const a = await page.evaluate(() => window.__hort.renderer.cellCenter(4, 2));
    const b = await page.evaluate(() => window.__hort.renderer.cellCenter(5, 3));
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    const merged = await page.evaluate(() => window.__hort.Sim.itemAt(window.__hort.app.state, 5, 3)?.id);
    if (merged !== 'barren') errors.push(`Verschmelzen per Ziehen hat nicht geklappt (Feld 5,3: ${merged})`);
  }
  await page.waitForTimeout(200);
  await shot('2-hort');

  await page.click('[data-action="start-night"]');
  await page.evaluate(() => { window.__hort.app.view.speed = 2; });
  await page.waitForTimeout(2500);
  // Zuschnappen per Taste 2 und Tippen auf einen Helden
  const hero = await page.evaluate(() => {
    const { app, Sim, renderer } = window.__hort;
    const h = Sim.activeHeroes(app.state).find((x) => Sim.distToDragon(x.x, x.y) <= 4);
    if (!h) return null;
    const rect = document.getElementById('board').getBoundingClientRect();
    const t = renderer.tileSize();
    return { x: rect.left + h.x * t, y: rect.top + (h.y - 0.15) * t };
  });
  if (hero) {
    await page.keyboard.press('2');
    if (vp.hasTouch) await page.touchscreen.tap(hero.x, hero.y);
    else await page.mouse.click(hero.x, hero.y);
  }
  await page.waitForTimeout(300);
  await shot('3-nacht');

  await page.waitForFunction(() => window.__hort.app.state.phase !== 'night', null, { timeout: 90000 });
  await page.waitForTimeout(300);
  await shot(`4-${await phase()}`);
  if ((await phase()) === 'morning') {
    await page.click('[data-action="take-morning"]');
    await page.waitForTimeout(200);
    await shot('5-tag2');
  }

  console.log(`${vp.name}: ${errors.length ? `${errors.length} Fehler` : 'ok'} – Phase am Ende: ${await phase()}`);
  for (const e of errors) console.log(`  · ${e}`);
  if (errors.length) failed = true;
  await page.close();
}

await browser.close();
console.log(`Bilder in ${outDir}`);
process.exit(failed ? 1 : 0);
