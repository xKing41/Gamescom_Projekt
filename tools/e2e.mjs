// Browser-Test: spielt in Chromium über die echte Oberfläche – Höhle, Graben, Bauen, Turm-Baum, Nacht, Morgen,
// Run-Ende, Hortbuch, Neuladen mit Spielstand, voller Stand mit Werkstatt und Deck, Einstellungen und ein Hort-Code-Link.
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

// Ein gültiger Platz für einen Bauplan, am liebsten nah an der Hortkammer
const spotFor = (page, id) => page.evaluate((bid) => {
  const { app, Sim } = window.__hort;
  const s = app.state;
  const c0 = Sim.chamberCenter(s);
  let best = null;
  for (let r = 1; r < 16; r++) for (let c = 0; c < 15; c++) {
    if (!Sim.canPlace(s, bid, c, r).ok) continue;
    const d = Math.abs(c - c0.c) + Math.abs(r - c0.r);
    if (!best || d < best.d) best = { c, r, d };
  }
  return best;
}, id);

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
  check((await phase()) === 'dig', 'Run startet nicht mit dem Graben');

  // Graben: Richtung in der Höhle antippen, Stück in der Tafel wählen, graben
  const target = await page.evaluate(() => {
    const { app, Sim } = window.__hort;
    const d = Sim.digDirections(app.state)[0];
    return { c: d.cx * 3 + 1, r: 1 + d.cy * 3 + 1, dir: d.dir };
  });
  await tapCell(target.c, target.r);
  check(await page.evaluate((dir) => window.__hort.app.view.dig?.dir === dir, target.dir), 'Antippen eines Abschnitts wählt keine Richtung');
  await page.click(`[data-action="dig-dir"][data-i="1"][data-dir="${target.dir}"]`);
  await page.waitForTimeout(200);
  await shot('2-graben');
  const depthBefore = await page.evaluate(() => window.__hort.app.state.pieces.length);
  await page.click('[data-action="dig"]');
  check((await phase()) === 'build', 'Nach dem Graben geht es nicht ans Bauen');
  check(await page.evaluate((n) => window.__hort.app.state.pieces.length === n + 1, depthBefore), 'Es wurde kein Stück gegraben');

  // Bauen: einen bezahlbaren Bauplan wählen und in der Höhle platzieren
  await page.evaluate(() => { window.__hort.app.state.gold = 200; window.__hort.app.act('deselect'); });
  const handIndex = await page.evaluate(() => {
    const hand = window.__hort.app.state.deck.hand;
    const i = hand.findIndex((id) => ['speer', 'stein', 'feuer', 'fluch'].includes(id));
    return i >= 0 ? i : 0;
  });
  const cardId = await page.evaluate((i) => window.__hort.app.state.deck.hand[i], handIndex);
  await page.click(`[data-action="card"][data-i="${handIndex}"]`);
  check(await page.evaluate((i) => window.__hort.app.view.card === i, handIndex), 'Bauplan lässt sich nicht wählen');
  const spot = await spotFor(page, cardId);
  await tapCell(spot.c, spot.r);
  const built = await page.evaluate(([c, r]) => window.__hort.Sim.buildingAt(window.__hort.app.state, c, r), [spot.c, spot.r]);
  check(built?.id === cardId, `${cardId} wurde nicht gebaut`);
  await page.waitForTimeout(200);
  await shot('3-bauen');

  // Turm antippen, eine Stufe schenken, einen Knoten lernen
  if (built?.kind === 'tower') {
    await tapCell(spot.c, spot.r);
    check(await page.evaluate(() => window.__hort.app.view.selected != null), 'Antippen wählt den Turm nicht');
    await page.evaluate(() => {
      const { app, Sim } = window.__hort;
      const b = Sim.buildingByUid(app.state, app.view.selected);
      b.level = 2;
      b.xp = 45;
      app.act('deselect');
      app.act('select', { uid: b.uid });
    });
    await page.click('[data-action="node"][data-id="A1"]');
    await page.click('[data-action="learn"]');
    check(await page.evaluate(() => {
      const { app, Sim } = window.__hort;
      return Sim.buildingByUid(app.state, app.view.selected).nodes.includes('A1');
    }), 'Knoten wurde nicht gelernt');
    await page.waitForTimeout(150);
    await shot('4-turm');
    await page.click('[data-action="deselect"]');
  }
  check((await overflow()) <= 0, 'Bauen ist zu breit');

  // Nacht: Feueratem per Taste und Antippen
  await page.click('[data-action="start-night"]');
  check((await phase()) === 'night', 'Nacht beginnt nicht');
  await page.evaluate(() => { window.__hort.app.view.speed = 2; });
  await page.waitForFunction(() => window.__hort.Sim.activeHeroes(window.__hort.app.state).length > 0, null, { timeout: 20000 });
  const hero = await page.evaluate(() => {
    const h = window.__hort.Sim.activeHeroes(window.__hort.app.state)[0];
    return { c: Math.floor(h.x), r: Math.floor(h.y) };
  });
  if (vp.hasTouch) await page.click('[data-action="ability"][data-id="feuer"]');
  else await page.keyboard.press('1');
  check(await page.evaluate(() => window.__hort.app.view.ability === 'feuer'), 'Feueratem lässt sich nicht wählen');
  await tapCell(hero.c, hero.r);
  check(await page.evaluate(() => window.__hort.app.state.dragon.cd.feuer > 0), 'Feueratem wurde nicht eingesetzt');
  await page.waitForTimeout(300);
  await shot('5-nacht');
  await page.waitForFunction(() => window.__hort.app.state.phase !== 'night', null, { timeout: 120000 });
  await page.waitForTimeout(300);
  if ((await phase()) === 'morning') {
    await shot('6-morgen');
    await page.click('[data-action="next-day"]');
    check((await phase()) === 'dig', 'Nach dem Morgen kommt kein neuer Tag');
  }

  // Run beenden und Auswertung prüfen
  await page.evaluate(() => {
    const { app } = window.__hort;
    app.state.phase = 'lost';
    app.state.lostBy = 'dieb';
    app.state.glut = 33;
  });
  await page.waitForFunction(() => !!window.__hort.app.report);
  check(await page.evaluate(() => window.__hort.store.get().stats.runs === 1), 'Run wurde nicht gezählt');
  check((await page.locator('.rewards').count()) === 1, 'Belohnungen fehlen am Run-Ende');
  check(await page.evaluate(() => window.__hort.store.get().nemeses.some((n) => n.glut === 33)), 'Der Dieb trägt die Glut nicht fort');
  await shot('7-ende');

  await page.click('[data-action="to-hub"]');
  check((await phase()) === 'hub', 'Zurück zur Höhle klappt nicht');
  await page.click('[data-action="open-book"]');
  await page.waitForTimeout(200);
  check(await page.evaluate(() => !document.getElementById('book').hidden), 'Hortbuch öffnet nicht');
  await shot('8-hortbuch');
  await page.click('[data-tab="taten"]');
  check((await page.locator('#book-body .entry').count()) >= 9, 'Taten fehlen im Hortbuch');
  await page.click('#btn-book-close');

  // Spielstand übersteht das Neuladen
  await page.reload();
  await page.waitForFunction(() => window.__hort?.app?.state);
  check(await page.evaluate(() => window.__hort.store.get().stats.runs === 1), 'Spielstand nach dem Neuladen verloren');

  // Voll freigeschalteter Stand mit Glut, Erzfeinden und größerer Sammlung
  await page.evaluate(() => {
    const { Meta, store, showHub } = window.__hort;
    const p = Meta.newProfile();
    p.introSeen = true;
    p.stats = { runs: 9, wins: 4, nights: 50, defeated: 300 };
    p.glutEarned = 260;
    p.glutSpent = 40;
    p.species.gold = { hatched: 3, legend: 3, variant: 1 };
    p.species.kristall = { hatched: 2, legend: 5, variant: 1 };
    p.species.knochen = { hatched: 1, legend: 1, variant: 0 };
    p.unlocks = ['mimik', 'endlos', 'woche', 'speer.B4'];
    p.deeds = ['brut', 'still'];
    p.deck = ['speer', 'stein', 'feuer', 'fluch', 'baerenfalle', 'stacheln', 'mimik', 'katzengold'];
    p.nemeses = [
      { id: 'n1', name: 'Kunibert Langfinger', type: 'dieb', treasure: 'krone', glut: 0, rank: 2 },
      { id: 'n2', name: 'Gernot Funkenhand', type: 'magier', treasure: null, glut: 48, rank: 1 },
    ];
    p.trophies = [{ id: 'n0-1', name: 'Hedwig Steinbart', type: 'zwerg', treasure: null, rank: 1, at: 1 }];
    p.seen = { treasures: ['ei', 'muenzen', 'kelch', 'krone', 'rubin'], heroes: ['dieb', 'soeldner', 'zwerg', 'magier'], gear: ['dolch', 'stab'], buildings: ['speer', 'feuer'] };
    p.choice = { species: 'kristall', legend: 4, mode: 'normal' };
    p.updatedAt = Date.now();
    store.save(p);
    showHub();
  });
  await page.waitForTimeout(300);
  check((await overflow()) <= 0, 'Volle Höhle ist zu breit');
  await shot('9-hoehle-voll');
  // Werkstatt: Steinschlag für 50 Glut
  await page.click('[data-action="buy"][data-id="steinschlag"]');
  check(await page.evaluate(() => window.__hort.Meta.glutOf(window.__hort.store.get()) === 170), 'Kauf in der Werkstatt zieht keine Glut ab');
  // Deck: Katzengold heraus, Steinschlag hinein
  await page.click('[data-action="toggle-deck"][data-id="katzengold"]');
  check(await page.evaluate(() => document.querySelector('[data-action="start-run"]').disabled), 'Mit sieben Bauplänen darf kein Run starten');
  await page.click('[data-action="toggle-deck"][data-id="steinschlag"]');
  check(await page.evaluate(() => window.__hort.store.get().deck.includes('steinschlag') && !window.__hort.store.get().deck.includes('katzengold')), 'Deck lässt sich nicht umstellen');
  await page.evaluate(() => { document.getElementById('panel').scrollTop = 99999; });
  await page.waitForTimeout(150);
  await shot('10-hoehle-voll-unten');

  // Einstellungen: Lautstärke, Stummschalten, gespeichert im Browser
  await page.click('#btn-settings');
  await page.waitForTimeout(150);
  check(await page.evaluate(() => !document.getElementById('settings').hidden), 'Einstellungen öffnen nicht');
  await page.locator('#vol-music').fill('30');
  check(await page.evaluate(() => window.__hort.audio.settings.music === 0.3), 'Musik-Lautstärke wird nicht übernommen');
  check((await overflow()) <= 0, 'Einstellungen sind zu breit');
  await shot('11-einstellungen');
  await page.click('#btn-mute');
  check(await page.evaluate(() => window.__hort.audio.settings.muted === true), 'Stummschalten klappt nicht');
  await page.click('#btn-mute');
  await page.click('#btn-settings-close');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('hort.audio.v1')).music === 0.3), 'Lautstärke wird nicht gespeichert');
  const sound = await page.evaluate(async () => {
    const { audio } = window.__hort;
    audio.unlock();
    await new Promise((r) => setTimeout(r, 300));
    if (!audio.running) return 'aus';
    for (const name of ['spear', 'stone', 'curse', 'fire', 'roar', 'levelup', 'build', 'nightfall', 'hatch', 'click']) audio.play(name, { pan: 0.2 });
    await new Promise((r) => setTimeout(r, 500));
    return 'an';
  });
  if (vp.name === 'desktop') console.log(`  Ton im Test-Browser: ${sound}`);

  // Run mit Kristalldrache, Legende 4 und Erzfeinden bis in die zweite Nacht
  await page.click('[data-action="start-run"]');
  const opts = await page.evaluate(() => window.__hort.app.state.opts);
  check(opts.species === 'kristall' && opts.legend === 4 && opts.deck.includes('steinschlag') && opts.unlocks.includes('speer.B4'), 'Höhlen-Auswahl kommt nicht im Run an');
  for (let night = 1; night <= 2; night++) {
    await page.click('[data-action="dig-dir"]');
    await page.click('[data-action="dig"]');
    if (night === 2) await shot('12-raben');
    await page.click('[data-action="start-night"]');
    await page.evaluate(() => { window.__hort.app.view.speed = 2; });
    await page.waitForFunction(() => window.__hort.app.state.phase !== 'night', null, { timeout: 120000 });
    await page.waitForTimeout(200);
    if ((await phase()) !== 'morning') break;
    await page.click('[data-action="next-day"]');
  }

  // Hort-Code im Link startet einen Run mit festen Regeln (über eine leere Seite, damit wirklich neu geladen wird)
  await page.goto('about:blank');
  await page.goto(`${url}#0HORT01`);
  await page.waitForFunction(() => window.__hort?.app?.state);
  const codeRun = await page.evaluate(() => ({ phase: window.__hort.app.state.phase, opts: window.__hort.app.state.opts, seed: window.__hort.app.state.seed }));
  check(codeRun.phase === 'dig' && codeRun.opts.mode === 'code' && codeRun.opts.species === 'gold' && codeRun.seed === 1069533073, 'Hort-Code startet keinen Standard-Run');

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
    return { mode: app.mode, phase: app.state.phase, input: v.input, card: v.card, dig: v.dig, selected: v.selected, cursor: v.cursor, ability: v.ability, paused: v.paused, buildings: app.state.buildings.length, focus: document.activeElement?.dataset?.action ?? document.activeElement?.id };
  });
  // Rahmen per Steuerkreuz auf ein Feld fahren
  const moveTo = async (c, r) => {
    for (let k = 0; k < 30; k++) {
      const cur = await st();
      const cc = Math.floor(cur.cursor.x);
      const cr = Math.floor(cur.cursor.y);
      if (cc === c && cr === r) return true;
      await press(cc < c ? 'right' : cc > c ? 'left' : cr < r ? 'down' : 'up');
    }
    return false;
  };

  await page.goto(url);
  await page.waitForFunction(() => window.__hort?.app?.state);
  await page.waitForTimeout(300);
  await press('a');
  let s = await st();
  check(s.input === 'pad' && s.mode === 'hub', 'Der erste Druck soll nur den Controller wecken');
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
  await press('y');
  check((await st()).phase === 'dig', 'Y startet keinen Run');

  // Graben: Fokus auf eine Richtung, A wählt, Y gräbt
  for (let k = 0; k < 8; k++) {
    s = await st();
    if (s.focus === 'dig-dir') break;
    await press('down');
  }
  check((await st()).focus === 'dig-dir', 'Steuerkreuz erreicht keine Grabrichtung');
  await press('a');
  s = await st();
  check(s.dig?.dir, 'A wählt keine Richtung');
  await shot('2-graben');
  await press('y');
  check((await st()).phase === 'build', 'Y gräbt nicht');

  // Bauen: RB wählt einen Bauplan, Rahmen auf einen Platz fahren, A baut
  await page.evaluate(() => { window.__hort.app.state.gold = 300; });
  await press('rb');
  s = await st();
  check(s.card === 0, `RB wählt keinen Bauplan (${s.card})`);
  const id = await page.evaluate(() => window.__hort.app.state.deck.hand[0]);
  const spot = await spotFor(page, id);
  check(await moveTo(spot.c, spot.r), 'Rahmen erreicht den Bauplatz nicht');
  await shot('3-bauen');
  await press('a');
  check((await st()).buildings === 1, 'A baut nicht');

  // Einen Turm bauen und mit X und A auswählen
  const towerIndex = await page.evaluate(() => window.__hort.app.state.deck.hand.findIndex((x) => ['speer', 'stein', 'feuer', 'fluch'].includes(x)));
  if (towerIndex >= 0) {
    for (let k = 0; k <= towerIndex; k++) await press('rb');
    s = await st();
    const tid = await page.evaluate((i) => window.__hort.app.state.deck.hand[i], s.card);
    const tspot = await spotFor(page, tid);
    await moveTo(tspot.c, tspot.r);
    await press('a');
    await press('x');
    await moveTo(tspot.c, tspot.r);
    await press('a');
    s = await st();
    check(s.selected != null, 'X und A wählen keinen Turm');
    await page.evaluate(() => {
      const { app, Sim } = window.__hort;
      const b = Sim.buildingByUid(app.state, app.view.selected);
      if (b?.kind === 'tower') {
        b.level = 1;
        app.act('deselect');
        app.act('select', { uid: b.uid });
      }
    });
    await page.waitForTimeout(150);
    await shot('4-turm');
    await press('b');
    check((await st()).selected == null, 'B verlässt den Turm nicht');
  }
  await press('y');
  check((await st()).phase === 'night', 'Y beginnt die Nacht nicht');

  // Nacht: LB wählt den Feueratem, A speit
  await page.waitForFunction(() => window.__hort.Sim.activeHeroes(window.__hort.app.state).length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(400);
  await press('lb');
  s = await st();
  check(s.ability === 'feuer', 'LB wählt den Feueratem nicht');
  const keyLabel = await page.evaluate(() => document.querySelector('#ab-feuer kbd')?.textContent);
  check(keyLabel === 'LB', `Fähigkeiten zeigen nicht die Xbox-Tasten (${keyLabel})`);
  await shot('5-feuer-zielen');
  await press('a');
  check(await page.evaluate(() => window.__hort.app.state.dragon.cd.feuer > 0), 'A setzt den Feueratem nicht ein');
  await press('rb');
  check(await page.evaluate(() => window.__hort.app.state.dragon.cd.fluegel > 0), 'RB schlägt nicht mit den Flügeln');
  await press('start');
  check((await st()).paused === true, 'Menü pausiert die Nacht nicht');
  await press('start');
  check((await st()).paused === false, 'Menü setzt die Nacht nicht fort');
  await page.evaluate(() => { window.__hort.app.view.speed = 2; });
  await page.waitForFunction(() => window.__hort.app.state.phase !== 'night', null, { timeout: 120000 });
  await page.waitForTimeout(300);
  if ((await st()).phase === 'morning') {
    await press('y');
    check((await st()).phase === 'dig', 'Y führt nicht zum nächsten Tag');
  }

  console.log(`controller: ${errors.length ? `${errors.length} Fehler` : 'ok'}`);
  for (const e of errors) console.log(`  · ${e}`);
  if (errors.length) failed = true;
  await page.close();
}

await browser.close();
console.log(`Bilder in ${outDir}`);
process.exit(failed ? 1 : 0);
