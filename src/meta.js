// Alles, was zwischen den Runs bleibt: Drachenarten, Erfahrung, Legende, Freischaltungen,
// Taten, Erzfeinde, Hortbuch. Reine Funktionen ohne Speicher und ohne Grafik.

import { SPECIES, SPECIES_ORDER, DEEDS, UNLOCKS, LEGEND, META, CARDS, CARD_BY_ID, BASE_CARDS, HAND_SIZE, STANDARD_RULES, TREASURES, HEROES } from './data.js';
import { hoardValue } from './sim.js';

export const PROFILE_VERSION = 1;

const newSpecies = () => ({ hatched: 1, xp: 0, legend: 0, variant: 0 });

export function newProfile() {
  return {
    version: PROFILE_VERSION,
    updatedAt: 0,
    species: { gold: newSpecies() },
    unlocks: [],
    deeds: [],
    loadout: BASE_CARDS.slice(),
    seen: { treasures: [], heroes: [] },
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

// Macht aus einem gespeicherten (vielleicht alten oder kaputten) Stand ein gültiges Profil
export function sanitizeProfile(raw) {
  const base = newProfile();
  if (!raw || typeof raw !== 'object' || raw.version !== PROFILE_VERSION) return base;
  const p = { ...base, updatedAt: num(raw.updatedAt) };
  p.species = {};
  for (const id of SPECIES_ORDER) {
    const s = raw.species?.[id];
    if (!s && id !== 'gold') continue;
    p.species[id] = {
      hatched: Math.max(1, Math.floor(num(s?.hatched, 1))),
      xp: num(s?.xp),
      legend: Math.min(LEGEND.length, Math.floor(num(s?.legend))),
      variant: Math.floor(num(s?.variant)),
    };
  }
  p.unlocks = list(raw.unlocks, (id) => UNLOCKS[id]);
  p.deeds = list(raw.deeds, (id) => DEEDS.some((d) => d.id === id));
  p.loadout = list(raw.loadout, (id) => CARD_BY_ID[id]);
  if (!p.loadout.length) p.loadout = BASE_CARDS.slice();
  p.seen = { treasures: list(raw.seen?.treasures, (id) => TREASURES[id]), heroes: list(raw.seen?.heroes, (id) => HEROES[id]) };
  p.nemeses = (Array.isArray(raw.nemeses) ? raw.nemeses : [])
    .filter((n) => n && typeof n.id === 'string' && HEROES[n.type] && TREASURES[n.treasure])
    .slice(0, META.nemesisMax)
    .map((n) => ({ id: n.id, name: String(n.name), type: n.type, treasure: n.treasure, rank: Math.max(1, Math.min(META.nemesisMaxRank, Math.floor(num(n.rank, 1)))) }));
  p.trophies = (Array.isArray(raw.trophies) ? raw.trophies : [])
    .filter((t) => t && HEROES[t.type] && TREASURES[t.treasure])
    .map((t) => ({ id: String(t.id ?? `${t.name}-${t.at}`), name: String(t.name), type: t.type, treasure: t.treasure, rank: Math.floor(num(t.rank, 1)), at: num(t.at) }));
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

// ── Abfragen ────────────────────────────────────────────────────

export function level(xp) {
  let l = 0;
  while (l < META.levels.length && xp >= META.levels[l]) l += 1;
  return l;
}

export function levelProgress(xp) {
  const l = level(xp);
  if (l >= META.levels.length) return { level: l, max: true, into: 1, next: null };
  const from = l ? META.levels[l - 1] : 0;
  const to = META.levels[l];
  return { level: l, max: false, into: (xp - from) / (to - from), next: to, xp };
}

export const hasUnlock = (p, id) => p.unlocks.includes(id);
export const availableCards = (p) => CARDS.filter((c) => !c.unlock || hasUnlock(p, c.unlock)).map((c) => c.id);
export const variantsOf = (p, species) => Math.min(p.species[species]?.hatched ?? 0, SPECIES[species].palettes.length);
export const maxLegend = (p, species) => p.species[species]?.legend ?? 0;

export function modeAvailable(p, mode) {
  if (mode === 'normal') return true;
  if (mode === 'endless') return hasUnlock(p, 'endlos');
  if (mode === 'weekly') return hasUnlock(p, 'woche');
  return false;
}

export function validLoadout(p) {
  const ok = availableCards(p);
  const hand = p.loadout.filter((id) => ok.includes(id)).slice(0, HAND_SIZE);
  for (const id of BASE_CARDS) if (hand.length < HAND_SIZE && !hand.includes(id)) hand.push(id);
  return hand;
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
  if (mode === 'weekly' || mode === 'code') return { ...STANDARD_RULES, cards: STANDARD_RULES.cards.slice(), mode };
  const species = p.species[p.choice.species] ? p.choice.species : 'gold';
  return {
    species,
    variant: Math.min(p.species[species].variant, variantsOf(p, species) - 1),
    legend: Math.min(p.choice.legend, maxLegend(p, species)),
    cards: validLoadout(p),
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
  if (log.nights.some((n) => n.decoyEscapes >= 3)) done.push('koeder');
  const survived = log.nights.slice(0, state.stats.nightsSurvived);
  if (survived.some((n) => n.cards === 0)) done.push('still');
  if (won) done.push('brut');
  if (log.landmark) done.push('schmied');
  if (survived.some((n) => n.night >= 3 && n.stolen === 0)) done.push('unberuehrt');
  if (log.nemesisDefeated.length) done.push('rache');
  if (log.maxHoard >= 18) done.push('hort');
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
    xp: 0,
    levelBefore: 0,
    levelAfter: 0,
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

  // Erfahrung für die gespielte Art; jede Stufe schaltet etwas frei
  const sp = p.species[o.species] ?? (p.species[o.species] = newSpecies());
  report.xp = nights * META.xpPerNight + state.stats.defeated * META.xpPerDefeat + (won ? META.xpWin : 0);
  report.levelBefore = level(sp.xp);
  sp.xp += report.xp;
  report.levelAfter = level(sp.xp);
  for (let l = report.levelBefore; l < report.levelAfter; l++) {
    const id = SPECIES[o.species].track[l];
    if (id) unlock(p, id, report);
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
  if (won && o.mode === 'normal' && o.legend >= sp.legend && sp.legend < LEGEND.length) {
    sp.legend = o.legend + 1;
    report.legendUnlocked = sp.legend;
  }

  // Erzfeinde: besiegt, wieder entkommen, neu
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
    const n = { id: `e${now.toString(36)}${Math.floor(rand() * 1e6).toString(36)}`, name: makeNemesisName(fresh.type, rand), type: fresh.type, treasure: fresh.treasure, rank: 1 };
    p.nemeses.push(n);
    report.nemesesNew.push(n);
  }

  // Taten und ihre Belohnungen
  for (const id of checkDeeds(state, won)) {
    if (p.deeds.includes(id)) continue;
    p.deeds.push(id);
    report.deeds.push(id);
    for (const u of DEEDS.find((d) => d.id === id).unlock ?? []) unlock(p, u, report);
  }

  // Hortbuch, Statistik, Bestwerte
  p.seen.treasures = [...new Set([...p.seen.treasures, ...log.treasuresSeen])];
  p.seen.heroes = [...new Set([...p.seen.heroes, ...log.heroesSeen])];
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
      t.xp = Math.max(t.xp, s.xp);
      t.legend = Math.max(t.legend, s.legend);
    }
  }
  const union = (x, y) => [...new Set([...x, ...y])];
  p.unlocks = union(p.unlocks, older.unlocks);
  p.deeds = union(p.deeds, older.deeds);
  p.seen = { treasures: union(p.seen.treasures, older.seen.treasures), heroes: union(p.seen.heroes, older.seen.heroes) };
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

// Woher bekommt man einen Schatz? Für die Hinweise bei unentdeckten Einträgen.
export function treasureHint(id, raids) {
  const deed = DEEDS.find((d) => d.unlock?.includes(id));
  if (deed) return `Belohnung der Tat „${deed.name}“.`;
  for (const sid of SPECIES_ORDER) {
    const lvl = SPECIES[sid].track.indexOf(id);
    if (lvl >= 0) return `${SPECIES[sid].name}, Stufe ${lvl + 1} im Drachenalter.`;
  }
  const from = Object.entries(TREASURES).find(([, d]) => d.next === id);
  if (from) return `Entsteht aus zwei: ${from[1].name}.`;
  const hero = Object.values(HEROES).find((h) => h.loot === id);
  if (hero && !Object.values(raids).some((r) => r.loot.some(([t]) => t === id))) return `Ein ${hero.name} lässt es zurück.`;
  const sources = Object.values(raids).filter((r) => r.loot.some(([t]) => t === id)).map((r) => r.name);
  if (sources.length) return `Beute aus: ${sources.join(', ')}.`;
  return 'Liegt schon zu Beginn im Hort.';
}

export function cardHint(id) {
  const card = CARD_BY_ID[id];
  if (!card.unlock) return 'Von Anfang an dabei.';
  for (const sid of SPECIES_ORDER) {
    const lvl = SPECIES[sid].track.indexOf(card.unlock);
    if (lvl >= 0) return `${SPECIES[sid].name}, Stufe ${lvl + 1} im Drachenalter.`;
  }
  return 'Noch verborgen.';
}
