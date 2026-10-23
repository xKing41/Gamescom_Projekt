// Zeichnet die Höhle: Fels, Hort, Schätze, Helden, Drache und Effekte.
// Liest nur den Spielzustand und die Ansicht – verändert nichts daran.

import { COLS, ROWS, MAP, HOARD_CELLS, DRAGON_CENTER, inside } from './map.js';
import { TREASURES, CARD_BY_ID, SPECIES } from './data.js';
import { effGlanz, effWeight, itemAt, isActive, distToDragon, DAY_PHASES } from './sim.js';
import { drawTreasure, drawHero, drawDragon, drawSparkle, drawGuardian } from './icons.js';

const TAU = Math.PI * 2;
const FONT = '"Alegreya Sans", "Segoe UI", system-ui, sans-serif';
const TONES = { warn: '#ffcf6b', bad: '#ff6b6b', good: '#9be38f', info: '#a9c1d9' };
const DURATION = { fire: 0.75, claw: 0.25, bite: 0.4, wing: 0.6, roar: 0.8, merge: 0.7, mimik: 0.5, text: 1.4, dmg: 0.8, death: 0.7, grab: 0.5, snare: 0.6, teleport: 0.8, smoke: 0.6, tail: 0.5, rain: 1.2 };

function hash(a, b, k = 0) {
  let h = (a * 374761393 + b * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const effects = [];
  let T = 40;
  let W = COLS * T;
  let H = ROWS * T;
  let dpr = 1;
  let bg = null;
  let shakeUntil = 0;
  const dragonAnim = { mouth: 0, mouthUntil: 0, wingUntil: 0, roarUntil: 0 };

  function resize(width, height) {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    T = Math.max(14, Math.floor(Math.min(width / COLS, height / ROWS)));
    W = T * COLS;
    H = T * ROWS;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    bg = buildBackground();
  }

  // ── Hintergrund (einmal pro Größe) ──

  function buildBackground() {
    const off = document.createElement('canvas');
    off.width = Math.round(W * dpr);
    off.height = Math.round(H * dpr);
    const g = off.getContext('2d');
    g.scale(dpr, dpr);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) paintTile(g, c, r);

    const glow = g.createRadialGradient(6 * T, 3.9 * T, T, 6 * T, 3.9 * T, 5 * T);
    glow.addColorStop(0, 'rgba(230,170,70,0.13)');
    glow.addColorStop(1, 'rgba(230,170,70,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    const moon = g.createRadialGradient(6 * T, 11 * T, T * 0.5, 6 * T, 11 * T, 5.5 * T);
    moon.addColorStop(0, 'rgba(150,185,225,0.2)');
    moon.addColorStop(1, 'rgba(150,185,225,0)');
    g.fillStyle = moon;
    g.fillRect(0, 0, W, H);
    const vignette = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = vignette;
    g.fillRect(0, 0, W, H);

    g.font = `600 ${Math.round(T * 0.26)}px ${FONT}`;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(169,193,217,0.7)';
    g.fillText('Eingang', 6 * T, 10.62 * T);
    return off;
  }

  function paintTile(g, c, r) {
    const kind = MAP[r][c];
    const x = c * T;
    const y = r * T;
    if (kind === '#') {
      g.fillStyle = '#1d1820';
      g.fillRect(x, y, T, T);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i % 2 ? '#262029' : '#17131a';
        g.beginPath();
        g.ellipse(x + T * (0.2 + 0.6 * hash(c, r, i)), y + T * (0.2 + 0.6 * hash(c, r, i + 7)), T * (0.18 + 0.15 * hash(c, r, i + 3)), T * (0.12 + 0.12 * hash(c, r, i + 5)), hash(c, r, i + 9) * 3, 0, TAU);
        g.fill();
      }
      if (r + 1 < ROWS && MAP[r + 1][c] !== '#') {
        g.fillStyle = 'rgba(170,150,185,0.12)';
        g.fillRect(x, y + T * 0.86, T, T * 0.14);
      }
      return;
    }
    g.fillStyle = kind === 'H' ? '#3a2d24' : kind === 'D' ? '#221b21' : '#2b2430';
    g.fillRect(x, y, T, T);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = hash(c, r, i + 11) > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.14)';
      const s = T * (0.04 + 0.07 * hash(c, r, i + 21));
      g.fillRect(x + T * hash(c, r, i + 31), y + T * hash(c, r, i + 41), s, s);
    }
    if (kind === 'H') {
      g.fillStyle = 'rgba(230,185,79,0.25)';
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(x + T * hash(c, r, i + 51), y + T * hash(c, r, i + 61), T * 0.025, 0, TAU);
        g.fill();
      }
    }
  }

  // ── Koordinaten ──

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
      const d = Math.hypot(h.x - p.x, h.y - 0.15 - p.y);
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

  // ── Effekte ──

  function addEffect(e, time) {
    const fx = { ...e, t0: time };
    if (e.type === 'fire') {
      fx.parts = Array.from({ length: reduceMotion ? 18 : 46 }, () => ({
        x: Math.random() * 3 - 1.5,
        y: Math.random() * 3 - 1.5,
        r: 0.1 + Math.random() * 0.2,
        v: 0.4 + Math.random() * 0.9,
      }));
      dragonAnim.mouthUntil = time + 0.6;
    }
    if (e.type === 'merge' || e.type === 'death') {
      fx.parts = Array.from({ length: reduceMotion ? 8 : 18 }, () => ({ a: Math.random() * TAU, v: 0.6 + Math.random() * 1.2 }));
    }
    if (e.type === 'wing') dragonAnim.wingUntil = time + 0.7;
    if (e.type === 'roar') {
      dragonAnim.roarUntil = time + 0.8;
      dragonAnim.mouthUntil = time + 0.5;
      if (!reduceMotion) shakeUntil = time + 0.45;
    }
    if (e.type === 'bite') dragonAnim.mouthUntil = time + 0.25;
    if (e.type === 'rain') {
      fx.parts = Array.from({ length: reduceMotion ? 30 : 90 }, () => ({ x: Math.random() * COLS, y: Math.random() * ROWS, v: 0.6 + Math.random() * 0.8 }));
      dragonAnim.mouthUntil = time + 0.8;
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
      drawEffect(e, age);
    }
  }

  function drawEffect(e, a) {
    ctx.save();
    if (e.type === 'fire') {
      const cx = (e.c + 0.5) * T;
      const cy = (e.r + 0.5) * T;
      if (a < 0.35) {
        const mouthX = DRAGON_CENTER.x * T;
        const mouthY = 1.95 * T;
        const grad = ctx.createLinearGradient(mouthX, mouthY, cx, cy);
        grad.addColorStop(0, 'rgba(255,236,150,0.9)');
        grad.addColorStop(1, 'rgba(255,110,40,0.5)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = T * (0.5 - a);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(mouthX, mouthY);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,120,40,${0.22 * (1 - a)})`;
      ctx.fillRect(cx - 1.5 * T, cy - 1.5 * T, 3 * T, 3 * T);
      for (const p of e.parts) {
        const k = 1 - a;
        ctx.fillStyle = a < 0.3 ? `rgba(255,236,150,${k})` : a < 0.6 ? `rgba(255,150,50,${k})` : `rgba(200,60,30,${k})`;
        ctx.beginPath();
        ctx.arc(cx + p.x * T, cy + (p.y - p.v * a) * T, p.r * T * (1 - a * 0.6), 0, TAU);
        ctx.fill();
      }
    } else if (e.type === 'claw') {
      ctx.strokeStyle = `rgba(255,240,220,${1 - a})`;
      ctx.lineWidth = T * 0.06;
      ctx.lineCap = 'round';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.arc((e.x + k * 0.16) * T, (e.y - 0.6) * T, T * 0.55, 0.35 * Math.PI, (0.35 + 0.35 * Math.min(1, a * 3)) * Math.PI);
        ctx.stroke();
      }
    } else if (e.type === 'bite') {
      const close = Math.min(1, a * 3);
      ctx.strokeStyle = `rgba(255,90,70,${1 - a})`;
      ctx.lineWidth = T * 0.09;
      ctx.beginPath();
      ctx.arc(e.x * T, (e.y - 0.15 - 0.3 * (1 - close)) * T, T * 0.45, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(e.x * T, (e.y - 0.15 + 0.3 * (1 - close)) * T, T * 0.45, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    } else if (e.type === 'wing') {
      ctx.strokeStyle = `rgba(220,230,245,${0.55 * (1 - a)})`;
      ctx.lineWidth = T * 0.12 * (1 - a);
      ctx.beginPath();
      ctx.arc(DRAGON_CENTER.x * T, DRAGON_CENTER.y * T, T * 5 * a, 0, Math.PI);
      ctx.stroke();
    } else if (e.type === 'roar') {
      for (let k = 0; k < 3; k++) {
        const aa = a - k * 0.15;
        if (aa <= 0) continue;
        ctx.strokeStyle = `rgba(255,170,90,${0.5 * (1 - aa)})`;
        ctx.lineWidth = T * 0.08;
        ctx.beginPath();
        ctx.arc(DRAGON_CENTER.x * T, 1.9 * T, T * 8 * aa, 0.05 * Math.PI, 0.95 * Math.PI);
        ctx.stroke();
      }
    } else if (e.type === 'merge') {
      const cx = (e.c + 0.5) * T;
      const cy = (e.r + 0.5) * T;
      for (const p of e.parts) {
        ctx.fillStyle = `rgba(255,${180 + Math.round(60 * (1 - a))},80,${1 - a})`;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(p.a) * p.v * a * T, cy + Math.sin(p.a) * p.v * a * T, T * 0.06 * (1 - a), 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(255,214,120,${1 - a})`;
      ctx.lineWidth = T * 0.06;
      ctx.beginPath();
      ctx.arc(cx, cy, T * (0.3 + 0.4 * a), 0, TAU);
      ctx.stroke();
    } else if (e.type === 'mimik') {
      ctx.fillStyle = `rgba(255,80,60,${0.35 * (1 - a)})`;
      ctx.fillRect(e.c * T, e.r * T, T, T);
      floatText('Schnapp!', (e.c + 0.5) * T, (e.r + 0.1 - 0.4 * a) * T, '#ff8a6b', 1 - a, 0.3);
    } else if (e.type === 'text') {
      floatText(e.text, e.x * T, (e.y - 0.7 * a) * T, TONES[e.tone] ?? '#f1e8da', a < 0.75 ? 1 : (1 - a) * 4, 0.27);
    } else if (e.type === 'dmg') {
      floatText(e.text, e.x * T, (e.y - 0.6 * a) * T, '#fff1e0', 1 - a, 0.24);
    } else if (e.type === 'death') {
      for (const p of e.parts) {
        ctx.fillStyle = `rgba(150,140,150,${0.6 * (1 - a)})`;
        ctx.beginPath();
        ctx.arc((e.x + Math.cos(p.a) * p.v * a * 0.6) * T, (e.y - 0.1 + Math.sin(p.a) * p.v * a * 0.4 - a * 0.4) * T, T * 0.12 * (1 - a * 0.5), 0, TAU);
        ctx.fill();
      }
    } else if (e.type === 'grab') {
      drawSparkle(ctx, e.x * T, (e.y - 0.7) * T, T * 0.25 * (1 - a), 1 - a);
    } else if (e.type === 'snare') {
      const close = Math.min(1, a * 4);
      ctx.strokeStyle = `rgba(200,206,220,${1 - a})`;
      ctx.lineWidth = T * 0.07;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(e.x * T, (e.y + 0.2 + side * 0.25 * (1 - close)) * T, T * 0.35, side < 0 ? 0.1 * Math.PI : 1.1 * Math.PI, side < 0 ? 0.9 * Math.PI : 1.9 * Math.PI);
        ctx.stroke();
      }
    } else if (e.type === 'teleport') {
      ctx.strokeStyle = `rgba(190,140,255,${1 - a})`;
      ctx.lineWidth = T * 0.08;
      ctx.beginPath();
      ctx.arc((e.c + 0.5) * T, (e.r + 0.5) * T, T * (0.2 + 0.5 * a), 0, TAU);
      ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * TAU + a * 3;
        drawSparkle(ctx, e.x * T + Math.cos(ang) * T * 0.4 * a, (e.y - 0.3) * T + Math.sin(ang) * T * 0.4 * a, T * 0.08, 1 - a);
      }
    } else if (e.type === 'smoke') {
      ctx.fillStyle = `rgba(200,195,210,${0.35 * (1 - a)})`;
      ctx.beginPath();
      ctx.arc((e.c + 0.5) * T, (e.r + 0.5) * T, T * (0.5 + 1.2 * a), 0, TAU);
      ctx.fill();
    } else if (e.type === 'tail') {
      ctx.strokeStyle = `rgba(255,214,150,${0.7 * (1 - a)})`;
      ctx.lineWidth = T * 0.16 * (1 - a);
      ctx.beginPath();
      ctx.arc(DRAGON_CENTER.x * T, DRAGON_CENTER.y * T, T * (1.5 + 2.2 * a), 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else if (e.type === 'rain') {
      for (const p of e.parts) {
        const y = (p.y + a * p.v * 3) % ROWS;
        ctx.fillStyle = `rgba(255,${120 + Math.round(p.v * 80)},50,${0.8 * (1 - a)})`;
        ctx.beginPath();
        ctx.arc(p.x * T, y * T, T * 0.06, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function floatText(text, x, y, color, alpha, size) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.font = `800 ${Math.round(T * size)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = T * 0.07;
    ctx.strokeStyle = 'rgba(14,10,16,0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ── Bausteine ──

  function treasureSize(id) {
    const tier = TREASURES[id].tier ?? 1;
    return T * (tier === 3 ? 0.98 : tier === 2 ? 0.92 : 0.86);
  }

  function sparkles(item, cx, cy, glanz, time) {
    const n = Math.ceil(glanz / 2);
    for (let k = 0; k < n; k++) {
      const h1 = hash(item.uid, k, 3);
      const h2 = hash(item.uid, k, 5);
      const tw = 0.5 + 0.5 * Math.sin(time * (1.5 + h1 * 2.5) + h2 * 6);
      drawSparkle(ctx, cx + (h1 - 0.5) * T * 0.85, cy + (h2 - 0.5) * T * 0.8, T * (0.05 + 0.04 * tw + glanz * 0.004), 0.25 + 0.75 * tw);
    }
  }

  function badges(c, r, state) {
    const x = c * T;
    const y = r * T;
    const glanz = effGlanz(state, c, r);
    const weight = effWeight(state, c, r);
    ctx.font = `800 ${Math.round(T * 0.22)}px ${FONT}`;
    ctx.textAlign = 'left';
    const text = String(glanz);
    const w = ctx.measureText(text).width + T * 0.3;
    ctx.fillStyle = 'rgba(14,11,16,0.8)';
    ctx.beginPath();
    ctx.roundRect?.(x + T * 0.04, y + T * 0.04, w, T * 0.26, T * 0.08);
    ctx.fill();
    drawSparkle(ctx, x + T * 0.15, y + T * 0.17, T * 0.08, 1);
    ctx.fillStyle = '#ffe08a';
    ctx.fillText(text, x + T * 0.24, y + T * 0.245);
    for (let k = 0; k < Math.min(weight, 4); k++) {
      ctx.fillStyle = weight >= 3 ? '#9be38f' : weight === 2 ? '#cfd6e6' : 'rgba(207,214,230,0.6)';
      ctx.beginPath();
      ctx.arc(x + T * (0.86 - k * 0.12), y + T * 0.88, T * 0.045, 0, TAU);
      ctx.fill();
    }
  }

  function drawHoard(state, view, time, day) {
    const held = heldItem(state, view);
    for (const { c, r } of HOARD_CELLS) {
      const x = c * T;
      const y = r * T;
      if (day) {
        ctx.strokeStyle = 'rgba(230,185,79,0.14)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
        const item = itemAt(state, c, r);
        if (held && !(view.held?.where === 'hoard' && view.held.c === c && view.held.r === r) && !(view.drag?.from.c === c && view.drag?.from.r === r)) {
          if (!item) {
            ctx.fillStyle = 'rgba(155,227,143,0.07)';
            ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
          } else if (item.id === held.id && TREASURES[held.id].next) {
            ctx.fillStyle = `rgba(255,190,80,${0.18 + 0.12 * Math.sin(time * 5)})`;
            ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
          }
        }
        if (view.hover && view.hover.c === c && view.hover.r === r) {
          ctx.strokeStyle = 'rgba(243,217,141,0.7)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3);
        }
      }
    }
    for (const { c, r } of HOARD_CELLS) {
      const item = itemAt(state, c, r);
      if (!item) continue;
      const cx = (c + 0.5) * T;
      const cy = (r + 0.5) * T;
      const dragged = view.drag?.moved && view.drag.from.where === 'hoard' && view.drag.from.c === c && view.drag.from.r === r;
      ctx.save();
      if (dragged) ctx.globalAlpha = 0.3;
      drawTreasure(ctx, item.id, cx, cy, treasureSize(item.id), time);
      ctx.restore();
      if (!dragged) sparkles(item, cx, cy, effGlanz(state, c, r), time);
      if (view.held?.where === 'hoard' && view.held.c === c && view.held.r === r) {
        ctx.strokeStyle = `rgba(255,214,120,${0.6 + 0.4 * Math.sin(time * 6)})`;
        ctx.lineWidth = T * 0.06;
        ctx.strokeRect(c * T + 3, r * T + 3, T - 6, T - 6);
      }
      if (day && !dragged) badges(c, r, state);
    }
  }

  function drawFloor(state, time) {
    for (const f of state.floor) {
      const cx = (f.c + 0.5) * T;
      const cy = (f.r + 0.55) * T + Math.sin(time * 3 + f.item.uid) * T * 0.02;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + T * 0.25, T * 0.25, T * 0.08, 0, 0, TAU);
      ctx.fill();
      drawTreasure(ctx, f.item.id, cx, cy, T * 0.62, time);
      sparkles(f.item, cx, cy, TREASURES[f.item.id].glanz * 0.6, time);
    }
  }

  function drawDigs(state, time) {
    for (const d of state.digs) {
      const left = Math.max(0, d.at - state.t);
      const k = 1 - left / 1.6;
      const cx = (d.c + 0.5) * T;
      const cy = (d.r + 0.5) * T;
      ctx.save();
      ctx.strokeStyle = `rgba(20,10,8,${0.5 + 0.5 * k})`;
      ctx.lineWidth = T * 0.05;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = hash(d.c, d.r, i) * TAU;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * T * 0.42 * k, cy + Math.sin(a) * T * 0.42 * k);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(150,110,80,${0.45 * (0.5 + 0.5 * Math.sin(time * 18))})`;
      ctx.beginPath();
      ctx.arc(cx, cy, T * 0.2 * k, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // Wohin will welcher Held? Dünne Linien zeigen die Glanz-Regel bei der Arbeit
  function drawIntentions(state, time) {
    ctx.save();
    ctx.setLineDash([T * 0.12, T * 0.12]);
    ctx.lineDashOffset = -time * T * 0.6;
    for (const h of state.heroes) {
      if (h.state !== 'seek' && h.state !== 'grab') continue;
      if (!h.target || h.state === 'cast') continue;
      const tx = (h.target.c + 0.5) * T;
      const ty = (h.target.r + 0.5) * T;
      ctx.strokeStyle = 'rgba(169,193,217,0.35)';
      ctx.lineWidth = Math.max(1, T * 0.03);
      ctx.beginPath();
      ctx.moveTo(h.x * T, h.y * T);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const h of state.heroes) {
      if ((h.state !== 'seek' && h.state !== 'grab' && h.state !== 'cast') || !h.target) continue;
      ctx.strokeStyle = 'rgba(169,193,217,0.8)';
      ctx.lineWidth = T * 0.04;
      ctx.beginPath();
      ctx.arc((h.target.c + 0.5) * T, (h.target.r + 0.5) * T, T * 0.44, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHeroes(state, view, time) {
    const list = state.heroes.filter(isActive).sort((a, b) => a.y - b.y);
    for (const h of list) {
      const px = h.x * T;
      const moving = h.state === 'seek' || h.state === 'flee' || h.state === 'leave';
      const bob = moving && !h.stun ? Math.abs(Math.sin(time * 9 + h.uid)) * T * 0.05 : 0;
      const py = h.y * T - bob;
      if (h.carry) {
        ctx.strokeStyle = `rgba(255,107,107,${0.55 + 0.35 * Math.sin(time * 8)})`;
        ctx.lineWidth = T * 0.06;
        ctx.beginPath();
        ctx.ellipse(px, h.y * T + T * 0.27, T * 0.3, T * 0.11, 0, 0, TAU);
        ctx.stroke();
      }
      if (h.state === 'cast' && h.target) {
        const k = Math.min(1, h.castT / h.caster.time);
        const tx = (h.target.c + 0.5) * T;
        const ty = (h.target.r + 0.5) * T;
        ctx.save();
        ctx.strokeStyle = `rgba(190,140,255,${0.35 + 0.5 * k})`;
        ctx.lineWidth = T * (0.04 + 0.08 * k);
        ctx.setLineDash([T * 0.1, T * 0.08]);
        ctx.lineDashOffset = -time * T;
        ctx.beginPath();
        ctx.moveTo(px - T * 0.2, py - T * 0.3);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = '#c8a0ff';
        ctx.lineWidth = T * 0.06;
        ctx.beginPath();
        ctx.arc(tx, ty, T * 0.42, -Math.PI / 2, -Math.PI / 2 + TAU * k);
        ctx.stroke();
      }
      drawHero(ctx, h.type, px, py, T * 0.92, { hit: h.hit });
      if (h.wears) drawTreasure(ctx, h.wears, px + T * 0.26, py - T * 0.36, T * 0.34, time);
      if (h.carry) drawTreasure(ctx, h.carry.id, px, py - T * 0.62, T * 0.48, time);
      const bw = T * 0.62;
      const by = py - T * (h.carry ? 0.95 : 0.52);
      ctx.fillStyle = 'rgba(14,10,16,0.85)';
      ctx.fillRect(px - bw / 2, by, bw, T * 0.08);
      ctx.fillStyle = h.fireproof ? '#cfd6e6' : '#e05656';
      ctx.fillRect(px - bw / 2, by, bw * Math.max(0, h.hp / h.maxHp), T * 0.08);
      if (h.name) floatText(`${h.name} ${'★'.repeat(h.rank)}`, px, by - T * 0.08, '#ff8a8a', 1, 0.2);
      if (h.state === 'grab') {
        ctx.strokeStyle = '#ffd36b';
        ctx.lineWidth = T * 0.06;
        ctx.beginPath();
        ctx.arc(px, py, T * 0.38, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, h.grabT / h.grabTime));
        ctx.stroke();
      }
      if (h.stun > 0) {
        for (let k = 0; k < 3; k++) {
          const a = time * 4 + (k * TAU) / 3;
          drawSparkle(ctx, px + Math.cos(a) * T * 0.25, py - T * 0.42 + Math.sin(a) * T * 0.08, T * 0.07, 0.9);
        }
      }
      if (view.card === 'schnapp') {
        const inReach = distToDragon(h.x, h.y) <= CARD_BY_ID.schnapp.range;
        ctx.strokeStyle = inReach ? 'rgba(255,138,61,0.9)' : 'rgba(181,169,155,0.35)';
        ctx.lineWidth = T * 0.05;
        ctx.beginPath();
        ctx.arc(px, py, T * 0.42, 0, TAU);
        ctx.stroke();
      }
    }
  }

  function drawGuardians(state, time, night) {
    for (const g of state.guardians) drawGuardian(ctx, (g.c + 0.5) * T, (g.r + 0.45) * T, T * 0.9, time, night ? 1 : 0.35);
  }

  function drawSmoke(state, time) {
    for (const sm of state.smoke) {
      const left = Math.max(0, Math.min(1, (sm.until - state.t) / 2));
      for (let k = 0; k < 7; k++) {
        const ox = (hash(sm.c, sm.r, k) - 0.5) * 2.4;
        const oy = (hash(sm.c, sm.r, k + 9) - 0.5) * 2.4;
        const wob = Math.sin(time * 1.3 + k) * 0.08;
        ctx.fillStyle = `rgba(185,180,195,${0.32 * left})`;
        ctx.beginPath();
        ctx.arc((sm.c + 0.5 + ox + wob) * T, (sm.r + 0.5 + oy) * T, T * (0.55 + 0.2 * hash(sm.c, sm.r, k + 3)), 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawTargeting(state, view) {
    if (state.phase !== 'night' || !view.card) return;
    if ((view.card === 'feuer' || view.card === 'rauch') && view.hover) {
      const { c, r } = view.hover;
      ctx.fillStyle = 'rgba(255,138,61,0.18)';
      ctx.fillRect((c - 1) * T, (r - 1) * T, 3 * T, 3 * T);
      ctx.strokeStyle = 'rgba(255,138,61,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect((c - 1) * T + 1, (r - 1) * T + 1, 3 * T - 2, 3 * T - 2);
    }
    if (view.card === 'schnapp') {
      ctx.fillStyle = 'rgba(255,138,61,0.06)';
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (MAP[r][c] !== '#' && distToDragon(c + 0.5, r + 0.5) <= CARD_BY_ID.schnapp.range) ctx.fillRect(c * T, r * T, T, T);
      }
    }
  }

  function heldItem(state, view) {
    const from = view.drag?.moved ? view.drag.from : view.held;
    if (!from) return null;
    return from.where === 'tray' ? state.tray[from.i] ?? null : itemAt(state, from.c, from.r);
  }

  function drawHeldGhost(state, view, time) {
    if (!view.pointer) return;
    const dragging = view.drag?.moved;
    const trayHeld = view.held?.where === 'tray' && view.pointerType === 'mouse';
    if (!dragging && !trayHeld) return;
    const item = heldItem(state, view);
    if (!item) return;
    const rect = canvas.getBoundingClientRect();
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawTreasure(ctx, item.id, view.pointer.x - rect.left, view.pointer.y - rect.top - T * 0.15, treasureSize(item.id) * 1.05, time);
    ctx.restore();
  }

  // ── Bild ──

  function draw(state, view, time) {
    if (!bg) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state) {
      for (const e of state.fx) addEffect(e, time);
      state.fx.length = 0;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (time < shakeUntil) ctx.translate((Math.random() - 0.5) * T * 0.15, (Math.random() - 0.5) * T * 0.15);
    ctx.drawImage(bg, 0, 0, W, H);
    if (!state) {
      ctx.restore();
      return;
    }
    const hub = !!view.hub;
    const day = DAY_PHASES.has(state.phase) && !hub;
    const night = state.phase === 'night';
    ctx.fillStyle = night ? 'rgba(18,28,64,0.2)' : 'rgba(255,190,110,0.035)';
    ctx.fillRect(0, 0, W, H);

    drawHoard(state, view, time, day);
    drawDigs(state, time);
    drawFloor(state, time);
    drawGuardians(state, time, night);
    if (night) drawIntentions(state, time);

    dragonAnim.mouth = time < dragonAnim.mouthUntil ? 1 : Math.max(0, dragonAnim.mouth - 0.05);
    const wingT = Math.max(0, dragonAnim.wingUntil - time) / 0.7;
    const species = SPECIES[state.opts.species];
    drawDragon(ctx, DRAGON_CENTER.x * T, (DRAGON_CENTER.y - 0.55) * T, T, time, {
      awake: !day && !hub,
      spread: night ? 0.45 + 0.55 * Math.sin(wingT * Math.PI) : 0.15,
      mouth: dragonAnim.mouth,
      shake: time < dragonAnim.roarUntil ? 1 : 0,
      palette: species.palettes[state.opts.variant] ?? species.palettes[0],
      scars: hub ? view.scars ?? 0 : state.opts.legend,
    });

    drawSmoke(state, time);
    drawTargeting(state, view);
    drawHeroes(state, view, time);
    drawEffects(time);
    drawHeldGhost(state, view, time);
    ctx.restore();
  }

  return { resize, draw, cellAt, heroAt, cellCenter, tileSize: () => T };
}
