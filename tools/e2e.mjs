// Browser-Test: spielt in Chromium über die echte Oberfläche – Höhle, Tag, Nacht, Run-Ende,
// Hortbuch, Neuladen mit Spielstand, voll freigeschalteter Stand und ein Hort-Code-Link.
// Speichert Bildschirmfotos. Braucht Playwright (lokal oder global installiert).
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
const url = pathToFileURL(path.join(root, 'dist', 'hort.html')).href;

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
  const check = (ok, message) => {
    if (!ok) errors.push(message);
  };
  const shot = (name) => page.screenshot({ path: path.join(outDir, `${vp.name}-${name}.png`) });
  const tapAt = async (x, y) => (vp.hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const tapCell = async (c, r) => {
    const p = await page.evaluate(([c2, r2]) => window.__hort.renderer.cellCenter(c2, r2), [c, r]);
    await tapAt(p.x, p.y);
  };
  const phase = () => page.evaluate(() => (window.__hort.app.mode === 'hub' ? 'hub' : window.__hort.app.state.phase));
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  // Höhle beim ersten Besuch
  await page.goto(url);
  await page.waitForFunction(() => window.__hort?.app?.state);
  await page.waitForTimeout(400);
  check((await phase()) === 'hub', 'Start nicht in der Höhle');
  check((await overflow()) <= 0, 'Höhle ist zu breit');
  await shot('1-hoehle');

  if (await page.locator('[data-action="intro-ok"]').count()) await page.click('[data-action="intro-ok"]');
  await page.click('[data-action="start-run"]');
  check((await phase()) === 'raid', 'Run startet nicht');

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
      for (let r = 5; r >= 2; r--) for (let c = 3; c <= 8; c++) if (!Sim.itemAt(app.state, c, r)) return { c, r };
      return null;
    });
    await tapCell(free.c, free.r);
  }
  // Ziehen per Maus: Münzen von (4,2) auf die Münzen bei (5,3) → Verschmelzen
  if (!vp.hasTouch) {
    const a = await page.evaluate(() => window.__hort.renderer.cellCenter(4, 2));
    const b = await page.evaluate(() => window.__hort.renderer.cellCenter(5, 3));
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    const merged = await page.evaluate(() => window.__hort.Sim.itemAt(window.__hort.app.state, 5, 3)?.id);
    check(merged === 'barren', `Verschmelzen per Ziehen hat nicht geklappt (Feld 5,3: ${merged})`);
  }
  await page.waitForTimeout(200);
  await shot('2-hort');

  await page.click('[data-action="start-night"]');
  await page.evaluate(() => { window.__hort.app.view.speed = 2; });
  await page.waitForTimeout(2500);
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
    await tapAt(hero.x, hero.y);
  }
  await page.waitForTimeout(300);
  await shot('3-nacht');
  await page.waitForFunction(() => window.__hort.app.state.phase !== 'night', null, { timeout: 90000 });

  // Run beenden und Auswertung prüfen
  await page.evaluate(() => {
    const { app, finishRun } = window.__hort;
    if (app.state.phase !== 'lost') {
      app.state.phase = 'lost';
      app.state.lostBy = 'dieb';
      finishRun();
    }
  });
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !!window.__hort.app.report), 'Kein Bericht nach dem Run');
  check(await page.evaluate(() => window.__hort.store.get().stats.runs === 1), 'Run wurde nicht gezählt');
  check((await page.locator('.rewards').count()) === 1, 'Belohnungen fehlen am Run-Ende');
  await shot('4-ende');

  await page.click('[data-action="to-hub"]');
  check((await phase()) === 'hub', 'Zurück zur Höhle klappt nicht');
  await page.click('[data-action="open-book"]');
  await page.waitForTimeout(200);
  check(await page.evaluate(() => !document.getElementById('book').hidden), 'Hortbuch öffnet nicht');
  await shot('5-hortbuch');
  await page.click('[data-tab="taten"]');
  check((await page.locator('#book-body .entry').count()) >= 8, 'Taten fehlen im Hortbuch');
  await page.click('#btn-book-close');

  // Spielstand übersteht das Neuladen
  await page.reload();
  await page.waitForFunction(() => window.__hort?.app?.state);
  check(await page.evaluate(() => window.__hort.store.get().stats.runs === 1), 'Spielstand nach dem Neuladen verloren');

  // Voll freigeschalteter Stand mit Erzfeinden
  await page.evaluate(() => {
    const { Meta, store, showHub } = window.__hort;
    const p = Meta.newProfile();
    p.introSeen = true;
    p.stats = { runs: 9, wins: 4, nights: 40, defeated: 300 };
    p.species.gold.xp = 260;
    p.species.gold.legend = 3;
    p.species.gold.hatched = 3;
    p.species.kristall = { hatched: 2, xp: 130, legend: 5, variant: 1 };
    p.species.knochen = { hatched: 1, xp: 20, legend: 1, variant: 0 };
    p.unlocks = ['krone', 'saphir', 'baerenfalle', 'glocke', 'narrenkrone', 'steinwaechter', 'karawane', 'turm', 'rauch', 'schwanz', 'glutregen', 'endlos', 'woche'];
    p.deeds = ['brut', 'still', 'schmied'];
    p.loadout = ['feuer', 'schnapp', 'rauch', 'glutregen'];
    p.nemeses = [
      { id: 'n1', name: 'Kunibert Langfinger', type: 'dieb', treasure: 'krone', rank: 2 },
      { id: 'n2', name: 'Gernot Funkenhand', type: 'magier', treasure: 'saphir', rank: 1 },
    ];
    p.trophies = [{ id: 'n0-1', name: 'Hedwig Steinbart', type: 'zwerg', treasure: 'barren', rank: 1, at: 1 }];
    p.seen = { treasures: ['ei', 'muenzen', 'kelch', 'katzengold', 'rubin', 'krone', 'saphir', 'barren'], heroes: ['dieb', 'bauer', 'zwerg', 'magier'] };
    p.choice = { species: 'kristall', legend: 4, mode: 'normal' };
    p.updatedAt = Date.now();
    store.save(p);
    showHub();
  });
  await page.waitForTimeout(300);
  check((await overflow()) <= 0, 'Volle Höhle ist zu breit');
  await shot('6-hoehle-voll');
  await page.evaluate(() => { document.getElementById('panel').scrollTop = 99999; });
  await page.waitForTimeout(150);
  await shot('7-hoehle-voll-unten');

  // Run mit Kristalldrache, Legende 4 und Erzfeinden bis in die zweite Nacht
  await page.click('[data-action="start-run"]');
  const opts = await page.evaluate(() => window.__hort.app.state.opts);
  check(opts.species === 'kristall' && opts.legend === 4 && opts.cards.includes('glutregen'), 'Höhlen-Auswahl kommt nicht im Run an');
  for (let night = 1; night <= 2; night++) {
    const realm = await page.evaluate(() => {
      const r = window.__hort.app.state.realms;
      return r.includes('turm') ? 'turm' : r[0];
    });
    await page.click(`[data-action="raid"][data-id="${realm}"]`);
    await page.click('[data-action="toggle-loot"][data-i="0"]');
    await page.click('[data-action="toggle-loot"][data-i="1"]');
    await page.click('[data-action="take-loot"]');
    if (night === 2) await shot('8-raben');
    await page.click('[data-action="start-night"]');
    await page.evaluate(() => { window.__hort.app.view.speed = 2; });
    await page.waitForTimeout(night === 2 ? 4000 : 500);
    if (night === 2) await shot('9-nacht-kristall');
    await page.waitForFunction(() => window.__hort.app.state.phase !== 'night', null, { timeout: 120000 });
    if ((await phase()) !== 'morning') break;
    await page.click('[data-action="take-morning"]');
  }

  // Hort-Code im Link startet einen Run mit festen Regeln (über eine leere Seite, damit wirklich neu geladen wird)
  await page.goto('about:blank');
  await page.goto(`${url}#0HORT01`);
  await page.waitForFunction(() => window.__hort?.app?.state);
  const codeRun = await page.evaluate(() => ({ phase: window.__hort.app.state.phase, opts: window.__hort.app.state.opts, seed: window.__hort.app.state.seed }));
  check(codeRun.phase === 'raid' && codeRun.opts.mode === 'code' && codeRun.opts.species === 'gold' && codeRun.seed === 1069533073, 'Hort-Code startet keinen Standard-Run');

  console.log(`${vp.name}: ${errors.length ? `${errors.length} Fehler` : 'ok'}`);
  for (const e of errors) console.log(`  · ${e}`);
  if (errors.length) failed = true;
  await page.close();
}

await browser.close();
console.log(`Bilder in ${outDir}`);
process.exit(failed ? 1 : 0);
