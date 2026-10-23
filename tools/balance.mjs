// Balance-Bot: spielt viele Runs ohne Grafik und meldet, wie oft der Drache gewinnt.
// Prüft nebenbei, dass die Spiellogik nicht hängen bleibt und keine Schätze verdoppelt oder verliert.
//
//   node tools/balance.mjs            200 Runs je Strategie, dazu alle Drachenarten und Legende-Stufen
//   node tools/balance.mjs --runs 50

import * as Sim from '../src/sim.js';
import { TREASURES, CARD_BY_ID, CONFIG, UNLOCKS, BASE_CARDS } from '../src/data.js';
import { HOARD_CELLS } from '../src/map.js';

const runsArg = process.argv.indexOf('--runs');
const RUNS = runsArg > 0 ? Number(process.argv[runsArg + 1]) : 200;
const TICK = 0.2;
const MAX_NIGHT_SECONDS = 600;
const ENDLESS_CAP = 12;
const ALL_UNLOCKS = Object.keys(UNLOCKS);
const NEMESES = [
  { id: 'n1', name: 'Kunibert Langfinger', type: 'dieb', treasure: 'krone', rank: 2 },
  { id: 'n2', name: 'Hedwig Steinbart', type: 'zwerg', treasure: 'barren', rank: 1 },
  { id: 'n3', name: 'Gernot Funkenhand', type: 'magier', treasure: 'saphir', rank: 3 },
];

function fail(message, state) {
  console.error(`FEHLER (Seed ${state?.seed}, ${state?.opts?.species}, Legende ${state?.opts?.legend}): ${message}`);
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
  for (const { item } of Sim.hoardItems(state)) add(item, 'Hort');
  state.tray.forEach((item) => add(item, 'Tablett'));
  state.floor.forEach((f) => add(f.item, 'Boden'));
  state.heroes.forEach((h) => add(h.carry, 'getragen'));
  const eggs = [...Sim.hoardItems(state).map((x) => x.item), ...state.tray, ...state.floor.map((f) => f.item), ...state.heroes.filter(Sim.isActive).map((h) => h.carry)]
    .filter((item) => item?.id === 'ei').length;
  if (state.phase !== 'lost' && eggs !== 1) fail(`${eggs} Eier im Spiel`, state);
  for (const h of state.heroes) {
    if (!Number.isFinite(h.x) || !Number.isFinite(h.y) || !Number.isFinite(h.hp)) fail('Held mit ungültigen Werten', state);
  }
}

function mergeAll(state) {
  for (;;) {
    const items = [
      ...state.tray.map((item, i) => ({ item, from: { where: 'tray', i } })),
      ...Sim.hoardItems(state).map(({ c, r, item }) => ({ item, from: { where: 'hoard', c, r } })),
    ];
    let merged = false;
    for (const a of items) {
      const b = items.find((o) => o !== a && o.from.where === 'hoard' && o.item.id === a.item.id && TREASURES[a.item.id].next);
      if (b && Sim.moveItem(state, a.from, b.from.c, b.from.r).kind === 'merge') {
        merged = true;
        break;
      }
    }
    if (!merged) return;
  }
}

// Einfache Aufstellung: Köder nach vorn, Wertvolles nach hinten zur Klaue
function arrange(state) {
  mergeAll(state);
  while (state.tray.length) {
    const item = state.tray[0];
    const free = HOARD_CELLS.filter(({ c, r }) => !Sim.itemAt(state, c, r));
    if (!free.length) break;
    const decoy = TREASURES[item.id].value === 0;
    free.sort((a, b) => (decoy ? b.r - a.r : a.r - b.r) || Math.abs(a.c - 5.5) - Math.abs(b.c - 5.5));
    Sim.moveItem(state, { where: 'tray', i: 0 }, free[0].c, free[0].r);
  }
}

function bestFireTile(state) {
  let best = null;
  for (const h of Sim.activeHeroes(state)) {
    const c = Math.floor(h.x);
    const r = Math.floor(h.y);
    const hits = Sim.activeHeroes(state).filter((o) => !o.fireproof && Math.abs(o.x - (c + 0.5)) <= 1.5 && Math.abs(o.y - (r + 0.5)) <= 1.5).length;
    if (!best || hits > best.hits) best = { c, r, hits };
  }
  return best;
}

function playCards(state) {
  const has = (id) => state.opts.cards.includes(id) && state.glut >= CARD_BY_ID[id].cost;
  const heroes = Sim.activeHeroes(state);
  // Träger und zaubernde Magier zuerst, das Ei vor allem anderen
  const threats = heroes.filter((h) => h.carry || h.state === 'cast').sort((a, b) => (b.carry?.id === 'ei') - (a.carry?.id === 'ei'));
  for (const h of threats) {
    if (has('schnapp') && Sim.distToDragon(h.x, h.y) <= CARD_BY_ID.schnapp.range) return Sim.playCard(state, 'schnapp', { uid: h.uid });
  }
  for (const h of threats) {
    if (has('feuer') && !h.fireproof) return Sim.playCard(state, 'feuer', { c: Math.floor(h.x), r: Math.floor(h.y) });
  }
  if (has('fluegel') && threats.some((h) => h.fireproof && Math.hypot(h.x - 6, h.y - 1.5) <= 5)) return Sim.playCard(state, 'fluegel');
  if (has('schwanz') && heroes.filter((h) => Sim.distToDragon(h.x, h.y) <= 3).length >= 2) return Sim.playCard(state, 'schwanz');
  if (has('glutregen') && heroes.filter((h) => !h.fireproof).length >= 5) return Sim.playCard(state, 'glutregen');
  if (has('rauch')) {
    const eggHunter = heroes.find((h) => h.target?.kind === 'hoard' && Sim.itemAt(state, h.target.c, h.target.r)?.id === 'ei');
    if (eggHunter) return Sim.playCard(state, 'rauch', { c: eggHunter.target.c, r: eggHunter.target.r });
  }
  if (has('bruellen') && threats.length >= 3) return Sim.playCard(state, 'bruellen');
  const fire = bestFireTile(state);
  if (has('feuer') && state.glut >= 3 && fire && fire.hits >= 2) return Sim.playCard(state, 'feuer', fire);
  return null;
}

// reaction: Sekunden zwischen zwei Karten (0,2 = Bot, 1,2 ≈ Mensch); null = keine Karten
function playRun(seed, reaction, options = {}) {
  const state = Sim.createRun(seed, options);
  const endless = Sim.isEndless(state);
  while (state.phase !== 'won' && state.phase !== 'lost') {
    if (endless && state.night > ENDLESS_CAP) break;
    Sim.chooseRaid(state, state.realms[(state.night + seed) % state.realms.length]);
    const offer = state.lootOffer.map((id, i) => ({ i, value: TREASURES[id].value + (TREASURES[id].glut ?? 0) }));
    offer.sort((a, b) => b.value - a.value);
    Sim.takeLoot(state, offer.slice(0, CONFIG.lootPick).map((o) => o.i));
    arrange(state);
    checkInvariants(state);
    Sim.startNight(state);
    let elapsed = 0;
    let ready = 0;
    while (state.phase === 'night') {
      if (reaction != null && elapsed >= ready && playCards(state)?.ok) ready = elapsed + reaction;
      Sim.update(state, TICK);
      elapsed += TICK;
      checkInvariants(state);
      if (elapsed > MAX_NIGHT_SECONDS) fail(`Nacht ${state.night} endet nicht`, state);
    }
    if (state.phase === 'morning') Sim.takeMorningLoot(state, state.morningLoot.map((_, i) => i));
  }
  if (state.phase === 'won' && !state.species) fail('Sieg ohne geschlüpften Drachen', state);
  return {
    won: state.phase === 'won',
    nights: state.stats.nightsSurvived,
    stolen: state.stats.stolen.length,
    defeated: state.stats.defeated,
    species: state.species,
    nemesesBeaten: state.runLog.nemesisDefeated.length,
    nights_total: state.nights,
  };
}

function report(label, results) {
  const n = results.length;
  const wins = results.filter((r) => r.won).length;
  const avg = (key) => (results.reduce((s, r) => s + r[key], 0) / n).toFixed(1);
  const maxNights = Math.max(...results.map((r) => r.nights_total || ENDLESS_CAP));
  const lostIn = Array.from({ length: maxNights }, (_, i) => results.filter((r) => !r.won && r.nights === i).length);
  const lostText = lostIn.map((v, i) => `${i + 1}:${v}`).join(' ');
  console.log(`${label.padEnd(26)} Siege ${String(Math.round((wins / n) * 100)).padStart(3)} %  ·  Nächte Ø ${avg('nights').padStart(4)}  ·  gestohlen Ø ${avg('stolen').padStart(4)}  ·  Ei verloren in Nacht ${lostText}`);
  return { winRate: wins / n, results };
}

const seeds = Array.from({ length: RUNS }, (_, i) => 1000 + i * 7919);
const few = seeds.slice(0, Math.max(20, Math.round(RUNS / 4)));
const t0 = Date.now();
let runs = 0;
const run = (list, reaction, options) => list.map((s) => {
  runs += 1;
  return playRun(s, reaction, options);
});

console.log('Grundspiel (Golddrache, Legende 0, ohne Freischaltungen)');
const withCards = report('  Bot (0,2 s)', run(seeds, 0.2)).winRate;
report('  Mensch (1,2 s)', run(seeds, 1.2));
const passive = report('  ohne Karten', run(seeds, null)).winRate;

console.log('\nAlles freigeschaltet, mit Erzfeinden – Mensch (1,2 s)');
const full = { unlocks: ALL_UNLOCKS, nemeses: NEMESES };
for (const species of ['gold', 'kristall', 'knochen', 'mond']) {
  for (const legend of [0, 5, 10]) report(`  ${species}, Legende ${legend}`, run(few, 1.2, { ...full, species, legend }));
}
const hatched = {};
for (const r of run(few, 1.2, { ...full, cards: ['feuer', 'schnapp', 'schwanz', 'glutregen'] })) if (r.species) hatched[r.species] = (hatched[r.species] ?? 0) + 1;
report('  Karten: Schwanz + Glutregen', run(few, 1.2, { ...full, cards: ['feuer', 'schnapp', 'schwanz', 'glutregen'] }));
report('  Karten: Rauch + Brüllen', run(few, 1.2, { ...full, cards: ['feuer', 'schnapp', 'rauch', 'bruellen'] }));
report(`  Endlos (bis Nacht ${ENDLESS_CAP})`, run(few, 1.2, { ...full, mode: 'endless' }));
console.log(`  Geschlüpft: ${Object.entries(hatched).map(([k, v]) => `${k} ${v}`).join(' · ') || '–'}`);
console.log(`\n${runs} Runs in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

if (withCards <= passive) fail('Atem-Karten bringen dem Bot nichts – da stimmt etwas nicht.');
if (BASE_CARDS.length !== 4) fail('Die Grundhand muss vier Karten haben.');
