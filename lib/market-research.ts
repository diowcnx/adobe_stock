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
import { randomInt } from "node:crypto";
import { generateUniqueStockFilename, normalizeStockKeywords } from "./csv";

export { getDailyScheduledMode } from "./production-plan";

/** The legacy automatic metaphor planner stays disabled; explicit structures have separate builders. */
export function isStructuredConceptsEnabled(_value?: string): boolean {
  void _value;
  return false;
}

export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString(),
  forcedMode?: GenerationMode,
): Promise<{ trend: MarketTrend; items: StockImageItem[]; mode: GenerationMode; conceptPlan: ConceptPlanSummary }> {
  if (forcedMode === "transparent_png") throw new Error("PNG generation has been disabled. Prepare a new JPEG batch.");
  const date = new Date(currentDate);
  const productionDate = getBangkokDate(date);
  // Reserve one slot for every structure, then assign the two remaining slots
  // to two distinct structures selected with system randomness for this batch.
  const counts = [1, 1, 1, 1, 1, 1, 1, 1];
  const extraSlotPool = counts.map((_, index) => index);
  for (let slot = counts.length; slot < BATCH_SIZE; slot++) {
    const poolIndex = randomInt(extraSlotPool.length);
    counts[extraSlotPool.splice(poolIndex, 1)[0]]++;
  }
  const items = [
    ...buildFoodFusionBatch(date, counts[0]),
    ...buildExhibitionBoothBatch(date, counts[1]),
    ...buildResortMasterplanBatch(date, counts[2]),
    ...buildMaterialArtBatch(date, counts[3]),
    ...buildDualMaterialBatch(date, counts[4]),
    ...buildBeverageCampaignBatch(date, counts[5]),
    ...buildCulinaryEditorialBatch(date, counts[6]),
    ...buildAerialLandscapeBatch(date, counts[7]),
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
      theme: "Food Fusion + Booths + Masterplans + Still Life + Dual Material + Beverage + Culinary Editorial + Aerial Landscape — randomized JPEG concepts",
      targetMarket: "food and beverage, beauty and craft advertisers, exhibition designers, architectural presentation teams, travel publishers and environmental campaigns",
      commercialReasoning: counts[0] + " food fusion, " + counts[1] + " booth, " + counts[2] + " masterplan, " + counts[3] + " editorial still-life, " + counts[4] + " dual-material, " + counts[5] + " beverage-campaign, " + counts[6] + " culinary-editorial and " + counts[7] + " aerial-landscape briefs, selected without duplicate concepts within each structure and shuffled together. Every structure appears daily; two distinct structures are randomly selected for a second image in each batch. Each has its own USER_INPUT, buyer use and quality rules. No verified sales claims or paid planning calls.",
      seasonalRelevance: "Bangkok production date " + productionDate + ". Thai ingredients where relevant; minimalist studio background.",
      buyerDemandRating: "Research Candidate",
    },
  };
}
