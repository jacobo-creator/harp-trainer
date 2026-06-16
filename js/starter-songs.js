// A few first-position tunes for a C harmonica, seeded on first launch so the
// library isn't empty. All sit in the clean middle octave (holes 4–7), no
// bends, so they're playable straight away and show off the tab overlay.

export const STARTER_SONGS = [
  {
    id: "starter-scale",
    title: "C Major Scale (1st position)",
    key: "C",
    tab: "+4 -4 +5 -5  +6 -6 -7 +7    +7 -7 -6 +6  -5 +5 -4 +4",
    abc:
      "X:1\nT:C Major Scale\nM:4/4\nL:1/4\nK:C\n" +
      "c d e f | g a b c' | c' b a g | f e d c |\n",
    notes:
      "First-position major scale on holes 4–7 — the cleanest octave on a C harp. Great warm-up for the tuner.",
  },
  {
    id: "starter-twinkle",
    title: "Twinkle, Twinkle, Little Star",
    key: "C",
    tab:
      "+4 +4 +6 +6  -6 -6 +6    -5 -5 +5 +5  -4 -4 +4    " +
      "+6 +6 -5 -5  +5 +5 -4    +6 +6 -5 -5  +5 +5 -4    " +
      "+4 +4 +6 +6  -6 -6 +6    -5 -5 +5 +5  -4 -4 +4",
    abc:
      "X:1\nT:Twinkle, Twinkle, Little Star\nM:4/4\nL:1/4\nK:C\n" +
      "c c g g | a a g2 | f f e e | d d c2 | g g f f | e e d2 |" +
      " g g f f | e e d2 | c c g g | a a g2 | f f e e | d d c2 |\n",
    notes: "All blow/draw on holes 4–6, no bends. A good first song.",
  },
  {
    id: "starter-mary",
    title: "Mary Had a Little Lamb",
    key: "C",
    tab:
      "+5 -4 +4 -4  +5 +5 +5    -4 -4 -4    +5 +6 +6    " +
      "+5 -4 +4 -4  +5 +5 +5 +5  -4 -4 +5 -4  +4",
    abc:
      "X:1\nT:Mary Had a Little Lamb\nM:4/4\nL:1/4\nK:C\n" +
      "e d c d | e e e2 | d d d2 | e g g2 | e d c d | e e e e | d d e d | c4 |\n",
    notes: "Just three notes to start: +4 (C), -4 (D), +5 (E).",
  },
  {
    id: "starter-ode",
    title: "Ode to Joy (Beethoven)",
    key: "C",
    tab:
      "+5 +5 -5 +6  +6 -5 +5 -4  +4 +4 -4 +5  +5 -4 -4    " +
      "+5 +5 -5 +6  +6 -5 +5 -4  +4 +4 -4 +5  -4 +4 +4",
    abc:
      "X:1\nT:Ode to Joy\nM:4/4\nL:1/4\nK:C\n" +
      "e e f g | g f e d | c c d e | e d d2 | e e f g | g f e d | c c d e | d c c2 |\n",
    notes: "Holes 4–6. Watch the needle to keep each note in tune.",
  },
];
