// Balance-Bot: spielt viele Runs ohne Grafik und meldet, wie oft der Drache gewinnt.
// Prüft nebenbei, dass die Spiellogik nicht hängen bleibt und keine Schätze verdoppelt oder verliert.
//
//   node tools/balance.mjs            Grundspiel, Strategien, Drachenarten und Legende-Stufen
//   node tools/balance.mjs --runs 50
//   node tools/balance.mjs --verbose  zeigt einen Run Nacht für Nacht

import * as Sim from '../src/sim.js';
import { TREASURES, BUILDINGS, CONFIG, UNLOCKS, BASE_DECK, ABILITY_BY_ID, HEROES } from '../src/data.js';
import { N4, inside, idx, tileAt, walkableAt, BUILDABLE } from '../src/map.js';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const RUNS = arg('--runs', 120);
const VERBOSE = process.argv.includes('--verbose');
const TICK = 0.1;
const MAX_NIGHT_SECONDS = 900;
const ENDLESS_CAP = 12;
const ALL_UNLOCKS = Object.keys(UNLOCKS);
const NEMESES = [
  { id: 'n1', name: 'Kunibert Langfinger', type: 'dieb', treasure: 'krone', glut: 40, rank: 2 },
  { id: 'n2', name: 'Hedwig Steinbart', type: 'zwerg', treasure: null, glut: 25, rank: 1 },
  { id: 'n3', name: 'Siegfried', type: 'siegfried', treasure: null, glut: 60, rank: 1 },
];

function fail(message, state) {
  console.error(`FEHLER (Seed ${state?.seed}, ${state?.opts?.species}, Legende ${state?.opts?.legend}, Nacht ${state?.night}): ${message}`);
  process.exit(1);
}

// Jeder Schatz darf genau einmal existieren, und das Ei muss da sein, solange der Run läuft
function checkInvariants(state) {
  const seen = new Set();
  const add = (item, where) => {
    if (!item) return;
    if (seen.has(item.uid)) fail(`Schatz ${item.uid} doppelt (${where})`, state);
    seen.add(item.uid);
  };
  state.hoard.forEach((item) => add(item, 'Hort'));
  state.floor.forEach((f) => add(f.item, 'Boden'));
  state.heroes.filter(Sim.isActive).forEach((h) => add(h.carry, 'getragen'));
  const eggs = [...state.hoard, ...state.floor.map((f) => f.item), ...state.heroes.filter(Sim.isActive).map((h) => h.carry)].filter((i) => i?.id === 'ei').length;
  if (state.phase !== 'lost' && eggs !== 1) fail(`${eggs} Eier im Spiel`, state);
  for (const h of state.heroes) {
    if (!Number.isFinite(h.x) || !Number.isFinite(h.y) || !Number.isFinite(h.hp.leben)) fail('Held mit ungültigen Werten', state);
    if (Sim.isActive(h) && !walkableAt(state.tiles, Math.floor(h.x), Math.floor(h.y))) fail(`Held ${h.type} steckt im Fels (${h.x.toFixed(2)}, ${h.y.toFixed(2)})`, state);
  }
  if (!(state.gold >= 0)) fail(`Gold ist ${state.gold}`, state);
}

// ── Graben ──

function scoreOffer(state, offer, strategy) {
  let s = 0;
  for (const f of offer.features) s += f === 'vein' ? 3 : f === 'ledge' ? 1.5 : 0;
  if (offer.find) s += TREASURES[offer.find].value * 0.4 + 1;
  if (offer.entrance) s += strategy.greedy ? 2 : state.night < 4 ? -5 : -1.5;
  return s;
}

function chooseDig(state, strategy) {
  if (!state.offers.length) return Sim.skipDig(state);
  const dirs = Sim.digDirections(state);
  let best = null;
  state.offers.forEach((offer, i) => {
    for (const d of dirs) {
      // Freiheit danach und Tiefe: unten ist es reicher
      const free = ['N', 'E', 'S', 'W'].filter((x) => {
        const dx = { N: 0, E: 1, S: 0, W: -1 }[x];
        const dy = { N: -1, E: 0, S: 1, W: 0 }[x];
        const nx = d.cx + dx;
        const ny = d.cy + dy;
        return nx >= 0 && ny >= 0 && nx < 5 && ny < 5 && !state.pieces.some((p) => p.cx === nx && p.cy === ny);
      }).length;
      const score = scoreOffer(state, offer, strategy) + free * 0.3 + (d.dir === 'S' ? 0.4 : 0) + (d.dead ? -3 : 0);
      if (!best || score > best.score) best = { i, dir: d.dir, score };
    }
  });
  const result = Sim.dig(state, best.i, best.dir);
  if (!result.ok) fail(`Graben fehlgeschlagen: ${result.reason}`, state);
  return result;
}

// ── Bauen ──

const pathTiles = (state) => {
  const out = [];
  for (let r = 0; r < 16; r++) for (let c = 0; c < 15; c++) if ('.h'.includes(tileAt(state.tiles, c, r))) out.push({ c, r });
  return out;
};

// Wie viel Gang ein Turm an dieser Stelle abdeckt – Gänge kurz vor dem Hort zählen mehr
function coverage(state, c, r, range) {
  const center = Sim.chamberCenter(state);
  let s = 0;
  for (const p of pathTiles(state)) {
    const d = Math.hypot(p.c - c, p.r - r);
    if (d > range) continue;
    const toHoard = Math.abs(p.c - center.c) + Math.abs(p.r - center.r);
    s += 1 + 3 / (1 + toHoard * 0.3);
  }
  return s;
}

function bestSpot(state, id) {
  const def = BUILDINGS[id];
  let best = null;
  for (let r = 1; r < 16; r++) {
    for (let c = 0; c < 15; c++) {
      if (!Sim.canPlace(state, id, c, r).ok) continue;
      let score;
      if (def.kind === 'tower') {
        const range = def.tower.range + (tileAt(state.tiles, c, r) === 'l' ? CONFIG.ledge.range : 0);
        score = coverage(state, c, r, range) * (tileAt(state.tiles, c, r) === 'l' ? 1.2 : 1);
      } else if (def.kind === 'trap') {
        // Fallen dort, wo viele Türme hinreichen
        score = state.buildings.filter((b) => b.kind === 'tower' && Math.hypot(b.c - c, b.r - r) <= b.stats.range).length + Math.random() * 0.1;
      } else {
        // Köder dort, wo Türme den Gang davor abdecken
        score = state.buildings.filter((b) => b.kind === 'tower' && Math.hypot(b.c - c, b.r - r) <= b.stats.range + 0.5).length + Math.random() * 0.1;
      }
      if (!best || score > best.score) best = { c, r, score };
    }
  }
  return best;
}

const PRIORITY = { speer: 5, feuer: 4.5, stein: 4, fluch: 3.5, katzengold: 3, narrengold: 3.2, mimik: 2.5, stacheln: 2, baerenfalle: 2.2, oel: 1.5, steinschlag: 2 };

// Köder nur, wenn die Helden sonst zum Ei wollen
function wantsLure(state) {
  const top = Sim.wantedTreasure(state, 1);
  const lures = state.buildings.filter((b) => b.kind === 'lure').length;
  return top?.id === 'ei' && lures < 1 + Math.floor(state.night / 4);
}

function build(state, strategy) {
  for (let guard = 0; guard < 20; guard++) {
    const options = state.deck.hand
      .map((id, i) => ({ id, i, p: PRIORITY[id] + (BUILDINGS[id].kind === 'lure' && wantsLure(state) ? 3 : 0) + (BUILDINGS[id].kind === 'trap' && state.night < 2 ? -2 : 0) }))
      .filter((o) => BUILDINGS[o.id].cost <= state.gold && !(strategy.towersOnly && BUILDINGS[o.id].kind !== 'tower') && !(strategy.noLures && BUILDINGS[o.id].kind === 'lure') && !(strategy.noTraps && BUILDINGS[o.id].kind === 'trap'))
      .sort((a, b) => b.p - a.p);
    let placed = false;
    for (const o of options) {
      const spot = bestSpot(state, o.id);
      if (!spot) continue;
      const result = Sim.playCard(state, o.i, spot.c, spot.r);
      if (result.ok) {
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }
  if (!state.redrawn && state.gold >= 80 && state.deck.hand.every((id) => BUILDINGS[id].cost > state.gold - CONFIG.redrawCost)) Sim.redraw(state);
}

const TREE_ORDER = {
  speer: ['B1', 'B2', 'B3', 'A1', 'A2', 'S', 'A3', 'B4', 'A4'],
  stein: ['A1', 'B1', 'A2', 'A3', 'B2', 'S', 'B3', 'A4', 'B4'],
  feuer: ['A1', 'A2', 'A3', 'B1', 'B2', 'S', 'B3', 'A4', 'B4'],
  fluch: ['B1', 'B2', 'B3', 'A1', 'A2', 'S', 'A3', 'B4', 'A4'],
};

function develop(state) {
  for (const b of state.buildings) {
    if (b.kind !== 'tower') continue;
    for (const node of TREE_ORDER[b.id]) {
      if (Sim.pointsLeft(b) <= 0) break;
      if (Sim.nodeState(state, b, node) === 'open') Sim.learnNode(state, b.uid, node);
    }
  }
  const towers = state.buildings.filter((b) => b.kind === 'tower').sort((a, b) => b.level - a.level);
  for (const t of towers) {
    while (state.stash.length && t.gear.length < t.stats.sockets) Sim.socketGear(state, t.uid, 0);
  }
}

// ── Nacht ──

function useAbilities(state) {
  const heroes = Sim.activeHeroes(state);
  if (!heroes.length) return null;
  const center = Sim.chamberCenter(state);
  const ready = (id) => Sim.abilityReady(state, id);
  const egg = heroes.find((h) => h.carry?.id === 'ei');
  const nearChamber = heroes.filter((h) => Math.abs(h.x - center.c - 0.5) + Math.abs(h.y - center.r - 0.5) <= 3.5);
  const carriers = heroes.filter((h) => h.carry && TREASURES[h.carry.id].value > 0 || h.carry?.id === 'ei');
  if (egg) {
    if (ready('fluegel') && Math.abs(egg.x - center.c - 0.5) + Math.abs(egg.y - center.r - 0.5) <= 4) return Sim.useAbility(state, 'fluegel');
    if (ready('feuer')) return Sim.useAbility(state, 'feuer', { c: Math.floor(egg.x), r: Math.floor(egg.y) });
    if (ready('bruellen')) return Sim.useAbility(state, 'bruellen');
  }
  if (ready('fluegel') && nearChamber.filter((h) => h.carry || h.state === 'grab' || h.state === 'cast').length >= 2) return Sim.useAbility(state, 'fluegel');
  if (ready('feuer')) {
    let best = null;
    for (const h of heroes) {
      const c = Math.floor(h.x);
      const r = Math.floor(h.y);
      const n = heroes.filter((o) => Math.abs(o.x - c - 0.5) <= 1.5 && Math.abs(o.y - r - 0.5) <= 1.5).length + (h.carry ? 2 : 0);
      if (!best || n > best.n) best = { c, r, n };
    }
    if (best && best.n >= 3) return Sim.useAbility(state, 'feuer', best);
  }
  if (ready('bruellen') && (carriers.length >= 3 || nearChamber.length >= 5)) return Sim.useAbility(state, 'bruellen');
  return null;
}

// reaction: Sekunden zwischen zwei Fähigkeiten (0,3 = Bot, 1,2 ≈ Mensch); null = Drache schläft
function playRun(seed, reaction, options = {}, strategy = {}) {
  const state = Sim.createRun(seed, options);
  const endless = Sim.isEndless(state);
  let log = [];
  while (state.phase !== 'won' && state.phase !== 'lost') {
    if (endless && state.night > ENDLESS_CAP) break;
    if (state.phase === 'dig') chooseDig(state, strategy);
    if (state.phase !== 'build') fail(`Nach dem Graben in Phase ${state.phase}`, state);
    develop(state);
    build(state, strategy);
    develop(state);
    checkInvariants(state);
    const goldBefore = state.gold;
    Sim.startNight(state);
    let elapsed = 0;
    let ready = 0;
    while (state.phase === 'night') {
      if (reaction != null && elapsed >= ready && useAbilities(state)?.ok) ready = elapsed + reaction;
      Sim.update(state, TICK);
      elapsed += TICK;
      checkInvariants(state);
      if (elapsed > MAX_NIGHT_SECONDS) fail(`Nacht ${state.night} endet nicht`, state);
    }
    if (VERBOSE) {
      const n = state.lastNight;
      const towers = state.buildings.filter((b) => b.kind === 'tower');
      log.push(`  Nacht ${state.night}: ${elapsed.toFixed(0)} s · ${n ? `${n.defeated} besiegt, ${n.escaped} entkommen (${n.decoys} Köder), ${n.grabs} am Hort (Ei ${n.eggGrabs}), gestohlen: ${n.stolen.join(', ') || '–'}` : state.phase} · Gold ${goldBefore}→${state.gold} · Türme ${towers.length} (Stufen ${towers.map((t) => t.level).join(',')}) · Bauten ${state.buildings.length} · Eingänge ${state.entrances.map((e) => e.kind).join(',')} · Hort ${state.hoard.map((i) => i.id).join(',')}`);
    }
    if (state.phase === 'morning') Sim.nextDay(state);
  }
  if (VERBOSE) {
    console.log(`Seed ${seed}: ${state.phase === 'won' ? 'gewonnen' : `verloren in Nacht ${state.night} (${state.lostBy})`} · Glut ${state.glut}`);
    console.log(log.join('\n'));
  }
  if (state.phase === 'won' && !state.species) fail('Sieg ohne geschlüpften Drachen', state);
  return {
    won: state.phase === 'won',
    nights: state.stats.nightsSurvived,
    stolen: state.stats.stolen.length,
    defeated: state.stats.defeated,
    species: state.species,
    glut: state.glut,
    lostBy: state.lostBy,
    nights_total: state.nights,
    siegfried: state.runLog.siegfried?.killed ?? false,
    entrances: state.entrances.length,
    towers: state.buildings.filter((b) => b.kind === 'tower').map((b) => ({ id: b.id, dealt: b.dealt, level: b.level })),
  };
}

function report(label, results) {
  const n = results.length;
  const wins = results.filter((r) => r.won).length;
  const avg = (key) => (results.reduce((s, r) => s + r[key], 0) / n).toFixed(1);
  const maxNights = Math.max(...results.map((r) => r.nights_total || ENDLESS_CAP));
  const lostIn = Array.from({ length: maxNights }, (_, i) => results.filter((r) => !r.won && r.nights === i).length);
  const lostText = lostIn.map((v, i) => `${i + 1}:${v}`).join(' ');
  console.log(`${label.padEnd(30)} Siege ${String(Math.round((wins / n) * 100)).padStart(3)} %  ·  Nächte Ø ${avg('nights').padStart(4)}  ·  gestohlen Ø ${avg('stolen').padStart(4)}  ·  Glut Ø ${avg('glut').padStart(5)}  ·  Ei verloren in Nacht ${lostText}`);
  return { winRate: wins / n, results };
}

const seeds = Array.from({ length: RUNS }, (_, i) => 1000 + i * 7919);
const few = seeds.slice(0, Math.max(20, Math.round(RUNS / 4)));
const t0 = Date.now();
let runs = 0;
const run = (list, reaction, options, strategy) => list.map((s) => {
  runs += 1;
  return playRun(s, reaction, options, strategy);
});

if (VERBOSE) {
  for (const s of seeds.slice(0, arg("--show", 1))) playRun(s, 1.2);
  process.exit(0);
}

console.log('Grundspiel (Golddrache, Legende 0, ohne Freischaltungen)');
const bot = report('  Bot (0,3 s)', run(seeds, 0.3));
const human = report('  Mensch (1,2 s)', run(seeds, 1.2));
const asleep = report('  Drache schläft', run(seeds, null)).winRate;
report('  nur Türme', run(few, 1.2, {}, { towersOnly: true }));
if (process.argv.includes('--quick')) {
  report('  ohne Köder', run(few, 1.2, {}, { noLures: true }));
  report('  ohne Fallen', run(few, 1.2, {}, { noTraps: true }));
}
report('  gierig (jeder Durchbruch)', run(few, 1.2, {}, { greedy: true }));

// Welche Türme tragen wie viel bei
const dealt = {};
for (const r of human.results) for (const t of r.towers) {
  dealt[t.id] ??= { n: 0, dealt: 0, level: 0 };
  dealt[t.id].n += 1;
  dealt[t.id].dealt += t.dealt;
  dealt[t.id].level += t.level;
}
console.log(`  Türme: ${Object.entries(dealt).map(([id, d]) => `${id} ${d.n}× Ø ${Math.round(d.dealt / d.n)} Schaden, Stufe ${(d.level / d.n).toFixed(1)}`).join(' · ')}`);
const killers = {};
for (const r of human.results) if (r.lostBy) killers[r.lostBy] = (killers[r.lostBy] ?? 0) + 1;
console.log(`  Ei gestohlen von: ${Object.entries(killers).map(([k, v]) => `${HEROES[k].name} ${v}`).join(' · ') || '–'}`);
console.log(`  Siegfried besiegt: ${human.results.filter((r) => r.siegfried).length} von ${human.results.length}`);

if (process.argv.includes('--quick')) process.exit(0);

console.log('\nAlles freigeschaltet, mit Erzfeinden – Mensch (1,2 s)');
const full = { unlocks: ALL_UNLOCKS, nemeses: NEMESES, deck: ['speer', 'stein', 'feuer', 'fluch', 'baerenfalle', 'steinschlag', 'narrengold', 'mimik'] };
for (const species of ['gold', 'kristall', 'knochen', 'mond']) {
  for (const legend of [0, 5, 10]) report(`  ${species}, Legende ${legend}`, run(few, 1.2, { ...full, species, legend }));
}
const hatched = {};
for (const r of run(few, 1.2, full)) if (r.species) hatched[r.species] = (hatched[r.species] ?? 0) + 1;
report(`  Endlos (bis Nacht ${ENDLESS_CAP})`, run(few, 1.2, { ...full, mode: 'endless' }));
console.log(`  Geschlüpft: ${Object.entries(hatched).map(([k, v]) => `${k} ${v}`).join(' · ') || '–'}`);
console.log(`\n${runs} Runs in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

if (bot.winRate <= asleep) fail('Die Fähigkeiten des Drachen bringen dem Bot nichts – da stimmt etwas nicht.');
if (BASE_DECK.length !== 8) fail('Das Grunddeck muss acht Baupläne haben.');
