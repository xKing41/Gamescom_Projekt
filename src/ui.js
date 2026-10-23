// Die Tafel neben der Höhle: zwischen den Runs die Höhle (Drache, Legende, Karten, Modus),
// im Run die aktuelle Phase, am Ende die Belohnungen. Dazu Kopfzeile und Hortbuch.

import { TREASURES, HEROES, RAIDS, CARDS, CARD_BY_ID, SPECIES, SPECIES_ORDER, LEGEND, DEEDS, UNLOCKS, UNLOCK_KINDS, CONFIG, HAND_SIZE, META } from './data.js';
import * as Sim from './sim.js';
import * as Meta from './meta.js';
import { iconURL } from './icons.js';
import { seedToCode } from './rng.js';
import { CARD_BUTTONS } from './pad.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const num = (value, digits = 1) => value.toFixed(digits).replace('.', ',');
const stars = (n) => '★'.repeat(n);
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// „dein Kelch“, „deine Krone“, „deinen Goldmünzen“ – passend zu Geschlecht und Fall
const POSS = {
  nom: { m: 'dein', f: 'deine', n: 'dein', pl: 'deine' },
  acc: { m: 'deinen', f: 'deine', n: 'dein', pl: 'deine' },
  dat: { m: 'deinem', f: 'deiner', n: 'deinem', pl: 'deinen' },
};
const PRONOUN = { m: 'ihn', f: 'sie', n: 'es', pl: 'sie' };
const yours = (id, casus) => `${POSS[casus][TREASURES[id].g]} ${TREASURES[id].forms?.[casus] ?? TREASURES[id].name}`;
const isBack = (id) => `${cap(yours(id, 'nom'))} ${TREASURES[id].g === 'pl' ? 'sind' : 'ist'} zurück`;
const plain = (text) => text.replace(/­/g, '');

const img = (url, w, h = w) => `<img src="${url}" alt="" width="${w}" height="${h}">`;
const treasureImg = (id, size = 40, silhouette = false) => img(iconURL('t', id, 96, { silhouette }), size);
const heroImg = (type, size = 36, silhouette = false) => img(iconURL('hero', type, 96, { silhouette }), size);

function dragonImg(species, variant = 0, { width = 120, silhouette = false, scars = 0 } = {}) {
  const palettes = SPECIES[species].palettes;
  const palette = palettes[variant] ?? palettes[0];
  return img(iconURL('dragon', `${species}:${variant}`, 96, { silhouette, palette, scars }), width, Math.round(width * 0.4));
}

function unlockIcon(id, size = 30) {
  const u = UNLOCKS[id];
  if (u.kind === 'treasure') return treasureImg(id, size);
  if (u.kind === 'realm') return heroImg(RAIDS[id].party[0][0], size);
  return `<span class="glyph" aria-hidden="true">${u.kind === 'card' ? '✦' : '∞'}</span>`;
}

const SPEAKER = '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>';
const ICON_SOUND = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${SPEAKER}<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_MUTED = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

const unlockLabel = (id) => `${UNLOCK_KINDS[UNLOCKS[id].kind]}: ${UNLOCKS[id].name}`;

function statsLine(d) {
  const mark = (now, base) => (now !== base ? ` <span class="changed">(${base})</span>` : '');
  return `<span>Wert <b>${d.value}</b></span><span>Glanz <b>${d.glanz}</b>${mark(d.glanz, d.baseGlanz)}</span><span>Gewicht <b>${d.weight}</b>${mark(d.weight, d.baseWeight)}</span>`;
}

function cardMini(card, { on = false, action = null, key = null } = {}) {
  const attrs = action ? ` type="button" data-action="${action}" data-id="${card.id}" aria-pressed="${on}"` : '';
  const tag = action ? 'button' : 'div';
  return `<${tag} class="card${on ? ' is-on' : ''}"${attrs}${action ? '' : ' role="group"'}>
    <span class="card-top">${key ? `<kbd>${key}</kbd>` : '<span></span>'}<span class="cost" aria-label="${card.cost} Glut">${'<i></i>'.repeat(card.cost)}</span></span>
    <strong>${esc(card.name)}</strong>
    <span class="card-text">${esc(card.text)}</span>
  </${tag}>`;
}

export function createUI(app) {
  const $ = (id) => document.getElementById(id);
  const panel = $('panel');
  const bar = {
    phase: $('s-phase'),
    value: $('s-value'),
    valueWrap: $('s-value-wrap'),
    power: $('s-power'),
    powerWrap: $('s-power-wrap'),
    glut: $('s-glut'),
    glutWrap: $('s-glut-wrap'),
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

  let lootSel = [];
  let morningSel = new Set();
  let lastView = null;
  let bookTab = 'schaetze';
  let toastTimer = 0;
  let infoCache = '';
  const cache = {};

  // ── Ereignisse ──

  panel.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const action = el.dataset.action;
    const i = el.dataset.i != null ? Number(el.dataset.i) : undefined;
    if (action === 'toggle-loot') {
      lootSel = lootSel.includes(i) ? lootSel.filter((x) => x !== i) : [...lootSel, i].slice(-CONFIG.lootPick);
      render();
    } else if (action === 'take-loot') {
      app.act('take-loot', { indices: lootSel });
    } else if (action === 'toggle-morning') {
      if (morningSel.has(i)) morningSel.delete(i);
      else morningSel.add(i);
      render();
    } else if (action === 'take-morning') {
      app.act('take-morning', { indices: [...morningSel] });
    } else if (action === 'open-book') {
      openBook(el.dataset.id ?? 'schaetze');
    } else if (action === 'copy-code') {
      const code = seedToCode(app.state.seed);
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast('Hort-Code kopiert.'), selectCode);
      else selectCode();
    } else {
      app.act(action, { id: el.dataset.id, i });
    }
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

  const percent = (v) => `${Math.round(v * 100)}\u00A0%`;

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
      ['Hort ordnen', `Steuerkreuz bewegt den Rahmen · ${L('a')} nimmt und legt ab · ${L('lb')} ${L('rb')} neue Beute · ${L('x')} wirft weg · ${L('y')} beginnt die Nacht`],
      ['Nacht', `${CARD_BUTTONS.map(L).join(' ')} Atem-Karten · Stick zielt · ${L('a')} setzt ein · ${L('b')} bricht ab · ${L('y')} Tempo · ${L('start')} Pause`],
      ['Tafel', `Steuerkreuz wählt · ${L('a')} drückt · ${L('y')} drückt den goldenen Knopf`],
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
      // Eine Kostprobe, damit man die neue Lautstärke hört
      clearTimeout(sampleTimer);
      if (kind === 'sfx') sampleTimer = setTimeout(() => audio.ui('merge', { c: 5.5 }), 120);
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
    }, 2600);
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
      const prog = Meta.levelProgress(s.xp);
      const on = id === chosen;
      return `<button class="species${on ? ' is-on' : ''}" type="button" data-action="pick-species" data-id="${id}" aria-pressed="${on}">
        ${dragonImg(id, s.variant, { width: 96, scars: s.legend })}
        <span class="species-body"><strong>${esc(sp.name)}</strong>
          <span class="level">${prog.max ? 'Ausgewachsen' : `Drachenalter ${prog.level} von ${META.levels.length}`}</span>
          <span class="meter" aria-hidden="true"><i style="width:${Math.round((prog.max ? 1 : prog.into) * 100)}%"></i></span>
        </span>
      </button>`;
    }).join('');

    const sp = SPECIES[chosen];
    const s = p.species[chosen];
    const prog = Meta.levelProgress(s.xp);
    const next = sp.track[prog.level];
    const nextLine = next
      ? `<p class="next-unlock">${unlockIcon(next, 26)}<span>Bei ${prog.next} Erfahrung (jetzt ${s.xp}) schaltet ${esc(sp.name)} frei: <strong>${esc(unlockLabel(next))}</strong></span></p>`
      : `<p class="muted">${sp.track.length ? 'Alle Freischaltungen dieser Art sind offen.' : 'Dieser Drache ist selbst die Belohnung.'}</p>`;
    const variants = Meta.variantsOf(p, chosen);
    const swatches = variants > 1
      ? `<div class="variants"><span class="label">Farbe</span>${sp.palettes.slice(0, variants).map((pal, i) => `<button class="swatch${i === s.variant ? ' is-on' : ''}" type="button" data-action="pick-variant" data-i="${i}" aria-pressed="${i === s.variant}" aria-label="Farbe ${i + 1}" style="--a:${pal.body[0]};--b:${pal.wing[0]}"></button>`).join('')}</div>`
      : '';
    return `<section class="hub-section" aria-labelledby="h-species">
      <h3 id="h-species">Drache</h3>
      <div class="species-list">${list}</div>
      <div class="species-detail">
        <p><span class="label">Regel</span> ${esc(sp.ruleText)}</p>
        ${nextLine}
        ${swatches}
      </div>
    </section>`;
  }

  function legendHTML(p) {
    const chosen = p.choice.species;
    const max = Meta.maxLegend(p, chosen);
    if (!max) {
      return p.stats.runs ? `<section class="hub-section"><h3>Legende</h3><p class="muted">Lass ein Ei schlüpfen, um Legende 1 freizuschalten. Jede Stufe bringt eine neue Regel – und Narben für deinen Drachen.</p></section>` : '';
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

  function loadoutHTML(p) {
    const available = Meta.availableCards(p);
    const hand = Meta.validLoadout(p);
    if (available.length <= HAND_SIZE) {
      return `<section class="hub-section" aria-labelledby="h-cards"><h3 id="h-cards">Atem-Karten</h3>
        <div class="cards cards-hub">${hand.map((id) => cardMini(CARD_BY_ID[id])).join('')}</div>
        <p class="muted">Weitere Atem-Karten schaltest du im Drachenalter frei.</p></section>`;
    }
    return `<section class="hub-section" aria-labelledby="h-cards"><h3 id="h-cards">Atem-Karten <span class="count">${hand.length} von ${HAND_SIZE}</span></h3>
      <div class="cards cards-hub">${available.map((id) => cardMini(CARD_BY_ID[id], { on: hand.includes(id), action: 'toggle-card' })).join('')}</div>
      <p class="muted">Du nimmst ${HAND_SIZE} Karten mit. Tippe eine an, um sie heraus- oder hineinzunehmen.</p></section>`;
  }

  function modesHTML(p) {
    if (!p.stats.runs) return '';
    const week = Meta.weekKey();
    const best = p.best.weekly?.week === week ? p.best.weekly : null;
    const modes = [
      { id: 'normal', name: 'Run', text: `${CONFIG.nights} Nächte mit deinem Drachen, deiner Legende und deinen Karten.` },
      { id: 'endless', name: 'Endlose Belagerung', text: p.best.endless ? `Bestwert: ${p.best.endless} Nächte.` : 'So viele Nächte wie möglich.', locked: 'Schaltet die Tat „Erste Brut“ frei.' },
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
    const rows = p.nemeses.map((n) => `<li>${heroImg(n.type, 34)}<span><strong>${esc(n.name)}</strong> <span class="stars" aria-label="Rang ${n.rank}">${stars(n.rank)}</span><br><span class="muted">trägt ${esc(yours(n.treasure, 'acc'))}</span></span>${treasureImg(n.treasure, 30)}</li>`).join('');
    return `<section class="hub-section wanted" aria-labelledby="h-foes"><h3 id="h-foes">Erzfeinde</h3>
      ${rows ? `<ul class="foe-list">${rows}</ul>` : '<p class="muted">Gerade jagt dich niemand.</p>'}
      ${p.trophies.length ? `<p class="muted">Trophäenwand: ${p.trophies.length} ${p.trophies.length === 1 ? 'Helm' : 'Helme'} besiegter Erzfeinde.</p>` : ''}
    </section>`;
  }

  function hubHTML(p) {
    const first = !p.stats.runs;
    const intro = p.introSeen ? '' : `<div class="intro">
      <p><strong>Du bist der Drache.</strong> Beschütze dein Ei ${CONFIG.nights} Nächte lang. Helden laufen immer zum <em>glänzendsten</em> Schatz, den sie erreichen und tragen können – auch zu deinem Ei.</p>
      <button class="ghost small" type="button" data-action="intro-ok">Verstanden</button>
    </div>`;
    const mode = Meta.modeAvailable(p, p.choice.mode) ? p.choice.mode : 'normal';
    const startLabel = mode === 'endless' ? 'Belagerung starten' : mode === 'weekly' ? 'Wochen-Hort starten' : first ? 'Ersten Run starten' : 'Run starten';
    const note = mode === 'weekly' ? '<p class="muted">Im Wochen-Hort spielen alle mit dem Golddrachen, Legende 0 und den vier Grundkarten.</p>' : '';
    return `${intro}
      <p class="eyebrow">${first ? 'Dein erster Hort' : `${p.stats.runs} Runs · ${p.stats.wins} Siege`}</p>
      <h2>Deine Höhle</h2>
      ${speciesHTML(p)}
      ${first ? '' : legendHTML(p)}
      ${loadoutHTML(p)}
      ${modesHTML(p)}
      ${nemesesHTML(p)}
      ${note}
      <div class="actions sticky-actions">
        <button class="ghost" type="button" data-action="open-book">Hortbuch</button>
        <button class="primary" type="button" data-action="start-run">${padPrefix('y')}${startLabel}</button>
      </div>`;
  }

  // ── Run ──

  function nightLabel(s) {
    return Sim.isEndless(s) ? `Endlose Belagerung · Nacht ${s.night}` : `Nacht ${s.night} von ${s.nights}`;
  }

  function raidHTML(s) {
    const choices = s.realms.map((id) => {
      const raid = RAIDS[id];
      const loot = [...new Set(raid.loot.map(([t]) => t).filter((t) => Sim.treasureAvailable(s, t)))].map((t) => treasureImg(t, 30)).join('');
      const foes = raid.party.map(([type]) => heroImg(type, 30)).join('');
      return `<button class="choice" type="button" data-action="raid" data-id="${id}">
        <span class="choice-head"><strong>${esc(raid.name)}</strong><span class="realm">${esc(raid.realm)}</span></span>
        <span class="choice-text">${esc(raid.text)}</span>
        <span class="choice-row"><span class="label">Beute</span><span class="icons">${loot}</span></span>
        <span class="choice-row"><span class="label">Nachts</span><span class="icons">${foes}</span></span>
      </button>`;
    }).join('');
    const day = Sim.isEndless(s) ? `Tag ${s.night}` : `Tag ${s.night} von ${s.nights}`;
    return `<p class="eyebrow">${day}${s.opts.legend ? ` · Legende ${s.opts.legend}` : ''}</p>
      <h2>Wen überfällst du?</h2>
      <p class="lead">Das Raubziel bestimmt deine Beute – und wer dich heute Nacht heimsucht.</p>
      <div class="choices">${choices}</div>`;
  }

  function lootHTML(s) {
    const raid = RAIDS[s.raid];
    const items = s.lootOffer.map((id, i) => {
      const d = Sim.describeItem(s, { id, uid: -1 });
      const on = lootSel.includes(i);
      return `<button class="loot${on ? ' is-on' : ''}" type="button" data-action="toggle-loot" data-i="${i}" aria-pressed="${on}">
        ${treasureImg(id, 44)}
        <span class="loot-body"><strong>${esc(d.name)}</strong><span class="stats">${statsLine(d)}</span>${d.text ? `<span class="loot-text">${esc(d.text)}</span>` : ''}</span>
      </button>`;
    }).join('');
    const ready = lootSel.length === Math.min(CONFIG.lootPick, s.lootOffer.length);
    return `<p class="eyebrow">Raubzug · ${esc(raid.name)}</p>
      <h2>Wähle ${CONFIG.lootPick} Schätze</h2>
      <div class="loot-list">${items}</div>
      <div class="actions"><button class="primary" type="button" data-action="take-loot"${ready ? '' : ' disabled'}>${padPrefix('y')}Mitnehmen</button></div>`;
  }

  function ravensHTML(s) {
    const { groups, nemeses } = Sim.partySummary(s);
    const hidden = s.mods.hiddenGroup && groups.length > 1 ? groups.length - 1 : -1;
    const rows = groups.map(({ type, count }, i) => {
      if (i === hidden) return `<li><span class="unknown" aria-hidden="true">?</span><span><strong>${count} Unbekannte</strong> Die Raben schweigen über diese Gruppe.</span></li>`;
      const hero = HEROES[type];
      return `<li>${heroImg(type, 34)}<span><strong>${count} ${esc(count === 1 ? hero.name : hero.plural)}</strong> ${esc(hero.text)}</span></li>`;
    });
    for (const n of nemeses) {
      rows.push(`<li class="nemesis">${heroImg(n.type, 34)}<span><strong>Erzfeind: ${esc(n.name)} ${stars(n.rank)}</strong> Trägt ${esc(yours(n.treasure, 'acc'))}. Wer den Erzfeind besiegt, holt ${PRONOUN[TREASURES[n.treasure].g]} zurück.</span></li>`);
    }
    return `<section class="ravens" aria-label="Die Raben melden"><h3>Die Raben melden</h3><ul>${rows.join('')}</ul></section>`;
  }

  function hatchPreviewHTML(s) {
    if (!s.nights || s.night !== s.nights) return '';
    const id = Sim.computeHatch(s);
    const known = !!app.profile.species[id] || !SPECIES[id].secret;
    return `<div class="hatch-preview">${dragonImg(id, 0, { width: 84, silhouette: !known })}
      <p><strong>Letzte Nacht.</strong> Übersteht dein Ei sie, schlüpft ${known ? `ein <strong>${esc(SPECIES[id].name)}</strong>` : 'etwas Geheimnisvolles'}. Was auf den acht Feldern rund ums Ei liegt, entscheidet.</p></div>`;
  }

  function arrangeHTML(s) {
    const tray = s.tray.length
      ? `<div class="tray"><span class="label">${usingPad() ? `Neue Beute – mit ${glyph('lb')} ${glyph('rb')} auswählen` : 'Neue Beute – antippen und auf ein Feld legen'}</span><div class="tray-items">${s.tray.map((item, i) => {
        const on = app.view.held?.where === 'tray' && app.view.held.i === i;
        return `<button class="tray-item${on ? ' is-on' : ''}" type="button" data-action="pick-tray" data-i="${i}" aria-pressed="${on}" title="${esc(TREASURES[item.id].name)}">${treasureImg(item.id, 40)}</button>`;
      }).join('')}</div></div>`
      : '';
    const rule = SPECIES[s.opts.species].rule ? `<p class="rule-note"><span class="label">${esc(SPECIES[s.opts.species].name)}</span> ${esc(SPECIES[s.opts.species].ruleText)}</p>` : '';
    return `<p class="eyebrow">Tag ${s.night} · ${esc(RAIDS[s.raid].name)} geplündert</p>
      <h2>Hort ordnen</h2>
      <p class="lead">${usingPad() ? `Steuerkreuz bewegt den Rahmen, ${glyph('a')} nimmt einen Schatz und legt ihn ab.` : 'Ziehe Schätze auf ein Feld oder tippe sie an.'} Zwei gleiche aufeinander verschmelzen zu einem größeren.</p>
      ${hatchPreviewHTML(s)}
      ${tray}
      <div class="info" id="info"></div>
      ${ravensHTML(s)}
      ${rule}
      <div class="actions">
        <button class="ghost" type="button" data-action="discard" id="btn-discard" hidden>${padPrefix('x')}Wegwerfen</button>
        <button class="primary" type="button" data-action="start-night">${padPrefix('y')}Nacht ${s.night} beginnen</button>
      </div>`;
  }

  function nightHTML(s) {
    const cards = s.opts.cards.map((id, i) => {
      const card = CARD_BY_ID[id];
      const key = usingPad() ? app.pad.label(CARD_BUTTONS[i]) : i + 1;
      return `<button class="card" type="button" data-action="card" data-id="${card.id}" id="card-${card.id}">
        <span class="card-top"><kbd>${esc(key)}</kbd><span class="cost" aria-label="${card.cost} Glut">${'<i></i>'.repeat(card.cost)}</span></span>
        <strong>${esc(card.name)}</strong>
        <span class="card-text">${esc(card.text)}</span>
      </button>`;
    }).join('');
    return `<p class="eyebrow">${nightLabel(s)}</p>
      <h2>Verteidige den Hort</h2>
      <div class="glut"><span class="label">Glut</span><span class="pips" id="glut-pips"></span></div>
      <div class="cards">${cards}</div>
      <p class="hint" id="night-hint"></p>
      <p class="foes" id="foes"></p>`;
  }

  function morningHTML(s) {
    const n = s.lastNight;
    const stolen = n.stolen.length
      ? `<div class="stolen"><span class="label">Gestohlen</span><span class="icons">${n.stolen.map((id) => treasureImg(id, 30)).join('')}</span></div>`
      : '<p class="good">Kein einziger Schatz ist fort.</p>';
    const lostStart = n.lostOnStart.length ? `<p class="muted">Ohne freien Platz verloren: ${n.lostOnStart.map((id) => esc(TREASURES[id].name)).join(', ')}.</p>` : '';
    const guards = s.guardians.length ? `<p class="note">${s.guardians.length} ${s.guardians.length === 1 ? 'Gefallener steht' : 'Gefallene stehen'} in der nächsten Nacht als Knochenwächter wieder auf.</p>` : '';
    const loot = s.morningLoot.length
      ? `<div class="loot-list">${s.morningLoot.map((id, i) => {
        const d = Sim.describeItem(s, { id, uid: -1 });
        const on = morningSel.has(i);
        return `<button class="loot${on ? ' is-on' : ''}" type="button" data-action="toggle-morning" data-i="${i}" aria-pressed="${on}">
          ${treasureImg(id, 44)}
          <span class="loot-body"><strong>${esc(d.name)}</strong><span class="stats">${statsLine(d)}</span><span class="loot-text">${esc(d.text)}</span></span>
        </button>`;
      }).join('')}</div>`
      : '<p class="muted">Diesmal haben die Helden nichts zurückgelassen.</p>';
    return `<p class="eyebrow">Morgen nach Nacht ${n.night}</p>
      <h2>${n.stolen.length ? 'Der Hort ist kleiner geworden' : 'Der Hort hat gehalten'}</h2>
      <dl class="summary"><div><dt>Besiegt</dt><dd>${n.defeated}</dd></div><div><dt>Entkommen</dt><dd>${n.escaped}</dd></div></dl>
      ${stolen}
      ${lostStart}
      ${guards}
      <h3>Beute der Besiegten</h3>
      ${loot}
      <div class="actions"><button class="primary" type="button" data-action="take-morning">${padPrefix('y')}Weiter zu Tag ${n.night + 1}</button></div>`;
  }

  function rewardsHTML(s, r) {
    if (!r) return '';
    const items = [];
    const sp = SPECIES[r.species];
    const levelUp = r.levelAfter > r.levelBefore ? ` · Drachenalter ${r.levelBefore} → ${r.levelAfter}` : '';
    items.push(`<li><span class="glyph" aria-hidden="true">+</span><span><strong>${r.xp} Erfahrung</strong> für ${esc(sp.name)}${levelUp}</span></li>`);
    for (const id of r.unlocked) items.push(`<li class="is-new">${unlockIcon(id, 30)}<span><strong>Neu:</strong> ${esc(unlockLabel(id))}</span></li>`);
    for (const id of r.deeds) {
      const d = DEEDS.find((x) => x.id === id);
      items.push(`<li class="is-new"><span class="glyph" aria-hidden="true">✓</span><span><strong>Tat geschafft: ${esc(d.name)}</strong> – ${esc(d.text)}</span></li>`);
    }
    if (r.legendUnlocked) items.push(`<li class="is-new"><span class="glyph" aria-hidden="true">${r.legendUnlocked}</span><span><strong>Legende ${r.legendUnlocked} ist offen</strong> – ${esc(LEGEND[r.legendUnlocked - 1].text)}</span></li>`);
    for (const n of r.nemesesBeaten) items.push(`<li class="is-new">${treasureImg(n.treasure, 30)}<span><strong>Erzfeind besiegt: ${esc(n.name)}</strong> – ${esc(isBack(n.treasure))}, der Helm hängt an der Trophäenwand.</span></li>`);
    for (const n of r.nemesesNew) items.push(`<li>${heroImg(n.type, 30)}<span><strong>Neuer Erzfeind: ${esc(n.name)}</strong> ist mit ${esc(yours(n.treasure, 'dat'))} entkommen und kommt in einem späteren Run wieder.</span></li>`);
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
        <p class="outcome">In Nacht ${s.night} ist ein ${esc(HEROES[s.lostBy]?.name ?? 'Held')} mit deinem Ei entkommen.</p>`;
    } else {
      head = `<p class="eyebrow">Nacht ${s.night}</p><h2 class="big">Das Ei ist fort</h2>
        <p class="outcome">Ein ${esc(HEROES[s.lostBy]?.name ?? 'Held')} ist mit deinem Ei entkommen.</p>`;
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
        <div><dt>Gestohlen</dt><dd>${s.stats.stolen.length}</dd></div>
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
    ['schaetze', 'Schätze'],
    ['helden', 'Helden'],
    ['drachen', 'Drachen'],
    ['karten', 'Karten'],
    ['taten', 'Taten'],
    ['feinde', 'Erzfeinde'],
  ];

  function entry(icon, title, text, known) {
    return `<li class="entry${known ? '' : ' is-unknown'}">${icon}<span><strong>${title}</strong><span>${text}</span></span></li>`;
  }

  function bookContent(tab, p) {
    if (tab === 'schaetze') {
      const ids = Object.keys(TREASURES);
      const known = ids.filter((id) => p.seen.treasures.includes(id));
      return [`${known.length} von ${ids.length} entdeckt`, ids.map((id) => {
        const d = TREASURES[id];
        return p.seen.treasures.includes(id)
          ? entry(treasureImg(id, 40), esc(d.name), esc(`Wert ${d.value} · Glanz ${d.glanz} · Gewicht ${d.weight}${d.text ? ` – ${d.text}` : ''}`), true)
          : entry(treasureImg(id, 40, true), '???', esc(Meta.treasureHint(id, RAIDS)), false);
      })];
    }
    if (tab === 'helden') {
      const ids = Object.keys(HEROES);
      const known = ids.filter((id) => p.seen.heroes.includes(id));
      return [`${known.length} von ${ids.length} begegnet`, ids.map((id) => {
        const h = HEROES[id];
        const realms = Object.values(RAIDS).filter((r) => r.party.some(([t]) => t === id)).map((r) => r.name).join(', ');
        return p.seen.heroes.includes(id)
          ? entry(heroImg(id, 40), esc(h.name), esc(h.text), true)
          : entry(heroImg(id, 40, true), '???', esc(`Kommt nach einem Raubzug auf: ${realms}.`), false);
      })];
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
    if (tab === 'karten') {
      const available = Meta.availableCards(p);
      return [`${available.length} von ${CARDS.length} freigeschaltet`, CARDS.map((c) => (available.includes(c.id)
        ? entry(`<span class="glyph" aria-hidden="true">✦</span>`, `${esc(plain(c.name))} <span class="cost-text">${c.cost} Glut</span>`, esc(c.text), true)
        : entry(`<span class="glyph" aria-hidden="true">?</span>`, '???', esc(Meta.cardHint(c.id)), false)))];
    }
    if (tab === 'taten') {
      return [`${p.deeds.length} von ${DEEDS.length} geschafft`, DEEDS.map((d) => {
        const done = p.deeds.includes(d.id);
        const reward = d.unlock?.length ? ` Belohnung: ${d.unlock.map((u) => UNLOCKS[u].name).join(', ')}.` : '';
        return entry(`<span class="glyph" aria-hidden="true">${done ? '✓' : '·'}</span>`, esc(d.name), esc(`${d.text}${reward}`), done);
      })];
    }
    const wanted = p.nemeses.map((n) => entry(heroImg(n.type, 40), `${esc(n.name)} <span class="stars">${stars(n.rank)}</span>`, esc(`Gesucht. Trägt ${yours(n.treasure, 'acc')}.`), true));
    const trophies = p.trophies.slice().reverse().map((t) => entry(heroImg(t.type, 40), esc(t.name), esc(`Besiegt. ${isBack(t.treasure)}.`), true));
    const rows = [...wanted, ...trophies];
    return [`${p.nemeses.length} gesucht · ${p.trophies.length} besiegt`, rows.length ? rows : ['<li class="empty">Wer mit einem wertvollen Schatz aus deiner Höhle entkommt, bekommt einen Namen – und kommt in einem späteren Run zurück.</li>']];
  }

  function renderBook(tab = bookTab) {
    // Lag der Fokus auf einem Reiter, bleibt er nach dem Neuzeichnen auf dem gewählten
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
    const viewKey = app.mode === 'hub' ? 'hub' : s?.phase;
    if (!viewKey) return;
    if (viewKey !== lastView) {
      if (viewKey === 'loot') lootSel = [];
      if (viewKey === 'morning') morningSel = new Set(s.morningLoot.map((_, i) => i));
      lastView = viewKey;
      panel.scrollTop = 0;
    }
    let html;
    if (app.mode === 'hub') html = hubHTML(app.profile);
    else {
      html = {
        raid: raidHTML,
        loot: lootHTML,
        arrange: arrangeHTML,
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

  function showInfo() {
    const box = $('info');
    const s = app.state;
    const v = app.view;
    if (!box || !s) return;
    let item = null;
    let c = null;
    let r = null;
    let label = '';
    if (v.held) {
      label = usingPad() ? `Ausgewählt – ${esc(app.pad.label('a'))} legt ab` : 'Ausgewählt – tippe auf ein Feld';
      if (v.held.where === 'tray') {
        item = s.tray[v.held.i] ?? null;
      } else {
        ({ c, r } = v.held);
        item = Sim.itemAt(s, c, r);
      }
    } else if (v.hover && Sim.itemAt(s, v.hover.c, v.hover.r)) {
      ({ c, r } = v.hover);
      item = Sim.itemAt(s, c, r);
    }
    let html;
    if (item) {
      const d = Sim.describeItem(s, item, c, r);
      html = `<div class="item-info">${treasureImg(d.id, 48)}<div>
        ${label ? `<p class="eyebrow">${label}</p>` : ''}
        <strong>${esc(d.name)}</strong>
        <p class="stats">${statsLine(d)}</p>
        ${d.text ? `<p>${esc(d.text)}</p>` : ''}
        ${d.next ? `<p class="muted">Zwei davon verschmelzen zu: ${esc(d.next)}</p>` : ''}
      </div></div>`;
    } else {
      html = '<p class="muted">Zahl oben links: Glanz. Punkte unten rechts: Gewicht. Diebe und Bauern tragen nur Gewicht 1, die anderen Helden Gewicht 2.</p>';
    }
    if (html !== infoCache) {
      box.innerHTML = html;
      infoCache = html;
    }
    const discard = $('btn-discard');
    if (discard) discard.hidden = !(v.held && item && item.id !== 'ei');
  }

  function set(el, key, value, prop = 'textContent') {
    if (cache[key] === value) return;
    cache[key] = value;
    el[prop] = value;
  }

  function tick() {
    const s = app.state;
    if (!s) return;
    const hub = app.mode === 'hub';
    const night = !hub && s.phase === 'night';
    let label = 'Höhle';
    if (!hub) label = night ? `Nacht ${s.night}` : Sim.DAY_PHASES.has(s.phase) ? `Tag ${s.night}` : s.phase === 'morning' ? 'Morgen' : 'Ende';
    set(bar.phase, 'phase', label);
    set(bar.valueWrap, 'valueHidden', hub, 'hidden');
    set(bar.powerWrap, 'powerHidden', hub, 'hidden');
    set(bar.value, 'value', String(Sim.hoardValue(s)));
    set(bar.power, 'power', `×${num(Sim.power(s))}`);
    set(bar.glutWrap, 'glutHidden', !night, 'hidden');
    set(bar.glut, 'glut', `${s.glut}/${s.glutMax}`);
    set(buttons.pause, 'pauseLabel', app.view.paused ? 'Weiter' : 'Pause');
    set(buttons.pause, 'pauseDisabled', !night, 'disabled');
    set(buttons.speed, 'speed', `${app.view.speed}×`);
    set(buttons.settings, 'sound', audio.settings.muted ? ICON_MUTED : ICON_SOUND, 'innerHTML');
    if (!night) return;

    const pips = $('glut-pips');
    if (pips) {
      const period = Sim.glutPeriod(s);
      const key = `${s.glut}/${s.glutMax}/${Math.floor((s.glutTimer / period) * 10)}`;
      if (cache.pips !== key) {
        cache.pips = key;
        const filling = s.glut < s.glutMax ? s.glutTimer / period : 0;
        pips.innerHTML = Array.from({ length: s.glutMax }, (_, i) => {
          if (i < s.glut) return '<i class="on"></i>';
          if (i === s.glut) return `<i style="--fill:${Math.round(filling * 100)}%"></i>`;
          return '<i></i>';
        }).join('') + `<span class="pips-num">${s.glut}/${s.glutMax}</span>`;
      }
    }
    for (const id of s.opts.cards) {
      const el = $(`card-${id}`);
      if (!el) continue;
      set(el, `dis-${id}`, s.glut < CARD_BY_ID[id].cost, 'disabled');
      const active = app.view.card === id;
      if (cache[`act-${id}`] !== active) {
        cache[`act-${id}`] = active;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-pressed', String(active));
      }
    }
    const hint = $('night-hint');
    if (hint) {
      const card = app.view.card ? CARD_BY_ID[app.view.card] : null;
      const pad = usingPad();
      const L = (name) => app.pad.label(name);
      let text = 'Die Klaue trifft Helden direkt vor dir von selbst. Rot umrandete Helden tragen Beute – schnapp sie dir!';
      if (app.view.paused) text = pad ? `Pausiert. Weiter mit ${L('start')}.` : 'Pausiert. Weiter mit der Leertaste oder dem Knopf oben.';
      else if (card?.target === 'tile') text = pad ? `${plain(card.name)}: Mit dem Stick zielen, ${L('a')} setzt ein, ${L('b')} bricht ab. Die Zeit läuft langsamer.` : `${plain(card.name)}: Tippe auf ein Feld. Die Zeit läuft langsamer, solange du zielst. Esc bricht ab.`;
      else if (card?.target === 'hero') text = pad ? `${plain(card.name)}: Steuerkreuz wechselt den Helden, ${L('a')} schnappt zu, ${L('b')} bricht ab.` : `${plain(card.name)}: Tippe auf einen Helden im hellen Bereich. Esc bricht ab.`;
      else if (pad) text = `Die Klaue trifft Helden vor dir von selbst. ${CARD_BUTTONS.slice(0, s.opts.cards.length).map(L).join(' ')} setzen deine Atem-Karten ein.`;
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
