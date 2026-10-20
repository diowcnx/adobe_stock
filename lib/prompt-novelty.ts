import { createHash } from "node:crypto";
import type { StockImageItem } from "./types";

export interface PromptPlanningState {
  sequence: number;
  conceptUsage: Record<string, number>;
  recentConceptKeys: string[];
}

const LIGHT_DIRECTIONS = [
  "clean high side light with a long soft-edged shadow",
  "broad frontal daylight with restrained shallow shadows",
  "cool window light balanced by a subtle warm bounce",
  "warm late-morning light with crisp but natural contact shadows",
  "large overhead diffusion with delicate edge highlights",
  "low raking light that reveals surface relief without becoming dramatic",
  "bright overcast illumination with quiet tonal separation",
  "directional studio daylight with one controlled reflected fill",
] as const;

const TEXTURE_DIRECTIONS = [
  "make fine tactile grain the leading secondary detail",
  "emphasize clean joins and material transitions",
  "show restrained handmade irregularity in otherwise precise surfaces",
  "prioritize convincing matte-versus-gloss contrast",
  "reveal small edge wear and authentic working texture",
  "use exceptionally clean surfaces with only natural microtexture",
  "emphasize layered depth through overlapping physical materials",
  "prioritize crisp silhouette edges and subtle surface variation",
] as const;

const SPACING_DIRECTIONS = [
  "use generous breathing room between the hero and every secondary element",
  "group secondary details into two quiet clusters while keeping the hero dominant",
  "create a compact central rhythm with an uncluttered outer field",
  "use measured repeating gaps to make the composition feel deliberately ordered",
  "keep the lower foreground sparse and the middle plane information-rich",
  "build depth with three clearly separated physical planes",
  "use one strong central mass and only restrained edge accents",
  "leave one uninterrupted natural background area while preserving the required balance",
] as const;

const DEPTH_DIRECTIONS = [
  "render the hero critically sharp with a gentle natural falloff behind it",
  "use deep editorial focus so construction and supporting details remain legible",
  "separate foreground and background with subtle atmospheric depth rather than blur effects",
  "keep the required viewpoint while giving near materials stronger dimensional presence",
  "use restrained lens compression for orderly spatial relationships",
  "preserve natural perspective with crisp detail from the hero through the middle plane",
  "give the background a softer tonal hierarchy while retaining real geometry",
  "use precise edge definition and moderate depth of field without miniature tilt-shift",
] as const;

const COLOR_DIRECTIONS = [
  "let the lightest named color occupy most of the background and reserve dark color for accents",
  "use the warm named colors on the hero and cooler colors only in supporting areas",
  "use the coolest named color as the quiet base with one concentrated warm focal accent",
  "keep saturation restrained except for the primary subject",
  "balance two main named colors evenly and use all others sparingly",
  "favor natural material color with pastel color appearing only in large simple fields",
  "use a high-key palette distribution with carefully protected midtone detail",
  "use a slightly deeper tonal base while keeping the hero luminous and color-accurate",
] as const;

const FINISH_DIRECTIONS = [
  "finish with calm premium editorial restraint and no decorative filler",
  "finish with precise contemporary commercial polish and believable imperfections",
  "finish with a tactile independent-brand character rather than luxury gloss",
  "finish with airy publication-ready clarity and simple visual hierarchy",
  "finish with grounded documentary credibility inside the art-directed composition",
  "finish with refined hospitality warmth and realistic physical staging",
  "finish with clean design-catalog clarity and no synthetic plastic sheen",
  "finish with understated craft character and highly legible practical purpose",
] as const;

const AXIS_SIZE = 8;
const CREATIVE_EDITION_CAPACITY = AXIS_SIZE ** 6;

function axisValue<T>(values: readonly T[], sequence: number, axis: number): T {
  const divisor = AXIS_SIZE ** axis;
  return values[Math.floor(sequence / divisor) % values.length];
}

export function getPromptConceptKey(item: StockImageItem): string {
  const structure = item.fusionStructure ? "fusion"
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
  return `${structure}:${item.seoTitle.trim().toLowerCase()}`;
}

export function getPromptFingerprint(prompt: string): string {
  return createHash("sha256").update(prompt.normalize("NFKC").trim()).digest("hex");
}

/**
 * Give a reused catalog concept a genuinely different art direction without
 * weakening its structure-specific geometry, count, no-face or no-text rules.
 * The six visual axes provide 262,144 distinct editions before repetition.
 */
export function applyCreativeEdition(item: StockImageItem, sequence: number): StockImageItem {
  if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence >= CREATIVE_EDITION_CAPACITY) {
    throw new Error("Creative edition history is exhausted or invalid");
  }
  const direction = [
    axisValue(LIGHT_DIRECTIONS, sequence, 0),
    axisValue(TEXTURE_DIRECTIONS, sequence, 1),
    axisValue(SPACING_DIRECTIONS, sequence, 2),
    axisValue(DEPTH_DIRECTIONS, sequence, 3),
    axisValue(COLOR_DIRECTIONS, sequence, 4),
    axisValue(FINISH_DIRECTIONS, sequence, 5),
  ].join("; ");
  return {
    ...item,
    prompt: `${item.prompt}\n[UNIQUE CREATIVE DIRECTION] This production must be visually distinct from every earlier batch while preserving every mandatory structure field: ${direction}. Never render this instruction or any identifier as text in the image.`,
  };
}

export function getDateBasedCreativeSequence(date: Date): number {
  if (Number.isNaN(date.getTime())) throw new Error("Invalid production date");
  return Math.floor(date.getTime() / 86_400_000) % CREATIVE_EDITION_CAPACITY;
}
