import type {
  ConceptPlanSummary,
  ConceptStructureType,
  GenerationMode,
  StockImageItem,
  ThaiEditorialStillLifeStructure,
} from "./types";

export const THAI_EDITORIAL_STILL_LIFE_TYPE: ConceptStructureType = "thai_editorial_still_life_v1";

export const THAI_EDITORIAL_STILL_LIFE_FIELDS: Array<keyof ThaiEditorialStillLifeStructure> = [
  "CAMPAIGN_THEME",
  "MAIN_CONCEPT",
  "CAMERA_ANGLE",
  "LENS_TYPE",
  "SHOT_TYPE",
  "LIGHTING",
  "BACKGROUND_BASE",
  "BACKGROUND_TEXTURE",
  "BACKGROUND_DETAILS",
  "CENTRAL_INSTALLATION",
  "PRIMARY_COMPONENTS",
  "SUPPORTING_ACCENT_1",
  "SUPPORTING_ACCENT_2",
  "MATERIAL_FOCUS",
  "COMPOSITION_LOGIC",
  "ATMOSPHERIC_STYLE",
  "COLOR_PALETTE",
  "TEXT_ELEMENTS",
];

/** Registry entry kept separate so future structures can be added without changing saved-item semantics. */
export const CONCEPT_STRUCTURE_REGISTRY = [{
  type: THAI_EDITORIAL_STILL_LIFE_TYPE,
  label: "Buyer-Context Editorial Still Life",
  version: 1,
  fields: THAI_EDITORIAL_STILL_LIFE_FIELDS,
}] as const;

export const STILL_LIFE_ASPECT_RATIOS: StockImageItem["aspectRatio"][] = [
  "4:5", "3:2", "1:1", "16:9", "4:5", "3:2", "1:1", "16:9", "4:5", "3:2",
];

export const STRUCTURED_TRANSPARENT_COUNT = 6;

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state: number): { state: number; value: number } {
  let nextState = state || 0x9e3779b9;
  nextState ^= nextState << 13;
  nextState ^= nextState >>> 17;
  nextState ^= nextState << 5;
  return { state: nextState >>> 0, value: (nextState >>> 0) / 0x1_0000_0000 };
}

/** Stable daily shuffle so retries on the same Bangkok date retain item order. */
export function shuffleForProductionDate<T>(items: readonly T[], productionDate: string): T[] {
  const shuffled = [...items];
  let state = hashSeed(`adobe-stock-structured-concepts:${productionDate}`);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const random = nextRandom(state);
    state = random.state;
    const swapIndex = Math.floor(random.value * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function getItemGenerationMode(
  item: StockImageItem,
  batchMode: GenerationMode = "regular_scene",
): GenerationMode {
  if (item.generationMode) return item.generationMode;
  return item.isTransparent ? "transparent_png" : batchMode;
}

export function summarizeConceptPlan(
  items: readonly StockImageItem[],
  batchMode: GenerationMode = "regular_scene",
): ConceptPlanSummary {
  const structuredItems = items.filter((item) => item.conceptMode === "structured_concept");
  const transparentPngCount = items.filter(
    (item) => getItemGenerationMode(item, batchMode) === "transparent_png",
  ).length;
  const structureTypes = new Set(structuredItems.map((item) => item.conceptStructure?.type).filter(Boolean));

  return {
    enabled: structuredItems.length > 0,
    structuredCount: structuredItems.length,
    legacyCount: items.length - structuredItems.length,
    transparentPngCount,
    regularSceneCount: items.length - transparentPngCount,
    structureType: structureTypes.size === 1
      ? (structuredItems[0]?.conceptStructure?.type ?? null)
      : null,
  };
}

export function formatBuyerContextEditorialStillLifePrompt(fields: ThaiEditorialStillLifeStructure): string {
  return [
    `Create an original buyer-context editorial still-life advertising photograph. Use this campaign idea only as invisible creative direction and never typeset or display it: ${fields.CAMPAIGN_THEME}.`,
    `Express this visual metaphor: ${fields.MAIN_CONCEPT}.`,
    `Camera and framing: ${fields.CAMERA_ANGLE}; ${fields.LENS_TYPE}; ${fields.SHOT_TYPE}.`,
    `Lighting: ${fields.LIGHTING}.`,
    `Build the set on ${fields.BACKGROUND_BASE}, with ${fields.BACKGROUND_TEXTURE} and these restrained background details: ${fields.BACKGROUND_DETAILS}.`,
    `Central installation: ${fields.CENTRAL_INSTALLATION}.`,
    `Primary components: ${fields.PRIMARY_COMPONENTS}.`,
    `Supporting accents: ${fields.SUPPORTING_ACCENT_1}; ${fields.SUPPORTING_ACCENT_2}.`,
    `Material realism: ${fields.MATERIAL_FOCUS}.`,
    `Composition: ${fields.COMPOSITION_LOGIC}.`,
    `Atmosphere: ${fields.ATMOSPHERIC_STYLE}. Color palette: ${fields.COLOR_PALETTE}.`,
    "Do not render any letters, words, numerals, captions, titles, logos or pseudo-text in the image. The TEXT_ELEMENTS field is metadata for a human designer and must not become visible image content. Leave any useful negative space only as a natural uncluttered area of the photographed physical background; never create a blank title panel, header, footer, card, border or graphic text box.",
    "Make one full-bleed photograph. The physical scene and its background must continue naturally to all four edges with no frame, mat, white margin, canvas border, inset image, poster layout or page mockup.",
    "Choose people-free objects, materials, architecture cues, seasonality and color language that suit the intended buyer and use. Do not default to Thailand or add cultural identity unless the brief genuinely calls for it. When a location is specified, use accurate contemporary everyday details rather than token costumes, flags, sacred objects, protected patterns, political symbols or tourist stereotypes.",
  ].join(" ");
}

/** Backward-compatible export for callers and saved schema names created before the buyer-context update. */
export const formatThaiEditorialStillLifePrompt = formatBuyerContextEditorialStillLifePrompt;

export function formatBuyerContextTransparentAssetPrompt(fields: ThaiEditorialStillLifeStructure): string {
  return [
    `Create one original reusable transparent-background commercial design asset for this invisible buyer direction: ${fields.CAMPAIGN_THEME}.`,
    `Use ${fields.CENTRAL_INSTALLATION} only as a subject source, then simplify it to exactly one familiar, concrete, immediately recognizable object. Do not visualize an abstract metaphor or combine several objects.`,
    `The subject must use one or at most two solid opaque materials with credible surface detail. Ignore all requested supporting accents, decorative components and background treatments. Do not use transparent, translucent, frosted, glass, liquid, smoke, mesh, lace, wispy fiber, loose thread, thin wire or perforated materials.`,
    `Use a straightforward product view derived from ${fields.CAMERA_ANGLE}, with neutral high-key lighting and a broad continuous silhouette. Keep detail readable at thumbnail size.`,
    `Use the palette only on the single object: ${fields.COLOR_PALETTE}.`,
    "Center the complete asset with generous safe padding so no part is cropped. No cluster, bundle, collage, assemblage, emblem, radial arrangement, extra prop, hand holding the object or detached part. No floor, wall, horizon, room, environmental scene, frame, border, mat, card, poster, mockup, cast shadow or contact shadow.",
    "Do not render letters, words, numerals, notation, logos, trademarks, signatures, watermarks or pseudo-text. Do not default to Thailand or add cultural identity unless the buyer brief genuinely requires it.",
  ].join(" ");
}
