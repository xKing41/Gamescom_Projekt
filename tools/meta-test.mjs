// Tests für die Meta-Progression: Erfahrung, Freischaltungen, Taten, Erzfeinde, Zusammenführen.
//
//   node tools/meta-test.mjs

import assert from 'node:assert/strict';
import * as Sim from '../src/sim.js';
import * as Meta from '../src/meta.js';
import { META, UNLOCKS, BASE_CARDS, STANDARD_RULES } from '../src/data.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (e) {
    console.error(`✗ ${name}\n  ${e.message}`);
    process.exit(1);
  }
}

// Ein gewonnener Run mit allem, was die Auswertung braucht
function wonRun(options = {}, patch = {}) {
  const state = Sim.createRun(42, options);
  state.phase = 'won';
  state.stats.nightsSurvived = 6;
  state.stats.defeated = 40;
  state.species = 'kristall';
  state.runLog.nights = [1, 2, 3, 4, 5, 6].map((night) => ({ night, cards: 3, decoyEscapes: 0, stolen: 1 }));
  Object.assign(state.runLog, patch);
  return state;
}

let seq = 0;
const rand = () => ((seq = (seq * 9301 + 49297) % 233280) / 233280);

test('Neues Profil übersteht Speichern und Laden', () => {
  const p = Meta.newProfile();
  assert.deepEqual(Meta.sanitizeProfile(JSON.parse(JSON.stringify(p))), p);
});

test('Kaputte oder fremde Daten ergeben ein frisches Profil', () => {
  for (const junk of [null, 42, 'x', { version: 99 }, { version: 1, species: 'kaputt', unlocks: 'nein', nemeses: [{}] }]) {
    const p = Meta.sanitizeProfile(junk);
    assert.ok(p.species.gold);
    assert.deepEqual(p.unlocks, []);
    assert.deepEqual(p.nemeses, []);
  }
});

test('Erster Sieg: Erfahrung, Stufe, neue Art, Legende und Tat', () => {
  const { profile, report } = Meta.applyRun(Meta.newProfile(), wonRun(), { rand, now: 1000 });
  assert.equal(report.xp, 6 * META.xpPerNight + 40 * META.xpPerDefeat + META.xpWin);
  assert.equal(report.levelBefore, 0);
  assert.equal(report.levelAfter, 1);
  assert.ok(profile.unlocks.includes('krone'), 'Golddrache Stufe 1 schaltet die Krone frei');
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
  let p = Meta.applyRun(Meta.newProfile(), wonRun(), { rand }).profile;
  const { profile, report } = Meta.applyRun(p, wonRun(), { rand });
  assert.ok(!report.newSpecies);
  assert.ok(report.newVariant);
  assert.equal(profile.species.kristall.hatched, 2);
  assert.equal(Meta.variantsOf(profile, 'kristall'), 2);
  p = profile;
});

test('Verlorener Run gibt trotzdem Erfahrung, aber keine Legende', () => {
  const state = Sim.createRun(7);
  state.phase = 'lost';
  state.stats.nightsSurvived = 3;
  state.stats.defeated = 12;
  const { profile, report } = Meta.applyRun(Meta.newProfile(), state, { rand });
  assert.equal(report.xp, 3 * META.xpPerNight + 12);
  assert.equal(profile.species.gold.legend, 0);
  assert.equal(report.hatched, null);
});

test('Erzfeinde entstehen, steigen auf und werden zur Trophäe', () => {
  let { profile, report } = Meta.applyRun(Meta.newProfile(), wonRun({}, { newNemeses: [{ type: 'dieb', treasure: 'kelch' }, { type: 'zwerg', treasure: 'barren' }] }), { rand, now: 5000 });
  assert.equal(profile.nemeses.length, 2);
  assert.equal(report.nemesesNew.length, 2);
  const [first, second] = profile.nemeses;
  assert.match(first.name, /^\S+ \S+$/);

  ({ profile, report } = Meta.applyRun(profile, wonRun({}, { nemesisEscaped: [first.id] }), { rand }));
  assert.equal(profile.nemeses.find((n) => n.id === first.id).rank, 2);

  ({ profile, report } = Meta.applyRun(profile, wonRun({}, { nemesisDefeated: [second.id] }), { rand, now: 9000 }));
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
  const nights = [
    { night: 1, cards: 0, decoyEscapes: 3, stolen: 0 },
    { night: 2, cards: 2, decoyEscapes: 0, stolen: 1 },
    { night: 3, cards: 1, decoyEscapes: 0, stolen: 0 },
  ];
  const state = Sim.createRun(3);
  state.phase = 'lost';
  state.stats.nightsSurvived = 3;
  Object.assign(state.runLog, { nights, landmark: true, maxHoard: 18 });
  const { profile, report } = Meta.applyRun(Meta.newProfile(), state, { rand });
  for (const id of ['koeder', 'still', 'schmied', 'unberuehrt', 'hort']) assert.ok(report.deeds.includes(id), id);
  assert.ok(profile.unlocks.includes('narrenkrone') && profile.unlocks.includes('steinwaechter'));
  assert.ok(!report.deeds.includes('brut'));
});

test('Zwei Geräte: Fortschritt wird zusammengeführt, nichts geht verloren', () => {
  const a = Meta.newProfile();
  a.updatedAt = 10;
  a.species.gold.xp = 100;
  a.unlocks = ['krone'];
  a.deeds = ['still'];
  a.trophies = [{ id: 'eA-1', name: 'Ulrich Langfinger', type: 'dieb', treasure: 'kelch', rank: 1, at: 1 }];
  const b = Meta.newProfile();
  b.updatedAt = 20;
  b.species.gold.xp = 60;
  b.species.kristall = { hatched: 1, xp: 30, legend: 0, variant: 0 };
  b.unlocks = ['saphir'];
  b.nemeses = [{ id: 'eA', name: 'Ulrich Langfinger', type: 'dieb', treasure: 'kelch', rank: 2 }];
  const m = Meta.mergeProfiles(a, b);
  assert.equal(m.species.gold.xp, 100);
  assert.ok(m.species.kristall);
  assert.deepEqual(m.unlocks.sort(), ['krone', 'saphir']);
  assert.deepEqual(m.deeds, ['still']);
  assert.equal(m.nemeses.length, 0, 'Auf dem anderen Gerät besiegt – also kein Erzfeind mehr');
  assert.equal(Meta.mergeProfiles(m, m).species.gold.xp, 100);
});

test('Wochen-Hort und Hort-Codes nutzen feste Regeln', () => {
  const p = Meta.newProfile();
  p.unlocks = Object.keys(UNLOCKS);
  p.choice = { species: 'gold', legend: 3, mode: 'weekly' };
  const o = Meta.runOptions(p);
  assert.equal(o.mode, 'weekly');
  assert.deepEqual(o.cards, STANDARD_RULES.cards);
  assert.deepEqual(o.unlocks, []);
  assert.equal(o.legend, 0);
  assert.equal(Meta.weekKey(new Date(2026, 9, 23)), '2026-W43');
  assert.equal(Meta.weekKey(new Date(2027, 0, 1)), '2026-W53');
  assert.equal(Meta.weekSeed('2026-W43'), Meta.weekSeed('2026-W43'));
});

test('Gesperrte Modi und Karten fallen auf Erlaubtes zurück', () => {
  const p = Meta.newProfile();
  p.choice.mode = 'endless';
  p.choice.legend = 7;
  p.loadout = ['glutregen', 'feuer'];
  const o = Meta.runOptions(p);
  assert.equal(o.mode, 'normal');
  assert.equal(o.legend, 0);
  assert.deepEqual(o.cards, ['feuer', ...BASE_CARDS.filter((c) => c !== 'feuer')]);
});

test('Run-Optionen kommen in der Spiellogik an', () => {
  const p = Meta.newProfile();
  p.species.knochen = { hatched: 1, xp: 0, legend: 4, variant: 0 };
  p.unlocks = ['schwanz', 'turm', 'karawane'];
  p.loadout = ['schwanz', 'feuer', 'schnapp', 'bruellen'];
  p.choice = { species: 'knochen', legend: 4, mode: 'normal' };
  const state = Sim.createRun(99, Meta.runOptions(p));
  assert.equal(state.opts.species, 'knochen');
  assert.equal(state.opts.legend, 4);
  assert.ok(state.mods.hiddenGroup);
  assert.deepEqual(state.opts.cards, ['schwanz', 'feuer', 'schnapp', 'bruellen']);
  assert.equal(state.realms.length, 3);
  assert.equal(Sim.itemAt(state, 4, 2).id, 'dolch', 'Start-Hort des Knochendrachen');
});

test('Schlüpfen hängt von den acht Feldern ums Ei ab', () => {
  const state = Sim.createRun(1);
  state.hoard.fill(null);
  const put = (id, c, r) => { state.hoard[r * 12 + c] = { uid: c * 100 + r, id }; };
  put('ei', 5, 3);
  assert.equal(Sim.computeHatch(state), 'gold');
  put('rubin', 4, 2);
  put('saphir', 6, 4);
  assert.equal(Sim.computeHatch(state), 'kristall');
  put('dolch', 4, 3);
  put('hacke', 6, 3);
  put('schild', 5, 4);
  assert.equal(Sim.computeHatch(state), 'knochen');
  put('katzengold', 5, 2);
  put('narrengold', 4, 3);
  assert.equal(Sim.computeHatch(state), 'mond');
});

console.log(`${passed} Tests bestanden`);
