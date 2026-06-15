# Harp Trainer

A harmonica practice app for iPhone (and any phone/desktop), built as an
installable **Progressive Web App** — no Mac, no Xcode, no App Store, and no
weekly re-signing like sideloaded `.ipa` files need.

## Features

- **Live tuner** — play a note and it shows the note name, how many cents
  sharp/flat you are (with a moving needle), and the exact frequency. Great
  for practicing **bends** and **fast note changes**.
- **Harmonica technique hint** — pick your harp's key and the tuner tells you
  which **hole + breath + bend** you're playing (e.g. `-3''` = draw 3,
  whole-step bend). Works for all 12 keys (G through F#).
- **Song / tab library** — save songs with:
  - **Harmonica tab** text (`+` blow, `−` draw, `'` bend)
  - **Sheet music** typed in [ABC notation](https://abcnotation.com/), rendered
    on a staff and **playable**
  - **Tab merged onto the sheet music** — the harmonica tab (hole/breath/bend)
    for the song's key is printed under each note on the staff, so you learn the
    tab *with* the rhythm and timing. Toggle on/off, and it follows the key.
  - **Photos** of printed sheet music
  - free-form practice notes
  - All stored **on-device** (IndexedDB) and searchable.
- **Works offline** once installed to the home screen.

## Put it on your iPhone

The tuner needs microphone access, which browsers only allow over **HTTPS**.
The easiest free way to host it:

### Option A — GitHub Pages (recommended)
1. Create a new GitHub repo and upload everything in this folder.
2. Repo **Settings → Pages → Build from branch → `main` / root**.
3. Wait ~1 minute; GitHub gives you an `https://<you>.github.io/<repo>/` URL.
4. On your iPhone, open that URL in **Safari**.
5. Tap **Share → Add to Home Screen**. You now have an app icon that opens
   full-screen.
6. Open it, go to the Tuner, tap **Start tuner**, and **Allow** the mic.

> Any static HTTPS host works too — Netlify, Cloudflare Pages, Vercel: just
> drag-and-drop this folder.

### Option B — test on your PC first
```
python -m http.server 8123
```
Then open <http://localhost:8123> in a desktop browser. The mic works on
`localhost`. (On your phone over the local network the mic will be blocked
because it isn't HTTPS — use Option A for the phone.)

## Project layout

```
index.html            app shell + markup
styles.css            mobile-first dark theme
manifest.webmanifest  PWA manifest (installable)
sw.js                 service worker (offline cache)
js/
  app.js              tab navigation + wiring
  tuner.js            mic capture, meter, technique hint
  pitch.js            autocorrelation pitch detection
  notes.js            frequency <-> note math
  harmonica.js        harp layouts + note→hole/breath/bend mapping
  store.js            IndexedDB song storage
  songs.js            song library + editor (tabs, ABC, photos)
  settings.js         shared harp-key setting
vendor/abcjs-basic-min.js   sheet-music rendering + playback
icons/                app icons
scripts/generate_icons.py   regenerate icons (needs Pillow)
```

## Notes / limitations

- Pitch detection is monophonic (one note at a time) — perfect for tuning and
  bend practice, not for chords.
- "Overblow/overdraw" notes aren't mapped (they're not standard Richter
  layout); the tuner will still show the correct note, just not a hole hint.
- To change cached files later, bump the `CACHE` version string in `sw.js` so
  the service worker picks up the new versions.
