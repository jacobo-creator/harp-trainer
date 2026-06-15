// Search the free, legal tune database at thesession.org (folk/traditional
// repertoire) and turn a result into ABC for the editor. Modern/pop songs are
// copyrighted and not available via any open notes API — for those, importing a
// MIDI is the path.

const BASE = "https://thesession.org";

const TYPE_METER = {
  jig: "6/8",
  reel: "4/4",
  hornpipe: "4/4",
  "slip jig": "9/8",
  polka: "2/4",
  slide: "12/8",
  waltz: "3/4",
  mazurka: "3/4",
  march: "4/4",
  strathspey: "4/4",
  barndance: "4/4",
  "three-two": "3/2",
};

const MODE = {
  major: "",
  minor: "m",
  ionian: "",
  dorian: "Dor",
  phrygian: "Phr",
  lydian: "Lyd",
  mixolydian: "Mix",
  aeolian: "m",
  locrian: "Loc",
};

function convertKey(k) {
  if (!k) return "C";
  const m = k.match(/^([A-G][#b]?)(.*)$/i);
  if (!m) return "C";
  const root = m[1][0].toUpperCase() + (m[1][1] || "");
  const mode = (m[2] || "").toLowerCase();
  const suffix = MODE[mode] !== undefined ? MODE[mode] : "";
  return root + suffix;
}

export async function searchTunes(query) {
  const url = `${BASE}/tunes/search?q=${encodeURIComponent(query)}&format=json&perpage=20`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Search request failed (" + r.status + ").");
  const d = await r.json();
  return (d.tunes || []).map((t) => ({ id: t.id, name: t.name, type: t.type }));
}

// Fetch a tune and build a complete ABC string from one of its settings.
export async function fetchTuneAbc(id, settingIdx = 0) {
  const r = await fetch(`${BASE}/tunes/${id}?format=json`);
  if (!r.ok) throw new Error("Couldn't load that tune (" + r.status + ").");
  const d = await r.json();
  const setting = (d.settings || [])[settingIdx];
  if (!setting || !setting.abc) throw new Error("No notation available for this tune.");

  const meter = TYPE_METER[(d.type || "").toLowerCase()] || "4/4";
  const key = convertKey(setting.key);
  const body = setting.abc.replace(/!/g, "\n").trim(); // ! is a line break here
  const title = (d.name || "Tune").replace(/[\r\n]+/g, " ");
  const abc = `X:1\nT:${title}\nM:${meter}\nL:1/8\nK:${key}\n${body}\n`;
  return { abc, title: d.name || "Tune", settingsCount: (d.settings || []).length };
}
