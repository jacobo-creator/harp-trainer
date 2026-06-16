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

// Add the starter songs once, ever (a localStorage flag means deleting them
// doesn't bring them back on the next launch).
export async function seedStarterSongs() {
  if (localStorage.getItem("harp-seeded")) return;
  localStorage.setItem("harp-seeded", "1");
  for (const song of STARTER_SONGS) {
    try {
      await saveSong({ ...song });
    } catch (e) {
      console.warn("Could not seed song", song.id, e);
    }
  }
}
