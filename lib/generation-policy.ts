import type { StockImageItem } from "./types";

export const GENERATION_BRIEF_VERSION = "food-hardware-fusion-v1";
export const THAI_CONTEXT_RULE = "Set this photograph in contemporary Thailand. Make the Thai context visible through appropriate everyday surroundings, architecture, local materials, household objects, food preparation or working life that naturally belong to the named activity. Use ordinary contemporary clothing and plausible Thai homes, shops, clinics, transit or community spaces. Match climate, vegetation and practical details to the Thai location. Preserve the literal subject and buyer use; add only a few relevant local details. Do not add decorative flags, ceremonial costumes, temples or cultural symbols unless explicitly required by the subject. No invented landmarks or claims of a specific real venue.";
export const NO_VISIBLE_FACE_RULE = "No visible human faces anywhere in the image, including background people, side profiles, partial faces, reflections, photographs, posters and screens. Show people strictly from behind with the face fully turned away, or crop below the neck and show only hands or the body. Blurring, masks, sunglasses and distant faces do not satisfy this rule. Preserve the practical action using hands, tools and body posture.";

/** Check before any paid call, including requests from an old browser tab. */
export function getGenerationBlockReason(item: StockImageItem): string | undefined {
  if (item.generationMode === "transparent_png" || item.isTransparent || item.filename?.toLowerCase().endsWith(".png")) {
    return "PNG generation is disabled. Prepare a new JPEG batch.";
  }
  if (item.conceptMode === "structured_concept" || item.conceptStructure ||
      item.generationBriefVersion !== GENERATION_BRIEF_VERSION ||
      [item.fusionStructure, item.boothStructure, item.masterplanStructure].filter(Boolean).length !== 1) {
    return "This is a retired generation brief. Refresh the page and prepare a new JPEG batch.";
  }
  return undefined;
}
