import { createHash } from "node:crypto";
import type { StockImageItem } from "./types";

export interface PromptPlanningState {
  sequence: number;
  conceptUsage: Record<string, number>;
  recentConceptKeys: string[];
}

type StructureKind =
  | "fusion"
  | "booth"
  | "masterplan"
  | "material-art"
  | "dual-material"
  | "beverage"
  | "culinary"
  | "aerial"
  | "pen-sketch"
  | "storefront"
  | "thai-nature-poster"
  | "unknown";

type CreativeLens = { name: string; direction: string };

/*
 * These families adapt Adobe's 2026 Creative Trends into stock-safe visual
 * directions. Each trend has two treatments so a returning trend does not
 * make the picture feel like the previous execution.
 * https://business.adobe.com/resources/creative-trends-report.html
 */
const CREATIVE_LENSES: readonly CreativeLens[] = [
  { name: "All the Feels — tactile immersion", direction: "make touch, temperature, weight and fine surface detail almost physically perceptible through realistic material cues" },
  { name: "All the Feels — sensory anticipation", direction: "use one unmistakable sensory cue such as chill, warmth, crispness, softness, aroma or motion without adding decorative clutter" },
  { name: "Connectioneering — human trace", direction: "suggest a relatable ritual, care, repair, sharing or preparation through object placement only, with no person or visible face" },
  { name: "Connectioneering — emotional payoff", direction: "make the scene communicate one universal feeling such as welcome, relief, delight, belonging or renewal within two seconds" },
  { name: "Surreal Silliness — lucid surprise", direction: "introduce exactly one playful and impossible visual turn while keeping the named subject literal, instantly recognizable and commercially usable" },
  { name: "Surreal Silliness — scale or behavior twist", direction: "bend scale, gravity or expected object behavior once, never anatomy or legibility, so the visual joke is immediate rather than cryptic" },
  { name: "Local Flavors — material provenance", direction: "show credible region-specific material, ingredient, weather or craft evidence without costume, stereotype, generic exoticism or invented symbols" },
  { name: "Local Flavors — lived-in specificity", direction: "anchor the scene in one truthful local detail that belongs to the subject's real context while retaining broad international buyer usefulness" },
] as const;

const STORY_HOOKS: Readonly<Record<StructureKind, readonly string[]>> = {
  fusion: [
    "turn the fusion into a lucid cause-and-effect metaphor: the food visibly supplies the hardware's familiar function",
    "show one clean moment of transformation at the seamless joint, with the two materials retaining unmistakable identities",
    "express energy, freshness, heat, pressure, preservation or speed through one functional physical cue rather than extra props",
    "use a witty mismatch of softness and precision, but keep the hybrid plausible as a single manufactured object",
    "frame the hybrid as a future-food prototype whose purpose can be understood before reading its metadata",
    "translate a real culinary property into a mechanical behavior, using only the single connected hero object",
    "make the transition joint the narrative climax through texture and engineering logic, not decorative complexity",
    "present the hybrid as a campaign icon with one bold silhouette and one immediately legible visual punchline",
  ],
  booth: [
    "make the facade reveal a discovery journey from material origin to finished product through spatial sequencing alone",
    "express modular repairability with visibly reusable connections and an ordered display system",
    "turn authentic craft process into the visual rhythm of shelves, canopy and blank graphic surfaces",
    "build a quiet threshold moment that makes visitors imagine stepping from a trade hall into the brand's material world",
    "use one biophilic structural gesture derived from the displayed product rather than unrelated decoration",
    "make circular production legible through return, refill or reuse zones integrated into the architecture",
    "create a tactile material library effect while keeping the mandatory frontal elevation clear and uncluttered",
    "stage one product-demonstration focal zone without people, words, screens or fake interface graphics",
  ],
  "material-art": [
    "tell an origin-to-object story by arranging the named materials in a single readable progression around the hero",
    "capture the precise instant when ordinary material appears to become the central artwork, without magical debris",
    "use controlled repetition with one meaningful interruption to direct the viewer to the hero product or installation",
    "translate a familiar daily ritual into a clear material metaphor that an advertiser could caption later",
    "contrast handmade irregularity with one highly precise edge so craft and contemporary design coexist",
    "make season, scent or touch visible through real material evidence rather than abstract symbolism",
    "use one culturally accurate making detail as provenance, never as costume or decorative cliché",
    "stage the installation like a magazine opener with a single thesis, strong hierarchy and protected copy space",
  ],
  "dual-material": [
    "make the two materials explain protection versus vulnerability through the subject's familiar anatomy or function",
    "use weight versus lightness as the single visual tension while preserving the complete recognizable silhouette",
    "show repair and renewal through one clean connected seam between old-feeling and new-feeling material",
    "let organic irregularity meet engineered precision at one purposeful transition rather than scattered patches",
    "express softness inside strength, or strength inside softness, with one dominant material and one restrained accent",
    "make the subject feel like a collectible design object whose material contradiction is understood instantly",
    "use the secondary material only where it reinforces the subject's real movement, purpose or character",
    "turn a familiar silhouette into a sustainability story through believable recovered and durable materials",
  ],
  beverage: [
    "give the three drinks three distinct sensory roles within one occasion: opening refreshment, central hero and calm finish",
    "echo ingredient origin in the plinth materials and backdrop while keeping every garnish recipe-accurate",
    "use temperature contrast across the trio so chill, condensation, foam or warmth becomes the main sensory narrative",
    "stage a precise daypart ritual that a hospitality brand could use for brunch, afternoon pause or evening service",
    "show a zero-waste ingredient story through edible peels, herbs or by-products already valid for the recipes",
    "let one seasonal local ingredient unify the three beverages without making their colors or vessels repetitive",
    "build a progression from light to rich using liquid opacity, vessel weight and height rather than extra objects",
    "make the central drink the emotional payoff while the two supporting drinks create a clear before-and-after rhythm",
  ],
  culinary: [
    "tell an origin-to-plate story with only recipe-accurate raw accompaniments leading the eye toward the finished dish",
    "freeze the most appetizing instant of lift, stretch, drip or steam while keeping the utensil physically credible",
    "make heat and aroma perceptible through restrained real food cues, never artificial swirls or graphic effects",
    "stage a comforting everyday ritual whose emotional meaning is clear without people, packaging or words",
    "use one authentic regional preparation detail to distinguish the dish without turning the set into themed décor",
    "contrast crisp, tender, glossy and fresh textures so the recipe explains itself visually",
    "create a bold editorial color relationship between food and dimensional backdrop while preserving natural food color",
    "leave a purposeful buyer copy zone that balances the plated hero instead of looking like an empty mistake",
  ],
  aerial: [
    "make one ecological process—water flow, pollination, migration or regrowth—the readable path through the landscape",
    "show a seasonal transition moving across connected terrain bands rather than applying one uniform color treatment",
    "use the winding route to connect livelihood, habitat and landmark in one coherent visual story",
    "express climate adaptation through visible landform logic such as shade, drainage, wetlands or wind protection",
    "turn agricultural origin into an editorial journey from field pattern to one recognizable focal landmark",
    "create a quiet travel narrative through scale, route rhythm and changing terrain, with figures remaining faceless marks",
    "show habitat continuity through repeated native color and texture cues that visibly connect separated zones",
    "use one playful but geographically plausible terrain rhythm that feels illustrated, not mapped or diagrammed",
  ],
  "pen-sketch": [
    "make the illustration explain a useful real-world process through one coherent scene rather than separate diagram panels",
    "show traces of recent human activity through tools, arrangement and wear while depicting no person or face",
    "use a before-and-after tension within one continuous environment, separated by composition rather than labels",
    "focus on one authentic local craft, service or infrastructure detail that gives the subject editorial specificity",
    "turn material flow, repair or reuse into the eye path from foreground evidence to the complete main subject",
    "capture a decisive quiet moment just before or after action so the scene implies a story without characters",
    "use selective color as evidence—marking the one functional element a buyer needs the audience to notice",
    "make the paper, line pressure and hatching feel observational and authored while preserving immediate subject clarity",
  ],
  storefront: [
    "give the shop a truthful neighborhood identity through material, climate and merchandise rather than signage",
    "make adaptive reuse visible through one preserved architectural layer meeting one precise contemporary intervention",
    "turn the doorway threshold into the narrative focus, clearly connecting street atmosphere to interior purpose",
    "use seasonal merchandising as a restrained color rhythm while keeping the facade strictly symmetrical",
    "show the craft or service being offered through tools and finished goods visible inside, with no people or words",
    "integrate shade, ventilation or rain protection as a beautiful climate-responsive facade feature",
    "make repair, refill or local production part of the storefront architecture rather than an added symbol",
    "create a cinematic sense of welcome through light depth and paired props while preserving disciplined bilateral symmetry",
  ],
  "thai-nature-poster": [
    "show a specific Thai flowering season as a journey from foreground bloom to distant landscape landmark",
    "make monsoon air, dry-season haze or cool-morning mist tangible through layered poster-color handling",
    "tell a small conservation story through native habitat continuity, without diagrams, labels or slogans",
    "use the path to connect a recognizable local activity with the real ecology that supports it",
    "build color rhythm from botanically plausible flowers instead of generic rainbow fields",
    "translate one authentic regional terrain feature into a bold hand-painted composition without becoming a map",
    "create vintage travel-poster optimism through scale and light while leaving the artwork completely text-free",
    "show a quiet relationship between cultivation and wild habitat through one clear boundary transition",
  ],
  masterplan: ["retired structure; do not generate"],
  unknown: ["build one clear commercial story with a recognizable subject, purposeful context and restrained novelty"],
};

const LIGHT_DIRECTIONS = [
  "clean high side light with a long soft-edged shadow", "broad frontal daylight with restrained shallow shadows",
  "cool window light balanced by a subtle warm bounce", "warm late-morning light with crisp but natural contact shadows",
  "large overhead diffusion with delicate edge highlights", "low raking light that reveals surface relief without becoming dramatic",
  "bright overcast illumination with quiet tonal separation", "directional studio daylight with one controlled reflected fill",
] as const;
const TEXTURE_DIRECTIONS = [
  "make fine tactile grain the leading secondary detail", "emphasize clean joins and material transitions",
  "show restrained handmade irregularity in otherwise precise surfaces", "prioritize convincing matte-versus-gloss contrast",
  "reveal small edge wear and authentic working texture", "use exceptionally clean surfaces with only natural microtexture",
  "emphasize layered depth through overlapping physical materials", "prioritize crisp silhouette edges and subtle surface variation",
] as const;
const SPACING_DIRECTIONS = [
  "use generous breathing room between the hero and every secondary element", "group secondary details into two quiet clusters while keeping the hero dominant",
  "create a compact central rhythm with an uncluttered outer field", "use measured repeating gaps to make the composition feel deliberately ordered",
  "keep the lower foreground sparse and the middle plane information-rich", "build depth with three clearly separated physical planes",
  "use one strong central mass and only restrained edge accents", "leave one uninterrupted natural background area while preserving the required balance",
] as const;
const DEPTH_DIRECTIONS = [
  "render the hero critically sharp with a gentle natural falloff behind it", "use deep editorial focus so construction and supporting details remain legible",
  "separate foreground and background with subtle atmospheric depth rather than blur effects", "keep the required viewpoint while giving near materials stronger dimensional presence",
  "use restrained lens compression for orderly spatial relationships", "preserve natural perspective with crisp detail from the hero through the middle plane",
  "give the background a softer tonal hierarchy while retaining real geometry", "use precise edge definition and moderate depth of field without miniature tilt-shift",
] as const;
const COLOR_DIRECTIONS = [
  "let the lightest named color occupy most of the background and reserve dark color for accents", "use the warm named colors on the hero and cooler colors only in supporting areas",
  "use the coolest named color as the quiet base with one concentrated warm focal accent", "keep saturation restrained except for the primary subject",
  "balance two main named colors evenly and use all others sparingly", "favor natural material color with pastel color appearing only in large simple fields",
  "use a high-key palette distribution with carefully protected midtone detail", "use a slightly deeper tonal base while keeping the hero luminous and color-accurate",
] as const;
const FINISH_DIRECTIONS = [
  "finish with calm premium editorial restraint and no decorative filler", "finish with precise contemporary commercial polish and believable imperfections",
  "finish with a tactile independent-brand character rather than luxury gloss", "finish with airy publication-ready clarity and simple visual hierarchy",
  "finish with grounded documentary credibility inside the art-directed composition", "finish with refined hospitality warmth and realistic physical staging",
  "finish with clean design-catalog clarity and no synthetic plastic sheen", "finish with understated craft character and highly legible practical purpose",
] as const;
const BUYER_LAYOUT_DIRECTIONS = [
  "a campaign hero with one protected natural copy zone", "an editorial opener with a decisive focal point and calm outer field",
  "a hospitality or retail feature with inviting spatial depth", "a packaging-adjacent key visual with a simple crop-safe silhouette",
  "a sustainability story with visible practical evidence, not generic green symbolism", "a social campaign crop with a strong center and useful peripheral breathing room",
  "a publication feature whose subject and use are understood at thumbnail size", "a brand mood image with an unmistakable emotional takeaway and flexible copy space",
] as const;

const AXIS_SIZE = 8;
const AXIS_COUNT = 8;
const CREATIVE_EDITION_CAPACITY = AXIS_SIZE ** AXIS_COUNT;
const SEQUENCE_PERMUTATION_MULTIPLIER = 10_472_903;
const STRUCTURE_OFFSETS: Readonly<Record<StructureKind, number>> = {
  fusion: 0, booth: 1, "material-art": 2, "dual-material": 3, beverage: 4, culinary: 5,
  aerial: 6, "pen-sketch": 7, storefront: 8, "thai-nature-poster": 9, masterplan: 10, unknown: 11,
};

function getStructureKind(item: StockImageItem): StructureKind {
  return item.fusionStructure ? "fusion"
    : item.boothStructure ? "booth"
    : item.masterplanStructure ? "masterplan"
    : item.materialArtStructure ? "material-art"
    : item.dualMaterialStructure ? "dual-material"
    : item.beverageCampaignStructure ? "beverage"
    : item.culinaryEditorialStructure ? "culinary"
    : item.aerialLandscapeStructure ? "aerial"
    : item.editorialPenSketchStructure ? "pen-sketch"
    : item.symmetricalStorefrontStructure ? "storefront"
    : item.thaiNaturePosterStructure ? "thai-nature-poster"
    : "unknown";
}

function axisValue<T>(values: readonly T[], edition: number, axis: number): T {
  return values[Math.floor(edition / AXIS_SIZE ** axis) % values.length];
}

/** Multiplication by an odd integer permutes all editions modulo 8^8. */
function getDistributedEdition(sequence: number, structure: StructureKind): number {
  const structureSalt = STRUCTURE_OFFSETS[structure] * 1_048_583;
  return (sequence * SEQUENCE_PERMUTATION_MULTIPLIER + structureSalt) % CREATIVE_EDITION_CAPACITY;
}

export function getPromptConceptKey(item: StockImageItem): string {
  return `${getStructureKind(item)}:${item.seoTitle.trim().toLowerCase()}`;
}

export function getPromptFingerprint(prompt: string): string {
  return createHash("sha256").update(prompt.normalize("NFKC").trim()).digest("hex");
}

/**
 * Add a structure-specific story and an Adobe-trend-informed creative lens,
 * then vary production craft and buyer layout independently. Fixed structure
 * geometry, object counts, text bans and face bans always remain authoritative.
 */
export function applyCreativeEdition(item: StockImageItem, sequence: number): StockImageItem {
  if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence >= CREATIVE_EDITION_CAPACITY) {
    throw new Error("Creative edition history is exhausted or invalid");
  }
  const structure = getStructureKind(item);
  const edition = getDistributedEdition(sequence, structure);
  const lens = axisValue(CREATIVE_LENSES, edition, 1);
  const direction = [
    `Narrative hook: ${axisValue(STORY_HOOKS[structure], edition, 0)}`,
    `Creative lens: ${lens.name}; ${lens.direction}`,
    `Buyer-ready layout: ${axisValue(BUYER_LAYOUT_DIRECTIONS, edition, 2)}`,
    `Lighting: ${axisValue(LIGHT_DIRECTIONS, edition, 3)}`,
    `Material treatment: ${axisValue(TEXTURE_DIRECTIONS, edition, 4)}`,
    `Composition rhythm: ${axisValue(SPACING_DIRECTIONS, edition, 5)}`,
    `Depth: ${axisValue(DEPTH_DIRECTIONS, edition, 6)}`,
    `Color and finish: ${axisValue(COLOR_DIRECTIONS, edition, 7)}; ${axisValue(FINISH_DIRECTIONS, edition, 0)}`,
  ].join("\n- ");
  return {
    ...item,
    prompt: `${item.prompt}\n[DAILY CREATIVE DIRECTION — DO NOT RENDER AS TEXT]\n- ${direction}\n[CLARITY AND SAFETY GATE] Communicate one idea only. The named hero subject and intended buyer use must be understood within two seconds at thumbnail size. This creative direction may change story, sensory emphasis and visual tension, but it must never override mandatory structure geometry, camera, object-count or ingredient rules. Add no letters, words, numerals, pseudo-text, logos, labels, borders, frames, visible human faces, extra hero objects or cryptic abstract symbolism. If any creative instruction conflicts with the fixed structure, obey the fixed structure.`,
  };
}

export function getDateBasedCreativeSequence(date: Date): number {
  if (Number.isNaN(date.getTime())) throw new Error("Invalid production date");
  return Math.floor(date.getTime() / 86_400_000) % CREATIVE_EDITION_CAPACITY;
}
