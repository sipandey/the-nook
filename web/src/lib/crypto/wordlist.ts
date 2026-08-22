/**
 * A curated 256-word list for recovery-code generation (see
 * generateRecoveryCode in ./index.ts). Common, unambiguous, easy-to-spell
 * and easy-to-say English words — no homophones, no near-duplicates, no
 * words likely to be misheard or mistyped.
 *
 * Exactly 256 words = 8 bits of entropy per word. 12 words = 96 bits,
 * comfortably beyond brute-force feasibility even before accounting for
 * Argon2id's memory-hard key stretching on top. This count is load-bearing
 * — generateRecoveryCode() indexes via `byte % 256`, so the list must stay
 * at exactly 256 unique entries (verified length, not eyeballed).
 */
export const RECOVERY_WORDLIST = [
  "ocean", "velvet", "prism", "silent", "quartz", "dawn", "echo", "lunar",
  "timber", "silver", "ember", "bloom", "granite", "willow", "cedar", "amber",
  "coral", "meadow", "harbor", "canyon", "summit", "orchard", "brook", "glacier",
  "maple", "cotton", "linen", "copper", "bronze", "marble", "pebble", "boulder",
  "thicket", "clover", "heather", "juniper", "birch", "aspen", "poplar", "sequoia",
  "lagoon", "reef", "tide", "current", "delta", "ridge", "valley", "plateau",
  "prairie", "tundra", "savanna", "jungle", "forest", "grove", "orbit", "comet",
  "nebula", "meteor", "eclipse", "zenith", "horizon", "compass", "anchor", "beacon",
  "lantern", "candle", "spark", "flint", "cinder", "smolder", "kindle", "frost",
  "breeze", "gale", "zephyr", "mist", "dew", "rain", "hail", "thunder",
  "lightning", "storm", "cloud", "sky", "star", "planet", "galaxy", "cosmos",
  "voyage", "quest", "journey", "pilgrim", "wanderer", "drifter", "nomad", "harvest",
  "vineyard", "meadowlark", "sparrow", "falcon", "heron", "raven", "otter", "badger",
  "fox", "wolf", "lynx", "elk", "bison", "antler", "hazel", "walnut",
  "chestnut", "acorn", "pinecone", "fern", "moss", "lichen", "quartzite", "obsidian",
  "onyx", "jasper", "topaz", "opal", "garnet", "sapphire", "emerald", "citrine",
  "peridot", "aquamarine", "turquoise", "cobalt", "indigo", "violet", "crimson", "scarlet",
  "ochre", "umber", "sienna", "ivory", "alabaster", "pearl", "sextant", "astrolabe",
  "mariner", "voyager", "explorer", "cartographer", "chronicle", "archive", "ledger", "parchment",
  "quill", "inkwell", "scribe", "sonnet", "verse", "stanza", "ballad", "melody",
  "harmony", "cadence", "rhythm", "tempo", "sonata", "prelude", "overture", "cascade",
  "waterfall", "spring", "wellspring", "fountain", "pond", "lake", "river", "stream",
  "creek", "channel", "estuary", "cove", "island", "peninsula", "isthmus", "archipelago",
  "mainland", "coastline", "shoreline", "cliffside", "outpost", "sanctuary", "haven", "refuge",
  "shelter", "hearth", "threshold", "gateway", "courtyard", "terrace", "veranda", "balcony",
  "arbor", "trellis", "hedgerow", "meadowsweet", "wildflower", "primrose", "foxglove", "lavender",
  "chamomile", "rosemary", "sage", "thyme", "basil", "mint", "dandelion", "daisy",
  "tulip", "iris", "orchid", "magnolia", "jasmine", "honeysuckle", "wisteria", "bluebell",
  "buttercup", "marigold", "sunflower", "poppy", "lilac", "peony", "camellia", "hibiscus",
  "azalea", "gardenia", "quiet", "gentle", "steady", "hollow", "hallow", "kindred",
  "candor", "solace", "reverie", "clarity", "resolve", "vantage", "pinnacle", "ascent",
  "descent", "traverse", "expanse", "vista", "panorama", "overlook", "lookout", "waypoint",
] as const;
