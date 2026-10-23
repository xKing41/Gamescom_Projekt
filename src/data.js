// Alle Inhalte von Hort als Daten: Schätze, Helden, Raubziele, Atem-Karten.
// Neue Inhalte kommen hier dazu, ohne dass die Spiellogik angefasst werden muss.
// „Daneben“ heißt überall: direkt links, rechts, oben oder unten.

export const TREASURES = {
  ei: { name: 'Drachenei', family: 'ei', value: 0, glanz: 5, weight: 1, text: 'Dein Ei. Wird es aus der Höhle getragen, ist der Run vorbei.' },

  muenzen: { name: 'Goldmünzen', family: 'gold', value: 2, glanz: 2, weight: 1, next: 'barren' },
  barren: { name: 'Goldbarren', family: 'gold', tier: 2, value: 5, glanz: 4, weight: 2, next: 'statue' },
  statue: { name: 'Goldstatue', family: 'gold', tier: 3, value: 12, glanz: 6, weight: 3, power: 1.25, text: 'Wahrzeichen: Drachenkraft +25 %. Zu schwer für jeden Helden.' },
  kelch: { name: 'Kelch', family: 'gold', value: 3, glanz: 3, weight: 1, next: 'prunkkelch' },
  prunkkelch: { name: 'Prunkkelch', family: 'gold', tier: 2, value: 7, glanz: 5, weight: 2, next: 'thron' },
  thron: { name: 'Goldener Thron', family: 'gold', tier: 3, value: 15, glanz: 7, weight: 3, glutRate: 1.3, text: 'Wahrzeichen: Glut lädt 30 % schneller. Zu schwer für jeden Helden.' },

  rubin: { name: 'Rubin', family: 'edelstein', value: 3, glanz: 4, weight: 1, glut: 1, next: 'rubinherz', text: '+1 Glut in jeder Nacht.' },
  rubinherz: { name: 'Rubinherz', family: 'edelstein', tier: 2, value: 8, glanz: 6, weight: 2, glut: 2, text: '+2 Glut in jeder Nacht.' },

  katzengold: { name: 'Katzengold', family: 'tand', value: 0, glanz: 6, weight: 1, next: 'narrengold', text: 'Glänzt stark, ist aber nichts wert. Der perfekte Köder.' },
  narrengold: { name: 'Narrengold', family: 'tand', tier: 2, value: 0, glanz: 9, weight: 1, text: 'Glänzt noch stärker und bleibt leicht. Kaum ein Dieb kann widerstehen.' },
  mimik: { name: 'Mimik-Truhe', family: 'tand', value: 2, glanz: 4, weight: 1, bite: 40, biteCooldown: 4, text: 'Beißt jeden, der sie nehmen will: 40 Schaden, alle 4 Sekunden.' },
  reliquie: { name: 'Reliquie', family: 'heilig', value: 4, glanz: 3, weight: 2, burdens: 1, text: 'Schätze daneben wiegen 1 mehr.' },

  // Beute der Besiegten
  schild: { name: 'Paladinschild', family: 'beute', value: 3, glanz: 2, weight: 2, slows: 0.5, text: 'Helden daneben sind nur halb so schnell.' },
  dolch: { name: 'Diebesdolch', family: 'beute', value: 2, glanz: 1, weight: 1, dims: 2, text: 'Schätze daneben glänzen 2 weniger.' },
  hacke: { name: 'Zwergenhacke', family: 'beute', value: 3, glanz: 2, weight: 2, blocksDig: 2, text: 'Im Umkreis von 2 Feldern kann sich kein Zwerg hochgraben.' },
  mistgabel: { name: 'Mistgabel', family: 'beute', value: 1, glanz: 1, weight: 1, pricks: 6, text: 'Sticht Helden daneben: 6 Schaden pro Sekunde.' },
};

export const HEROES = {
  dieb: { name: 'Dieb', plural: 'Diebe', hp: 28, speed: 2.7, strength: 1, grab: 0.7, loot: 'dolch', lootChance: 0.45, text: 'Schnell, aber schwach. Trägt nur Gewicht 1.' },
  bauer: { name: 'Bauer', plural: 'Bauern', hp: 24, speed: 1.7, strength: 1, grab: 1.1, loot: 'mistgabel', lootChance: 0.45, text: 'Langsam und schwach. Trägt nur Gewicht 1.' },
  paladin: { name: 'Paladin', plural: 'Paladine', hp: 95, speed: 1.25, strength: 2, grab: 1.4, fireproof: true, loot: 'schild', lootChance: 0.7, text: 'Feuerfest, zäh und langsam. Trägt Gewicht 2.' },
  zwerg: { name: 'Zwerg', plural: 'Zwerge', hp: 55, speed: 1.9, strength: 2, grab: 1, digger: true, loot: 'hacke', lootChance: 0.6, text: 'Gräbt sich von unten in die Höhle und flieht durch sein Loch. Trägt Gewicht 2.' },
};

// Jedes Raubziel gehört zu einem Nachbarreich: Es bestimmt die Beute und wer nachts kommt.
export const RAIDS = {
  dorf: {
    name: 'Dorf', realm: 'Bauernland', text: 'Münzen, Kelche und allerlei Tand.',
    loot: [['muenzen', 4], ['kelch', 3], ['katzengold', 2], ['mimik', 1]],
    party: [['bauer', 0.55], ['dieb', 0.45]],
  },
  kloster: {
    name: 'Kloster', realm: 'Klosterorden', text: 'Kelche und Reliquien. Die Paladine sind feuerfest.',
    loot: [['kelch', 4], ['reliquie', 3], ['prunkkelch', 1], ['muenzen', 2]],
    party: [['paladin', 0.4], ['dieb', 0.6]],
  },
  mine: {
    name: 'Zwergenmine', realm: 'Zwergenclan', text: 'Rubine und Goldbarren. Zwerge graben sich zu dir durch.',
    loot: [['rubin', 4], ['barren', 2], ['muenzen', 2], ['mimik', 1]],
    party: [['zwerg', 0.45], ['dieb', 0.55]],
  },
};
export const RAID_ORDER = ['dorf', 'kloster', 'mine'];

// \u00AD ist eine weiche Trennstelle: Auf schmalen Bildschirmen brechen die Namen dort um.
export const CARDS = [
  { id: 'feuer', name: 'Feuer\u00ADatem', cost: 2, target: 'tile', damage: 30, text: '30 Schaden auf 3×3 Feldern. Paladine sind feuerfest.' },
  { id: 'schnapp', name: 'Zu\u00ADschnappen', cost: 1, target: 'hero', range: 4, damage: 60, text: '60 Schaden an einem Helden bis 4 Felder vor dir. Er lässt fallen, was er trägt.' },
  { id: 'fluegel', name: 'Flügel\u00ADschlag', cost: 2, target: 'none', range: 5, push: 2.5, stun: 1.2, text: 'Stößt alle Helden in 5 Feldern zurück. Sie lassen fallen, was sie tragen.' },
  { id: 'bruellen', name: 'Brüllen', cost: 3, target: 'none', stun: 2.5, text: 'Alle Helden erstarren 2,5 Sekunden lang.' },
];
export const CARD_BY_ID = Object.fromEntries(CARDS.map((card) => [card.id, card]));

// Welche Drachenart schlüpft, hängt davon ab, worauf das Ei in der letzten Nacht lag.
export const SPECIES = {
  gold: { name: 'Golddrache', weight: 1, text: 'Du hast auf Gold gebrütet.' },
  edelstein: { name: 'Kristalldrache', weight: 2, text: 'Du hast auf Edelsteinen gebrütet.' },
  beute: { name: 'Knochendrache', weight: 1.5, text: 'Du hast auf der Beute besiegter Helden gebrütet.' },
};

export const CONFIG = {
  nights: 6,
  startHoard: [['ei', 5, 2], ['muenzen', 4, 2], ['kelch', 6, 2], ['muenzen', 5, 3], ['katzengold', 6, 4]],
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
