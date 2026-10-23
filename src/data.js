// Alle Inhalte von Hort als Daten: Schätze, Helden, Raubziele, Atem-Karten, Drachenarten, Taten.
// Neue Inhalte kommen hier dazu, ohne dass die Spiellogik angefasst werden muss.
// „Daneben“ heißt überall: direkt links, rechts, oben oder unten.
// g ist das grammatische Geschlecht (m, f, n, pl) – für Sätze wie „trägt deinen Kelch“.

export const TREASURES = {
  ei: { name: 'Drachenei', g: 'n', family: 'ei', value: 0, glanz: 5, weight: 1, text: 'Dein Ei. Wird es aus der Höhle getragen, ist der Run vorbei.' },

  muenzen: { name: 'Goldmünzen', g: 'pl', family: 'gold', value: 2, glanz: 2, weight: 1, next: 'barren' },
  barren: { name: 'Goldbarren', g: 'm', family: 'gold', tier: 2, value: 5, glanz: 4, weight: 2, next: 'statue' },
  statue: { name: 'Goldstatue', g: 'f', family: 'gold', tier: 3, value: 12, glanz: 6, weight: 3, power: 1.25, text: 'Wahrzeichen: Drachenkraft +25\u00A0%. Zu schwer für jeden Helden.' },
  kelch: { name: 'Kelch', g: 'm', family: 'gold', value: 3, glanz: 3, weight: 1, next: 'prunkkelch' },
  prunkkelch: { name: 'Prunkkelch', g: 'm', family: 'gold', tier: 2, value: 7, glanz: 5, weight: 2, next: 'thron' },
  thron: { name: 'Goldener Thron', g: 'm', forms: { acc: 'Goldenen Thron', dat: 'Goldenen Thron' }, family: 'gold', tier: 3, value: 15, glanz: 7, weight: 3, glutRate: 1.3, text: 'Wahrzeichen: Glut lädt 30\u00A0% schneller. Zu schwer für jeden Helden.' },
  krone: { name: 'Krone', g: 'f', family: 'gold', value: 6, glanz: 7, weight: 1, shines: 1, next: 'kaiserkrone', text: 'Schätze daneben glänzen 1 mehr.' },
  kaiserkrone: { name: 'Kaiserkrone', g: 'f', family: 'gold', tier: 2, value: 14, glanz: 9, weight: 2, shines: 2, text: 'Schätze daneben glänzen 2 mehr.' },

  rubin: { name: 'Rubin', g: 'm', family: 'edelstein', value: 3, glanz: 4, weight: 1, glut: 1, next: 'rubinherz', text: '+1 Glut in jeder Nacht.' },
  rubinherz: { name: 'Rubinherz', g: 'n', family: 'edelstein', tier: 2, value: 8, glanz: 6, weight: 2, glut: 2, text: '+2 Glut in jeder Nacht.' },
  saphir: { name: 'Saphir', g: 'm', family: 'edelstein', value: 3, glanz: 4, weight: 1, power: 1.1, next: 'saphirauge', text: 'Drachenkraft +10\u00A0%.' },
  saphirauge: { name: 'Saphirauge', g: 'n', family: 'edelstein', tier: 2, value: 8, glanz: 6, weight: 2, power: 1.25, text: 'Drachenkraft +25\u00A0%.' },

  katzengold: { name: 'Katzengold', g: 'n', family: 'tand', value: 0, glanz: 6, weight: 1, next: 'narrengold', text: 'Glänzt stark, ist aber nichts wert. Der perfekte Köder.' },
  narrengold: { name: 'Narrengold', g: 'n', family: 'tand', tier: 2, value: 0, glanz: 9, weight: 1, text: 'Glänzt noch stärker und bleibt leicht. Kaum ein Dieb kann widerstehen.' },
  narrenkrone: { name: 'Narrenkrone', g: 'f', family: 'tand', value: 0, glanz: 10, weight: 1, carrierSpeed: 0.5, text: 'Glänzt mehr als alles andere. Wer sie trägt, ist nur halb so schnell.' },
  mimik: { name: 'Mimik-Truhe', g: 'f', family: 'tand', value: 2, glanz: 4, weight: 1, bite: 40, biteCooldown: 4, text: 'Beißt jeden, der sie nehmen will: 40 Schaden, alle 4 Sekunden.' },
  baerenfalle: { name: 'Bärenfalle', g: 'f', family: 'tand', value: 1, glanz: 1, weight: 1, snare: 3, snareCooldown: 8, text: 'Hält den ersten Helden daneben 3 Sekunden fest, danach 8 Sekunden Pause.' },

  reliquie: { name: 'Reliquie', g: 'f', family: 'heilig', value: 4, glanz: 3, weight: 2, burdens: 1, text: 'Schätze daneben wiegen 1 mehr.' },
  glocke: { name: 'Silberglocke', g: 'f', family: 'heilig', value: 3, glanz: 4, weight: 1, chime: 1, text: 'Nimmt ein Held einen Schatz daneben, läutet sie: +1 Glut.' },
  bannstein: { name: 'Bannstein', g: 'm', family: 'heilig', value: 2, glanz: 1, weight: 2, wards: true, text: 'Magier können weder ihn noch Schätze daneben wegzaubern.' },
  steinwaechter: { name: 'Steinwächter', g: 'm', family: 'heilig', value: 4, glanz: 2, weight: 3, pricks: 10, text: 'Schlägt Helden daneben: 10 Schaden pro Sekunde. Zu schwer für jeden Helden.' },

  // Beute der Besiegten
  schild: { name: 'Paladinschild', g: 'm', family: 'beute', value: 3, glanz: 2, weight: 2, slows: 0.5, text: 'Helden daneben sind nur halb so schnell.' },
  dolch: { name: 'Diebesdolch', g: 'm', family: 'beute', value: 2, glanz: 1, weight: 1, dims: 2, text: 'Schätze daneben glänzen 2 weniger.' },
  hacke: { name: 'Zwergenhacke', g: 'f', family: 'beute', value: 3, glanz: 2, weight: 2, blocksDig: 2, text: 'Im Umkreis von 2 Feldern kann sich kein Zwerg hochgraben.' },
  mistgabel: { name: 'Mistgabel', g: 'f', family: 'beute', value: 1, glanz: 1, weight: 1, pricks: 6, text: 'Sticht Helden daneben: 6 Schaden pro Sekunde.' },
  stab: { name: 'Zauberstab', g: 'm', family: 'beute', value: 3, glanz: 3, weight: 1, glut: 1, text: '+1 Glut in jeder Nacht.' },
};

export const HEROES = {
  dieb: { name: 'Dieb', plural: 'Diebe', hp: 28, speed: 2.7, strength: 1, grab: 0.7, loot: 'dolch', lootChance: 0.45, text: 'Schnell, aber schwach. Trägt nur Gewicht 1.' },
  bauer: { name: 'Bauer', plural: 'Bauern', hp: 24, speed: 1.7, strength: 1, grab: 1.1, loot: 'mistgabel', lootChance: 0.45, text: 'Langsam und schwach. Trägt nur Gewicht 1.' },
  paladin: { name: 'Paladin', plural: 'Paladine', hp: 95, speed: 1.25, strength: 2, grab: 1.4, fireproof: true, loot: 'schild', lootChance: 0.7, text: 'Feuerfest, zäh und langsam. Trägt Gewicht 2.' },
  zwerg: { name: 'Zwerg', plural: 'Zwerge', hp: 55, speed: 1.9, strength: 2, grab: 1, digger: true, loot: 'hacke', lootChance: 0.6, text: 'Gräbt sich von unten in die Höhle und flieht durch sein Loch. Trägt Gewicht 2.' },
  soeldner: { name: 'Söldner', plural: 'Söldner', hp: 34, speed: 2, strength: 2, grab: 1, loot: 'muenzen', lootChance: 0.6, text: 'Kommen in Scharen und tragen Gewicht 2. Lassen ihren Sold fallen.' },
  magier: { name: 'Magier', plural: 'Magier', hp: 40, speed: 1.5, strength: 2, grab: 1, caster: { time: 3, range: 3 }, loot: 'stab', lootChance: 0.6, text: 'Zaubert aus bis zu 3 Feldern den glänzendsten Schatz zu sich, auch hinter Mauern. Schaden oder Brüllen unterbricht den Zauber.' },
};

// Jedes Raubziel gehört zu einem Nachbarreich: Es bestimmt die Beute und wer nachts kommt.
// In jedem Run grenzt die Höhle an drei Reiche; gesperrte Reiche und Schätze kommen erst nach der Freischaltung vor.
export const RAIDS = {
  dorf: {
    name: 'Dorf', realm: 'Bauernland', text: 'Münzen, Kelche und allerlei Tand.',
    loot: [['muenzen', 4], ['kelch', 3], ['katzengold', 2], ['mimik', 1], ['baerenfalle', 1.5], ['narrenkrone', 0.6]],
    party: [['bauer', 0.55], ['dieb', 0.45]],
  },
  kloster: {
    name: 'Kloster', realm: 'Klosterorden', text: 'Kelche und Reliquien. Die Paladine sind feuerfest.',
    loot: [['kelch', 4], ['reliquie', 3], ['prunkkelch', 1], ['muenzen', 2], ['glocke', 2], ['steinwaechter', 0.6]],
    party: [['paladin', 0.4], ['dieb', 0.6]],
  },
  mine: {
    name: 'Zwergenmine', realm: 'Zwergenclan', text: 'Rubine und Goldbarren. Zwerge graben sich zu dir durch.',
    loot: [['rubin', 4], ['barren', 2], ['muenzen', 2], ['mimik', 1], ['saphir', 1.5]],
    party: [['zwerg', 0.45], ['dieb', 0.55]],
  },
  karawane: {
    name: 'Handelskarawane', realm: 'Händlerbund', text: 'Viel Gold auf einmal. Nachts kommen Söldner in Scharen.', unlock: 'karawane',
    loot: [['muenzen', 4], ['barren', 2], ['kelch', 2], ['krone', 2]],
    party: [['soeldner', 0.6], ['dieb', 0.4]],
  },
  turm: {
    name: 'Magierturm', realm: 'Magierzirkel', text: 'Saphire und Bannsteine. Magier zaubern dir Schätze aus dem Hort.', unlock: 'turm',
    loot: [['saphir', 3], ['bannstein', 2], ['rubin', 2], ['kelch', 1]],
    party: [['magier', 0.4], ['dieb', 0.6]],
  },
};
export const RAID_ORDER = ['dorf', 'kloster', 'mine', 'karawane', 'turm'];
export const REALMS_PER_RUN = 3;

// ­ ist eine weiche Trennstelle: Auf schmalen Bildschirmen brechen die Namen dort um.
export const CARDS = [
  { id: 'feuer', name: 'Feuer­atem', cost: 2, target: 'tile', damage: 30, text: '30 Schaden auf 3×3 Feldern. Paladine sind feuerfest.' },
  { id: 'schnapp', name: 'Zu­schnappen', cost: 1, target: 'hero', range: 4, damage: 60, text: '60 Schaden an einem Helden bis 4 Felder vor dir. Er lässt fallen, was er trägt.' },
  { id: 'fluegel', name: 'Flügel­schlag', cost: 2, target: 'none', range: 5, push: 2.5, stun: 1.2, text: 'Stößt alle Helden in 5 Feldern zurück. Sie lassen fallen, was sie tragen.' },
  { id: 'bruellen', name: 'Brüllen', cost: 3, target: 'none', stun: 2.5, text: 'Alle Helden erstarren 2,5 Sekunden lang.' },
  { id: 'rauch', name: 'Rauch­wolke', cost: 1, target: 'tile', duration: 8, unlock: 'rauch', text: 'Schätze auf 3×3 Feldern glänzen 8 Sekunden lang nicht. Helden suchen sich neue Ziele.' },
  { id: 'schwanz', name: 'Schwanz­hieb', cost: 2, target: 'none', range: 3, damage: 25, push: 1.5, unlock: 'schwanz', text: '25 Schaden an allen Helden bis 3 Felder vor dir. Stößt sie zurück.' },
  { id: 'glutregen', name: 'Glut­regen', cost: 3, target: 'none', damage: 15, unlock: 'glutregen', text: '15 Schaden an allen Helden in der Höhle. Paladine sind feuerfest.' },
];
export const CARD_BY_ID = Object.fromEntries(CARDS.map((card) => [card.id, card]));
export const BASE_CARDS = ['feuer', 'schnapp', 'fluegel', 'bruellen'];
export const HAND_SIZE = 4;

// Alles, was erst freigeschaltet werden muss. Der Rest ist von Anfang an da.
export const UNLOCKS = {
  krone: { kind: 'treasure', name: 'Krone' },
  saphir: { kind: 'treasure', name: 'Saphir' },
  baerenfalle: { kind: 'treasure', name: 'Bärenfalle' },
  glocke: { kind: 'treasure', name: 'Silberglocke' },
  narrenkrone: { kind: 'treasure', name: 'Narrenkrone' },
  steinwaechter: { kind: 'treasure', name: 'Steinwächter' },
  karawane: { kind: 'realm', name: 'Handelskarawane' },
  turm: { kind: 'realm', name: 'Magierturm' },
  rauch: { kind: 'card', name: 'Rauchwolke' },
  schwanz: { kind: 'card', name: 'Schwanzhieb' },
  glutregen: { kind: 'card', name: 'Glutregen' },
  endlos: { kind: 'mode', name: 'Endlose Belagerung' },
  woche: { kind: 'mode', name: 'Wochen-Hort' },
};
export const UNLOCK_KINDS = { treasure: 'Schatz', realm: 'Nachbarreich', card: 'Atem-Karte', mode: 'Modus' };

// Farben je Drachenart; eine neue Variante gibt es, wenn dieselbe Art noch einmal schlüpft.
const palette = (body, wing, head, horn, eye) => ({ body, wing, head, horn, eye });

// Drachenarten: eigener Start-Hort, eigene Regel, eigene Freischaltungen im Drachenalter.
export const SPECIES = {
  gold: {
    name: 'Golddrache', family: 'gold', rule: null,
    ruleText: 'Keine Sonderregel – der Grunddrache.',
    hatchText: 'Rund um dein Ei lag vor allem Gold – oder nichts Besonderes.',
    hint: 'Dein erster Drache.',
    start: [['ei', 5, 2], ['muenzen', 4, 2], ['kelch', 6, 2], ['muenzen', 5, 3], ['katzengold', 6, 4]],
    track: ['krone', 'karawane', 'glutregen'],
    palettes: [
      palette(['#c08a4a', '#7b4a24', '#3e2413'], ['#6a3326', '#2d1512', '#80452c', '#9a5a36'], ['#a87040', '#5d361b'], '#e8dcc0', '#ffb347'),
      palette(['#ecc66a', '#a87a26', '#4e3410'], ['#7a5a1e', '#3a2a0e', '#a8802c', '#c89a44'], ['#d8aa52', '#7e5820'], '#fff1cc', '#ffd76b'),
      palette(['#c0644a', '#72281a', '#36120c'], ['#5e1a16', '#26080a', '#8e3224', '#ac4630'], ['#a8503a', '#5a1f14'], '#ead2b8', '#ff9a4a'),
    ],
  },
  kristall: {
    name: 'Kristalldrache', family: 'edelstein', rule: 'conduct',
    ruleText: 'Edelsteine leiten Nachbar-Effekte weiter: Ein Schatz wirkt durch eine Reihe Edelsteine hindurch auf das erste Feld dahinter.',
    hatchText: 'Rund um dein Ei lagen Edelsteine.',
    hint: 'Lass ein Ei schlüpfen, das zwischen Edelsteinen liegt.',
    start: [['ei', 5, 2], ['rubin', 4, 2], ['rubin', 6, 2], ['muenzen', 5, 3], ['katzengold', 6, 4]],
    track: ['saphir', 'turm', 'rauch'],
    palettes: [
      palette(['#9cc2ee', '#3f5f9e', '#1c2850'], ['#3a4f8a', '#151c3a', '#6080c0', '#90b0e8'], ['#86aade', '#33508a'], '#e6f4ff', '#9ff0ff'),
      palette(['#c8a8f2', '#6a48a8', '#2c1c50'], ['#57388e', '#1e1238', '#8a66c8', '#b292ea'], ['#b090e0', '#563a8e'], '#f2e8ff', '#f0b8ff'),
      palette(['#a2e6cc', '#3a8a76', '#163c34'], ['#2e6e60', '#0e2a24', '#56a890', '#86d4b8'], ['#8ad2b8', '#2e7262'], '#e8fff6', '#b8fff0'),
    ],
  },
  knochen: {
    name: 'Knochendrache', family: 'beute', rule: 'guardians',
    ruleText: 'Bis zu drei Helden, die in einer Nacht fallen, stehen in der nächsten als Knochenwächter wieder auf und schlagen Helden daneben.',
    hatchText: 'Rund um dein Ei lag die Beute besiegter Helden.',
    hint: 'Lass ein Ei schlüpfen, das zwischen der Beute besiegter Helden liegt.',
    start: [['ei', 5, 2], ['dolch', 4, 2], ['mistgabel', 6, 2], ['muenzen', 5, 3], ['katzengold', 6, 4]],
    track: ['baerenfalle', 'glocke', 'schwanz'],
    palettes: [
      palette(['#ece6d6', '#a49c88', '#4e4a40'], ['#5a5650', '#26241f', '#8a8478', '#d8d0bc'], ['#e2dbc8', '#8e8674'], '#faf6ea', '#b6ff8a'),
      palette(['#c8d0dc', '#76808e', '#30343c'], ['#464c58', '#1a1d24', '#7a8494', '#c0c8d6'], ['#bcc4d0', '#6a7482'], '#f2f6fa', '#8affd8'),
      palette(['#8a8278', '#4a443c', '#1c1a16'], ['#3a3632', '#121110', '#5e5850', '#a09888'], ['#7e766c', '#3e3a34'], '#d8d0c0', '#ff6a5a'),
    ],
  },
  mond: {
    name: 'Mondsilberdrache', family: null, rule: 'inverse', secret: true, eggGlanz: 1,
    ruleText: 'Glanz wirkt umgekehrt: Helden laufen zum am wenigsten glänzenden Schatz. Dein Ei glänzt kaum.',
    hatchText: 'Dein Ei lag zwischen falschem Gold und hat vom Mond geträumt.',
    hint: 'Die Raben krächzen: Ein Ei, das zwischen falschem Gold ruht, träumt vom Mond.',
    start: [['ei', 5, 2], ['muenzen', 4, 2], ['katzengold', 6, 2], ['kelch', 5, 3], ['muenzen', 6, 4]],
    track: [],
    palettes: [
      palette(['#eef3fa', '#9eacc4', '#4a5470'], ['#5a6684', '#232a3c', '#9eacca', '#d4e0f2'], ['#e4ebf5', '#8e9cb8'], '#ffffff', '#d6e6ff'),
      palette(['#f4ecf6', '#b49cbc', '#5a4664'], ['#6a5476', '#2a1e30', '#a890b4', '#e0d0e8'], ['#ece0f0', '#a088ac'], '#ffffff', '#ffd6f6'),
    ],
  },
};
export const SPECIES_ORDER = ['gold', 'kristall', 'knochen', 'mond'];
// Beim Schlüpfen zählen die acht Felder rund um das Ei: Ab zwei Schätzen einer Art schlüpft deren Drache.
// Bei Gleichstand gewinnt die seltenere Art.
export const HATCH_MIN = 2;
export const HATCH_PRIORITY = ['edelstein', 'beute', 'gold'];

// Legende: Jede Stufe bringt eine Regel dazu, die Stufen gelten zusammen.
export const LEGEND = [
  { text: 'Helden kommen schneller hintereinander.', mod: { spawnInterval: 0.8 } },
  { text: 'Diebe sind schneller.', mod: { thiefSpeed: 1.15 } },
  { text: 'Glut lädt eine Sekunde langsamer.', mod: { glutRegenAdd: 1 } },
  { text: 'Die Raben verschweigen eine Heldengruppe.', mod: { hiddenGroup: true } },
  { text: 'Helden haben 20\u00A0% mehr Leben.', mod: { heroHp: 1.2 } },
  { text: 'Jede Nacht kommt ein Held mehr.', mod: { extraHeroes: 1 } },
  { text: 'Manche Helden durchschauen wertlosen Tand.', mod: { clever: 0.3 } },
  { text: 'Besiegte Helden lassen seltener Beute zurück.', mod: { lootChance: 0.7 } },
  { text: 'Eine siebte Nacht.', mod: { extraNight: 1 } },
  { text: 'Helden haben noch einmal 20\u00A0% mehr Leben und sind schneller.', mod: { heroHp: 1.2, heroSpeed: 1.1 } },
];

// Taten: kleine Aufgaben, später zugleich Steam-Erfolge
export const DEEDS = [
  { id: 'koeder', name: 'Köderkönig', text: 'Lass in einer Nacht drei Helden mit wertlosem Tand entkommen.', unlock: ['narrenkrone'] },
  { id: 'still', name: 'Stille Nacht', text: 'Überstehe eine Nacht, ohne eine Atem-Karte zu spielen.', unlock: ['steinwaechter'] },
  { id: 'brut', name: 'Erste Brut', text: 'Lass ein Ei schlüpfen.', unlock: ['endlos', 'woche'] },
  { id: 'schmied', name: 'Goldschmied', text: 'Verschmelze einen Schatz bis zum Wahrzeichen.' },
  { id: 'unberuehrt', name: 'Unberührt', text: 'Überstehe ab Nacht 3 eine Nacht, ohne dass etwas Wertvolles gestohlen wird.' },
  { id: 'rache', name: 'Rache', text: 'Besiege einen Erzfeind.' },
  { id: 'hort', name: 'Drachenhort', text: 'Habe 18 Schätze gleichzeitig im Hort.' },
  { id: 'legende', name: 'Lebende Legende', text: 'Gewinne einen Run auf Legende 5 oder höher.' },
];

export const META = {
  xpPerNight: 8,
  xpPerDefeat: 1,
  xpWin: 25,
  levels: [40, 120, 240],
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
export const STANDARD_RULES = { species: 'gold', legend: 0, cards: BASE_CARDS, unlocks: [], nemeses: [] };

export const CONFIG = {
  nights: 6,
  partyBase: 3,
  partyGrowth: 1.5,
  spawnInterval: 2.2,
  digWarning: 1.6,
  heroHpGrowth: 0.15,
  carrySpeed: 0.8,
  glutBase: 4,
  glutRegenSeconds: 6,
  claw: { range: 2, damage: 14, interval: 1 },
  powerPerValue: 1 / 60,
  lootOffer: 4,
  lootPick: 2,
  morningLootMax: 3,
};
