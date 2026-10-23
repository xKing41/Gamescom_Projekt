// Speichert das Profil: immer im Browser, dazu an einem zweiten Ort –
// als Claude-Artifact in der Datenbank (derselbe Stand am Handy und am PC),
// in der Desktop-Fassung als Datei im Spielordner, die die Steam Cloud abgleicht.

import { sanitizeProfile, mergeProfiles, sameProfile } from './meta.js';

const KEY = 'hort.profile.v1';

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveLocal(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Ohne Browser-Speicher (privates Fenster) bleibt der Stand nur bis zum Neuladen
  }
}

// Der zweite Speicherort, falls es einen gibt: { get, set }
async function openBackend() {
  const desktop = window.hortDesktop?.profile;
  if (desktop) {
    return {
      get: async () => {
        const raw = await desktop.load();
        return raw ? JSON.parse(raw) : null;
      },
      set: (p) => desktop.save(JSON.stringify(p)),
      delay: 0,
    };
  }
  const use = window.claude?.use;
  if (typeof use !== 'function') return null;
  const [db, user] = await Promise.all([use.call(window.claude, 'db'), use.call(window.claude, 'user')]);
  if (!db || !user) return null;
  const id = await user.id();
  if (!id) return null;
  const ref = db.doc(`data/users/${id}/hort`);
  return {
    get: async () => {
      const snap = await ref.get();
      return snap.exists ? structuredClone(snap.data()) : null;
    },
    set: (p) => ref.set(p),
    delay: 800,
  };
}

// Verbindet sich mit dem zweiten Speicherort, falls vorhanden.
// onMerged bekommt einen zusammengeführten Stand, wenn anderswo weitergespielt wurde.
export function createStore(initial, onMerged) {
  let profile = initial;
  let cloud = null;
  let writing = false;
  let pending = false;

  async function flushCloud() {
    if (!cloud || writing) {
      pending = true;
      return;
    }
    writing = true;
    pending = false;
    try {
      await cloud.set(JSON.parse(JSON.stringify(profile)));
    } catch (e) {
      // Wer nur ansehen darf, kann nicht schreiben – dann bleibt es beim Browser-Speicher
      if (e?.code === 'invalid_argument' || e?.code === 'revoked' || e?.code === 'not_granted') cloud = null;
    } finally {
      writing = false;
      if (pending && cloud) flushCloud();
    }
  }

  async function connect() {
    try {
      const backend = await openBackend();
      if (!backend) return;
      const raw = await backend.get();
      cloud = backend;
      const remote = raw ? sanitizeProfile(raw) : null;
      const merged = mergeProfiles(profile, remote);
      if (!sameProfile(merged, profile)) {
        profile = merged;
        saveLocal(profile);
        onMerged?.(profile);
      }
      if (!remote || !sameProfile(merged, remote)) flushCloud();
    } catch {
      cloud = null;
    }
  }

  connect();

  // Mehrere schnelle Änderungen (z. B. Karten durchschalten) werden zu einem Schreibvorgang.
  // Die Datei der Desktop-Fassung wird sofort geschrieben, damit beim Beenden nichts fehlt.
  let timer = 0;
  const scheduleFlush = () => {
    clearTimeout(timer);
    if (cloud && !cloud.delay) flushCloud();
    else timer = setTimeout(flushCloud, cloud?.delay ?? 800);
  };

  return {
    get: () => profile,
    save(next) {
      profile = next;
      saveLocal(profile);
      scheduleFlush();
    },
    get cloud() {
      return !!cloud;
    },
  };
}
