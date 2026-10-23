// Klang ohne Audiodateien: Jedes Geräusch entsteht im Code mit der Web Audio API.
// Er startet erst nach der ersten Eingabe (so wollen es die Browser) und hört auf dieselben
// Ereignisse wie die Effekte im Bild. Die Lautstärke merkt sich jedes Gerät selbst.

import { activeHeroes } from './sim.js';
import { COLS } from './map.js';

const KEY = 'hort.audio.v1';
const DEFAULTS = { sfx: 0.8, music: 0.7, muted: false };

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// D-Moll-Pentatonik (D F G A C): klingt nach Sage und Höhle und kann nie schief klingen
const PENTA = [0, 3, 5, 7, 10];
const HARP = [];
for (const octave of [62, 74]) for (const step of PENTA) HARP.push(octave + step);
HARP.push(86);
const BASS = [38, 38, 41, 36]; // D D F C – ein langsamer Wechsel unter der Harfe

// Wie lange dasselbe Geräusch mindestens Pause macht: acht Treffer im selben Augenblick klingen wie einer
const GAP = { claw: 0.07, death: 0.06, grab: 0.1, snare: 0.1, place: 0.04, click: 0.03, drop: 0.12, fireproof: 0.2, cast: 0.25, stolen: 0.15 };

export function loadAudioSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
    return {
      sfx: raw.sfx == null ? DEFAULTS.sfx : clamp01(raw.sfx),
      music: raw.music == null ? DEFAULTS.music : clamp01(raw.music),
      muted: raw.muted === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveAudioSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Ohne Browser-Speicher gilt die Einstellung nur bis zum Neuladen
  }
}

// ── Klangerzeuger ──
// Baut alles auf einem beliebigen AudioContext auf, auch auf einem OfflineAudioContext für Tests.

export function createSynth(ctx) {
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  master.gain.value = 0.9;
  master.connect(comp).connect(ctx.destination);

  // Höhlenhall: ein im Code erzeugter Nachhall statt einer Aufnahme
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(2.6, 3.2);
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.5;
  reverb.connect(reverbOut).connect(master);

  // Zwei Lautstärken: Effekte und Musik/Atmosphäre, jeweils trocken und mit Hall
  const bus = (volume) => {
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    dry.gain.value = volume;
    wet.gain.value = volume;
    dry.connect(master);
    wet.connect(reverb);
    return { dry, wet };
  };
  const sfx = bus(1);
  const music = bus(1);

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuffer.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const growlCurve = new Float32Array(1024);
  for (let i = 0; i < growlCurve.length; i++) growlCurve[i] = Math.tanh(((i / 1023) * 2 - 1) * 3.2);

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    const pre = Math.floor(ctx.sampleRate * 0.012);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = pre; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - (i - pre) / (len - pre)) ** decay;
    }
    return buf;
  }

  // Ein Ausgang für ein einzelnes Geräusch: Position links/rechts und Hallanteil
  function voice(target, { pan = 0, wet = 0.2, gain = 1 } = {}) {
    const g = ctx.createGain();
    g.gain.value = gain;
    let node = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      node = p;
    }
    node.connect(target.dry);
    if (wet > 0) {
      const send = ctx.createGain();
      send.gain.value = wet;
      node.connect(send).connect(target.wet);
    }
    return g;
  }

  // Hüllkurve: schnell hoch, dann exponentiell ausklingen. Gibt das Ende zurück.
  function env(param, t, { attack = 0.005, peak = 1, hold = 0, decay = 0.2 }) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    if (hold) param.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
    param.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
    return t + attack + hold + decay;
  }

  function filter({ type = 'lowpass', f, f2, q = 0.7 }, t, dur) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.Q.value = q;
    b.frequency.setValueAtTime(f, t);
    if (f2) b.frequency.exponentialRampToValueAtTime(f2, t + dur);
    return b;
  }

  function tone(dest, t, { type = 'sine', f, f2, glide, attack = 0.005, hold = 0, decay = 0.2, gain = 0.3, detune = 0, lp = null }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2 && f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + (glide ?? attack + hold + decay));
    if (detune) o.detune.value = detune;
    const g = ctx.createGain();
    const end = env(g.gain, t, { attack, peak: gain, hold, decay });
    let src = o;
    if (lp) {
      const fl = filter(typeof lp === 'number' ? { f: lp } : lp, t, attack + hold + decay);
      o.connect(fl);
      src = fl;
    }
    src.connect(g).connect(dest);
    o.start(t);
    o.stop(end + 0.03);
    return o;
  }

  function noise(dest, t, { attack = 0.005, hold = 0, decay = 0.2, gain = 0.3, band = { type: 'lowpass', f: 2000 } }) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer;
    s.loop = true;
    const fl = filter(band, t, attack + hold + decay);
    const g = ctx.createGain();
    const end = env(g.gain, t, { attack, peak: gain, hold, decay });
    s.connect(fl).connect(g).connect(dest);
    s.start(t, Math.random() * 1.5);
    s.stop(end + 0.03);
  }

  // Glocke: unharmonische Teiltöne, die verschieden schnell verklingen
  function bell(dest, t, f, gain, decay = 1.2) {
    const parts = [[1, 1, 1], [2.76, 0.42, 0.6], [5.4, 0.22, 0.35], [8.93, 0.1, 0.2]];
    for (const [ratio, g, d] of parts) tone(dest, t, { f: f * ratio, attack: 0.002, decay: decay * d, gain: gain * g });
  }

  function pluck(dest, t, f, gain, decay = 1.4) {
    tone(dest, t, { type: 'triangle', f, attack: 0.003, decay, gain });
    tone(dest, t, { f: f * 2, attack: 0.003, decay: decay * 0.45, gain: gain * 0.3 });
  }

  function crackle(dest, t, dur, count, gain) {
    for (let i = 0; i < count; i++) {
      noise(dest, t + Math.random() * dur, { attack: 0.001, decay: rnd(0.01, 0.035), gain: gain * rnd(0.5, 1), band: { type: 'highpass', f: rnd(1500, 4500), q: 0.9 } });
    }
  }

  function coins(dest, t, count, gain) {
    for (let i = 0; i < count; i++) {
      const at = t + i * rnd(0.025, 0.06);
      const f = rnd(2300, 3900);
      tone(dest, at, { type: 'triangle', f, decay: rnd(0.05, 0.11), gain: gain * rnd(0.6, 1) });
      tone(dest, at, { f: f * 1.48, decay: 0.05, gain: gain * 0.3 });
    }
  }

  const sfxVoice = (opts) => voice(sfx, opts);

  // ── Geräusche ──
  // Jedes bekommt die Startzeit und das Ereignis (für Position und Details).

  const sounds = {
    claw(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.12 });
      const k = rnd(0.88, 1.12);
      noise(v, t, { decay: 0.12, gain: 1.1, band: { type: 'bandpass', f: 3400 * k, f2: 650 * k, q: 1.3 } });
      noise(v, t + 0.015, { decay: 0.06, gain: 0.35, band: { type: 'bandpass', f: 900 * k, q: 1.5 } });
      tone(v, t + 0.015, { f: 150 * k, f2: 52, decay: 0.13, gain: 0.5 });
    },
    fire(t, e) {
      const v = sfxVoice({ pan: e.pan * 0.5, wet: 0.25 });
      const s = ctx.createBufferSource();
      s.buffer = noiseBuffer;
      s.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 1.1;
      f.frequency.setValueAtTime(320, t);
      f.frequency.exponentialRampToValueAtTime(2800, t + 0.14);
      f.frequency.exponentialRampToValueAtTime(420, t + 0.9);
      const g = ctx.createGain();
      const end = env(g.gain, t, { attack: 0.04, peak: 0.62, hold: 0.25, decay: 0.6 });
      s.connect(f).connect(g).connect(v);
      s.start(t, Math.random());
      s.stop(end + 0.03);
      tone(v, t, { type: 'sawtooth', f: 78, f2: 46, attack: 0.03, hold: 0.2, decay: 0.6, gain: 0.2, lp: 280 });
      crackle(v, t + 0.12, 0.75, 8, 0.16);
    },
    bite(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.1 });
      for (const [dt, k] of [[0, 1], [0.12, 0.84]]) {
        tone(v, t + dt, { type: 'square', f: 270 * k, f2: 82 * k, decay: 0.1, gain: 0.42, lp: 1600 });
        noise(v, t + dt, { decay: 0.035, gain: 0.7, band: { type: 'highpass', f: 1800 } });
      }
    },
    wing(t) {
      const v = sfxVoice({ wet: 0.2 });
      for (const dt of [0, 0.2]) {
        noise(v, t + dt, { attack: 0.03, decay: 0.22, gain: 1.1, band: { type: 'lowpass', f: 1300, f2: 160, q: 0.9 } });
        noise(v, t + dt + 0.02, { attack: 0.02, decay: 0.12, gain: 0.3, band: { type: 'bandpass', f: 1100, q: 1 } });
        tone(v, t + dt, { f: 92, f2: 44, attack: 0.02, decay: 0.2, gain: 0.32 });
      }
    },
    roar(t) {
      const v = sfxVoice({ wet: 0.35 });
      const shaper = ctx.createWaveShaper();
      shaper.curve = growlCurve;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 1.6;
      lp.frequency.setValueAtTime(1200, t);
      lp.frequency.exponentialRampToValueAtTime(360, t + 1.25);
      const g = ctx.createGain();
      const end = env(g.gain, t, { attack: 0.07, peak: 0.19, hold: 0.45, decay: 0.8 });
      shaper.connect(lp).connect(g).connect(v);
      // Knurren: schnelles Zittern der Tonhöhe
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 27;
      const depth = ctx.createGain();
      depth.gain.value = 9;
      lfo.connect(depth);
      for (const [f, type, level] of [[98, 'sawtooth', 0.5], [49, 'square', 0.35], [147, 'sawtooth', 0.25]]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f * 1.18, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 1.3);
        depth.connect(o.frequency);
        const og = ctx.createGain();
        og.gain.value = level;
        o.connect(og).connect(shaper);
        o.start(t);
        o.stop(end + 0.03);
      }
      lfo.start(t);
      lfo.stop(end + 0.03);
      noise(v, t, { attack: 0.1, hold: 0.4, decay: 0.7, gain: 0.22, band: { type: 'bandpass', f: 720, f2: 280, q: 0.8 } });
    },
    smoke(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.3 });
      noise(v, t, { attack: 0.12, hold: 0.2, decay: 0.9, gain: 0.4, band: { type: 'bandpass', f: 1500, f2: 340, q: 0.6 } });
      tone(v, t, { f: 120, f2: 66, attack: 0.04, decay: 0.4, gain: 0.16 });
    },
    tail(t) {
      const v = sfxVoice({ wet: 0.2 });
      noise(v, t, { attack: 0.06, decay: 0.22, gain: 0.9, band: { type: 'bandpass', f: 480, f2: 2300, q: 1.1 } });
      tone(v, t + 0.2, { f: 112, f2: 38, decay: 0.32, gain: 0.55 });
      noise(v, t + 0.2, { decay: 0.1, gain: 0.5, band: { type: 'bandpass', f: 1300, q: 0.9 } });
    },
    rain(t) {
      const v = sfxVoice({ wet: 0.3 });
      noise(v, t, { attack: 0.1, hold: 0.5, decay: 0.7, gain: 0.45, band: { type: 'lowpass', f: 600, f2: 1800, q: 0.7 } });
      for (const pan of [-0.6, 0, 0.6]) crackle(sfxVoice({ pan, wet: 0.3 }), t + 0.1, 1.2, 9, 0.32);
    },
    merge(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.45 });
      [0, 4, 7, 12].forEach((step, i) => bell(v, t + i * 0.065, midi(74 + step), 0.13, 1.1));
    },
    place(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.12 });
      const w = e.weight ?? 1;
      if (w <= 1) coins(v, t, 3, 0.18);
      else if (w === 2) {
        tone(v, t, { type: 'triangle', f: 880, decay: 0.16, gain: 0.2 });
        tone(v, t, { type: 'triangle', f: 1340, decay: 0.1, gain: 0.12 });
        tone(v, t, { f: 140, f2: 70, decay: 0.12, gain: 0.3 });
      } else {
        tone(v, t, { f: 95, f2: 42, decay: 0.26, gain: 0.5 });
        noise(v, t, { decay: 0.1, gain: 0.5, band: { type: 'bandpass', f: 900, q: 1.2 } });
      }
    },
    pickup(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.05 });
      tone(v, t, { type: 'triangle', f: 1750, f2: 2100, decay: 0.06, gain: 0.3 });
    },
    grab(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.2 });
      if (e.id === 'ei') {
        // Alarm: Jemand hat das Ei!
        for (let i = 0; i < 3; i++) tone(v, t + i * 0.14, { type: 'square', f: 988, decay: 0.1, gain: 0.4, lp: 3000 });
        tone(v, t, { type: 'sawtooth', f: 330, f2: 440, attack: 0.02, decay: 0.5, gain: 0.36, lp: 1500 });
        return;
      }
      tone(v, t, { type: 'triangle', f: 2100, decay: 0.2, gain: 0.45 });
      tone(v, t, { type: 'triangle', f: 3170, decay: 0.13, gain: 0.2 });
      tone(v, t + 0.05, { type: 'square', f: 392, f2: 370, decay: 0.18, gain: 0.21, lp: 1600 });
    },
    stolen(t, e) {
      if (e.id === 'ei') return; // Das übernimmt der Klang der Niederlage
      const v = sfxVoice({ pan: e.pan, wet: 0.35 });
      tone(v, t, { type: 'sawtooth', f: 330, f2: 150, attack: 0.02, decay: 0.55, gain: 0.3, lp: 1100 });
      tone(v, t + 0.08, { type: 'sawtooth', f: 247, f2: 110, attack: 0.02, decay: 0.6, gain: 0.23, lp: 900 });
    },
    death(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.25 });
      const pitch = { dieb: 420, bauer: 330, paladin: 200, zwerg: 240, soeldner: 280, magier: 520 }[e.hero] ?? 300;
      noise(v, t, { decay: 0.28, gain: 0.65, band: { type: 'lowpass', f: 2200, f2: 220 } });
      tone(v, t, { f: pitch, f2: 70, decay: 0.3, gain: 0.32 });
      if (e.hero === 'paladin' || e.hero === 'zwerg' || e.hero === 'soeldner') coins(v, t + 0.05, 3, 0.1);
    },
    snare(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.2 });
      noise(v, t, { decay: 0.04, gain: 0.6, band: { type: 'highpass', f: 2500 } });
      tone(v, t, { type: 'square', f: 1400, f2: 300, decay: 0.07, gain: 0.13, lp: 4000 });
      tone(v, t + 0.01, { type: 'triangle', f: 2350, decay: 0.4, gain: 0.16 });
    },
    mimik(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.15 });
      tone(v, t, { type: 'square', f: 420, f2: 140, decay: 0.11, gain: 0.32, lp: 1800 });
      noise(v, t, { decay: 0.04, gain: 0.6, band: { type: 'highpass', f: 1500 } });
      tone(v, t + 0.13, { type: 'triangle', f: 170, f2: 340, decay: 0.13, gain: 0.35 });
    },
    teleport(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.5 });
      tone(v, t, { f: 500, f2: 1900, attack: 0.05, decay: 0.45, gain: 0.13 });
      tone(v, t + 0.04, { type: 'triangle', f: 750, f2: 2800, attack: 0.05, decay: 0.45, gain: 0.09 });
      noise(v, t, { attack: 0.1, decay: 0.4, gain: 0.12, band: { type: 'highpass', f: 4000, f2: 7000 } });
    },
    dig(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.3 });
      noise(v, t, { attack: 0.2, hold: 0.5, decay: 0.8, gain: 0.4, band: { type: 'lowpass', f: 160, q: 1 } });
      tone(v, t, { f: 44, attack: 0.2, hold: 0.4, decay: 0.8, gain: 0.16 });
      // Knirschen von Stein: kurze Rauschkörner in den Mitten, damit man es auch am Handy hört
      for (let i = 0; i < 14; i++) noise(v, t + 0.1 + Math.random() * 1.1, { attack: 0.005, decay: rnd(0.03, 0.08), gain: rnd(0.25, 0.45), band: { type: 'bandpass', f: rnd(600, 1600), q: 2 } });
    },
    nemesis(t, e) {
      const v = sfxVoice({ pan: e.pan * 0.5, wet: 0.5 });
      for (const f of [98, 104]) tone(v, t, { type: 'sawtooth', f: f * 0.96, f2: f, glide: 0.3, attack: 0.15, hold: 0.6, decay: 0.8, gain: 0.1, lp: 700 });
      tone(v, t, { f: 60, f2: 40, decay: 0.5, gain: 0.45 });
    },
    nemesisDown(t, e) {
      const v = sfxVoice({ pan: e.pan * 0.5, wet: 0.45 });
      [0, 7, 12, 16].forEach((step, i) => bell(v, t + i * 0.09, midi(62 + step), 0.1, 1.3));
      tone(v, t, { f: 70, f2: 44, decay: 0.4, gain: 0.4 });
    },
    chime(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.45 });
      bell(v, t, midi(84), 0.12, 1.4);
      bell(v, t + 0.18, midi(88), 0.08, 1.2);
    },
    cast(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.5 });
      tone(v, t, { f: 659, f2: 698, attack: 0.12, hold: 0.2, decay: 0.6, gain: 0.085 });
      tone(v, t + 0.05, { type: 'triangle', f: 988, attack: 0.1, decay: 0.6, gain: 0.06 });
    },
    fizzle(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.2 });
      noise(v, t, { decay: 0.25, gain: 0.32, band: { type: 'highpass', f: 3000, f2: 1200 } });
      tone(v, t, { type: 'square', f: 600, f2: 150, decay: 0.15, gain: 0.1, lp: 2000 });
    },
    fireproof(t, e) {
      const v = sfxVoice({ pan: e.pan, wet: 0.25 });
      tone(v, t, { type: 'triangle', f: 600, decay: 0.32, gain: 0.3 });
      tone(v, t, { type: 'triangle', f: 1230, decay: 0.22, gain: 0.18 });
    },
    drop(t, e) {
      coins(sfxVoice({ pan: e.pan, wet: 0.2 }), t, 4, 0.2);
    },

    // Übergänge zwischen den Phasen
    nightfall(t) {
      // Ein Kriegshorn der Helden, weit weg
      const v = sfxVoice({ wet: 0.8, gain: 0.8 });
      for (const [dt, f] of [[0, 147], [0.9, 147], [0.9, 220]]) {
        tone(v, t + dt, { type: 'sawtooth', f: f * 0.96, f2: f, glide: 0.25, attack: 0.2, hold: dt ? 0.9 : 0.4, decay: 0.7, gain: f > 200 ? 0.05 : 0.11, lp: { f: 620, q: 1 } });
      }
      tone(v, t, { f: 55, decay: 1.2, gain: 0.3 });
    },
    dawn(t) {
      const v = sfxVoice({ wet: 0.55 });
      [62, 66, 69, 74].forEach((n, i) => pluck(v, t + i * 0.13, midi(n), 0.09, 1.6));
    },
    raid(t) {
      sounds.wing(t);
      coins(sfxVoice({ wet: 0.2 }), t + 0.35, 5, 0.07);
    },
    loot(t) {
      coins(sfxVoice({ wet: 0.25 }), t, 8, 0.12);
    },
    hatch(t) {
      const v = sfxVoice({ wet: 0.5 });
      for (const dt of [0, 0.28, 0.5]) noise(v, t + dt, { decay: 0.05, gain: 0.5, band: { type: 'bandpass', f: 2600, q: 1.5 } });
      [62, 69, 74, 78, 81, 86].forEach((n, i) => bell(v, t + 0.75 + i * 0.1, midi(n), 0.09, 1.6));
    },
    defeat(t) {
      const v = sfxVoice({ wet: 0.6 });
      [62, 60, 57, 53].forEach((n, i) => tone(v, t + i * 0.42, { type: 'sawtooth', f: midi(n), attack: 0.05, hold: 0.2, decay: 0.7, gain: 0.08, lp: 900 }));
      tone(v, t, { f: 49, decay: 2.2, gain: 0.35 });
    },

    // Bedienung
    click(t) {
      tone(sfxVoice({ wet: 0 }), t, { type: 'triangle', f: 1300, decay: 0.035, gain: 0.25 });
    },
    select(t) {
      const v = sfxVoice({ wet: 0.1 });
      noise(v, t, { decay: 0.07, gain: 0.5, band: { type: 'bandpass', f: 2400, q: 1.2 } });
      tone(v, t, { f: 880, f2: 1320, decay: 0.08, gain: 0.16 });
    },
    error(t) {
      tone(sfxVoice({ wet: 0 }), t, { type: 'square', f: 185, f2: 150, decay: 0.13, gain: 0.2, lp: 1400 });
    },
  };

  // ── Atmosphäre ──

  function loopNoise() {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer;
    s.loop = true;
    return s;
  }

  function lfo(freq, depth, target) {
    const o = ctx.createOscillator();
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
    return o;
  }

  // Dauerton der Höhle, Wind und ein dunkler Teppich für die Nacht – alle starten leise und werden über die Stimmung geregelt
  function ambience() {
    const drone = ctx.createGain();
    drone.gain.value = 0;
    const droneLp = ctx.createBiquadFilter();
    droneLp.type = 'lowpass';
    droneLp.frequency.value = 340;
    droneLp.Q.value = 0.5;
    droneLp.connect(drone);
    drone.connect(music.dry);
    const droneSend = ctx.createGain();
    droneSend.gain.value = 0.3;
    drone.connect(droneSend).connect(music.wet);
    for (const [n, type, level, cents] of [[38, 'sine', 0.05, 0], [45, 'triangle', 0.016, 0], [50, 'sine', 0.014, 0], [50, 'sine', 0.014, 6]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midi(n);
      o.detune.value = cents;
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(droneLp);
      o.start();
    }
    lfo(0.045, 110, droneLp.frequency);

    // Nachts legt sich B-Dur über das D: dunkel, aber nicht schief
    const night = ctx.createGain();
    night.gain.value = 0;
    const nightLp = ctx.createBiquadFilter();
    nightLp.type = 'lowpass';
    nightLp.frequency.value = 520;
    const swell = ctx.createGain();
    swell.gain.value = 0.7;
    nightLp.connect(swell).connect(night);
    lfo(0.08, 0.3, swell.gain);
    night.connect(music.dry);
    const nightSend = ctx.createGain();
    nightSend.gain.value = 0.4;
    night.connect(nightSend).connect(music.wet);
    for (const [n, level] of [[46, 0.08], [53, 0.048], [58, 0.032]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      o.detune.value = rnd(-5, 5);
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(nightLp);
      o.start();
    }

    const wind = ctx.createGain();
    wind.gain.value = 0;
    const windBp = ctx.createBiquadFilter();
    windBp.type = 'bandpass';
    windBp.frequency.value = 420;
    windBp.Q.value = 0.9;
    const windSwell = ctx.createGain();
    windSwell.gain.value = 0.6;
    const source = loopNoise();
    source.connect(windBp).connect(windSwell).connect(wind);
    wind.connect(music.dry);
    source.start();
    lfo(0.06, 180, windBp.frequency);
    lfo(0.09, 0.35, windSwell.gain);

    return { drone, night, wind };
  }

  function drip(t, gain = 1) {
    const v = voice(music, { pan: rnd(-0.8, 0.8), wet: 0.7 });
    const f = rnd(1300, 2600);
    tone(v, t, { f, f2: f * 0.5, attack: 0.002, decay: 0.07, gain: 0.17 * gain });
  }

  function harp(t, n, gain) {
    pluck(voice(music, { pan: rnd(-0.35, 0.35), wet: 0.55 }), t, midi(n), gain, 1.8);
  }

  function bass(t, n, gain) {
    tone(voice(music, { wet: 0.4 }), t, { type: 'triangle', f: midi(n), attack: 0.02, decay: 3.2, gain });
  }

  function heartbeat(t, strength) {
    const v = voice(music, { wet: 0.08 });
    for (const [dt, level] of [[0, 1], [0.22, 0.7]]) {
      tone(v, t + dt, { f: 64, f2: 40, attack: 0.008, decay: 0.17, gain: 0.42 * level * strength });
      // Das „Tuk“ für kleine Lautsprecher, die den tiefen Ton nicht wiedergeben
      noise(v, t + dt, { attack: 0.004, decay: 0.05, gain: 1.1 * level * strength, band: { type: 'bandpass', f: 750, q: 1.2 } });
    }
  }

  return { ctx, master, sfx, music, sounds, ambience, drip, harp, bass, heartbeat };
}

// ── Für das Spiel ──

export const MOODS = {
  // Lautstärken der Dauerklänge und wie dicht die Harfe spielt
  hub: { drone: 0.5, night: 0, wind: 0.05, harp: 0.6 },
  day: { drone: 0.42, night: 0, wind: 0.06, harp: 0.35 },
  night: { drone: 0.34, night: 0.28, wind: 0.08, harp: 0 },
  end: { drone: 0.3, night: 0, wind: 0.05, harp: 0.25 },
};

export function createAudio() {
  const settings = loadAudioSettings();
  const AC = window.AudioContext ?? window.webkitAudioContext;
  let synth = null;
  let amb = null;
  let ctx = null;
  let mood = null;
  let lastPhase = null;
  let threat = 0;
  const lastPlayed = {};
  let nextDrip = 0;
  let nextNote = 0;
  let nextBeat = 0;
  let beatIndex = 0;
  let melody = 4;

  const curve = (v) => v * v; // Lautstärke-Regler fühlen sich so gleichmäßig an

  function applyVolume() {
    if (!synth) return;
    const t = ctx.currentTime;
    const on = settings.muted ? 0 : 1;
    for (const [bus, v] of [[synth.sfx, settings.sfx], [synth.music, settings.music]]) {
      bus.dry.gain.setTargetAtTime(curve(v) * on, t, 0.04);
      bus.wet.gain.setTargetAtTime(curve(v) * on, t, 0.04);
    }
  }

  // Muss aus einer Eingabe heraus aufgerufen werden, sonst bleibt der Ton im Browser stumm
  function unlock() {
    if (!AC) return;
    if (!ctx) {
      try {
        ctx = new AC({ latencyHint: 'interactive' });
      } catch {
        try {
          ctx = new AC();
        } catch {
          return;
        }
      }
      synth = createSynth(ctx);
      amb = synth.ambience();
      applyVolume();
    }
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
  }

  const running = () => ctx?.state === 'running';

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });

  function play(name, e = {}) {
    if (!running() || settings.muted || !synth.sounds[name]) return;
    const now = ctx.currentTime;
    if (GAP[name] && now - (lastPlayed[name] ?? -1) < GAP[name]) return;
    lastPlayed[name] = now;
    synth.sounds[name](now + 0.01, e);
  }

  const panOf = (x) => (x == null ? 0 : ((x / COLS) * 2 - 1) * 0.7);

  // Die Ereignisse der Spiellogik, bevor das Bild sie verbraucht
  function effects(list) {
    if (!running() || !list.length) return;
    for (const e of list) {
      const x = e.x ?? (e.c != null ? e.c + 0.5 : null);
      const name = e.cue ?? e.type;
      if (name === 'text' || name === 'dmg') continue;
      play(name, { ...e, pan: panOf(x) });
    }
  }

  // Bedienung: Klick, Auswahl, Fehler, Schatz ablegen
  function ui(name, e = {}) {
    play(name, { ...e, pan: e.c != null ? panOf(e.c + 0.5) : 0 });
  }

  function setMood(next) {
    mood = next;
    const m = MOODS[next];
    const t = ctx.currentTime;
    amb.drone.gain.setTargetAtTime(m.drone, t, 1.2);
    amb.night.gain.setTargetAtTime(m.night, t, 1.5);
    amb.wind.gain.setTargetAtTime(m.wind, t, 1.5);
  }

  function stinger(from, to) {
    if (to === 'night') play('nightfall');
    else if (from === 'night' && to === 'morning') play('dawn');
    else if (to === 'won') play('hatch');
    else if (to === 'lost') play('defeat');
    else if (from === 'raid' && to === 'loot') play('raid');
    else if (from === 'loot' && to === 'arrange') play('loot');
  }

  function measureThreat(state) {
    const active = activeHeroes(state);
    if (active.some((h) => h.carry?.id === 'ei')) return 1;
    const carrying = active.filter((h) => h.carry).length;
    return Math.min(1, active.length * 0.06 + carrying * 0.28);
  }

  // Einmal pro Bild: Stimmung, Übergänge und die geplanten Klänge der nächsten Augenblicke
  function update(state, mode, view) {
    const phase = mode === 'hub' ? 'hub' : state?.phase ?? null;
    const changed = phase !== lastPhase;
    const from = lastPhase;
    lastPhase = phase;
    if (!running() || !phase) return;
    if (changed && from) stinger(from, phase);
    const next = phase === 'hub' ? 'hub' : phase === 'night' ? 'night' : phase === 'won' || phase === 'lost' ? 'end' : 'day';
    if (next !== mood) setMood(next);

    const now = ctx.currentTime;
    const ahead = now + 0.25;
    if (settings.muted || !settings.music) {
      nextDrip = nextNote = nextBeat = now + 0.5;
      return;
    }
    // Nach einer Pause im Hintergrund nicht alles auf einmal nachholen
    if (nextDrip < now - 1) nextDrip = now + rnd(1, 3);
    if (nextNote < now - 1) nextNote = now + 0.4;
    if (nextBeat < now - 1) nextBeat = now + 0.3;

    while (nextDrip < ahead) {
      synth.drip(nextDrip);
      nextDrip += rnd(2.5, 7);
    }

    const m = MOODS[mood];
    while (nextNote < ahead) {
      const beat = 0.75;
      if (m.harp > 0) {
        if (beatIndex % 8 === 0) synth.bass(nextNote, BASS[(beatIndex / 8) % BASS.length], 0.09);
        if (Math.random() < m.harp) {
          melody = Math.max(0, Math.min(HARP.length - 1, melody + pick([-2, -1, -1, 1, 1, 2])));
          synth.harp(nextNote, HARP[melody], 0.15);
          if (Math.random() < 0.18) synth.harp(nextNote + beat / 2, HARP[Math.max(0, melody - 1)], 0.1);
        }
      }
      beatIndex += 1;
      nextNote += beat;
    }

    if (mood === 'night') {
      threat += (measureThreat(state) - threat) * 0.05;
      while (nextBeat < ahead) {
        if (!view.paused) synth.heartbeat(nextBeat, 0.45 + threat * 0.55);
        nextBeat += 60 / (54 + threat * 52);
      }
    } else {
      threat = 0;
      nextBeat = now + 0.5;
    }
  }

  function setVolume(kind, value) {
    settings[kind] = clamp01(value);
    if (settings[kind] > 0) settings.muted = false;
    saveAudioSettings(settings);
    applyVolume();
  }

  function setMuted(muted) {
    settings.muted = !!muted;
    saveAudioSettings(settings);
    applyVolume();
  }

  return { unlock, effects, ui, play, update, setVolume, setMuted, settings, get supported() { return !!AC; }, get running() { return running(); } };
}
