// Verbindet Spiellogik, Höhlenbild und Tafel: Eingaben, Spielschleife, Start.

import * as Sim from './sim.js';
import { TREASURES, CARDS, CARD_BY_ID } from './data.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { randomSeed, codeToSeed } from './rng.js';

const canvas = document.getElementById('board');
const wrap = document.getElementById('board-wrap');
const renderer = createRenderer(canvas);

const view = {
  held: null, // ausgewählter Schatz: { where: 'hoard', c, r } | { where: 'tray', i }
  drag: null,
  hover: null,
  pointer: null,
  pointerType: 'mouse',
  card: null,
  paused: false,
  speed: 1,
};
const app = { state: null, view, act };
const ui = createUI(app);

function seedFromHash() {
  const m = /^#([0-9a-z]{1,7})$/i.exec(location.hash);
  return m ? codeToSeed(m[1]) : null;
}

function newRun(seed) {
  app.state = Sim.createRun(seed ?? randomSeed());
  view.held = null;
  view.drag = null;
  view.card = null;
  view.paused = false;
  ui.render();
}

function act(type, p = {}) {
  const s = app.state;
  switch (type) {
    case 'raid':
      Sim.chooseRaid(s, p.id);
      break;
    case 'take-loot':
      Sim.takeLoot(s, p.indices);
      break;
    case 'pick-tray':
      view.held = view.held?.where === 'tray' && view.held.i === p.i ? null : { where: 'tray', i: p.i };
      break;
    case 'discard': {
      if (!view.held) return;
      const result = Sim.discardItem(s, view.held);
      ui.toast(result.ok ? `${TREASURES[result.id].name} weggeworfen.` : result.reason);
      view.held = null;
      break;
    }
    case 'start-night': {
      const result = Sim.startNight(s);
      if (result.lost?.length) ui.toast(`Kein Platz mehr im Hort: ${result.lost.length} Schatz verloren.`);
      view.held = null;
      break;
    }
    case 'card':
      selectCard(p.id);
      return;
    case 'take-morning':
      Sim.takeMorningLoot(s, p.indices);
      break;
    case 'new-run':
      newRun();
      return;
    case 'replay':
      newRun(s.seed);
      return;
    case 'pause':
      if (s.phase === 'night') view.paused = !view.paused;
      ui.tick();
      return;
    case 'speed':
      view.speed = view.speed === 1 ? 2 : 1;
      ui.tick();
      return;
    default:
      return;
  }
  ui.render();
}

function selectCard(id) {
  const s = app.state;
  if (s.phase !== 'night') return;
  const card = CARD_BY_ID[id];
  if (s.glut < card.cost) {
    ui.toast('Zu wenig Glut.');
    return;
  }
  if (card.target === 'none') {
    const result = Sim.playCard(s, id);
    if (!result.ok) ui.toast(result.reason);
    view.card = null;
  } else {
    view.card = view.card === id ? null : id;
  }
  ui.tick();
}

function castAt(clientX, clientY) {
  const s = app.state;
  const card = CARD_BY_ID[view.card];
  let result;
  if (card.target === 'tile') {
    const cell = renderer.cellAt(clientX, clientY);
    if (!cell) return;
    result = Sim.playCard(s, card.id, cell);
  } else {
    const hero = renderer.heroAt(s, clientX, clientY, 0.9);
    result = hero ? Sim.playCard(s, card.id, { uid: hero.uid }) : { ok: false, reason: 'Tippe direkt auf einen Helden.' };
  }
  if (result.ok) view.card = null;
  else ui.toast(result.reason);
  ui.tick();
}

function place(from, cell) {
  const result = Sim.moveItem(app.state, from, cell.c, cell.r);
  if (result.kind === 'merge') ui.toast(`Verschmolzen: ${TREASURES[result.id].name}`);
  else if (!result.ok && result.reason) ui.toast(result.reason);
  view.held = null;
  ui.render();
}

// ── Zeigen, Ziehen, Tippen ──

canvas.addEventListener('pointerdown', (e) => {
  const s = app.state;
  if (!s) return;
  view.pointerType = e.pointerType;
  view.pointer = { x: e.clientX, y: e.clientY };
  view.hover = renderer.cellAt(e.clientX, e.clientY);
  if (s.phase === 'night') {
    if (view.card) castAt(e.clientX, e.clientY);
    return;
  }
  if (!Sim.DAY_PHASES.has(s.phase) || view.held || !view.hover) return;
  if (Sim.itemAt(s, view.hover.c, view.hover.r)) {
    view.drag = { from: { where: 'hoard', c: view.hover.c, r: view.hover.r }, x0: e.clientX, y0: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener('pointermove', (e) => {
  view.pointerType = e.pointerType;
  view.pointer = { x: e.clientX, y: e.clientY };
  view.hover = renderer.cellAt(e.clientX, e.clientY);
  if (view.drag && !view.drag.moved && Math.hypot(e.clientX - view.drag.x0, e.clientY - view.drag.y0) > 8) view.drag.moved = true;
  ui.showInfo();
});

canvas.addEventListener('pointerup', (e) => {
  const s = app.state;
  if (!s || !Sim.DAY_PHASES.has(s.phase)) {
    view.drag = null;
    return;
  }
  const cell = renderer.cellAt(e.clientX, e.clientY);
  if (view.drag) {
    const drag = view.drag;
    view.drag = null;
    if (drag.moved) {
      if (cell) place(drag.from, cell);
      return;
    }
    view.held = drag.from;
    ui.render();
    return;
  }
  if (view.held && cell) place(view.held, cell);
});

canvas.addEventListener('pointercancel', () => {
  view.drag = null;
});

canvas.addEventListener('pointerleave', () => {
  view.hover = null;
  if (!view.drag) view.pointer = null;
  ui.showInfo();
});

window.addEventListener('keydown', (e) => {
  const s = app.state;
  if (!s || e.target.closest?.('input, textarea')) return;
  if (s.phase === 'night' && e.key >= '1' && e.key <= String(CARDS.length)) {
    selectCard(CARDS[Number(e.key) - 1].id);
    e.preventDefault();
  } else if (e.key === 'Escape') {
    const help = document.getElementById('help');
    if (!help.hidden) help.hidden = true;
    view.card = null;
    if (view.held) {
      view.held = null;
      ui.render();
    }
    ui.tick();
  } else if (e.key === ' ' && s.phase === 'night') {
    act('pause');
    e.preventDefault();
  } else if (e.key === 'f' || e.key === 'F') {
    act('speed');
  }
});

// ── Schleife ──

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const s = app.state;
  if (s && s.phase === 'night' && !view.paused) {
    const aiming = view.card && CARD_BY_ID[view.card].target !== 'none';
    Sim.update(s, dt * view.speed * (aiming ? 0.3 : 1));
    if (s.phase !== 'night') {
      view.card = null;
      view.paused = false;
      ui.render();
    }
  }
  renderer.draw(s, view, now / 1000);
  ui.tick();
  requestAnimationFrame(frame);
}

new ResizeObserver(() => renderer.resize(wrap.clientWidth, wrap.clientHeight)).observe(wrap);
renderer.resize(wrap.clientWidth, wrap.clientHeight);

// Für Tests und zum Ausprobieren in der Konsole
window.__hort = { app, renderer, Sim };

function start(data) {
  const restored = data?.run ? Sim.restore(data.run) : null;
  if (restored) {
    app.state = restored;
    ui.render();
  } else {
    newRun(seedFromHash() ?? undefined);
  }
  requestAnimationFrame(frame);
}

// Bei einer neuen Version im Viewer läuft der Run weiter, statt neu zu starten
try {
  window.claude?.hot?.snapshot?.(() => ({ run: app.state ? Sim.snapshot(app.state) : null }));
} catch {
  // Ohne Viewer gibt es nichts zu sichern
}
const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
