// Service worker: precache the app shell so Harp Trainer works offline once
// installed to the home screen. Bump CACHE when you change any cached file.
const CACHE = "harp-trainer-v28";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./vendor/abcjs-basic-min.js",
  "./vendor/tonejs-midi.js",
  "./vendor/fflate.min.js",
  "./js/app.js",
  "./js/tuner.js",
  "./js/metronome.js",
  "./js/songs.js",
  "./js/pitch.js",
  "./js/notes.js",
  "./js/harmonica.js",
  "./js/tablature.js",
  "./js/importers.js",
  "./js/tunesearch.js",
  "./js/store.js",
  "./js/starter-songs.js",
  "./js/settings.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Cache-first for app assets, falling back to network (and caching new GETs).
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok && new URL(req.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
