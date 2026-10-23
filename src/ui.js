// Die Tafel neben der Höhle: zeigt, was in der aktuellen Phase zu tun ist, und die Kopfzeile.

import { TREASURES, HEROES, RAIDS, RAID_ORDER, CARDS, SPECIES, CONFIG } from './data.js';
import * as Sim from './sim.js';
import { iconURL } from './icons.js';
import { seedToCode } from './rng.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const num = (value, digits = 1) => value.toFixed(digits).replace('.', ',');

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Ohne Speicher erscheint der Hinweis eben beim nächsten Mal wieder
  }
}

const treasureImg = (id, size = 40) => `<img src="${iconURL('t', id)}" alt="" width="${size}" height="${size}">`;
const heroImg = (type, size = 36) => `<img src="${iconURL('hero', type)}" alt="" width="${size}" height="${size}">`;

function statsLine(d) {
  const mark = (now, base) => (now !== base ? ` <span class="changed">(${base})</span>` : '');
  return `<span>Wert <b>${d.value}</b></span><span>Glanz <b>${d.glanz}</b>${mark(d.glanz, d.baseGlanz)}</span><span>Gewicht <b>${d.weight}</b>${mark(d.weight, d.baseWeight)}</span>`;
}

export function createUI(app) {
  const $ = (id) => document.getElementById(id);
  const panel = $('panel');
  const bar = { phase: $('s-phase'), value: $('s-value'), power: $('s-power'), glut: $('s-glut'), glutWrap: $('s-glut-wrap') };
  const buttons = { pause: $('btn-pause'), speed: $('btn-speed'), help: $('btn-help'), helpClose: $('btn-help-close') };
  const help = $('help');
  const toastEl = $('toast');

  let lootSel = [];
  let morningSel = new Set();
  let lastPhase = null;
  let introSeen = readFlag('hort.intro');
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
    } else if (action === 'intro-ok') {
      introSeen = true;
      writeFlag('hort.intro');
      render();
    } else if (action === 'copy-code') {
      const code = seedToCode(app.state.seed);
      navigator.clipboard?.writeText(code).then(() => toast('Hort-Code kopiert.'), () => selectCode());
      if (!navigator.clipboard) selectCode();
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
  buttons.help.addEventListener('click', () => {
    help.hidden = false;
    buttons.helpClose.focus();
  });
  buttons.helpClose.addEventListener('click', () => {
    help.hidden = true;
    buttons.help.focus();
  });
  help.addEventListener('click', (e) => {
    if (e.target === help) help.hidden = true;
  });

  function toast(text) {
    if (!text) return;
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 2400);
  }

  // ── Phasen ──

  function introHTML() {
    if (introSeen) return '';
    return `<div class="intro">
      <p><strong>Du bist der Drache.</strong> Beschütze dein Ei ${CONFIG.nights} Nächte lang. Helden laufen immer zum <em>glänzendsten</em> Schatz, den sie erreichen und tragen können – auch zu deinem Ei.</p>
      <button class="ghost small" type="button" data-action="intro-ok">Verstanden</button>
    </div>`;
  }

  function raidHTML(s) {
    const choices = RAID_ORDER.map((id) => {
      const raid = RAIDS[id];
      const loot = [...new Set(raid.loot.map(([t]) => t))].map((t) => treasureImg(t, 30)).join('');
      const foes = raid.party.map(([type]) => heroImg(type, 30)).join('');
      return `<button class="choice" type="button" data-action="raid" data-id="${id}">
        <span class="choice-head"><strong>${esc(raid.name)}</strong><span class="realm">${esc(raid.realm)}</span></span>
        <span class="choice-text">${esc(raid.text)}</span>
        <span class="choice-row"><span class="label">Beute</span><span class="icons">${loot}</span></span>
        <span class="choice-row"><span class="label">Nachts</span><span class="icons">${foes}</span></span>
      </button>`;
    }).join('');
    return `${introHTML()}
      <p class="eyebrow">Tag ${s.night} von ${CONFIG.nights}</p>
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
      <div class="actions"><button class="primary" type="button" data-action="take-loot"${ready ? '' : ' disabled'}>Mitnehmen</button></div>`;
  }

  function ravensHTML(s) {
    const rows = Sim.partySummary(s).map(({ type, count }) => {
      const hero = HEROES[type];
      return `<li>${heroImg(type, 34)}<span><strong>${count} ${esc(count === 1 ? hero.name : hero.plural)}</strong> ${esc(hero.text)}</span></li>`;
    }).join('');
    return `<section class="ravens" aria-label="Die Raben melden"><h3>Die Raben melden</h3><ul>${rows}</ul></section>`;
  }

  function arrangeHTML(s) {
    const tray = s.tray.length
      ? `<div class="tray"><span class="label">Neue Beute – antippen und auf ein Feld legen</span><div class="tray-items">${s.tray.map((item, i) => {
        const on = app.view.held?.where === 'tray' && app.view.held.i === i;
        return `<button class="tray-item${on ? ' is-on' : ''}" type="button" data-action="pick-tray" data-i="${i}" aria-pressed="${on}" title="${esc(TREASURES[item.id].name)}">${treasureImg(item.id, 40)}</button>`;
      }).join('')}</div></div>`
      : '';
    return `<p class="eyebrow">Tag ${s.night} · ${esc(RAIDS[s.raid].name)} geplündert</p>
      <h2>Hort ordnen</h2>
      <p class="lead">Ziehe Schätze auf ein Feld oder tippe sie an. Zwei gleiche aufeinander verschmelzen zu einem größeren.</p>
      ${tray}
      <div class="info" id="info"></div>
      ${ravensHTML(s)}
      <div class="actions">
        <button class="ghost" type="button" data-action="discard" id="btn-discard" hidden>Wegwerfen</button>
        <button class="primary" type="button" data-action="start-night">Nacht ${s.night} beginnen</button>
      </div>`;
  }

  function nightHTML(s) {
    const cards = CARDS.map((card, i) => `<button class="card" type="button" data-action="card" data-id="${card.id}" id="card-${card.id}">
        <span class="card-top"><kbd>${i + 1}</kbd><span class="cost" aria-label="${card.cost} Glut">${'<i></i>'.repeat(card.cost)}</span></span>
        <strong>${esc(card.name)}</strong>
        <span class="card-text">${esc(card.text)}</span>
      </button>`).join('');
    return `<p class="eyebrow">Nacht ${s.night} von ${CONFIG.nights}</p>
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
      <h3>Beute der Besiegten</h3>
      ${loot}
      <div class="actions"><button class="primary" type="button" data-action="take-morning">Weiter zu Tag ${n.night + 1}</button></div>`;
  }

  function endHTML(s) {
    const won = s.phase === 'won';
    const code = seedToCode(s.seed);
    const head = won
      ? `<p class="eyebrow">${CONFIG.nights} Nächte überstanden</p><h2 class="big">Das Ei schlüpft!</h2>
         <p class="species">Ein <strong>${esc(SPECIES[s.species].name)}</strong> ist geschlüpft. ${esc(SPECIES[s.species].text)}</p>`
      : `<p class="eyebrow">Nacht ${s.night}</p><h2 class="big">Das Ei ist fort</h2>
         <p class="species">Ein ${esc(HEROES[s.lostBy]?.name ?? 'Held')} ist mit deinem Ei entkommen.</p>`;
    return `${head}
      <dl class="summary">
        <div><dt>Nächte</dt><dd>${s.stats.nightsSurvived}</dd></div>
        <div><dt>Hortwert</dt><dd>${Sim.hoardValue(s)}</dd></div>
        <div><dt>Besiegt</dt><dd>${s.stats.defeated}</dd></div>
        <div><dt>Gestohlen</dt><dd>${s.stats.stolen.length}</dd></div>
      </dl>
      <p class="code">Hort-Code <code id="run-code">${code}</code> <button class="ghost small" type="button" data-action="copy-code">Kopieren</button></p>
      <p class="muted">Mit <code>#${code}</code> am Ende des Links startet genau dieser Run noch einmal.</p>
      <div class="actions"><button class="ghost" type="button" data-action="replay">Denselben Run nochmal</button><button class="primary" type="button" data-action="new-run">Neuer Run</button></div>
      ${won ? '<p class="note">Im fertigen Spiel schaltet jede neue Drachenart einen eigenen Start-Hort frei.</p>' : ''}`;
  }

  // ── Rendern ──

  function render() {
    const s = app.state;
    if (!s) return;
    if (s.phase !== lastPhase) {
      if (s.phase === 'loot') lootSel = [];
      if (s.phase === 'morning') morningSel = new Set(s.morningLoot.map((_, i) => i));
      lastPhase = s.phase;
      panel.scrollTop = 0;
    }
    const html = {
      raid: raidHTML,
      loot: lootHTML,
      arrange: arrangeHTML,
      night: nightHTML,
      morning: morningHTML,
      won: endHTML,
      lost: endHTML,
    }[s.phase](s);
    panel.innerHTML = `<div class="phase phase-${s.phase}">${html}</div>`;
    panel.dataset.phase = s.phase;
    infoCache = '';
    for (const key of Object.keys(cache)) delete cache[key];
    showInfo();
    tick();
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
      label = 'Ausgewählt – tippe auf ein Feld';
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
      html = '<p class="muted">Zahl oben links: Glanz. Punkte unten rechts: Gewicht. Diebe und Bauern tragen nur Gewicht 1, Paladine und Zwerge Gewicht 2.</p>';
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
    const night = s.phase === 'night';
    const label = night ? `Nacht ${s.night}` : Sim.DAY_PHASES.has(s.phase) ? `Tag ${s.night}` : s.phase === 'morning' ? 'Morgen' : 'Ende';
    set(bar.phase, 'phase', label);
    set(bar.value, 'value', String(Sim.hoardValue(s)));
    set(bar.power, 'power', `×${num(Sim.power(s))}`);
    set(bar.glutWrap, 'glutHidden', !night, 'hidden');
    set(bar.glut, 'glut', `${s.glut}/${s.glutMax}`);
    set(buttons.pause, 'pauseLabel', app.view.paused ? 'Weiter' : 'Pause');
    set(buttons.pause, 'pauseDisabled', !night, 'disabled');
    set(buttons.speed, 'speed', `${app.view.speed}×`);
    if (!night) return;

    const pips = $('glut-pips');
    if (pips) {
      const key = `${s.glut}/${s.glutMax}/${Math.floor((s.glutTimer / CONFIG.glutRegenSeconds) * 10)}`;
      if (cache.pips !== key) {
        cache.pips = key;
        const filling = s.glut < s.glutMax ? s.glutTimer / CONFIG.glutRegenSeconds : 0;
        pips.innerHTML = Array.from({ length: s.glutMax }, (_, i) => {
          if (i < s.glut) return '<i class="on"></i>';
          if (i === s.glut) return `<i style="--fill:${Math.round(filling * 100)}%"></i>`;
          return '<i></i>';
        }).join('') + `<span class="pips-num">${s.glut}/${s.glutMax}</span>`;
      }
    }
    for (const card of CARDS) {
      const el = $(`card-${card.id}`);
      if (!el) continue;
      set(el, `dis-${card.id}`, s.glut < card.cost, 'disabled');
      const active = app.view.card === card.id;
      if (cache[`act-${card.id}`] !== active) {
        cache[`act-${card.id}`] = active;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-pressed', String(active));
      }
    }
    const hint = $('night-hint');
    if (hint) {
      const text = app.view.paused
        ? 'Pausiert. Weiter mit der Leertaste oder dem Knopf oben.'
        : app.view.card === 'feuer'
          ? 'Feueratem: Tippe auf ein Feld. Die Zeit läuft langsamer, solange du zielst. Esc bricht ab.'
          : app.view.card === 'schnapp'
            ? 'Zuschnappen: Tippe auf einen Helden im hellen Bereich. Esc bricht ab.'
            : 'Die Klaue trifft Helden direkt vor dir von selbst. Rot umrandete Helden tragen Beute – schnapp sie dir!';
      set(hint, 'hint', text);
    }
    const foes = $('foes');
    if (foes) {
      const f = Sim.foesLeft(s);
      set(foes, 'foes', `${f.active} Helden in der Höhle · ${f.coming} kommen noch`);
    }
  }

  return { render, tick, showInfo, toast };
}
