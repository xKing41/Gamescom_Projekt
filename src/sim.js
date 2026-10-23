// Spiellogik von Hort, ganz ohne Grafik.
// Ein Run: Tag (Raubziel wählen, Beute nehmen, Hort ordnen) → Nacht (Helden, Atem-Karten) → Morgen (Beute der Besiegten).
// Alle Zufälle laufen über den Seed im Zustand, deshalb lässt sich jeder Run als Hort-Code nachspielen.

import { TREASURES, HEROES, RAIDS, CARD_BY_ID, SPECIES, CONFIG } from './data.js';
import { COLS, ROWS, N4, idx, inside, kindAt, isHoardCell, HOARD_CELLS, DRAGON_CELLS, DRAGON_CENTER, ENTRANCES, DIG_AREA } from './map.js';
import { random, pick, pickWeighted, shuffle, randomSeed } from './rng.js';

export const DAY_PHASES = new Set(['raid', 'loot', 'arrange']);
const ACTIVE = new Set(['seek', 'grab', 'flee', 'leave']);
export const isActive = (h) => ACTIVE.has(h.state);
export const activeHeroes = (state) => state.heroes.filter(isActive);

// ── Run ─────────────────────────────────────────────────────────

export function createRun(seed = randomSeed()) {
  seed >>>= 0;
  const state = {
    version: 1,
    seed,
    rngState: seed,
    phase: 'raid',
    night: 1,
    hoard: new Array(COLS * ROWS).fill(null),
    tray: [],
    floor: [],
    heroes: [],
    digs: [],
    party: [],
    nextUid: 1,
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
    species: null,
    lostBy: null,
    fx: [],
  };
  for (const [id, c, r] of CONFIG.startHoard) state.hoard[idx(c, r)] = newItem(state, id);
  return state;
}

const newItem = (state, id) => ({ uid: state.nextUid++, id });

export function snapshot(state) {
  return JSON.stringify({ ...state, fx: [] });
}

export function restore(json) {
  try {
    const state = JSON.parse(json);
    return state?.version === 1 ? { ...state, fx: [] } : null;
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

function neighborItems(state, c, r) {
  const out = [];
  for (const [dc, dr] of N4) {
    const item = itemAt(state, c + dc, r + dr);
    if (item) out.push(item);
  }
  return out;
}

export function effGlanz(state, c, r) {
  const item = itemAt(state, c, r);
  if (!item) return 0;
  let glanz = TREASURES[item.id].glanz;
  for (const n of neighborItems(state, c, r)) glanz -= TREASURES[n.id].dims ?? 0;
  return Math.max(0, glanz);
}

export function effWeight(state, c, r) {
  const item = itemAt(state, c, r);
  if (!item) return 0;
  let weight = TREASURES[item.id].weight;
  for (const n of neighborItems(state, c, r)) weight += TREASURES[n.id].burdens ?? 0;
  return weight;
}

export function describeItem(state, item, c = null, r = null) {
  const d = TREASURES[item.id];
  const inHoard = c != null && itemAt(state, c, r)?.uid === item.uid;
  return {
    id: item.id,
    name: d.name,
    value: d.value,
    glanz: inHoard ? effGlanz(state, c, r) : d.glanz,
    baseGlanz: d.glanz,
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
  const raid = RAIDS[raidId];
  if (state.phase !== 'raid' || !raid) return false;
  state.raid = raidId;
  state.lootOffer = Array.from({ length: CONFIG.lootOffer }, () => pickWeighted(state, raid.loot));
  state.party = makeParty(state, raid);
  state.phase = 'loot';
  return true;
}

function makeParty(state, raid) {
  const count = CONFIG.partyBase + Math.round(state.night * CONFIG.partyGrowth);
  const [[mainType, share], [otherType]] = raid.party;
  const main = Math.min(count, Math.max(1, Math.round(count * share)));
  const types = shuffle(state, [...Array(main).fill(mainType), ...Array(count - main).fill(otherType)]);
  return types.map((type, i) => ({ type, at: 0.8 + i * CONFIG.spawnInterval + random(state) * 0.6 }));
}

export function partySummary(state) {
  const counts = new Map();
  for (const { type } of state.party) counts.set(type, (counts.get(type) ?? 0) + 1);
  return [...counts].map(([type, count]) => ({ type, count }));
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
  state.glutMax = CONFIG.glutBase + hoardItems(state).reduce((sum, { item }) => sum + (TREASURES[item.id].glut ?? 0), 0);
  state.glut = state.glutMax;
  state.glutTimer = 0;
  state.clawTimer = 0.5;
  state.nightLog = { defeated: [], escaped: 0, stolen: [], lostOnStart: lost };
  return { ok: true, lost };
}

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
  if (state.glutTimer >= CONFIG.glutRegenSeconds) {
    state.glutTimer -= CONFIG.glutRegenSeconds;
    state.glut += 1;
  }
}

function updateSpawns(state) {
  while (state.spawnIndex < state.party.length && state.party[state.spawnIndex].at <= state.t) {
    const { type } = state.party[state.spawnIndex++];
    if (HEROES[type].digger) startDig(state, type);
    else spawnHero(state, type, pick(state, ENTRANCES), false);
  }
  for (const dig of state.digs) {
    if (dig.at <= state.t) {
      dig.done = true;
      spawnHero(state, dig.type, { c: dig.c, r: dig.r }, true);
    }
  }
  state.digs = state.digs.filter((d) => !d.done);
}

function startDig(state, type) {
  const blockers = hoardItems(state).filter(({ item }) => TREASURES[item.id].blocksDig);
  const candidates = DIG_AREA.filter(({ c, r }) =>
    walkable(state, c, r)
    && !state.digs.some((d) => d.c === c && d.r === r)
    && !state.heroes.some((h) => isActive(h) && Math.floor(h.x) === c && Math.floor(h.y) === r)
    && !blockers.some((b) => Math.max(Math.abs(b.c - c), Math.abs(b.r - r)) <= TREASURES[b.item.id].blocksDig));
  if (!candidates.length) {
    spawnHero(state, type, pick(state, ENTRANCES), false);
    return;
  }
  const { c, r } = pick(state, candidates);
  state.digs.push({ type, c, r, at: state.t + CONFIG.digWarning, done: false });
  state.fx.push({ type: 'text', x: c + 0.5, y: r + 0.1, text: 'Es grollt im Boden …', tone: 'warn' });
}

function spawnHero(state, type, tile, dug) {
  const def = HEROES[type];
  const hp = Math.round(def.hp * (1 + CONFIG.heroHpGrowth * (state.night - 1)));
  state.heroes.push({
    uid: state.nextUid++,
    type,
    x: tile.c + 0.5,
    y: tile.r + 0.5,
    hp,
    maxHp: hp,
    speed: def.speed,
    strength: def.strength,
    grabTime: def.grab,
    fireproof: !!def.fireproof,
    state: 'seek',
    target: null,
    path: [],
    retarget: 0,
    grabT: 0,
    carry: null,
    stun: 0,
    hit: 0,
    hole: dug ? { c: tile.c, r: tile.r } : null,
  });
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

// Die Glanz-Regel: Helden laufen zum glänzendsten Schatz, den sie erreichen und tragen können
function chooseTarget(state, h) {
  const { c: hc, r: hr } = tileOf(h);
  const { dist, prev, start } = bfs(state, hc, hr);
  let best = null;
  const consider = (target, glanz, goal) => {
    const d = dist[goal];
    if (d < 0) return;
    if (!best || glanz > best.glanz || (glanz === best.glanz && d < best.d)) best = { target, glanz, d, goal };
  };
  for (const { c, r, item } of hoardItems(state)) {
    if (effWeight(state, c, r) > h.strength) continue;
    const glanz = effGlanz(state, c, r);
    for (const [dc, dr] of N4) {
      const nc = c + dc;
      const nr = r + dr;
      if (inside(nc, nr) && walkable(state, nc, nr)) consider({ kind: 'hoard', c, r, uid: item.uid }, glanz, idx(nc, nr));
    }
  }
  for (const f of state.floor) {
    const d = TREASURES[f.item.id];
    if (d.weight <= h.strength) consider({ kind: 'floor', uid: f.item.uid, c: f.c, r: f.r }, d.glanz, idx(f.c, f.r));
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

function heroSurroundings(state, h) {
  const { c, r } = tileOf(h);
  let slow = 1;
  let prick = 0;
  for (const n of neighborItems(state, c, r)) {
    const d = TREASURES[n.id];
    if (d.slows) slow = Math.min(slow, d.slows);
    if (d.pricks) prick += d.pricks;
  }
  return { slow, prick };
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

function updateHero(state, h, dt) {
  if (!isActive(h)) return;
  if (h.hit > 0) h.hit = Math.max(0, h.hit - dt);
  const near = heroSurroundings(state, h);
  if (near.prick) {
    damage(state, h, near.prick * dt, true);
    if (!isActive(h)) return;
  }
  if (h.stun > 0) {
    h.stun = Math.max(0, h.stun - dt);
    h.grabT = 0;
    return;
  }
  const speed = h.speed * near.slow * (h.carry ? CONFIG.carrySpeed : 1);

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
      if (targetInReach(state, h)) {
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
    item = itemAt(state, t.c, t.r);
    state.hoard[idx(t.c, t.r)] = null;
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
  h.state = 'escaped';
  state.stats.escaped += 1;
  state.nightLog.escaped += 1;
  state.stats.stolen.push(h.carry.id);
  state.nightLog.stolen.push(h.carry.id);
  state.fx.push({ type: 'text', x: h.x, y: h.y - 0.6, text: `${TREASURES[h.carry.id].name} gestohlen`, tone: 'bad' });
  if (h.carry.id === 'ei') {
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
  if (!quiet) {
    h.hit = 0.15;
    state.fx.push({ type: 'dmg', x: h.x, y: h.y - 0.45, text: String(Math.round(amount)) });
  }
  if (h.hp <= 0) kill(state, h);
}

function kill(state, h) {
  h.hp = 0;
  dropCarry(state, h);
  h.state = 'dead';
  state.stats.defeated += 1;
  state.nightLog.defeated.push(h.type);
  state.fx.push({ type: 'death', x: h.x, y: h.y, hero: h.type });
}

function dropCarry(state, h) {
  if (!h.carry) return;
  const { c, r } = tileOf(h);
  state.floor.push({ item: h.carry, c, r });
  state.fx.push({ type: 'text', x: h.x, y: h.y - 0.6, text: 'fallen gelassen', tone: 'good' });
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

export function playCard(state, cardId, target = null) {
  const card = CARD_BY_ID[cardId];
  if (state.phase !== 'night' || !card) return { ok: false, reason: '' };
  if (state.glut < card.cost) return { ok: false, reason: 'Zu wenig Glut.' };
  const pw = power(state);

  if (card.id === 'feuer') {
    if (!target || target.c == null) return { ok: false, reason: 'Wähle ein Feld für den Feueratem.' };
    state.glut -= card.cost;
    state.fx.push({ type: 'fire', c: target.c, r: target.r });
    for (const h of activeHeroes(state)) {
      if (Math.abs(h.x - (target.c + 0.5)) > 1.5 || Math.abs(h.y - (target.r + 0.5)) > 1.5) continue;
      if (h.fireproof) state.fx.push({ type: 'text', x: h.x, y: h.y - 0.6, text: 'feuerfest', tone: 'info' });
      else damage(state, h, card.damage * pw);
    }
    return { ok: true };
  }

  if (card.id === 'schnapp') {
    const h = state.heroes.find((x) => x.uid === target?.uid && isActive(x));
    if (!h) return { ok: false, reason: 'Tippe direkt auf einen Helden.' };
    if (distToDragon(h.x, h.y) > card.range) return { ok: false, reason: 'So weit reicht dein Maul nicht.' };
    state.glut -= card.cost;
    state.fx.push({ type: 'bite', x: h.x, y: h.y });
    dropCarry(state, h);
    damage(state, h, card.damage * pw);
    if (isActive(h)) {
      h.state = 'seek';
      h.target = null;
      h.path = [];
      h.grabT = 0;
      h.retarget = 0;
    }
    return { ok: true };
  }

  if (card.id === 'fluegel') {
    state.glut -= card.cost;
    state.fx.push({ type: 'wing' });
    for (const h of activeHeroes(state)) {
      const dx = h.x - DRAGON_CENTER.x;
      const dy = h.y - DRAGON_CENTER.y;
      const d = Math.hypot(dx, dy);
      if (d > card.range) continue;
      dropCarry(state, h);
      push(state, h, dx / (d || 1), dy / (d || 1), card.push);
      h.stun = Math.max(h.stun, card.stun);
      h.grabT = 0;
      h.path = [];
      if (h.state !== 'leave') {
        h.state = 'seek';
        h.target = null;
        h.retarget = 0;
      }
    }
    return { ok: true };
  }

  if (card.id === 'bruellen') {
    state.glut -= card.cost;
    state.fx.push({ type: 'roar' });
    for (const h of activeHeroes(state)) {
      h.stun = Math.max(h.stun, card.stun);
      h.grabT = 0;
      if (h.state === 'grab') h.state = 'seek';
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

  const drops = [];
  for (const type of state.nightLog.defeated) {
    const def = HEROES[type];
    if (def.loot && random(state) < def.lootChance) drops.push(def.loot);
  }
  state.morningLoot = shuffle(state, drops).slice(0, CONFIG.morningLootMax);
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
  if (state.night >= CONFIG.nights) {
    state.phase = 'won';
    state.species = computeSpecies(state);
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

function computeSpecies(state) {
  const score = Object.fromEntries(Object.keys(SPECIES).map((k) => [k, 0]));
  for (const { item } of hoardItems(state)) {
    const family = TREASURES[item.id].family;
    if (family in score) score[family] += SPECIES[family].weight;
  }
  let best = 'gold';
  for (const k of Object.keys(score)) if (score[k] > score[best]) best = k;
  return best;
}
