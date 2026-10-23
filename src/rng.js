// Deterministischer Zufall (mulberry32). Der Zustand liegt im Spielzustand,
// deshalb lässt sich jeder Run über seinen Hort-Code exakt nachspielen.

export function random(state) {
  let t = (state.rngState = (state.rngState + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const pick = (state, list) => list[Math.floor(random(state) * list.length)];

export function pickWeighted(state, entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random(state) * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries[entries.length - 1][0];
}

export function shuffle(state, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const randomSeed = () => (Math.random() * 4294967296) >>> 0;

// Hort-Code: der Seed in Basis 36, z. B. „0K3F9ZQ“
export const seedToCode = (seed) => (seed >>> 0).toString(36).toUpperCase().padStart(7, '0');

export function codeToSeed(code) {
  if (!/^[0-9a-z]{1,7}$/i.test(code)) return null;
  const n = parseInt(code, 36);
  return n <= 0xffffffff ? n >>> 0 : null;
}
