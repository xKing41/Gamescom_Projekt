// Die Tafel neben der Höhle: zwischen den Runs die Höhle (Drache, Legende, Deck, Werkstatt, Modus),
// im Run die aktuelle Phase (Graben, Bauen, ein Turm mit seinem Baum, Nacht, Morgen), am Ende die Belohnungen.
// Dazu Kopfzeile, Regeln, Einstellungen und Hortbuch.

import {
  TREASURES, HEROES, ENTRANCES, PIECES, BUILDINGS, BUILDING_ORDER, BUILDING_KINDS, GEAR, DAMAGE, LAYER_NAMES,
  DRAGON, SPECIES, SPECIES_ORDER, LEGEND, DEEDS, UNLOCKS, UNLOCK_KINDS, CONFIG, DECK_SIZE,
} from './data.js';
import * as Sim from './sim.js';
import * as Meta from './meta.js';
import { iconURL } from './pixel/images.js';
import { seedToCode } from './rng.js';
import { COLS } from './map.js';
import { ABILITY_BUTTONS } from './pad.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const num = (value, digits = 1) => value.toFixed(digits).replace('.', ',');
const stars = (n) => '★'.repeat(n);
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const plain = (text) => text.replace(/­/g, '');

// „dein Kelch“, „deine Krone“, „deinen Goldmünzen“ – passend zu Geschlecht und Fall
const POSS = {
  nom: { m: 'dein', f: 'deine', n: 'dein', pl: 'deine' },
  acc: { m: 'deinen', f: 'deine', n: 'dein', pl: 'deine' },
  dat: { m: 'deinem', f: 'deiner', n: 'deinem', pl: 'deinen' },
};
const yours = (id, casus) => `${POSS[casus][TREASURES[id].g]} ${TREASURES[id].name}`;
const isBack = (id) => `${cap(yours(id, 'nom'))} ${TREASURES[id].g === 'pl' ? 'sind' : 'ist'} zurück`;

const img = (url, w, h = w, cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${url}" alt="" width="${w}" height="${h}">`;
const treasureImg = (id, size = 40, silhouette = false) => img(iconURL('t', id, 96, { silhouette }), size);
const heroImg = (type, size = 36, silhouette = false) => img(iconURL('hero', type, 96, { silhouette }), size, Math.round((size * 20) / 16));
const buildingImg = (id, size = 40, silhouette = false) => img(iconURL('building', id, 96, { silhouette }), size, BUILDINGS[id]?.kind === 'tower' ? Math.round((size * 20) / 16) : size);

function dragonImg(species, variant = 0, { width = 120, silhouette = false, scars = 0 } = {}) {
  const palettes = SPECIES[species].palettes;
  const palette = palettes[variant] ?? palettes[0];
  return img(iconURL('dragon', `${species}:${variant}`, 96, { silhouette, palette, scars }), width, Math.round((width * 56) / 128));
}

const STRONG = { stich: 'Leben', wucht: 'Rüstung', feuer: 'Leben', magie: 'Segen' };
const WEAK = { stich: 'Rüstung', wucht: 'Segen', feuer: 'Segen', magie: 'Leben und Rüstung' };
const coinIcon = '<i class="coin" aria-hidden="true"></i>';
const glutIcon = '<i class="ember" aria-hidden="true"></i>';

const SPEAKER = '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>';
const ICON_SOUND = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${SPEAKER}<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_MUTED = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

const unlockLabel = (id) => `${UNLOCK_KINDS[UNLOCKS[id].kind]}: ${UNLOCKS[id].name}`;

function unlockIcon(id, size = 30) {
  const u = UNLOCKS[id];
  if (u.kind === 'building') return buildingImg(id, size);
  if (u.kind === 'node') return buildingImg(u.tower, size);
  return `<span class="glyph" aria-hidden="true">∞</span>`;
}

function blueprintCard(id, { on = false, action = null, i = null, key = null, disabled = false, compact = false } = {}) {
  const def = BUILDINGS[id];
  const attrs = action ? ` type="button" data-action="${action}" data-id="${id}"${i != null ? ` data-i="${i}"` : ''} aria-pressed="${on}"${disabled ? ' aria-disabled="true"' : ''}` : '';
  const tag = action ? 'button' : 'div';
  const sub = def.kind === 'tower' ? `Turm · ${DAMAGE[def.tower.type].name}` : BUILDING_KINDS[def.kind];
  return `<${tag} class="card bp kind-${def.kind}${on ? ' is-on' : ''}${disabled ? ' is-poor' : ''}${compact ? ' compact' : ''}"${attrs}${action ? '' : ' role="group"'}>
    <span class="card-top">${key != null ? `<kbd>${esc(key)}</kbd>` : '<span></span>'}<span class="price">${def.cost}${coinIcon}</span></span>
    ${buildingImg(id, 40).replace('<img', '<img class="card-art"')}
    <strong>${esc(def.name)}</strong>
    <span class="kind">${esc(sub)}</span>
    <span class="card-text">${esc(def.text)}</span>
  </${tag}>`;
}

export function createUI(app) {
  const $ = (id) => document.getElementById(id);
  const panel = $('panel');
  const bar = {
    phase: $('s-phase'),
    gold: $('s-gold'),
    goldWrap: $('s-gold-wrap'),
    value: $('s-value'),
    valueWrap: $('s-value-wrap'),
    glut: $('s-glut'),
  };
  const buttons = {
    pause: $('btn-pause'),
    speed: $('btn-speed'),
    help: $('btn-help'),
    helpClose: $('btn-help-close'),
    bookClose: $('btn-book-close'),
    settings: $('btn-settings'),
    settingsClose: $('btn-settings-close'),
    mute: $('btn-mute'),
    fullscreen: $('btn-fullscreen'),
    quit: $('btn-quit'),
  };
  const help = $('help');
  const book = $('book');
  const settingsEl = $('settings');
  const toastEl = $('toast');
  const vol = { sfx: $('vol-sfx'), music: $('vol-music') };
  const audio = app.audio;
  const desktop = window.hortDesktop ?? null;

  // Hinweise passend zum Eingabegerät: Tastatur und Maus oder Controller
  const usingPad = () => app.view.input === 'pad' && !!app.pad;
  const glyph = (name) => `<span class="pad-glyph">${esc(app.pad.label(name))}</span>`;
  const padPrefix = (name) => (usingPad() ? `${glyph(name)} ` : '');

  let lastView = null;
  let bookTab = 'bauplaene';
  let toastTimer = 0;
  let infoCache = '';
  let nodeSel = null;
  const cache = {};

  // ── Ereignisse ──

  panel.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const action = el.dataset.action;
    const i = el.dataset.i != null ? Number(el.dataset.i) : undefined;
    if (action === 'open-book') openBook(el.dataset.id ?? 'bauplaene');
    else if (action === 'copy-code') {
      const code = seedToCode(app.state.seed);
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast('Hort-Code kopiert.'), selectCode);
      else selectCode();
    } else if (action === 'node') {
      nodeSel = el.dataset.id;
      render();
    } else app.act(action, { id: el.dataset.id, i, dir: el.dataset.dir });
  });

  // Mit dem Controller oder der Tastatur durch die Angebote: Die Vorschau in der Höhle folgt dem Fokus
  panel.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-action="dig-dir"]');
    if (el && app.mode === 'run' && app.state.phase === 'dig') app.act('dig-preview', { i: Number(el.dataset.i), dir: el.dataset.dir });
  });

  function selectCode() {
    const el = $('run-code');
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  }

  buttons.pause.addEventListener('click', () => app.act('pause'));
  buttons.speed.addEventListener('click', () => app.act('speed'));

  // ── Fenster: Regeln, Hortbuch, Einstellungen ──

  const overlays = [help, book, settingsEl];
  let returnFocus = null;
  const overlayOpen = () => overlays.some((el) => !el.hidden);

  function showOverlay(el, focusEl) {
    closeOverlays(false);
    returnFocus = document.activeElement;
    el.hidden = false;
    focusEl.focus();
  }

  function closeOverlays(restore = true) {
    const open = overlays.filter((el) => !el.hidden);
    for (const el of open) el.hidden = true;
    if (open.length && restore && returnFocus?.isConnected) returnFocus.focus();
  }

  const openHelp = () => showOverlay(help, buttons.helpClose);
  buttons.help.addEventListener('click', openHelp);
  buttons.helpClose.addEventListener('click', () => closeOverlays());
  buttons.bookClose.addEventListener('click', () => closeOverlays());
  buttons.settings.addEventListener('click', openSettings);
  buttons.settingsClose.addEventListener('click', () => closeOverlays());
  for (const el of overlays) {
    el.addEventListener('click', (e) => {
      if (e.target === el) closeOverlays();
    });
  }
  book.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) renderBook(tab.dataset.tab);
  });

  // ── Einstellungen ──

  const percent = (v) => `${Math.round(v * 100)} %`;

  function syncSettings() {
    const st = audio.settings;
    for (const kind of ['sfx', 'music']) {
      vol[kind].value = String(Math.round(st[kind] * 100));
      $(`vol-${kind}-out`).textContent = percent(st[kind]);
    }
    buttons.mute.textContent = st.muted ? 'Ton einschalten' : 'Stumm schalten';
    buttons.mute.setAttribute('aria-pressed', String(st.muted));
    $('audio-note').hidden = audio.supported;
    const full = desktop ? desktop.isFullscreen?.() : !!document.fullscreenElement;
    $('row-fullscreen').hidden = !(desktop?.setFullscreen || document.fullscreenEnabled);
    $('row-quit').hidden = !desktop?.quit;
    Promise.resolve(full).then((on) => {
      buttons.fullscreen.textContent = on ? 'Fenster' : 'Vollbild';
    });
    const pad = app.pad;
    $('pad-status').textContent = pad?.connected
      ? `${pad.family === 'ps' ? 'PlayStation-Controller' : 'Controller'} verbunden. So ist er belegt:`
      : 'Schließe einen Controller an und drücke eine Taste. So ist er belegt:';
    // Am Handy ohne Controller bleibt die Belegung eingeklappt
    $('pad-details').open = usingPad() || !!pad?.connected || !matchMedia('(pointer: coarse)').matches;
    const L = (name) => `<kbd class="pad-key">${esc(pad ? pad.label(name) : name.toUpperCase())}</kbd>`;
    $('pad-map').innerHTML = [
      ['Graben', `Steuerkreuz wählt Stück und Richtung · ${L('a')} wählt · ${L('y')} gräbt`],
      ['Bauen', `${L('lb')} ${L('rb')} wählen einen Bauplan · Steuerkreuz bewegt den Rahmen · ${L('a')} baut · ${L('x')} wählt einen Turm · ${L('y')} beginnt die Nacht`],
      ['Turm', `Steuerkreuz wählt Knoten · ${L('a')} lernt · ${L('b')} zurück`],
      ['Nacht', `${ABILITY_BUTTONS.map(L).join(' ')} Fähigkeiten des Drachen · Stick zielt · ${L('a')} setzt ein · ${L('b')} bricht ab · ${L('y')} Tempo · ${L('start')} Pause`],
      ['Immer', `${L('back')} Regeln · ${L('start')} Einstellungen · ${L('b')} schließt Fenster`],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }

  function openSettings() {
    syncSettings();
    showOverlay(settingsEl, vol.sfx);
  }

  let sampleTimer = 0;
  for (const kind of ['sfx', 'music']) {
    vol[kind].addEventListener('input', () => {
      audio.unlock();
      audio.setVolume(kind, Number(vol[kind].value) / 100);
      syncSettings();
      clearTimeout(sampleTimer);
      if (kind === 'sfx') sampleTimer = setTimeout(() => audio.ui('merge', { c: 7 }), 120);
    });
  }
  buttons.mute.addEventListener('click', () => {
    audio.unlock();
    audio.setMuted(!audio.settings.muted);
    syncSettings();
    tick();
  });
  buttons.fullscreen.addEventListener('click', async () => {
    try {
      if (desktop?.setFullscreen) await desktop.setFullscreen(!(await desktop.isFullscreen()));
      else if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast('Vollbild ist hier nicht erlaubt.');
    }
    setTimeout(syncSettings, 150);
  });
  buttons.quit.addEventListener('click', () => desktop?.quit());
  document.addEventListener('fullscreenchange', () => {
    if (!settingsEl.hidden) syncSettings();
  });

  function toast(text) {
    if (!text) return;
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 2800);
  }

  // ── Höhle zwischen den Runs ──

  function speciesHTML(p) {
    const chosen = p.choice.species;
    const list = SPECIES_ORDER.map((id) => {
      const sp = SPECIES[id];
      const s = p.species[id];
      if (!s) {
        return `<div class="species is-locked">${dragonImg(id, 0, { width: 96, silhouette: true })}
          <span class="species-body"><strong>${sp.secret ? '???' : esc(sp.name)}</strong><span class="hint">${esc(sp.hint)}</span></span></div>`;
      }
      const on = id === chosen;
      return `<button class="species${on ? ' is-on' : ''}" type="button" data-action="pick-species" data-id="${id}" aria-pressed="${on}">
        ${dragonImg(id, s.variant, { width: 96, scars: s.legend })}
        <span class="species-body"><strong>${esc(sp.name)}</strong>
          <span class="level">${s.hatched}× geschlüpft${s.legend ? ` · Legende ${s.legend}` : ''}</span>
        </span>
      </button>`;
    }).join('');
    const sp = SPECIES[chosen];
    const s = p.species[chosen];
    const variants = Meta.variantsOf(p, chosen);
    const swatches = variants > 1
      ? `<div class="variants"><span class="label">Farbe</span>${sp.palettes.slice(0, variants).map((pal, i) => `<button class="swatch${i === s.variant ? ' is-on' : ''}" type="button" data-action="pick-variant" data-i="${i}" aria-pressed="${i === s.variant}" aria-label="Farbe ${i + 1}" style="--a:${pal.body[0]};--b:${pal.wing[0]}"></button>`).join('')}</div>`
      : '';
    return `<section class="hub-section" aria-labelledby="h-species">
      <h3 id="h-species">Drache</h3>
      <div class="species-list">${list}</div>
      <div class="species-detail">
        <p><span class="label">Regel</span> ${esc(sp.ruleText)}</p>
        ${swatches}
      </div>
    </section>`;
  }

  function legendHTML(p) {
    const chosen = p.choice.species;
    const max = Meta.maxLegend(p, chosen);
    if (!max) {
      return p.stats.runs ? `<section class="hub-section"><h3>Legende</h3><p class="muted">Gewinne einen Run, um Legende 1 freizuschalten. Jede Stufe bringt eine neue Regel – und Narben für deinen Drachen.</p></section>` : '';
    }
    const level = Math.min(p.choice.legend, max);
    const steps = Array.from({ length: max + 1 }, (_, i) => `<button class="step${i === level ? ' is-on' : ''}" type="button" data-action="pick-legend" data-i="${i}" aria-pressed="${i === level}">${i}</button>`).join('');
    const rules = LEGEND.slice(0, level).map((l, i) => `<li><span class="step-num">${i + 1}</span>${esc(l.text)}</li>`).join('');
    const teaser = max < LEGEND.length && level === max ? `<p class="muted">Gewinne auf Stufe ${max}, um Stufe ${max + 1} zu öffnen: ${esc(LEGEND[max].text)}</p>` : '';
    return `<section class="hub-section" aria-labelledby="h-legend">
      <h3 id="h-legend">Legende</h3>
      <div class="steps" role="group" aria-label="Legende-Stufe">${steps}</div>
      ${rules ? `<ol class="rules-list">${rules}</ol>` : '<p class="muted">Stufe 0: die normalen Regeln.</p>'}
      ${teaser}
    </section>`;
  }

  function deckHTML(p) {
    const available = Meta.availableBuildings(p);
    const deck = p.deck.filter((id) => available.includes(id));
    if (available.length <= DECK_SIZE) {
      return `<section class="hub-section" aria-labelledby="h-deck"><h3 id="h-deck">Dein Deck <span class="count">${DECK_SIZE} Baupläne</span></h3>
        <div class="cards cards-hub">${deck.map((id) => blueprintCard(id, { compact: true })).join('')}</div>
        <p class="muted">Jeden Tag ziehst du ${CONFIG.handSize} davon. Neue Baupläne gibt es in der Werkstatt – dann stellst du dein Deck selbst zusammen.</p></section>`;
    }
    return `<section class="hub-section" aria-labelledby="h-deck"><h3 id="h-deck">Dein Deck <span class="count">${deck.length} von ${DECK_SIZE}</span></h3>
      <div class="cards cards-hub">${available.map((id) => blueprintCard(id, { on: deck.includes(id), action: 'toggle-deck', compact: true })).join('')}</div>
      <p class="muted">Du nimmst ${DECK_SIZE} Baupläne mit und ziehst jeden Tag ${CONFIG.handSize} davon. Tippe einen an, um ihn heraus- oder hineinzunehmen.</p></section>`;
  }

  function workshopHTML(p) {
    const glut = Meta.glutOf(p);
    const items = Meta.workshop(p).map((u) => {
      let name = esc(u.name);
      let text;
      if (u.kind === 'building') text = BUILDINGS[u.id].text;
      else {
        const [tower, node] = u.id.split('.');
        name = `${esc(u.name)} <span class="muted">(${esc(BUILDINGS[tower].name)})</span>`;
        text = BUILDINGS[tower].tree.nodes[node].text;
      }
      const action = u.owned
        ? '<span class="owned">Freigeschaltet</span>'
        : `<button class="ghost small" type="button" data-action="buy" data-id="${u.id}"${glut < u.glut ? ' disabled' : ''}>${u.glut} Glut</button>`;
      return `<li class="shop-item${u.owned ? ' is-owned' : ''}">${unlockIcon(u.id, 32)}<span><strong>${name}</strong><span class="muted">${UNLOCK_KINDS[u.kind]} · ${esc(text)}</span></span>${action}</li>`;
    }).join('');
    return `<section class="hub-section" aria-labelledby="h-shop"><h3 id="h-shop">Werkstatt der Kobolde <span class="count">${glutIcon}${glut} Glut</span></h3>
      <ul class="shop">${items}</ul>
      <p class="muted">Glut bringst du aus gewonnenen Runs mit. Verlierst du das Ei, trägt der Dieb deine Glut fort.</p></section>`;
  }

  function modesHTML(p) {
    if (!p.stats.runs) return '';
    const week = Meta.weekKey();
    const best = p.best.weekly?.week === week ? p.best.weekly : null;
    const modes = [
      { id: 'normal', name: 'Run', text: `${CONFIG.nights} Nächte mit deinem Drachen, deiner Legende und deinem Deck. In der letzten kommt Siegfried.` },
      { id: 'endless', name: 'Endlose Belagerung', text: p.best.endless ? `Bestwert: ${p.best.endless} Nächte.` : 'So viele Nächte wie möglich. Siegfried kommt alle 8 Nächte wieder.', locked: 'Schaltet die Tat „Erste Brut“ frei.' },
      { id: 'weekly', name: `Wochen-Hort ${week.slice(-3)}`, text: best ? `Dein Bestwert diese Woche: ${best.nights} Nächte, Hortwert ${best.value}.` : 'Ein Run für alle gleich, mit festen Regeln. Jede Woche neu.', locked: 'Schaltet die Tat „Erste Brut“ frei.' },
    ];
    const items = modes.map((m) => {
      const ok = Meta.modeAvailable(p, m.id);
      const on = ok && p.choice.mode === m.id;
      return `<button class="mode${on ? ' is-on' : ''}" type="button" data-action="pick-mode" data-id="${m.id}" aria-pressed="${on}"${ok ? '' : ' disabled'}>
        <strong>${esc(m.name)}</strong><span>${esc(ok ? m.text : m.locked)}</span></button>`;
    }).join('');
    return `<section class="hub-section" aria-labelledby="h-modes"><h3 id="h-modes">Modus</h3><div class="modes">${items}</div></section>`;
  }

  function nemesesHTML(p) {
    if (!p.nemeses.length && !p.trophies.length) return '';
    const rows = p.nemeses.map((n) => {
      const carries = [n.treasure ? `trägt ${esc(yours(n.treasure, 'acc'))}` : '', n.glut ? `hat ${n.glut} Glut von dir` : ''].filter(Boolean).join(' und ');
      return `<li>${heroImg(n.type, 30)}<span><strong>${esc(n.name)}</strong> <span class="stars" aria-label="Rang ${n.rank}">${stars(n.rank)}</span><br><span class="muted">${carries || 'will Rache'}</span></span>${n.treasure ? treasureImg(n.treasure, 30) : n.glut ? `<span class="glut-badge">${n.glut}</span>` : '<span></span>'}</li>`;
    }).join('');
    return `<section class="hub-section wanted" aria-labelledby="h-foes"><h3 id="h-foes">Erzfeinde</h3>
      ${rows ? `<ul class="foe-list">${rows}</ul><p class="muted">Erzfeinde kommen in späteren Runs zurück. Besiegst du sie, holst du dir zurück, was sie tragen.</p>` : '<p class="muted">Gerade jagt dich niemand.</p>'}
      ${p.trophies.length ? `<p class="muted">Trophäenwand: ${p.trophies.length} ${p.trophies.length === 1 ? 'Helm' : 'Helme'} besiegter Erzfeinde.</p>` : ''}
    </section>`;
  }

  function hubHTML(p) {
    const first = !p.stats.runs;
    const intro = p.introSeen ? '' : `<div class="intro">
      <p><strong>Du bist der Drache.</strong> Jeden Tag graben deine Kobolde die Höhle ein Stück tiefer in den Berg, und du ziehst mit deinem Hort hinterher. Jede Nacht kommen Helden und wollen das Glänzendste, was sie tragen können – am Ende auch dein Ei.</p>
      <p>Baue Türme, Fallen und Köder an die Gänge. Wer etwas klaut, muss den ganzen Weg wieder hinaus. Halte ${CONFIG.nights} Nächte durch – in der letzten kommt Siegfried.</p>
      <button class="ghost small" type="button" data-action="intro-ok">Verstanden</button>
    </div>`;
    const mode = Meta.modeAvailable(p, p.choice.mode) ? p.choice.mode : 'normal';
    const startLabel = mode === 'endless' ? 'Belagerung starten' : mode === 'weekly' ? 'Wochen-Hort starten' : first ? 'Ersten Run starten' : 'Run starten';
    const note = mode === 'weekly' ? '<p class="muted">Im Wochen-Hort spielen alle mit dem Golddrachen, Legende 0 und dem Grunddeck.</p>' : '';
    const deckOk = Meta.validDeck(p).length === DECK_SIZE && p.deck.length === DECK_SIZE;
    return `${intro}
      <p class="eyebrow">${first ? 'Dein erster Hort' : `${p.stats.runs} Runs · ${p.stats.wins} Siege`}</p>
      <h2>Deine Höhle</h2>
      ${speciesHTML(p)}
      ${first ? '' : legendHTML(p)}
      ${deckHTML(p)}
      ${first ? '' : workshopHTML(p)}
      ${modesHTML(p)}
      ${nemesesHTML(p)}
      ${note}
      <div class="actions sticky-actions">
        <button class="ghost" type="button" data-action="open-book">Hortbuch</button>
        <button class="primary" type="button" data-action="start-run"${deckOk || mode === 'weekly' ? '' : ' disabled'}>${padPrefix('y')}${deckOk || mode === 'weekly' ? startLabel : `Noch ${DECK_SIZE - p.deck.length} Bauplan wählen`}</button>
      </div>`;
  }

  // ── Run ──

  const dayLabel = (s) => (Sim.isEndless(s) ? `Tag ${s.night}` : `Tag ${s.night} von ${s.nights}`);
  const nightLabel = (s) => (Sim.isEndless(s) ? `Endlose Belagerung · Nacht ${s.night}` : `Nacht ${s.night} von ${s.nights}`);
  const DIR_LABEL = { W: ['←', 'nach links'], S: ['↓', 'nach unten'], E: ['→', 'nach rechts'], N: ['↑', 'nach oben'] };

  function featureChips(offer) {
    const chips = [];
    const veins = offer.features.filter((f) => f === 'vein').length;
    if (veins) chips.push(`<span class="chip chip-gold">${veins > 1 ? `${veins} Goldadern` : 'Goldader'} · +${veins * CONFIG.goldPerVein}${coinIcon}</span>`);
    if (offer.features.includes('ledge')) chips.push('<span class="chip chip-moon">Felsvorsprung</span>');
    if (offer.find) chips.push(`<span class="chip chip-gold">${treasureImg(offer.find, 18)} ${esc(TREASURES[offer.find].name)}</span>`);
    if (offer.entrance) chips.push(`<span class="chip chip-bad">Durchbruch: ${esc(ENTRANCES[offer.entrance].name)}</span>`);
    return chips.join('');
  }

  function digHTML(s) {
    const v = app.view;
    if (!s.offers.length) {
      return `<p class="eyebrow">${dayLabel(s)} · Graben</p>
        <h2>Der Berg ist voll</h2>
        <p class="lead">Die Kobolde finden keinen Platz mehr zum Graben. Die Hortkammer bleibt, wo sie ist.</p>
        <div class="actions"><button class="primary" type="button" data-action="skip-dig">${padPrefix('y')}Weiter zum Bauen</button></div>`;
    }
    const dirs = Sim.digDirections(s);
    const depth = s.chamber.cy;
    const offers = s.offers.map((o, i) => {
      const p = PIECES[o.piece];
      const on = v.dig?.offer === i;
      const arrows = dirs.map((d) => {
        const pressed = on && v.dig.dir === d.dir;
        return `<button class="dir${pressed ? ' is-on' : ''}" type="button" data-action="dig-dir" data-i="${i}" data-dir="${d.dir}" aria-pressed="${pressed}" aria-label="${esc(p.name)} ${DIR_LABEL[d.dir][1]} graben"><span aria-hidden="true">${DIR_LABEL[d.dir][0]}</span></button>`;
      }).join('');
      return `<div class="offer${on ? ' is-on' : ''}${o.entrance ? ' is-risky' : ''}">
        <div class="offer-head"><strong>${esc(p.name)}</strong></div>
        <p class="offer-text">${esc(p.text)}</p>
        ${featureChips(o) ? `<div class="chips">${featureChips(o)}</div>` : ''}
        <div class="dirs" role="group" aria-label="Richtung">${arrows}</div>
      </div>`;
    }).join('');
    const chosen = v.dig?.offer != null && v.dig?.dir;
    return `<p class="eyebrow">${dayLabel(s)} · Graben</p>
      <h2>Die Kobolde graben</h2>
      <p class="lead">Die Hortkammer zieht einen Abschnitt weiter, der Gang dorthin wird länger. Wähle ein Stück und die Richtung – die Vorschau erscheint in der Höhle.</p>
      <p class="muted">Tiefe ${depth + 1} von 5 · Je tiefer, desto reicher die Adern – und desto eher brechen die Kobolde irgendwo durch.</p>
      <div class="offers">${offers}</div>
      <div class="info" id="info"></div>
      <div class="actions"><button class="primary" type="button" data-action="dig"${chosen ? '' : ' disabled'}>${padPrefix('y')}Hier graben</button></div>`;
  }

  function hoardHTML(s) {
    const items = s.hoard.slice().sort((a, b) => TREASURES[b.id].glanz - TREASURES[a.id].glanz);
    const top1 = Sim.wantedTreasure(s, 1);
    const top2 = Sim.wantedTreasure(s, 2);
    const lures = s.buildings.filter((b) => b.kind === 'lure' && BUILDINGS[b.id].lure.item);
    const lureGlanz = Math.max(0, ...lures.map((b) => Sim.lureGlanz(s, b)));
    let warn = '';
    const eggTop = top1?.id === 'ei' || top2?.id === 'ei';
    if (eggTop && lureGlanz <= TREASURES.ei.glanz) warn = `<p class="warn">Gerade wollen die Helden dein Ei – es glänzt am meisten. Katzengold glänzt mehr und lenkt sie ab.</p>`;
    else if (eggTop) warn = `<p class="note">Dein Ei glänzt am meisten im Hort. Dein Köder glänzt mehr – solange er etwas zu holen hat.</p>`;
    const row = items.map((it) => `<span class="hoard-item${it.id === 'ei' ? ' is-egg' : ''}" title="${esc(TREASURES[it.id].name)}">${treasureImg(it.id, 32)}<b>${TREASURES[it.id].glanz}</b></span>`).join('');
    return `<section class="hoard" aria-labelledby="h-hoard"><h3 id="h-hoard">Dein Hort <span class="count">Wert ${Sim.hoardValue(s)} · Drachenkraft ×${num(Sim.power(s))}</span></h3>
      <div class="hoard-items">${row}</div>
      <p class="muted">Zahl: Glanz. Helden holen sich das Glänzendste, was sie tragen können${lures.length ? ` – oder deinen Köder (Glanz ${lureGlanz})` : ''}.</p>
      ${warn}
    </section>`;
  }

  function ravensHTML(s) {
    const { entrances, nemeses, boss } = Sim.partySummary(s);
    const hidden = s.mods.hiddenGroup && entrances.length > 1 ? entrances.length - 1 : -1;
    const rows = entrances.map(({ entrance, groups }, i) => {
      const name = ENTRANCES[entrance.kind].name;
      if (i === hidden) return `<li><span class="unknown" aria-hidden="true">?</span><span><strong>${esc(name)}</strong> Die Raben schweigen über diesen Eingang.</span></li>`;
      const list = groups.map(({ type, count }) => `<span class="foe">${heroImg(type, 22)}${count} ${esc(count === 1 ? HEROES[type].name : HEROES[type].plural)}</span>`).join('');
      return `<li class="entrance-row"><span class="label">${esc(name)}</span><span class="foes-row">${list || '<span class="muted">niemand</span>'}</span></li>`;
    });
    if (boss) rows.push(`<li class="nemesis">${heroImg('siegfried', 30)}<span><strong>Siegfried, der Drachentöter</strong> Er will nur dein Ei. Von vorn ist er fast unverwundbar – triff ihn von hinten, am Lindenblatt.</span></li>`);
    for (const n of nemeses) {
      const what = [n.treasure ? `trägt ${esc(yours(n.treasure, 'acc'))}` : '', n.glut ? `hat ${n.glut} Glut von dir` : ''].filter(Boolean).join(' und ');
      rows.push(`<li class="nemesis">${heroImg(n.type, 30)}<span><strong>Erzfeind: ${esc(n.name)} ${stars(n.rank)}</strong> ${what ? `${cap(what)}.` : ''} Besiege ihn, dann holst du es dir zurück.</span></li>`);
    }
    const kinds = new Set(entrances.map((e) => e.entrance.kind));
    const tip = kinds.has('zwerge') ? 'Zwerge tragen schwere Rüstung – Steinwerfer helfen.' : kinds.has('gruft') ? 'Paladine und Magier haben Segen – Fluchsteine brechen ihn.' : kinds.has('brunnen') ? 'Bauern kommen in Scharen – Feuertöpfe treffen alle auf einmal.' : 'Diebe sind schnell, Söldner tragen leichte Rüstung.';
    return `<section class="ravens" aria-label="Die Raben melden"><h3>Die Raben melden</h3><ul>${rows.join('')}</ul><p class="muted">${esc(tip)}</p></section>`;
  }

  function hatchPreviewHTML(s) {
    if (!s.nights || s.night !== s.nights) return '';
    const id = Sim.computeHatch(s);
    const known = !!app.profile.species[id] || !SPECIES[id].secret;
    return `<div class="hatch-preview">${dragonImg(id, 0, { width: 84, silhouette: !known })}
      <p><strong>Letzte Nacht.</strong> Übersteht dein Ei sie, schlüpft ${known ? `ein <strong>${esc(SPECIES[id].name)}</strong>` : 'etwas Geheimnisvolles'}.</p></div>`;
  }

  function buildHTML(s) {
    const v = app.view;
    const hand = s.deck.hand.map((id, i) => blueprintCard(id, { on: v.card === i, action: 'card', i, key: usingPad() ? null : i + 1, disabled: BUILDINGS[id].cost > s.gold })).join('');
    const towers = s.buildings.filter((b) => b.kind === 'tower');
    const points = towers.filter((b) => Sim.pointsLeft(b) > 0).length;
    const notes = [];
    if (points) notes.push(`<p class="note">${points === 1 ? 'Ein Turm hat' : `${points} Türme haben`} freie Punkte – tippe ${points === 1 ? 'ihn' : 'sie'} an (grünes +).</p>`);
    if (s.stash.length) notes.push(`<p class="note">Beute: ${s.stash.map((g) => treasureImg(g, 22)).join('')} – tippe einen Turm an, um sie einzubauen.</p>`);
    const handId = v.card != null ? s.deck.hand[v.card] : null;
    const hint = handId
      ? (usingPad() ? `Steuerkreuz bewegt den Rahmen, ${glyph('a')} baut, ${glyph('b')} bricht ab.` : `${esc(BUILDINGS[handId].kind === 'trap' ? 'Fallen kommen in den Gang' : BUILDINGS[handId].kind === 'lure' ? 'Köder kommen in eine Nische direkt am Gang' : 'Türme kommen in die Nischen neben dem Gang')} – tippe auf ein grünes Feld.`)
      : (usingPad() ? `${glyph('lb')} ${glyph('rb')} wählen einen Bauplan, ${glyph('x')} wählt einen Turm.` : 'Wähle einen Bauplan oder tippe einen Turm an.');
    return `<p class="eyebrow">${dayLabel(s)} · Bauen${s.opts.legend ? ` · Legende ${s.opts.legend}` : ''}</p>
      <h2>Bauen</h2>
      ${hatchPreviewHTML(s)}
      <div class="hand-head"><span class="label">Baupläne heute</span><span class="gold-now">${s.gold}${coinIcon}</span></div>
      <div class="cards hand">${hand || '<p class="muted">Keine Baupläne mehr für heute.</p>'}</div>
      <p class="hint">${hint}</p>
      <div class="row-actions"><button class="ghost small" type="button" data-action="redraw"${s.redrawn || s.gold < CONFIG.redrawCost ? ' disabled' : ''}>Neu ziehen · ${CONFIG.redrawCost}${coinIcon}</button><span class="muted">Morgen: +${Sim.incomeOf(s)}${coinIcon} aus ${Sim.veinCount(s)} ${Sim.veinCount(s) === 1 ? 'Goldader' : 'Goldadern'} und Grundlohn</span></div>
      ${notes.join('')}
      <div class="info" id="info"></div>
      ${hoardHTML(s)}
      ${ravensHTML(s)}
      <div class="actions"><button class="primary" type="button" data-action="start-night">${padPrefix('y')}Nacht ${s.night} beginnen</button></div>`;
  }

  // Ein Turm, eine Falle oder ein Köder: Werte, Baum, Ausrüstung
  function buildingHTML(s, b) {
    const def = BUILDINGS[b.id];
    const day = Sim.DAY_PHASES.has(s.phase);
    const back = `<button class="ghost small back" type="button" data-action="deselect">${padPrefix('b')}← Zurück</button>`;
    const sell = day ? `<button class="ghost small" type="button" data-action="sell" data-id="${b.uid}">Abreißen · +${Math.floor(def.cost * CONFIG.sellBack)}${coinIcon}</button>` : '';
    if (b.kind !== 'tower') {
      const extra = b.kind === 'lure' ? `<p class="muted">Glanz ${def.lure.item ? Sim.lureGlanz(s, b) : def.lure.glanz}${def.lure.charges ? ` · ${b.charges ?? def.lure.charges} Stück für die nächste Nacht` : ''}</p>` : '';
      return `${back}<p class="eyebrow">${esc(BUILDING_KINDS[def.kind])}</p>
        <div class="b-head">${buildingImg(b.id, 48)}<h2>${esc(def.name)}</h2></div>
        <p>${esc(def.text)}</p>${extra}
        <div class="actions">${sell}</div>`;
    }
    const st = b.stats ?? Sim.towerStats(s, b);
    const pts = Sim.pointsLeft(b);
    const next = Sim.xpForLevel(b.level);
    const from = b.level ? CONFIG.levels[b.level - 1] : 0;
    const progress = next ? Math.max(0, Math.min(1, (b.xp - from) / (next - from))) : 1;
    const tree = def.tree;
    const nodes = Object.entries(tree.nodes);
    nodeSel = nodeSel && tree.nodes[nodeSel] ? nodeSel : (nodes.find(([id]) => Sim.nodeState(s, b, id) === 'open')?.[0] ?? 'R');
    const links = tree.links.map(([a, z]) => {
      const A = tree.nodes[a];
      const Z = tree.nodes[z];
      const on = b.nodes.includes(a) && b.nodes.includes(z);
      return `<line x1="${A.x + 0.5}" y1="${A.y + 0.5}" x2="${Z.x + 0.5}" y2="${Z.y + 0.5}" class="${on ? 'on' : ''}"/>`;
    }).join('');
    const buttonsHTML = nodes.map(([id, n]) => {
      const state = Sim.nodeState(s, b, id);
      const sel = id === nodeSel;
      const sym = n.kind === 'root' ? '' : n.kind === 'keystone' ? '◆' : n.kind === 'notable' ? '★' : n.kind === 'socket' ? '◇' : '+';
      return `<button class="node node-${n.kind} is-${state}${sel ? ' is-sel' : ''}" type="button" data-action="node" data-id="${id}" style="--x:${n.x};--y:${n.y}" aria-pressed="${sel}" aria-label="${esc(n.name)}">${n.kind === 'root' ? buildingImg(b.id, 22) : `<span aria-hidden="true">${sym}</span>`}</button>`;
    }).join('');
    const node = tree.nodes[nodeSel];
    const nst = Sim.nodeState(s, b, nodeSel);
    const KIND = { root: 'Wurzel', small: 'Knoten', notable: 'Großer Knoten', keystone: 'Schlussstein', socket: 'Fassung' };
    let learn = '';
    if (nst === 'taken') learn = '<span class="owned">Gelernt</span>';
    else if (nst === 'locked') learn = '<span class="muted">In der Werkstatt freischalten</span>';
    else if (nst === 'blocked') learn = '<span class="muted">Erst einen Knoten daneben lernen</span>';
    else learn = `<button class="primary small" type="button" data-action="learn" data-id="${nodeSel}"${pts > 0 && day ? '' : ' disabled'}>${pts > 0 ? 'Lernen · 1 Punkt' : 'Kein Punkt frei'}</button>`;
    const sockets = Array.from({ length: st.sockets }, (_, k) => {
      const g = b.gear[k];
      return g
        ? `<button class="socket is-full" type="button" data-action="unsocket" data-i="${k}" title="${esc(GEAR[g].name)}: herausnehmen"${day ? '' : ' disabled'}>${treasureImg(g, 28)}</button>`
        : '<span class="socket">frei</span>';
    }).join('');
    const gearList = b.gear.map((g) => `<li>${treasureImg(g, 24)}<span><strong>${esc(GEAR[g].name)}</strong> ${esc(GEAR[g].text)}</span></li>`).join('');
    const stash = day && s.stash.length
      ? `<div class="stash"><span class="label">Beute einbauen</span><div class="stash-items">${s.stash.map((g, k) => `<button class="stash-item" type="button" data-action="socket" data-i="${k}" title="${esc(GEAR[g].name)} – ${esc(GEAR[g].text)}"${b.gear.length >= st.sockets ? ' disabled' : ''}>${treasureImg(g, 28)}</button>`).join('')}</div></div>`
      : '';
    const extras = [];
    if (st.multi > 1) extras.push(`${st.multi} Ziele`);
    if (st.splash) extras.push(`Einschlag ${num(st.splash)} Felder`);
    if (st.chain) extras.push('springt weiter');
    if (st.pierce) extras.push('durchbohrt');
    if (st.crit) extras.push(`${Math.round(st.crit * 100)} % doppelt`);
    if (st.burn) extras.push(`Brand ${num(st.burn[0])}/s`);
    if (st.curse) extras.push(`Fluch +${Math.round(st.curse[0] * 100)} %`);
    if (st.stun) extras.push('betäubt');
    if (st.slowAura < 1) extras.push('verlangsamt');
    const ledge = tileAt(s, b) === 'l' ? ' · auf einem Felsvorsprung' : '';
    return `${back}
      <p class="eyebrow">Turm · ${esc(DAMAGE[st.type].name)}${ledge}</p>
      <div class="b-head">${buildingImg(b.id, 40)}<div><h2>${esc(def.name)}</h2><p class="muted">Stufe ${b.level}${pts ? ` · <span class="good">${pts} ${pts === 1 ? 'Punkt' : 'Punkte'} frei</span>` : ''} · ${b.kills} besiegt</p></div></div>
      <div class="xp"><span class="meter" aria-hidden="true"><i style="width:${Math.round(progress * 100)}%"></i></span><span class="muted">${next ? `${Math.floor(b.xp)} / ${next} Erfahrung` : 'Höchste Stufe'}</span></div>
      <p class="stats-line"><span>Schaden <b>${st.bind ? 0 : num(st.dmg)}</b></span><span>alle <b>${num(st.interval)}</b>&nbsp;s</span><span>Reichweite <b>${num(st.range)}</b></span></p>
      <p class="muted">Stark gegen ${STRONG[st.type]}, schwach gegen ${WEAK[st.type]}.${extras.length ? ` ${esc(extras.join(' · '))}.` : ''}</p>
      <div class="tree" role="group" aria-label="Baum">
        <svg class="tree-links" viewBox="0 0 5 5" preserveAspectRatio="none" aria-hidden="true">${links}</svg>
        ${buttonsHTML}
      </div>
      <div class="node-info"><p class="eyebrow">${esc(KIND[node.kind])}</p><strong>${esc(node.name)}</strong><p>${esc(node.text)}</p><div class="node-act">${learn}</div></div>
      <div class="sockets-row"><span class="label">Fassungen</span><div class="sockets">${sockets}</div></div>
      ${gearList ? `<ul class="gear-list">${gearList}</ul>` : ''}
      ${stash}
      <div class="actions">${day && b.nodes.length > 1 ? `<button class="ghost small" type="button" data-action="respec" data-id="${b.uid}"${s.gold < CONFIG.respecCost ? ' disabled' : ''}>Umschulen · ${CONFIG.respecCost}${coinIcon}</button>` : ''}${sell}</div>`;
  }

  const tileAt = (s, b) => s.tiles[b.r * COLS + b.c];

  function nightHTML(s) {
    const abilities = DRAGON.abilities.map((a, i) => {
      const key = usingPad() ? app.pad.label(ABILITY_BUTTONS[i]) : i + 1;
      return `<button class="card ability" type="button" data-action="ability" data-id="${a.id}" id="ab-${a.id}">
        <span class="card-top"><kbd>${esc(key)}</kbd><span class="cd" id="cd-${a.id}"></span></span>
        <img class="card-art" src="${iconURL('ability', a.id)}" alt="" width="40" height="40">
        <strong>${esc(a.name)}</strong>
        <span class="card-text">${esc(a.text)}</span>
        <span class="cd-fill" aria-hidden="true"></span>
      </button>`;
    }).join('');
    return `<p class="eyebrow">${nightLabel(s)}</p>
      <h2>Verteidige den Hort</h2>
      <div class="cards abilities">${abilities}</div>
      <p class="hint" id="night-hint"></p>
      <p class="foes" id="foes"></p>`;
  }

  function morningHTML(s) {
    const n = s.lastNight;
    const stolen = n.stolen.length
      ? `<div class="stolen"><span class="label">Gestohlen</span><span class="icons">${n.stolen.map((id) => treasureImg(id, 30)).join('')}</span></div>`
      : '<p class="good">Kein einziger Schatz ist fort.</p>';
    const decoys = n.decoys ? `<p class="note">${n.decoys} ${n.decoys === 1 ? 'Held ist' : 'Helden sind'} mit falschem Gold abgezogen.</p>` : '';
    const gear = n.gear.length ? `<div class="stolen"><span class="label">Beute der Besiegten</span><span class="icons">${n.gear.map((g) => treasureImg(g, 30)).join('')}</span><span class="muted">Bau sie beim Bauen in deine Türme ein.</span></div>` : '';
    const levels = n.levelUps.map((uid) => Sim.buildingByUid(s, uid)).filter(Boolean)
      .map((b) => `<li>${buildingImg(b.id, 26)}<span><strong>${esc(BUILDINGS[b.id].name)}</strong> erreicht Stufe ${b.level}${Sim.pointsLeft(b) ? ` – ${Sim.pointsLeft(b)} ${Sim.pointsLeft(b) === 1 ? 'Punkt' : 'Punkte'} frei` : ''}</span></li>`).join('');
    const guards = s.guardians.length ? `<p class="note">${s.guardians.length} ${s.guardians.length === 1 ? 'Gefallener steht' : 'Gefallene stehen'} in der nächsten Nacht als Knochenwächter wieder auf.</p>` : '';
    return `<p class="eyebrow">Morgen nach Nacht ${n.night}</p>
      <h2>${n.stolen.length ? 'Der Hort ist kleiner geworden' : 'Der Hort hat gehalten'}</h2>
      <dl class="summary"><div><dt>Besiegt</dt><dd>${n.defeated}</dd></div><div><dt>Entkommen</dt><dd>${n.escaped}</dd></div><div><dt>Gold</dt><dd>+${n.killGold + n.income}</dd></div><div><dt>Glut</dt><dd>+${n.glut}</dd></div></dl>
      <p class="muted">Gold: ${n.killGold} von Besiegten, ${n.income} von den Kobolden (Grundlohn und ${n.veins} ${n.veins === 1 ? 'Goldader' : 'Goldadern'}).</p>
      ${stolen}
      ${decoys}
      ${gear}
      ${levels ? `<ul class="level-list">${levels}</ul>` : ''}
      ${guards}
      <div class="actions"><button class="primary" type="button" data-action="next-day">${padPrefix('y')}Weiter zu Tag ${n.night + 1}</button></div>`;
  }

  function rewardsHTML(s, r) {
    if (!r) return '';
    const items = [];
    if (r.glutBanked) items.push(`<li class="is-new"><span class="glyph" aria-hidden="true">${glutIcon}</span><span><strong>+${r.glutBanked} Glut</strong> für die Werkstatt</span></li>`);
    if (r.glutLostTo) items.push(`<li>${heroImg(r.glutLostTo.type, 30)}<span><strong>${esc(r.glutLostTo.name)} hat deine Glut (${r.glut})</strong> – besiege ${r.glutLostTo.type === 'siegfried' ? 'ihn' : 'den Erzfeind'} in einem späteren Run, dann holst du sie dir zurück.</span></li>`);
    for (const id of r.unlocked) items.push(`<li class="is-new">${unlockIcon(id, 30)}<span><strong>Neu:</strong> ${esc(unlockLabel(id))}</span></li>`);
    for (const id of r.deeds) {
      const d = DEEDS.find((x) => x.id === id);
      items.push(`<li class="is-new"><span class="glyph" aria-hidden="true">✓</span><span><strong>Tat geschafft: ${esc(d.name)}</strong> – ${esc(d.text)}</span></li>`);
    }
    if (r.legendUnlocked) items.push(`<li class="is-new"><span class="glyph" aria-hidden="true">${r.legendUnlocked}</span><span><strong>Legende ${r.legendUnlocked} ist offen</strong> – ${esc(LEGEND[r.legendUnlocked - 1].text)}</span></li>`);
    for (const n of r.nemesesBeaten) items.push(`<li class="is-new">${n.treasure ? treasureImg(n.treasure, 30) : heroImg(n.type, 30)}<span><strong>Erzfeind besiegt: ${esc(n.name)}</strong> – ${n.treasure ? `${esc(isBack(n.treasure))}, ` : ''}${n.glut ? `${n.glut} Glut zurückgeholt, ` : ''}der Helm hängt an der Trophäenwand.</span></li>`);
    for (const n of r.nemesesNew.filter((x) => x.treasure)) items.push(`<li>${heroImg(n.type, 30)}<span><strong>Neuer Erzfeind: ${esc(n.name)}</strong> ist mit ${esc(yours(n.treasure, 'dat'))} entkommen und kommt in einem späteren Run wieder.</span></li>`);
    for (const n of r.nemesesRanked) items.push(`<li>${heroImg(n.type, 30)}<span><strong>${esc(n.name)}</strong> ist dir wieder entkommen – jetzt Rang ${n.rank}.</span></li>`);
    if (r.endlessBest) items.push(`<li class="is-new"><span class="glyph" aria-hidden="true">∞</span><span><strong>Neuer Bestwert:</strong> ${r.nights} Nächte</span></li>`);
    if (r.weeklyBest) items.push(`<li class="is-new"><span class="glyph" aria-hidden="true">W</span><span><strong>Neuer Wochen-Bestwert:</strong> ${r.nights} Nächte</span></li>`);
    return `<section class="rewards" aria-labelledby="h-rewards"><h3 id="h-rewards">Was bleibt</h3><ul>${items.join('')}</ul></section>`;
  }

  function endHTML(s, r) {
    const won = s.phase === 'won';
    const code = seedToCode(s.seed);
    let head;
    if (won) {
      const sp = SPECIES[s.species];
      const extra = r?.newSpecies ? ' <span class="badge">Neue Drachenart</span>' : r?.newVariant ? ' <span class="badge">Neue Farbe</span>' : '';
      head = `<p class="eyebrow">${s.nights} Nächte überstanden</p><h2 class="big">Das Ei schlüpft!</h2>
        <div class="hatched">${dragonImg(s.species, 0, { width: 150 })}<p class="outcome">Ein <strong>${esc(sp.name)}</strong> ist geschlüpft.${extra} ${esc(sp.hatchText)}</p></div>`;
    } else if (Sim.isEndless(s)) {
      head = `<p class="eyebrow">Endlose Belagerung</p><h2 class="big">${s.stats.nightsSurvived} Nächte gehalten</h2>
        <p class="outcome">In Nacht ${s.night} ist ${s.lostBy === 'siegfried' ? 'Siegfried' : `ein ${esc(HEROES[s.lostBy]?.name ?? 'Held')}`} mit deinem Ei entkommen.</p>`;
    } else {
      head = `<p class="eyebrow">Nacht ${s.night}</p><h2 class="big">Das Ei ist fort</h2>
        <p class="outcome">${s.lostBy === 'siegfried' ? 'Siegfried ist' : `Ein ${esc(HEROES[s.lostBy]?.name ?? 'Held')} ist`} mit deinem Ei entkommen.</p>`;
    }
    const standard = s.opts.mode === 'weekly' || s.opts.mode === 'code';
    const codeBlock = standard
      ? `<p class="code">Hort-Code <code id="run-code">${code}</code> <button class="ghost small" type="button" data-action="copy-code">Kopieren</button></p>
         <p class="muted">Mit <code>#${code}</code> am Ende des Links startet genau dieser Run mit festen Regeln noch einmal.</p>`
      : '';
    return `${head}
      <dl class="summary">
        <div><dt>Nächte</dt><dd>${s.stats.nightsSurvived}</dd></div>
        <div><dt>Hortwert</dt><dd>${Sim.hoardValue(s)}</dd></div>
        <div><dt>Besiegt</dt><dd>${s.stats.defeated}</dd></div>
        <div><dt>Glut</dt><dd>${s.glut}</dd></div>
      </dl>
      ${rewardsHTML(s, r)}
      ${codeBlock}
      <div class="actions">
        <button class="ghost" type="button" data-action="again">Nochmal</button>
        <button class="primary" type="button" data-action="to-hub">${padPrefix('y')}Zur Höhle</button>
      </div>`;
  }

  // ── Hortbuch ──

  const TABS = [
    ['bauplaene', 'Baupläne'],
    ['helden', 'Helden'],
    ['schaetze', 'Schätze'],
    ['beute', 'Ausrüstung'],
    ['drachen', 'Drachen'],
    ['taten', 'Taten'],
    ['feinde', 'Erzfeinde'],
  ];

  function entry(icon, title, text, known) {
    return `<li class="entry${known ? '' : ' is-unknown'}">${icon}<span><strong>${title}</strong><span>${text}</span></span></li>`;
  }

  function bookContent(tab, p) {
    if (tab === 'bauplaene') {
      const owned = Meta.availableBuildings(p);
      return [`${owned.length} von ${BUILDING_ORDER.length} in deiner Sammlung`, BUILDING_ORDER.map((id) => {
        const d = BUILDINGS[id];
        return owned.includes(id)
          ? entry(buildingImg(id, 36), `${esc(d.name)} <span class="cost-text">${d.cost} Gold</span>`, esc(d.text), true)
          : entry(buildingImg(id, 36, true), '???', esc(Meta.buildingHint(id)), false);
      })];
    }
    if (tab === 'helden') {
      const ids = Object.keys(HEROES);
      const known = ids.filter((id) => p.seen.heroes.includes(id));
      return [`${known.length} von ${ids.length} begegnet`, ids.map((id) => {
        const h = HEROES[id];
        const layers = ['leben', 'ruestung', 'segen'].filter((l) => h[l]).map((l) => `${LAYER_NAMES[l]} ${h[l]}`).join(' · ');
        return p.seen.heroes.includes(id)
          ? entry(heroImg(id, 36), esc(h.name), esc(`${layers}. ${h.text}`), true)
          : entry(heroImg(id, 36, true), '???', esc(Meta.heroHint(id)), false);
      })];
    }
    if (tab === 'schaetze') {
      const ids = Object.keys(TREASURES).filter((id) => TREASURES[id].family !== 'tand');
      const known = ids.filter((id) => p.seen.treasures.includes(id));
      return [`${known.length} von ${ids.length} entdeckt`, ids.map((id) => {
        const d = TREASURES[id];
        return p.seen.treasures.includes(id)
          ? entry(treasureImg(id, 36), esc(d.name), esc(`Wert ${d.value} · Glanz ${d.glanz} · Gewicht ${d.weight}${d.text ? ` – ${d.text}` : ''}`), true)
          : entry(treasureImg(id, 36, true), '???', esc(Meta.treasureHint(id)), false);
      })];
    }
    if (tab === 'beute') {
      const ids = Object.keys(GEAR);
      const known = ids.filter((id) => p.seen.gear.includes(id));
      return [`${known.length} von ${ids.length} erbeutet`, ids.map((id) => (p.seen.gear.includes(id)
        ? entry(treasureImg(id, 36), esc(GEAR[id].name), esc(GEAR[id].text), true)
        : entry(treasureImg(id, 36, true), '???', esc(Meta.gearHint(id)), false)))];
    }
    if (tab === 'drachen') {
      const owned = SPECIES_ORDER.filter((id) => p.species[id]);
      return [`${owned.length} von ${SPECIES_ORDER.length} ausgebrütet`, SPECIES_ORDER.map((id) => {
        const sp = SPECIES[id];
        return p.species[id]
          ? entry(dragonImg(id, p.species[id].variant, { width: 84 }), esc(sp.name), esc(sp.ruleText), true)
          : entry(dragonImg(id, 0, { width: 84, silhouette: true }), sp.secret ? '???' : esc(sp.name), esc(sp.hint), false);
      })];
    }
    if (tab === 'taten') {
      return [`${p.deeds.length} von ${DEEDS.length} geschafft`, DEEDS.map((d) => {
        const done = p.deeds.includes(d.id);
        const reward = d.unlock?.length ? ` Belohnung: ${d.unlock.map((u) => UNLOCKS[u].name).join(', ')}.` : '';
        return entry(`<span class="glyph" aria-hidden="true">${done ? '✓' : '·'}</span>`, esc(d.name), esc(`${d.text}${reward}`), done);
      })];
    }
    const wanted = p.nemeses.map((n) => entry(heroImg(n.type, 36), `${esc(n.name)} <span class="stars">${stars(n.rank)}</span>`, esc(`Gesucht.${n.treasure ? ` Trägt ${yours(n.treasure, 'acc')}.` : ''}${n.glut ? ` Hat ${n.glut} Glut von dir.` : ''}`), true));
    const trophies = p.trophies.slice().reverse().map((t) => entry(heroImg(t.type, 36), esc(t.name), esc(`Besiegt.${t.treasure ? ` ${isBack(t.treasure)}.` : ''}`), true));
    const rows = [...wanted, ...trophies];
    return [`${p.nemeses.length} gesucht · ${p.trophies.length} besiegt`, rows.length ? rows : ['<li class="empty">Wer mit einem wertvollen Schatz entkommt oder dein Ei stiehlt, bekommt einen Namen – und kommt in einem späteren Run zurück.</li>']];
  }

  function renderBook(tab = bookTab) {
    const tabFocused = !!document.activeElement?.dataset?.tab;
    bookTab = tab;
    const p = app.profile;
    $('book-tabs').innerHTML = TABS.map(([id, name]) => `<button class="tab${id === tab ? ' is-on' : ''}" type="button" role="tab" aria-selected="${id === tab}" data-tab="${id}">${name}</button>`).join('');
    const [summary, rows] = bookContent(tab, p);
    $('book-body').innerHTML = `<p class="muted">${summary}</p><ul class="entries">${rows.join('')}</ul>`;
    if (tabFocused) $('book-tabs').querySelector(`[data-tab="${tab}"]`)?.focus();
  }

  function openBook(tab) {
    renderBook(tab);
    showOverlay(book, buttons.bookClose);
  }

  function stepBookTab(step) {
    const i = TABS.findIndex(([id]) => id === bookTab);
    renderBook(TABS[(i + step + TABS.length) % TABS.length][0]);
  }

  // ── Rendern ──

  function render() {
    const s = app.state;
    const sel = app.mode === 'run' && app.view.selected != null ? Sim.buildingByUid(s, app.view.selected) : null;
    const viewKey = app.mode === 'hub' ? 'hub' : sel && s.phase !== 'night' ? 'building' : s?.phase;
    if (!viewKey) return;
    if (viewKey !== lastView) {
      lastView = viewKey;
      panel.scrollTop = 0;
      if (viewKey !== 'building') nodeSel = null;
    }
    let html;
    if (app.mode === 'hub') html = hubHTML(app.profile);
    else if (viewKey === 'building') html = buildingHTML(s, sel);
    else {
      html = {
        dig: digHTML,
        build: buildHTML,
        night: nightHTML,
        morning: morningHTML,
        won: (st) => endHTML(st, app.report),
        lost: (st) => endHTML(st, app.report),
      }[s.phase](s);
    }
    panel.innerHTML = `<div class="phase phase-${viewKey}">${html}</div>`;
    panel.dataset.phase = viewKey;
    infoCache = '';
    for (const key of Object.keys(cache)) delete cache[key];
    if (!book.hidden) renderBook();
    showInfo();
    tick();
    app.onRender?.();
  }

  const TILE_INFO = {
    n: 'Nische: Hier können Türme oder Köder stehen.',
    l: 'Felsvorsprung: Ein Turm hier reicht 0,6 Felder weiter und macht 15 % mehr Schaden.',
    v: 'Goldader: +10 Gold an jedem Morgen. Hier kann nichts gebaut werden.',
    '.': 'Gang: Hier laufen die Helden. Fallen kommen hierher.',
    h: 'Hortkammer: Hier liegt dein Hort, hier wacht der Drache.',
    '#': 'Fels.',
    e: 'Durchbruch: Hier kommen Helden herein.',
    E: 'Höhlenmund: Hier kommen die Abenteurer.',
    '~': 'Draußen.',
  };

  // Was unter dem Zeiger liegt, steht im Infokasten
  function showInfo() {
    const box = $('info');
    const s = app.state;
    const v = app.view;
    if (!box || !s) return;
    let html = '';
    const cell = v.hover;
    if (s.phase === 'dig' && v.dig?.offer != null && v.dig.dir) {
      const o = s.offers[v.dig.offer];
      html = `<p><strong>${esc(PIECES[o.piece].name)}</strong> ${DIR_LABEL[v.dig.dir][1]}: Die Hortkammer zieht dorthin, der helle Gang wird gegraben.${o.entrance ? ' <span class="bad">Ab heute Nacht kommen dort Helden durch.</span>' : ''}</p>`;
    } else if (cell) {
      const b = Sim.buildingAt(s, cell.c, cell.r);
      if (b) {
        const def = BUILDINGS[b.id];
        html = `<p><strong>${esc(def.name)}</strong>${b.kind === 'tower' ? ` · Stufe ${b.level}${Sim.pointsLeft(b) ? ' · <span class="good">Punkte frei</span>' : ''}` : ''} – antippen für Details.</p>`;
      } else {
        const t = s.tiles[cell.r * COLS + cell.c];
        const ent = s.entrances.find((e) => e.c === cell.c && e.r === cell.r);
        html = `<p class="muted">${esc(ent ? `${ENTRANCES[ent.kind].name}: ${ENTRANCES[ent.kind].text}` : TILE_INFO[t] ?? '')}</p>`;
      }
    } else {
      html = s.phase === 'dig'
        ? '<p class="muted">Tippe auf einen der gelben Abschnitte oder auf einen Pfeil.</p>'
        : '<p class="muted">Fahre über die Höhle: Hier steht, was wo liegt.</p>';
    }
    if (html !== infoCache) {
      box.innerHTML = html;
      infoCache = html;
    }
  }

  function set(el, key, value, prop = 'textContent') {
    if (!el || cache[key] === value) return;
    cache[key] = value;
    el[prop] = value;
  }

  function tick() {
    const s = app.state;
    if (!s) return;
    const hub = app.mode === 'hub';
    const night = !hub && s.phase === 'night';
    let label = 'Höhle';
    if (!hub) label = night ? `Nacht ${s.night}` : s.phase === 'dig' ? `Tag ${s.night} · Graben` : s.phase === 'build' ? `Tag ${s.night} · Bauen` : s.phase === 'morning' ? 'Morgen' : 'Ende';
    set(bar.phase, 'phase', label);
    set(bar.goldWrap, 'goldHidden', hub, 'hidden');
    set(bar.valueWrap, 'valueHidden', hub, 'hidden');
    set(bar.gold, 'gold', String(s.gold));
    set(bar.value, 'value', String(Sim.hoardValue(s)));
    set(bar.glut, 'glut', String(hub ? Meta.glutOf(app.profile) : s.glut));
    set(buttons.pause, 'pauseLabel', app.view.paused ? 'Weiter' : 'Pause');
    set(buttons.pause, 'pauseDisabled', !night, 'disabled');
    set(buttons.speed, 'speed', `${app.view.speed}×`);
    set(buttons.settings, 'sound', audio.settings.muted ? ICON_MUTED : ICON_SOUND, 'innerHTML');
    if (!night) return;

    for (const a of DRAGON.abilities) {
      const el = $(`ab-${a.id}`);
      if (!el) continue;
      const cd = s.dragon.cd[a.id] ?? 0;
      const full = a.cooldown * s.mods.cooldown;
      set(el, `dis-${a.id}`, cd > 0, 'disabled');
      const k = Math.round((cd / full) * 20) / 20;
      if (cache[`cdk-${a.id}`] !== k) {
        cache[`cdk-${a.id}`] = k;
        el.style.setProperty('--cd', String(k));
      }
      set($(`cd-${a.id}`), `cdt-${a.id}`, cd > 0 ? `${Math.ceil(cd)} s` : 'bereit');
      const active = app.view.ability === a.id;
      if (cache[`act-${a.id}`] !== active) {
        cache[`act-${a.id}`] = active;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-pressed', String(active));
      }
    }
    const hint = $('night-hint');
    if (hint) {
      const pad = usingPad();
      const L = (name) => app.pad.label(name);
      let text = 'Türme und Fallen kämpfen von selbst. Rot umrandete Helden tragen Beute – sie wollen hinaus.';
      if (app.view.paused) text = pad ? `Pausiert. Weiter mit ${L('start')}.` : 'Pausiert. Weiter mit der Leertaste oder dem Knopf oben.';
      else if (app.view.ability === 'feuer') text = pad ? `Feueratem: Mit dem Stick zielen, ${L('a')} speit, ${L('b')} bricht ab. Die Zeit läuft langsamer.` : 'Feueratem: Tippe auf ein Feld. Die Zeit läuft langsamer, solange du zielst. Esc bricht ab.';
      else if (pad) text = `${ABILITY_BUTTONS.map(L).join(' ')}: Fähigkeiten des Drachen. Türme und Fallen kämpfen von selbst.`;
      set(hint, 'hint', text);
    }
    const foes = $('foes');
    if (foes) {
      const f = Sim.foesLeft(s);
      set(foes, 'foes', `${f.active} Helden in der Höhle · ${f.coming} kommen noch`);
    }
  }

  return { render, tick, showInfo, toast, openBook, openHelp, openSettings, closeOverlays, overlayOpen, bookTab: stepBookTab };
}
