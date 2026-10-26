// Controller über die Gamepad-API: Steuerkreuz und linker Stick bewegen einen Rahmen über die Höhle,
// einen Zielpunkt in der Nacht oder den Fokus durch die Tafel. Die Tasten sind wie bei Konsolenspielen belegt.
// Läuft mit Xbox- und PlayStation-Controllern und dem Steam Deck (Steam Input meldet sich als Xbox-Controller).

import * as Sim from './sim.js';
import { DRAGON } from './data.js';
import { COLS, ROWS } from './map.js';

// Standard-Belegung der Gamepad-API
const BUTTONS = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
export const ABILITY_BUTTONS = ['lb', 'rb', 'lt'];
const LABELS = {
  xbox: { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', back: 'View', start: 'Menü' },
  ps: { a: '✕', b: '○', x: '□', y: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', back: 'Create', start: 'Options' },
};
const DEAD = 0.5;
const REPEAT_DELAY = 0.3;
const REPEAT_RATE = 0.11;
const AIM_SPEED = 9; // Felder pro Sekunde bei voll gedrücktem Stick

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// In einem fremden Rahmen ohne Controller-Erlaubnis wirft getGamepads einen Fehler (z. B. Firefox) –
// dann gibt es eben keinen Controller, das Spiel läuft weiter
function gamepads() {
  try {
    return navigator.getGamepads?.() ?? [];
  } catch {
    return [];
  }
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function createPad(app, { ui, renderer, actions }) {
  const view = app.view;
  const panel = document.getElementById('panel');
  const prev = {};
  let index = null;
  let family = 'xbox';
  let dir = null;
  let repeat = 0;
  let focusKey = null;
  let mapMode = false; // in der Bauphase: Rahmen über der Höhle statt Fokus in der Tafel

  const phase = () => (app.mode === 'hub' ? 'hub' : app.state?.phase);
  const night = () => app.mode === 'run' && phase() === 'night';
  const building = () => app.mode === 'run' && view.selected != null && phase() !== 'night';
  const onMap = () => app.mode === 'run' && phase() === 'build' && !building() && (mapMode || view.card != null);
  const aiming = () => night() && view.ability === 'feuer';
  const openOverlay = () => [...document.querySelectorAll('.overlay')].find((el) => !el.hidden) ?? null;

  // Xbox zuerst prüfen: Der Xbox-Controller heißt auch „Wireless Controller“
  function familyOf(id) {
    if (/xbox|xinput|045e/i.test(id)) return 'xbox';
    return /054c|playstation|dualsense|dualshock|wireless controller/i.test(id) ? 'ps' : 'xbox';
  }

  window.addEventListener('gamepadconnected', (e) => {
    family = familyOf(e.gamepad.id);
    ui.toast(family === 'ps' ? 'PlayStation-Controller verbunden.' : 'Controller verbunden.');
  });
  window.addEventListener('gamepaddisconnected', (e) => {
    if (e.gamepad.index === index) {
      index = null;
      if (view.input === 'pad') setInput('pointer');
      ui.toast('Controller getrennt.');
    }
  });

  function setInput(kind) {
    if (view.input === kind) return;
    view.input = kind;
    document.body.classList.toggle('pad', kind === 'pad');
    if (kind === 'pad') {
      view.pointerType = 'gamepad';
      if (!view.cursor) view.cursor = startCell();
      syncPointer();
    }
    ui.render();
  }

  function startCell() {
    const s = app.state;
    if (!s?.chamber) return { x: COLS / 2, y: ROWS / 2 };
    const c = Sim.chamberCenter(s);
    return { x: c.c + 0.5, y: c.r - 1.5 };
  }

  const cursorCell = () => ({ c: Math.floor(view.cursor.x), r: Math.floor(view.cursor.y) });

  // Der Rahmen oder Zielpunkt erscheint dort, wo sonst die Maus wäre
  function syncPointer() {
    if (view.input !== 'pad' || !view.cursor) return;
    if (onMap() || aiming()) {
      view.hover = cursorCell();
      const origin = renderer.cellCenter(0, 0);
      const t = renderer.tileSize();
      view.pointer = { x: origin.x + (view.cursor.x - 0.5) * t, y: origin.y + (view.cursor.y - 0.5) * t };
    } else {
      view.hover = null;
      view.pointer = null;
    }
  }

  // ── Fokus in der Tafel und in Fenstern ──

  const visible = (el) => el.offsetParent !== null || el.getClientRects().length > 0;
  const focusables = (root) => [...root.querySelectorAll(FOCUSABLE)].filter(visible);
  const keyOf = (el) => (el?.dataset?.action ? `${el.dataset.action}|${el.dataset.id ?? ''}|${el.dataset.i ?? ''}|${el.dataset.dir ?? ''}` : el?.id ? `#${el.id}` : null);

  function focus(el) {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (panel.contains(el)) focusKey = keyOf(el);
  }

  function moveFocus(root, dx, dy) {
    const items = focusables(root);
    if (!items.length) return;
    const cur = document.activeElement;
    if (!items.includes(cur)) {
      focus(items.find((el) => el.classList.contains('primary')) ?? items[0]);
      return;
    }
    // Schieberegler: links und rechts verändern den Wert
    if (dx && cur.type === 'range') {
      const step = Number(cur.step) || 1;
      cur.value = clamp(Number(cur.value) + dx * step, Number(cur.min), Number(cur.max));
      cur.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const b = el.getBoundingClientRect();
      // Nur was wirklich in der gedrückten Richtung liegt
      const along = dx ? (dx > 0 ? b.left - a.right : a.left - b.right) : dy > 0 ? b.top - a.bottom : a.top - b.bottom;
      if (along < -Math.min(a.width, a.height) * 0.4) continue;
      const bx = b.left + b.width / 2;
      const by = b.top + b.height / 2;
      const across = dx ? Math.abs(by - ay) : Math.abs(bx - ax);
      const score = Math.max(0, along) + across * 2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) focus(best);
  }

  function click(root) {
    const cur = document.activeElement;
    if (cur && root.contains(cur) && cur.matches(FOCUSABLE)) {
      if (cur.type !== 'range') cur.click();
      return;
    }
    moveFocus(root, 0, 1);
  }

  function clickPrimary() {
    const btn = [...panel.querySelectorAll('.primary')].find((el) => visible(el) && !el.disabled);
    if (btn) btn.click();
  }

  // Nach jedem Neuzeichnen der Tafel den Fokus wiederfinden
  function afterRender() {
    if (view.input !== 'pad' || openOverlay()) return;
    if (night() || onMap()) return;
    const items = focusables(panel);
    const again = focusKey && items.find((el) => keyOf(el) === focusKey);
    const node = building() ? items.find((el) => el.dataset.action === 'node' && el.classList.contains('is-sel')) : null;
    focus(again ?? node ?? items.find((el) => el.classList.contains('primary') && !el.disabled) ?? items[0]);
  }

  // ── Höhle: Rahmen beim Bauen, Zielen in der Nacht ──

  function moveCursor(dx, dy) {
    const { c, r } = cursorCell();
    view.cursor = { x: clamp(c + dx, 0, COLS - 1) + 0.5, y: clamp(r + dy, 1, ROWS - 1) + 0.5 };
    syncPointer();
    ui.showInfo();
  }

  function cycleCard(step) {
    const s = app.state;
    const n = s.deck.hand.length;
    if (!n) return;
    const cur = view.card ?? (step > 0 ? -1 : 0);
    const i = (cur + step + n) % n;
    if (view.card !== i) app.act('card', { i });
    if (view.card != null) {
      mapMode = true;
      if (!view.cursor) view.cursor = startCell();
      syncPointer();
    }
  }

  // ── Tasten ──

  function onDir(dx, dy) {
    const overlay = openOverlay();
    if (overlay) {
      moveFocus(overlay, dx, dy);
      return;
    }
    if (aiming() || onMap()) moveCursor(dx, dy);
    else if (!night()) moveFocus(panel, dx, dy);
  }

  function onButton(b) {
    const overlay = openOverlay();
    if (overlay) {
      if (b === 'a') click(overlay);
      else if (b === 'b' || b === 'back' || b === 'start') actions.closeOverlays();
      else if ((b === 'lb' || b === 'rb') && overlay.id === 'book') actions.bookTab(b === 'rb' ? 1 : -1);
      return;
    }
    const p = phase();
    if (b === 'back') {
      actions.openHelp();
      return;
    }
    if (b === 'start') {
      if (p === 'night') app.act('pause');
      else actions.openSettings();
      return;
    }
    if (night()) {
      const i = ABILITY_BUTTONS.indexOf(b);
      if (i >= 0 && i < DRAGON.abilities.length) {
        actions.selectAbility(DRAGON.abilities[i].id);
        if (aiming()) {
          const s = app.state;
          // Zuerst auf den gefährlichsten Helden zielen
          const foe = Sim.activeHeroes(s).sort((x, y) => (y.carry ? 1 : 0) - (x.carry ? 1 : 0))[0];
          view.cursor = foe ? { x: foe.x, y: foe.y } : view.cursor ?? startCell();
          syncPointer();
        }
      } else if (b === 'a' && aiming()) actions.cast(cursorCell());
      else if (b === 'b') actions.cancel();
      else if (b === 'y') app.act('speed');
      return;
    }
    if (building()) {
      if (b === 'b') app.act('deselect');
      else if (b === 'a') click(panel);
      else if (b === 'y') clickPrimary();
      return;
    }
    if (p === 'build') {
      if (b === 'lb' || b === 'rb') {
        cycleCard(b === 'rb' ? 1 : -1);
        return;
      }
      if (b === 'x') {
        // Rahmen über die Höhle, um einen Turm zu wählen; B kehrt in die Tafel zurück
        mapMode = true;
        if (!view.cursor) view.cursor = startCell();
        syncPointer();
        ui.render();
        return;
      }
      if (onMap()) {
        if (b === 'a') {
          actions.tapCell(cursorCell());
          if (view.card == null && view.selected == null) syncPointer();
          if (view.selected != null) mapMode = false;
        } else if (b === 'b') {
          mapMode = false;
          actions.cancel();
          ui.render();
        } else if (b === 'y') clickPrimary();
        return;
      }
    }
    if (b === 'a') click(panel);
    else if (b === 'y') clickPrimary();
    else if (b === 'b' && view.card != null) actions.cancel();
  }

  // ── Abfrage, einmal pro Bild ──

  function read() {
    const pads = gamepads();
    let chosen = index != null ? pads[index] : null;
    for (const gp of pads) {
      if (!gp?.connected) continue;
      const busy = gp.buttons.some((x) => x.pressed) || gp.axes.some((v) => Math.abs(v) > DEAD);
      if (busy || !chosen) {
        chosen = gp;
        if (busy) break;
      }
    }
    return chosen?.connected ? chosen : null;
  }

  function poll(dt) {
    if (phase() !== 'build' || building()) mapMode = false;
    const gp = read();
    if (!gp) return;
    if (gp.index !== index) {
      index = gp.index;
      family = familyOf(gp.id);
    }
    const down = {};
    for (const [name, i] of Object.entries(BUTTONS)) {
      const btn = gp.buttons[i];
      down[name] = !!btn && (btn.pressed || btn.value > 0.5);
    }
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    const stick = Math.hypot(ax, ay) > DEAD;
    const any = Object.values(down).some(Boolean) || stick;
    const freeAim = aiming() && !openOverlay();

    // Richtungen: Steuerkreuz, sonst Stick – mit Wiederholung beim Festhalten
    let d = null;
    if (down.up) d = [0, -1];
    else if (down.down) d = [0, 1];
    else if (down.left) d = [-1, 0];
    else if (down.right) d = [1, 0];
    else if (stick && !freeAim) d = Math.abs(ax) > Math.abs(ay) ? [Math.sign(ax), 0] : [0, Math.sign(ay)];
    const key = d ? d.join() : null;

    if (view.input !== 'pad') {
      // Der erste Druck weckt nur die Steuerung, damit nichts aus Versehen passiert
      if (any) {
        setInput('pad');
        dir = key;
        repeat = REPEAT_DELAY;
      }
      Object.assign(prev, down);
      return;
    }

    // Freies Zielen mit dem Stick beim Feueratem
    if (freeAim && stick) {
      const k = Math.min(1, (Math.hypot(ax, ay) - DEAD * 0.6) / (1 - DEAD * 0.6));
      const len = Math.hypot(ax, ay);
      view.cursor = {
        x: clamp(view.cursor.x + (ax / len) * k * k * AIM_SPEED * dt, 0.5, COLS - 0.5),
        y: clamp(view.cursor.y + (ay / len) * k * k * AIM_SPEED * dt, 1.5, ROWS - 0.5),
      };
      syncPointer();
    }

    if (key !== dir) {
      dir = key;
      repeat = REPEAT_DELAY;
      if (d) onDir(d[0], d[1]);
    } else if (d) {
      repeat -= dt;
      if (repeat <= 0) {
        repeat = REPEAT_RATE;
        onDir(d[0], d[1]);
      }
    }

    for (const name of ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start']) {
      if (down[name] && !prev[name]) onButton(name);
    }
    Object.assign(prev, down);
    syncPointer();
  }

  // Rütteln bei großen Momenten – nur wenn mit Controller gespielt wird
  const RUMBLE = { roar: [380, 0.7, 0.4], wing: [160, 0.3, 0.35], breath: [240, 0.3, 0.4], balmung: [200, 0.6, 0.3], dig: [260, 0.4, 0.2], snare: [90, 0.3, 0.2] };
  function effects(list) {
    if (view.input !== 'pad' || index == null || !list.length) return;
    const gp = gamepads()[index];
    const motor = gp?.vibrationActuator;
    if (!motor?.playEffect) return;
    for (const e of list) {
      const r = e.type === 'grab' && e.id === 'ei' ? [450, 1, 0.6] : RUMBLE[e.type];
      if (r) {
        motor.playEffect('dual-rumble', { duration: r[0], strongMagnitude: r[1], weakMagnitude: r[2] }).catch(() => {});
        return;
      }
    }
  }

  return {
    poll,
    effects,
    afterRender,
    setInput,
    label: (name) => LABELS[family][name],
    get family() {
      return family;
    },
    get connected() {
      return index != null && !!gamepads()[index]?.connected;
    },
    get mapMode() {
      return onMap();
    },
  };
}
