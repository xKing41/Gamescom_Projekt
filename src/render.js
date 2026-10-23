// Zeichnet die Höhle in Pixel-Art. Erst die Welt in Originalgröße (16 Pixel pro Feld),
// dann das Licht darüber (Hort-Glühen, Fackeln, Mondlicht, Feuer), zuletzt Rahmen, Zahlen und Balken.
// Liest nur den Spielzustand und die Ansicht – verändert nichts daran.

import { COLS, ROWS, MAP, HOARD_CELLS, DRAGON_CENTER, inside } from './map.js';
import { TREASURES, CARD_BY_ID, SPECIES } from './data.js';
import { effGlanz, effWeight, itemAt, isActive, distToDragon, DAY_PHASES, hoardValue } from './sim.js';
import { makeCanvas, flipX, tint } from './pixel/sprite.js';
import { treasureImg, heroImg, guardianImg, treasureLight } from './pixel/images.js';
import { dragonImage, DRAGON_W, HEAD_Y } from './pixel/dragon.js';
import { buildCave, TS } from './pixel/cave.js';
import { drawDigits, digitWidth } from './pixel/font.js';

const TAU = Math.PI * 2;
const NW = COLS * TS;
const NH = ROWS * TS;
const FONT = '"Pixelify Sans", "Alegreya Sans", system-ui, sans-serif';
const TONES = { warn: '#ffd166', bad: '#ff7a6b', good: '#a6ec8f', info: '#b9d0ea' };
const DURATION = { fire: 0.95, claw: 0.28, bite: 0.42, wing: 0.7, roar: 0.9, merge: 0.8, mimik: 0.55, text: 1.5, dmg: 0.8, death: 0.8, grab: 0.6, snare: 0.6, teleport: 0.9, smoke: 0.7, tail: 0.5, rain: 1.5 };
// Grundlicht je Stimmung: nachts dunkelblau, tagsüber warm gedämpft
const AMBIENT = { night: [50, 52, 98], day: [228, 212, 204], hub: [188, 170, 178], end: [204, 190, 192] };
// Wer nachts eine Fackel trägt (Diebe schleichen im Dunkeln)
const TORCH = { bauer: [255, 150, 70], soeldner: [255, 150, 70], paladin: [255, 190, 120], zwerg: [255, 200, 110], magier: [190, 130, 255] };
const DRAGON_X = DRAGON_CENTER.x * TS - DRAGON_W / 2;
// Der Drache ragt oben aus dem Bild: so sitzt sein Gesicht über dem Hort statt dahinter
const DRAGON_Y = -9;
const MOUTH = { x: DRAGON_CENTER.x * TS, y: DRAGON_Y + HEAD_Y + 19 };
const EYE_Y = DRAGON_Y + HEAD_Y + 11;

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
  uniq.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  // Oben beginnen und im Uhrzeigersinn laufen
  const start = uniq.findIndex((p) => p[0] >= 0 && p[1] < 0);
  const sorted = [...uniq.slice(start), ...uniq.slice(0, start)].sort((a, b) => ((Math.atan2(a[0], -a[1]) + TAU) % TAU) - ((Math.atan2(b[0], -b[1]) + TAU) % TAU));
  ringCache.set(r, sorted);
  return sorted;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const cave = buildCave();
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
      if (!isActive(h)) continue;
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
    for (;;) {
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

  function ring(g, cx, cy, r, color, part = 1) {
    const pts = ringPoints(Math.max(1, Math.round(r)));
    const n = Math.round(pts.length * part);
    g.fillStyle = color;
    for (let i = 0; i < n; i++) g.fillRect(Math.round(cx) + pts[i][0], Math.round(cy) + pts[i][1], 1, 1);
  }

  // Schatten unter Dingen: eine flache, halbdunkle Pixel-Ellipse
  function shadow(cx, cy, rx) {
    w.fillStyle = 'rgba(8,6,12,0.45)';
    w.fillRect(Math.round(cx - rx + 1), Math.round(cy), rx * 2 - 2, 1);
    w.fillRect(Math.round(cx - rx + 2), Math.round(cy + 1), rx * 2 - 4, 1);
    w.fillRect(Math.round(cx - rx + 2), Math.round(cy - 1), rx * 2 - 4, 1);
  }

  // Funkeln: ein kleines Kreuz aus Licht
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
    if (k > 0.85) {
      w.fillStyle = `rgba(255,236,170,${a * 0.5})`;
      w.fillRect(Math.round(x) - 2, Math.round(y), 1, 1);
      w.fillRect(Math.round(x) + 2, Math.round(y), 1, 1);
      w.fillRect(Math.round(x), Math.round(y) - 2, 1, 1);
      w.fillRect(Math.round(x), Math.round(y) + 2, 1, 1);
    }
    glows.push([x, y, 5, [255, 230, 160], 0.35 * a]);
  }

  const addLight = (x, y, r, color, a) => lights.push([x, y, r, color, a]);
  const addLabel = (text, x, y, color, alpha = 1, size = 1) => labels.push({ text, x, y, color, alpha, size });

  // ── Effekte ──

  function addEffect(e, time) {
    const fx = { ...e, t0: time };
    const many = reduceMotion ? 0.4 : 1;
    if (e.type === 'fire') {
      fx.parts = Array.from({ length: Math.round(44 * many) }, () => ({ x: (Math.random() - 0.5) * 44, y: (Math.random() - 0.5) * 40, v: 6 + Math.random() * 16, s: 1 + Math.floor(Math.random() * 3), d: Math.random() * 0.25 }));
      dragonAnim.mouthUntil = time + 0.6;
    }
    if (e.type === 'merge' || e.type === 'death' || e.type === 'grab') {
      fx.parts = Array.from({ length: Math.round(16 * many) }, () => ({ a: Math.random() * TAU, v: 8 + Math.random() * 18, s: Math.random() }));
    }
    if (e.type === 'wing') dragonAnim.wingUntil = time + 0.7;
    if (e.type === 'roar') {
      dragonAnim.roarUntil = time + 0.8;
      dragonAnim.mouthUntil = time + 0.6;
      if (!reduceMotion) shakeUntil = time + 0.45;
      for (let i = 0; i < 24 * many; i++) motes.push({ x: 20 + Math.random() * (NW - 40), y: 14 + Math.random() * 4, vx: 0, vy: 14 + Math.random() * 20, life: 1.2, t0: time, color: '#8a7ca0', kind: 'dust' });
    }
    if (e.type === 'bite') dragonAnim.mouthUntil = time + 0.3;
    if (e.type === 'rain') {
      fx.parts = Array.from({ length: Math.round(70 * many) }, () => ({ x: Math.random() * NW, y: -Math.random() * NH * 0.6, v: 60 + Math.random() * 70, s: Math.random() }));
      dragonAnim.mouthUntil = time + 0.9;
    }
    if (e.type === 'tail') dragonAnim.wingUntil = time + 0.4;
    effects.push(fx);
  }

  function drawEffects(time) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      const age = (time - e.t0) / (DURATION[e.type] ?? 1);
      if (age >= 1) {
        effects.splice(i, 1);
        continue;
      }
      drawEffect(e, age, time);
    }
  }

  const FLAME = ['#fff6c0', '#ffd166', '#ff9a3c', '#e0531f', '#8a2a1a', '#4a3a44'];

  function drawEffect(e, a, time) {
    if (e.type === 'fire') {
      const tx = (e.c + 0.5) * TS;
      const ty = (e.r + 0.5) * TS;
      // Feuerstrahl vom Maul zum Ziel
      if (a < 0.4) {
        const k = a / 0.4;
        for (let i = 0; i <= 16; i++) {
          const t = i / 16;
          if (t > k * 1.6) break;
          const x = MOUTH.x + (tx - MOUTH.x) * t + Math.sin(time * 40 + i) * 1.5;
          const y = MOUTH.y + (ty - MOUTH.y) * t + Math.cos(time * 37 + i) * 1.5;
          const size = 2 + Math.round(t * 2);
          px(w, x - size / 2, y - size / 2, FLAME[Math.min(3, Math.floor((1 - t) * 1.5 + k * 2))], size);
          if (i % 4 === 0) addLight(x, y, 18, [255, 160, 70], 0.5);
        }
      }
      // Flammen auf 3 × 3 Feldern
      for (const p of e.parts) {
        const pa = (a - p.d) / (1 - p.d);
        if (pa <= 0) continue;
        const color = FLAME[Math.min(FLAME.length - 1, Math.floor(pa * FLAME.length))];
        px(w, tx + p.x * (0.6 + pa * 0.4), ty + p.y - p.v * pa, color, Math.max(1, Math.round(p.s * (1 - pa * 0.5))));
      }
      addLight(tx, ty, 54, [255, 150, 60], 1.1 * (1 - a));
      glows.push([tx, ty, 26, [255, 170, 80], 0.6 * (1 - a)]);
    } else if (e.type === 'claw') {
      const k = Math.min(1, a * 3);
      for (let s = -1; s <= 1; s++) {
        const x0 = e.x * TS - 6 + s * 4;
        const y0 = e.y * TS - 16;
        line(w, x0, y0, x0 + 9 * k, y0 + 13 * k, a < 0.5 ? '#fff6e8' : '#ffb380');
      }
      addLight(e.x * TS, e.y * TS - 8, 16, [255, 220, 200], 0.5 * (1 - a));
    } else if (e.type === 'bite') {
      const k = Math.min(1, a * 3.2);
      const x = e.x * TS;
      const y = e.y * TS - 8;
      const gap = Math.round(9 * (1 - k));
      for (let i = -6; i <= 6; i += 2) {
        px(w, x + i, y - gap - 2, '#fff6e8');
        px(w, x + i, y - gap - 1, '#fff6e8');
        px(w, x + i + 1, y - gap - 3, '#cfc6b0');
        px(w, x + i + 1, y + gap + 1, '#fff6e8');
        px(w, x + i + 1, y + gap, '#fff6e8');
        px(w, x + i, y + gap + 2, '#cfc6b0');
      }
      addLight(x, y, 20, [255, 80, 70], 0.7 * (1 - a));
    } else if (e.type === 'wing') {
      for (let k = 0; k < 7; k++) {
        const ang = Math.PI * (0.08 + (k / 6) * 0.84);
        const r0 = 20 + a * 90;
        const x = DRAGON_CENTER.x * TS + Math.cos(ang) * r0;
        const y = DRAGON_CENTER.y * TS + Math.sin(ang) * r0 * 0.9;
        const col = `rgba(230,236,250,${0.7 * (1 - a)})`;
        line(w, x, y, x + Math.cos(ang) * 8, y + Math.sin(ang) * 7, col);
      }
    } else if (e.type === 'roar') {
      for (let k = 0; k < 3; k++) {
        const aa = a - k * 0.15;
        if (aa <= 0) continue;
        ring(w, MOUTH.x, MOUTH.y, 10 + aa * 140, `rgba(255,190,120,${0.65 * (1 - aa)})`);
      }
      addLight(MOUTH.x, MOUTH.y, 30, [255, 160, 90], 0.6 * (1 - a));
    } else if (e.type === 'merge') {
      const cx = (e.c + 0.5) * TS;
      const cy = (e.r + 0.5) * TS;
      ring(w, cx, cy, 4 + a * 12, `rgba(255,220,130,${1 - a})`);
      for (const p of e.parts) glint(cx + Math.cos(p.a) * p.v * a, cy + Math.sin(p.a) * p.v * a, (1 - a) * (0.6 + p.s * 0.6));
      addLight(cx, cy, 30, [255, 210, 120], 0.9 * (1 - a));
    } else if (e.type === 'mimik') {
      w.fillStyle = `rgba(255,70,60,${0.45 * (1 - a)})`;
      w.fillRect(e.c * TS, e.r * TS, TS, TS);
      addLabel('Schnapp!', (e.c + 0.5) * TS, (e.r + 0.1) * TS - a * 6, '#ff9a7a', 1 - a);
    } else if (e.type === 'text') {
      addLabel(e.text, e.x * TS, e.y * TS - a * 10, TONES[e.tone] ?? '#f1e8da', a < 0.75 ? 1 : (1 - a) * 4);
    } else if (e.type === 'dmg') {
      const text = e.text;
      const x = Math.round(e.x * TS - digitWidth(text) / 2);
      const y = Math.round(e.y * TS - 14 - a * 9);
      ov.globalAlpha = Math.min(1, (1 - a) * 2);
      drawDigits(ov, text, x, y, '#fff1d6');
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
      line(w, x - 6, y - gap, x + 6, y - gap, '#6d788c');
      line(w, x - 6, y + gap, x + 6, y + gap, '#6d788c');
    } else if (e.type === 'teleport') {
      const cx = (e.c + 0.5) * TS;
      const cy = (e.r + 0.5) * TS;
      ring(w, cx, cy, 3 + a * 9, `rgba(200,150,255,${1 - a})`);
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * TAU + a * 5;
        glint(e.x * TS + Math.cos(ang) * 8 * a, e.y * TS - 8 + Math.sin(ang) * 8 * a, 1 - a);
      }
      addLight(cx, cy, 28, [190, 130, 255], 0.9 * (1 - a));
    } else if (e.type === 'smoke') {
      const r = 6 + a * 20;
      w.fillStyle = `rgba(200,195,210,${0.35 * (1 - a)})`;
      w.beginPath();
      w.arc((e.c + 0.5) * TS, (e.r + 0.5) * TS, r, 0, TAU);
      w.fill();
    } else if (e.type === 'tail') {
      const r = 24 + a * 34;
      const pts = ringPoints(Math.round(r));
      w.fillStyle = `rgba(255,224,170,${0.8 * (1 - a)})`;
      for (const [x, y] of pts) if (y > 4) w.fillRect(DRAGON_CENTER.x * TS + x, DRAGON_CENTER.y * TS + 6 + y, 1, 1);
    } else if (e.type === 'rain') {
      for (const p of e.parts) {
        const y = p.y + a * p.v * 2.2;
        if (y < 0 || y > NH) continue;
        const color = p.s > 0.6 ? '#ffd166' : p.s > 0.3 ? '#ff9a3c' : '#e0531f';
        px(w, p.x, y, color);
        px(w, p.x, y - 1, 'rgba(255,140,60,0.5)');
        if (p.s > 0.85) addLight(p.x, y, 10, [255, 150, 60], 0.35);
      }
      addLight(NW / 2, NH / 2, 140, [255, 120, 50], 0.25 * Math.sin(a * Math.PI));
    }
  }

  // Funken über dem Hort, Staub im Licht des Eingangs, Schlaf-Z des Drachen
  function updateMotes(state, time, dt, mood) {
    if (!reduceMotion && Math.random() < dt * (mood === 'night' ? 3 : 1.5)) {
      const cell = HOARD_CELLS[Math.floor(Math.random() * HOARD_CELLS.length)];
      if (itemAt(state, cell.c, cell.r)) motes.push({ x: cell.c * TS + 2 + Math.random() * 12, y: cell.r * TS + 6 + Math.random() * 8, vx: (Math.random() - 0.5) * 3, vy: -6 - Math.random() * 6, life: 1.6, t0: time, color: '#ffd98a', kind: 'spark' });
    }
    if (!reduceMotion && mood !== 'night' && Math.random() < dt * 2) {
      motes.push({ x: NW / 2 + (Math.random() - 0.5) * 40, y: NH - 4 - Math.random() * 30, vx: (Math.random() - 0.5) * 2, vy: -2 - Math.random() * 2, life: 3, t0: time, color: '#f4e8c8', kind: 'dust' });
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

  function heldItem(state, view) {
    const from = view.drag?.moved ? view.drag.from : view.held;
    if (!from) return null;
    return from.where === 'tray' ? state.tray[from.i] ?? null : itemAt(state, from.c, from.r);
  }

  function sparkles(uid, x, y, glanz, time) {
    const n = Math.ceil(glanz / 2);
    for (let k = 0; k < n; k++) {
      const h1 = hash(uid, k, 3);
      const h2 = hash(uid, k, 5);
      const tw = Math.sin(time * (1.2 + h1 * 2.2) + h2 * 9);
      glint(x + 3 + Math.floor(h1 * 10), y + 3 + Math.floor(h2 * 9), (tw - 0.35) * 1.6 + glanz * 0.02);
    }
  }

  function drawHoard(state, view, time) {
    for (const { c, r } of HOARD_CELLS) {
      const item = itemAt(state, c, r);
      if (!item) continue;
      const x = c * TS;
      const y = r * TS;
      const dragged = view.drag?.moved && view.drag.from.where === 'hoard' && view.drag.from.c === c && view.drag.from.r === r;
      const held = view.held?.where === 'hoard' && view.held.c === c && view.held.r === r;
      shadow(x + 8, y + 14, 6);
      w.globalAlpha = dragged ? 0.35 : 1;
      w.drawImage(treasureImg(item.id), x, y - (held ? 2 + Math.round(Math.sin(time * 8)) : 1));
      w.globalAlpha = 1;
      if (!dragged) sparkles(item.uid, x, y, effGlanz(state, c, r), time);
    }
  }

  function drawFloorItems(state, time) {
    for (const f of state.floor) {
      const x = f.c * TS;
      const y = f.r * TS;
      shadow(x + 8, y + 14, 5);
      w.drawImage(treasureImg(f.item.id), x, y - 1 - (Math.floor(time * 3 + f.item.uid) % 2));
      sparkles(f.item.uid, x, y, TREASURES[f.item.id].glanz * 0.6, time);
    }
  }

  function drawDigs(state, time) {
    for (const d of state.digs) {
      const left = Math.max(0, d.at - state.t);
      const k = 1 - left / 1.6;
      const cx = (d.c + 0.5) * TS;
      const cy = (d.r + 0.5) * TS;
      for (let i = 0; i < 5; i++) {
        const ang = hash(d.c, d.r, i) * TAU;
        line(w, cx, cy, cx + Math.cos(ang) * 7 * k, cy + Math.sin(ang) * 6 * k, '#120c10');
      }
      if (Math.floor(time * 14) % 2) px(w, cx - 1 + Math.round(Math.random() * 2), cy - 3 - Math.round(Math.random() * 3), '#8a6a4a');
      addLight(cx, cy, 12, [200, 140, 90], 0.25 * k);
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

  function drawDragon(state, view, time, night, hub) {
    const sp = SPECIES[state.opts.species];
    const pal = sp.palettes[state.opts.variant] ?? sp.palettes[0];
    const awake = night;
    const blink = awake && time % 4.3 < 0.13;
    const spread = time < dragonAnim.wingUntil ? 1 : awake ? 0.5 : 0;
    const mouth = time < dragonAnim.mouthUntil;
    const img = dragonImage(pal, { awake: awake && !blink, spread, mouth, scars: hub ? view.scars ?? 0 : state.opts.legend });
    const breath = Math.floor(time / (awake ? 0.7 : 1.5)) % 2;
    const shake = time < dragonAnim.roarUntil ? (Math.floor(time * 30) % 2 ? 1 : -1) : 0;
    w.drawImage(img, DRAGON_X + shake, DRAGON_Y + breath);
    if (awake && !blink) {
      const eye = pal.eye;
      const rgb = [1, 3, 5].map((i) => parseInt(eye.slice(i, i + 2), 16));
      for (const dx of [-7, 7]) {
        glows.push([MOUTH.x + dx, EYE_Y + breath, 4, rgb, 0.55]);
        addLight(MOUTH.x + dx, EYE_Y, 14, rgb, 0.45);
      }
    }
    if (mouth) {
      glows.push([MOUTH.x, MOUTH.y, 8, [255, 170, 80], 0.6]);
      addLight(MOUTH.x, MOUTH.y, 26, [255, 150, 60], 0.7);
    }
    // Schlafend: kleine Z steigen auf
    if (!awake && !reduceMotion) {
      for (let k = 0; k < 3; k++) {
        const t = (time * 0.35 + k / 3) % 1;
        const x = MOUTH.x + 16 + t * 10 + Math.sin(t * 6) * 2;
        const y = DRAGON_Y + HEAD_Y + 4 - t * 14;
        const a = Math.sin(t * Math.PI);
        w.globalAlpha = a * 0.9;
        w.fillStyle = '#e8e0f4';
        // ein winziges Z
        const s = k === 1 ? 3 : 2;
        w.fillRect(Math.round(x), Math.round(y), s + 1, 1);
        w.fillRect(Math.round(x) + s - 1, Math.round(y) + 1, 1, 1);
        if (s === 3) w.fillRect(Math.round(x) + 1, Math.round(y) + 2, 1, 1);
        w.fillRect(Math.round(x), Math.round(y) + s, s + 1, 1);
        w.globalAlpha = 1;
      }
    }
  }

  function drawHeroes(state, view, time, night) {
    const list = state.heroes.filter(isActive).sort((a, b) => a.y - b.y);
    for (const h of list) {
      const wk = walkers.get(h.uid) ?? { x: h.x, flip: false };
      if (Math.abs(h.x - wk.x) > 0.004) wk.flip = h.x < wk.x;
      wk.x = h.x;
      walkers.set(h.uid, wk);
      const moving = h.state === 'seek' || h.state === 'flee' || h.state === 'leave';
      const bob = moving && !(h.stun > 0) && Math.floor(time * 9 + h.uid) % 2 === 0 ? 1 : 0;
      const base = heroImg(h.type);
      const img = wk.flip ? flipX(base, `hero:${h.type}:flip`) : base;
      const fx = Math.round(h.x * TS);
      const fy = Math.round(h.y * TS + 6);
      const x = fx - Math.floor(img.width / 2);
      const y = fy - img.height - bob;
      shadow(fx, fy, 5);
      if (h.carry) ring(w, fx, fy, 6, Math.floor(time * 6) % 2 ? '#ff6b5a' : '#c8323c', 1);
      w.drawImage(h.hit > 0 ? tint(img, '#ffffff', `hero:${h.type}:${wk.flip}:hit`) : img, x, y);
      if (h.wears) w.drawImage(treasureImg(h.wears), x + 6, y + 6);
      if (h.carry) w.drawImage(treasureImg(h.carry.id), fx - 8, y - 11);
      if (h.stun > 0) {
        for (let k = 0; k < 3; k++) {
          const ang = time * 5 + (k * TAU) / 3;
          px(w, fx + Math.cos(ang) * 6, y - 2 + Math.sin(ang) * 2, '#fff2b0');
        }
      }
      if (night && TORCH[h.type]) {
        const flick = Math.sin(time * 13 + h.uid) * 2 + Math.sin(time * 7.3 + h.uid * 3) * 1.5;
        addLight(fx + (wk.flip ? -4 : 4), y + 6, 34 + flick, TORCH[h.type], 0.85);
        glows.push([fx + (wk.flip ? -4 : 4), y + 6, 4, TORCH[h.type], 0.25]);
      } else if (night) {
        // Diebe: nur das Blitzen der Augen
        glows.push([fx, y + 9, 3, [220, 255, 220], 0.35]);
        addLight(fx, y + 10, 12, [160, 200, 255], 0.25);
      }
      if (h.state === 'cast' && h.target) castBeam(h, fx, y, time);
      heroUI(h, fx, y, time);
    }
  }

  function castBeam(h, fx, y, time) {
    const k = Math.min(1, h.castT / h.caster.time);
    const tx = (h.target.c + 0.5) * TS;
    const ty = (h.target.r + 0.5) * TS;
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

  // Lebensbalken, Greifen, Namen: ungedimmt über dem Licht
  function heroUI(h, fx, y, time) {
    const top = h.carry ? y - 13 : y - 3;
    ov.fillStyle = '#140f1c';
    ov.fillRect(fx - 7, top - 1, 14, 4);
    ov.fillStyle = '#3a2430';
    ov.fillRect(fx - 6, top, 12, 2);
    ov.fillStyle = h.fireproof ? '#cfd6e6' : '#ff5a4a';
    ov.fillRect(fx - 6, top, Math.max(0, Math.round(12 * (h.hp / h.maxHp))), 2);
    if (h.state === 'grab') ring(ov, fx, y + 11, 9, '#ffd36b', Math.min(1, h.grabT / h.grabTime));
    if (h.name) addLabel(`${h.name} ${'★'.repeat(h.rank)}`, fx, top - 4, '#ff9a8a', 1, 0.9);
  }

  function drawSmoke(state, time) {
    for (const sm of state.smoke) {
      const left = Math.max(0, Math.min(1, (sm.until - state.t) / 2));
      for (let k = 0; k < 9; k++) {
        const ox = (hash(sm.c, sm.r, k) - 0.5) * 36 + Math.sin(time * 0.8 + k) * 2;
        const oy = (hash(sm.c, sm.r, k + 9) - 0.5) * 34;
        const r = 7 + hash(sm.c, sm.r, k + 3) * 5;
        const cx = (sm.c + 0.5) * TS + ox;
        const cy = (sm.r + 0.5) * TS + oy;
        // Gerasterter Rauch: Schachbrettmuster statt Halbtransparenz
        w.fillStyle = `rgba(190,184,204,${0.75 * left})`;
        for (let yy = -r; yy <= r; yy++) {
          const span = Math.floor(Math.sqrt(r * r - yy * yy));
          for (let xx = -span; xx <= span; xx++) if ((Math.round(cx + xx) + Math.round(cy + yy) + (k % 2)) % 2 === 0) w.fillRect(Math.round(cx + xx), Math.round(cy + yy), 1, 1);
        }
      }
    }
  }

  // ── Ebene über dem Licht: Raster, Auswahl, Glanz-Zahlen, Ziele ──

  function hoardUI(state, view, time, day) {
    if (!day) return;
    const held = heldItem(state, view);
    for (const { c, r } of HOARD_CELLS) {
      const x = c * TS;
      const y = r * TS;
      ov.fillStyle = 'rgba(20,14,10,0.35)';
      ov.fillRect(x, y, TS, 1);
      ov.fillRect(x, y, 1, TS);
      const item = itemAt(state, c, r);
      const fromHere = (view.held?.where === 'hoard' && view.held.c === c && view.held.r === r) || (view.drag?.from.c === c && view.drag?.from.r === r && view.drag?.from.where === 'hoard');
      if (held && !fromHere) {
        if (!item) {
          ov.fillStyle = 'rgba(155,227,143,0.14)';
          ov.fillRect(x + 1, y + 1, TS - 1, TS - 1);
        } else if (item.id === held.id && TREASURES[held.id].next) {
          ov.fillStyle = `rgba(255,200,90,${0.25 + 0.15 * Math.sin(time * 6)})`;
          ov.fillRect(x + 1, y + 1, TS - 1, TS - 1);
        }
      }
    }
    // Grenze des Horts
    const c0 = Math.min(...HOARD_CELLS.map((h) => h.c));
    const c1 = Math.max(...HOARD_CELLS.map((h) => h.c)) + 1;
    const r0 = Math.min(...HOARD_CELLS.map((h) => h.r));
    const r1 = Math.max(...HOARD_CELLS.map((h) => h.r)) + 1;
    ov.fillStyle = 'rgba(20,14,10,0.35)';
    ov.fillRect(c0 * TS, r1 * TS, (c1 - c0) * TS, 1);
    ov.fillRect(c1 * TS, r0 * TS, 1, (r1 - r0) * TS + 1);
    // Glanz-Zahl oben links, Gewicht als Punkte unten rechts
    for (const { c, r } of HOARD_CELLS) {
      const item = itemAt(state, c, r);
      if (!item) continue;
      const dragged = view.drag?.moved && view.drag.from.where === 'hoard' && view.drag.from.c === c && view.drag.from.r === r;
      if (dragged) continue;
      const x = c * TS;
      const y = r * TS;
      const glanz = effGlanz(state, c, r);
      const weight = effWeight(state, c, r);
      drawDigits(ov, glanz, x + 2, y + 2, glanz > TREASURES[item.id].glanz ? '#fff2b0' : '#f2c94c');
      for (let k = 0; k < Math.min(weight, 4); k++) {
        const color = weight >= 3 ? '#a6ec8f' : weight === 2 ? '#dfe6f2' : '#a8b0c0';
        ov.fillStyle = '#140f1c';
        ov.fillRect(x + 11 - k * 4, y + 11, 4, 4);
        ov.fillStyle = color;
        ov.fillRect(x + 12 - k * 4, y + 12, 2, 2);
      }
    }
    // Auswahl und Zeiger
    if (view.held?.where === 'hoard') {
      const x = view.held.c * TS;
      const y = view.held.r * TS;
      const col = Math.floor(time * 6) % 2 ? '#fff2b0' : '#f2c94c';
      frame(x, y, col, 1);
    }
    if (view.hover && HOARD_CELLS.some((h) => h.c === view.hover.c && h.r === view.hover.r)) {
      const pad = view.input === 'pad';
      frame(view.hover.c * TS, view.hover.r * TS, pad ? (Math.floor(time * 4) % 2 ? '#fff2b0' : '#f2c94c') : 'rgba(243,217,141,0.85)', pad ? 2 : 1);
    }
  }

  // Ein Rahmen mit offenen Ecken, wie in alten Spielen
  function frame(x, y, color, thick) {
    ov.fillStyle = color;
    const L = 5;
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + TS - 1, y, -1, 1], [x, y + TS - 1, 1, -1], [x + TS - 1, y + TS - 1, -1, -1]]) {
      for (let t = 0; t < thick; t++) {
        ov.fillRect(sx > 0 ? cx : cx - L + 1, cy + sy * t, L, 1);
        ov.fillRect(cx + sx * t, sy > 0 ? cy : cy - L + 1, 1, L);
      }
    }
  }

  function drawIntentions(state, time) {
    for (const h of state.heroes) {
      if ((h.state !== 'seek' && h.state !== 'grab') || !h.target) continue;
      const tx = (h.target.c + 0.5) * TS;
      const ty = (h.target.r + 0.5) * TS;
      line(ov, h.x * TS, h.y * TS, tx, ty, 'rgba(185,208,234,0.35)', 2);
    }
    for (const h of state.heroes) {
      if ((h.state !== 'seek' && h.state !== 'grab' && h.state !== 'cast') || !h.target) continue;
      const blink = Math.floor(time * 3 + h.uid) % 2;
      ring(ov, (h.target.c + 0.5) * TS, (h.target.r + 0.5) * TS, 8, blink ? 'rgba(185,208,234,0.85)' : 'rgba(185,208,234,0.5)');
    }
  }

  function drawTargeting(state, view) {
    if (state.phase !== 'night' || !view.card) return;
    const card = CARD_BY_ID[view.card];
    if (card?.target === 'tile' && view.hover) {
      const { c, r } = view.hover;
      ov.fillStyle = 'rgba(255,138,61,0.22)';
      ov.fillRect((c - 1) * TS, (r - 1) * TS, 3 * TS, 3 * TS);
      ov.fillStyle = '#ff8a3d';
      ov.fillRect((c - 1) * TS, (r - 1) * TS, 3 * TS, 1);
      ov.fillRect((c - 1) * TS, (r + 2) * TS - 1, 3 * TS, 1);
      ov.fillRect((c - 1) * TS, (r - 1) * TS, 1, 3 * TS);
      ov.fillRect((c + 2) * TS - 1, (r - 1) * TS, 1, 3 * TS);
    }
    if (view.input === 'pad' && view.cursor && card?.target === 'tile') {
      const x = Math.round(view.cursor.x * TS);
      const y = Math.round(view.cursor.y * TS);
      ov.fillStyle = '#fff2b0';
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = 2; i <= 5; i++) ov.fillRect(x + dx * i, y + dy * i, 1, 1);
    }
    if (view.card === 'schnapp') {
      const reach = (c, r) => inside(c, r) && MAP[r][c] !== '#' && distToDragon(c + 0.5, r + 0.5) <= CARD_BY_ID.schnapp.range;
      ov.fillStyle = 'rgba(255,138,61,0.75)';
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (!reach(c, r)) continue;
        // Nur die Grenze der Reichweite, gepunktet
        if (!reach(c, r + 1)) for (let x = 0; x < TS; x += 2) ov.fillRect(c * TS + x, (r + 1) * TS - 1, 1, 1);
        if (!reach(c - 1, r) && c > 0) for (let y = 0; y < TS; y += 2) ov.fillRect(c * TS, r * TS + y, 1, 1);
        if (!reach(c + 1, r) && c < COLS - 1) for (let y = 0; y < TS; y += 2) ov.fillRect((c + 1) * TS - 1, r * TS + y, 1, 1);
      }
      for (const h of state.heroes) {
        if (!isActive(h)) continue;
        const inReach = distToDragon(h.x, h.y) <= CARD_BY_ID.schnapp.range;
        ring(ov, h.x * TS, h.y * TS - 4, 9, inReach ? '#ff8a3d' : 'rgba(181,169,155,0.45)');
      }
    }
    const aimed = view.aimUid != null && state.heroes.find((h) => h.uid === view.aimUid && isActive(h));
    if (aimed) {
      const x = Math.round(aimed.x * TS);
      const y = Math.round(aimed.y * TS) - 4;
      ring(ov, x, y, 11, '#fff2b0');
      ring(ov, x, y, 12, '#f2c94c');
      for (let i = 0; i < 4; i++) ov.fillRect(x - 3 + i, y - 25 + i, 7 - i * 2, 1);
    }
  }

  function drawHeldGhost(state, view, time) {
    if (!view.pointer) return;
    const dragging = view.drag?.moved;
    const trayHeld = view.held?.where === 'tray' && view.pointerType === 'mouse';
    const padHeld = view.held && view.input === 'pad';
    if (!dragging && !trayHeld && !padHeld) return;
    const item = heldItem(state, view);
    if (!item) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((view.pointer.x - rect.left) / T) * TS;
    const y = ((view.pointer.y - rect.top) / T) * TS;
    ov.globalAlpha = 0.92;
    ov.drawImage(treasureImg(item.id), Math.round(x - 8), Math.round(y - 11 + Math.sin(time * 6)));
    ov.globalAlpha = 1;
  }

  // ── Licht ──

  function buildLight(state, night, mood) {
    li.globalCompositeOperation = 'source-over';
    li.fillStyle = `rgb(${ambient.map(Math.round).join(',')})`;
    li.fillRect(0, 0, NW, NH);
    li.globalCompositeOperation = 'lighter';
    // Der Hort glüht – je wertvoller, desto heller
    const value = hoardValue(state);
    addLight(96, 62, 74 + Math.min(34, value * 0.5), [255, 190, 110], night ? 0.5 + Math.min(0.35, value / 120) : 0.3);
    // Mondlicht oder Tageslicht vom Eingang
    addLight(96, NH + 6, night ? 64 : 74, night ? [110, 150, 235] : [255, 236, 205], night ? 0.75 : 0.45);
    // Schätze leuchten nachts in ihrer Farbe
    for (const { c, r } of HOARD_CELLS) {
      const item = itemAt(state, c, r);
      if (!item) continue;
      const glanz = effGlanz(state, c, r);
      if (glanz > 0) addLight(c * TS + 8, r * TS + 8, 8 + glanz * 2, treasureLight(item.id), night ? 0.22 + glanz * 0.025 : 0.08);
    }
    if (mood === 'hub') addLight(96, 30, 60, [255, 200, 140], 0.25);
    for (const [x, y, r, [cr, cg, cb], a] of lights) {
      if (a <= 0) continue;
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
    for (const e of state.fx) addEffect(e, time);
    state.fx.length = 0;

    const hub = !!view.hub;
    const night = state.phase === 'night';
    const day = DAY_PHASES.has(state.phase) && !hub;
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
    drawDigs(state, time);
    drawFloorItems(state, time);
    drawGuardians(state, night);
    drawDragon(state, view, time, night, hub);
    drawHoard(state, view, time);
    drawHeroes(state, view, time, night);
    drawSmoke(state, time);
    drawEffects(time);
    updateMotes(state, time, dt, mood);

    // Ebene über dem Licht
    hoardUI(state, view, time, day);
    if (night) drawIntentions(state, time);
    drawTargeting(state, view);
    drawHeldGhost(state, view, time);

    buildLight(state, night, mood);

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
    // Ränder abdunkeln
    const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.35, canvas.width / 2, canvas.height / 2, canvas.height * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(6,4,10,0.55)');
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

  return { resize, draw, cellAt, heroAt, cellCenter, tileSize: () => T };
}
