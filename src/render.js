// Zeichnet die Höhle in Pixel-Art. Erst die Welt in Originalgröße (16 Pixel pro Feld),
// dann das Licht darüber (Hort-Glühen, Fackeln, Feuertöpfe, Mondlicht), zuletzt Rahmen, Zahlen und Balken.
// Liest nur den Spielzustand und die Ansicht – verändert nichts daran.

import { COLS, ROWS, inside, tileAt, chunkOf, chunkOrigin, K, MOUTH, N4 } from './map.js';
import { TREASURES, BUILDINGS, SPECIES, ABILITY_BY_ID, DRAGON } from './data.js';
import * as Sim from './sim.js';
import { makeCanvas, flipX, tint } from './pixel/sprite.js';
import { treasureImg, heroImg, guardianImg, treasureLight, buildingImg, blueprintImg } from './pixel/images.js';
import { hoardDragonImage, HOARD_DRAGON_W, HOARD_HEAD_Y } from './pixel/dragon.js';
import { buildCave, TS } from './pixel/cave.js';
import { drawDigits, digitWidth } from './pixel/font.js';

const TAU = Math.PI * 2;
const NW = COLS * TS;
const NH = ROWS * TS;
const FONT = '"Pixelify Sans", "Alegreya Sans", system-ui, sans-serif';
const TONES = { warn: '#ffd166', bad: '#ff7a6b', good: '#a6ec8f', info: '#b9d0ea' };
const DURATION = {
  shot: 0.22, splash: 0.4, pulse: 0.45, bolt: 0.25, breath: 1, claw: 0.28, wing: 0.7, roar: 0.9, text: 1.5, dmg: 0.8, death: 0.8,
  grab: 0.6, snare: 0.6, spike: 0.4, oilfire: 0.5, rockfall: 0.6, mimik: 0.55, teleport: 0.9, levelup: 1.4, learn: 0.8, build: 0.6,
  sell: 0.5, dig: 1.1, coin: 1, loot: 1.3, windup: 1, balmung: 0.6, ember: 0.4, spawn: 0.6, socket: 0.8,
};
// Grundlicht je Stimmung: nachts dunkelblau, tagsüber warm gedämpft
const AMBIENT = { night: [64, 64, 116], day: [222, 208, 204], hub: [190, 174, 184], end: [200, 186, 190] };
// Wer nachts eine Fackel trägt (Diebe schleichen im Dunkeln)
const TORCH = { bauer: [255, 150, 70], soeldner: [255, 150, 70], paladin: [255, 190, 120], zwerg: [255, 200, 110], magier: [190, 130, 255], siegfried: [255, 210, 140] };
const TOWER_LIGHT = { feuer: [[255, 150, 60], 40, 0.9], fluch: [[180, 110, 255], 26, 0.55], speer: [[255, 190, 120], 16, 0.35], stein: [[255, 190, 120], 16, 0.35] };
const ENTRANCE_LIGHT = { mund: [110, 150, 235], brunnen: [150, 180, 255], zwerge: [255, 200, 110], gruft: [255, 210, 150] };
const FLAME = ['#fff6c0', '#ffd166', '#ff9a3c', '#e0531f', '#8a2a1a', '#4a3a44'];
const LAYER_COLOR = { leben: '#ff5a4a', ruestung: '#dfe6f2', segen: '#7fb8ff' };

function hash(a, b, k = 0) {
  let h = (a * 374761393 + b * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Punkte eines Pixel-Kreises, nach Winkel sortiert (für Ringe und Fortschritt)
const ringCache = new Map();
function ringPoints(r) {
  if (ringCache.has(r)) return ringCache.get(r);
  const pts = [];
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) pts.push([px, py]);
    y++;
    if (err < 0) err += 2 * y + 1;
    else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
  const uniq = [...new Map(pts.map((p) => [p.join(), p])).values()];
  uniq.sort((a, b) => ((Math.atan2(a[0], -a[1]) + TAU) % TAU) - ((Math.atan2(b[0], -b[1]) + TAU) % TAU));
  ringCache.set(r, uniq);
  return uniq;
}

// Plätze für die Schätze im Hort, rund um das Ei: hintere Reihe, dann vordere
const PILE = [[-18, 2], [-6, 0], [6, 0], [18, 2], [-12, 9], [12, 9], [-22, 10], [22, 10]];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const world = makeCanvas(NW, NH);
  const w = world.getContext('2d');
  const over = makeCanvas(NW, NH);
  const ov = over.getContext('2d');
  const light = makeCanvas(NW, NH);
  const li = light.getContext('2d');
  const glowC = makeCanvas(NW, NH);
  const gl = glowC.getContext('2d');
  const effects = [];
  const motes = [];
  const walkers = new Map();
  const ambient = [...AMBIENT.hub];
  const dragonAnim = { mouthUntil: 0, wingUntil: 0, roarUntil: 0 };
  let cave = null;
  let caveKey = '';
  let lights = [];
  let glows = [];
  let labels = [];
  let S = 4; // Gerätepixel je Weltpixel im Zeichenpuffer
  let shown = 4; // tatsächliche Vergrößerung auf dem Bildschirm
  let dpr = 1;
  let T = 64; // CSS-Pixel je Feld
  let shakeUntil = 0;
  let lastTime = 0;

  function resize(width, height) {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const fit = Math.max(0.25, Math.min((width * dpr) / NW, (height * dpr) / NH));
    // Ganze Vergrößerung ist am schärfsten; nur wenn dabei zu viel Platz verloren geht, krumm skalieren
    const whole = Math.floor(fit);
    shown = whole >= 1 && whole / fit >= 0.88 ? whole : fit;
    S = Math.max(1, Math.ceil(shown - 1e-6));
    canvas.width = NW * S;
    canvas.height = NH * S;
    canvas.style.width = `${(NW * shown) / dpr}px`;
    canvas.style.height = `${(NH * shown) / dpr}px`;
    canvas.style.imageRendering = shown === S ? 'pixelated' : 'auto';
    T = (TS * shown) / dpr;
  }

  // ── Koordinaten (in CSS-Pixeln des Bildschirms) ──

  function toTile(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: (clientX - rect.left) / T, y: (clientY - rect.top) / T };
  }

  function cellAt(clientX, clientY) {
    const { x, y } = toTile(clientX, clientY);
    const c = Math.floor(x);
    const r = Math.floor(y);
    return inside(c, r) ? { c, r } : null;
  }

  function heroAt(state, clientX, clientY, maxDist = 0.8) {
    if (!state) return null;
    const p = toTile(clientX, clientY);
    let best = null;
    let bestD = maxDist;
    for (const h of state.heroes) {
      if (!Sim.isActive(h)) continue;
      const d = Math.hypot(h.x - p.x, h.y - 0.25 - p.y);
      if (d < bestD) {
        best = h;
        bestD = d;
      }
    }
    return best;
  }

  function cellCenter(c, r) {
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + (c + 0.5) * T, y: rect.top + (r + 0.5) * T };
  }

  // ── Kleine Pixel-Werkzeuge ──

  const px = (g, x, y, color, size = 1) => {
    g.fillStyle = color;
    g.fillRect(Math.round(x), Math.round(y), size, size);
  };

  function line(g, x0, y0, x1, y1, color, dash = 0) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let n = 0;
    g.fillStyle = color;
    for (let guard = 0; guard < 2000; guard++) {
      if (!dash || Math.floor(n / dash) % 2 === 0) g.fillRect(x0, y0, 1, 1);
      n++;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  function ring(g, cx, cy, r, color, part = 1, dotted = 0) {
    const pts = ringPoints(Math.max(1, Math.round(r)));
    const n = Math.round(pts.length * part);
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      if (dotted && i % dotted) continue;
      g.fillRect(Math.round(cx) + pts[i][0], Math.round(cy) + pts[i][1], 1, 1);
    }
  }

  function shadow(cx, cy, rx) {
    w.fillStyle = 'rgba(8,6,12,0.45)';
    w.fillRect(Math.round(cx - rx + 1), Math.round(cy), rx * 2 - 2, 1);
    w.fillRect(Math.round(cx - rx + 2), Math.round(cy + 1), rx * 2 - 4, 1);
    w.fillRect(Math.round(cx - rx + 2), Math.round(cy - 1), rx * 2 - 4, 1);
  }

  function glint(x, y, k) {
    if (k <= 0) return;
    const a = Math.min(1, k);
    w.fillStyle = `rgba(255,255,240,${a})`;
    w.fillRect(Math.round(x), Math.round(y), 1, 1);
    if (k > 0.5) {
      w.fillStyle = `rgba(255,236,170,${a * 0.85})`;
      w.fillRect(Math.round(x) - 1, Math.round(y), 1, 1);
      w.fillRect(Math.round(x) + 1, Math.round(y), 1, 1);
      w.fillRect(Math.round(x), Math.round(y) - 1, 1, 1);
      w.fillRect(Math.round(x), Math.round(y) + 1, 1, 1);
    }
    glows.push([x, y, 5, [255, 230, 160], 0.35 * a]);
  }

  const addLight = (x, y, r, color, a) => lights.push([x, y, r, color, a]);
  const addLabel = (text, x, y, color, alpha = 1, size = 1) => labels.push({ text, x, y, color, alpha, size });

  // Ein Rahmen mit offenen Ecken, wie in alten Spielen
  function frame(g, x, y, color, thick = 1, size = TS) {
    g.fillStyle = color;
    const L = 5;
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + size - 1, y, -1, 1], [x, y + size - 1, 1, -1], [x + size - 1, y + size - 1, -1, -1]]) {
      for (let t = 0; t < thick; t++) {
        g.fillRect(sx > 0 ? cx : cx - L + 1, cy + sy * t, L, 1);
        g.fillRect(cx + sx * t, sy > 0 ? cy : cy - L + 1, 1, L);
      }
    }
  }

  // ── Effekte ──

  function addEffect(e, time, state) {
    const fx = { ...e, t0: time };
    const many = reduceMotion ? 0.4 : 1;
    if (e.type === 'breath') {
      fx.parts = Array.from({ length: Math.round(44 * many) }, () => ({ x: (Math.random() - 0.5) * 44, y: (Math.random() - 0.5) * 40, v: 6 + Math.random() * 16, s: 1 + Math.floor(Math.random() * 3), d: Math.random() * 0.25 }));
      dragonAnim.mouthUntil = time + 0.7;
    }
    if (e.type === 'death' || e.type === 'grab' || e.type === 'build' || e.type === 'levelup' || e.type === 'dig' || e.type === 'socket') {
      fx.parts = Array.from({ length: Math.round(16 * many) }, () => ({ a: Math.random() * TAU, v: 8 + Math.random() * 18, s: Math.random() }));
    }
    if (e.type === 'rockfall') fx.parts = Array.from({ length: 9 }, (_, i) => ({ x: ((i % 3) - 1) * 14 + (Math.random() - 0.5) * 6, d: Math.random() * 0.3, s: 2 + Math.floor(Math.random() * 2) }));
    if (e.type === 'wing') dragonAnim.wingUntil = time + 0.7;
    if (e.type === 'roar') {
      dragonAnim.roarUntil = time + 0.8;
      dragonAnim.mouthUntil = time + 0.6;
      if (!reduceMotion) shakeUntil = time + 0.45;
    }
    if (e.type === 'claw') dragonAnim.mouthUntil = Math.max(dragonAnim.mouthUntil, time + 0.15);
    if (e.type === 'dig' && !reduceMotion) shakeUntil = time + 0.25;
    if (e.type === 'balmung' && !reduceMotion) shakeUntil = time + 0.2;
    if (e.type === 'shot' && state) {
      // Treffpunkt aus Sicht der Grafik
      fx.len = Math.hypot(e.x1 - e.x0, e.y1 - e.y0);
    }
    effects.push(fx);
  }

  function drawEffects(time, state) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      const age = (time - e.t0) / (DURATION[e.type] ?? 1);
      if (age >= 1) {
        effects.splice(i, 1);
        continue;
      }
      drawEffect(e, age, time, state);
    }
  }

  function mouthOf(state) {
    const c = Sim.chamberCenter(state);
    return { x: c.c * TS + 8, y: c.r * TS + 8 - 30 + HOARD_HEAD_Y + 19 };
  }

  function drawEffect(e, a, time, state) {
    if (e.type === 'shot') {
      const x0 = e.x0 * TS;
      const y0 = e.y0 * TS - 6;
      const x1 = e.x1 * TS;
      const y1 = e.y1 * TS - 6;
      const k = Math.min(1, a * 1.4);
      const x = x0 + (x1 - x0) * k;
      let y = y0 + (y1 - y0) * k;
      if (e.id === 'stein') {
        y -= Math.sin(k * Math.PI) * Math.min(14, (e.len ?? 2) * 4);
        px(w, x - 1, y - 1, '#9a92ad', 3);
        px(w, x - 1, y - 1, '#c9c1d6');
      } else if (e.id === 'fluch') {
        px(w, x - 1, y - 1, '#9a62e0', 3);
        px(w, x, y, '#f4e4ff');
        glows.push([x, y, 5, [190, 120, 255], 0.6]);
        addLight(x, y, 12, [170, 100, 255], 0.4);
      } else {
        // Speer: ein kurzer Strich in Flugrichtung
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const ux = (x1 - x0) / len;
        const uy = (y1 - y0) / len;
        line(w, x - ux * 4, y - uy * 4, x, y, e.chain ? '#fff2b0' : '#e8dcc0');
        px(w, x, y, '#ffffff');
      }
    } else if (e.type === 'splash') {
      ring(w, e.x * TS, e.y * TS - 2, 2 + a * e.r * TS, `rgba(201,193,214,${0.8 * (1 - a)})`);
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * TAU + e.x;
        px(w, e.x * TS + Math.cos(ang) * a * 10, e.y * TS - 4 + Math.sin(ang) * a * 6 - Math.sin(a * Math.PI) * 6, '#6f6882');
      }
    } else if (e.type === 'pulse') {
      const r = 3 + a * e.r * TS;
      ring(w, e.x * TS, e.y * TS, r, `rgba(255,150,60,${0.7 * (1 - a)})`, 1, 2);
      addLight(e.x * TS, e.y * TS, e.r * TS + 6, [255, 140, 60], 0.35 * (1 - a));
    } else if (e.type === 'bolt') {
      const n = 6;
      let lx = e.x0 * TS;
      let ly = e.y0 * TS - 6;
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const nx = e.x0 * TS + (e.x1 - e.x0) * TS * t + (k < n ? (Math.random() - 0.5) * 6 : 0);
        const ny = e.y0 * TS - 6 + (e.y1 - e.y0) * TS * t + (k < n ? (Math.random() - 0.5) * 6 : 0);
        line(w, lx, ly, nx, ny, a < 0.5 ? '#f4e4ff' : '#9a62e0');
        lx = nx;
        ly = ny;
      }
      addLight(e.x1 * TS, e.y1 * TS, 20, [190, 140, 255], 0.6 * (1 - a));
    } else if (e.type === 'breath') {
      const tx = (e.c + 0.5) * TS;
      const ty = (e.r + 0.5) * TS;
      const m = mouthOf(state);
      const flame = e.frost ? ['#ffffff', '#d6f4ff', '#9ff0ff', '#5fb0e0', '#2a5a8a', '#2a3a5a'] : FLAME;
      if (a < 0.4) {
        const k = a / 0.4;
        for (let i = 0; i <= 18; i++) {
          const t = i / 18;
          if (t > k * 1.6) break;
          const x = m.x + (tx - m.x) * t + Math.sin(time * 40 + i) * 1.5;
          const y = m.y + (ty - m.y) * t + Math.cos(time * 37 + i) * 1.5;
          const size = 2 + Math.round(t * 2);
          px(w, x - size / 2, y - size / 2, flame[Math.min(3, Math.floor((1 - t) * 1.5 + k * 2))], size);
          if (i % 4 === 0) addLight(x, y, 18, e.frost ? [150, 220, 255] : [255, 160, 70], 0.5);
        }
      }
      for (const p of e.parts) {
        const pa = (a - p.d) / (1 - p.d);
        if (pa <= 0) continue;
        const color = flame[Math.min(flame.length - 1, Math.floor(pa * flame.length))];
        px(w, tx + p.x * (0.6 + pa * 0.4), ty + p.y - p.v * pa, color, Math.max(1, Math.round(p.s * (1 - pa * 0.5))));
      }
      addLight(tx, ty, 54, e.frost ? [140, 210, 255] : [255, 150, 60], 1.1 * (1 - a));
      glows.push([tx, ty, 26, e.frost ? [160, 220, 255] : [255, 170, 80], 0.6 * (1 - a)]);
    } else if (e.type === 'claw') {
      const k = Math.min(1, a * 3);
      for (let s = -1; s <= 1; s++) {
        const x0 = e.x * TS - 6 + s * 4;
        const y0 = e.y * TS - 16;
        line(w, x0, y0, x0 + 9 * k, y0 + 13 * k, a < 0.5 ? '#fff6e8' : '#ffb380');
      }
      addLight(e.x * TS, e.y * TS - 8, 16, [255, 220, 200], 0.5 * (1 - a));
    } else if (e.type === 'wing') {
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * TAU + 0.3;
        const r0 = 10 + a * e.r * TS;
        const x = e.x * TS + Math.cos(ang) * r0;
        const y = e.y * TS + Math.sin(ang) * r0 * 0.8;
        line(w, x, y, x + Math.cos(ang) * 6, y + Math.sin(ang) * 5, `rgba(230,236,250,${0.75 * (1 - a)})`);
      }
    } else if (e.type === 'roar') {
      const m = mouthOf(state);
      for (let k = 0; k < 3; k++) {
        const aa = a - k * 0.15;
        if (aa <= 0) continue;
        ring(w, m.x, m.y, 10 + aa * 170, `rgba(255,190,120,${0.65 * (1 - aa)})`);
      }
      addLight(m.x, m.y, 30, [255, 160, 90], 0.6 * (1 - a));
    } else if (e.type === 'text') {
      addLabel(e.text, e.x * TS, e.y * TS - a * 10, TONES[e.tone] ?? '#f1e8da', a < 0.75 ? 1 : (1 - a) * 4);
    } else if (e.type === 'dmg') {
      const text = e.text;
      const x = Math.round(e.x * TS - digitWidth(text) / 2);
      const y = Math.round(e.y * TS - 14 - a * 9);
      ov.globalAlpha = Math.min(1, (1 - a) * 2);
      drawDigits(ov, text, x, y, e.crit ? '#ffd166' : '#fff1d6');
      ov.globalAlpha = 1;
    } else if (e.type === 'coin') {
      const text = `+${e.n}`;
      const x = Math.round(e.x * TS - digitWidth(text) / 2);
      const y = Math.round(e.y * TS - 20 - a * 10);
      ov.globalAlpha = Math.min(1, (1 - a) * 2);
      drawDigits(ov, text, x, y, '#f2c94c');
      ov.globalAlpha = 1;
    } else if (e.type === 'loot') {
      ov.globalAlpha = Math.min(1, (1 - a) * 2.5);
      ov.drawImage(treasureImg(e.id), Math.round(e.x * TS - 8), Math.round(e.y * TS - 26 - a * 12));
      ov.globalAlpha = 1;
    } else if (e.type === 'death') {
      for (const p of e.parts) {
        const r = Math.round(1 + p.s * 2 + a * 2);
        const x = e.x * TS + Math.cos(p.a) * p.v * a * 0.7;
        const y = e.y * TS - 6 + Math.sin(p.a) * p.v * a * 0.4 - a * 8;
        w.fillStyle = `rgba(170,160,180,${0.75 * (1 - a)})`;
        w.fillRect(Math.round(x - r), Math.round(y - r), r * 2, r * 2);
      }
    } else if (e.type === 'grab') {
      glint(e.x * TS, e.y * TS - 20 - a * 4, 1 - a);
      for (const p of e.parts.slice(0, 5)) px(w, e.x * TS + Math.cos(p.a) * p.v * a * 0.5, e.y * TS - 14 + Math.sin(p.a) * p.v * a * 0.3 + a * a * 10, `rgba(255,214,110,${1 - a})`);
    } else if (e.type === 'snare') {
      const k = Math.min(1, a * 4);
      const x = e.x * TS;
      const y = e.y * TS + 2;
      const gap = Math.round(6 * (1 - k));
      for (let i = -5; i <= 5; i += 2) {
        px(w, x + i, y - gap - 1, '#cfd6e6');
        px(w, x + i + 1, y + gap + 1, '#cfd6e6');
      }
    } else if (e.type === 'spike') {
      for (let k = 0; k < 4; k++) px(w, e.c * TS + 4 + k * 3, e.r * TS + 10 - Math.sin(a * Math.PI) * 5, '#eef3fa', 1);
    } else if (e.type === 'oilfire') {
      addLight((e.c + 0.5) * TS, (e.r + 0.5) * TS, 30, [255, 140, 60], 0.8 * (1 - a));
    } else if (e.type === 'rockfall') {
      for (const p of e.parts) {
        const pa = Math.max(0, (a - p.d) / (1 - p.d));
        const x = (e.c + 0.5) * TS + p.x;
        const y = (e.r - 1) * TS + pa * 24;
        px(w, x, y, '#6f6882', p.s);
        px(w, x, y, '#9a92ad');
      }
    } else if (e.type === 'mimik') {
      w.fillStyle = `rgba(255,70,60,${0.45 * (1 - a)})`;
      w.fillRect(e.c * TS, e.r * TS, TS, TS);
      addLabel('Schnapp!', (e.c + 0.5) * TS, (e.r + 0.1) * TS - a * 6, '#ff9a7a', 1 - a);
    } else if (e.type === 'teleport') {
      const cx = (e.c + 0.5) * TS;
      const cy = (e.r + 0.5) * TS;
      ring(w, cx, cy, 3 + a * 9, `rgba(200,150,255,${1 - a})`);
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * TAU + a * 5;
        glint(e.x * TS + Math.cos(ang) * 8 * a, e.y * TS - 8 + Math.sin(ang) * 8 * a, 1 - a);
      }
      addLight(cx, cy, 28, [190, 130, 255], 0.9 * (1 - a));
    } else if (e.type === 'levelup' || e.type === 'learn' || e.type === 'socket') {
      const cx = (e.c + 0.5) * TS;
      const cy = e.r * TS;
      for (const p of e.parts ?? []) glint(cx + Math.cos(p.a) * 6, cy - a * 14 - p.s * 6, (1 - a) * (0.4 + p.s));
      if (e.type === 'levelup') addLabel(`Stufe ${e.level}`, cx, cy - 6 - a * 8, '#fff2b0', a < 0.7 ? 1 : (1 - a) * 3.3);
      addLight(cx, cy + 4, 20, [255, 230, 150], 0.6 * (1 - a));
    } else if (e.type === 'build' || e.type === 'sell') {
      const cx = (e.c + 0.5) * TS;
      const cy = (e.r + 1) * TS - 2;
      for (const p of (e.parts ?? []).slice(0, 10)) {
        w.fillStyle = `rgba(200,190,170,${0.6 * (1 - a)})`;
        w.fillRect(Math.round(cx + Math.cos(p.a) * p.v * a), Math.round(cy - Math.abs(Math.sin(p.a)) * p.v * a * 0.5), 2, 2);
      }
    } else if (e.type === 'dig') {
      const o = chunkOrigin(e.cx, e.cy);
      for (const p of e.parts) {
        const x = (o.c + 1.5) * TS + Math.cos(p.a) * p.v * a * 1.4;
        const y = (o.r + 1.5) * TS + Math.sin(p.a) * p.v * a - a * 6;
        w.fillStyle = `rgba(150,140,160,${0.8 * (1 - a)})`;
        w.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
    } else if (e.type === 'windup') {
      ring(w, e.x * TS, e.y * TS - 8, 10 - a * 6, `rgba(255,236,170,${a})`);
      addLight(e.x * TS, e.y * TS - 10, 22, [255, 230, 160], 0.8 * a);
    } else if (e.type === 'balmung') {
      const cx = (e.c + 0.5) * TS;
      const cy = (e.r + 0.5) * TS;
      line(w, cx - 9 + a * 4, cy - 9, cx + 9, cy + 9 - a * 4, a < 0.5 ? '#ffffff' : '#ffd166');
      addLight(cx, cy, 26, [255, 230, 160], 0.9 * (1 - a));
    } else if (e.type === 'ember') {
      px(w, e.x * TS, e.y * TS - 8 - a * 6, FLAME[Math.floor(a * 4)]);
    } else if (e.type === 'spawn') {
      ring(w, e.x * TS, e.y * TS, 2 + a * 8, `rgba(255,236,200,${0.6 * (1 - a)})`);
    }
  }

  // Funken über dem Hort, Staub im Licht des Eingangs
  function updateMotes(state, time, dt, mood) {
    const c = Sim.chamberCenter(state);
    if (!reduceMotion && state.hoard.length && Math.random() < dt * (mood === 'night' ? 3 : 1.5)) {
      motes.push({ x: c.c * TS + 8 + (Math.random() - 0.5) * 34, y: c.r * TS + 14 + Math.random() * 6, vx: (Math.random() - 0.5) * 3, vy: -6 - Math.random() * 6, life: 1.6, t0: time, color: '#ffd98a', kind: 'spark' });
    }
    if (!reduceMotion && mood !== 'night' && Math.random() < dt * 2) {
      motes.push({ x: MOUTH.c * TS + 8 + (Math.random() - 0.5) * 20, y: TS + Math.random() * 30, vx: (Math.random() - 0.5) * 2, vy: -2 - Math.random() * 2, life: 3, t0: time, color: '#f4e8c8', kind: 'dust' });
    }
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      const age = (time - m.t0) / m.life;
      if (age >= 1) {
        motes.splice(i, 1);
        continue;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const a = Math.sin(age * Math.PI);
      w.fillStyle = m.color;
      w.globalAlpha = m.kind === 'dust' ? a * 0.5 : a;
      w.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
      w.globalAlpha = 1;
      if (m.kind === 'spark') glows.push([m.x, m.y, 3, [255, 200, 110], 0.3 * a]);
    }
  }

  // ── Bausteine der Welt ──

  function drawEntrances(state, night, time) {
    for (const e of state.entrances) {
      const x = e.c * TS;
      const y = e.r * TS;
      if (e.kind === 'mund') {
        addLight(x + 8, y + 10, night ? 60 : 70, night ? [110, 150, 235] : [255, 236, 205], night ? 0.7 : 0.45);
        continue;
      }
      w.drawImage(buildingImg(e.kind), x, y);
      const col = ENTRANCE_LIGHT[e.kind];
      addLight(x + 8, y + 8, night ? 28 : 18, col, night ? 0.6 : 0.25);
      if (e.kind === 'zwerge' && night) glows.push([x + 11, y + 6, 4, [255, 200, 110], 0.5 + 0.1 * Math.sin(time * 9)]);
    }
  }

  function drawBuildings(state, view, time, night, day) {
    const list = state.buildings.slice().sort((a, b) => a.r - b.r || a.c - b.c);
    // Fallen zuerst: Sie liegen flach auf dem Boden
    for (const b of list) {
      if (b.kind !== 'trap') continue;
      const x = b.c * TS;
      const y = b.r * TS;
      w.globalAlpha = night && b.cd > 0 ? 0.55 : 1;
      w.drawImage(buildingImg(b.id), x, y);
      w.globalAlpha = 1;
      if (b.id === 'oel' && b.burning > state.t && night) {
        for (let k = 0; k < 7; k++) {
          const fx = x + 2 + hash(b.uid, k, 1) * 12;
          const h = 3 + Math.sin(time * 11 + k * 1.7) * 2 + hash(b.uid, k, 2) * 4;
          px(w, fx, y + 12 - h, FLAME[1 + (k % 3)], 2);
          px(w, fx, y + 10 - h * 1.5, FLAME[0]);
        }
        addLight(x + 8, y + 8, 28, [255, 140, 60], 0.75);
      }
    }
    for (const b of list) {
      if (b.kind === 'trap') continue;
      const x = b.c * TS;
      if (b.kind === 'lure') {
        const y = b.r * TS - 2;
        const def = BUILDINGS[b.id].lure;
        const spent = night && (def.bite ? b.cd > 0 : b.charges <= 0);
        shadow(x + 8, b.r * TS + 13, 6);
        w.globalAlpha = spent ? 0.45 : 1;
        w.drawImage(blueprintImg(b.id), x, y);
        w.globalAlpha = 1;
        if (!spent && def.item) {
          const g = Sim.lureGlanz(state, b);
          for (let k = 0; k < Math.ceil(g / 3); k++) glint(x + 3 + hash(b.uid, k, 3) * 10, y + 3 + hash(b.uid, k, 4) * 8, Math.sin(time * 2 + k * 2) * 1.2);
        }
        continue;
      }
      // Turm: steht unten auf seinem Feld und ragt nach oben hinaus
      const y = b.r * TS - 4;
      const img = buildingImg(b.id);
      shadow(x + 8, b.r * TS + 14, 6);
      const broken = b.disabled > 0 && night;
      w.drawImage(broken ? tint(img, '#5a5266', `broken:${b.id}`) : img, x, y);
      const [col, r, a] = TOWER_LIGHT[b.id] ?? [[255, 200, 140], 14, 0.3];
      if (b.id === 'feuer') {
        const flick = Math.sin(time * 12 + b.uid) * 3 + Math.sin(time * 7.7 + b.uid * 2) * 2;
        addLight(x + 8, y + 6, r + flick, col, broken ? 0.1 : a);
        glows.push([x + 8, y + 5, 5, col, broken ? 0 : 0.4]);
      } else if (b.id === 'fluch') {
        addLight(x + 8, y + 9, r, col, broken ? 0 : a * (0.8 + 0.2 * Math.sin(time * 3 + b.uid)));
        glows.push([x + 8, y + 10, 4, col, broken ? 0 : 0.35]);
      } else {
        addLight(x + 12, y + 12, r, col, night ? a : a * 0.5);
      }
      if (broken) {
        for (let k = 0; k < 2; k++) glint(x + 4 + hash(b.uid, Math.floor(time * 6), k) * 8, y + 4 + hash(b.uid, Math.floor(time * 6), k + 5) * 10, 0.9);
      }
    }
  }

  // Der Hort: Goldhaufen, darauf die Schätze und der Drache
  function drawChamber(state, view, time, night, hub) {
    const cc = Sim.chamberCenter(state);
    const cx = cc.c * TS + 8;
    const cy = cc.r * TS + 8;
    const sp = SPECIES[state.opts.species];
    const pal = sp.palettes[state.opts.variant] ?? sp.palettes[0];
    // Goldhaufen
    const value = Sim.hoardValue(state);
    const rx = 15 + Math.min(8, value * 0.15);
    for (let y = -7; y <= 7; y++) {
      const span = Math.floor(rx * Math.sqrt(1 - (y / 8) ** 2));
      for (let x = -span; x <= span; x++) {
        const n = hash(cc.c * 31 + x, cc.r * 17 + y, 7);
        const edge = Math.abs(x) > span - 2;
        if (edge && n < 0.4) continue;
        w.fillStyle = n < 0.2 ? '#5e3a14' : n < 0.55 ? '#8a5a1c' : n < 0.85 ? '#b9822a' : n < 0.96 ? '#e2b444' : '#fbe38a';
        w.fillRect(cx + x, cy + 8 + y, 1, 1);
      }
    }
    // Drache hinter dem Haufen
    const awake = night;
    const blink = awake && time % 4.3 < 0.13;
    const spread = time < dragonAnim.wingUntil ? 1 : awake ? 0.5 : 0;
    const mouth = time < dragonAnim.mouthUntil;
    const img = hoardDragonImage(pal, { awake: awake && !blink, spread, mouth, scars: hub ? view.scars ?? 0 : state.opts.legend });
    const breath = Math.floor(time / (awake ? 0.7 : 1.5)) % 2;
    const shake = time < dragonAnim.roarUntil ? (Math.floor(time * 30) % 2 ? 1 : -1) : 0;
    const dx = cx - HOARD_DRAGON_W / 2 + shake;
    const dy = cy - 30 + breath;
    w.drawImage(img, dx, dy);
    const eyeY = dy + HOARD_HEAD_Y + 11;
    if (awake && !blink) {
      const rgb = [1, 3, 5].map((i) => parseInt(pal.eye.slice(i, i + 2), 16));
      for (const ex of [-7, 7]) {
        glows.push([cx + ex, eyeY, 4, rgb, 0.55]);
        addLight(cx + ex, eyeY, 14, rgb, 0.4);
      }
    }
    if (mouth) {
      glows.push([cx, dy + HOARD_HEAD_Y + 19, 7, [255, 170, 80], 0.6]);
      addLight(cx, dy + HOARD_HEAD_Y + 19, 26, [255, 150, 60], 0.7);
    }
    if (!awake && !reduceMotion) {
      for (let k = 0; k < 3; k++) {
        const t = (time * 0.35 + k / 3) % 1;
        const x = cx + 14 + t * 8 + Math.sin(t * 6) * 2;
        const y = dy + HOARD_HEAD_Y + 2 - t * 12;
        w.globalAlpha = Math.sin(t * Math.PI) * 0.9;
        w.fillStyle = '#e8e0f4';
        const s = k === 1 ? 3 : 2;
        w.fillRect(Math.round(x), Math.round(y), s + 1, 1);
        w.fillRect(Math.round(x) + s - 1, Math.round(y) + 1, 1, 1);
        w.fillRect(Math.round(x), Math.round(y) + s, s + 1, 1);
        w.globalAlpha = 1;
      }
    }
    // Schätze: das Ei vorn in der Mitte, die glänzendsten daneben
    const items = state.hoard.slice().sort((a, b) => TREASURES[b.id].glanz - TREASURES[a.id].glanz);
    const egg = items.find((i) => i.id === 'ei');
    const rest = items.filter((i) => i !== egg);
    const wanted = night ? new Set(state.heroes.filter((h) => Sim.isActive(h) && h.target?.kind === 'hoard').map((h) => h.target.uid)) : new Set();
    const place = (item, ox, oy) => {
      const x = cx + ox - 8;
      const y = cy + oy - 4;
      w.drawImage(treasureImg(item.id), x, y);
      const g = TREASURES[item.id].glanz;
      for (let k = 0; k < Math.ceil(g / 3); k++) glint(x + 3 + hash(item.uid, k, 3) * 10, y + 3 + hash(item.uid, k, 5) * 9, Math.sin(time * (1.2 + k) + item.uid) * 1.4 + g * 0.02);
      addLight(x + 8, y + 8, 8 + g * 2, treasureLight(item.id), night ? 0.2 + g * 0.025 : 0.08);
      if (wanted.has(item.uid)) ring(ov, x + 8, y + 8, 9, Math.floor(time * 4) % 2 ? 'rgba(255,122,107,0.95)' : 'rgba(255,122,107,0.5)', 1, 2);
    };
    rest.slice(0, 4).forEach((item, i) => place(item, PILE[i][0], PILE[i][1]));
    rest.slice(4, PILE.length).forEach((item, i) => place(item, PILE[i + 4][0], PILE[i + 4][1]));
    if (egg) place(egg, 0, 7);
    addLight(cx, cy + 6, 56 + Math.min(30, value * 0.6), [255, 190, 110], night ? 0.45 + Math.min(0.35, value / 120) : 0.3);
  }

  function drawFloorItems(state, time) {
    for (const f of state.floor) {
      const x = f.c * TS;
      const y = f.r * TS;
      shadow(x + 8, y + 14, 5);
      w.drawImage(treasureImg(f.item.id), x, y - 1 - (Math.floor(time * 3 + f.item.uid) % 2));
      glint(x + 4 + hash(f.item.uid, 1, 1) * 8, y + 4, Math.sin(time * 3 + f.item.uid) * 1.2);
    }
  }

  function drawGuardians(state, night) {
    for (const g of state.guardians) {
      const x = g.c * TS;
      const y = g.r * TS - 4;
      shadow(x + 8, y + 18, 5);
      w.globalAlpha = night ? 1 : 0.55;
      w.drawImage(guardianImg(), x, y);
      w.globalAlpha = 1;
      if (night) {
        glows.push([x + 6, y + 8, 3, [150, 255, 120], 0.5]);
        glows.push([x + 10, y + 8, 3, [150, 255, 120], 0.5]);
      }
    }
  }

  function drawHeroes(state, view, time, night) {
    const list = state.heroes.filter(Sim.isActive).sort((a, b) => a.y - b.y);
    for (const h of list) {
      const wk = walkers.get(h.uid) ?? { x: h.x, flip: false };
      if (Math.abs(h.x - wk.x) > 0.004) wk.flip = h.x < wk.x;
      wk.x = h.x;
      walkers.set(h.uid, wk);
      const moving = h.state === 'seek' || h.state === 'flee' || h.state === 'leave';
      const bob = moving && !(h.stun > 0) && !(h.windup > 0) && Math.floor(time * 9 + h.uid) % 2 === 0 ? 1 : 0;
      const base = heroImg(h.type);
      const img = wk.flip ? flipX(base, `hero:${h.type}:flip`) : base;
      const fx = Math.round(h.x * TS);
      const fy = Math.round(h.y * TS + 6);
      const x = fx - Math.floor(img.width / 2);
      const y = fy - img.height - bob;
      shadow(fx, fy, h.boss ? 7 : 5);
      if (h.carry) ring(w, fx, fy, 6, Math.floor(time * 6) % 2 ? '#ff6b5a' : '#c8323c', 1);
      let drawn = img;
      if (h.hit > 0) drawn = tint(img, '#ffffff', `hero:${h.type}:${wk.flip}:hit`);
      else if (h.frost > state.t) drawn = tint(img, '#bfe8ff', `hero:${h.type}:${wk.flip}:frost`);
      w.drawImage(drawn, x, y);
      if (h.wears) w.drawImage(treasureImg(h.wears), x + 6, y + 6);
      if (h.carry) w.drawImage(treasureImg(h.carry.id), fx - 8, y - 11);
      if (h.stun > 0) {
        for (let k = 0; k < 3; k++) {
          const ang = time * 5 + (k * TAU) / 3;
          px(w, fx + Math.cos(ang) * 6, y - 2 + Math.sin(ang) * 2, '#fff2b0');
        }
      }
      if (h.burn && h.burn.until > state.t) {
        for (let k = 0; k < 3; k++) {
          const t = (time * 2 + k / 3 + h.uid * 0.13) % 1;
          px(w, fx - 4 + k * 4, y + 12 - t * 10, FLAME[Math.min(4, Math.floor(t * 5))]);
        }
        addLight(fx, y + 8, 14, [255, 140, 60], 0.45);
      }
      if (h.curse && h.curse.until > state.t) {
        const t = time * 3 + h.uid;
        for (let k = 0; k < 2; k++) px(w, fx + Math.cos(t + k * Math.PI) * 6, y + 6 + Math.sin(t * 1.3 + k) * 3, '#d0a8ff');
        glows.push([fx, y + 8, 6, [170, 100, 255], 0.3]);
      }
      if (night && TORCH[h.type]) {
        const flick = Math.sin(time * 13 + h.uid) * 2 + Math.sin(time * 7.3 + h.uid * 3) * 1.5;
        addLight(fx + (wk.flip ? -4 : 4), y + 6, 30 + flick, TORCH[h.type], 0.8);
        glows.push([fx + (wk.flip ? -4 : 4), y + 6, 4, TORCH[h.type], 0.25]);
      } else if (night) {
        glows.push([fx, y + 9, 3, [220, 255, 220], 0.35]);
        addLight(fx, y + 10, 12, [160, 200, 255], 0.25);
      }
      if (h.state === 'cast' && h.target) castBeam(state, h, fx, y, time);
      if (h.boss && h.windup > 0) glows.push([x + 2, y + 2, 6, [255, 240, 200], 0.8]);
      heroUI(state, h, fx, y, time);
    }
  }

  function castBeam(state, h, fx, y, time) {
    const k = Math.min(1, h.castT / h.caster.time);
    const c = Sim.chamberCenter(state);
    const tx = (c.c + 0.5) * TS;
    const ty = (c.r + 0.5) * TS + 6;
    const sx = fx + 5;
    const sy = y + 2;
    const n = Math.max(2, Math.round(Math.hypot(tx - sx, ty - sy) / 3));
    for (let i = 0; i <= n; i++) {
      if ((i + Math.floor(time * 10)) % 2) continue;
      const t = i / n;
      px(w, sx + (tx - sx) * t, sy + (ty - sy) * t + Math.sin(t * 12 + time * 8) * 1.2, `rgba(200,150,255,${0.5 + 0.5 * k})`);
    }
    ring(ov, tx, ty, 9, '#c8a0ff', k);
    addLight(tx, ty, 16 + k * 10, [190, 130, 255], 0.4 + 0.5 * k);
  }

  // Leben, Rüstung und Segen als ein Balken: rot, weiß, blau. Schaden frisst sich von rechts hinein.
  function heroUI(state, h, fx, y, time) {
    const top = h.carry ? y - 13 : y - 3;
    const width = h.boss ? 20 : 12;
    const total = h.max.leben + h.max.ruestung + h.max.segen || 1;
    ov.fillStyle = '#140f1c';
    ov.fillRect(fx - width / 2 - 1, top - 1, width + 2, 4);
    ov.fillStyle = '#3a2430';
    ov.fillRect(fx - width / 2, top, width, 2);
    let x = fx - width / 2;
    for (const layer of ['leben', 'ruestung', 'segen']) {
      const px2 = Math.round((h.hp[layer] / total) * width);
      if (px2 <= 0) continue;
      ov.fillStyle = LAYER_COLOR[layer];
      ov.fillRect(x, top, Math.min(px2, fx + width / 2 - x), 2);
      x += px2;
    }
    if (h.state === 'grab') ring(ov, fx, y + 11, 9, '#ffd36b', Math.min(1, h.grabT / Sim.grabTimeOf(state, h)));
    if (h.name) addLabel(h.boss ? h.name : `${h.name} ${'★'.repeat(h.rank)}`, fx, top - 4, h.boss ? '#ffd166' : '#ff9a8a', 1, 0.9);
  }

  // ── Ebene über dem Licht: Bauplätze, Auswahl, Reichweiten, Vorschau beim Graben ──

  function buildUI(state, view, time) {
    const handId = view.card != null ? state.deck.hand[view.card] : null;
    if (handId) {
      // Gültige Plätze leicht grün, das Feld unter dem Zeiger mit Vorschau
      for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (!Sim.canPlace(state, handId, c, r).ok) continue;
        ov.fillStyle = 'rgba(155,227,143,0.16)';
        ov.fillRect(c * TS + 1, r * TS + 1, TS - 2, TS - 2);
      }
      if (view.hover) {
        const { c, r } = view.hover;
        const ok = Sim.canPlace(state, handId, c, r).ok;
        const def = BUILDINGS[handId];
        ov.globalAlpha = ok ? 0.7 : 0.3;
        ov.drawImage(blueprintImg(handId), c * TS, r * TS - (def.kind === 'tower' ? 4 : def.kind === 'lure' ? 2 : 0));
        ov.globalAlpha = 1;
        if (def.kind === 'tower') {
          const range = def.tower.range + (tileAt(state.tiles, c, r) === 'l' ? 0.6 : 0);
          ring(ov, (c + 0.5) * TS, (r + 0.5) * TS, range * TS, ok ? 'rgba(155,227,143,0.9)' : 'rgba(255,122,107,0.7)', 1, 2);
        }
        frame(ov, c * TS, r * TS, ok ? '#a6ec8f' : '#ff7a6b', view.input === 'pad' ? 2 : 1);
      }
    } else if (view.hover && view.input === 'pad') {
      frame(ov, view.hover.c * TS, view.hover.r * TS, Math.floor(time * 4) % 2 ? '#fff2b0' : '#f2c94c', 2);
    } else if (view.hover && Sim.buildingAt(state, view.hover.c, view.hover.r)) {
      frame(ov, view.hover.c * TS, view.hover.r * TS, 'rgba(243,217,141,0.85)', 1);
    }
  }

  function selectionUI(state, view, time) {
    const b = view.selected != null ? Sim.buildingByUid(state, view.selected) : null;
    if (b) {
      frame(ov, b.c * TS, b.r * TS, Math.floor(time * 6) % 2 ? '#fff2b0' : '#f2c94c', 1);
      if (b.kind === 'tower') ring(ov, (b.c + 0.5) * TS, (b.r + 0.5) * TS, b.stats.range * TS, 'rgba(243,217,141,0.85)', 1, 2);
    }
    // Stufe und freie Punkte an jedem Turm
    for (const t of state.buildings) {
      if (t.kind !== 'tower') continue;
      const x = t.c * TS;
      const y = t.r * TS;
      if (t.level > 0) drawDigits(ov, t.level, x + 12, y + 10, '#f2c94c');
      if (Sim.DAY_PHASES.has(state.phase) && Sim.pointsLeft(t) > 0) {
        const bob = Math.floor(time * 3) % 2;
        drawDigits(ov, '+', x + 6, y - 10 - bob, '#a6ec8f');
      }
    }
  }

  function digUI(state, view, time) {
    if (state.phase !== 'dig' || !state.offers.length) return;
    const ch = state.chamber;
    const options = Sim.digDirections(state);
    const offer = view.dig?.offer != null ? state.offers[view.dig.offer] : null;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    for (const o of options) {
      const origin = chunkOrigin(o.cx, o.cy);
      const chosen = view.dig?.dir === o.dir;
      ov.fillStyle = chosen ? `rgba(242,201,76,${0.18 + 0.1 * pulse})` : `rgba(242,201,76,${0.06 + 0.06 * pulse})`;
      ov.fillRect(origin.c * TS, origin.r * TS, K * TS, K * TS);
      frame(ov, origin.c * TS, origin.r * TS, chosen ? '#fff2b0' : 'rgba(242,201,76,0.7)', chosen ? 2 : 1, K * TS);
      // Pfeil in Grabrichtung
      const [dx, dy] = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[o.dir];
      const ax = (origin.c + 1.5) * TS;
      const ay = (origin.r + 1.5) * TS;
      for (let i = -4; i <= 4; i++) px(ov, ax + dx * i, ay + dy * i, '#f2c94c');
      for (let i = 1; i <= 3; i++) {
        px(ov, ax + dx * 4 - dx * i + dy * i, ay + dy * 4 - dy * i + dx * i, '#f2c94c');
        px(ov, ax + dx * 4 - dx * i - dy * i, ay + dy * 4 - dy * i - dx * i, '#f2c94c');
      }
    }
    // Abschnitte, in die noch niemand gegraben hat, als feine Fugen
    ov.fillStyle = 'rgba(12,9,18,0.35)';
    for (let cy = 0; cy < 5; cy++) for (let cx = 0; cx < 5; cx++) {
      const o = chunkOrigin(cx, cy);
      if (tileAt(state.tiles, o.c + 1, o.r + 1) !== '#') continue;
      for (let i = 0; i < K * TS; i += 2) {
        ov.fillRect(o.c * TS + i, o.r * TS, 1, 1);
        ov.fillRect(o.c * TS, o.r * TS + i, 1, 1);
      }
    }
    if (!offer || !view.dig?.dir) return;
    const target = options.find((o) => o.dir === view.dig.dir);
    if (target) {
      // Dorthin zieht die Hortkammer
      const o = chunkOrigin(target.cx, target.cy);
      ov.globalAlpha = 0.55 + 0.25 * pulse;
      ov.drawImage(treasureImg('ei'), (o.c + 1) * TS, (o.r + 1) * TS);
      ov.globalAlpha = 1;
      addLabel('Hort', (o.c + 1.5) * TS, (o.r + 0.75) * TS, '#fff2b0', 0.9, 0.8);
    }
    const layout = Sim.pieceLayout(state, offer, ch.cx, ch.cy, ch.entry, view.dig.dir);
    for (const t of layout.path) {
      ov.fillStyle = `rgba(232,220,192,${0.25 + 0.15 * pulse})`;
      ov.fillRect(t.c * TS + 2, t.r * TS + 2, TS - 4, TS - 4);
    }
    for (const f of layout.features) {
      const x = f.c * TS;
      const y = f.r * TS;
      if (f.kind === 'vein') {
        for (let k = 0; k < 4; k++) px(ov, x + 3 + k * 3, y + 5 + (k % 2) * 4, '#f2c94c', 2);
      } else if (f.kind === 'ledge') {
        frame(ov, x, y, '#b9d0ea', 1);
      } else if (f.kind === 'entrance') {
        ov.globalAlpha = 0.75;
        ov.drawImage(buildingImg(offer.entrance), x, y);
        ov.globalAlpha = 1;
        frame(ov, x, y, '#ff7a6b', 1);
      }
    }
  }

  function drawTargeting(state, view) {
    if (state.phase !== 'night' || view.ability !== 'feuer') return;
    const at = view.input === 'pad' && view.cursor ? { c: Math.floor(view.cursor.x), r: Math.floor(view.cursor.y) } : view.hover;
    if (at) {
      const { c, r } = at;
      ov.fillStyle = 'rgba(255,138,61,0.22)';
      ov.fillRect((c - 1) * TS, (r - 1) * TS, 3 * TS, 3 * TS);
      ov.fillStyle = '#ff8a3d';
      ov.fillRect((c - 1) * TS, (r - 1) * TS, 3 * TS, 1);
      ov.fillRect((c - 1) * TS, (r + 2) * TS - 1, 3 * TS, 1);
      ov.fillRect((c - 1) * TS, (r - 1) * TS, 1, 3 * TS);
      ov.fillRect((c + 2) * TS - 1, (r - 1) * TS, 1, 3 * TS);
    }
    if (view.input === 'pad' && view.cursor) {
      const x = Math.round(view.cursor.x * TS);
      const y = Math.round(view.cursor.y * TS);
      ov.fillStyle = '#fff2b0';
      for (const [dx, dy] of N4) for (let i = 2; i <= 5; i++) ov.fillRect(x + dx * i, y + dy * i, 1, 1);
    }
  }

  function wingReach(state, time) {
    // Wo der Flügelschlag hinreicht, wenn man darüber nachdenkt (gestrichelt)
    const c = Sim.chamberCenter(state);
    ring(ov, (c.c + 0.5) * TS, (c.r + 0.5) * TS, DRAGON.abilities[1].range * TS, `rgba(230,236,250,${0.4 + 0.2 * Math.sin(time * 5)})`, 1, 3);
  }

  // ── Licht ──

  function buildLight() {
    li.globalCompositeOperation = 'source-over';
    li.fillStyle = `rgb(${ambient.map(Math.round).join(',')})`;
    li.fillRect(0, 0, NW, NH);
    li.globalCompositeOperation = 'lighter';
    for (const [x, y, r, [cr, cg, cb], a] of lights) {
      if (a <= 0 || r <= 0) continue;
      const g = li.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${Math.min(1, a)})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      li.fillStyle = g;
      li.fillRect(x - r, y - r, r * 2, r * 2);
    }
    gl.globalCompositeOperation = 'source-over';
    gl.clearRect(0, 0, NW, NH);
    gl.globalCompositeOperation = 'lighter';
    for (const [x, y, r, [cr, cg, cb], a] of glows) {
      if (a <= 0) continue;
      const g = gl.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${Math.min(1, a)})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      gl.fillStyle = g;
      gl.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  // ── Bild ──

  function draw(state, view, time) {
    const dt = Math.min(0.1, Math.max(0, time - lastTime));
    lastTime = time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!state) return;
    for (const e of state.fx) addEffect(e, time, state);
    state.fx.length = 0;

    const key = state.tiles.join('');
    if (key !== caveKey) {
      cave = buildCave(state.tiles);
      caveKey = key;
    }

    const hub = !!view.hub;
    const night = state.phase === 'night';
    const day = Sim.DAY_PHASES.has(state.phase) && !hub;
    const mood = hub ? 'hub' : night ? 'night' : state.phase === 'won' || state.phase === 'lost' ? 'end' : 'day';
    const target = AMBIENT[mood];
    const k = 1 - Math.exp(-dt * 2.5);
    for (let i = 0; i < 3; i++) ambient[i] += (target[i] - ambient[i]) * k;
    lights = [];
    glows = [];
    labels = [];

    // Welt
    w.globalCompositeOperation = 'source-over';
    w.clearRect(0, 0, NW, NH);
    w.drawImage(cave, 0, 0);
    ov.clearRect(0, 0, NW, NH);
    drawEntrances(state, night, time);
    // Goldadern funkeln
    for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (tileAt(state.tiles, c, r) !== 'v') continue;
      glint(c * TS + 4 + hash(c, r, 9) * 8, r * TS + 3 + hash(c, r, 8) * 6, Math.sin(time * 1.7 + c * 3 + r) * 1.3);
      addLight(c * TS + 8, r * TS + 6, 12, [255, 210, 120], night ? 0.25 : 0.1);
    }
    drawBuildings(state, view, time, night, day);
    drawChamber(state, view, time, night, hub);
    drawFloorItems(state, time);
    drawGuardians(state, night);
    drawHeroes(state, view, time, night);
    drawEffects(time, state);
    updateMotes(state, time, dt, mood);

    // Ebene über dem Licht
    if (!hub) {
      if (day) {
        digUI(state, view, time);
        buildUI(state, view, time);
      }
      selectionUI(state, view, time);
      if (night && view.ability === 'fluegel') wingReach(state, time);
      drawTargeting(state, view);
    }

    buildLight();

    // Zusammensetzen
    const shake = time < shakeUntil ? S : 0;
    const ox = shake ? Math.round((Math.random() - 0.5) * 2) * shake : 0;
    const oy = shake ? Math.round((Math.random() - 0.5) * 2) * shake : 0;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(world, ox, oy, NW * S, NH * S);
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(light, ox, oy, NW * S, NH * S);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowC, ox, oy, NW * S, NH * S);
    ctx.globalCompositeOperation = 'source-over';
    const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.4, canvas.width / 2, canvas.height / 2, canvas.height * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(6,4,10,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(over, ox, oy, NW * S, NH * S);
    drawLabels();
  }

  // Schrift in Bildschirmauflösung mit der Pixel-Schrift, dunkel umrandet
  function drawLabels() {
    if (!labels.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    for (const l of labels) {
      const size = Math.max(10, Math.round(S * 6 * l.size));
      ctx.font = `600 ${size}px ${FONT}`;
      ctx.globalAlpha = Math.max(0, Math.min(1, l.alpha));
      ctx.lineWidth = Math.max(2, S * 1.4);
      ctx.strokeStyle = '#140f1c';
      const x = Math.round(l.x * S);
      const y = Math.round(l.y * S);
      ctx.strokeText(l.text, x, y);
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, x, y);
    }
    ctx.restore();
  }

  function chunkAt(clientX, clientY) {
    const cell = cellAt(clientX, clientY);
    if (!cell || cell.r < 1) return null;
    return chunkOf(cell.c, cell.r);
  }

  return { resize, draw, cellAt, heroAt, cellCenter, chunkAt, tileSize: () => T };
}
