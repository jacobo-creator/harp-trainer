// Songs seeded on first launch so the library isn't empty. The simple tunes
// sit in the clean middle octave (holes 4–7) of a C harp; the classical pieces
// add variety across difficulty levels. `difficulty` is "easy" | "medium" |
// "hard". Harder pieces may contain a few notes that aren't reachable on a
// diatonic harp (shown as note names on the staff) — that's part of why
// they're hard. Everything is editable after seeding.

export const STARTER_SONGS = [
  // ---------------- easy: first-position basics ----------------
  {
    id: "starter-scale",
    title: "C Major Scale (1st position)",
    key: "C",
    difficulty: "easy",
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
    difficulty: "easy",
    tab:
      "+4 +4 +6 +6  -6 -6 +6    -5 -5 +5 +5  -4 -4 +4    " +
      "+6 +6 -5 -5  +5 +5 -4    +6 +6 -5 -5  +5 +5 -4    " +
      "+4 +4 +6 +6  -6 -6 +6    -5 -5 +5 +5  -4 -4 +4",
    abc:
      "X:1\nT:Twinkle, Twinkle, Little Star\nM:4/4\nL:1/4\nK:C\n" +
      "c c g g | a a g2 | f f e e | d d c2 | g g f f | e e d2 |" +
      " g g f f | e e d2 | c c g g | a a g2 | f f e e | d d c2 |\n",
    lyrics:
      "Twin-kle twin-kle lit-tle star how I won-der what you are " +
      "up a-bove the world so high like a dia-mond in the sky " +
      "Twin-kle twin-kle lit-tle star how I won-der what you are",
    notes: "All blow/draw on holes 4–6, no bends. A good first song.",
  },
  {
    id: "starter-mary",
    title: "Mary Had a Little Lamb",
    key: "C",
    difficulty: "easy",
    tab:
      "+5 -4 +4 -4  +5 +5 +5    -4 -4 -4    +5 +6 +6    " +
      "+5 -4 +4 -4  +5 +5 +5 +5  -4 -4 +5 -4  +4",
    abc:
      "X:1\nT:Mary Had a Little Lamb\nM:4/4\nL:1/4\nK:C\n" +
      "e d c d | e e e2 | d d d2 | e g g2 | e d c d | e e e e | d d e d | c4 |\n",
    lyrics:
      "Ma-ry had a lit-tle lamb lit-tle lamb lit-tle lamb " +
      "Ma-ry had a lit-tle lamb its fleece was white as snow",
    notes: "Just three notes to start: +4 (C), -4 (D), +5 (E).",
  },
  {
    id: "starter-jingle",
    title: "Jingle Bells (chorus)",
    key: "C",
    difficulty: "easy",
    tab:
      "+5 +5 +5    +5 +5 +5    +5 +6 +4 -4  +5    " +
      "-5 -5 -5 -5  -5 +5 +5 +5  +5 -4 -4 +5  -4 +6",
    abc:
      "X:1\nT:Jingle Bells\nM:4/4\nL:1/4\nK:C\n" +
      "e e e2 | e e e2 | e g c d | e4 | f f f f | f e e e | e d d e | d2 g2 |\n",
    notes: "Famous chorus, holes 4–6.",
  },
  {
    id: "starter-frere",
    title: "Frère Jacques",
    key: "C",
    difficulty: "easy",
    tab:
      "+4 -4 +5 +4  +4 -4 +5 +4  +5 -5 +6  +5 -5 +6  " +
      "+6 -6 +6 -5 +5 +4  +6 -6 +6 -5 +5 +4  +4 -2 +4  +4 -2 +4",
    abc:
      "X:1\nT:Frere Jacques\nM:4/4\nL:1/4\nK:C\n" +
      "c d e c | c d e c | e f g2 | e f g2 | g a g f e c | g a g f e c | c G c2 | c G c2 |\n",
    notes: "A round — try it slow with the metronome, then speed up.",
  },
  {
    id: "starter-london",
    title: "London Bridge",
    key: "C",
    difficulty: "easy",
    tab:
      "+6 -6 +6 -5  +5 -5 +6  -4 +5 -5  +5 -5 +6  " +
      "+6 -6 +6 -5  +5 -5 +6  -4 +6 -5 +5  +4",
    abc:
      "X:1\nT:London Bridge\nM:4/4\nL:1/4\nK:C\n" +
      "g a g f | e f g2 | d e f2 | e f g2 | g a g f | e f g2 | d g f e | c4 |\n",
    notes: "Holes 4–6, no bends.",
  },
  {
    id: "starter-macdonald",
    title: "Old MacDonald",
    key: "C",
    difficulty: "easy",
    tab:
      "+4 +4 +4 +6  -6 -6 +6  +5 +5 -4 -4  +4  " +
      "+4 +4 +4 +6  -6 -6 +6  +5 +5 -4 -4  +4",
    abc:
      "X:1\nT:Old MacDonald\nM:4/4\nL:1/4\nK:C\n" +
      "c c c g | a a g2 | e e d d | c4 | c c c g | a a g2 | e e d d | c4 |\n",
    notes: "Easy first-position tune on holes 4–6.",
  },

  // ---------------- classical: easy ----------------
  {
    id: "starter-ode",
    title: "Ode to Joy — Beethoven",
    key: "C",
    difficulty: "easy",
    tab:
      "+5 +5 -5 +6  +6 -5 +5 -4  +4 +4 -4 +5  +5 -4 -4    " +
      "+5 +5 -5 +6  +6 -5 +5 -4  +4 +4 -4 +5  -4 +4 +4",
    abc:
      "X:1\nT:Ode to Joy\nM:4/4\nL:1/4\nK:C\n" +
      "e e f g | g f e d | c c d e | e d d2 | e e f g | g f e d | c c d e | d c c2 |\n",
    notes: "Beethoven's 9th. Holes 4–6, no bends — watch the needle on each note.",
  },
  {
    id: "classical-beethoven5",
    title: "Symphony No. 5 (motif) — Beethoven",
    key: "C",
    difficulty: "easy",
    tab: "+6 +6 +6 +5    -5 -5 -5 -4",
    abc:
      "X:1\nT:Symphony No.5 motif\nM:2/4\nL:1/8\nK:C\n" +
      "z g g g | e2 | z f f f | d2 |\n",
    notes: "The famous four-note 'fate' motif (adapted to C major).",
  },
  {
    id: "classical-surprise",
    title: "Surprise Symphony (theme) — Haydn",
    key: "C",
    difficulty: "easy",
    tab: "+4 +4 +5 +5  +6 +6 +5  -5 -5 -4 -4  +4",
    abc:
      "X:1\nT:Surprise Symphony\nM:4/4\nL:1/4\nK:C\n" +
      "c c e e | g g e2 | f f d d | c4 |\n",
    notes: "Haydn's gentle theme — then the famous loud 'surprise' chord.",
  },

  // ---------------- classical: medium ----------------
  {
    id: "classical-canon",
    title: "Canon in D (theme) — Pachelbel",
    key: "C",
    difficulty: "medium",
    tab:
      "+8 -8 +7 -7  -6 +6 -6 -7  +7 -7 -6 +6  -5 +5 -4 +4",
    abc:
      "X:1\nT:Canon (Pachelbel)\nM:4/4\nL:1/4\nK:C\n" +
      "e' d' c' b | a g a b | c' b a g | f e d c |\n",
    notes: "The well-known descending line, in C for the upper register (holes 4–8).",
  },
  {
    id: "classical-danube",
    title: "The Blue Danube — J. Strauss II",
    key: "C",
    difficulty: "medium",
    tab: "+4 +5 +6  +6  +4 +5 +6  +6  -6 -6  -5 -5",
    abc:
      "X:1\nT:The Blue Danube\nM:3/4\nL:1/4\nK:C\n" +
      "c e g | g2 z | c e g | g2 z | a2 z | a2 z | f2 z | f2 z |\n",
    notes: "Waltz time — pair it with the metronome at 3 beats per bar.",
  },

  // ---------------- classical: hard ----------------
  {
    id: "classical-furelise",
    title: "Für Elise (opening) — Beethoven",
    key: "C",
    difficulty: "hard",
    tab: "",
    abc:
      "X:1\nT:Fur Elise\nM:2/4\nL:1/8\nK:Am\n" +
      "e ^d e ^d | e B d c | A2 z2 | C E A B | E ^G B c | e ^d e ^d | e B d c | A2 z2 |\n",
    notes:
      "The D♯ and G♯ are chromatic — the app suggests the nearest playable note (the blue tab marked *). Tip: hit +8va transpose to move it up where it's fully playable.",
  },
  {
    id: "classical-turca",
    title: "Rondo alla Turca (theme) — Mozart",
    key: "C",
    difficulty: "hard",
    tab: "",
    abc:
      "X:1\nT:Rondo alla Turca\nM:2/4\nL:1/16\nK:Am\n" +
      "BA^GA c2 z2 | dcBc e2 z2 | fe^de B2 z2 | cBAB d2 z2 |\n",
    notes:
      "Fast turning figures with chromatic G♯/D♯ (the app suggests the nearest playable note for those). Slow it right down with the metronome first.",
  },

  // ---------------- nursery rhymes (for little ones) ----------------
  {
    id: "nursery-itsy",
    title: "Itsy Bitsy Spider",
    key: "C",
    difficulty: "easy",
    tab:
      "-2  +4 +4 +4 -4 +5 +5  +5 -4 +4 -4 +5 +4  " +
      "+5 +5 -5 +6 +6  +6 -5 +5 -5 +6 +5  +4 +4 +4 -4 +5 +5  +5 -4 +4 -4 +5 +4",
    abc:
      "X:1\nT:Itsy Bitsy Spider\nM:4/4\nL:1/4\nK:C\n" +
      "G | c c c d e e | e d c d e c | e e f g2 g | g f e f g e | c c c d e e | e d c d e c |\n",
    notes: "A favourite — holes 4–6 with one low draw (−2) pickup.",
  },
  {
    id: "nursery-hotcross",
    title: "Hot Cross Buns",
    key: "C",
    difficulty: "easy",
    tab: "+5 -4 +4  +5 -4 +4  +4 +4 +4 +4 -4 -4 -4 -4  +5 -4 +4",
    abc:
      "X:1\nT:Hot Cross Buns\nM:4/4\nL:1/4\nK:C\n" +
      "e d c2 | e d c2 | c c c c d d d d | e d c2 |\n",
    lyrics: "Hot cross buns Hot cross buns one a pen-ny two a pen-ny Hot cross buns",
    notes: "The simplest first tune: just +5 -4 +4 (E D C).",
  },
  {
    id: "nursery-row",
    title: "Row, Row, Row Your Boat",
    key: "C",
    difficulty: "easy",
    tab:
      "+4 +4 +4 -4 +5  +5 -4 +5 -5 +6  " +
      "+7 +7 +7 +6 +6 +6 +5 +5 +5 +4 +4 +4  +6 -5 +5 -4 +4",
    abc:
      "X:1\nT:Row Row Row Your Boat\nM:6/8\nL:1/8\nK:C\n" +
      "c c c d e2 | e d e f g2 | (3c'c'c' (3ggg (3eee (3ccc | g f e d c2 |\n",
    notes: "Great as a round — try it against the metronome.",
  },
  {
    id: "nursery-threeblind",
    title: "Three Blind Mice",
    key: "C",
    difficulty: "easy",
    tab: "+5 -4 +4  +5 -4 +4  +6 -5 -5 +5  +6 -5 -5 +5",
    abc:
      "X:1\nT:Three Blind Mice\nM:4/4\nL:1/4\nK:C\n" +
      "e d c2 | e d c2 | g f f e2 | g f f e2 |\n",
    lyrics: "Three blind mice Three blind mice see how they run see how they run",
    notes: "Three notes down, then a step pattern. Easy and fun.",
  },

  // ---------------- classical: more ----------------
  {
    id: "classical-joy",
    title: "Joy to the World — Handel",
    key: "C",
    difficulty: "easy",
    tab: "+7 -7 -6 +6  -5 +5 -4 +4  +6 +6 -6 -6  -7 -7 +7",
    abc:
      "X:1\nT:Joy to the World\nM:4/4\nL:1/4\nK:C\n" +
      "c' b a g | f e d c | g g a a | b b c'2 |\n",
    notes: "Opens with a full descending scale — a great ear-training tune.",
  },
  {
    id: "classical-mountainking",
    title: "In the Hall of the Mountain King — Grieg",
    key: "C",
    difficulty: "medium",
    tab:
      "-6 -7 +7 -8 +8 +7 +8  -8 -9 -8  -6 -7 +7 -8 +8 +7 +8  -9 +8 +7",
    abc:
      "X:1\nT:Hall of the Mountain King\nM:4/4\nL:1/4\nK:Am\n" +
      "a b c' d' e' c' e' | d' f' d'2 | a b c' d' e' c' e' | f' e' c'2 |\n",
    notes: "Grieg's creeping theme (upper octave so it's playable). Start slow and speed up — that's the whole idea!",
  },

  // ---------------- fun (great on kalimba, also work on harmonica) ----------------
  {
    id: "fun-happybirthday",
    title: "Happy Birthday",
    key: "C",
    difficulty: "easy",
    tab: "",
    abc:
      "X:1\nT:Happy Birthday\nM:3/4\nL:1/4\nK:C\n" +
      "G/G/ | A G c | B2 G/G/ | A G d | c2 G/G/ | g e c | B A F/F/ | e c d | c3 |\n",
    lyrics:
      "Hap-py birth-day to you Hap-py birth-day to you " +
      "Hap-py birth-day dear some-one Hap-py birth-day to you",
    notes: "Everyone needs this one. Lovely and easy on the kalimba.",
  },
  {
    id: "fun-yankee",
    title: "Yankee Doodle",
    key: "C",
    difficulty: "easy",
    tab: "",
    abc:
      "X:1\nT:Yankee Doodle\nM:4/4\nL:1/4\nK:C\n" +
      "c c d e | c e d2 | c c d e | d2 z2 | c c d e | f e d c | B G A B | c2 z2 |\n",
    notes: "Bouncy and bright — fun to play fast.",
  },
  {
    id: "fun-morningmood",
    title: "Morning Mood — Grieg",
    key: "C",
    difficulty: "medium",
    tab: "",
    abc:
      "X:1\nT:Morning Mood\nM:6/8\nL:1/8\nK:C\n" +
      "g e d c d e | g e d c d e | g a g e d c | d2 e2 c2 |\n",
    notes: "Gentle and flowing (from Peer Gynt) — beautiful on the kalimba's bright tines.",
  },

  // ---------------- pretty & calming (longer pieces) ----------------
  {
    id: "calm-amazinggrace",
    title: "Amazing Grace",
    key: "C",
    difficulty: "easy",
    tab: "",
    abc:
      "X:1\nT:Amazing Grace\nM:3/4\nL:1/4\nK:C\n" +
      "G | c e c | e d c | A3 | G c e | c e d | g3 |" +
      " e g e | c A c | A2 G | G c e | c e d | c3 |\n",
    notes: "A calm, pentatonic classic — flows beautifully on the kalimba. All C, D, E, G, A (no awkward notes).",
  },
  {
    id: "calm-auldlangsyne",
    title: "Auld Lang Syne",
    key: "C",
    difficulty: "medium",
    tab: "",
    abc:
      "X:1\nT:Auld Lang Syne\nM:4/4\nL:1/4\nK:C\n" +
      "G | c c e d | c2 d2 | e c c e | g2 a2 | a g e e | c d c d |" +
      " e d c A | A G c2 | a g e e | c d c d | a g e e | g2 a2 |" +
      " c' g e e | c d c d | e d c A | A G c2 |\n",
    notes: "Nostalgic and gentle — a nice longer piece to settle into. Pentatonic, so easy on the ear.",
  },

  // ---------------- lyre harp (C-major, in range, every note is a string) ----
  // Arranged to sit inside the 19/21-string lyre (C3–B5) using only white
  // notes, so nothing needs transposing and every note lands on a real string.
  // They play beautifully on the kalimba and harmonica too.
  {
    id: "lyre-greensleeves",
    title: "Greensleeves",
    key: "C",
    difficulty: "medium",
    tab: "",
    abc:
      "X:1\nT:Greensleeves\nM:3/4\nL:1/4\nQ:1/4=100\nK:Am\n" +
      "A | c2 d | e3/2 f/ e | d2 B | G3/2 A/ B | c2 A | A2 G | A2 A |" +
      " c2 d | e3/2 f/ e | d2 B | G3/2 A/ B | c2 A | B2 G | A3 |" +
      " g2 g | g3/2 f/ e | d2 B | G3/2 A/ B | c2 A | A2 G | A2 A |" +
      " g2 g | g3/2 f/ e | d2 B | G3/2 A/ B | c2 A | B2 G | A3 |\n",
    notes:
      "The classic lyre tune. This is the all-natural (modal) version so every " +
      "note is a real string — no sharps needed. Play it slow and flowing.",
  },
  {
    id: "lyre-silentnight",
    title: "Silent Night",
    key: "C",
    difficulty: "easy",
    tab: "",
    abc:
      "X:1\nT:Silent Night\nM:3/4\nL:1/4\nQ:1/4=96\nK:C\n" +
      "G3/2 A/ G | E2 z | G3/2 A/ G | E2 z | d2 d | B3 | c2 c | G3 |" +
      " A2 A | c3/2 B/ A | G3/2 A/ G | E2 z | A2 A | c3/2 B/ A | G3/2 A/ G | E2 z |" +
      " d2 d | f3/2 d/ B | c3 | e3 | c2 G | E3/2 G/ F | D2 z | C3 |\n",
    notes: "A calm, familiar carol that sits right in the lyre's sweet middle strings.",
  },
  {
    id: "lyre-lavendersblue",
    title: "Lavender's Blue",
    key: "C",
    difficulty: "easy",
    tab: "",
    abc:
      "X:1\nT:Lavender's Blue\nM:3/4\nL:1/4\nQ:1/4=120\nK:C\n" +
      "C | F2 F | F2 F | E F G | A2 z | c2 A | F2 F | E F D | C2 z |" +
      " C | F2 F | F2 F | E F G | A2 z | c2 A | F G E | D E D | C3 |\n",
    notes: "Gentle old English lullaby-waltz — try it with the metronome at 3 beats per bar.",
  },
  {
    id: "lyre-kumbayah",
    title: "Kum Ba Yah",
    key: "C",
    difficulty: "easy",
    tab: "",
    abc:
      "X:1\nT:Kum Ba Yah\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\n" +
      "C2 F2 | A3 A | A2 G2 | F4 | F2 A2 | c3 A | G2 F2 | E4 |" +
      " C2 F2 | A3 A | A2 G2 | F4 | A2 c2 | A2 G2 | F2 D2 | C4 |\n",
    notes: "Slow and peaceful — a lovely one to practise smooth string-to-string plucking.",
  },
  {
    id: "lyre-saints",
    title: "When the Saints Go Marching In",
    key: "C",
    difficulty: "easy",
    tab: "",
    abc:
      "X:1\nT:When the Saints Go Marching In\nM:4/4\nL:1/4\nQ:1/4=112\nK:C\n" +
      "C E F | G3 z | C E F | G3 z | C E F | G2 E2 | C2 E2 | D4 |" +
      " E3 E | D2 C2 | C2 E2 | G4 | A3 G | F3 z | E2 C2 | D2 z2 | C4 |\n",
    notes: "Bright and bouncy for a change of pace — all in the lower half of the lyre.",
  },
];
