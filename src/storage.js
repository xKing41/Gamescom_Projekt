// Speichert das Profil: immer im Browser, und als Claude-Artifact zusätzlich in der Datenbank,
// damit derselbe Stand am Handy und am PC gilt. In der Steam-Fassung kommt hier später die Steam Cloud dazu.

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

// Verbindet sich mit der Datenbank des Artifacts, falls vorhanden.
// onMerged bekommt einen zusammengeführten Stand, wenn auf einem anderen Gerät weitergespielt wurde.
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
    const use = window.claude?.use;
    if (typeof use !== 'function') return;
    try {
      const [db, user] = await Promise.all([use.call(window.claude, 'db'), use.call(window.claude, 'user')]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;
      const ref = db.doc(`data/users/${id}/hort`);
      const snap = await ref.get();
      cloud = ref;
      const remote = snap.exists ? sanitizeProfile(structuredClone(snap.data())) : null;
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

  // Mehrere schnelle Änderungen (z. B. Karten durchschalten) werden zu einem Schreibvorgang
  let timer = 0;
  const scheduleFlush = () => {
    clearTimeout(timer);
    timer = setTimeout(flushCloud, 800);
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
