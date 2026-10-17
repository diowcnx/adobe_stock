import type { ConceptPlanSummary, MarketTrend, StockImageItem } from "./types";
import { BATCH_SIZE, getBangkokDate, type GenerationMode } from "./production-plan";
import { summarizeConceptPlan } from "./structured-concepts";
import { buildFoodFusionBatch } from "./food-fusion";
import { buildExhibitionBoothBatch } from "./exhibition-booth";
import { buildResortMasterplanBatch } from "./resort-masterplan";
import { buildMaterialArtBatch } from "./material-art";
import { buildDualMaterialBatch } from "./dual-material";
import { buildBeverageCampaignBatch } from "./beverage-campaign";
import { buildCulinaryEditorialBatch } from "./culinary-editorial";
import { buildAerialLandscapeBatch } from "./aerial-landscape";
import { buildEditorialPenSketchBatch } from "./editorial-pen-sketch";
import { randomInt } from "node:crypto";
import { generateUniqueStockFilename, normalizeStockKeywords } from "./csv";

export { getDailyScheduledMode } from "./production-plan";

/** The legacy automatic metaphor planner stays disabled; explicit structures have separate builders. */
export function isStructuredConceptsEnabled(_value?: string): boolean {
  void _value;
  return false;
}

/**
 * Give every active structure one daily slot before distributing any remainder.
 * Therefore ten active structures in a ten-image batch always receive one image each.
 */
export function allocateDailyStructureCounts(
  structureCount: number,
  batchSize = BATCH_SIZE,
  choose: (maxExclusive: number) => number = randomInt,
): number[] {
  if (!Number.isInteger(structureCount) || structureCount < 1) throw new Error("Structure count must be a positive integer");
  if (!Number.isInteger(batchSize) || batchSize < structureCount) throw new Error("Batch size must cover every active structure");

  const counts = Array<number>(structureCount).fill(1);
  let extraSlotPool = counts.map((_, index) => index);
  for (let slot = structureCount; slot < batchSize; slot++) {
    if (extraSlotPool.length === 0) extraSlotPool = counts.map((_, index) => index);
    const poolIndex = choose(extraSlotPool.length);
    if (!Number.isInteger(poolIndex) || poolIndex < 0 || poolIndex >= extraSlotPool.length) throw new Error("Invalid structure selection");
    counts[extraSlotPool.splice(poolIndex, 1)[0]]++;
  }
  return counts;
}

export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString(),
  forcedMode?: GenerationMode,
): Promise<{ trend: MarketTrend; items: StockImageItem[]; mode: GenerationMode; conceptPlan: ConceptPlanSummary }> {
  if (forcedMode === "transparent_png") throw new Error("PNG generation has been disabled. Prepare a new JPEG batch.");
  const date = new Date(currentDate);
  const productionDate = getBangkokDate(date);
  // Reserve one slot for every structure, then randomly assign the remaining slot.
  // Once a tenth structure is added, every structure receives exactly one image.
  const counts = allocateDailyStructureCounts(9);
  const items = [
    ...buildFoodFusionBatch(date, counts[0]),
    ...buildExhibitionBoothBatch(date, counts[1]),
    ...buildResortMasterplanBatch(date, counts[2]),
    ...buildMaterialArtBatch(date, counts[3]),
    ...buildDualMaterialBatch(date, counts[4]),
    ...buildBeverageCampaignBatch(date, counts[5]),
    ...buildCulinaryEditorialBatch(date, counts[6]),
    ...buildAerialLandscapeBatch(date, counts[7]),
    ...buildEditorialPenSketchBatch(date, counts[8]),
  ];
  for (let index = items.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [items[index], items[other]] = [items[other], items[index]];
  }
  items.forEach((item, index) => {
    item.id = index + 1;
    item.keywords = normalizeStockKeywords(item.keywords);
    item.filename = generateUniqueStockFilename(item.seoTitle, item.id, date, "regular_scene");
  });
  const mode = "regular_scene" as const;
  return {
    mode, items, conceptPlan: summarizeConceptPlan(items, mode),
    trend: {
      theme: "Food Fusion + Booths + Masterplans + Still Life + Dual Material + Beverage + Culinary Editorial + Aerial Landscape + Editorial Pen Sketch — randomized JPEG concepts",
      targetMarket: "food and beverage, beauty and craft advertisers, exhibition designers, architectural presentation teams, travel publishers, environmental campaigns and editorial art buyers",
      commercialReasoning: counts[0] + " food fusion, " + counts[1] + " booth, " + counts[2] + " masterplan, " + counts[3] + " editorial still-life, " + counts[4] + " dual-material, " + counts[5] + " beverage-campaign, " + counts[6] + " culinary-editorial, " + counts[7] + " aerial-landscape and " + counts[8] + " editorial-pen-sketch briefs, selected without duplicate concepts within each structure and shuffled together. Every structure appears daily; while nine structures are active, one randomly selected structure receives a second image. At ten structures, every structure receives exactly one image. Each has its own USER_INPUT, buyer use and quality rules. No verified sales claims or paid planning calls.",
      seasonalRelevance: "Bangkok production date " + productionDate + ". Thai ingredients where relevant; minimalist studio background.",
      buyerDemandRating: "Research Candidate",
    },
  };
}
