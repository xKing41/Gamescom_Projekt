// Spiellogik von Hort, ganz ohne Grafik.
// Ein Run: Tag (Raubziel wählen, Beute nehmen, Hort ordnen) → Nacht (Helden, Atem-Karten) → Morgen (Beute der Besiegten).
// Alle Zufälle laufen über den Seed im Zustand, deshalb lässt sich jeder Run als Hort-Code nachspielen.
// Was zwischen den Runs passiert (Erfahrung, Freischaltungen, Taten), steht in meta.js – hier wird nur mitprotokolliert.

import { TREASURES, HEROES, RAIDS, RAID_ORDER, REALMS_PER_RUN, CARD_BY_ID, BASE_CARDS, HAND_SIZE, UNLOCKS, SPECIES, SPECIES_ORDER, HATCH_MIN, HATCH_PRIORITY, LEGEND, META, CONFIG } from './data.js';
import { COLS, ROWS, N4, idx, inside, kindAt, isHoardCell, HOARD_CELLS, DRAGON_CELLS, DRAGON_CENTER, ENTRANCES, DIG_AREA } from './map.js';
import { random, pick, pickWeighted, shuffle, randomSeed } from './rng.js';

export const DAY_PHASES = new Set(['raid', 'loot', 'arrange']);
const ACTIVE = new Set(['seek', 'grab', 'cast', 'flee', 'leave']);
export const isActive = (h) => ACTIVE.has(h.state);
export const activeHeroes = (state) => state.heroes.filter(isActive);
const VERSION = 2;

// ── Run ─────────────────────────────────────────────────────────

const MULTIPLY = ['spawnInterval', 'thiefSpeed', 'heroHp', 'lootChance', 'heroSpeed'];
const ADD = ['glutRegenAdd', 'extraHeroes', 'extraNight'];

// Die Regeln aller Legende-Stufen bis `level` zusammengefasst
export function legendMods(level) {
  const mods = { hiddenGroup: false, clever: 0 };
  for (const key of MULTIPLY) mods[key] = 1;
  for (const key of ADD) mods[key] = 0;
  for (const { mod } of LEGEND.slice(0, level)) {
    for (const [key, value] of Object.entries(mod)) {
      if (MULTIPLY.includes(key)) mods[key] *= value;
      else if (ADD.includes(key)) mods[key] += value;
      else if (key === 'clever') mods.clever = Math.max(mods.clever, value);
      else mods[key] = mods[key] || value;
    }
  }
  return mods;
}

export function cardAvailable(id, unlocks) {
  const card = CARD_BY_ID[id];
  return !!card && (!card.unlock || unlocks.includes(card.unlock));
}

function normalizeOptions(options) {
  const unlocks = Array.isArray(options.unlocks) ? options.unlocks.filter((id) => UNLOCKS[id]) : [];
  let cards = (Array.isArray(options.cards) ? options.cards : BASE_CARDS)
    .filter((id, i, list) => cardAvailable(id, unlocks) && list.indexOf(id) === i)
    .slice(0, HAND_SIZE);
  if (!cards.length) cards = BASE_CARDS.slice();
  const nemeses = (Array.isArray(options.nemeses) ? options.nemeses : [])
    .filter((n) => n && HEROES[n.type] && TREASURES[n.treasure])
    .map((n) => ({ id: String(n.id), name: String(n.name), type: n.type, treasure: n.treasure, rank: Math.max(1, Math.min(META.nemesisMaxRank, Math.floor(n.rank) || 1)) }));
  return {
    species: SPECIES[options.species] ? options.species : 'gold',
    variant: Number.isInteger(options.variant) ? options.variant : 0,
    legend: Math.max(0, Math.min(LEGEND.length, Math.floor(options.legend ?? 0))),
    cards,
    unlocks,
    nemeses,
    mode: ['normal', 'endless', 'weekly', 'code'].includes(options.mode) ? options.mode : 'normal',
  };
}

export function createRun(seed = randomSeed(), options = {}) {
  seed >>>= 0;
  const opts = normalizeOptions(options);
  const mods = legendMods(opts.legend);
  const state = {
    version: VERSION,
    seed,
    rngState: seed,
    opts,
    mods,
    nights: opts.mode === 'endless' ? 0 : CONFIG.nights + mods.extraNight, // 0 = endlos
    phase: 'raid',
    night: 1,
    hoard: new Array(COLS * ROWS).fill(null),
    tray: [],
    floor: [],
    heroes: [],
    digs: [],
    party: [],
    guardians: [],
    fallen: [],
    smoke: [],
    nextUid: 1,
    realms: [],
    raid: null,
    lootOffer: [],
    t: 0,
    spawnIndex: 0,
    glut: 0,
    glutMax: 0,
    glutTimer: 0,
    clawTimer: 0,
    nightLog: null,
    lastNight: null,
    morningLoot: [],
    stats: { defeated: 0, escaped: 0, stolen: [], nightsSurvived: 0 },
    runLog: { nights: [], landmark: false, maxHoard: 0, nemesisDefeated: [], nemesisEscaped: [], newNemeses: [], heroesSeen: [], treasuresSeen: [] },
    nemesesWaiting: opts.nemeses.map((n) => n.id),
    species: null,
    lostBy: null,
    fx: [],
  };
  state.realms = pickRealms(state);
  for (const [id, c, r] of SPECIES[opts.species].start) state.hoard[idx(c, r)] = newItem(state, id);
  state.runLog.maxHoard = hoardItems(state).length;
  return state;
}

function see(state, list, id) {
  if (!state.runLog[list].includes(id)) state.runLog[list].push(id);
}

function newItem(state, id) {
  see(state, 'treasuresSeen', id);
  return { uid: state.nextUid++, id };
}

export const isEndless = (state) => state.nights === 0;
export const ruleOf = (state) => SPECIES[state.opts.species].rule;
export const treasureAvailable = (state, id) => !UNLOCKS[id] || state.opts.unlocks.includes(id);

function pickRealms(state) {
  const available = RAID_ORDER.filter((id) => !RAIDS[id].unlock || state.opts.unlocks.includes(RAIDS[id].unlock));
  if (available.length <= REALMS_PER_RUN) return available;
  const chosen = new Set(shuffle(state, available).slice(0, REALMS_PER_RUN));
  return RAID_ORDER.filter((id) => chosen.has(id));
}

export function snapshot(state) {
  return JSON.stringify({ ...state, fx: [] });
}

export function restore(json) {
  try {
    const state = JSON.parse(json);
    return state?.version === VERSION ? { ...state, fx: [] } : null;
  } catch {
    return null;
  }
}

// ── Hort ────────────────────────────────────────────────────────

export const itemAt = (state, c, r) => (isHoardCell(c, r) ? state.hoard[idx(c, r)] : null);

export function hoardItems(state) {
  const out = [];
  for (const { c, r } of HOARD_CELLS) {
    const item = state.hoard[idx(c, r)];
    if (item) out.push({ c, r, item });
  }
  return out;
}

export const hoardValue = (state) => hoardItems(state).reduce((sum, { item }) => sum + TREASURES[item.id].value, 0);

// Je mehr der Hort wert ist, desto mehr Schaden macht der Drache
export function power(state) {
  let p = 1 + hoardValue(state) * CONFIG.powerPerValue;
  for (const { item } of hoardItems(state)) p *= TREASURES[item.id].power ?? 1;
  return p;
}

function plainNeighbors(state, c, r) {
  const out = [];
  for (const [dc, dr] of N4) {
    const item = itemAt(state, c + dc, r + dr);
    if (item) out.push(item);
  }
  return out;
}

// Wer wirkt auf dieses Feld? Die direkten Nachbarn – beim Kristalldrachen auch alles,
// was hinter einer Reihe Edelsteine liegt.
export function neighborSources(state, c, r) {
  if (ruleOf(state) !== 'conduct') return plainNeighbors(state, c, r);
  const out = [];
  for (const [dc, dr] of N4) {
    let x = c + dc;
    let y = r + dr;
    for (;;) {
      const item = itemAt(state, x, y);
      if (!item) break;
      out.push(item);
      if (TREASURES[item.id].family !== 'edelstein') break;
      x += dc;
      y += dr;
    }
  }
  return out;
}

const inSmoke = (state, c, r) => state.smoke.some((s) => Math.abs(s.c - c) <= 1 && Math.abs(s.r - r) <= 1);

// Das Mondsilber-Ei glänzt kaum – sonst gilt der Glanz aus den Daten
export function baseGlanz(state, id) {
  const egg = SPECIES[state.opts.species].eggGlanz;
  return id === 'ei' && egg != null ? egg : TREASURES[id].glanz;
}

export function effGlanz(state, c, r) {
  const item = itemAt(state, c, r);
  if (!item || inSmoke(state, c, r)) return 0;
  let glanz = baseGlanz(state, item.id);
  for (const n of neighborSources(state, c, r)) glanz += (TREASURES[n.id].shines ?? 0) - (TREASURES[n.id].dims ?? 0);
  return Math.max(0, glanz);
}

export function effWeight(state, c, r) {
  const item = itemAt(state, c, r);
  if (!item) return 0;
  let weight = TREASURES[item.id].weight;
  for (const n of neighborSources(state, c, r)) weight += TREASURES[n.id].burdens ?? 0;
  return weight;
}

function warded(state, c, r) {
  const item = itemAt(state, c, r);
  return !!item && (TREASURES[item.id].wards || neighborSources(state, c, r).some((n) => TREASURES[n.id].wards));
}

const floorGlanz = (state, f) => (inSmoke(state, f.c, f.r) ? 0 : baseGlanz(state, f.item.id));

export function describeItem(state, item, c = null, r = null) {
  const d = TREASURES[item.id];
  const inHoard = c != null && itemAt(state, c, r)?.uid === item.uid;
  return {
    id: item.id,
    name: d.name,
    value: d.value,
    glanz: inHoard ? effGlanz(state, c, r) : baseGlanz(state, item.id),
    baseGlanz: baseGlanz(state, item.id),
    weight: inHoard ? effWeight(state, c, r) : d.weight,
    baseWeight: d.weight,
    text: d.text ?? '',
    next: d.next ? TREASURES[d.next].name : null,
  };
}

function placeFirstFree(state, item) {
  for (const { c, r } of HOARD_CELLS) {
    if (!state.hoard[idx(c, r)]) {
      state.hoard[idx(c, r)] = item;
      return true;
    }
  }
  return false;
}

function placeNear(state, item, c0, r0) {
  let best = null;
  for (const { c, r } of HOARD_CELLS) {
    if (state.hoard[idx(c, r)]) continue;
    const d = Math.abs(c - c0) + Math.abs(r - r0);
    if (!best || d < best.d) best = { c, r, d };
  }
  if (!best) return false;
  state.hoard[idx(best.c, best.r)] = item;
  return true;
}

// ── Tag ─────────────────────────────────────────────────────────

export function chooseRaid(state, raidId) {
  if (state.phase !== 'raid' || !state.realms.includes(raidId)) return false;
  const raid = RAIDS[raidId];
  const pool = raid.loot.filter(([id]) => treasureAvailable(state, id));
  state.raid = raidId;
  state.lootOffer = Array.from({ length: CONFIG.lootOffer }, () => pickWeighted(state, pool));
  for (const id of state.lootOffer) see(state, 'treasuresSeen', id);
  state.party = makeParty(state, raid);
  state.phase = 'loot';
  return true;
}

function makeParty(state, raid) {
  const count = CONFIG.partyBase + Math.round(state.night * CONFIG.partyGrowth) + state.mods.extraHeroes;
  const [[mainType, share], [otherType]] = raid.party;
  const main = Math.min(count, Math.max(1, Math.round(count * share)));
  const types = shuffle(state, [...Array(main).fill(mainType), ...Array(count - main).fill(otherType)]);
  const interval = CONFIG.spawnInterval * state.mods.spawnInterval;
  const party = types.map((type, i) => ({ type, at: 0.8 + i * interval + random(state) * 0.6 }));

  // Ein Erzfeind aus früheren Runs schließt sich an – spätestens in Nacht 5
  const waiting = state.nemesesWaiting;
  if (state.night >= 2 && waiting.length && (random(state) < META.nemesisChance || state.night >= META.nemesisForceNight)) {
    const id = pick(state, waiting);
    const nemesis = state.opts.nemeses.find((n) => n.id === id);
    state.nemesesWaiting = waiting.filter((x) => x !== id);
    party.push({ type: nemesis.type, at: 0.8 + Math.floor(random(state) * count) * interval + 0.3, nemesis: id });
    party.sort((a, b) => a.at - b.at);
  }
  return party;
}

export function partySummary(state) {
  const groups = new Map();
  const nemeses = [];
  for (const entry of state.party) {
    if (entry.nemesis) {
      const n = state.opts.nemeses.find((x) => x.id === entry.nemesis);
      if (n) nemeses.push(n);
    } else {
      groups.set(entry.type, (groups.get(entry.type) ?? 0) + 1);
    }
  }
  return { groups: [...groups].map(([type, count]) => ({ type, count })), nemeses };
}

export function takeLoot(state, indices) {
  if (state.phase !== 'loot') return false;
  const chosen = [...new Set(indices)].filter((i) => i >= 0 && i < state.lootOffer.length).slice(0, CONFIG.lootPick);
  for (const i of chosen) state.tray.push(newItem(state, state.lootOffer[i]));
  state.lootOffer = [];
  state.phase = 'arrange';
  return true;
}

function itemFrom(state, from) {
  if (from.where === 'tray') return state.tray[from.i] ?? null;
  return itemAt(state, from.c, from.r);
}

function setFrom(state, from, item) {
  if (from.where === 'tray') {
    if (item) state.tray[from.i] = item;
    else state.tray.splice(from.i, 1);
  } else {
    state.hoard[idx(from.c, from.r)] = item;
  }
}

// Verschieben, Tauschen oder Verschmelzen – je nachdem, was auf dem Zielfeld liegt
export function moveItem(state, from, c, r) {
  if (!DAY_PHASES.has(state.phase)) return { ok: false };
  const item = itemFrom(state, from);
  if (!item) return { ok: false };
  if (!isHoardCell(c, r)) return { ok: false, reason: 'Schätze können nur auf die Hortfelder.' };
  if (from.where === 'hoard' && from.c === c && from.r === r) return { ok: false, same: true };

  const target = state.hoard[idx(c, r)];
  const next = TREASURES[item.id].next;
  if (target && target.id === item.id && next) {
    setFrom(state, from, null);
    state.hoard[idx(c, r)] = newItem(state, next);
    if (TREASURES[next].tier === 3) state.runLog.landmark = true;
    state.fx.push({ type: 'merge', c, r, id: next });
    return { ok: true, kind: 'merge', id: next };
  }
  if (target) {
    if (from.where === 'tray' && target.id === 'ei') return { ok: false, reason: 'Das Ei bleibt im Hort.' };
    setFrom(state, from, target);
    state.hoard[idx(c, r)] = item;
    return { ok: true, kind: 'swap' };
  }
  setFrom(state, from, null);
  state.hoard[idx(c, r)] = item;
  return { ok: true, kind: 'move' };
}

export function discardItem(state, from) {
  if (!DAY_PHASES.has(state.phase)) return { ok: false };
  const item = itemFrom(state, from);
  if (!item) return { ok: false };
  if (item.id === 'ei') return { ok: false, reason: 'Das Ei wirfst du nicht weg.' };
  setFrom(state, from, null);
  return { ok: true, id: item.id };
}

// ── Nacht ───────────────────────────────────────────────────────

export function startNight(state) {
  if (state.phase !== 'arrange') return { ok: false };
  // Was noch auf dem Tablett liegt, legt der Drache auf freie Felder – ohne Platz geht es verloren
  const lost = [];
  for (const item of state.tray.splice(0)) if (!placeFirstFree(state, item)) lost.push(item.id);

  state.phase = 'night';
  state.t = 0;
  state.spawnIndex = 0;
  state.heroes = [];
  state.floor = [];
  state.digs = [];
  state.smoke = [];
  state.guardians = state.guardians.filter((g) => walkable(state, g.c, g.r));
  state.fallen = [];
  state.glutMax = CONFIG.glutBase + hoardItems(state).reduce((sum, { item }) => sum + (TREASURES[item.id].glut ?? 0), 0);
  state.glut = state.glutMax;
  state.glutTimer = 0;
  state.clawTimer = 0.5;
  state.nightLog = { defeated: [], escaped: 0, stolen: [], lostOnStart: lost };
  state.runLog.nights.push({ night: state.night, cards: 0, decoyEscapes: 0, stolen: 0 });
  state.runLog.maxHoard = Math.max(state.runLog.maxHoard, hoardItems(state).length);
  return { ok: true, lost };
}

const nightRecord = (state) => state.runLog.nights[state.runLog.nights.length - 1];

export function foesLeft(state) {
  return {
    active: activeHeroes(state).length,
    coming: state.party.length - state.spawnIndex + state.digs.length,
  };
}

export function update(state, dt) {
  if (state.phase !== 'night' || dt <= 0) return;
  const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
  for (let i = 0; i < steps && state.phase === 'night'; i++) step(state, dt / steps);
}

function step(state, dt) {
  state.t += dt;
  updateGlut(state, dt);
  updateSpawns(state);
  if (state.smoke.some((s) => s.until <= state.t)) {
    state.smoke = state.smoke.filter((s) => s.until > state.t);
    replanAll(state);
  }
  for (const { item } of hoardItems(state)) if (item.cd > 0) item.cd = Math.max(0, item.cd - dt);
  for (const h of state.heroes) {
    updateHero(state, h, dt);
    if (state.phase !== 'night') return;
  }
  updateClaw(state, dt);
  const done = state.spawnIndex >= state.party.length && !state.digs.length && !state.heroes.some(isActive);
  if (done) endNight(state);
}

function updateGlut(state, dt) {
  if (state.glut >= state.glutMax) {
    state.glutTimer = 0;
    return;
  }
  const rate = hoardItems(state).reduce((m, { item }) => Math.max(m, TREASURES[item.id].glutRate ?? 1), 1);
  state.glutTimer += dt * rate;
  const period = CONFIG.glutRegenSeconds + state.mods.glutRegenAdd;
  if (state.glutTimer >= period) {
    state.glutTimer -= period;
    state.glut += 1;
  }
}

export const glutPeriod = (state) => CONFIG.glutRegenSeconds + state.mods.glutRegenAdd;

function updateSpawns(state) {
  while (state.spawnIndex < state.party.length && state.party[state.spawnIndex].at <= state.t) {
    const entry = state.party[state.spawnIndex++];
    if (HEROES[entry.type].digger) startDig(state, entry);
    else spawnHero(state, entry, pick(state, ENTRANCES), false);
  }
  for (const dig of state.digs) {
    if (dig.at <= state.t) {
      dig.done = true;
      spawnHero(state, dig.entry, { c: dig.c, r: dig.r }, true);
    }
  }
  state.digs = state.digs.filter((d) => !d.done);
}

function startDig(state, entry) {
  const blockers = hoardItems(state).filter(({ item }) => TREASURES[item.id].blocksDig);
  const candidates = DIG_AREA.filter(({ c, r }) =>
    walkable(state, c, r)
    && !state.digs.some((d) => d.c === c && d.r === r)
    && !state.heroes.some((h) => isActive(h) && Math.floor(h.x) === c && Math.floor(h.y) === r)
    && !blockers.some((b) => Math.max(Math.abs(b.c - c), Math.abs(b.r - r)) <= TREASURES[b.item.id].blocksDig));
  if (!candidates.length) {
    spawnHero(state, entry, pick(state, ENTRANCES), false);
    return;
  }
  const { c, r } = pick(state, candidates);
  state.digs.push({ entry, c, r, at: state.t + CONFIG.digWarning, done: false });
  state.fx.push({ type: 'text', x: c + 0.5, y: r + 0.1, text: 'Es grollt im Boden …', tone: 'warn', cue: 'dig' });
}

function spawnHero(state, entry, tile, dug) {
  const def = HEROES[entry.type];
  const m = state.mods;
  const nemesis = entry.nemesis ? state.opts.nemeses.find((n) => n.id === entry.nemesis) : null;
  let hp = def.hp * (1 + CONFIG.heroHpGrowth * (state.night - 1)) * m.heroHp;
  let speed = def.speed * m.heroSpeed * (entry.type === 'dieb' ? m.thiefSpeed : 1);
  if (nemesis) {
    hp *= 1.6 + 0.3 * (nemesis.rank - 1);
    speed *= 1.05 ** nemesis.rank;
  }
  hp = Math.round(hp);
  see(state, 'heroesSeen', entry.type);
  state.heroes.push({
    uid: state.nextUid++,
    type: entry.type,
    x: tile.c + 0.5,
    y: tile.r + 0.5,
    hp,
    maxHp: hp,
    speed,
    strength: def.strength,
    grabTime: def.grab,
    fireproof: !!def.fireproof,
    caster: def.caster ?? null,
    clever: m.clever > 0 && random(state) < m.clever,
    state: 'seek',
    target: null,
    path: [],
    retarget: 0,
    grabT: 0,
    castT: 0,
    carry: null,
    stun: 0,
    hit: 0,
    hole: dug ? { c: tile.c, r: tile.r } : null,
    nemesis: nemesis?.id ?? null,
    name: nemesis?.name ?? null,
    rank: nemesis?.rank ?? 0,
    wears: nemesis?.treasure ?? null,
  });
  if (nemesis) state.fx.push({ type: 'text', x: tile.c + 0.5, y: tile.r - 0.2, text: `${nemesis.name} ist zurück!`, tone: 'bad', cue: 'nemesis' });
}

// ── Wege ────────────────────────────────────────────────────────

export function walkable(state, c, r) {
  const kind = kindAt(c, r);
  if (kind === '.' || kind === 'E') return true;
  return kind === 'H' && !state.hoard[idx(c, r)];
}

function bfs(state, c0, r0) {
  const dist = new Int16Array(COLS * ROWS).fill(-1);
  const prev = new Int16Array(COLS * ROWS).fill(-1);
  const start = idx(c0, r0);
  const queue = [start];
  dist[start] = 0;
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q];
    const c = cur % COLS;
    const r = (cur / COLS) | 0;
    for (const [dc, dr] of N4) {
      const nc = c + dc;
      const nr = r + dr;
      if (!inside(nc, nr)) continue;
      const ni = idx(nc, nr);
      if (dist[ni] !== -1 || !walkable(state, nc, nr)) continue;
      dist[ni] = dist[cur] + 1;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  return { dist, prev, start };
}

function buildPath(prev, start, goal) {
  const path = [];
  for (let i = goal; i !== start; i = prev[i]) path.push({ c: i % COLS, r: (i / COLS) | 0 });
  return path.reverse();
}

const tileOf = (h) => ({ c: Math.floor(h.x), r: Math.floor(h.y) });
const chebyshev = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));

// Kluge Helden (Legende) fallen nicht auf wertlosen Tand herein – das Ei durchschauen sie aber nicht
const ignores = (h, item) => h.clever && item.id !== 'ei' && TREASURES[item.id].value === 0;

// Die Glanz-Regel: Helden laufen zum glänzendsten Schatz, den sie erreichen und tragen können.
// Beim Mondsilberdrachen ist es umgekehrt. Magier müssen nur in Zauberweite kommen.
function chooseTarget(state, h) {
  const { c: hc, r: hr } = tileOf(h);
  const { dist, prev, start } = bfs(state, hc, hr);
  const inverse = ruleOf(state) === 'inverse';
  let best = null;
  const consider = (target, glanz, goal) => {
    const d = dist[goal];
    if (d < 0) return;
    const score = inverse ? -glanz : glanz;
    if (!best || score > best.score || (score === best.score && d < best.d)) best = { target, score, d, goal };
  };
  for (const { c, r, item } of hoardItems(state)) {
    if (effWeight(state, c, r) > h.strength || ignores(h, item)) continue;
    const glanz = effGlanz(state, c, r);
    const target = { kind: 'hoard', c, r, uid: item.uid };
    if (h.caster) {
      if (warded(state, c, r)) continue;
      const range = h.caster.range;
      let goal = -1;
      for (let y = r - range; y <= r + range; y++) {
        for (let x = c - range; x <= c + range; x++) {
          if (!inside(x, y) || !walkable(state, x, y)) continue;
          const i = idx(x, y);
          if (dist[i] >= 0 && (goal < 0 || dist[i] < dist[goal])) goal = i;
        }
      }
      if (goal >= 0) consider(target, glanz, goal);
    } else {
      for (const [dc, dr] of N4) {
        const nc = c + dc;
        const nr = r + dr;
        if (inside(nc, nr) && walkable(state, nc, nr)) consider(target, glanz, idx(nc, nr));
      }
    }
  }
  for (const f of state.floor) {
    if (TREASURES[f.item.id].weight <= h.strength && !ignores(h, f.item)) consider({ kind: 'floor', uid: f.item.uid, c: f.c, r: f.r }, floorGlanz(state, f), idx(f.c, f.r));
  }
  if (!best) return null;
  return { target: best.target, path: buildPath(prev, start, best.goal) };
}

function pathToExit(state, h) {
  const { c, r } = tileOf(h);
  const { dist, prev, start } = bfs(state, c, r);
  const exits = h.hole ? [h.hole] : ENTRANCES;
  let goal = -1;
  for (const e of exits) {
    const i = idx(e.c, e.r);
    if (dist[i] >= 0 && (goal < 0 || dist[i] < dist[goal])) goal = i;
  }
  return goal < 0 ? null : buildPath(prev, start, goal);
}

function moveAlong(h, speed, dt) {
  let budget = speed * dt;
  for (;;) {
    const next = h.path[0];
    const tx = next ? next.c + 0.5 : Math.floor(h.x) + 0.5;
    const ty = next ? next.r + 0.5 : Math.floor(h.y) + 0.5;
    const dx = tx - h.x;
    const dy = ty - h.y;
    const d = Math.hypot(dx, dy);
    if (d > budget) {
      h.x += (dx / d) * budget;
      h.y += (dy / d) * budget;
      return false;
    }
    h.x = tx;
    h.y = ty;
    budget -= d;
    if (!next) return true;
    h.path.shift();
  }
}

// ── Helden ──────────────────────────────────────────────────────

// Wirkung der Schätze und Knochenwächter rund um einen Helden; liefert den Tempo-Faktor
function applySurroundings(state, h, dt) {
  const { c, r } = tileOf(h);
  let slow = 1;
  let prick = 0;
  for (const n of neighborSources(state, c, r)) {
    const d = TREASURES[n.id];
    if (d.slows) slow = Math.min(slow, d.slows);
    if (d.pricks) prick += d.pricks;
    if (d.snare && !(n.cd > 0) && h.stun <= 0) {
      n.cd = d.snareCooldown;
      h.stun = d.snare;
      h.grabT = 0;
      h.castT = 0;
      state.fx.push({ type: 'snare', x: h.x, y: h.y });
    }
  }
  for (const g of state.guardians) if (Math.abs(g.c - c) + Math.abs(g.r - r) <= 1) prick += META.guardianDps;
  if (prick) damage(state, h, prick * dt, true);
  return slow;
}

function targetInReach(state, h) {
  const t = h.target;
  if (!t) return false;
  const { c, r } = tileOf(h);
  if (t.kind === 'hoard') {
    const item = itemAt(state, t.c, t.r);
    return !!item && item.uid === t.uid && effWeight(state, t.c, t.r) <= h.strength && Math.abs(c - t.c) + Math.abs(r - t.r) === 1;
  }
  const f = state.floor.find((x) => x.item.uid === t.uid);
  return !!f && f.c === c && f.r === r;
}

function castValid(state, h) {
  const t = h.target;
  if (!t || t.kind !== 'hoard') return false;
  const item = itemAt(state, t.c, t.r);
  return !!item && item.uid === t.uid && effWeight(state, t.c, t.r) <= h.strength && !warded(state, t.c, t.r) && chebyshev(tileOf(h), t) <= h.caster.range;
}

function updateHero(state, h, dt) {
  if (!isActive(h)) return;
  if (h.hit > 0) h.hit = Math.max(0, h.hit - dt);
  const slow = applySurroundings(state, h, dt);
  if (!isActive(h)) return;
  if (h.stun > 0) {
    h.stun = Math.max(0, h.stun - dt);
    h.grabT = 0;
    h.castT = 0;
    return;
  }
  const carrierSpeed = h.carry ? CONFIG.carrySpeed * (TREASURES[h.carry.id].carrierSpeed ?? 1) : 1;
  const speed = h.speed * slow * carrierSpeed;

  if (h.state === 'seek') {
    h.retarget -= dt;
    if (h.retarget <= 0 || !h.target) {
      h.retarget = 0.4;
      const choice = chooseTarget(state, h);
      if (!choice) {
        startLeave(state, h);
        return;
      }
      h.target = choice.target;
      h.path = choice.path;
    }
    if (moveAlong(h, speed, dt)) {
      if (h.caster && h.target.kind === 'hoard') {
        if (castValid(state, h)) {
          h.state = 'cast';
          h.castT = 0;
          state.fx.push({ type: 'text', x: h.x, y: h.y - 0.7, text: 'zaubert …', tone: 'info', cue: 'cast' });
        } else {
          h.retarget = 0;
        }
      } else if (targetInReach(state, h)) {
        h.state = 'grab';
        h.grabT = 0;
        biteIfMimic(state, h);
      } else {
        h.retarget = 0;
      }
    }
  } else if (h.state === 'grab') {
    if (!targetInReach(state, h)) {
      h.state = 'seek';
      h.retarget = 0;
      return;
    }
    h.grabT += dt;
    if (h.grabT >= h.grabTime) take(state, h);
  } else if (h.state === 'cast') {
    if (!castValid(state, h)) {
      h.state = 'seek';
      h.castT = 0;
      h.retarget = 0;
      return;
    }
    h.castT += dt;
    if (h.castT >= h.caster.time) {
      state.fx.push({ type: 'teleport', c: h.target.c, r: h.target.r, x: h.x, y: h.y });
      take(state, h);
    }
  } else if (moveAlong(h, speed, dt)) {
    arriveAtExit(state, h);
  }
}

function biteIfMimic(state, h) {
  const t = h.target;
  if (t.kind !== 'hoard') return;
  const item = itemAt(state, t.c, t.r);
  const d = TREASURES[item.id];
  if (!d.bite || item.cd > 0) return;
  item.cd = d.biteCooldown;
  state.fx.push({ type: 'mimik', c: t.c, r: t.r });
  damage(state, h, d.bite);
}

function take(state, h) {
  const t = h.target;
  let item = null;
  if (t.kind === 'hoard') {
    const chimes = neighborSources(state, t.c, t.r).reduce((sum, n) => sum + (TREASURES[n.id].chime ?? 0), 0);
    item = itemAt(state, t.c, t.r);
    state.hoard[idx(t.c, t.r)] = null;
    if (chimes && item) {
      state.glut = Math.min(state.glutMax, state.glut + chimes);
      state.fx.push({ type: 'text', x: t.c + 0.5, y: t.r, text: `+${chimes} Glut`, tone: 'warn', cue: 'chime' });
    }
  } else {
    const i = state.floor.findIndex((f) => f.item.uid === t.uid);
    if (i >= 0) item = state.floor.splice(i, 1)[0].item;
  }
  if (!item) {
    h.state = 'seek';
    h.retarget = 0;
    return;
  }
  h.carry = item;
  h.target = null;
  h.state = 'flee';
  h.path = pathToExit(state, h) ?? [];
  state.fx.push({ type: 'grab', x: h.x, y: h.y, id: item.id });
  replanAll(state);
}

function startLeave(state, h) {
  h.state = 'leave';
  h.target = null;
  h.path = pathToExit(state, h) ?? [];
}

function arriveAtExit(state, h) {
  const { c, r } = tileOf(h);
  const atExit = h.hole ? c === h.hole.c && r === h.hole.r : kindAt(c, r) === 'E';
  if (!atExit) {
    const path = pathToExit(state, h);
    if (path) h.path = path;
    else h.state = 'left';
    return;
  }
  if (!h.carry) {
    h.state = 'left';
    return;
  }
  const id = h.carry.id;
  const value = TREASURES[id].value;
  h.state = 'escaped';
  state.stats.escaped += 1;
  state.nightLog.escaped += 1;
  state.stats.stolen.push(id);
  state.nightLog.stolen.push(id);
  const record = nightRecord(state);
  if (value === 0 && id !== 'ei') record.decoyEscapes += 1;
  else record.stolen += 1;
  if (h.nemesis) state.runLog.nemesisEscaped.push(h.nemesis);
  else if (id !== 'ei' && value >= META.nemesisMinValue) state.runLog.newNemeses.push({ type: h.type, treasure: id });
  state.fx.push({ type: 'text', x: h.x, y: h.y - 0.6, text: `${TREASURES[id].name} gestohlen`, tone: 'bad', cue: 'stolen', id });
  if (id === 'ei') {
    state.phase = 'lost';
    state.lostBy = h.type;
  }
}

const replanAll = (state) => {
  for (const o of state.heroes) if (o.state === 'seek') o.retarget = 0;
};

function damage(state, h, amount, quiet = false) {
  if (!isActive(h)) return;
  h.hp -= amount;
  if (h.state === 'cast' && h.castT > 0) {
    h.castT = 0;
    if (!quiet) state.fx.push({ type: 'text', x: h.x, y: h.y - 0.8, text: 'Zauber gestört', tone: 'good', cue: 'fizzle' });
  }
  if (!quiet) {
    h.hit = 0.15;
    state.fx.push({ type: 'dmg', x: h.x, y: h.y - 0.45, text: String(Math.round(amount)) });
  }
  if (h.hp <= 0) kill(state, h);
}

function kill(state, h) {
  h.hp = 0;
  dropCarry(state, h);
  const { c, r } = tileOf(h);
  if (h.wears) {
    state.floor.push({ item: newItem(state, h.wears), c, r });
    state.runLog.nemesisDefeated.push(h.nemesis);
    state.fx.push({ type: 'text', x: h.x, y: h.y - 0.9, text: `${h.name} besiegt!`, tone: 'good', cue: 'nemesisDown' });
  }
  if (ruleOf(state) === 'guardians') state.fallen.push({ c, r });
  h.state = 'dead';
  state.stats.defeated += 1;
  state.nightLog.defeated.push(h.type);
  state.fx.push({ type: 'death', x: h.x, y: h.y, hero: h.type });
}

function dropCarry(state, h) {
  if (!h.carry) return;
  const { c, r } = tileOf(h);
  state.floor.push({ item: h.carry, c, r });
  state.fx.push({ type: 'text', x: h.x, y: h.y - 0.6, text: 'fallen gelassen', tone: 'good', cue: 'drop' });
  h.carry = null;
  replanAll(state);
}

// ── Drache ──────────────────────────────────────────────────────

export function distToDragon(x, y) {
  const c = Math.floor(x);
  const r = Math.floor(y);
  let best = Infinity;
  for (const d of DRAGON_CELLS) best = Math.min(best, Math.max(Math.abs(d.c - c), Math.abs(d.r - r)));
  return best;
}

function updateClaw(state, dt) {
  state.clawTimer -= dt;
  if (state.clawTimer > 0) return;
  let best = null;
  let bestScore = Infinity;
  for (const h of state.heroes) {
    if (!isActive(h)) continue;
    const d = distToDragon(h.x, h.y);
    if (d > CONFIG.claw.range) continue;
    const score = d - (h.carry ? 10 : 0);
    if (score < bestScore) {
      best = h;
      bestScore = score;
    }
  }
  if (!best) {
    state.clawTimer = 0.1;
    return;
  }
  state.clawTimer = CONFIG.claw.interval;
  state.fx.push({ type: 'claw', x: best.x, y: best.y });
  damage(state, best, CONFIG.claw.damage * power(state));
}

function spend(state, card) {
  state.glut -= card.cost;
  nightRecord(state).cards += 1;
}

function interrupt(h) {
  h.path = [];
  h.grabT = 0;
  h.castT = 0;
  if (h.state === 'grab' || h.state === 'cast') {
    h.state = 'seek';
    h.retarget = 0;
  }
}

export function playCard(state, cardId, target = null) {
  const card = CARD_BY_ID[cardId];
  if (state.phase !== 'night' || !card) return { ok: false, reason: '' };
  if (!state.opts.cards.includes(cardId)) return { ok: false, reason: 'Diese Karte hast du nicht dabei.' };
  if (state.glut < card.cost) return { ok: false, reason: 'Zu wenig Glut.' };
  const pw = power(state);

  if (card.id === 'feuer') {
    if (!target || target.c == null) return { ok: false, reason: 'Wähle ein Feld für den Feueratem.' };
    spend(state, card);
    state.fx.push({ type: 'fire', c: target.c, r: target.r });
    for (const h of activeHeroes(state)) {
      if (Math.abs(h.x - (target.c + 0.5)) > 1.5 || Math.abs(h.y - (target.r + 0.5)) > 1.5) continue;
      if (h.fireproof) state.fx.push({ type: 'text', x: h.x, y: h.y - 0.6, text: 'feuerfest', tone: 'info', cue: 'fireproof' });
      else damage(state, h, card.damage * pw);
    }
    return { ok: true };
  }

  if (card.id === 'schnapp') {
    const h = state.heroes.find((x) => x.uid === target?.uid && isActive(x));
    if (!h) return { ok: false, reason: 'Tippe direkt auf einen Helden.' };
    if (distToDragon(h.x, h.y) > card.range) return { ok: false, reason: 'So weit reicht dein Maul nicht.' };
    spend(state, card);
    state.fx.push({ type: 'bite', x: h.x, y: h.y });
    dropCarry(state, h);
    damage(state, h, card.damage * pw);
    if (isActive(h)) {
      interrupt(h);
      h.state = 'seek';
      h.target = null;
      h.retarget = 0;
    }
    return { ok: true };
  }

  if (card.id === 'fluegel') {
    spend(state, card);
    state.fx.push({ type: 'wing' });
    for (const h of activeHeroes(state)) {
      const dx = h.x - DRAGON_CENTER.x;
      const dy = h.y - DRAGON_CENTER.y;
      const d = Math.hypot(dx, dy);
      if (d > card.range) continue;
      dropCarry(state, h);
      push(state, h, dx / (d || 1), dy / (d || 1), card.push);
      h.stun = Math.max(h.stun, card.stun);
      interrupt(h);
      if (h.state !== 'leave') {
        h.state = 'seek';
        h.target = null;
        h.retarget = 0;
      }
    }
    return { ok: true };
  }

  if (card.id === 'bruellen') {
    spend(state, card);
    state.fx.push({ type: 'roar' });
    for (const h of activeHeroes(state)) {
      h.stun = Math.max(h.stun, card.stun);
      interrupt(h);
    }
    return { ok: true };
  }

  if (card.id === 'rauch') {
    if (!target || target.c == null) return { ok: false, reason: 'Wähle ein Feld für die Rauchwolke.' };
    spend(state, card);
    state.smoke.push({ c: target.c, r: target.r, until: state.t + card.duration });
    state.fx.push({ type: 'smoke', c: target.c, r: target.r });
    replanAll(state);
    return { ok: true };
  }

  if (card.id === 'schwanz') {
    spend(state, card);
    state.fx.push({ type: 'tail' });
    for (const h of activeHeroes(state)) {
      if (distToDragon(h.x, h.y) > card.range) continue;
      const dx = h.x - DRAGON_CENTER.x;
      const dy = h.y - DRAGON_CENTER.y;
      const d = Math.hypot(dx, dy) || 1;
      push(state, h, dx / d, dy / d, card.push);
      damage(state, h, card.damage * pw);
      if (isActive(h)) interrupt(h);
    }
    return { ok: true };
  }

  if (card.id === 'glutregen') {
    spend(state, card);
    state.fx.push({ type: 'rain' });
    for (const h of activeHeroes(state)) {
      if (h.fireproof) state.fx.push({ type: 'text', x: h.x, y: h.y - 0.6, text: 'feuerfest', tone: 'info', cue: 'fireproof' });
      else damage(state, h, card.damage * pw);
    }
    return { ok: true };
  }
  return { ok: false, reason: '' };
}

function push(state, h, ux, uy, distance) {
  const stepLen = 0.1;
  for (let s = 0; s < distance; s += stepLen) {
    const nx = h.x + ux * stepLen;
    const ny = h.y + uy * stepLen;
    if (!walkable(state, Math.floor(nx), Math.floor(ny))) break;
    h.x = nx;
    h.y = ny;
  }
}

// ── Morgen ──────────────────────────────────────────────────────

function endNight(state) {
  // Was auf dem Boden liegt, sammelt der Drache am Morgen wieder ein
  for (const f of state.floor) if (!placeNear(state, f.item, f.c, f.r)) state.tray.push(f.item);
  state.floor = [];
  state.smoke = [];

  const drops = [];
  for (const type of state.nightLog.defeated) {
    const def = HEROES[type];
    if (def.loot && random(state) < def.lootChance * state.mods.lootChance) drops.push(def.loot);
  }
  state.morningLoot = shuffle(state, drops).slice(0, CONFIG.morningLootMax);
  for (const id of state.morningLoot) see(state, 'treasuresSeen', id);

  // Knochendrache: Wer heute fiel, steht morgen Nacht als Wächter wieder auf
  if (ruleOf(state) === 'guardians') {
    const seen = new Set();
    state.guardians = state.fallen.slice().reverse().filter((g) => {
      const key = `${g.c},${g.r}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, META.guardianMax);
  }
  state.fallen = [];

  state.stats.nightsSurvived += 1;
  state.lastNight = {
    night: state.night,
    defeated: state.nightLog.defeated.length,
    escaped: state.nightLog.escaped,
    stolen: state.nightLog.stolen.slice(),
    lostOnStart: state.nightLog.lostOnStart.slice(),
  };
  state.heroes = [];
  state.digs = [];
  state.party = [];
  if (state.nights && state.night >= state.nights) {
    state.phase = 'won';
    state.species = computeHatch(state);
  } else {
    state.phase = 'morning';
  }
}

export function takeMorningLoot(state, indices) {
  if (state.phase !== 'morning') return false;
  for (const i of new Set(indices)) if (state.morningLoot[i]) state.tray.push(newItem(state, state.morningLoot[i]));
  state.morningLoot = [];
  state.night += 1;
  state.raid = null;
  state.phase = 'raid';
  return true;
}

// Welche Drachenart schlüpft: zuerst die geheime Regel, dann zählen die acht Felder rund um das Ei
export function computeHatch(state) {
  const egg = hoardItems(state).find(({ item }) => item.id === 'ei');
  if (!egg) return 'gold';
  const fakes = plainNeighbors(state, egg.c, egg.r).filter((n) => TREASURES[n.id].family === 'tand' && TREASURES[n.id].value === 0).length;
  if (fakes >= 2) return 'mond';
  const count = {};
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const item = (dc || dr) ? itemAt(state, egg.c + dc, egg.r + dr) : null;
      if (item) count[TREASURES[item.id].family] = (count[TREASURES[item.id].family] ?? 0) + 1;
    }
  }
  let best = null;
  for (const family of HATCH_PRIORITY) if ((count[family] ?? 0) >= HATCH_MIN && (!best || count[family] > count[best])) best = family;
  if (!best) return 'gold';
  return SPECIES_ORDER.find((id) => SPECIES[id].family === best) ?? 'gold';
}
