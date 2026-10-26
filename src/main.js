// Verbindet Spiellogik, Meta-Progression, Höhlenbild und Tafel: Eingaben, Spielschleife, Speichern, Start.

import * as Sim from './sim.js';
import * as Meta from './meta.js';
import { ABILITY_BY_ID, DRAGON, BUILDINGS, DECK_SIZE } from './data.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { createStore, loadLocal } from './storage.js';
import { randomSeed, codeToSeed } from './rng.js';
import { createAudio } from './audio.js';
import { createPad } from './pad.js';
import { chunkOf } from './map.js';

const canvas = document.getElementById('board');
const wrap = document.getElementById('board-wrap');
const renderer = createRenderer(canvas);

const view = {
  hub: true, // Höhle zwischen den Runs: das Brett ist nur Vorschau
  scars: 0,
  dig: null, // gewähltes Stollenstück und Richtung: { offer, dir }
  card: null, // gewählter Bauplan aus der Hand (Index)
  selected: null, // gewählter Bau (uid): Werte, Baum, Ausrüstung
  ability: null, // Fähigkeit, mit der gerade gezielt wird
  hover: null,
  pointer: null,
  pointerType: 'mouse',
  paused: false,
  speed: 1,
  input: 'pointer', // 'pointer' | 'pad' – bestimmt Rahmen, Tastenhinweise und Fokus
  cursor: null, // Controller-Rahmen in Feldern: { x, y }
  aimUid: null,
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

function resetView() {
  view.dig = null;
  view.card = null;
  view.selected = null;
  view.ability = null;
  view.paused = false;
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
  resetView();
  ui.render();
}

function startRun(seed, options) {
  app.mode = 'run';
  app.report = null;
  app.finished = false;
  app.state = Sim.createRun(seed, options);
  view.hub = false;
  resetView();
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
  resetView();
  ui.render();
}

function fail(reason) {
  ui.toast(reason);
  audio.ui('error');
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
    case 'toggle-deck': {
      const pr = store.get();
      const inDeck = pr.deck.includes(p.id);
      if (!inDeck && pr.deck.length >= DECK_SIZE) {
        fail(`Dein Deck hat schon ${DECK_SIZE} Baupläne. Nimm erst einen heraus.`);
        return;
      }
      updateProfile((x) => {
        x.deck = inDeck ? x.deck.filter((id) => id !== p.id) : [...x.deck, p.id];
      });
      ui.render();
      return;
    }
    case 'buy': {
      const result = Meta.buyUnlock(store.get(), p.id);
      if (!result.ok) {
        fail(result.reason);
        return;
      }
      result.profile.updatedAt = Date.now();
      store.save(result.profile);
      audio.ui('levelup');
      ui.toast('Freigeschaltet!');
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

    // Graben
    case 'dig-dir':
      view.dig = { offer: p.i, dir: p.dir };
      audio.ui('select');
      break;
    case 'dig-preview':
      view.dig = { offer: p.i, dir: p.dir };
      ui.showInfo();
      return;
    case 'dig': {
      if (!view.dig || view.dig.offer == null || !view.dig.dir) return;
      const result = Sim.dig(s, view.dig.offer, view.dig.dir);
      if (!result.ok) fail(result.reason);
      view.dig = null;
      break;
    }
    case 'skip-dig':
      Sim.skipDig(s);
      break;

    // Bauen
    case 'card':
      if (s.phase !== 'build') return;
      view.selected = null;
      view.card = view.card === p.i ? null : p.i;
      if (view.card != null && BUILDINGS[s.deck.hand[view.card]].cost > s.gold) {
        fail('Dafür reicht dein Gold nicht.');
        view.card = null;
      } else if (view.card != null) audio.ui('select');
      break;
    case 'redraw': {
      const result = Sim.redraw(s);
      if (!result.ok) fail(result.reason);
      view.card = null;
      break;
    }
    case 'select':
      view.card = null;
      view.selected = p.uid;
      break;
    case 'deselect':
      view.selected = null;
      break;
    case 'learn': {
      const result = Sim.learnNode(s, view.selected, p.id);
      if (!result.ok) fail(result.reason);
      break;
    }
    case 'respec': {
      const result = Sim.respec(s, view.selected);
      if (!result.ok) fail(result.reason);
      else ui.toast('Umgeschult: Alle Punkte sind wieder frei.');
      break;
    }
    case 'sell': {
      const result = Sim.sellBuilding(s, view.selected);
      if (result.ok) {
        ui.toast(`Abgerissen: +${result.refund} Gold.`);
        view.selected = null;
      }
      break;
    }
    case 'socket': {
      const result = Sim.socketGear(s, view.selected, p.i);
      if (!result.ok) fail(result.reason);
      break;
    }
    case 'unsocket':
      Sim.unsocketGear(s, view.selected, p.i);
      break;
    case 'start-night':
      resetView();
      Sim.startNight(s);
      break;

    // Nacht und Morgen
    case 'ability':
      selectAbility(p.id);
      return;
    case 'next-day':
      Sim.nextDay(s);
      resetView();
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

// ── Fähigkeiten des Drachen ──

function selectAbility(id) {
  const s = app.state;
  if (app.mode !== 'run' || s.phase !== 'night') return;
  const ab = ABILITY_BY_ID[id];
  if (!Sim.abilityReady(s, id)) {
    fail(`${ab.name.replace(/­/g, '')} lädt noch.`);
    return;
  }
  if (ab.target === 'tile') {
    view.ability = view.ability === id ? null : id;
    if (view.ability) audio.ui('select');
  } else {
    const result = Sim.useAbility(s, id);
    if (!result.ok) fail(result.reason);
    view.ability = null;
  }
  ui.tick();
}

// Zielt mit dem Feueratem auf ein Feld
function cast(target) {
  const result = Sim.useAbility(app.state, view.ability, target);
  if (result.ok) view.ability = null;
  else fail(result.reason);
  ui.tick();
}

// ── Antippen der Höhle ──

const inDay = () => app.mode === 'run' && Sim.DAY_PHASES.has(app.state.phase);

function tapCell(cell) {
  const s = app.state;
  if (app.mode !== 'run' || !cell) return;
  if (s.phase === 'night') {
    if (view.ability) cast(cell);
    return;
  }
  if (s.phase === 'dig' && s.offers.length && cell.r >= 1) {
    const { cx, cy } = chunkOf(cell.c, cell.r);
    const option = Sim.digDirections(s).find((o) => o.cx === cx && o.cy === cy);
    if (option) {
      view.dig = { offer: view.dig?.offer ?? 0, dir: option.dir };
      audio.ui('select');
      ui.render();
      return;
    }
  }
  if (s.phase === 'build' && view.card != null) {
    const result = Sim.playCard(s, view.card, cell.c, cell.r);
    if (result.ok) view.card = null;
    else fail(result.reason);
    ui.render();
    return;
  }
  const b = inDay() ? Sim.buildingAt(s, cell.c, cell.r) ?? towerAbove(s, cell) : null;
  if (b) {
    act('select', { uid: b.uid });
    audio.ui('pickup', { c: b.c });
    return;
  }
  if (view.selected != null) {
    view.selected = null;
    ui.render();
  }
}

// Türme ragen nach oben aus ihrem Feld: Ein Tippen knapp darüber zählt auch
function towerAbove(s, cell) {
  const b = Sim.buildingAt(s, cell.c, cell.r + 1);
  return b?.kind === 'tower' ? b : null;
}

function cancel() {
  view.ability = null;
  if (view.card != null || view.selected != null) {
    view.card = null;
    view.selected = null;
    ui.render();
  }
  ui.tick();
}

// ── Zeigen und Tippen ──

canvas.addEventListener('pointerdown', (e) => {
  app.pad.setInput('pointer');
  view.pointerType = e.pointerType;
  view.pointer = { x: e.clientX, y: e.clientY };
  view.hover = renderer.cellAt(e.clientX, e.clientY);
  // Nachts zählt jeder Augenblick: sofort zielen
  if (app.mode === 'run' && app.state.phase === 'night' && view.ability) tapCell(view.hover);
});

canvas.addEventListener('pointerup', (e) => {
  if (app.mode !== 'run' || app.state.phase === 'night') return;
  tapCell(renderer.cellAt(e.clientX, e.clientY));
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
  ui.showInfo();
});

canvas.addEventListener('pointerleave', () => {
  view.hover = null;
  view.pointer = null;
  ui.showInfo();
});

window.addEventListener('keydown', (e) => {
  const s = app.state;
  if (!s || e.target.closest?.('input, textarea')) return;
  const run = app.mode === 'run';
  const night = run && s.phase === 'night';
  const n = Number(e.key);
  if (night && n >= 1 && n <= DRAGON.abilities.length) {
    selectAbility(DRAGON.abilities[n - 1].id);
    e.preventDefault();
  } else if (run && s.phase === 'build' && n >= 1 && n <= s.deck.hand.length) {
    act('card', { i: n - 1 });
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
let shownPhase = null;

// Ton und Controller sind Zugaben: Geht dort etwas schief, läuft das Spiel trotzdem weiter.
// Der Fehler landet in der Konsole, damit die Tests ihn sehen.
function safely(fn) {
  try {
    fn();
  } catch (e) {
    console.error(e);
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  safely(() => app.pad.poll(dt));
  const s = app.state;
  // Solange Regeln, Hortbuch oder Einstellungen offen sind, steht die Nacht still
  if (s && app.mode === 'run' && s.phase === 'night' && !view.paused && !ui.overlayOpen()) {
    const aiming = view.ability === 'feuer';
    Sim.update(s, dt * view.speed * (aiming ? 0.3 : 1));
  }
  // Ist die Nacht vorbei (oder der Run), zeigt die Tafel den Morgen oder das Ende
  if (s && app.mode === 'run' && s.phase !== shownPhase) {
    const from = shownPhase;
    shownPhase = s.phase;
    if (from === 'night') {
      view.ability = null;
      view.paused = false;
    }
    if ((s.phase === 'won' || s.phase === 'lost') && !app.finished) finishRun();
    else if (from === 'night') ui.render();
  }
  safely(() => audio.update(s, app.mode, view));
  if (s?.fx.length) {
    safely(() => audio.effects(s.fx));
    safely(() => app.pad.effects(s.fx));
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
    selectAbility,
    cast,
    cancel,
    fail,
    closeOverlays: () => ui.closeOverlays(),
    openHelp: () => ui.openHelp(),
    openSettings: () => ui.openSettings(),
    bookTab: (step) => ui.bookTab(step),
  },
});

// Der Ton darf erst nach einer Eingabe starten. Die Desktop-Fassung darf sofort.
for (const type of ['pointerdown', 'pointerup', 'keydown', 'click']) window.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
if (window.hortDesktop) audio.unlock();

// Leiser Klick für Knöpfe; Baupläne und Fähigkeiten haben ihren eigenen Klang
document.addEventListener('click', (e) => {
  const btn = e.target.closest?.('button');
  if (btn && !btn.disabled && !['card', 'ability', 'dig-dir'].includes(btn.dataset.action)) audio.ui('click');
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
