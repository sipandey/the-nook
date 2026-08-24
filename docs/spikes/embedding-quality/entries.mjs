// Realistic journal-style entries for the in-browser-embedding-quality spike
// (docs/ARCHITECTURE.md §10.5 step 3 / §10.6.10). First 5 reused verbatim
// from web/src/lib/preview.ts's fixtures; the rest written to cover a wider
// spread of topics, moods, and phrasing so the spike can test genuine
// semantic (not keyword) matching.
export const ENTRIES = [
  {
    id: "e1",
    text: "The morning light hit the kitchen table just right today. Sat with coffee and watched the dust motes dance for a few minutes before the day pulled me in. Small, private victory to just sit and observe without reaching for my phone.",
  },
  {
    id: "e2",
    text: "Overwhelmed by the project deadline. Trying to break it down into smaller, manageable pieces, but the overarching weight is still there. Need to remember to breathe and that preparation is the antidote to this specific flavor of dread.",
  },
  {
    id: "e3",
    text: "An unexpected rainstorm caught us on the way back from dinner. Instead of rushing, we just walked in it. Sometimes the best moments are the ones you can't plan for.",
  },
  {
    id: "e4",
    text: "The hardest part of starting over isn't the blank page, it's letting go of the draft you thought you were supposed to write. Today feels heavy, but necessary.",
  },
  {
    id: "e5",
    text: "Everything feels so overwhelming lately, like I can't catch my breath or figure out what matters most right now.",
  },
  {
    id: "e6",
    text: "Mom called today just to talk, no reason. We ended up laughing about the time the dog ate an entire birthday cake. Miss having her closer.",
  },
  {
    id: "e7",
    text: "Ran five miles this morning before anyone else was awake. Legs are wrecked but my head feels clear for the first time in a week.",
  },
  {
    id: "e8",
    text: "Stared at the canvas for two hours and put down maybe three brushstrokes I actually liked. Wondering if I've lost whatever it was I used to have.",
  },
  {
    id: "e9",
    text: "Landed in a city where I don't speak the language and somehow ended up sharing a table with strangers who fed me the best meal I've had all year.",
  },
  {
    id: "e10",
    text: "It's been a year since we lost him and today the grief snuck up on me in the cereal aisle of all places. Bought his favorite brand out of habit.",
  },
  {
    id: "e11",
    text: "Checked my bank account three times today like the number would change. Rent is due Friday and I'm short. Hate how much this is living in my head rent-free (no pun intended).",
  },
  {
    id: "e12",
    text: "The barista remembered my order for the first time. Ridiculous how much that small thing made me smile the rest of the day.",
  },
  {
    id: "e13",
    text: "Told the room my idea in the meeting and immediately regretted it — could feel my face going red. Nobody laughed. I think I made it up in my head.",
  },
  {
    id: "e14",
    text: "Finished the puzzle we started three weeks ago. Genuinely don't know what to do with my hands in the evenings now.",
  },
  {
    id: "e15",
    text: "My daughter asked me why the sky was blue and I realized I actually don't know the real answer. Told her it's because the sky is shy and blue is its favorite color to hide behind. She accepted this completely.",
  },
  {
    id: "e16",
    text: "The laptop died mid-presentation and I had to talk through the slides from memory. Somehow that went better than the version with slides ever would have.",
  },
  {
    id: "e17",
    text: "Haven't slept more than four hours a night this week. Everything feels one shade duller than it should, like watching the day through a dirty window.",
  },
  {
    id: "e18",
    text: "Called an old friend I hadn't spoken to in two years. Picked up exactly where we left off, like no time had passed at all.",
  },
  {
    id: "e19",
    text: "Handed in my notice today. Terrifying and the first time in months I've felt like I could breathe.",
  },
  {
    id: "e20",
    text: "Repainted the spare room a color I probably won't love in six months, but for right now it makes the whole apartment feel like it belongs to me.",
  },
];

// Queries deliberately avoid the exact vocabulary of their expected match,
// to test semantic rather than keyword overlap.
export const QUERIES = [
  { query: "a quiet peaceful moment alone in the morning", expected: "e1" },
  { query: "feeling buried under work pressure", expected: "e2" },
  { query: "getting soaked in unexpected weather and not minding", expected: "e3" },
  { query: "creative block, feeling stuck making art", expected: "e8" },
  { query: "an anxious spiral about money", expected: "e11" },
  { query: "missing someone who died", expected: "e10" },
  { query: "reconnecting with an old friendship", expected: "e18" },
  { query: "quitting a job", expected: "e19" },
  { query: "a small act of kindness from a stranger that made my day", expected: "e12" },
  { query: "trouble sleeping and feeling foggy", expected: "e17" },
  { query: "explaining something to my kid", expected: "e15" },
  { query: "exercise clearing my head", expected: "e7" },
];
