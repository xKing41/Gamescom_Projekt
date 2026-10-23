// Startet die Desktop-Fassung (Electron) und prüft: Fenster und Spiel laufen, Schriften sind dabei,
// das Spiel hat weder Node noch Netz, der Spielstand landet als Datei und übersteht einen Neustart
// auch ohne Browser-Speicher. Braucht Playwright; unter Linux ohne Bildschirm mit xvfb-run starten.
//
//   npm run build && xvfb-run -a node tools/desktop-check.mjs [Ordner für Bilder]
//   HORT_APP=release/linux-unpacked/hort xvfb-run -a node tools/desktop-check.mjs   (gepacktes Spiel)

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.resolve(process.argv[2] ?? path.join(root, '.e2e'));
fs.mkdirSync(outDir, { recursive: true });
// Eigener Konfigurationsordner, damit der Test keinen echten Spielstand anfasst
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'hort-desktop-'));
const saveFile = path.join(config, 'Hort', 'save', 'profile.json');
const errors = [];
const check = (ok, message) => {
  if (!ok) errors.push(message);
};

async function launch() {
  const packed = process.env.HORT_APP ? path.resolve(process.env.HORT_APP) : null;
  const app = await playwright._electron.launch({
    executablePath: packed ?? require(path.join(root, 'node_modules', 'electron')),
    args: packed ? ['--no-sandbox'] : ['--no-sandbox', root],
    env: { ...process.env, XDG_CONFIG_HOME: config, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
  });
  const win = await app.firstWindow();
  win.on('pageerror', (e) => errors.push(String(e)));
  win.on('console', (m) => {
    // Die Netzsperre lösen wir unten absichtlich aus
    if (m.type() === 'error' && !m.text().includes('example.com')) errors.push(m.text());
  });
  await win.waitForFunction(() => window.__hort?.app?.state, null, { timeout: 20000 });
  return { app, win };
}

let { app, win } = await launch();
await win.waitForTimeout(500);

const env = await win.evaluate(async () => {
  let net = 'offen';
  try {
    await fetch('https://example.com/');
  } catch {
    net = 'gesperrt';
  }
  await document.fonts.ready;
  return {
    bridge: typeof window.hortDesktop?.profile?.save === 'function',
    node: typeof window.require !== 'undefined' || typeof window.process !== 'undefined',
    fonts: document.fonts.check('800 20px "Grenze Gotisch"') && document.fonts.check('400 16px "Alegreya Sans"'),
    net,
    audio: window.__hort.audio.running,
    title: document.title,
  };
});
check(env.bridge, 'Brücke zum Rechner fehlt');
check(!env.node, 'Das Spiel hat Zugriff auf Node');
check(env.fonts, 'Schriften fehlen in der Desktop-Fassung');
check(env.net === 'gesperrt', 'Das Spiel kommt ins Netz');
check(env.title === 'Hort', 'Fenstertitel stimmt nicht');
console.log(`  Ton ohne Klick: ${env.audio ? 'an' : 'aus (kein Audiogerät im Test?)'}`);
await win.screenshot({ path: path.join(outDir, 'desktop-app-1-hoehle.png') });

// Einen Run spielen und auswerten → Spielstand muss als Datei landen
await win.click('[data-action="intro-ok"]').catch(() => {});
await win.click('[data-action="start-run"]');
await win.click('[data-action="raid"]');
await win.click('[data-action="toggle-loot"][data-i="0"]');
await win.click('[data-action="toggle-loot"][data-i="1"]');
await win.click('[data-action="take-loot"]');
await win.screenshot({ path: path.join(outDir, 'desktop-app-2-hort.png') });
await win.evaluate(() => {
  const { app: a, finishRun } = window.__hort;
  a.state.phase = 'lost';
  a.state.lostBy = 'dieb';
  finishRun();
});
await win.waitForTimeout(600);
const saved = fs.existsSync(saveFile) ? JSON.parse(fs.readFileSync(saveFile, 'utf8')) : null;
check(saved?.stats?.runs === 1, 'Spielstand-Datei fehlt oder ist leer');

// Einstellungen: Beenden-Knopf nur in der Desktop-Fassung
await win.click('#btn-settings');
check(await win.evaluate(() => !document.getElementById('row-quit').hidden), 'Knopf „Spiel beenden“ fehlt');
await win.screenshot({ path: path.join(outDir, 'desktop-app-3-einstellungen.png') });
check(await win.evaluate(() => window.hortDesktop.setFullscreen(true)), 'Vollbild lässt sich nicht einschalten');
await win.waitForTimeout(300);
await win.evaluate(() => window.hortDesktop.setFullscreen(false));

// Browser-Speicher leeren und neu starten: der Stand kommt aus der Datei zurück
await win.evaluate(() => localStorage.clear());
await app.close();
({ app, win } = await launch());
await win.waitForTimeout(800);
const runs = await win.evaluate(() => window.__hort.store.get().stats.runs);
check(runs === 1, `Spielstand nach Neustart nicht aus der Datei geladen (Runs: ${runs})`);
await app.close();

fs.rmSync(config, { recursive: true, force: true });
console.log(`desktop-app: ${errors.length ? `${errors.length} Fehler` : 'ok'}`);
for (const e of errors) console.log(`  · ${e}`);
process.exit(errors.length ? 1 : 0);
