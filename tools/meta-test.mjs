// Tests für die Meta-Progression und die Spiellogik dahinter: Glut, Werkstatt, Deck, Taten, Erzfeinde,
// Schlüpfen, Zusammenführen, alte Spielstände und dass ein Run aus seinem Seed exakt nachspielbar ist.
//
//   node tools/meta-test.mjs

import assert from 'node:assert/strict';
import * as Sim from '../src/sim.js';
import * as Meta from '../src/meta.js';
import { META, UNLOCKS, BASE_DECK, DECK_SIZE, STANDARD_RULES, CONFIG } from '../src/data.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (e) {
    console.error(`✗ ${name}\n  ${e.stack}`);
    process.exit(1);
  }
}

// Ein gewonnener Run mit allem, was die Auswertung braucht
function wonRun(options = {}, patch = {}) {
  const state = Sim.createRun(42, options);
  state.phase = 'won';
  state.glut = 120;
  state.stats.nightsSurvived = 8;
  state.stats.defeated = 40;
  state.species = 'kristall';
  state.runLog.nights = [1, 2, 3, 4, 5, 6, 7, 8].map((night) => ({ night, abilities: 3, decoyEscapes: 0, stolen: 1 }));
  Object.assign(state.runLog, patch);
  return state;
}

function lostRun(lostBy = 'dieb', patch = {}, options = {}) {
  const state = Sim.createRun(7, options);
  state.phase = 'lost';
  state.glut = 55;
  state.lostBy = lostBy;
  state.stats.nightsSurvived = 3;
  state.runLog.nights = [1, 2, 3, 4].map((night) => ({ night, abilities: 2, decoyEscapes: 0, stolen: 1 }));
  Object.assign(state, patch);
  return state;
}

let seq = 0;
const rand = () => ((seq = (seq * 9301 + 49297) % 233280) / 233280);

test('Neues Profil übersteht Speichern und Laden', () => {
  const p = Meta.newProfile();
  assert.deepEqual(Meta.sanitizeProfile(JSON.parse(JSON.stringify(p))), p);
  assert.equal(p.deck.length, DECK_SIZE);
});

test('Kaputte oder fremde Daten ergeben ein frisches Profil', () => {
  for (const junk of [null, 42, 'x', { version: 99 }, { version: 2, species: 'kaputt', unlocks: 'nein', nemeses: [{}], deck: ['gibtsnicht'] }]) {
    const p = Meta.sanitizeProfile(junk);
    assert.ok(p.species.gold);
    assert.deepEqual(p.unlocks, []);
    assert.deepEqual(p.nemeses, []);
    assert.deepEqual(p.deck, BASE_DECK);
  }
});

test('Alter Spielstand: Drachen, Legende und Erzfeinde bleiben, für Freischaltungen gibt es Glut', () => {
  const old = {
    version: 1,
    species: { gold: { hatched: 2, xp: 300, legend: 3, variant: 1 }, kristall: { hatched: 1, xp: 20, legend: 0, variant: 0 } },
    unlocks: ['krone', 'endlos', 'woche', 'rauch'],
    deeds: ['brut', 'koeder', 'schmied'],
    loadout: ['feuer'],
    seen: { treasures: ['ei', 'krone', 'gibtsnicht'], heroes: ['dieb'] },
    nemeses: [{ id: 'eX', name: 'Kunibert Langfinger', type: 'dieb', treasure: 'krone', rank: 2 }],
    trophies: [],
    stats: { runs: 6, wins: 2, nights: 30, defeated: 200 },
    best: { endless: 9, weekly: null },
    choice: { species: 'kristall', legend: 0, mode: 'endless' },
    introSeen: true,
  };
  const p = Meta.sanitizeProfile(old);
  assert.equal(p.version, Meta.PROFILE_VERSION);
  assert.equal(p.species.gold.legend, 3);
  assert.ok(p.species.kristall);
  assert.equal(p.nemeses[0].glut, 0);
  assert.equal(p.nemeses[0].treasure, 'krone');
  assert.ok(Meta.glutOf(p) > 0, 'Glut als Ausgleich');
  assert.ok(p.unlocks.includes('endlos') && p.unlocks.includes('woche'));
  assert.ok(p.unlocks.includes('narrengold'), 'Belohnung der alten Tat Köderkönig');
  assert.ok(!p.deeds.includes('schmied'), 'Taten, die es nicht mehr gibt, fallen weg');
  assert.deepEqual(p.seen.treasures, ['ei', 'krone']);
  assert.equal(p.introSeen, false, 'Das neue Spiel wird erklärt');
});

test('Sieg: Glut kommt nach Hause, neue Art, Legende und Taten', () => {
  const { profile, report } = Meta.applyRun(Meta.newProfile(), wonRun(), { rand, now: 1000 });
  assert.equal(report.glutBanked, 120);
  assert.equal(Meta.glutOf(profile), 120);
  assert.equal(report.hatched, 'kristall');
  assert.ok(report.newSpecies);
  assert.ok(profile.species.kristall);
  assert.equal(profile.species.gold.legend, 1);
  assert.ok(report.deeds.includes('brut'));
  assert.ok(profile.unlocks.includes('endlos') && profile.unlocks.includes('woche'));
  assert.equal(profile.stats.wins, 1);
  assert.equal(profile.updatedAt, 1000);
});

test('Dieselbe Art noch einmal ausgebrütet gibt eine Farbvariante', () => {
  const p = Meta.applyRun(Meta.newProfile(), wonRun(), { rand }).profile;
  const { profile, report } = Meta.applyRun(p, wonRun(), { rand });
  assert.ok(!report.newSpecies);
  assert.ok(report.newVariant);
  assert.equal(profile.species.kristall.hatched, 2);
  assert.equal(Meta.variantsOf(profile, 'kristall'), 2);
});

test('Ei verloren: Der Dieb trägt die Glut fort und wird zum Erzfeind', () => {
  const { profile, report } = Meta.applyRun(Meta.newProfile(), lostRun('magier'), { rand, now: 5000 });
  assert.equal(Meta.glutOf(profile), 0);
  assert.equal(report.glutBanked, 0);
  assert.equal(report.glutLostTo.type, 'magier');
  assert.equal(profile.nemeses.length, 1);
  assert.equal(profile.nemeses[0].glut, 55);
  assert.equal(profile.nemeses[0].treasure, null);
  assert.equal(profile.species.gold.legend, 0);
});

test('Stiehlt ein Erzfeind das Ei, wächst seine Glut', () => {
  const nemesis = { id: 'eA', name: 'Hedwig Steinbart', type: 'zwerg', treasure: null, glut: 30, rank: 1 };
  const p = Meta.newProfile();
  p.nemeses = [nemesis];
  const state = lostRun('zwerg', { lostNemesis: 'eA' }, { nemeses: [nemesis] });
  state.runLog.nemesisEscaped = ['eA'];
  const { profile } = Meta.applyRun(p, state, { rand });
  assert.equal(profile.nemeses.length, 1);
  assert.equal(profile.nemeses[0].glut, 85);
  assert.equal(profile.nemeses[0].rank, 2);
});

test('Siegfried behält die Glut und bringt sie in der letzten Nacht mit', () => {
  const { profile } = Meta.applyRun(Meta.newProfile(), lostRun('siegfried'), { rand });
  const sieg = profile.nemeses.find((n) => n.type === 'siegfried');
  assert.equal(sieg.glut, 55);
  const state = Sim.createRun(11, Meta.runOptions(profile));
  assert.deepEqual(state.nemesesWaiting, [], 'Siegfried kommt nicht als zusätzlicher Held');
  state.night = state.nights;
  state.phase = 'dig';
  state.offers = [];
  Sim.skipDig(state);
  assert.ok(state.party.some((p) => p.type === 'siegfried'));
  Sim.startNight(state);
  Sim.update(state, 6);
  const h = state.heroes.find((x) => x.type === 'siegfried');
  assert.ok(h, 'Siegfried ist da');
  assert.equal(h.glut, 55);
  assert.equal(h.nemesis, sieg.id);
});

test('In Endlos und Wochen-Hort geht keine Glut verloren', () => {
  const p = Meta.newProfile();
  p.unlocks = ['endlos', 'woche'];
  for (const mode of ['endless', 'weekly']) {
    const { profile, report } = Meta.applyRun(p, lostRun('dieb', {}, { mode }), { rand });
    assert.equal(report.glutBanked, 55, mode);
    assert.equal(profile.nemeses.length, 0, mode);
  }
});

test('Erzfeinde entstehen, steigen auf und werden zur Trophäe', () => {
  let { profile, report } = Meta.applyRun(Meta.newProfile(), wonRun({}, { newNemeses: [{ type: 'dieb', treasure: 'kelch' }, { type: 'zwerg', treasure: 'barren' }] }), { rand, now: 5000 });
  assert.equal(profile.nemeses.length, 2);
  assert.equal(report.nemesesNew.length, 2);
  const [first, second] = profile.nemeses;
  assert.match(first.name, /^\S+ \S+$/);
  ({ profile, report } = Meta.applyRun(profile, wonRun({}, { nemesisEscaped: [first.id] }), { rand }));
  assert.equal(profile.nemeses.find((n) => n.id === first.id).rank, 2);
  const state = wonRun({ nemeses: profile.nemeses }, { nemesisDefeated: [second.id] });
  ({ profile, report } = Meta.applyRun(profile, state, { rand, now: 9000 }));
  assert.equal(profile.nemeses.length, 1);
  assert.equal(profile.trophies.length, 1);
  assert.equal(profile.trophies[0].name, second.name);
  assert.ok(report.deeds.includes('rache'));
});

test('Höchstens drei Erzfeinde gleichzeitig', () => {
  const many = Array.from({ length: 5 }, () => ({ type: 'dieb', treasure: 'kelch' }));
  const { profile } = Meta.applyRun(Meta.newProfile(), wonRun({}, { newNemeses: many }), { rand });
  assert.equal(profile.nemeses.length, META.nemesisMax);
});

test('Taten werden aus dem Protokoll erkannt', () => {
  const state = lostRun('dieb');
  state.stats.nightsSurvived = 4;
  Object.assign(state.runLog, {
    nights: [
      { night: 1, abilities: 2, decoyEscapes: 3, stolen: 0 },
      { night: 2, abilities: 0, decoyEscapes: 0, stolen: 1 },
      { night: 3, abilities: 1, decoyEscapes: 0, stolen: 0 },
      { night: 4, abilities: 1, decoyEscapes: 0, stolen: 1 },
    ],
    keystone: true,
    maxDepth: 4,
    siegfried: { killed: true, touchedEgg: false },
  });
  const { profile, report } = Meta.applyRun(Meta.newProfile(), state, { rand });
  for (const id of ['koeder', 'still', 'schluss', 'unberuehrt', 'tief', 'lindenblatt']) assert.ok(report.deeds.includes(id), id);
  assert.ok(profile.unlocks.includes('narrengold') && profile.unlocks.includes('mimik'));
  assert.ok(!report.deeds.includes('brut'));
});

test('Werkstatt: Glut gegen Baupläne und Schlusssteine', () => {
  const p = Meta.newProfile();
  p.glutEarned = 100;
  assert.equal(Meta.buyUnlock(p, 'steinschlag').ok, true);
  const after = Meta.buyUnlock(p, 'steinschlag').profile;
  assert.equal(Meta.glutOf(after), 100 - UNLOCKS.steinschlag.glut);
  assert.ok(Meta.availableBuildings(after).includes('steinschlag'));
  assert.equal(Meta.buyUnlock(after, 'steinschlag').ok, false, 'Nicht zweimal kaufen');
  const poor = Meta.newProfile();
  assert.equal(Meta.buyUnlock(poor, 'mimik').ok, false);
  assert.match(Meta.buyUnlock(poor, 'mimik').reason, /Glut/);
});

test('Deck: genau acht Baupläne, nur was freigeschaltet ist', () => {
  const p = Meta.newProfile();
  p.unlocks = ['mimik', 'steinschlag'];
  p.deck = ['mimik', 'speer', 'speer', 'gibtsnicht', 'narrengold'];
  const deck = Meta.validDeck(p);
  assert.equal(deck.length, DECK_SIZE);
  assert.equal(deck[0], 'mimik');
  assert.ok(!deck.includes('narrengold'), 'Narrengold ist nicht freigeschaltet');
  assert.equal(new Set(deck).size, DECK_SIZE);
  const state = Sim.createRun(5, Meta.runOptions({ ...p, deck }));
  assert.equal(state.deck.draw.length + state.deck.hand.length, DECK_SIZE);
});

test('Gesperrte Modi und Stufen fallen auf Erlaubtes zurück', () => {
  const p = Meta.newProfile();
  p.choice.mode = 'endless';
  p.choice.legend = 7;
  const o = Meta.runOptions(p);
  assert.equal(o.mode, 'normal');
  assert.equal(o.legend, 0);
});

test('Wochen-Hort und Hort-Codes nutzen feste Regeln', () => {
  const p = Meta.newProfile();
  p.unlocks = Object.keys(UNLOCKS);
  p.choice = { species: 'gold', legend: 3, mode: 'weekly' };
  const o = Meta.runOptions(p);
  assert.equal(o.mode, 'weekly');
  assert.deepEqual(o.deck, STANDARD_RULES.deck);
  assert.deepEqual(o.unlocks, []);
  assert.equal(o.legend, 0);
  assert.equal(Meta.weekKey(new Date(2026, 9, 23)), '2026-W43');
  assert.equal(Meta.weekKey(new Date(2027, 0, 1)), '2026-W53');
});

test('Zwei Geräte: Fortschritt wird zusammengeführt, nichts geht verloren', () => {
  const a = Meta.newProfile();
  a.updatedAt = 10;
  a.glutEarned = 200;
  a.glutSpent = 40;
  a.unlocks = ['mimik'];
  a.deeds = ['still'];
  a.trophies = [{ id: 'eA-1', name: 'Ulrich Langfinger', type: 'dieb', treasure: 'kelch', rank: 1, at: 1 }];
  const b = Meta.newProfile();
  b.updatedAt = 20;
  b.glutEarned = 150;
  b.glutSpent = 75;
  b.species.kristall = { hatched: 1, legend: 0, variant: 0 };
  b.unlocks = ['steinschlag'];
  b.nemeses = [{ id: 'eA', name: 'Ulrich Langfinger', type: 'dieb', treasure: 'kelch', glut: 0, rank: 2 }];
  const m = Meta.mergeProfiles(a, b);
  assert.equal(m.glutEarned, 200);
  assert.equal(m.glutSpent, 75);
  assert.ok(m.species.kristall);
  assert.deepEqual(m.unlocks.sort(), ['mimik', 'steinschlag']);
  assert.deepEqual(m.deeds, ['still']);
  assert.equal(m.nemeses.length, 0, 'Auf dem anderen Gerät besiegt – also kein Erzfeind mehr');
  assert.deepEqual(Meta.mergeProfiles(m, m), m);
});

test('Schlüpfen: Köder, Edelsteine oder viele Gefallene', () => {
  const state = Sim.createRun(1);
  assert.equal(Sim.computeHatch(state), 'gold');
  state.hoard.push({ uid: 900, id: 'rubin' }, { uid: 901, id: 'saphir' });
  assert.equal(Sim.computeHatch(state), 'kristall');
  state.hoard = state.hoard.filter((i) => i.id !== 'rubin');
  state.stats.defeated = 80;
  assert.equal(Sim.computeHatch(state), 'knochen');
  state.runLog.nights.push({ night: 3, abilities: 0, decoyEscapes: 3, stolen: 0 });
  assert.equal(Sim.computeHatch(state), 'mond');
});

// Ein Run nur aus Seed und Entscheidungen: zweimal gespielt, muss genau gleich ausgehen
function scripted(seed) {
  const s = Sim.createRun(seed);
  const log = [];
  for (let n = 0; n < 4 && s.phase !== 'lost'; n++) {
    if (s.offers.length) Sim.dig(s, 0, Sim.digDirections(s)[0].dir);
    else Sim.skipDig(s);
    for (let i = s.deck.hand.length - 1; i >= 0; i--) {
      for (let r = 1; r < 16; r++) for (let c = 0; c < 15; c++) if (s.deck.hand[i] && Sim.canPlace(s, s.deck.hand[i], c, r).ok && s.gold >= 30) Sim.playCard(s, i, c, r);
    }
    Sim.startNight(s);
    while (s.phase === 'night') Sim.update(s, 0.25);
    log.push(`${s.phase}:${s.gold}:${s.glut}:${s.stats.defeated}:${s.hoard.length}`);
    if (s.phase === 'morning') Sim.nextDay(s);
  }
  return log.join('|');
}

test('Gleicher Seed, gleiche Entscheidungen – gleicher Run', () => {
  assert.equal(scripted(123), scripted(123));
  assert.notEqual(scripted(123), scripted(456));
});

test('Spielstand eines Runs übersteht Speichern und Laden', () => {
  const s = Sim.createRun(77);
  Sim.dig(s, 0, Sim.digDirections(s)[0].dir);
  const copy = Sim.restore(Sim.snapshot(s));
  assert.deepEqual(copy.tiles, s.tiles);
  assert.deepEqual(copy.deck, s.deck);
  assert.equal(copy.phase, 'build');
  assert.equal(Sim.restore('{"version":1}'), null);
});

test('Graben: Die Hortkammer zieht weiter, der Weg wird länger', () => {
  const s = Sim.createRun(3);
  const before = s.tiles.filter((t) => t === '.').length;
  const { cx, cy } = s.chamber;
  const dir = Sim.digDirections(s)[0];
  Sim.dig(s, 0, dir.dir);
  assert.deepEqual([s.chamber.cx, s.chamber.cy], [dir.cx, dir.cy]);
  assert.ok(s.pieces.some((p) => p.cx === cx && p.cy === cy));
  assert.equal(s.tiles.filter((t) => t === '.').length, before + 3);
  assert.equal(s.phase, 'build');
  assert.equal(s.deck.hand.length, CONFIG.handSize);
});

test('Türme: Punkte nur mit Erfahrung, Knoten nur am Baum entlang', () => {
  const s = Sim.createRun(9);
  Sim.dig(s, 0, Sim.digDirections(s)[0].dir);
  s.gold = 500;
  s.deck.hand = ['speer'];
  let spot = null;
  for (let r = 1; r < 16 && !spot; r++) for (let c = 0; c < 15 && !spot; c++) if (Sim.canPlace(s, 'speer', c, r).ok) spot = { c, r };
  const { uid } = Sim.playCard(s, 0, spot.c, spot.r);
  const b = Sim.buildingByUid(s, uid);
  assert.equal(Sim.learnNode(s, uid, 'A1').ok, false, 'ohne Punkt');
  b.level = 2;
  assert.equal(Sim.learnNode(s, uid, 'A3').ok, false, 'nicht erreichbar');
  assert.equal(Sim.learnNode(s, uid, 'A1').ok, true);
  assert.equal(Sim.learnNode(s, uid, 'A2').ok, true);
  assert.equal(Sim.pointsLeft(b), 0);
  assert.ok(Sim.towerStats(s, b).crit > 0);
  b.level = 9;
  assert.equal(Sim.nodeState(s, b, 'A4'), 'blocked');
  assert.equal(Sim.learnNode(s, uid, 'S').ok, true, 'Fassung über A2 erreichbar');
  assert.equal(Sim.towerStats(s, b).sockets, 2);
  for (const n of ['B2', 'B3']) assert.equal(Sim.learnNode(s, uid, n).ok, true, n);
  assert.equal(Sim.nodeState(s, b, 'B4'), 'locked', 'Speerhagel erst in der Werkstatt');
  assert.equal(Sim.respec(s, uid).ok, true);
  assert.deepEqual(b.nodes, ['R']);
});

console.log(`${passed} Tests bestanden`);
