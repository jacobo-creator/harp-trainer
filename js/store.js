// Tiny promise-based IndexedDB wrapper for saved songs.
// A song: { id, title, key, tab, abc, notes, photos:[dataURL], createdAt, updatedAt }

import { STARTER_SONGS } from "./starter-songs.js";

const DB_NAME = "harp-trainer";
const DB_VERSION = 1;
const STORE = "songs";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("updatedAt", "updatedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode) {
  return openDB().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

function asPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSongs() {
  const store = await tx("readonly");
  const all = await asPromise(store.getAll());
  return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getSong(id) {
  const store = await tx("readonly");
  return asPromise(store.get(id));
}

export async function saveSong(song) {
  const now = Date.now();
  const record = {
    photos: [],
    tab: "",
    abc: "",
    notes: "",
    key: "C",
    ...song,
    id: song.id || crypto.randomUUID(),
    createdAt: song.createdAt || now,
    updatedAt: now,
  };
  const store = await tx("readwrite");
  await asPromise(store.put(record));
  return record;
}

export async function deleteSong(id) {
  const store = await tx("readwrite");
  return asPromise(store.delete(id));
}

// Seed each starter song once, ever. We remember which ids we've seeded so
// that (a) deleting a starter song doesn't bring it back, and (b) starter
// songs added in a later update get seeded without duplicating the old ones.
export async function seedStarterSongs() {
  let seeded;
  try {
    seeded = JSON.parse(localStorage.getItem("harp-seeded-ids") || "[]");
  } catch {
    seeded = [];
  }
  const done = new Set(seeded);

  // Migrate the original single-flag seeding (v8) so its songs aren't re-added.
  if (done.size === 0 && localStorage.getItem("harp-seeded")) {
    ["starter-scale", "starter-twinkle", "starter-mary", "starter-ode"].forEach((id) =>
      done.add(id)
    );
  }

  for (const song of STARTER_SONGS) {
    if (done.has(song.id)) continue;
    try {
      await saveSong({ ...song });
      done.add(song.id);
    } catch (e) {
      console.warn("Could not seed song", song.id, e);
    }
  }
  localStorage.setItem("harp-seeded-ids", JSON.stringify([...done]));
  await backfillField("difficulty", "harp-diff-backfill");
  await backfillField("lyrics", "harp-lyrics-backfill");
}

// One-time: add a field (e.g. difficulty, lyrics) that was introduced in a
// later version onto already-seeded starter songs, without disturbing their
// other fields or any user edits.
async function backfillField(field, flag) {
  if (localStorage.getItem(flag)) return;
  localStorage.setItem(flag, "1");
  for (const def of STARTER_SONGS) {
    if (!def[field]) continue;
    try {
      const existing = await getSong(def.id);
      if (existing && !existing[field]) {
        await saveSong({ ...existing, [field]: def[field] });
      }
    } catch {
      /* ignore */
    }
  }
}
