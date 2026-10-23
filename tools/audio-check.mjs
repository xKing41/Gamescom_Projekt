// Klang-Prüfung: rechnet jedes Geräusch in Chromium ohne Lautsprecher aus (OfflineAudioContext)
// und misst Spitze und mittlere Lautheit. Fällt durch, wenn etwas stumm ist, übersteuert oder einen Fehler wirft.
//
//   npm run audio

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import path from 'node:path';

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
const browser = await playwright.chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.route('http://hort.test/**', (route) => {
  const file = path.join(root, new URL(route.request().url()).pathname);
  if (!file.startsWith(root)) return route.abort();
  if (file.endsWith('.html')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Klang</title>' });
  return route.fulfill({ path: file, contentType: 'text/javascript' });
});
await page.goto('http://hort.test/blank.html');

const results = await page.evaluate(async () => {
  const { createSynth } = await import('/src/audio.js');
  const rate = 44100;
  // Biquad nach dem Audio-EQ-Cookbook, um wie ein Ohr (K-Gewichtung) und wie ein Handy-Lautsprecher zu messen
  const biquad = (type, f0, q, gainDb = 0) => {
    const w = (2 * Math.PI * f0) / rate;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const A = 10 ** (gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'highpass') {
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    } else {
      const sq = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cos + sq); b1 = -2 * A * ((A - 1) + (A + 1) * cos); b2 = A * ((A + 1) + (A - 1) * cos - sq);
      a0 = (A + 1) - (A - 1) * cos + sq; a1 = 2 * ((A - 1) - (A + 1) * cos); a2 = (A + 1) - (A - 1) * cos - sq;
    }
    return (x) => {
      const y = new Float32Array(x.length);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < x.length; i++) {
        const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
        x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
      }
      return y;
    };
  };
  const kWeight = (x) => biquad('highpass', 38, 0.5)(biquad('highshelf', 1681, 0.71, 4)(x));
  const phone = (x) => biquad('highpass', 350, 0.7)(biquad('highpass', 350, 0.7)(x));
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  // Lautheit: lautestes 400-ms-Fenster, gemittelt über beide Kanäle
  const loudness = (channels) => {
    const win = Math.floor(rate * 0.4);
    const hop = Math.floor(rate * 0.1);
    let best = 0;
    for (let start = 0; start + win <= channels[0].length; start += hop) {
      let sum = 0;
      for (const d of channels) for (let i = start; i < start + win; i++) sum += d[i] * d[i];
      best = Math.max(best, sum / (win * channels.length));
    }
    return db(Math.sqrt(best));
  };
  const measure = (buf) => {
    let peak = 0;
    let bad = false;
    const raw = [];
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      raw.push(d);
      for (let i = 0; i < d.length; i++) {
        if (!Number.isFinite(d[i])) bad = true;
        peak = Math.max(peak, Math.abs(d[i]));
      }
    }
    return { peak: db(peak), loud: loudness(raw.map(kWeight)), phone: loudness(raw.map(phone)), bad };
  };
  const out = [];

  // Einzelne Geräusche: Effekte und Bedienung auf voller Lautstärke
  const probe = new OfflineAudioContext(2, rate, rate);
  const names = Object.keys(createSynth(probe).sounds);
  const events = { grab: [{ id: 'kelch' }, { id: 'ei' }], place: [{ weight: 1 }, { weight: 2 }, { weight: 3 }], death: [{ hero: 'paladin' }] };
  for (const name of names) {
    for (const e of events[name] ?? [{}]) {
      const ctx = new OfflineAudioContext(2, rate * 4, rate);
      const synth = createSynth(ctx);
      try {
        synth.sounds[name](0.05, { pan: 0.3, ...e });
      } catch (err) {
        out.push({ name, error: String(err) });
        continue;
      }
      const label = e.id ?? e.weight ?? e.hero;
      out.push({ name: label != null ? `${name}:${label}` : name, ...measure(await ctx.startRendering()) });
    }
  }

  // Atmosphäre: die Bausteine einzeln (bei voller Musiklautstärke), dann je Stimmung 8 Sekunden im Zusammenspiel
  const { MOODS } = await import('/src/audio.js');
  const render = async (seconds, setup) => {
    const ctx = new OfflineAudioContext(2, rate * seconds, rate);
    const synth = createSynth(ctx);
    const amb = synth.ambience();
    for (const node of Object.values(amb)) node.gain.value = 0;
    setup(synth, amb);
    return measure(await ctx.startRendering());
  };
  out.push({ name: 'Dauerton', ...(await render(4, (s, a) => { a.drone.gain.value = MOODS.hub.drone; })) });
  out.push({ name: 'Nachtteppich', ...(await render(4, (s, a) => { a.night.gain.value = MOODS.night.night; })) });
  out.push({ name: 'Wind', ...(await render(4, (s, a) => { a.wind.gain.value = MOODS.night.wind; })) });
  out.push({ name: 'Harfe', ...(await render(3, (s) => s.harp(0.1, 69, 1))) });
  out.push({ name: 'Bass', ...(await render(4, (s) => s.bass(0.1, 38, 1))) });
  out.push({ name: 'Herzschlag', ...(await render(2, (s) => s.heartbeat(0.1, 1))) });
  out.push({ name: 'Tropfen', ...(await render(2, (s) => s.drip(0.1))) });
  for (const [name, m] of Object.entries(MOODS)) {
    out.push({
      name: `Stimmung ${name}`,
      ...(await render(8, (s, a) => {
        a.drone.gain.value = m.drone;
        a.night.gain.value = m.night;
        a.wind.gain.value = m.wind;
        for (let t = 0.2; t < 7.5; t += 0.75) {
          if (m.harp && Math.random() < m.harp) s.harp(t, 69, 0.15);
          if (name === 'night') s.heartbeat(t, 0.9);
        }
        if (m.harp) s.bass(0.2, 38, 0.09);
        s.drip(1);
      })),
    });
  }
  return out;
});

let failed = errors.length > 0;
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('Klang', 20)} ${pad('Spitze', 10)} ${pad('Lautheit', 10)} Handy`);
for (const r of results) {
  if (r.error) {
    console.log(`${pad(r.name, 20)} FEHLER ${r.error}`);
    failed = true;
    continue;
  }
  const flags = [];
  if (r.bad) flags.push('ungültige Werte');
  if (r.peak > -0.5) flags.push('übersteuert');
  if (r.peak < -45) flags.push('fast stumm');
  if (flags.length) failed = true;
  console.log(`${pad(r.name, 20)} ${pad(`${r.peak.toFixed(1)} dB`, 10)} ${pad(`${r.loud.toFixed(1)} dB`, 10)} ${pad(`${r.phone.toFixed(1)} dB`, 10)} ${flags.join(', ')}`);
}
for (const e of errors) console.log('Fehler:', e);
await browser.close();
console.log(failed ? 'Klang-Prüfung fehlgeschlagen.' : `Alle ${results.length} Klänge in Ordnung.`);
process.exit(failed ? 1 : 0);
