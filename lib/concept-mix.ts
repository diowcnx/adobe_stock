import type { ConceptMixSummary, GenerationMode, StockImageItem } from "./types";

export const EXISTING_CONCEPT_COUNT = 5;
export const MATERIAL_CONCEPT_COUNT = 5;

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
  let state = hashSeed(`adobe-stock-material-mix:${productionDate}`);
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

export function summarizeConceptMix(
  items: readonly StockImageItem[],
  batchMode: GenerationMode = "regular_scene",
): ConceptMixSummary {
  const existingCount = items.filter((item) => item.conceptMode !== "material_concept").length;
  const materialConceptCount = items.length - existingCount;
  const transparentPngCount = items.filter(
    (item) => getItemGenerationMode(item, batchMode) === "transparent_png",
  ).length;

  return {
    enabled: materialConceptCount > 0,
    existingCount,
    materialConceptCount,
    transparentPngCount,
    regularSceneCount: items.length - transparentPngCount,
  };
}
