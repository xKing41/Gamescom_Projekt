// Browser-Test: spielt in Chromium über die echte Oberfläche – Höhle, Tag, Nacht, Run-Ende,
// Hortbuch, Neuladen mit Spielstand, voll freigeschalteter Stand, Einstellungen und ein Hort-Code-Link.
// Danach einen ganzen Tag und eine Nacht nur mit einem simulierten Controller.
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
  // Am Handy wie in Firefox im Artifact-Rahmen: Controller-Zugriff verboten, das Spiel muss trotzdem laufen
  if (vp.hasTouch) {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => { throw new DOMException('gamepad nicht erlaubt', 'SecurityError'); } });
    });
  }
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

  // Einstellungen: Lautstärke, Stummschalten, gespeichert im Browser
  await page.click('#btn-settings');
  await page.waitForTimeout(150);
  check(await page.evaluate(() => !document.getElementById('settings').hidden), 'Einstellungen öffnen nicht');
  await page.locator('#vol-music').fill('30');
  check(await page.evaluate(() => window.__hort.audio.settings.music === 0.3), 'Musik-Lautstärke wird nicht übernommen');
  check((await overflow()) <= 0, 'Einstellungen sind zu breit');
  await shot('10-einstellungen');
  await page.click('#btn-mute');
  check(await page.evaluate(() => window.__hort.audio.settings.muted === true), 'Stummschalten klappt nicht');
  check(await page.evaluate(() => document.querySelector('#btn-settings path:nth-child(2)')?.getAttribute('d')?.startsWith('M16 9.5')), 'Kopfzeile zeigt Stumm nicht an');
  await page.click('#btn-mute');
  await page.click('#btn-settings-close');
  check(await page.evaluate(() => document.getElementById('settings').hidden), 'Einstellungen schließen nicht');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('hort.audio.v1')).music === 0.3), 'Lautstärke wird nicht gespeichert');
  // Klang in Echtzeit: jedes Geräusch einmal abspielen, ohne Fehler
  const sound = await page.evaluate(async () => {
    const { audio } = window.__hort;
    audio.unlock();
    await new Promise((r) => setTimeout(r, 300));
    if (!audio.running) return 'aus';
    for (const name of ['claw', 'fire', 'roar', 'merge', 'grab', 'nightfall', 'hatch', 'click']) audio.play(name, { pan: 0.2 });
    await new Promise((r) => setTimeout(r, 500));
    return 'an';
  });
  if (vp.name === 'desktop') console.log(`  Ton im Test-Browser: ${sound}`);

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

// ── Controller ──
// Ein simuliertes Xbox-Gamepad ersetzt navigator.getGamepads; alles läuft nur über Tasten.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text());
  });
  const check = (ok, message) => {
    if (!ok) errors.push(message);
  };
  const shot = (name) => page.screenshot({ path: path.join(outDir, `controller-${name}.png`) });
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', index: 0, connected: true, mapping: 'standard', buttons, axes: [0, 0, 0, 0], timestamp: 0 };
    window.__pad = pad;
    Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => [pad, null, null, null] });
  });
  const BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
  const press = async (name) => {
    await page.evaluate((i) => Object.assign(window.__pad.buttons[i], { pressed: true, value: 1 }), BTN[name]);
    await page.waitForTimeout(90);
    await page.evaluate((i) => Object.assign(window.__pad.buttons[i], { pressed: false, value: 0 }), BTN[name]);
    await page.waitForTimeout(90);
  };
  const st = () => page.evaluate(() => {
    const { app } = window.__hort;
    const v = app.view;
    return { mode: app.mode, phase: app.state.phase, input: v.input, card: v.card, held: v.held, cursor: v.cursor, aim: v.aimUid, paused: v.paused, tray: app.state.tray.length, glut: app.state.glut, focus: document.activeElement?.dataset?.action ?? document.activeElement?.id };
  });
  // Rahmen per Steuerkreuz auf ein Feld fahren
  const moveTo = async (c, r) => {
    for (let k = 0; k < 12; k++) {
      const cur = await st();
      const cc = Math.floor(cur.cursor.x);
      const cr = Math.floor(cur.cursor.y);
      if (cc === c && cr === r) return true;
      await press(cc < c ? 'right' : cc > c ? 'left' : cr < r ? 'down' : 'up');
    }
    return false;
  };
  const freeCell = () => page.evaluate(() => {
    const { app, Sim } = window.__hort;
    for (let r = 5; r >= 2; r--) for (let c = 3; c <= 8; c++) if (!Sim.itemAt(app.state, c, r)) return { c, r };
    return null;
  });

  await page.goto(url);
  await page.waitForFunction(() => window.__hort?.app?.state);
  await page.waitForTimeout(300);
  await press('a');
  let s = await st();
  check(s.input === 'pad' && s.mode === 'hub', 'Der erste Druck soll nur den Controller wecken');
  check(s.focus === 'start-run', `Fokus liegt nicht auf dem Startknopf (${s.focus})`);
  await press('back');
  check(await page.evaluate(() => !document.getElementById('help').hidden), 'View öffnet die Regeln nicht');
  await press('b');
  check(await page.evaluate(() => document.getElementById('help').hidden), 'B schließt die Regeln nicht');
  await press('start');
  check(await page.evaluate(() => !document.getElementById('settings').hidden), 'Menü öffnet die Einstellungen nicht');
  const before = await page.evaluate(() => window.__hort.audio.settings.sfx);
  await press('left');
  check(await page.evaluate((b) => window.__hort.audio.settings.sfx < b, before), 'Steuerkreuz verstellt die Lautstärke nicht');
  await shot('1-einstellungen');
  await press('b');
  await shot('2-hoehle');
  // Hortbuch: links neben dem Startknopf, Reiter mit LB/RB wechseln
  await press('left');
  await press('a');
  check(await page.evaluate(() => !document.getElementById('book').hidden), 'A öffnet das Hortbuch nicht');
  await press('rb');
  check(await page.evaluate(() => document.querySelector('#book-tabs .is-on')?.dataset.tab === 'helden'), 'RB wechselt den Reiter im Hortbuch nicht');
  await press('b');
  check(await page.evaluate(() => document.getElementById('book').hidden), 'B schließt das Hortbuch nicht');
  await press('right');
  await press('y');
  check((await st()).phase === 'raid', 'Y startet keinen Run');
  await press('a');
  check((await st()).phase === 'loot', 'A wählt kein Raubziel');
  await press('a');
  await press('down');
  await press('a');
  await press('y');
  s = await st();
  check(s.phase === 'arrange', `Beute mitnehmen per Controller klappt nicht (${s.phase})`);

  // Neue Beute mit RB holen und auf freie Felder legen
  for (let k = 0; k < 2; k++) {
    await press('rb');
    s = await st();
    check(s.held?.where === 'tray', 'RB nimmt keine neue Beute');
    const free = await freeCell();
    check(await moveTo(free.c, free.r), 'Rahmen erreicht das Feld nicht');
    if (k === 0) await shot('3-beute-halten');
    await press('a');
  }
  check((await st()).tray === 0, 'Beute liegt noch im Tablett');

  // Einen Schatz im Hort umlegen
  const coin = await page.evaluate(() => {
    const { app, Sim } = window.__hort;
    for (let r = 2; r <= 5; r++) for (let c = 3; c <= 8; c++) {
      const it = Sim.itemAt(app.state, c, r);
      if (it && it.id !== 'ei') return { c, r, uid: it.uid };
    }
    return null;
  });
  await moveTo(coin.c, coin.r);
  await press('a');
  check((await st()).held?.where === 'hoard', 'A nimmt keinen Schatz auf');
  const target = await freeCell();
  await moveTo(target.c, target.r);
  await press('a');
  const moved = await page.evaluate(([c, r]) => window.__hort.Sim.itemAt(window.__hort.app.state, c, r)?.uid, [target.c, target.r]);
  check(moved === coin.uid, 'Schatz wurde nicht umgelegt');
  await shot('4-hort');

  await press('y');
  check((await st()).phase === 'night', 'Y beginnt die Nacht nicht');

  // Nacht: Feueratem auf den gefährlichsten Helden, dann Zuschnappen
  await page.waitForFunction(() => window.__hort.Sim.activeHeroes(window.__hort.app.state).length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  await press('lb');
  s = await st();
  check(s.card === 'feuer', 'LB wählt den Feueratem nicht');
  const keyLabel = await page.evaluate(() => document.querySelector('#card-feuer kbd')?.textContent);
  check(keyLabel === 'LB', `Karten zeigen nicht die Xbox-Tasten (${keyLabel})`);
  await shot('5-feuer-zielen');
  const glutBefore = s.glut;
  await press('a');
  check((await st()).glut < glutBefore, 'A setzt den Feueratem nicht ein');
  await page.waitForFunction(() => {
    const { app, Sim } = window.__hort;
    return Sim.activeHeroes(app.state).some((h) => Sim.distToDragon(h.x, h.y) <= 3.5) && app.state.glut >= 1;
  }, null, { timeout: 40000 }).catch(() => {});
  await press('rb');
  s = await st();
  if (s.card === 'schnapp' && s.aim != null) {
    await shot('6-schnappen-zielen');
    const g = s.glut;
    await press('a');
    check((await st()).glut < g, 'A schnappt nicht zu');
  } else {
    check(s.card === 'schnapp', 'RB wählt Zuschnappen nicht');
    await press('b');
  }
  await press('start');
  check((await st()).paused === true, 'Menü pausiert die Nacht nicht');
  await press('start');
  check((await st()).paused === false, 'Menü setzt die Nacht nicht fort');

  console.log(`controller: ${errors.length ? `${errors.length} Fehler` : 'ok'}`);
  for (const e of errors) console.log(`  · ${e}`);
  if (errors.length) failed = true;
  await page.close();
}

await browser.close();
console.log(`Bilder in ${outDir}`);
process.exit(failed ? 1 : 0);
