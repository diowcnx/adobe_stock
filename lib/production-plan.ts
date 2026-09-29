export const BATCH_SIZE = 10;
export type GenerationMode = "transparent_png" | "regular_scene";

// Curated opportunity hypotheses, not live sales rankings. See docs/market-strategy.md.
export const WEEKLY_CATEGORIES = [
  { day: "จันทร์", name: "Wall art", mode: "regular_scene", kind: "artwork",
    buyer: "interior designers and print publishers seeking distinctive unframed artwork",
    seeds: ["tidal estuary contour relief", "monsoon rain on indigo paper", "terraced rice field geometry", "basalt strata ink study", "mangrove root negative shapes", "woven reed rhythm abstraction", "lunar clay pigment circles", "salt marsh aerial color fields", "weathered limestone botanical imprint", "coastal wind sculpted dune lines"] },
  { day: "อังคาร", name: "Wedding stationery", mode: "transparent_png", kind: "asset",
    buyer: "invitation designers needing modular botanical wedding design elements",
    seeds: ["meadow seedpod corner spray", "olive and linen ribbon knot", "citrus blossom crescent", "pressed fern wax seal ornament without lettering", "orchid and woven palm ornament", "pomegranate branch arch", "dried grass asymmetrical wreath", "fig leaf and silk ribbon cluster", "violet pansy border fragment", "cosmos and copper leaf bouquet"] },
  { day: "พุธ", name: "Tactile branding", mode: "regular_scene", kind: "advertising",
    buyer: "small craft brands and packaging designers needing material-specific campaign backgrounds",
    seeds: ["recycled cotton paper fiber layers", "terracotta pigment and ceramic glaze", "indigo dyed linen folds", "cork granule material transition", "repaired woven wool seam", "pressed seaweed paper surface", "hand carved wood shaving spiral", "unbleached hemp cord weave", "hammered copper patina detail", "plant based ink on textured card"] },
  { day: "พฤหัสบดี", name: "Playful learning", mode: "transparent_png", kind: "asset",
    buyer: "educational publishers and family activity designers needing original standalone illustrations",
    seeds: ["seed germination cutaway", "rainwater collection miniature", "balanced pebble bridge", "compost ecosystem vignette", "pollinator hotel miniature", "moon crater tactile model", "interlocking recycled paper gears", "mushroom mycelium cross section", "river erosion miniature", "wind powered toy mechanism"] },
  { day: "ศุกร์", name: "Local hospitality", mode: "regular_scene", kind: "advertising",
    buyer: "independent hotels and responsible tourism agencies needing regionally grounded campaign imagery",
    seeds: ["northern Thai woven bamboo guestroom detail", "rainy season earthen courtyard", "local ceramic water station", "shaded village bicycle resting place", "coastal reed screen morning light", "handwoven indigo guest amenity wrap", "tropical rain garden footpath", "unbranded market basket arrival scene", "vernacular timber window ventilation", "community pottery workshop tools"] },
  { day: "เสาร์", name: "Climate adaptation", mode: "transparent_png", kind: "asset",
    buyer: "water, building and sustainability communications teams needing specific explanatory assets",
    seeds: ["rain barrel diverter assembly", "permeable pavement layer sample", "modular flood barrier segment", "drip irrigation emitter assembly", "external solar shading louver", "bioswale soil layer model", "greywater filter cartridge", "green roof drainage module", "reflective cool roof material sample", "reusable water sampling kit"] },
  { day: "อาทิตย์", name: "Accessible living", mode: "regular_scene", kind: "advertising",
    buyer: "inclusive housing, hospitality and community service publishers needing practical everyday environments",
    seeds: ["step free threshold at a garden door", "easy grip kitchen utensil arrangement", "contrasting stair nosing detail", "adjustable kitchen work surface", "tactile paving at a sheltered crossing", "lever handle on a wide doorway", "seated gardening raised bed", "shower bench with clear floor space", "quiet sensory reading alcove", "accessible community picnic table"] },
] as const;

export function getBangkokDate(date: Date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid production date");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function getDailyCategory(date: Date = new Date()) {
  const day = new Date(`${getBangkokDate(date)}T00:00:00Z`).getUTCDay();
  return WEEKLY_CATEGORIES[(day + 6) % 7];
}

export function getDailyScheduledMode(date: Date = new Date()): GenerationMode {
  return getDailyCategory(date).mode;
}
