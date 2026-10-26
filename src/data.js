// Alle Inhalte von Hort als Daten: Schätze, Helden, Eingänge, Stollenstücke, Baupläne mit ihren Bäumen,
// Ausrüstung, Drache, Drachenarten, Legende, Taten. Neue Inhalte kommen hier dazu, ohne dass die
// Spiellogik angefasst werden muss.
// g ist das grammatische Geschlecht (m, f, n, pl) – für Sätze wie „trägt deinen Kelch“.

// ── Schätze im Hort ─────────────────────────────────────────────
// Helden laufen immer zum glänzendsten Schatz, den sie tragen können (Gewicht ≤ Stärke).

export const TREASURES = {
  ei: { name: 'Drachenei', g: 'n', family: 'ei', value: 0, glanz: 4, weight: 1, text: 'Dein Ei. Wird es aus der Höhle getragen, ist der Run vorbei.' },
  muenzen: { name: 'Goldmünzen', g: 'pl', family: 'gold', value: 2, glanz: 2, weight: 1 },
  kelch: { name: 'Kelch', g: 'm', family: 'gold', value: 3, glanz: 3, weight: 1 },
  barren: { name: 'Goldbarren', g: 'm', family: 'gold', value: 5, glanz: 4, weight: 2 },
  rubin: { name: 'Rubin', g: 'm', family: 'edelstein', value: 4, glanz: 5, weight: 1 },
  saphir: { name: 'Saphir', g: 'm', family: 'edelstein', value: 4, glanz: 5, weight: 1 },
  prunkkelch: { name: 'Prunkkelch', g: 'm', family: 'gold', value: 7, glanz: 5, weight: 2 },
  krone: { name: 'Krone', g: 'f', family: 'gold', value: 6, glanz: 7, weight: 1 },
  statue: { name: 'Goldstatue', g: 'f', family: 'gold', value: 12, glanz: 6, weight: 3, text: 'Zu schwer für jeden gewöhnlichen Helden.' },
  kaiserkrone: { name: 'Kaiserkrone', g: 'f', family: 'gold', value: 14, glanz: 9, weight: 2 },
  // Was Helden von einem Köder mitnehmen: wertlos
  katzengold: { name: 'Katzengold', g: 'n', family: 'tand', value: 0, glanz: 6, weight: 1, text: 'Glänzt wie Gold und ist nichts wert.' },
  narrengold: { name: 'Narrengold', g: 'n', family: 'tand', value: 0, glanz: 9, weight: 1, text: 'Glänzt mehr als echtes Gold und ist nichts wert.' },
};

// Was beim Graben in einer Grabkammer liegt – je tiefer, desto wertvoller
export const FINDS = [
  [['muenzen', 3], ['kelch', 2]],
  [['kelch', 3], ['barren', 2], ['rubin', 1], ['saphir', 1]],
  [['barren', 2], ['rubin', 2], ['saphir', 2], ['krone', 1.5], ['prunkkelch', 1]],
  [['krone', 2], ['prunkkelch', 2], ['rubin', 1], ['saphir', 1], ['statue', 1]],
  [['krone', 2], ['kaiserkrone', 1.5], ['statue', 1.5], ['prunkkelch', 1]],
];

// ── Schaden: Leben, Rüstung, Segen ──────────────────────────────
// Schaden trifft zuerst den Segen, dann die Rüstung, dann das Leben.
// Jede Schadensart wirkt gegen jede Schicht verschieden stark.

export const LAYERS = ['segen', 'ruestung', 'leben'];
export const LAYER_NAMES = { segen: 'Segen', ruestung: 'Rüstung', leben: 'Leben' };

export const DAMAGE = {
  stich: { name: 'Stich', vs: { segen: 0.6, ruestung: 0.35, leben: 1 } },
  wucht: { name: 'Wucht', vs: { segen: 0.5, ruestung: 1.6, leben: 0.8 } },
  feuer: { name: 'Feuer', vs: { segen: 0.4, ruestung: 0.5, leben: 1.25 } },
  magie: { name: 'Magie', vs: { segen: 1.8, ruestung: 0.6, leben: 0.6 } },
  drache: { name: 'Drachenfeuer', vs: { segen: 1, ruestung: 1, leben: 1 } },
};

// ── Helden ──────────────────────────────────────────────────────

export const HEROES = {
  dieb: { name: 'Dieb', plural: 'Diebe', leben: 30, speed: 2.3, strength: 1, grab: 0.5, gold: 3, glut: 1, loot: 'dolch', lootChance: 0.3, text: 'Schnell und leicht. Trägt nur Gewicht 1.' },
  bauer: { name: 'Bauer', plural: 'Bauern', leben: 42, speed: 1.3, strength: 1, grab: 1.1, gold: 2, glut: 1, loot: 'mistgabel', lootChance: 0.25, text: 'Viel Leben, keine Rüstung. Kommen in Scharen und tragen nur Gewicht 1.' },
  soeldner: { name: 'Söldner', plural: 'Söldner', leben: 40, ruestung: 24, speed: 1.5, strength: 2, grab: 1, gold: 4, glut: 2, loot: 'klinge', lootChance: 0.3, text: 'Leichte Rüstung. Trägt Gewicht 2.' },
  zwerg: { name: 'Zwerg', plural: 'Zwerge', leben: 50, ruestung: 55, speed: 1.2, strength: 2, grab: 1, kenner: true, gold: 6, glut: 3, loot: 'hacke', lootChance: 0.45, text: 'Schwere Rüstung. Erkennt Katzengold auf den ersten Blick.' },
  paladin: { name: 'Paladin', plural: 'Paladine', leben: 55, ruestung: 30, segen: 50, speed: 1.05, strength: 2, grab: 1.3, gold: 7, glut: 4, loot: 'schild', lootChance: 0.5, text: 'Segen, Rüstung und Leben. Langsam und zäh.' },
  magier: { name: 'Magier', plural: 'Magier', leben: 32, segen: 55, speed: 1.25, strength: 1, grab: 1, kenner: true, caster: { time: 3, range: 3 }, gold: 6, glut: 3, loot: 'stab', lootChance: 0.45, text: 'Starker Segen. Zaubert Schätze aus 3 Feldern Entfernung zu sich – Schaden unterbricht ihn. Erkennt Katzengold.' },
  siegfried: { name: 'Siegfried', plural: 'Siegfried', boss: true, leben: 1200, speed: 0.95, strength: 3, grab: 1.5, gold: 0, glut: 40, loot: 'balmung', lootChance: 1, text: 'Der Drachentöter will nur dein Ei. Unverwundbar bis auf das Lindenblatt zwischen den Schultern: Vollen Schaden nimmt er nur von hinten. Zerschlägt im Vorbeigehen Türme.' },
};

export const BOSS = {
  frontDamage: 0.15, // so viel Schaden kommt von vorn durch
  strikeEvery: 9, // Sekunden zwischen zwei Hieben mit Balmung
  strikeWindup: 1, // so lange holt er sichtbar aus
  strikeRange: 2,
  strikeStun: 5, // so lange ist der getroffene Turm zerschlagen
  snare: 0.5, // Bärenfallen halten ihn nur kurz
};

// ── Eingänge: Wer durch welches Loch kommt ──────────────────────
// Der Höhlenmund ist von Anfang an offen. Die anderen öffnen sich, wenn die Kobolde durchbrechen.

export const ENTRANCES = {
  mund: { name: 'Höhlenmund', text: 'Abenteurer kommen durch den Haupteingang.', party: [['dieb', 0.5], ['soeldner', 0.5]], base: 3, growth: 1.6 },
  brunnen: { name: 'Brunnenschacht', text: 'Bauern aus dem Dorf: viele, aber schwach.', party: [['bauer', 0.8], ['dieb', 0.2]], base: 4, growth: 1.2 },
  zwerge: { name: 'Zwergenstollen', text: 'Zwerge in schwerer Rüstung. Katzengold erkennen sie sofort.', party: [['zwerg', 1]], base: 2, growth: 0.8 },
  gruft: { name: 'Gruft', text: 'Paladine mit Segen und Magier, die aus der Ferne zaubern.', party: [['paladin', 0.6], ['magier', 0.4]], base: 2, growth: 0.7 },
};
export const ENTRANCE_ORDER = ['mund', 'brunnen', 'zwerge', 'gruft'];

// ── Stollenstücke: was die Kobolde beim Graben finden ───────────
// weights: Wahrscheinlichkeit je Tiefe (Reihe 0 bis 4). Je tiefer, desto reicher – und desto eher ein Durchbruch.

export const PIECES = {
  gang: { name: 'Stiller Gang', text: 'Ein schlichter Gang mit Platz für Türme.', features: [], weights: [3, 2, 1.5, 1, 1] },
  ader: { name: 'Goldader', text: 'Eine Goldader: +10 Gold an jedem Morgen.', features: ['vein'], weights: [3, 3, 2.5, 2, 2] },
  reich: { name: 'Reiche Ader', text: 'Zwei Goldadern: +20 Gold an jedem Morgen.', features: ['vein', 'vein'], weights: [0, 0.6, 2, 2.5, 3] },
  vorsprung: { name: 'Felsvorsprung', text: 'Ein Turm auf dem Vorsprung reicht weiter und trifft härter.', features: ['ledge'], weights: [2, 2, 2, 2, 2] },
  kammer: { name: 'Grabkammer', text: 'Darin liegt ein Schatz für deinen Hort.', features: [], find: true, weights: [0.6, 1.5, 2, 2, 2] },
  brunnen: { name: 'Brunnenschacht', text: 'Der Wunschbrunnen des Dorfs: Münzen und eine Goldader. Ab jetzt steigen Bauern herab.', features: ['vein'], find: 'muenzen', entrance: 'brunnen', minDay: 2, weights: [1, 2, 2, 2, 2] },
  zwerge: { name: 'Alter Zwergenstollen', text: 'Zwei Goldadern. Aber die Zwerge wollen ihren Stollen zurück.', features: ['vein', 'vein'], entrance: 'zwerge', minDay: 2, weights: [0, 1.2, 2.5, 3, 3] },
  gruft: { name: 'Gruft', text: 'Ein Felsvorsprung und eine Grabbeigabe. Aus der Gruft steigen Paladine und Magier.', features: ['ledge'], find: true, entrance: 'gruft', minDay: 3, weights: [0, 0.6, 2, 2.5, 3] },
};

// ── Baupläne: Türme, Fallen, Köder ──────────────────────────────
// Türme stehen in Nischen neben dem Gang, Fallen liegen im Gang, Köder in einer Nische direkt am Gang.
// Jeder Turm hat einen eigenen Baum: Er sammelt Erfahrung, jede Stufe bringt einen Punkt.
// Knoten: x/y im Raster 0–4 (unten Mitte die Wurzel), mod verändert die Werte des Turms.

const SOCKET = { name: 'Zweite Fassung', kind: 'socket', x: 2, y: 2, mod: { sockets: 1 }, text: 'Platz für ein zweites Stück Ausrüstung.' };
const LINKS = [['R', 'A1'], ['R', 'B1'], ['A1', 'A2'], ['A2', 'A3'], ['A3', 'A4'], ['B1', 'B2'], ['B2', 'B3'], ['B3', 'B4'], ['A2', 'S'], ['S', 'B2']];
const POS = { R: [2, 4], A1: [1, 3], B1: [3, 3], A2: [0, 2], S: [2, 2], B2: [4, 2], A3: [1, 1], B3: [3, 1], A4: [1, 0], B4: [3, 0] };

function tree(nodes) {
  const out = {};
  for (const [id, node] of Object.entries({ ...nodes, S: SOCKET })) out[id] = { kind: 'small', ...node, x: POS[id][0], y: POS[id][1] };
  return { nodes: out, links: LINKS };
}

export const BUILDINGS = {
  speer: {
    kind: 'tower', name: 'Speerschleuder', g: 'f', cost: 30,
    text: 'Schnelle Speere auf einen Helden. Stark gegen Leben, schwach gegen Rüstung.',
    tower: { type: 'stich', dmg: 9, interval: 0.9, range: 2.6 },
    tree: tree({
      R: { name: 'Speerschleuder', kind: 'root', text: 'Wirft Speere auf den gefährlichsten Helden in Reichweite.' },
      A1: { name: 'Spitze Speere', mod: { dmg: 0.25 }, text: '+25 % Schaden.' },
      A2: { name: 'Schwachstelle', mod: { crit: 0.15 }, text: '+15 % Chance auf doppelten Schaden.' },
      A3: { name: 'Panzerbrecher', kind: 'notable', mod: { vs: { ruestung: 2 } }, text: 'Speere schlagen durch Rüstung: doppelter Schaden gegen Rüstung.' },
      A4: { name: 'Durchbohren', kind: 'keystone', mod: { pierce: 2, dmg: -0.2 }, text: 'Jeder Speer trifft auch bis zu 2 Helden direkt dahinter. Dafür 20 % weniger Schaden.' },
      B1: { name: 'Geölte Winde', mod: { rate: 0.25 }, text: '+25 % Angriffstempo.' },
      B2: { name: 'Weite Würfe', mod: { range: 0.7 }, text: '+0,7 Felder Reichweite.' },
      B3: { name: 'Kettenwurf', kind: 'notable', mod: { chain: 1 }, text: 'Der Speer springt zu einem zweiten Helden weiter (60 % Schaden).' },
      B4: { name: 'Speerhagel', kind: 'keystone', unlock: 'speer.B4', mod: { multi: 3, dmg: -0.45 }, text: 'Wirft 3 Speere auf 3 verschiedene Helden. Jeder macht 45 % weniger Schaden.' },
    }),
  },
  stein: {
    kind: 'tower', name: 'Steinwerfer', g: 'm', cost: 45,
    text: 'Schwere Steine auf eine Gruppe. Stark gegen Rüstung.',
    tower: { type: 'wucht', dmg: 16, interval: 2, range: 3, splash: 0.8 },
    tree: tree({
      R: { name: 'Steinwerfer', kind: 'root', text: 'Wirft schwere Steine. Trifft alle Helden um den Einschlag.' },
      A1: { name: 'Schwere Brocken', mod: { dmg: 0.25 }, text: '+25 % Schaden.' },
      A2: { name: 'Betäubend', mod: { stun: [0.2, 0.8] }, text: '20 % Chance, getroffene Helden 0,8 Sekunden zu betäuben.' },
      A3: { name: 'Erdbeben', kind: 'notable', mod: { splash: 0.5 }, text: 'Der Einschlag trifft 0,5 Felder weiter.' },
      A4: { name: 'Felsbrocken', kind: 'keystone', mod: { rate: -0.5, dmg: 1, stun: [1, 0.6] }, text: 'Wirft nur halb so oft, aber mit doppeltem Schaden. Jeder Treffer betäubt 0,6 Sekunden.' },
      B1: { name: 'Mehr Steine', mod: { rate: 0.2 }, text: '+20 % Angriffstempo.' },
      B2: { name: 'Weiter Wurf', mod: { range: 0.5 }, text: '+0,5 Felder Reichweite.' },
      B3: { name: 'Geröll', kind: 'notable', mod: { rubble: [0.7, 3] }, text: 'Getroffene Helden sind 3 Sekunden lang 30 % langsamer.' },
      B4: { name: 'Steinregen', kind: 'keystone', unlock: 'stein.B4', mod: { multi: 3, dmg: -0.5 }, text: 'Wirft 3 Steine auf 3 verschiedene Helden, jeder mit halbem Schaden.' },
    }),
  },
  feuer: {
    kind: 'tower', name: 'Feuertopf', g: 'm', cost: 40,
    text: 'Brennt alle Helden ringsum an. Stark gegen Leben, schwach gegen Segen.',
    tower: { type: 'feuer', dmg: 3, interval: 0.6, range: 1.7, aura: true, burn: [3, 2] },
    tree: tree({
      R: { name: 'Feuertopf', kind: 'root', text: 'Trifft alle Helden in Reichweite und setzt sie in Brand.' },
      A1: { name: 'Heißer', mod: { dmg: 0.25 }, text: '+25 % Schaden, auch beim Brand.' },
      A2: { name: 'Langer Brand', mod: { burnTime: 1.5 }, text: 'Der Brand hält 1,5 Sekunden länger.' },
      A3: { name: 'Flächenbrand', kind: 'notable', mod: { range: 0.6 }, text: '+0,6 Felder Reichweite.' },
      A4: { name: 'Flammenherz', kind: 'keystone', unlock: 'feuer.A4', mod: { spread: true, rate: -0.5 }, text: 'Der Brand springt auf Helden daneben über. Der Topf glüht dafür nur halb so oft.' },
      B1: { name: 'Beißender Rauch', mod: { slowAura: 0.8 }, text: 'Helden in Reichweite sind 20 % langsamer.' },
      B2: { name: 'Ölkessel', mod: { vs: { ruestung: 1.6 } }, text: 'Brennendes Öl frisst sich durch Rüstung: +60 % Schaden gegen Rüstung.' },
      B3: { name: 'Verbrannte Erde', kind: 'notable', mod: { scorch: 0.2 }, text: 'Brennende Helden nehmen 20 % mehr Schaden von allem.' },
      B4: { name: 'Glutsee', kind: 'keystone', mod: { burnDmg: 1, range: -0.4 }, text: 'Doppelter Brandschaden, aber 0,4 Felder weniger Reichweite.' },
    }),
  },
  fluch: {
    kind: 'tower', name: 'Fluchstein', g: 'm', cost: 45,
    text: 'Verflucht Helden: Sie nehmen mehr Schaden. Stark gegen Segen.',
    tower: { type: 'magie', dmg: 6, interval: 1.2, range: 2.8, curse: [0.2, 3] },
    tree: tree({
      R: { name: 'Fluchstein', kind: 'root', text: 'Verflucht einen Helden: Er nimmt 3 Sekunden lang 20 % mehr Schaden.' },
      A1: { name: 'Tiefer Fluch', mod: { curseAmp: 0.1 }, text: 'Verfluchte nehmen 10 % mehr Schaden.' },
      A2: { name: 'Langer Fluch', mod: { curseTime: 2 }, text: 'Der Fluch hält 2 Sekunden länger.' },
      A3: { name: 'Schwäche', kind: 'notable', mod: { shredPct: 0.3 }, text: 'Der Fluch zerfrisst 30 % der Rüstung.' },
      A4: { name: 'Seelenfessel', kind: 'keystone', unlock: 'fluch.A4', mod: { bind: true }, text: 'Verfluchte Helden können nichts greifen und nicht zaubern. Der Stein macht dafür keinen Schaden mehr.' },
      B1: { name: 'Runenkraft', mod: { dmg: 0.3 }, text: '+30 % Schaden.' },
      B2: { name: 'Weite Runen', mod: { range: 0.6 }, text: '+0,6 Felder Reichweite.' },
      B3: { name: 'Segensbrecher', kind: 'notable', mod: { vs: { segen: 1.5 } }, text: '+50 % Schaden gegen Segen.' },
      B4: { name: 'Runenkette', kind: 'keystone', mod: { multi: 4, curseTimeMult: 0.5 }, text: 'Trifft bis zu 4 Helden gleichzeitig. Der Fluch hält dafür nur halb so lang.' },
    }),
  },
  baerenfalle: {
    kind: 'trap', name: 'Bärenfalle', g: 'f', cost: 20,
    text: 'Hält den ersten Helden 2,5 Sekunden fest. Danach 6 Sekunden Pause.',
    trap: { snare: 2.5, cd: 6 },
  },
  stacheln: {
    kind: 'trap', name: 'Stachelgrube', g: 'f', cost: 20,
    text: '10 Stichschaden an jedem Helden, der hineintritt.',
    trap: { dmg: 10, type: 'stich' },
  },
  oel: {
    kind: 'trap', name: 'Ölpfütze', g: 'f', cost: 15,
    text: 'Helden darauf sind fast halb so langsam. Trifft sie Feuer, brennt die Pfütze 5 Sekunden lang.',
    trap: { slow: 0.55, fire: [8, 5] },
  },
  steinschlag: {
    kind: 'trap', name: 'Steinschlag', g: 'm', cost: 35, unlock: 'steinschlag',
    text: 'Tritt ein Held darauf, fallen Felsen auf 3 × 3 Felder: 30 Wuchtschaden. Danach 10 Sekunden Pause.',
    trap: { dmg: 30, type: 'wucht', delay: 0.6, cd: 10 },
  },
  katzengold: {
    kind: 'lure', name: 'Katzengold', g: 'n', cost: 15,
    text: 'Glanz 6. Helden brauchen dreimal so lange, um es einzusammeln – mitten vor deinen Türmen. Wer es hat, zieht damit ab. 3 Stück pro Nacht. Zwerge und Magier fallen nicht darauf herein.',
    lure: { glanz: 6, charges: 3, item: 'katzengold', grab: 3 },
  },
  narrengold: {
    kind: 'lure', name: 'Narrengold', g: 'n', cost: 35, unlock: 'narrengold',
    text: 'Glanz 9 – glänzt mehr als fast jeder Schatz. Einsammeln dauert dreimal so lange. 1 Stück pro Nacht. Zwerge und Magier fallen nicht darauf herein.',
    lure: { glanz: 9, charges: 1, item: 'narrengold', grab: 3 },
  },
  mimik: {
    kind: 'lure', name: 'Mimik-Truhe', g: 'f', cost: 35, unlock: 'mimik',
    text: 'Glanz 5. Beißt jeden, der sie öffnen will: 45 Schaden, alle 4 Sekunden. Darauf fallen alle herein.',
    lure: { glanz: 5, bite: 45, cd: 4 },
  },
};
export const BUILDING_ORDER = ['speer', 'stein', 'feuer', 'fluch', 'baerenfalle', 'stacheln', 'oel', 'steinschlag', 'katzengold', 'narrengold', 'mimik'];
export const BUILDING_KINDS = { tower: 'Turm', trap: 'Falle', lure: 'Köder' };
export const BASE_DECK = ['speer', 'stein', 'feuer', 'fluch', 'baerenfalle', 'stacheln', 'oel', 'katzengold'];
export const DECK_SIZE = 8;

// ── Ausrüstung der Besiegten: wird in Türme eingebaut ───────────

export const GEAR = {
  mistgabel: { name: 'Mistgabel', g: 'f', from: 'bauer', mod: { push: 0.35 }, text: 'Jeder Treffer stößt den Helden ein Stück zurück.' },
  dolch: { name: 'Diebesdolch', g: 'm', from: 'dieb', mod: { crit: 0.2 }, text: '+20 % Chance auf doppelten Schaden.' },
  klinge: { name: 'Söldnerklinge', g: 'f', from: 'soeldner', mod: { dmg: 0.25 }, text: '+25 % Schaden.' },
  hacke: { name: 'Zwergenhacke', g: 'f', from: 'zwerg', mod: { shred: 3 }, text: 'Jeder Treffer schlägt 3 Rüstung ab.' },
  schild: { name: 'Paladinschild', g: 'm', from: 'paladin', mod: { vs: { segen: 2 } }, text: 'Doppelter Schaden gegen Segen.' },
  stab: { name: 'Zauberstab', g: 'm', from: 'magier', mod: { bolt: [3, 10, 2] }, text: 'Jeder dritte Angriff schickt einen Blitz zu 2 weiteren Helden: 10 Magieschaden.' },
  balmung: { name: 'Balmung', g: 'n', from: 'siegfried', mod: { dmg: 0.6, crit: 0.1 }, text: 'Siegfrieds Schwert: +60 % Schaden und +10 % Chance auf doppelten Schaden.' },
};

// ── Der Drache ──────────────────────────────────────────────────

export const DRAGON = {
  claw: { range: 1.6, damage: 14, interval: 1 },
  powerPerValue: 1 / 40,
  abilities: [
    { id: 'feuer', name: 'Feuer­atem', cooldown: 12, target: 'tile', damage: 32, text: '32 Drachenfeuer auf 3 × 3 Feldern, überall in der Höhle. Wirkt gegen alles gleich stark.' },
    { id: 'fluegel', name: 'Flügel­schlag', cooldown: 16, target: 'none', range: 4, push: 2, stun: 1, text: 'Stößt Helden bis 4 Felder vor dir zurück. Sie lassen fallen, was sie tragen.' },
    { id: 'bruellen', name: 'Brüllen', cooldown: 28, target: 'none', stun: 2.5, text: 'Alle Helden erstarren 2,5 Sekunden lang.' },
  ],
};
export const ABILITY_BY_ID = Object.fromEntries(DRAGON.abilities.map((a) => [a.id, a]));

// ── Drachenarten ────────────────────────────────────────────────
// Farben je Drachenart; eine neue Variante gibt es, wenn dieselbe Art noch einmal schlüpft.
const palette = (body, wing, head, horn, eye) => ({ body, wing, head, horn, eye });

export const SPECIES = {
  gold: {
    name: 'Golddrache', rule: null,
    ruleText: 'Keine Sonderregel – der Grunddrache.',
    hatchText: 'Nichts Besonderes lag in deinem Hort – ein Golddrache, wie sein Vater.',
    hint: 'Dein erster Drache.',
    start: ['ei', 'muenzen', 'muenzen', 'kelch'],
    palettes: [
      palette(['#c08a4a', '#7b4a24', '#3e2413'], ['#6a3326', '#2d1512', '#80452c', '#9a5a36'], ['#a87040', '#5d361b'], '#e8dcc0', '#ffb347'),
      palette(['#ecc66a', '#a87a26', '#4e3410'], ['#7a5a1e', '#3a2a0e', '#a8802c', '#c89a44'], ['#d8aa52', '#7e5820'], '#fff1cc', '#ffd76b'),
      palette(['#c0644a', '#72281a', '#36120c'], ['#5e1a16', '#26080a', '#8e3224', '#ac4630'], ['#a8503a', '#5a1f14'], '#ead2b8', '#ff9a4a'),
    ],
  },
  kristall: {
    name: 'Kristalldrache', rule: 'frost',
    ruleText: 'Kristallatem: Der Feueratem macht 20 % weniger Schaden, aber getroffene Helden sind 3 Sekunden lang halb so schnell.',
    hatchText: 'In deinem Hort lagen Edelsteine – das Ei hat ihr Funkeln angenommen.',
    hint: 'Gewinne mit mindestens zwei Edelsteinen im Hort.',
    start: ['ei', 'rubin', 'saphir', 'muenzen'],
    palettes: [
      palette(['#9cc2ee', '#3f5f9e', '#1c2850'], ['#3a4f8a', '#151c3a', '#6080c0', '#90b0e8'], ['#86aade', '#33508a'], '#e6f4ff', '#9ff0ff'),
      palette(['#c8a8f2', '#6a48a8', '#2c1c50'], ['#57388e', '#1e1238', '#8a66c8', '#b292ea'], ['#b090e0', '#563a8e'], '#f2e8ff', '#f0b8ff'),
      palette(['#a2e6cc', '#3a8a76', '#163c34'], ['#2e6e60', '#0e2a24', '#56a890', '#86d4b8'], ['#8ad2b8', '#2e7262'], '#e8fff6', '#b8fff0'),
    ],
  },
  knochen: {
    name: 'Knochendrache', rule: 'guardians',
    ruleText: 'Bis zu drei Helden, die in einer Nacht fallen, stehen in der nächsten als Knochenwächter wieder auf und schlagen Helden daneben.',
    hatchText: 'So viele Helden sind gefallen, dass ihre Knochen das Ei gewärmt haben.',
    hint: 'Gewinne einen Run, in dem mindestens 70 Helden fallen.',
    start: ['ei', 'muenzen', 'kelch', 'kelch'],
    palettes: [
      palette(['#ece6d6', '#a49c88', '#4e4a40'], ['#5a5650', '#26241f', '#8a8478', '#d8d0bc'], ['#e2dbc8', '#8e8674'], '#faf6ea', '#b6ff8a'),
      palette(['#c8d0dc', '#76808e', '#30343c'], ['#464c58', '#1a1d24', '#7a8494', '#c0c8d6'], ['#bcc4d0', '#6a7482'], '#f2f6fa', '#8affd8'),
      palette(['#8a8278', '#4a443c', '#1c1a16'], ['#3a3632', '#121110', '#5e5850', '#a09888'], ['#7e766c', '#3e3a34'], '#d8d0c0', '#ff6a5a'),
    ],
  },
  mond: {
    name: 'Mondsilberdrache', rule: 'moon', secret: true,
    ruleText: 'Köder glänzen 3 mehr und halten ein Stück länger.',
    hatchText: 'In einer Nacht sind drei Helden mit falschem Gold abgezogen – das Ei hat vom Mond geträumt.',
    hint: 'Die Raben krächzen: Ein Ei, das falsches Gold gesehen hat, träumt vom Mond.',
    start: ['ei', 'muenzen', 'kelch', 'muenzen'],
    palettes: [
      palette(['#eef3fa', '#9eacc4', '#4a5470'], ['#5a6684', '#232a3c', '#9eacca', '#d4e0f2'], ['#e4ebf5', '#8e9cb8'], '#ffffff', '#d6e6ff'),
      palette(['#f4ecf6', '#b49cbc', '#5a4664'], ['#6a5476', '#2a1e30', '#a890b4', '#e0d0e8'], ['#ece0f0', '#a088ac'], '#ffffff', '#ffd6f6'),
    ],
  },
};
export const SPECIES_ORDER = ['gold', 'kristall', 'knochen', 'mond'];
export const HATCH = { gems: 2, defeated: 70, decoys: 3 };

// ── Legende: Jede Stufe bringt eine Regel dazu, die Stufen gelten zusammen ──

export const LEGEND = [
  { text: 'Helden kommen schneller hintereinander.', mod: { spawnInterval: 0.8 } },
  { text: 'Diebe sind schneller.', mod: { thiefSpeed: 1.15 } },
  { text: 'Die Fähigkeiten des Drachen laden 20 % langsamer.', mod: { cooldown: 1.2 } },
  { text: 'Die Raben verschweigen, wer durch einen der Eingänge kommt.', mod: { hiddenGroup: true } },
  { text: 'Helden haben 20 % mehr Leben.', mod: { heroHp: 1.2 } },
  { text: 'An jedem Eingang kommt ein Held mehr.', mod: { extraHeroes: 1 } },
  { text: 'Manche Helden durchschauen Katzengold.', mod: { clever: 0.3 } },
  { text: 'Besiegte Helden lassen seltener Ausrüstung zurück.', mod: { lootChance: 0.6 } },
  { text: 'Eine neunte Nacht.', mod: { extraNight: 1 } },
  { text: 'Helden haben noch einmal 20 % mehr Leben und sind schneller.', mod: { heroHp: 1.2, heroSpeed: 1.1 } },
];

// ── Freischaltungen: mit Glut in der Werkstatt oder über Taten ──

export const UNLOCKS = {
  steinschlag: { kind: 'building', name: 'Steinschlag', glut: 50 },
  mimik: { kind: 'building', name: 'Mimik-Truhe', glut: 40 },
  narrengold: { kind: 'building', name: 'Narrengold', glut: 35 },
  'speer.B4': { kind: 'node', name: 'Speerhagel', tower: 'speer', glut: 45 },
  'stein.B4': { kind: 'node', name: 'Steinregen', tower: 'stein', glut: 45 },
  'feuer.A4': { kind: 'node', name: 'Flammenherz', tower: 'feuer', glut: 45 },
  'fluch.A4': { kind: 'node', name: 'Seelenfessel', tower: 'fluch', glut: 45 },
  endlos: { kind: 'mode', name: 'Endlose Belagerung' },
  woche: { kind: 'mode', name: 'Wochen-Hort' },
};
export const UNLOCK_KINDS = { building: 'Bauplan', node: 'Schlussstein', mode: 'Modus' };

// ── Taten: kleine Aufgaben, später zugleich Steam-Erfolge ───────

export const DEEDS = [
  { id: 'koeder', name: 'Köderkönig', text: 'Lass in einer Nacht drei Helden mit falschem Gold abziehen.', unlock: ['narrengold'] },
  { id: 'still', name: 'Stille Nacht', text: 'Überstehe ab Nacht 2 eine Nacht, ohne eine Fähigkeit des Drachen zu nutzen.', unlock: ['mimik'] },
  { id: 'brut', name: 'Erste Brut', text: 'Lass ein Ei schlüpfen.', unlock: ['endlos', 'woche'] },
  { id: 'schluss', name: 'Schlussstein', text: 'Lerne bei einem Turm einen Schlussstein.' },
  { id: 'unberuehrt', name: 'Unberührt', text: 'Überstehe ab Nacht 3 eine Nacht, ohne dass etwas Wertvolles gestohlen wird.' },
  { id: 'rache', name: 'Rache', text: 'Besiege einen Erzfeind.' },
  { id: 'tief', name: 'Tiefgräber', text: 'Grabe bis in die unterste Reihe des Bergs.' },
  { id: 'lindenblatt', name: 'Lindenblatt', text: 'Besiege Siegfried, bevor er dein Ei berührt.' },
  { id: 'legende', name: 'Lebende Legende', text: 'Gewinne einen Run auf Legende 5 oder höher.' },
];

export const META = {
  nemesisMax: 3,
  nemesisMaxRank: 5,
  nemesisMinValue: 2,
  nemesisChance: 0.5,
  nemesisForceNight: 5,
  guardianMax: 3,
  guardianDps: 8,
  names: ['Ulrich', 'Gisela', 'Kunibert', 'Hedwig', 'Bertram', 'Adelheid', 'Wenzel', 'Mechthild', 'Ruprecht', 'Irmgard', 'Eckhard', 'Walburga', 'Siegmund', 'Hildegard', 'Lambert', 'Roswitha', 'Gernot', 'Kriemhild', 'Hagen', 'Ortrun'],
  epithets: {
    dieb: ['Langfinger', 'Schattenhand', 'Flinkfuß'],
    bauer: ['Rübennase', 'Dreschflegel', 'Mistfink'],
    paladin: ['Eisenherz', 'Sonnenschild', 'Unbeugsam'],
    zwerg: ['Tiefgräber', 'Steinbart', 'Erzfaust'],
    soeldner: ['Goldgier', 'Klingenbruch', 'Narbengesicht'],
    magier: ['Sternenstaub', 'Funkenhand', 'Nebelblick'],
  },
};

// Wochen-Hort und Hort-Codes laufen mit festen Regeln, damit alle dieselben Bedingungen haben
export const STANDARD_RULES = { species: 'gold', legend: 0, deck: BASE_DECK, unlocks: [], nemeses: [] };

export const CONFIG = {
  nights: 8,
  startGold: 60,
  goldBase: 10,
  goldPerVein: 10,
  handSize: 4,
  redrawCost: 10,
  respecCost: 15,
  sellBack: 0.5,
  spawnInterval: 2.2,
  heroHpGrowth: 0.24,
  carrySpeed: 0.8,
  xpPerDamage: 1 / 8,
  xpPerKill: 3,
  levels: [15, 40, 75, 120, 180, 255, 345, 450],
  levelDamage: 0.06,
  ledge: { range: 0.6, dmg: 0.15 },
  glutPerNight: 5,
  glutWin: 20,
  bossEvery: 8,
};
