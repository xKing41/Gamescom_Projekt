// Alles, was zwischen den Runs bleibt: Drachenarten, Glut, Werkstatt, Deck, Legende, Taten, Erzfeinde, Hortbuch.
// Reine Funktionen ohne Speicher und ohne Grafik.
//
// Glut ist die Währung zwischen den Runs. Wer gewinnt, bringt sie nach Hause.
// Wer das Ei verliert, verliert auch die Glut: Der Dieb trägt sie fort und kommt als Erzfeind zurück.

import { SPECIES, SPECIES_ORDER, DEEDS, UNLOCKS, LEGEND, META, BUILDINGS, BUILDING_ORDER, BASE_DECK, DECK_SIZE, STANDARD_RULES, TREASURES, FINDS, HEROES, GEAR, ENTRANCES, PIECES } from './data.js';
import { hoardValue } from './sim.js';

export const PROFILE_VERSION = 2;

const newSpecies = () => ({ hatched: 1, legend: 0, variant: 0 });

export function newProfile() {
  return {
    version: PROFILE_VERSION,
    updatedAt: 0,
    species: { gold: newSpecies() },
    glutEarned: 0,
    glutSpent: 0,
    unlocks: [],
    deeds: [],
    deck: BASE_DECK.slice(),
    seen: { treasures: [], heroes: [], gear: [], buildings: [] },
    nemeses: [],
    trophies: [],
    stats: { runs: 0, wins: 0, nights: 0, defeated: 0 },
    best: { endless: 0, weekly: null },
    choice: { species: 'gold', legend: 0, mode: 'normal' },
    introSeen: false,
  };
}

const list = (value, ok = () => true) => (Array.isArray(value) ? [...new Set(value.filter(ok))] : []);
const num = (value, min = 0) => (Number.isFinite(value) ? Math.max(min, value) : min);
export const glutOf = (p) => Math.max(0, p.glutEarned - p.glutSpent);

function cleanNemesis(n) {
  if (!n || typeof n.id !== 'string' || !HEROES[n.type]) return null;
  return {
    id: n.id,
    name: String(n.name),
    type: n.type,
    treasure: n.treasure && TREASURES[n.treasure] ? n.treasure : null,
    glut: Math.floor(num(n.glut)),
    rank: Math.max(1, Math.min(META.nemesisMaxRank, Math.floor(num(n.rank, 1)))),
  };
}

// Macht aus einem gespeicherten (vielleicht alten oder kaputten) Stand ein gültiges Profil
export function sanitizeProfile(raw) {
  const base = newProfile();
  if (!raw || typeof raw !== 'object') return base;
  if (raw.version === 1) return migrateV1(raw);
  if (raw.version !== PROFILE_VERSION) return base;
  const p = { ...base, updatedAt: num(raw.updatedAt) };
  p.species = {};
  for (const id of SPECIES_ORDER) {
    const s = raw.species?.[id];
    if (!s && id !== 'gold') continue;
    p.species[id] = {
      hatched: Math.max(1, Math.floor(num(s?.hatched, 1))),
      legend: Math.min(LEGEND.length, Math.floor(num(s?.legend))),
      variant: Math.floor(num(s?.variant)),
    };
  }
  p.glutEarned = Math.floor(num(raw.glutEarned));
  p.glutSpent = Math.min(p.glutEarned, Math.floor(num(raw.glutSpent)));
  p.unlocks = list(raw.unlocks, (id) => UNLOCKS[id]);
  p.deeds = list(raw.deeds, (id) => DEEDS.some((d) => d.id === id));
  p.deck = list(raw.deck, (id) => BUILDINGS[id]);
  p.deck = validDeck(p);
  p.seen = {
    treasures: list(raw.seen?.treasures, (id) => TREASURES[id]),
    heroes: list(raw.seen?.heroes, (id) => HEROES[id]),
    gear: list(raw.seen?.gear, (id) => GEAR[id]),
    buildings: list(raw.seen?.buildings, (id) => BUILDINGS[id]),
  };
  p.nemeses = (Array.isArray(raw.nemeses) ? raw.nemeses : []).map(cleanNemesis).filter(Boolean).slice(0, META.nemesisMax);
  p.trophies = (Array.isArray(raw.trophies) ? raw.trophies : [])
    .filter((t) => t && HEROES[t.type])
    .map((t) => ({ id: String(t.id ?? `${t.name}-${t.at}`), name: String(t.name), type: t.type, treasure: t.treasure && TREASURES[t.treasure] ? t.treasure : null, rank: Math.floor(num(t.rank, 1)), at: num(t.at) }));
  p.stats = { runs: num(raw.stats?.runs), wins: num(raw.stats?.wins), nights: num(raw.stats?.nights), defeated: num(raw.stats?.defeated) };
  p.best = {
    endless: num(raw.best?.endless),
    weekly: raw.best?.weekly && typeof raw.best.weekly.week === 'string' ? { week: raw.best.weekly.week, nights: num(raw.best.weekly.nights), value: num(raw.best.weekly.value) } : null,
  };
  const choice = raw.choice ?? {};
  p.choice = {
    species: p.species[choice.species] ? choice.species : 'gold',
    legend: Math.floor(num(choice.legend)),
    mode: ['normal', 'endless', 'weekly'].includes(choice.mode) ? choice.mode : 'normal',
  };
  p.introSeen = !!raw.introSeen;
  return p;
}

// Ein Stand aus der Zeit vor der wachsenden Höhle: Drachen, Legende, Statistik und Erzfeinde bleiben,
// für alte Freischaltungen gibt es Glut. Die Einführung zeigt das Spiel neu.
function migrateV1(raw) {
  const v2 = sanitizeProfile({
    ...raw,
    version: PROFILE_VERSION,
    glutEarned: Math.min(200, 15 * num(raw.stats?.runs) + 10 * (Array.isArray(raw.unlocks) ? raw.unlocks.length : 0)),
    glutSpent: 0,
    unlocks: list(raw.unlocks, (id) => id === 'endlos' || id === 'woche'),
    deck: BASE_DECK,
    seen: { treasures: raw.seen?.treasures, heroes: raw.seen?.heroes },
    introSeen: false,
  });
  // Taten, die es noch gibt, bleiben – samt ihrer Belohnung
  for (const id of v2.deeds) for (const u of DEEDS.find((d) => d.id === id)?.unlock ?? []) if (!v2.unlocks.includes(u)) v2.unlocks.push(u);
  return v2;
}

// ── Abfragen ────────────────────────────────────────────────────

export const hasUnlock = (p, id) => p.unlocks.includes(id);
export const availableBuildings = (p) => BUILDING_ORDER.filter((id) => !BUILDINGS[id].unlock || hasUnlock(p, BUILDINGS[id].unlock));
export const variantsOf = (p, species) => Math.min(p.species[species]?.hatched ?? 0, SPECIES[species].palettes.length);
export const maxLegend = (p, species) => p.species[species]?.legend ?? 0;

export function modeAvailable(p, mode) {
  if (mode === 'normal') return true;
  if (mode === 'endless') return hasUnlock(p, 'endlos');
  if (mode === 'weekly') return hasUnlock(p, 'woche');
  return false;
}

// Das Deck hat immer genau acht Baupläne: gewählte zuerst, fehlende aus der Sammlung aufgefüllt
export function validDeck(p) {
  const ok = availableBuildings(p);
  const deck = (p.deck ?? []).filter((id, i, all) => ok.includes(id) && all.indexOf(id) === i).slice(0, DECK_SIZE);
  for (const id of [...BASE_DECK, ...ok]) if (deck.length < DECK_SIZE && !deck.includes(id) && ok.includes(id)) deck.push(id);
  return deck;
}

// Was man in der Werkstatt mit Glut freischalten kann
export function workshop(p) {
  return Object.entries(UNLOCKS)
    .filter(([, u]) => u.glut)
    .map(([id, u]) => ({ id, ...u, owned: hasUnlock(p, id) }));
}

export function buyUnlock(prev, id) {
  const u = UNLOCKS[id];
  if (!u?.glut || hasUnlock(prev, id)) return { ok: false, reason: '' };
  if (glutOf(prev) < u.glut) return { ok: false, reason: `Dafür brauchst du ${u.glut} Glut.` };
  const p = structuredClone(prev);
  p.glutSpent += u.glut;
  p.unlocks.push(id);
  return { ok: true, profile: p };
}

// ISO-Kalenderwoche, z. B. „2026-W43“ – daraus entsteht der Wochen-Hort
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function weekSeed(key) {
  let h = 2166136261;
  for (const ch of `hort:${key}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Die Optionen für den nächsten Run, so wie sie in der Höhle gewählt sind
export function runOptions(p, mode = p.choice.mode) {
  if (mode === 'weekly' || mode === 'code') return { ...STANDARD_RULES, deck: STANDARD_RULES.deck.slice(), mode };
  const species = p.species[p.choice.species] ? p.choice.species : 'gold';
  return {
    species,
    variant: Math.min(p.species[species].variant, variantsOf(p, species) - 1),
    legend: Math.min(p.choice.legend, maxLegend(p, species)),
    deck: validDeck(p),
    unlocks: p.unlocks.slice(),
    nemeses: p.nemeses.map((n) => ({ ...n })),
    mode: modeAvailable(p, mode) ? mode : 'normal',
  };
}

// ── Nach dem Run ────────────────────────────────────────────────

function makeNemesisName(type, rand) {
  const name = META.names[Math.floor(rand() * META.names.length)];
  const epithets = META.epithets[type] ?? META.epithets.dieb;
  return `${name} ${epithets[Math.floor(rand() * epithets.length)]}`;
}

function checkDeeds(state, won) {
  const log = state.runLog;
  const done = [];
  const survived = log.nights.slice(0, state.stats.nightsSurvived);
  if (log.nights.some((n) => n.decoyEscapes >= 3)) done.push('koeder');
  if (survived.some((n) => n.night >= 2 && n.abilities === 0)) done.push('still');
  if (won) done.push('brut');
  if (log.keystone) done.push('schluss');
  if (survived.some((n) => n.night >= 3 && n.stolen === 0)) done.push('unberuehrt');
  if (log.nemesisDefeated.some((id) => state.opts.nemeses.find((n) => n.id === id)?.type !== 'siegfried')) done.push('rache');
  if (log.maxDepth >= 4) done.push('tief');
  if (log.siegfried?.killed && !log.siegfried.touchedEgg) done.push('lindenblatt');
  if (won && state.opts.legend >= 5) done.push('legende');
  return done;
}

function unlock(p, id, report) {
  if (!UNLOCKS[id] || p.unlocks.includes(id)) return;
  p.unlocks.push(id);
  report.unlocked.push(id);
}

// Wertet einen beendeten Run aus. Gibt ein neues Profil und einen Bericht für die Anzeige zurück.
export function applyRun(prev, state, { rand = Math.random, now = Date.now() } = {}) {
  const p = structuredClone(prev);
  const o = state.opts;
  const won = state.phase === 'won';
  const nights = state.stats.nightsSurvived;
  const report = {
    species: o.species,
    mode: o.mode,
    won,
    nights,
    glut: state.glut,
    glutBanked: 0,
    glutLostTo: null,
    unlocked: [],
    deeds: [],
    hatched: null,
    newSpecies: false,
    newVariant: false,
    legendUnlocked: null,
    nemesesNew: [],
    nemesesBeaten: [],
    nemesesRanked: [],
    endlessBest: false,
    weeklyBest: false,
  };

  // Erzfeinde: besiegt (ihre Glut ist schon im Run), wieder entkommen, neu
  const log = state.runLog;
  for (const id of log.nemesisDefeated) {
    const n = p.nemeses.find((x) => x.id === id);
    if (!n) continue;
    p.nemeses = p.nemeses.filter((x) => x.id !== id);
    p.trophies.push({ id: `${n.id}-${now}`, name: n.name, type: n.type, treasure: n.treasure, rank: n.rank, at: now });
    report.nemesesBeaten.push(n);
  }
  for (const id of log.nemesisEscaped) {
    const n = p.nemeses.find((x) => x.id === id);
    if (!n || n.rank >= META.nemesisMaxRank) continue;
    n.rank += 1;
    report.nemesesRanked.push({ ...n });
  }
  for (const fresh of log.newNemeses) {
    if (p.nemeses.length >= META.nemesisMax) break;
    const n = { id: `e${now.toString(36)}${Math.floor(rand() * 1e6).toString(36)}`, name: makeNemesisName(fresh.type, rand), type: fresh.type, treasure: fresh.treasure, glut: 0, rank: 1 };
    p.nemeses.push(n);
    report.nemesesNew.push(n);
  }

  // Glut: Ein Sieg bringt sie nach Hause. Wer das Ei verliert, verliert sie an den Dieb.
  if (won || o.mode !== 'normal') {
    p.glutEarned += state.glut;
    report.glutBanked = state.glut;
  } else if (state.glut > 0 && state.lostBy) {
    let thief = state.lostNemesis ? p.nemeses.find((n) => n.id === state.lostNemesis) : null;
    if (!thief && state.lostBy === 'siegfried') thief = p.nemeses.find((n) => n.type === 'siegfried');
    if (!thief && p.nemeses.length < META.nemesisMax) {
      thief = { id: `e${now.toString(36)}g${Math.floor(rand() * 1e6).toString(36)}`, name: state.lostBy === 'siegfried' ? 'Siegfried' : makeNemesisName(state.lostBy, rand), type: state.lostBy, treasure: null, glut: 0, rank: 1 };
      p.nemeses.push(thief);
      report.nemesesNew.push(thief);
    }
    thief ??= p.nemeses[0];
    thief.glut += state.glut;
    report.glutLostTo = { ...thief };
  }

  // Schlüpfen: eine neue Art oder eine neue Farbe
  if (won && state.species) {
    report.hatched = state.species;
    const target = p.species[state.species];
    if (!target) {
      p.species[state.species] = newSpecies();
      report.newSpecies = true;
    } else {
      target.hatched += 1;
      report.newVariant = target.hatched <= SPECIES[state.species].palettes.length;
    }
  }

  // Legende: Wer auf der höchsten offenen Stufe gewinnt, öffnet die nächste
  const sp = p.species[o.species] ?? (p.species[o.species] = newSpecies());
  if (won && o.mode === 'normal' && o.legend >= sp.legend && sp.legend < LEGEND.length) {
    sp.legend = o.legend + 1;
    report.legendUnlocked = sp.legend;
  }

  // Taten und ihre Belohnungen
  for (const id of checkDeeds(state, won)) {
    if (p.deeds.includes(id)) continue;
    p.deeds.push(id);
    report.deeds.push(id);
    for (const u of DEEDS.find((d) => d.id === id).unlock ?? []) unlock(p, u, report);
  }

  // Hortbuch, Statistik, Bestwerte
  const union = (a, b) => [...new Set([...a, ...b])];
  p.seen.treasures = union(p.seen.treasures, log.treasuresSeen);
  p.seen.heroes = union(p.seen.heroes, log.heroesSeen);
  p.seen.gear = union(p.seen.gear, log.gearSeen);
  p.seen.buildings = union(p.seen.buildings, log.buildingsSeen);
  p.stats.runs += 1;
  p.stats.wins += won ? 1 : 0;
  p.stats.nights += nights;
  p.stats.defeated += state.stats.defeated;
  if (o.mode === 'endless' && nights > p.best.endless) {
    p.best.endless = nights;
    report.endlessBest = true;
  }
  if (o.mode === 'weekly') {
    const week = weekKey(new Date(now));
    const value = hoardValue(state);
    const prevBest = p.best.weekly?.week === week ? p.best.weekly : null;
    if (!prevBest || nights > prevBest.nights || (nights === prevBest.nights && value > prevBest.value)) {
      p.best.weekly = { week, nights, value };
      report.weeklyBest = true;
    }
  }
  p.updatedAt = now;
  return { profile: p, report };
}

// ── Zwei Stände zusammenführen (Handy und PC) ───────────────────

// Fortschritt wächst nur: Wir nehmen von beiden Seiten jeweils das Größere bzw. die Vereinigung.
export function mergeProfiles(a, b) {
  if (!a) return b;
  if (!b) return a;
  const newer = (a.updatedAt ?? 0) >= (b.updatedAt ?? 0) ? a : b;
  const older = newer === a ? b : a;
  const p = structuredClone(newer);
  for (const [id, s] of Object.entries(older.species)) {
    const t = p.species[id];
    if (!t) p.species[id] = { ...s };
    else {
      t.hatched = Math.max(t.hatched, s.hatched);
      t.legend = Math.max(t.legend, s.legend);
    }
  }
  p.glutEarned = Math.max(p.glutEarned, older.glutEarned);
  p.glutSpent = Math.min(p.glutEarned, Math.max(p.glutSpent, older.glutSpent));
  const union = (x, y) => [...new Set([...x, ...y])];
  p.unlocks = union(p.unlocks, older.unlocks);
  p.deeds = union(p.deeds, older.deeds);
  p.seen = {
    treasures: union(p.seen.treasures, older.seen.treasures),
    heroes: union(p.seen.heroes, older.seen.heroes),
    gear: union(p.seen.gear, older.seen.gear),
    buildings: union(p.seen.buildings, older.seen.buildings),
  };
  const trophyIds = new Set(p.trophies.map((t) => t.id));
  for (const t of older.trophies) if (!trophyIds.has(t.id)) p.trophies.push(t);
  const beaten = new Set(p.trophies.map((t) => t.id.split('-')[0]));
  p.nemeses = p.nemeses.filter((n) => !beaten.has(n.id));
  for (const key of Object.keys(p.stats)) p.stats[key] = Math.max(p.stats[key], older.stats[key] ?? 0);
  p.best.endless = Math.max(p.best.endless, older.best.endless);
  const wa = p.best.weekly;
  const wb = older.best.weekly;
  if (wb && (!wa || wb.week > wa.week || (wb.week === wa.week && wb.nights > wa.nights))) p.best.weekly = { ...wb };
  p.introSeen = p.introSeen || older.introSeen;
  return p;
}

export const sameProfile = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Hortbuch ────────────────────────────────────────────────────

// Funde je Tiefe
const FINDS_AT = (depth) => (FINDS[depth] ?? []).map(([id]) => id);

export function treasureHint(id, species = SPECIES) {
  if (id === 'ei') return 'Liegt von Anfang an in deinem Hort.';
  const starts = Object.values(species).filter((s) => s.start.includes(id)).map((s) => s.name);
  const finds = [];
  ['an der Oberfläche', 'in der zweiten Reihe', 'in der Mitte des Bergs', 'tief im Berg', 'ganz unten im Berg'].forEach((depth, i) => {
    if (FINDS_AT(i).includes(id)) finds.push(depth);
  });
  if (finds.length) return `Liegt in Grabkammern ${finds[0]}${finds.length > 1 ? ' und tiefer' : ''}.`;
  if (starts.length) return `Im Start-Hort: ${starts.join(', ')}.`;
  if (TREASURES[id]?.family === 'tand') return 'Was Helden von einem Köder mitnehmen.';
  return 'Noch verborgen.';
}

export function heroHint(type) {
  const entrance = Object.values(ENTRANCES).find((e) => e.party.some(([t]) => t === type));
  if (type === 'siegfried') return 'Kommt in der letzten Nacht.';
  if (!entrance) return 'Noch verborgen.';
  const piece = Object.values(PIECES).find((pc) => pc.entrance && ENTRANCES[pc.entrance] === entrance);
  return piece ? `Kommt durch den ${entrance.name}, sobald die Kobolde hineingraben (${piece.name}).` : `Kommt durch den ${entrance.name}.`;
}

export function gearHint(id) {
  const hero = HEROES[GEAR[id]?.from];
  return hero ? `${hero.boss ? 'Siegfried' : `Ein ${hero.name}`} lässt es manchmal zurück.` : 'Noch verborgen.';
}

export function buildingHint(id) {
  const key = BUILDINGS[id]?.unlock;
  if (!key) return 'Von Anfang an in deiner Sammlung.';
  const deed = DEEDS.find((d) => d.unlock?.includes(key));
  const glut = UNLOCKS[key]?.glut;
  const parts = [];
  if (glut) parts.push(`in der Werkstatt für ${glut} Glut`);
  if (deed) parts.push(`als Belohnung der Tat „${deed.name}“`);
  return `Freischalten ${parts.join(' oder ')}.`;
}
