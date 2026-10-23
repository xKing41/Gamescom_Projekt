// Verbindet Spiellogik, Meta-Progression, Höhlenbild und Tafel: Eingaben, Spielschleife, Speichern, Start.

import * as Sim from './sim.js';
import * as Meta from './meta.js';
import { TREASURES, CARD_BY_ID, HAND_SIZE } from './data.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { createStore, loadLocal } from './storage.js';
import { randomSeed, codeToSeed } from './rng.js';
import { createAudio } from './audio.js';
import { createPad } from './pad.js';

const canvas = document.getElementById('board');
const wrap = document.getElementById('board-wrap');
const renderer = createRenderer(canvas);

const view = {
  hub: true, // Höhle zwischen den Runs: das Brett ist nur Vorschau
  scars: 0,
  held: null, // ausgewählter Schatz: { where: 'hoard', c, r } | { where: 'tray', i }
  drag: null,
  hover: null,
  pointer: null,
  pointerType: 'mouse',
  card: null,
  paused: false,
  speed: 1,
  input: 'pointer', // 'pointer' | 'pad' – bestimmt Rahmen, Tastenhinweise und Fokus
  cursor: null, // Controller-Rahmen in Feldern: { x, y }
  aimUid: null, // Held, auf den der Controller gerade zielt
};

const audio = createAudio();

const store = createStore(loadLocal() ?? Meta.newProfile(), () => {
  // Auf einem anderen Gerät wurde weitergespielt: Höhle mit dem zusammengeführten Stand neu zeigen
  if (app.mode === 'hub') showHub();
});

const app = {
  mode: 'hub', // 'hub' | 'run'
  state: null,
  report: null,
  finished: false,
  view,
  act,
  audio,
  pad: null,
  onRender: () => app.pad?.afterRender(),
  get profile() {
    return store.get();
  },
};
const ui = createUI(app);

// ── Profil ändern ──

function updateProfile(change) {
  const next = structuredClone(store.get());
  change(next);
  next.updatedAt = Date.now();
  store.save(next);
}

// ── Höhle und Runs ──

function showHub() {
  const p = store.get();
  const options = Meta.runOptions(p, 'normal');
  app.mode = 'hub';
  app.report = null;
  app.state = Sim.createRun(1, options);
  view.hub = true;
  view.scars = Meta.maxLegend(p, options.species);
  view.held = null;
  view.card = null;
  view.paused = false;
  ui.render();
}

function startRun(seed, options) {
  app.mode = 'run';
  app.report = null;
  app.finished = false;
  app.state = Sim.createRun(seed, options);
  view.hub = false;
  view.held = null;
  view.drag = null;
  view.card = null;
  view.paused = false;
  ui.render();
}

function startFromHub() {
  const p = store.get();
  const mode = Meta.modeAvailable(p, p.choice.mode) ? p.choice.mode : 'normal';
  const seed = mode === 'weekly' ? Meta.weekSeed(Meta.weekKey()) : randomSeed();
  startRun(seed, Meta.runOptions(p, mode));
}

// Nach Sieg oder Niederlage: Fortschritt auswerten und speichern – genau einmal pro Run
function finishRun() {
  if (app.finished) return;
  app.finished = true;
  const { profile, report } = Meta.applyRun(store.get(), app.state);
  store.save(profile);
  app.report = report;
  view.card = null;
  view.paused = false;
  ui.render();
}

function act(type, p = {}) {
  const s = app.state;
  switch (type) {
    // Höhle
    case 'pick-species':
      updateProfile((pr) => {
        pr.choice.species = p.id;
        pr.choice.legend = Math.min(pr.choice.legend, Meta.maxLegend(pr, p.id));
      });
      showHub();
      return;
    case 'pick-variant':
      updateProfile((pr) => {
        pr.species[pr.choice.species].variant = p.i;
      });
      showHub();
      return;
    case 'pick-legend':
      updateProfile((pr) => {
        pr.choice.legend = p.i;
      });
      showHub();
      return;
    case 'toggle-card': {
      const hand = Meta.validLoadout(store.get());
      if (!hand.includes(p.id) && hand.length >= HAND_SIZE) {
        ui.toast(`Du hast schon ${HAND_SIZE} Karten. Nimm erst eine heraus.`);
        return;
      }
      if (hand.includes(p.id) && hand.length <= 1) return;
      updateProfile((pr) => {
        pr.loadout = hand.includes(p.id) ? hand.filter((id) => id !== p.id) : [...hand, p.id];
      });
      ui.render();
      return;
    }
    case 'pick-mode':
      updateProfile((pr) => {
        pr.choice.mode = p.id;
      });
      ui.render();
      return;
    case 'intro-ok':
      updateProfile((pr) => {
        pr.introSeen = true;
      });
      ui.render();
      return;
    case 'start-run':
      startFromHub();
      return;
    case 'to-hub':
      showHub();
      return;
    case 'again':
      startRun(s.opts.mode === 'weekly' ? s.seed : randomSeed(), s.opts.mode === 'weekly' || s.opts.mode === 'code' ? s.opts : Meta.runOptions(store.get(), s.opts.mode));
      return;

    // Run
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
      audio.ui(result.ok ? 'drop' : 'error');
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
    case 'pause':
      if (app.mode === 'run' && s.phase === 'night') view.paused = !view.paused;
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
  if (app.mode !== 'run' || s.phase !== 'night' || !s.opts.cards.includes(id)) return;
  const card = CARD_BY_ID[id];
  if (s.glut < card.cost) {
    fail('Zu wenig Glut.');
    return;
  }
  if (card.target === 'none') {
    const result = Sim.playCard(s, id);
    if (!result.ok) fail(result.reason);
    view.card = null;
  } else {
    view.card = view.card === id ? null : id;
    if (view.card) audio.ui('select');
  }
  ui.tick();
}

function fail(reason) {
  ui.toast(reason);
  audio.ui('error');
}

// Zielt mit der gewählten Karte: auf ein Feld { c, r } oder einen Helden { uid }
function cast(target) {
  const result = Sim.playCard(app.state, view.card, target);
  if (result.ok) view.card = null;
  else fail(result.reason);
  ui.tick();
}

function castAt(clientX, clientY) {
  const s = app.state;
  const card = CARD_BY_ID[view.card];
  if (card.target === 'tile') {
    const cell = renderer.cellAt(clientX, clientY);
    if (cell) cast(cell);
    return;
  }
  const hero = renderer.heroAt(s, clientX, clientY, 0.9);
  if (hero) cast({ uid: hero.uid });
  else fail('Tippe direkt auf einen Helden.');
}

function place(from, cell) {
  const s = app.state;
  const id = from.where === 'tray' ? s.tray[from.i]?.id : Sim.itemAt(s, from.c, from.r)?.id;
  const result = Sim.moveItem(s, from, cell.c, cell.r);
  if (result.kind === 'merge') ui.toast(`Verschmolzen: ${TREASURES[result.id].name}`);
  else if (result.ok && id) audio.ui('place', { c: cell.c, weight: TREASURES[id].weight });
  else if (!result.ok && result.reason) fail(result.reason);
  view.held = null;
  ui.render();
}

// Antippen eines Hortfelds am Tag: Schatz aufnehmen oder den gehaltenen dort ablegen
function tapCell(cell) {
  if (!inDay()) return;
  if (view.held) {
    place(view.held, cell);
    return;
  }
  if (Sim.itemAt(app.state, cell.c, cell.r)) {
    view.held = { where: 'hoard', c: cell.c, r: cell.r };
    audio.ui('pickup', { c: cell.c });
    ui.render();
  }
}

function cancel() {
  view.card = null;
  if (view.held) {
    view.held = null;
    ui.render();
  }
  ui.tick();
}

const inDay = () => app.mode === 'run' && Sim.DAY_PHASES.has(app.state.phase);

// ── Zeigen, Ziehen, Tippen ──

canvas.addEventListener('pointerdown', (e) => {
  const s = app.state;
  app.pad.setInput('pointer');
  if (!s || app.mode !== 'run') return;
  view.pointerType = e.pointerType;
  view.pointer = { x: e.clientX, y: e.clientY };
  view.hover = renderer.cellAt(e.clientX, e.clientY);
  if (s.phase === 'night') {
    if (view.card) castAt(e.clientX, e.clientY);
    return;
  }
  if (!inDay() || view.held || !view.hover) return;
  if (Sim.itemAt(s, view.hover.c, view.hover.r)) {
    view.drag = { from: { where: 'hoard', c: view.hover.c, r: view.hover.r }, x0: e.clientX, y0: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (view.input === 'pad') {
    // Erst eine echte Bewegung der Maus schaltet vom Controller zurück
    if (Math.abs(e.movementX) + Math.abs(e.movementY) < 3) return;
    app.pad.setInput('pointer');
  }
  view.pointerType = e.pointerType;
  view.pointer = { x: e.clientX, y: e.clientY };
  view.hover = app.mode === 'run' ? renderer.cellAt(e.clientX, e.clientY) : null;
  if (view.drag && !view.drag.moved && Math.hypot(e.clientX - view.drag.x0, e.clientY - view.drag.y0) > 8) view.drag.moved = true;
  ui.showInfo();
});

canvas.addEventListener('pointerup', (e) => {
  if (!inDay()) {
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
    tapCell(drag.from);
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
  const night = app.mode === 'run' && s.phase === 'night';
  if (night && e.key >= '1' && e.key <= String(s.opts.cards.length)) {
    selectCard(s.opts.cards[Number(e.key) - 1]);
    e.preventDefault();
  } else if (e.key === 'Escape') {
    ui.closeOverlays();
    cancel();
  } else if (e.key === 'm' || e.key === 'M') {
    audio.setMuted(!audio.settings.muted);
    ui.toast(audio.settings.muted ? 'Ton aus. M schaltet ihn wieder ein.' : 'Ton an.');
    ui.tick();
  } else if (e.key === ' ' && night) {
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
  app.pad.poll(dt);
  const s = app.state;
  // Solange Regeln, Hortbuch oder Einstellungen offen sind, steht die Nacht still
  if (s && app.mode === 'run' && s.phase === 'night' && !view.paused && !ui.overlayOpen()) {
    const aiming = view.card && CARD_BY_ID[view.card].target !== 'none';
    Sim.update(s, dt * view.speed * (aiming ? 0.3 : 1));
    if (s.phase !== 'night') {
      view.card = null;
      view.paused = false;
      if (s.phase === 'won' || s.phase === 'lost') finishRun();
      else ui.render();
    }
  }
  audio.update(s, app.mode, view);
  if (s?.fx.length) {
    audio.effects(s.fx);
    app.pad.effects(s.fx);
  }
  renderer.draw(s, view, now / 1000);
  ui.tick();
  requestAnimationFrame(frame);
}

app.pad = createPad(app, {
  ui,
  renderer,
  actions: {
    tapCell,
    selectCard,
    cast,
    cancel,
    fail,
    pickTray: (i) => act('pick-tray', { i }),
    closeOverlays: () => ui.closeOverlays(),
    openHelp: () => ui.openHelp(),
    openSettings: () => ui.openSettings(),
    bookTab: (step) => ui.bookTab(step),
  },
});

// Der Ton darf erst nach einer Eingabe starten. Die Desktop-Fassung darf sofort.
for (const type of ['pointerdown', 'pointerup', 'keydown', 'click']) window.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
if (window.hortDesktop) audio.unlock();

// Leiser Klick für Knöpfe; Karten haben ihren eigenen Klang
document.addEventListener('click', (e) => {
  const btn = e.target.closest?.('button');
  if (btn && !btn.disabled && btn.dataset.action !== 'card') audio.ui('click');
}, true);

new ResizeObserver(() => renderer.resize(wrap.clientWidth, wrap.clientHeight)).observe(wrap);
renderer.resize(wrap.clientWidth, wrap.clientHeight);

// Für Tests und zum Ausprobieren in der Konsole
window.__hort = { app, renderer, Sim, Meta, store, audio, showHub, finishRun };

function seedFromHash() {
  const m = /^#([0-9a-z]{1,7})$/i.exec(location.hash);
  return m ? codeToSeed(m[1]) : null;
}

function start(data) {
  const restored = data?.run ? Sim.restore(data.run) : null;
  const code = seedFromHash();
  if (restored && data.mode === 'run') {
    app.mode = 'run';
    app.state = restored;
    app.finished = restored.phase === 'won' || restored.phase === 'lost';
    app.report = data.report ?? null;
    view.hub = false;
    ui.render();
  } else if (code != null) {
    // Ein Hort-Code im Link startet diesen Run mit festen Regeln
    startRun(code, { ...Meta.runOptions(store.get(), 'code'), mode: 'code' });
  } else {
    showHub();
  }
  requestAnimationFrame(frame);
}

// Bei einer neuen Version im Viewer läuft der Run weiter, statt neu zu starten
try {
  window.claude?.hot?.snapshot?.(() => ({ mode: app.mode, run: app.state && app.mode === 'run' ? Sim.snapshot(app.state) : null, report: app.report }));
} catch {
  // Ohne Viewer gibt es nichts zu sichern
}
const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
