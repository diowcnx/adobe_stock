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
  { day: "พุธ", name: "Afro-bohemian interiors", mode: "regular_scene", kind: "advertising",
    buyer: "interior editors and home decor publishers seeking richly layered rooms with accurately described craft and materials",
    seeds: ["Nigerian adire indigo textile cushions in sunlit living room", "Ethiopian woven basket wall beside natural fiber rug", "rattan accent chair with neutral handcrafted textile", "bamboo beaded curtain filtering afternoon light", "West African textile and carved wood collected interior", "handwoven basket display in warm bohemian reading nook", "indigo resist-dyed cloth draped over terracotta bench", "layered natural fiber rug and low timber table", "craft-led bedroom with woven headboard and soft linen", "textile-focused living room in warm earth colors"] },
  { day: "พฤหัสบดี", name: "Circus nursery interiors", mode: "regular_scene", kind: "advertising",
    buyer: "nursery decor publishers, family brands, and interior designers looking for playful but livable children's rooms",
    seeds: ["muted red and cream striped circus nursery with empty safe crib", "vintage carousel animal art print above low toy shelf", "circus tent canopy motif in small child's reading nook", "playroom with sculptural striped ceiling and soft neutral walls", "storybook big-top nursery wallpaper with original geometric motifs", "retro carousel inspired nursery with wooden toys", "circus playroom with arched alcove and restrained primary colors", "whimsical nursery with scalloped valance and tent stripes", "vintage fairground color palette in compact child's bedroom", "circus-inspired nursery details in natural wood and linen"] },
  { day: "ศุกร์", name: "Community art events", mode: "regular_scene", kind: "advertising",
    buyer: "local arts organizations, municipalities, and community publishers seeking authentic participatory event imagery",
    seeds: ["neighbors collaborating at a community printmaking workshop", "candid neighborhood art walk with visitors seen from behind", "local artist market shoppers browsing handmade prints", "multigenerational volunteers painting an original abstract public mural", "community pottery class sharing a worktable", "local open studio event with artists demonstrating printmaking", "neighbors arranging art for a small community gallery opening", "public library hosting a collaborative collage workshop", "local artists setting up an outdoor print fair", "community mural painting seen wide with no identifiable faces"] },
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
