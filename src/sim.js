// Spiellogik von Hort, ganz ohne Grafik.
// Ein Tag: Graben (die Kobolde graben ein Stollenstück, die Hortkammer zieht tiefer) → Bauen (Baupläne aus dem Deck)
// → Nacht (Helden wollen Schätze, Türme und Fallen wehren sich, der Drache greift ein) → Morgen (Gold, Beute, Stufen).
// Alle Zufälle laufen über den Seed im Zustand, deshalb lässt sich jeder Run als Hort-Code nachspielen.
// Was zwischen den Runs passiert (Glut, Freischaltungen, Taten, Erzfeinde), steht in meta.js – hier wird nur mitprotokolliert.

import {
  TREASURES, FINDS, LAYERS, DAMAGE, HEROES, BOSS, ENTRANCES, PIECES, BUILDINGS, BASE_DECK, DECK_SIZE, GEAR,
  DRAGON, ABILITY_BY_ID, SPECIES, HATCH, LEGEND, UNLOCKS, META, CONFIG,
} from './data.js';
import {
  COLS, ROWS, N4, DIRS, OPP, DIR_ORDER, idx, inside, insideChunk, edgeTile, centerTile, chunkTiles,
  START_CHUNK, MOUTH, BUILDABLE, tileAt, walkableAt, newTiles,
} from './map.js';
import { random, pick, pickWeighted, shuffle, randomSeed } from './rng.js';

const VERSION = 3;
export const DAY_PHASES = new Set(['dig', 'build']);
const ACTIVE = new Set(['seek', 'grab', 'cast', 'flee', 'leave']);
export const isActive = (h) => ACTIVE.has(h.state);
export const activeHeroes = (state) => state.heroes.filter(isActive);

// ── Run ─────────────────────────────────────────────────────────

const MULTIPLY = ['spawnInterval', 'thiefSpeed', 'heroHp', 'lootChance', 'heroSpeed', 'cooldown'];
const ADD = ['extraHeroes', 'extraNight'];

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

export function buildingAvailable(id, unlocks) {
  const def = BUILDINGS[id];
  return !!def && (!def.unlock || unlocks.includes(def.unlock));
}

function normalizeOptions(options) {
  const unlocks = Array.isArray(options.unlocks) ? options.unlocks.filter((id) => UNLOCKS[id]) : [];
  let deck = (Array.isArray(options.deck) ? options.deck : BASE_DECK)
    .filter((id, i, list) => buildingAvailable(id, unlocks) && list.indexOf(id) === i)
    .slice(0, DECK_SIZE);
  if (deck.length < 4) deck = BASE_DECK.slice();
  const nemeses = (Array.isArray(options.nemeses) ? options.nemeses : [])
    .filter((n) => n && HEROES[n.type] && (n.treasure == null || TREASURES[n.treasure]))
    .map((n) => ({
      id: String(n.id),
      name: String(n.name),
      type: n.type,
      treasure: n.treasure ?? null,
      glut: Math.max(0, Math.floor(n.glut) || 0),
      rank: Math.max(1, Math.min(META.nemesisMaxRank, Math.floor(n.rank) || 1)),
    }));
  return {
    species: SPECIES[options.species] ? options.species : 'gold',
    variant: Number.isInteger(options.variant) ? options.variant : 0,
    legend: Math.max(0, Math.min(LEGEND.length, Math.floor(options.legend ?? 0))),
    deck,
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
    night: 1,
    phase: 'dig',
    tiles: newTiles(),
    pieces: [],
    chamber: null,
    layout: 0, // zählt mit, wenn sich die Höhle verändert (für die Grafik)
    entrances: [{ id: 'mund', kind: 'mund', c: MOUTH.c, r: MOUTH.r, night: 1 }],
    offers: [],
    gold: CONFIG.startGold,
    glut: 0,
    hoard: [],
    floor: [],
    buildings: [],
    stash: [],
    deck: { draw: [], hand: [], discard: [] },
    redrawn: false,
    heroes: [],
    party: [],
    spawnIndex: 0,
    pending: [],
    guardians: [],
    fallen: [],
    dragon: { cd: { feuer: 0, fluegel: 0, bruellen: 0 }, claw: 0 },
    nextUid: 1,
    t: 0,
    nightLog: null,
    lastNight: null,
    stats: { defeated: 0, escaped: 0, stolen: [], nightsSurvived: 0 },
    runLog: {
      nights: [], keystone: false, maxDepth: 0, nemesisDefeated: [], nemesisEscaped: [], newNemeses: [],
      heroesSeen: [], treasuresSeen: [], gearSeen: [], buildingsSeen: [], siegfried: null,
    },
    nemesesWaiting: opts.nemeses.filter((n) => n.type !== 'siegfried').map((n) => n.id),
    species: null,
    lostBy: null,
    lostNemesis: null,
    fx: [],
  };
  // Der Startstollen: ein Gang vom Höhlenmund nach unten, darunter die Hortkammer
  const start = { piece: 'gang', features: [], find: null, entrance: null, key: 0 };
  writePiece(state, START_CHUNK.cx, START_CHUNK.cy, 'N', 'S', pieceLayout(state, start, START_CHUNK.cx, START_CHUNK.cy, 'N', 'S'), start);
  setChamber(state, START_CHUNK.cx, START_CHUNK.cy + 1, 'N');
  for (const id of SPECIES[opts.species].start) state.hoard.push(newItem(state, id));
  state.deck.draw = shuffle(state, opts.deck);
  state.offers = makeOffers(state);
  return state;
}

function see(state, list, id) {
  if (!state.runLog[list].includes(id)) state.runLog[list].push(id);
}

function newItem(state, id) {
  if (TREASURES[id].family !== 'tand') see(state, 'treasuresSeen', id);
  return { uid: state.nextUid++, id };
}

export const isEndless = (state) => state.nights === 0;
export const ruleOf = (state) => SPECIES[state.opts.species].rule;
export const unlocked = (state, id) => state.opts.unlocks.includes(id);

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

// ── Die Höhle ───────────────────────────────────────────────────

export const chamberCenter = (state) => centerTile(state.chamber.cx, state.chamber.cy);
export const veinCount = (state) => state.tiles.filter((t) => t === 'v').length;
export const incomeOf = (state) => CONFIG.goldBase + veinCount(state) * CONFIG.goldPerVein;

const chunkUsed = (state, cx, cy) => state.pieces.some((p) => p.cx === cx && p.cy === cy) || (state.chamber && state.chamber.cx === cx && state.chamber.cy === cy);

function setChamber(state, cx, cy, entry) {
  state.chamber = { cx, cy, entry };
  for (const { c, r } of chunkTiles(cx, cy)) state.tiles[idx(c, r)] = 'h';
}

// Kleiner Zufall nur aus Zahlen: dieselbe Vorschau wie hinterher im Spiel, ohne den Seed zu verbrauchen
function hashRand(...parts) {
  let h = 2166136261;
  for (const p of parts) h = Math.imul(h ^ (Number(p) | 0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Wo im Abschnitt Gang, Nischen und Besonderheiten liegen
export function pieceLayout(state, offer, cx, cy, entry, exit) {
  const path = [edgeTile(cx, cy, entry), centerTile(cx, cy), edgeTile(cx, cy, exit)];
  const onPath = (t) => path.some((p) => p.c === t.c && p.r === t.r);
  const niches = chunkTiles(cx, cy).filter((t) => !onPath(t));
  const rand = hashRand(state.seed, state.night, offer.key ?? 0, cx, cy, DIR_ORDER.indexOf(exit));
  const free = niches.map((t) => ({ t, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.t);
  const features = [];
  const take = (t) => {
    free.splice(free.indexOf(t), 1);
    return t;
  };
  if (offer.entrance) {
    // Der Durchbruch liegt direkt am Gang, am liebsten zur Außenseite des Abschnitts hin
    const nextToPath = free.filter((t) => N4.some(([dx, dy]) => onPath({ c: t.c + dx, r: t.r + dy })));
    const outer = nextToPath.filter((t) => N4.some(([dx, dy]) => {
      const c = t.c + dx;
      const r = t.r + dy;
      return !chunkTiles(cx, cy).some((x) => x.c === c && x.r === r) && tileAt(state.tiles, c, r) === '#';
    }));
    const spot = outer[0] ?? nextToPath[0];
    if (spot) features.push({ kind: 'entrance', ...take(spot) });
  }
  for (const kind of offer.features) {
    const t = free[0];
    if (t) features.push({ kind, ...take(t) });
  }
  return { path, niches, features };
}

const FEATURE_TILE = { vein: 'v', ledge: 'l', entrance: 'e' };

function writePiece(state, cx, cy, entry, exit, layout, offer) {
  for (const t of layout.niches) state.tiles[idx(t.c, t.r)] = 'n';
  for (const t of layout.path) state.tiles[idx(t.c, t.r)] = '.';
  for (const f of layout.features) state.tiles[idx(f.c, f.r)] = FEATURE_TILE[f.kind];
  state.pieces.push({ cx, cy, entry, exit, piece: offer.piece, day: state.night });
  state.layout += 1;
}

// In welche Richtungen die Hortkammer weiterziehen kann. Sackgassen nur, wenn es nichts anderes gibt.
export function digDirections(state) {
  const { cx, cy, entry } = state.chamber;
  const out = [];
  for (const dir of DIR_ORDER) {
    if (dir === entry) continue;
    const [dx, dy] = DIRS[dir];
    const nx = cx + dx;
    const ny = cy + dy;
    if (!insideChunk(nx, ny) || chunkUsed(state, nx, ny)) continue;
    const onward = DIR_ORDER.some((d2) => {
      const [ex, ey] = DIRS[d2];
      const qx = nx + ex;
      const qy = ny + ey;
      return insideChunk(qx, qy) && !chunkUsed(state, qx, qy) && !(qx === cx && qy === cy);
    });
    out.push({ dir, cx: nx, cy: ny, dead: !onward });
  }
  const alive = out.filter((o) => !o.dead);
  return alive.length ? alive : out;
}

function makeOffers(state) {
  if (!digDirections(state).length) return [];
  const depth = state.chamber.cy;
  const opened = new Set(state.entrances.map((e) => e.kind));
  const pool = Object.entries(PIECES)
    .filter(([, p]) => (p.weights[depth] ?? 0) > 0 && (!p.minDay || state.night >= p.minDay) && (!p.entrance || !opened.has(p.entrance)))
    .map(([id, p]) => [id, p.weights[depth]]);
  const chosen = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const id = pickWeighted(state, pool);
    chosen.push(id);
    pool.splice(pool.findIndex(([x]) => x === id), 1);
    // Höchstens ein Durchbruch am Tag
    if (PIECES[id].entrance) for (let k = pool.length - 1; k >= 0; k--) if (PIECES[pool[k][0]].entrance) pool.splice(k, 1);
  }
  // Mindestens ein Stück ohne Durchbruch
  if (chosen.length && chosen.every((id) => PIECES[id].entrance)) chosen[0] = 'gang';
  return chosen.map((id, i) => {
    const p = PIECES[id];
    const find = p.find === true ? pickWeighted(state, FINDS[Math.min(depth, FINDS.length - 1)]) : p.find ?? null;
    return { key: i + 1, piece: id, features: p.features.slice(), find, entrance: p.entrance ?? null, depth };
  });
}

export function dig(state, offerIndex, dir) {
  if (state.phase !== 'dig') return { ok: false };
  const offer = state.offers[offerIndex];
  const option = digDirections(state).find((o) => o.dir === dir);
  if (!offer || !option) return { ok: false, reason: 'Dort können die Kobolde nicht graben.' };
  const { cx, cy, entry } = state.chamber;
  const layout = pieceLayout(state, offer, cx, cy, entry, dir);
  writePiece(state, cx, cy, entry, dir, layout, offer);
  setChamber(state, option.cx, option.cy, OPP[dir]);
  const center = chamberCenter(state);
  state.fx.push({ type: 'dig', cx, cy, to: { cx: option.cx, cy: option.cy } });
  if (offer.find) {
    state.hoard.push(newItem(state, offer.find));
    state.fx.push({ type: 'text', x: center.c + 0.5, y: center.r - 0.2, text: `Gefunden: ${TREASURES[offer.find].name}`, tone: 'warn', cue: 'merge' });
  }
  if (offer.entrance) {
    const spot = layout.features.find((f) => f.kind === 'entrance');
    if (spot) {
      state.entrances.push({ id: offer.entrance, kind: offer.entrance, c: spot.c, r: spot.r, night: state.night });
      state.fx.push({ type: 'text', x: spot.c + 0.5, y: spot.r - 0.2, text: `Durchbruch: ${ENTRANCES[offer.entrance].name}`, tone: 'bad', cue: 'dig' });
    }
  }
  state.runLog.maxDepth = Math.max(state.runLog.maxDepth, option.cy, cy);
  state.offers = [];
  beginBuild(state);
  return { ok: true };
}

// Wenn der Berg voll ist, geht der Tag ohne Graben weiter
export function skipDig(state) {
  if (state.phase !== 'dig' || state.offers.length) return { ok: false };
  beginBuild(state);
  return { ok: true };
}

// ── Hort ────────────────────────────────────────────────────────

export const hoardValue = (state) => state.hoard.reduce((sum, item) => sum + TREASURES[item.id].value, 0);
export const power = (state) => 1 + hoardValue(state) * DRAGON.powerPerValue;

const lureDef = (b) => BUILDINGS[b.id].lure;
export function lureGlanz(state, b) {
  return lureDef(b).glanz + (ruleOf(state) === 'moon' ? 3 : 0);
}

// Der Schatz, den ein Held mit dieser Stärke als Erstes holen würde
export function wantedTreasure(state, strength = 1) {
  let best = null;
  for (const item of state.hoard) {
    const d = TREASURES[item.id];
    if (d.weight > strength) continue;
    if (!best || d.glanz > TREASURES[best.id].glanz) best = item;
  }
  return best;
}

// ── Bauen ───────────────────────────────────────────────────────

function beginBuild(state) {
  state.phase = 'build';
  state.redrawn = false;
  drawHand(state);
  state.party = makeParty(state);
}

function drawHand(state) {
  const d = state.deck;
  d.discard.push(...d.hand);
  d.hand = [];
  while (d.hand.length < CONFIG.handSize) {
    if (!d.draw.length) {
      if (!d.discard.length) break;
      d.draw = shuffle(state, d.discard);
      d.discard = [];
    }
    d.hand.push(d.draw.shift());
  }
}

export function redraw(state) {
  if (state.phase !== 'build') return { ok: false };
  if (state.redrawn) return { ok: false, reason: 'Heute hast du schon neu gezogen.' };
  if (state.gold < CONFIG.redrawCost) return { ok: false, reason: 'Zu wenig Gold.' };
  state.gold -= CONFIG.redrawCost;
  state.redrawn = true;
  drawHand(state);
  return { ok: true };
}

export const buildingAt = (state, c, r) => state.buildings.find((b) => b.c === c && b.r === r) ?? null;
export const buildingByUid = (state, uid) => state.buildings.find((b) => b.uid === uid) ?? null;

export function canPlace(state, id, c, r) {
  const def = BUILDINGS[id];
  if (!def || !inside(c, r)) return { ok: false, reason: '' };
  const t = tileAt(state.tiles, c, r);
  if (buildingAt(state, c, r)) return { ok: false, reason: 'Dort steht schon etwas.' };
  if (def.kind === 'trap') return t === '.' ? { ok: true } : { ok: false, reason: 'Fallen gehören in den Gang.' };
  if (!BUILDABLE.has(t)) return { ok: false, reason: def.kind === 'lure' ? 'Köder gehören in eine Nische direkt am Gang.' : 'Türme stehen in den Nischen neben dem Gang.' };
  if (def.kind === 'lure' && !N4.some(([dx, dy]) => walkableAt(state.tiles, c + dx, r + dy))) return { ok: false, reason: 'Hier kommen die Helden nicht heran. Köder brauchen eine Nische direkt am Gang.' };
  return { ok: true };
}

function newBuilding(state, id, c, r) {
  const def = BUILDINGS[id];
  const b = { uid: state.nextUid++, id, kind: def.kind, c, r, cd: 0 };
  if (def.kind === 'tower') Object.assign(b, { xp: 0, level: 0, nodes: ['R'], gear: [], attacks: 0, disabled: 0, kills: 0, dealt: 0 });
  if (def.kind === 'trap') Object.assign(b, { burning: 0 });
  if (def.kind === 'lure') Object.assign(b, { charges: lureCharges(state, b.id) });
  return b;
}

const lureCharges = (state, id) => (BUILDINGS[id].lure.charges ?? 0) + (ruleOf(state) === 'moon' && BUILDINGS[id].lure.charges ? 1 : 0);

export function playCard(state, handIndex, c, r) {
  if (state.phase !== 'build') return { ok: false, reason: '' };
  const id = state.deck.hand[handIndex];
  if (!id) return { ok: false, reason: '' };
  const def = BUILDINGS[id];
  if (state.gold < def.cost) return { ok: false, reason: 'Zu wenig Gold.' };
  const check = canPlace(state, id, c, r);
  if (!check.ok) return check;
  state.gold -= def.cost;
  state.deck.hand.splice(handIndex, 1);
  state.deck.discard.push(id);
  const b = newBuilding(state, id, c, r);
  state.buildings.push(b);
  if (b.kind === 'tower') b.stats = towerStats(state, b);
  see(state, 'buildingsSeen', id);
  state.fx.push({ type: 'build', c, r, id });
  return { ok: true, uid: b.uid };
}

export function sellBuilding(state, uid) {
  if (!DAY_PHASES.has(state.phase)) return { ok: false };
  const b = buildingByUid(state, uid);
  if (!b) return { ok: false };
  const refund = Math.floor(BUILDINGS[b.id].cost * CONFIG.sellBack);
  state.gold += refund;
  if (b.kind === 'tower') state.stash.push(...b.gear);
  state.buildings = state.buildings.filter((x) => x !== b);
  state.fx.push({ type: 'sell', c: b.c, r: b.r });
  return { ok: true, refund };
}

// ── Türme: Werte, Baum, Ausrüstung ──────────────────────────────

export const pointsLeft = (b) => (b.kind === 'tower' ? b.level - (b.nodes.length - 1) : 0);
export const xpForLevel = (level) => CONFIG.levels[level] ?? null;

export function towerStats(state, b) {
  const def = BUILDINGS[b.id];
  const base = def.tower;
  const s = {
    type: base.type,
    dmg: base.dmg,
    interval: base.interval,
    range: base.range,
    splash: base.splash ?? 0,
    aura: !!base.aura,
    burn: base.burn ? base.burn.slice() : null,
    curse: base.curse ? base.curse.slice() : null,
    crit: 0,
    multi: 1,
    chain: 0,
    pierce: 0,
    stun: null,
    rubble: null,
    slowAura: 1,
    vs: { segen: 1, ruestung: 1, leben: 1 },
    push: 0,
    shred: 0,
    shredPct: 0,
    bolt: null,
    spread: false,
    scorch: 0,
    bind: false,
    sockets: 1,
  };
  let dmgPct = 0;
  let ratePct = 0;
  let burnPct = 0;
  let curseTimeMult = 1;
  const apply = (m) => {
    if (!m) return;
    if (m.dmg) dmgPct += m.dmg;
    if (m.rate) ratePct += m.rate;
    if (m.range) s.range += m.range;
    if (m.crit) s.crit += m.crit;
    if (m.splash) s.splash += m.splash;
    if (m.stun) s.stun = s.stun ? [Math.max(s.stun[0], m.stun[0]), Math.max(s.stun[1], m.stun[1])] : m.stun.slice();
    if (m.multi) s.multi = Math.max(s.multi, m.multi);
    if (m.chain) s.chain += m.chain;
    if (m.pierce) s.pierce += m.pierce;
    if (m.rubble) s.rubble = m.rubble.slice();
    if (m.slowAura) s.slowAura = Math.min(s.slowAura, m.slowAura);
    if (m.vs) for (const [k, v] of Object.entries(m.vs)) s.vs[k] *= v;
    if (m.push) s.push += m.push;
    if (m.shred) s.shred += m.shred;
    if (m.shredPct) s.shredPct = Math.max(s.shredPct, m.shredPct);
    if (m.bolt) s.bolt = m.bolt.slice();
    if (m.spread) s.spread = true;
    if (m.scorch) s.scorch += m.scorch;
    if (m.bind) s.bind = true;
    if (m.sockets) s.sockets += m.sockets;
    if (m.burnTime && s.burn) s.burn[1] += m.burnTime;
    if (m.burnDmg) burnPct += m.burnDmg;
    if (m.curseAmp && s.curse) s.curse[0] += m.curseAmp;
    if (m.curseTime && s.curse) s.curse[1] += m.curseTime;
    if (m.curseTimeMult) curseTimeMult *= m.curseTimeMult;
  };
  for (const id of b.nodes) apply(def.tree.nodes[id]?.mod);
  for (const g of b.gear) apply(GEAR[g]?.mod);
  if (tileAt(state.tiles, b.c, b.r) === 'l') {
    s.range += CONFIG.ledge.range;
    dmgPct += CONFIG.ledge.dmg;
  }
  dmgPct += CONFIG.levelDamage * b.level;
  const mult = Math.max(0, 1 + dmgPct);
  s.dmg = s.bind ? 0 : s.dmg * mult;
  if (s.burn) s.burn[0] *= mult * (1 + burnPct);
  s.interval /= Math.max(0.25, 1 + ratePct);
  if (s.curse) s.curse[1] *= curseTimeMult;
  s.range = Math.max(1, s.range);
  return s;
}

function refreshStats(state, b) {
  if (b.kind === 'tower') b.stats = towerStats(state, b);
}

// Zustand eines Knotens im Baum: 'taken' | 'open' (lernbar) | 'blocked' (nicht erreichbar) | 'locked' (nicht freigeschaltet)
export function nodeState(state, b, nodeId) {
  const tree = BUILDINGS[b.id].tree;
  const node = tree.nodes[nodeId];
  if (b.nodes.includes(nodeId)) return 'taken';
  if (node.unlock && !unlocked(state, node.unlock)) return 'locked';
  const near = tree.links.some(([a, z]) => (a === nodeId && b.nodes.includes(z)) || (z === nodeId && b.nodes.includes(a)));
  return near ? 'open' : 'blocked';
}

export function learnNode(state, uid, nodeId) {
  if (!DAY_PHASES.has(state.phase)) return { ok: false, reason: 'Lernen geht nur am Tag.' };
  const b = buildingByUid(state, uid);
  if (!b || b.kind !== 'tower' || !BUILDINGS[b.id].tree.nodes[nodeId]) return { ok: false, reason: '' };
  const st = nodeState(state, b, nodeId);
  if (st === 'taken') return { ok: false, reason: '' };
  if (st === 'locked') return { ok: false, reason: 'Dieser Schlussstein ist noch nicht freigeschaltet – das geht in der Werkstatt.' };
  if (st === 'blocked') return { ok: false, reason: 'Lerne erst einen Knoten daneben.' };
  if (pointsLeft(b) <= 0) return { ok: false, reason: 'Keine Punkte frei. Der Turm sammelt in der Nacht Erfahrung.' };
  b.nodes.push(nodeId);
  if (BUILDINGS[b.id].tree.nodes[nodeId].kind === 'keystone') state.runLog.keystone = true;
  refreshStats(state, b);
  state.fx.push({ type: 'learn', c: b.c, r: b.r });
  return { ok: true };
}

export function respec(state, uid) {
  if (!DAY_PHASES.has(state.phase)) return { ok: false };
  const b = buildingByUid(state, uid);
  if (!b || b.kind !== 'tower' || b.nodes.length <= 1) return { ok: false, reason: '' };
  if (state.gold < CONFIG.respecCost) return { ok: false, reason: 'Zu wenig Gold.' };
  state.gold -= CONFIG.respecCost;
  b.nodes = ['R'];
  refreshStats(state, b);
  while (b.gear.length > b.stats.sockets) state.stash.push(b.gear.pop());
  return { ok: true };
}

export function socketGear(state, uid, stashIndex) {
  if (!DAY_PHASES.has(state.phase)) return { ok: false };
  const b = buildingByUid(state, uid);
  const gear = state.stash[stashIndex];
  if (!b || b.kind !== 'tower' || !gear) return { ok: false, reason: '' };
  if (b.gear.length >= b.stats.sockets) return { ok: false, reason: 'Alle Fassungen sind belegt. Nimm erst etwas heraus.' };
  state.stash.splice(stashIndex, 1);
  b.gear.push(gear);
  refreshStats(state, b);
  state.fx.push({ type: 'socket', c: b.c, r: b.r, id: gear });
  return { ok: true };
}

export function unsocketGear(state, uid, slot) {
  if (!DAY_PHASES.has(state.phase)) return { ok: false };
  const b = buildingByUid(state, uid);
  if (!b || b.kind !== 'tower' || !b.gear[slot]) return { ok: false };
  state.stash.push(b.gear.splice(slot, 1)[0]);
  refreshStats(state, b);
  return { ok: true };
}

// ── Raben: wer heute Nacht kommt ────────────────────────────────

export const isBossNight = (state) => (state.nights ? state.night === state.nights : state.night % CONFIG.bossEvery === 0);

function makeParty(state) {
  const m = state.mods;
  const interval = CONFIG.spawnInterval * m.spawnInterval;
  const boss = isBossNight(state);
  const party = [];
  state.entrances.forEach((e, k) => {
    const def = ENTRANCES[e.kind];
    let count = Math.round(def.base + def.growth * (state.night - e.night)) + m.extraHeroes;
    if (boss && e.kind === 'mund') count = Math.max(2, Math.round(count * 0.6));
    const [[mainType, share], other] = def.party;
    const main = other ? Math.min(count, Math.max(1, Math.round(count * share))) : count;
    const types = shuffle(state, [...Array(main).fill(mainType), ...Array(count - main).fill(other?.[0] ?? mainType)]);
    const t0 = 1 + k * (interval / Math.max(1, state.entrances.length)) + random(state) * 0.6;
    types.forEach((type, i) => party.push({ type, at: t0 + i * interval + random(state) * 0.5, entrance: e.id }));
  });
  if (boss) party.push({ type: 'siegfried', at: 5, entrance: 'mund', boss: true });

  // Ein Erzfeind aus früheren Runs schließt sich an – spätestens in Nacht 5
  const waiting = state.nemesesWaiting;
  if (state.night >= 2 && waiting.length && (random(state) < META.nemesisChance || state.night >= META.nemesisForceNight)) {
    const id = pick(state, waiting);
    const nemesis = state.opts.nemeses.find((n) => n.id === id);
    state.nemesesWaiting = waiting.filter((x) => x !== id);
    const mouthHeroes = party.filter((p) => p.entrance === 'mund');
    const at = mouthHeroes.length ? pick(state, mouthHeroes).at + 0.4 : 3;
    party.push({ type: nemesis.type, at, entrance: 'mund', nemesis: id });
  }
  party.sort((a, b) => a.at - b.at);
  return party;
}

export function partySummary(state) {
  const byEntrance = new Map(state.entrances.map((e) => [e.id, { entrance: e, groups: new Map() }]));
  const nemeses = [];
  let boss = false;
  for (const p of state.party) {
    if (p.nemesis) {
      const n = state.opts.nemeses.find((x) => x.id === p.nemesis);
      if (n) nemeses.push(n);
      continue;
    }
    if (p.boss) {
      boss = true;
      continue;
    }
    const g = byEntrance.get(p.entrance)?.groups;
    if (g) g.set(p.type, (g.get(p.type) ?? 0) + 1);
  }
  const entrances = [...byEntrance.values()].map(({ entrance, groups }) => ({ entrance, groups: [...groups].map(([type, count]) => ({ type, count })) }));
  return { entrances, nemeses, boss };
}

// ── Nacht ───────────────────────────────────────────────────────

export function startNight(state) {
  if (state.phase !== 'build') return { ok: false };
  state.phase = 'night';
  state.t = 0;
  state.spawnIndex = 0;
  state.heroes = [];
  state.floor = [];
  state.pending = [];
  state.fallen = [];
  for (const b of state.buildings) {
    b.cd = b.kind === 'tower' ? 0.2 + random(state) * 0.3 : 0;
    if (b.kind === 'tower') {
      b.disabled = 0;
      b.attacks = 0;
      refreshStats(state, b);
    }
    if (b.kind === 'trap') b.burning = 0;
    if (b.kind === 'lure') b.charges = lureCharges(state, b.id);
  }
  state.guardians = state.guardians.filter((g) => walkableAt(state.tiles, g.c, g.r));
  state.dragon = { cd: { feuer: 0, fluegel: 0, bruellen: 0 }, claw: 0.5 };
  state.nightLog = { defeated: [], escaped: 0, stolen: [], decoys: 0, gold: 0, glut: 0, gear: [], levelUps: [], grabs: 0, eggGrabs: 0 };
  state.runLog.nights.push({ night: state.night, abilities: 0, decoyEscapes: 0, stolen: 0 });
  return { ok: true };
}

const nightRecord = (state) => state.runLog.nights[state.runLog.nights.length - 1];

export function foesLeft(state) {
  return {
    active: activeHeroes(state).length,
    coming: state.party.length - state.spawnIndex,
  };
}

export function update(state, dt) {
  if (state.phase !== 'night' || dt <= 0) return;
  const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
  for (let i = 0; i < steps && state.phase === 'night'; i++) step(state, dt / steps);
}

function step(state, dt) {
  state.t += dt;
  for (const id of Object.keys(state.dragon.cd)) state.dragon.cd[id] = Math.max(0, state.dragon.cd[id] - dt);
  updateSpawns(state);
  updatePending(state);
  for (const b of state.buildings) {
    if (b.kind !== 'tower' && b.cd > 0) b.cd = Math.max(0, b.cd - dt);
  }
  for (const h of state.heroes) {
    updateHero(state, h, dt);
    if (state.phase !== 'night') return;
  }
  updateTowers(state, dt);
  updateClaw(state, dt);
  const done = state.spawnIndex >= state.party.length && !state.heroes.some(isActive);
  if (done) endNight(state);
}

function updateSpawns(state) {
  while (state.spawnIndex < state.party.length && state.party[state.spawnIndex].at <= state.t) spawnHero(state, state.party[state.spawnIndex++]);
}

function spawnHero(state, entry) {
  const def = HEROES[entry.type];
  const e = state.entrances.find((x) => x.id === entry.entrance) ?? state.entrances[0];
  const m = state.mods;
  const nemesis = entry.nemesis ? state.opts.nemeses.find((n) => n.id === entry.nemesis) : null;
  let scale = m.heroHp;
  if (def.boss) scale *= 1 + 0.5 * Math.max(0, Math.floor((state.night - 1) / CONFIG.bossEvery));
  else scale *= 1 + CONFIG.heroHpGrowth * (state.night - 1);
  if (nemesis) scale *= 1.6 + 0.3 * (nemesis.rank - 1);
  const hp = {};
  for (const layer of LAYERS) hp[layer] = Math.round((def[layer] ?? 0) * scale);
  let speed = def.speed * m.heroSpeed * (entry.type === 'dieb' ? m.thiefSpeed : 1);
  if (nemesis) speed *= 1.05 ** nemesis.rank;
  see(state, 'heroesSeen', entry.type);
  // Gehört die Glut aus einem verlorenen Run Siegfried, trägt er sie bei sich
  const bossGlut = def.boss ? state.opts.nemeses.find((n) => n.type === 'siegfried') : null;
  const h = {
    uid: state.nextUid++,
    type: entry.type,
    entrance: e.id,
    x: e.c + 0.5,
    y: e.r + 0.5,
    hp,
    max: { ...hp },
    speed,
    strength: def.strength,
    grabTime: def.grab,
    kenner: !!def.kenner || (m.clever > 0 && random(state) < m.clever),
    caster: def.caster ?? null,
    boss: !!def.boss,
    state: 'seek',
    target: null,
    path: [],
    retarget: 0,
    grabT: 0,
    castT: 0,
    carry: null,
    stun: 0,
    hit: 0,
    dir: { x: 0, y: 1 },
    prev: { c: e.c, r: e.r },
    tile: idx(e.c, e.r),
    burn: null,
    curse: null,
    rubble: null,
    frost: 0,
    spreadT: 0,
    strikeT: BOSS.strikeEvery - 3,
    windup: 0,
    strikeTarget: null,
    touchedEgg: false,
    nemesis: nemesis?.id ?? bossGlut?.id ?? null,
    name: nemesis?.name ?? (def.boss ? def.name : null),
    rank: nemesis?.rank ?? 0,
    wears: nemesis?.treasure ?? null,
    glut: nemesis?.glut ?? bossGlut?.glut ?? 0,
  };
  state.heroes.push(h);
  state.fx.push({ type: 'spawn', x: h.x, y: h.y, kind: e.kind, hero: h.type });
  if (nemesis) state.fx.push({ type: 'text', x: h.x, y: h.y + 0.6, text: `${nemesis.name} ist zurück!`, tone: 'bad', cue: 'nemesis' });
  if (def.boss) state.fx.push({ type: 'text', x: h.x, y: h.y + 0.8, text: 'Siegfried kommt!', tone: 'bad', cue: 'nemesis' });
}

function updatePending(state) {
  if (!state.pending.length) return;
  const due = state.pending.filter((p) => p.at <= state.t);
  if (!due.length) return;
  state.pending = state.pending.filter((p) => p.at > state.t);
  for (const p of due) {
    if (p.kind === 'rockfall') {
      const def = BUILDINGS.steinschlag.trap;
      state.fx.push({ type: 'rockfall', c: p.c, r: p.r });
      for (const h of activeHeroes(state)) {
        if (Math.abs(Math.floor(h.x) - p.c) <= 1 && Math.abs(Math.floor(h.y) - p.r) <= 1) damage(state, h, def.dmg, def.type);
      }
    }
  }
}

// ── Wege ────────────────────────────────────────────────────────

const walkable = (state, c, r) => walkableAt(state.tiles, c, r);

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
  for (let i = goal; i !== start && i >= 0; i = prev[i]) path.push({ c: i % COLS, r: (i / COLS) | 0 });
  return path.reverse();
}

const tileOf = (h) => ({ c: Math.floor(h.x), r: Math.floor(h.y) });
const chebyshev = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
const worthless = (id) => TREASURES[id].family === 'tand';

// Was ein Held gerade haben will: der glänzendste Schatz, Köder oder liegengebliebene Fund, den er tragen kann.
// Bei Gleichstand gewinnt, was näher liegt. Siegfried will nur das Ei.
function chooseTarget(state, h) {
  const { c: hc, r: hr } = tileOf(h);
  const { dist, prev, start } = bfs(state, hc, hr);
  let best = null;
  const consider = (target, glanz, goals) => {
    let goal = -1;
    for (const g of goals) if (dist[g] >= 0 && (goal < 0 || dist[g] < dist[goal])) goal = g;
    if (goal < 0) return;
    if (!best || glanz > best.glanz || (glanz === best.glanz && dist[goal] < best.d)) best = { target, glanz, d: dist[goal], goal };
  };
  const center = chamberCenter(state);
  // Der Hort: Wer dort ankommt, nimmt den glänzendsten Schatz, den er tragen kann
  let item = null;
  if (h.boss) item = state.hoard.find((i) => i.id === 'ei') ?? null;
  else {
    for (const it of state.hoard) {
      const d = TREASURES[it.id];
      if (d.weight > h.strength) continue;
      if (!item || d.glanz > TREASURES[item.id].glanz) item = it;
    }
  }
  if (item) {
    const goals = [];
    if (h.caster) {
      const range = h.caster.range;
      for (let r = center.r - range; r <= center.r + range; r++) for (let c = center.c - range; c <= center.c + range; c++) if (inside(c, r) && walkable(state, c, r)) goals.push(idx(c, r));
    } else goals.push(idx(center.c, center.r));
    consider({ kind: 'hoard', uid: item.uid }, TREASURES[item.id].glanz, goals);
  }
  // Köder in den Nischen
  if (!h.boss && !h.caster) {
    for (const b of state.buildings) {
      if (b.kind !== 'lure') continue;
      const def = lureDef(b);
      if (def.bite ? b.cd > 0 : b.charges <= 0) continue;
      if (def.item && h.kenner) continue;
      const goals = N4.map(([dx, dy]) => [b.c + dx, b.r + dy]).filter(([c, r]) => walkable(state, c, r)).map(([c, r]) => idx(c, r));
      consider({ kind: 'lure', uid: b.uid }, lureGlanz(state, b), goals);
    }
  }
  // Was auf dem Boden liegt
  for (const f of state.floor) {
    const d = TREASURES[f.item.id];
    if (h.boss ? f.item.id !== 'ei' : d.weight > h.strength || (h.kenner && worthless(f.item.id))) continue;
    if (h.caster) continue;
    consider({ kind: 'floor', uid: f.item.uid }, d.glanz, [idx(f.c, f.r)]);
  }
  if (!best) return null;
  return { target: best.target, path: buildPath(prev, start, best.goal) };
}

function exitOf(state, h) {
  return state.entrances.find((e) => e.id === h.entrance) ?? state.entrances[0];
}

function pathToExit(state, h) {
  const { c, r } = tileOf(h);
  const e = exitOf(state, h);
  const { dist, prev, start } = bfs(state, c, r);
  const goal = idx(e.c, e.r);
  return dist[goal] < 0 ? null : buildPath(prev, start, goal);
}

function pathToChamber(state, h) {
  const { c, r } = tileOf(h);
  const center = chamberCenter(state);
  const { dist, prev, start } = bfs(state, c, r);
  const goal = idx(center.c, center.r);
  return dist[goal] < 0 ? [] : buildPath(prev, start, goal);
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
    if (d > 1e-6) {
      h.dir.x = dx / d;
      h.dir.y = dy / d;
    }
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

const bound = (state, h) => !!h.curse?.bind && h.curse.until > state.t;

function trapAt(state, c, r) {
  const b = buildingAt(state, c, r);
  return b?.kind === 'trap' ? b : null;
}

// Fallen, die beim Hineintreten auslösen
function enterTile(state, h, c, r) {
  const trap = trapAt(state, c, r);
  if (!trap) return;
  const def = BUILDINGS[trap.id].trap;
  if (trap.id === 'stacheln') {
    state.fx.push({ type: 'spike', c, r });
    damage(state, h, def.dmg, def.type);
  } else if (trap.id === 'baerenfalle' && trap.cd <= 0 && h.stun <= 0) {
    trap.cd = def.cd;
    h.stun = h.boss ? BOSS.snare : def.snare;
    interrupt(h);
    state.fx.push({ type: 'snare', x: h.x, y: h.y });
  } else if (trap.id === 'steinschlag' && trap.cd <= 0) {
    trap.cd = def.cd;
    state.pending.push({ kind: 'rockfall', c, r, at: state.t + def.delay });
    state.fx.push({ type: 'text', x: c + 0.5, y: r - 0.1, text: 'Es bröckelt …', tone: 'warn', cue: 'dig' });
  }
  if (trap.id === 'oel' && h.burn && h.burn.until > state.t) igniteOil(state, trap);
}

function igniteOil(state, trap) {
  const def = BUILDINGS.oel.trap;
  if (trap.burning > state.t) return;
  trap.burning = state.t + def.fire[1];
  state.fx.push({ type: 'oilfire', c: trap.c, r: trap.r });
}

function speedOf(state, h) {
  let slow = 1;
  const { c, r } = tileOf(h);
  const trap = trapAt(state, c, r);
  if (trap?.id === 'oel') slow = Math.min(slow, BUILDINGS.oel.trap.slow);
  if (h.rubble && h.rubble.until > state.t) slow = Math.min(slow, h.rubble.slow);
  if (h.frost > state.t) slow = Math.min(slow, 0.5);
  for (const b of state.buildings) {
    if (b.kind !== 'tower' || b.stats.slowAura >= 1 || b.disabled > 0) continue;
    if (Math.hypot(h.x - (b.c + 0.5), h.y - (b.r + 0.5)) <= b.stats.range) slow = Math.min(slow, b.stats.slowAura);
  }
  const carry = h.carry ? CONFIG.carrySpeed : 1;
  return h.speed * slow * carry;
}

// Brand, Fluch, brennendes Öl, Knochenwächter – alles, was jede Sekunde wirkt
function tickEffects(state, h, dt) {
  const { c, r } = tileOf(h);
  const key = idx(c, r);
  if (key !== h.tile) {
    h.prev = { c: h.tile % COLS, r: (h.tile / COLS) | 0 };
    h.tile = key;
    enterTile(state, h, c, r);
    if (!isActive(h)) return;
  }
  if (h.curse && h.curse.until <= state.t) h.curse = null;
  if (h.burn) {
    if (h.burn.until <= state.t) h.burn = null;
    else {
      const src = buildingByUid(state, h.burn.src);
      damage(state, h, h.burn.dps * dt, 'feuer', { b: src, quiet: true });
      if (!isActive(h)) return;
      if (h.burn?.spread) {
        h.spreadT += dt;
        if (h.spreadT >= 0.5) {
          h.spreadT = 0;
          for (const o of state.heroes) {
            if (o === h || !isActive(o) || (o.burn && o.burn.until > state.t)) continue;
            if (Math.hypot(o.x - h.x, o.y - h.y) <= 1.1) {
              o.burn = { ...h.burn };
              state.fx.push({ type: 'ember', x: o.x, y: o.y });
            }
          }
        }
      }
    }
  }
  const trap = trapAt(state, c, r);
  if (trap?.id === 'oel') {
    if (h.burn && h.burn.until > state.t) igniteOil(state, trap);
    if (trap.burning > state.t) damage(state, h, BUILDINGS.oel.trap.fire[0] * dt, 'feuer', { quiet: true });
    if (!isActive(h)) return;
  }
  if (state.guardians.length) {
    let dps = 0;
    for (const g of state.guardians) if (Math.abs(g.c - c) + Math.abs(g.r - r) <= 1) dps += META.guardianDps;
    if (dps) damage(state, h, dps * dt, 'drache', { quiet: true });
  }
}

function targetInReach(state, h) {
  const t = h.target;
  if (!t) return false;
  const { c, r } = tileOf(h);
  if (t.kind === 'hoard') {
    const center = chamberCenter(state);
    return state.hoard.some((i) => i.uid === t.uid) && c === center.c && r === center.r;
  }
  if (t.kind === 'lure') {
    const b = buildingByUid(state, t.uid);
    if (!b) return false;
    const def = lureDef(b);
    return Math.abs(b.c - c) + Math.abs(b.r - r) === 1 && (def.bite ? b.cd <= 0 : b.charges > 0);
  }
  const f = state.floor.find((x) => x.item.uid === t.uid);
  return !!f && f.c === c && f.r === r;
}

function castValid(state, h) {
  const t = h.target;
  if (!t || t.kind !== 'hoard') return false;
  return state.hoard.some((i) => i.uid === t.uid) && chebyshev(tileOf(h), chamberCenter(state)) <= h.caster.range;
}

function updateHero(state, h, dt) {
  if (!isActive(h)) return;
  if (h.hit > 0) h.hit = Math.max(0, h.hit - dt);
  tickEffects(state, h, dt);
  if (!isActive(h)) return;
  if (h.boss && updateBoss(state, h, dt)) return;
  if (h.stun > 0) {
    h.stun = Math.max(0, h.stun - dt);
    h.grabT = 0;
    h.castT = 0;
    return;
  }
  const speed = speedOf(state, h);

  if (h.state === 'seek') {
    h.retarget -= dt;
    if (h.retarget <= 0 || !h.target) {
      h.retarget = 0.5;
      const choice = chooseTarget(state, h);
      if (!choice) {
        if (!h.boss) {
          startLeave(state, h);
          return;
        }
        // Siegfried wartet in der Hortkammer, bis das Ei wieder dort liegt
        h.target = null;
        h.path = pathToChamber(state, h);
      } else {
        h.target = choice.target;
        h.path = choice.path;
      }
    }
    if (moveAlong(h, speed, dt) && h.target) {
      if (bound(state, h)) return;
      if (h.caster && h.target.kind === 'hoard') {
        if (castValid(state, h)) {
          h.state = 'cast';
          h.castT = 0;
          state.fx.push({ type: 'text', x: h.x, y: h.y - 0.7, text: 'zaubert …', tone: 'info', cue: 'cast' });
        } else h.retarget = 0;
      } else if (targetInReach(state, h)) {
        startGrab(state, h);
      } else h.retarget = 0;
    }
  } else if (h.state === 'grab') {
    if (!targetInReach(state, h)) {
      h.state = 'seek';
      h.retarget = 0;
      return;
    }
    if (bound(state, h)) {
      h.grabT = 0;
      return;
    }
    h.grabT += dt;
    if (h.grabT >= grabTimeOf(state, h)) take(state, h);
  } else if (h.state === 'cast') {
    if (!castValid(state, h)) {
      h.state = 'seek';
      h.castT = 0;
      h.retarget = 0;
      return;
    }
    if (bound(state, h)) {
      h.castT = 0;
      return;
    }
    h.castT += dt;
    if (h.castT >= h.caster.time) {
      const center = chamberCenter(state);
      state.fx.push({ type: 'teleport', c: center.c, r: center.r, x: h.x, y: h.y });
      take(state, h);
    }
  } else if (moveAlong(h, speed, dt)) {
    arriveAtExit(state, h);
  }
}

// Köder halten auf: Falsches Gold einzusammeln dauert länger
export function grabTimeOf(state, h) {
  const t = h.target;
  if (t?.kind === 'lure') {
    const b = buildingByUid(state, t.uid);
    if (b) return h.grabTime * (lureDef(b).grab ?? 1);
  }
  return h.grabTime;
}

function startGrab(state, h) {
  const t = h.target;
  if (t.kind === 'lure') {
    const b = buildingByUid(state, t.uid);
    const def = lureDef(b);
    if (def.bite) {
      // Die Mimik-Truhe beißt zu, statt sich nehmen zu lassen
      b.cd = def.cd;
      state.fx.push({ type: 'mimik', c: b.c, r: b.r });
      damage(state, h, def.bite, 'stich', { x: b.c + 0.5, y: b.r + 0.5 });
      if (isActive(h)) {
        h.target = null;
        h.retarget = 0;
      }
      return;
    }
  }
  if (t.kind === 'hoard' && state.hoard.find((i) => i.uid === t.uid)?.id === 'ei') {
    h.touchedEgg = true;
    if (h.boss) state.runLog.siegfried = { killed: false, touchedEgg: true };
  }
  h.state = 'grab';
  h.grabT = 0;
}

function take(state, h) {
  const t = h.target;
  let item = null;
  if (t.kind === 'hoard') {
    const i = state.hoard.findIndex((x) => x.uid === t.uid);
    if (i >= 0) item = state.hoard.splice(i, 1)[0];
  } else if (t.kind === 'lure') {
    const b = buildingByUid(state, t.uid);
    if (b && b.charges > 0) {
      b.charges -= 1;
      item = { uid: state.nextUid++, id: lureDef(b).item };
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
  if (t.kind === 'hoard' || item.id === 'ei') state.nightLog.grabs += 1;
  if (item.id === 'ei') state.nightLog.eggGrabs += 1;
  h.path = pathToExit(state, h) ?? [];
  if (item.id === 'ei') h.touchedEgg = true;
  state.fx.push({ type: 'grab', x: h.x, y: h.y, id: item.id });
  if (item.id === 'ei') state.fx.push({ type: 'text', x: h.x, y: h.y - 0.9, text: 'Dein Ei!', tone: 'bad', cue: 'stolen' });
  replanAll(state);
}

function startLeave(state, h) {
  h.state = 'leave';
  h.target = null;
  h.path = pathToExit(state, h) ?? [];
}

function arriveAtExit(state, h) {
  const { c, r } = tileOf(h);
  const e = exitOf(state, h);
  if (c !== e.c || r !== e.r) {
    const path = pathToExit(state, h);
    if (path && path.length) h.path = path;
    else h.state = 'left';
    return;
  }
  if (!h.carry) {
    h.state = 'left';
    return;
  }
  const id = h.carry.id;
  const record = nightRecord(state);
  h.state = 'escaped';
  state.stats.escaped += 1;
  state.nightLog.escaped += 1;
  if (worthless(id)) {
    state.nightLog.decoys += 1;
    record.decoyEscapes += 1;
    state.fx.push({ type: 'text', x: h.x, y: h.y + 0.6, text: `mit ${TREASURES[id].name} abgezogen`, tone: 'good', cue: 'chime' });
    return;
  }
  state.stats.stolen.push(id);
  state.nightLog.stolen.push(id);
  record.stolen += 1;
  if (h.nemesis && !h.boss) state.runLog.nemesisEscaped.push(h.nemesis);
  else if (!h.boss && id !== 'ei' && TREASURES[id].value >= META.nemesisMinValue) state.runLog.newNemeses.push({ type: h.type, treasure: id });
  state.fx.push({ type: 'text', x: h.x, y: h.y + 0.6, text: `${TREASURES[id].name} gestohlen`, tone: 'bad', cue: 'stolen', id });
  if (id === 'ei') {
    state.phase = 'lost';
    state.lostBy = h.type;
    state.lostNemesis = h.nemesis;
  }
}

const replanAll = (state) => {
  for (const o of state.heroes) if (o.state === 'seek') o.retarget = 0;
};

function interrupt(h) {
  h.grabT = 0;
  h.castT = 0;
  if (h.state === 'grab' || h.state === 'cast') {
    h.state = 'seek';
    h.retarget = 0;
  }
}

function dropCarry(state, h) {
  if (!h.carry) return;
  const { c, r } = tileOf(h);
  state.floor.push({ item: h.carry, c, r });
  if (!worthless(h.carry.id)) state.fx.push({ type: 'text', x: h.x, y: h.y - 0.6, text: `${TREASURES[h.carry.id].name} fallen gelassen`, tone: 'good', cue: 'drop' });
  h.carry = null;
  if (h.state === 'flee') {
    h.state = 'seek';
    h.retarget = 0;
  }
  replanAll(state);
}

// Siegfried holt mit Balmung aus und zerschlägt den nächsten Turm. Gibt true zurück, solange er ausholt.
function updateBoss(state, h, dt) {
  if (h.windup > 0) {
    h.windup -= dt;
    if (h.windup <= 0) {
      const b = buildingByUid(state, h.strikeTarget);
      if (b) {
        b.disabled = BOSS.strikeStun;
        state.fx.push({ type: 'balmung', x: h.x, y: h.y, c: b.c, r: b.r });
      }
      h.strikeTarget = null;
    }
    return true;
  }
  h.strikeT -= dt;
  if (h.strikeT <= 0 && h.stun <= 0) {
    h.strikeT = BOSS.strikeEvery;
    let best = null;
    for (const b of state.buildings) {
      if (b.kind !== 'tower' || b.disabled > 0) continue;
      const d = Math.hypot(b.c + 0.5 - h.x, b.r + 0.5 - h.y);
      if (d <= BOSS.strikeRange && (!best || d < best.d)) best = { b, d };
    }
    if (best) {
      h.windup = BOSS.strikeWindup;
      h.strikeTarget = best.b.uid;
      state.fx.push({ type: 'windup', x: h.x, y: h.y, c: best.b.c, r: best.b.r });
      return true;
    }
  }
  return false;
}

// ── Schaden ─────────────────────────────────────────────────────

// Steht die Quelle hinter dem Helden? Nur dort trifft man Siegfried am Lindenblatt.
function behind(h, src) {
  if (!src || src.x == null) return false;
  return h.dir.x * (src.x - h.x) + h.dir.y * (src.y - h.y) < -0.05;
}

// Schaden trifft zuerst den Segen, dann die Rüstung, dann das Leben. Gibt den tatsächlichen Schaden zurück.
function damage(state, h, amount, type, src = {}) {
  if (!isActive(h) || !(amount > 0)) return 0;
  let a = amount;
  if (h.curse && h.curse.until > state.t) a *= 1 + h.curse.amp;
  if (h.burn && h.burn.until > state.t && h.burn.scorch) a *= 1 + h.burn.scorch;
  if (h.boss && !behind(h, src)) a *= BOSS.frontDamage;
  const vs = DAMAGE[type].vs;
  let dealt = 0;
  for (const layer of LAYERS) {
    if (a <= 0) break;
    const pool = h.hp[layer];
    if (pool <= 0) continue;
    const m = vs[layer] * (src.vs?.[layer] ?? 1);
    if (m <= 0) break;
    const eff = a * m;
    if (eff <= pool) {
      h.hp[layer] = pool - eff;
      dealt += eff;
      a = 0;
    } else {
      h.hp[layer] = 0;
      dealt += pool;
      a -= pool / m;
    }
  }
  if (h.state === 'cast' && h.castT > 0) {
    h.castT = 0;
    if (!src.quiet) state.fx.push({ type: 'text', x: h.x, y: h.y - 0.8, text: 'Zauber gestört', tone: 'good', cue: 'fizzle' });
  }
  if (!src.quiet) {
    h.hit = 0.12;
    if (dealt >= 4 || src.crit) state.fx.push({ type: 'dmg', x: h.x, y: h.y - 0.45, text: String(Math.max(1, Math.round(dealt))), crit: !!src.crit });
  }
  if (src.b) {
    src.b.dealt = (src.b.dealt ?? 0) + dealt;
    gainXp(state, src.b, dealt * CONFIG.xpPerDamage);
  }
  if (type === 'feuer') {
    const trap = trapAt(state, Math.floor(h.x), Math.floor(h.y));
    if (trap?.id === 'oel') igniteOil(state, trap);
  }
  if (h.hp.leben <= 0.0001) kill(state, h, src);
  return dealt;
}

function gainXp(state, b, xp) {
  if (!b || b.kind !== 'tower' || !(xp > 0)) return;
  b.xp += xp;
  while (b.level < CONFIG.levels.length && b.xp >= CONFIG.levels[b.level]) {
    b.level += 1;
    refreshStats(state, b);
    if (state.nightLog && !state.nightLog.levelUps.includes(b.uid)) state.nightLog.levelUps.push(b.uid);
    state.fx.push({ type: 'levelup', c: b.c, r: b.r, level: b.level });
  }
}

function kill(state, h, src) {
  h.hp.leben = 0;
  dropCarry(state, h);
  const def = HEROES[h.type];
  const { c, r } = tileOf(h);
  if (src?.b) {
    gainXp(state, src.b, CONFIG.xpPerKill);
    src.b.kills += 1;
  }
  if (h.wears) state.floor.push({ item: newItem(state, h.wears), c, r });
  if (h.nemesis) {
    state.runLog.nemesisDefeated.push(h.nemesis);
    state.glut += h.glut;
    state.nightLog.glut += h.glut;
    if (!h.boss) state.fx.push({ type: 'text', x: h.x, y: h.y - 0.9, text: `${h.name} besiegt!`, tone: 'good', cue: 'nemesisDown' });
  }
  if (h.boss) {
    state.runLog.siegfried = { killed: true, touchedEgg: h.touchedEgg };
    state.fx.push({ type: 'text', x: h.x, y: h.y - 1, text: 'Siegfried ist gefallen!', tone: 'good', cue: 'nemesisDown' });
  }
  if (ruleOf(state) === 'guardians' && walkable(state, c, r)) state.fallen.push({ c, r });
  h.state = 'dead';
  state.stats.defeated += 1;
  state.nightLog.defeated.push(h.type);
  state.gold += def.gold;
  state.nightLog.gold += def.gold;
  state.glut += def.glut;
  state.nightLog.glut += def.glut;
  if (def.loot && random(state) < def.lootChance * (h.boss ? 1 : state.mods.lootChance)) {
    state.stash.push(def.loot);
    state.nightLog.gear.push(def.loot);
    see(state, 'gearSeen', def.loot);
    state.fx.push({ type: 'loot', x: h.x, y: h.y, id: def.loot });
  }
  if (def.gold) state.fx.push({ type: 'coin', x: h.x, y: h.y, n: def.gold });
  state.fx.push({ type: 'death', x: h.x, y: h.y, hero: h.type });
}

// Stößt einen Helden ein Stück zurück, wo er herkam
function pushBack(state, h, amount) {
  const tx = h.prev.c + 0.5;
  const ty = h.prev.r + 0.5;
  const dx = tx - h.x;
  const dy = ty - h.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.01 || !walkable(state, h.prev.c, h.prev.r)) return;
  const k = Math.min(amount, d) / d;
  h.x += dx * k;
  h.y += dy * k;
  h.path = [];
  if (h.state === 'seek') h.retarget = 0;
  else if (h.state === 'flee' || h.state === 'leave') h.path = pathToExit(state, h) ?? [];
  else interrupt(h);
}

// ── Türme ───────────────────────────────────────────────────────

function danger(h) {
  const base = h.carry?.id === 'ei' ? 3000 : h.carry && !worthless(h.carry.id) ? 2000 : 1000;
  return base - h.path.length + (h.state === 'grab' || h.state === 'cast' ? 50 : 0);
}

function updateTowers(state, dt) {
  let heroes = null;
  for (const b of state.buildings) {
    if (b.kind !== 'tower') continue;
    if (b.disabled > 0) {
      b.disabled = Math.max(0, b.disabled - dt);
      continue;
    }
    b.cd -= dt;
    if (b.cd > 0) continue;
    heroes ??= activeHeroes(state);
    const s = b.stats;
    const x = b.c + 0.5;
    const y = b.r + 0.5;
    const inRange = heroes.filter((h) => isActive(h) && Math.hypot(h.x - x, h.y - y) <= s.range);
    if (!inRange.length) {
      b.cd = 0.1;
      continue;
    }
    b.cd = s.interval;
    b.attacks += 1;
    fire(state, b, s, inRange);
  }
}

function fire(state, b, s, inRange) {
  const x = b.c + 0.5;
  const y = b.r + 0.5;
  if (s.aura) {
    state.fx.push({ type: 'pulse', x, y, r: s.range, id: b.id });
    for (const h of inRange) hit(state, b, s, h, s.dmg);
    return;
  }
  const targets = inRange.slice().sort((a, z) => danger(z) - danger(a)).slice(0, s.multi);
  let main = null;
  for (const t of targets) {
    if (!isActive(t)) continue;
    main ??= t;
    state.fx.push({ type: 'shot', id: b.id, x0: x, y0: y, x1: t.x, y1: t.y });
    const hitList = [t];
    if (s.splash > 0) {
      state.fx.push({ type: 'splash', x: t.x, y: t.y, r: s.splash });
      for (const o of activeHeroes(state)) if (o !== t && Math.hypot(o.x - t.x, o.y - t.y) <= s.splash) hitList.push(o);
    }
    if (s.pierce > 0) {
      const extra = activeHeroes(state).filter((o) => !hitList.includes(o) && Math.hypot(o.x - t.x, o.y - t.y) <= 1.2)
        .sort((a, z) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(z.x - t.x, z.y - t.y)).slice(0, s.pierce);
      hitList.push(...extra);
    }
    for (const h of hitList) hit(state, b, s, h, s.dmg);
    // Kettenwurf: der Speer springt weiter
    let from = t;
    const hitSet = new Set(hitList);
    for (let k = 0; k < s.chain; k++) {
      const next = activeHeroes(state).filter((o) => !hitSet.has(o) && Math.hypot(o.x - from.x, o.y - from.y) <= 2)
        .sort((a, z) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(z.x - from.x, z.y - from.y))[0];
      if (!next) break;
      state.fx.push({ type: 'shot', id: b.id, x0: from.x, y0: from.y, x1: next.x, y1: next.y, chain: true });
      hit(state, b, s, next, s.dmg * 0.6);
      hitSet.add(next);
      from = next;
    }
  }
  // Zauberstab: jeder dritte Angriff schickt einen Blitz weiter
  if (s.bolt && main && b.attacks % s.bolt[0] === 0) {
    const [, dmg, n] = s.bolt;
    const others = activeHeroes(state).filter((o) => o !== main && Math.hypot(o.x - main.x, o.y - main.y) <= 2.5).slice(0, n);
    for (const o of others) {
      state.fx.push({ type: 'bolt', x0: main.x, y0: main.y, x1: o.x, y1: o.y });
      damage(state, o, dmg * (1 + CONFIG.levelDamage * b.level), 'magie', { x: main.x, y: main.y, b });
    }
  }
}

function hit(state, b, s, h, amount) {
  if (!isActive(h)) return;
  const src = { x: b.c + 0.5, y: b.r + 0.5, b, vs: s.vs };
  if (amount > 0) {
    let a = amount;
    if (s.crit && random(state) < s.crit) {
      a *= 2;
      src.crit = true;
    }
    damage(state, h, a, s.type, src);
    if (!isActive(h)) return;
  }
  if (s.stun && !h.boss && random(state) < s.stun[0]) {
    h.stun = Math.max(h.stun, s.stun[1]);
    interrupt(h);
  }
  if (s.rubble) h.rubble = { slow: s.rubble[0], until: state.t + s.rubble[1] };
  if (s.burn) {
    const dps = Math.max(s.burn[0], h.burn && h.burn.until > state.t ? h.burn.dps : 0);
    h.burn = { dps, until: state.t + s.burn[1], src: b.uid, scorch: s.scorch, spread: s.spread };
  }
  if (s.curse) {
    const fresh = !h.curse || h.curse.until <= state.t;
    h.curse = { amp: s.curse[0], until: state.t + s.curse[1], src: b.uid, bind: s.bind, shredded: fresh ? false : h.curse.shredded };
    if (s.shredPct && !h.curse.shredded) {
      h.hp.ruestung *= 1 - s.shredPct;
      h.curse.shredded = true;
    }
    if (s.bind) interrupt(h);
  }
  if (s.shred) h.hp.ruestung = Math.max(0, h.hp.ruestung - s.shred);
  if (s.push) pushBack(state, h, s.push);
}

// ── Drache ──────────────────────────────────────────────────────

export function dragonPos(state) {
  const c = chamberCenter(state);
  return { x: c.c + 0.5, y: c.r + 0.5 };
}

function updateClaw(state, dt) {
  state.dragon.claw -= dt;
  if (state.dragon.claw > 0) return;
  const p = dragonPos(state);
  let best = null;
  let bestScore = Infinity;
  for (const h of state.heroes) {
    if (!isActive(h)) continue;
    const d = Math.hypot(h.x - p.x, h.y - p.y);
    if (d > DRAGON.claw.range) continue;
    const score = d - (h.carry ? 10 : 0);
    if (score < bestScore) {
      best = h;
      bestScore = score;
    }
  }
  if (!best) {
    state.dragon.claw = 0.1;
    return;
  }
  state.dragon.claw = DRAGON.claw.interval;
  state.fx.push({ type: 'claw', x: best.x, y: best.y });
  damage(state, best, DRAGON.claw.damage * power(state), 'drache', { x: p.x, y: p.y });
}

export const abilityReady = (state, id) => state.phase === 'night' && (state.dragon.cd[id] ?? 0) <= 0;

export function useAbility(state, id, target = null) {
  const ab = ABILITY_BY_ID[id];
  if (state.phase !== 'night' || !ab) return { ok: false, reason: '' };
  if (state.dragon.cd[id] > 0) return { ok: false, reason: `${ab.name.replace(/­/g, '')} lädt noch.` };
  const p = dragonPos(state);

  if (id === 'feuer') {
    if (!target || target.c == null || !inside(target.c, target.r)) return { ok: false, reason: 'Wähle ein Feld in der Höhle.' };
    const frost = ruleOf(state) === 'frost';
    const dmg = ab.damage * power(state) * (frost ? 0.8 : 1);
    state.fx.push({ type: 'breath', c: target.c, r: target.r, from: p, frost });
    for (const h of activeHeroes(state)) {
      if (Math.abs(h.x - (target.c + 0.5)) > 1.5 || Math.abs(h.y - (target.r + 0.5)) > 1.5) continue;
      if (frost) h.frost = state.t + 3;
      damage(state, h, dmg, 'drache', { x: p.x, y: p.y });
    }
    if (!frost) {
      for (const b of state.buildings) if (b.id === 'oel' && Math.abs(b.c - target.c) <= 1 && Math.abs(b.r - target.r) <= 1) igniteOil(state, b);
    }
  } else if (id === 'fluegel') {
    const center = chamberCenter(state);
    const { dist } = bfs(state, center.c, center.r);
    state.fx.push({ type: 'wing', x: p.x, y: p.y, r: ab.range });
    for (const h of activeHeroes(state)) {
      const { c, r } = tileOf(h);
      const d = dist[idx(c, r)];
      if (d < 0 || d > ab.range) continue;
      dropCarry(state, h);
      // Den Gang entlang vom Drachen weg
      let cur = { c, r };
      for (let s = 0; s < ab.push; s++) {
        const here = dist[idx(cur.c, cur.r)];
        const next = N4.map(([dx, dy]) => ({ c: cur.c + dx, r: cur.r + dy })).find((n) => inside(n.c, n.r) && dist[idx(n.c, n.r)] === here + 1);
        if (!next) break;
        cur = next;
      }
      h.x = cur.c + 0.5;
      h.y = cur.r + 0.5;
      h.path = [];
      h.stun = Math.max(h.stun, h.boss ? ab.stun * 0.5 : ab.stun);
      interrupt(h);
      if (h.state === 'seek' || h.state === 'flee') {
        h.state = 'seek';
        h.target = null;
        h.retarget = 0;
      } else if (h.state === 'leave') h.path = pathToExit(state, h) ?? [];
    }
  } else if (id === 'bruellen') {
    state.fx.push({ type: 'roar', x: p.x, y: p.y });
    for (const h of activeHeroes(state)) {
      h.stun = Math.max(h.stun, h.boss ? ab.stun * 0.6 : ab.stun);
      interrupt(h);
    }
  }
  state.dragon.cd[id] = ab.cooldown * state.mods.cooldown;
  nightRecord(state).abilities += 1;
  return { ok: true };
}

// ── Morgen ──────────────────────────────────────────────────────

function endNight(state) {
  // Was auf dem Boden liegt, tragen die Kobolde zurück in den Hort – falsches Gold verschwindet
  for (const f of state.floor) if (!worthless(f.item.id)) state.hoard.push(f.item);
  state.floor = [];
  state.pending = [];

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
  state.glut += CONFIG.glutPerNight;
  state.nightLog.glut += CONFIG.glutPerNight;
  const veins = veinCount(state);
  const income = incomeOf(state);
  state.gold += income;
  state.lastNight = {
    night: state.night,
    defeated: state.nightLog.defeated.length,
    escaped: state.nightLog.escaped,
    stolen: state.nightLog.stolen.slice(),
    decoys: state.nightLog.decoys,
    killGold: state.nightLog.gold,
    income,
    veins,
    gear: state.nightLog.gear.slice(),
    levelUps: state.nightLog.levelUps.slice(),
    glut: state.nightLog.glut,
    grabs: state.nightLog.grabs,
    eggGrabs: state.nightLog.eggGrabs,
  };
  state.heroes = [];
  state.party = [];
  if (state.nights && state.night >= state.nights) {
    state.phase = 'won';
    state.glut += CONFIG.glutWin;
    state.species = computeHatch(state);
  } else {
    state.phase = 'morning';
  }
}

export function nextDay(state) {
  if (state.phase !== 'morning') return false;
  state.night += 1;
  state.phase = 'dig';
  state.offers = makeOffers(state);
  return true;
}

// Welche Drachenart schlüpft
export function computeHatch(state) {
  if (state.runLog.nights.some((n) => n.decoyEscapes >= HATCH.decoys)) return 'mond';
  const gems = state.hoard.filter((i) => TREASURES[i.id].family === 'edelstein').length;
  if (gems >= HATCH.gems) return 'kristall';
  if (state.stats.defeated >= HATCH.defeated) return 'knochen';
  return 'gold';
}
