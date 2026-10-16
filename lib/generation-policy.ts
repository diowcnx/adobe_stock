import type { StockImageItem } from "./types";

export const GENERATION_BRIEF_VERSION = "literal-jpeg-v1";

/** Check before any paid call, including requests from an old browser tab. */
export function getGenerationBlockReason(item: StockImageItem): string | undefined {
  if (item.generationMode === "transparent_png" || item.isTransparent || item.filename?.toLowerCase().endsWith(".png")) {
    return "PNG generation is disabled. Prepare a new JPEG batch.";
  }
  if (item.conceptMode === "structured_concept" || item.conceptStructure ||
      item.generationBriefVersion !== GENERATION_BRIEF_VERSION) {
    return "This is a retired generation brief. Refresh the page and prepare a new JPEG batch.";
  }
  return undefined;
}
