import type { ConceptPlanSummary, MarketTrend, StockImageItem } from "./types";
import { BATCH_SIZE, getBangkokDate, type GenerationMode } from "./production-plan";
import { summarizeConceptPlan } from "./structured-concepts";
import { buildFoodFusionBatch, FUSION_RECIPES } from "./food-fusion";
import { BOOTH_RECIPES, buildExhibitionBoothBatch } from "./exhibition-booth";
import { buildMaterialArtBatch, MATERIAL_ART_RECIPES } from "./material-art";
import { buildDualMaterialBatch, DUAL_MATERIAL_RECIPES } from "./dual-material";
import { BEVERAGE_CAMPAIGN_RECIPES, buildBeverageCampaignBatch } from "./beverage-campaign";
import { buildCulinaryEditorialBatch, CULINARY_EDITORIAL_RECIPES } from "./culinary-editorial";
import { AERIAL_LANDSCAPE_RECIPES, buildAerialLandscapeBatch } from "./aerial-landscape";
import { buildEditorialPenSketchBatch, EDITORIAL_PEN_SKETCH_RECIPES } from "./editorial-pen-sketch";
import { buildSymmetricalStorefrontBatch, SYMMETRICAL_STOREFRONT_RECIPES } from "./symmetrical-storefront";
import { applyCreativeEdition, getDateBasedCreativeSequence, getPromptConceptKey, type PromptPlanningState } from "./prompt-novelty";
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

function selectLeastUsedConcepts(
  candidates: StockImageItem[],
  conceptUsage: Record<string, number>,
  count: number,
): StockImageItem[] {
  if (!Number.isInteger(count) || count < 1 || count > candidates.length) throw new Error("Invalid structure selection count");
  const shuffled = [...candidates];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled
    .sort((left, right) => (conceptUsage[getPromptConceptKey(left)] ?? 0) - (conceptUsage[getPromptConceptKey(right)] ?? 0))
    .slice(0, count);
}

export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString(),
  forcedMode?: GenerationMode,
  planningState?: PromptPlanningState,
): Promise<{ trend: MarketTrend; items: StockImageItem[]; mode: GenerationMode; conceptPlan: ConceptPlanSummary }> {
  if (forcedMode === "transparent_png") throw new Error("PNG generation has been disabled. Prepare a new JPEG batch.");
  const date = new Date(currentDate);
  const productionDate = getBangkokDate(date);
  // Nine active structures receive one slot each; one randomly selected
  // structure receives the tenth slot without repeating a concept in the batch.
  const counts = allocateDailyStructureCounts(9);
  const conceptUsage = planningState?.conceptUsage ?? {};
  const sequence = planningState?.sequence ?? getDateBasedCreativeSequence(date);
  const candidatePools = [
    buildFoodFusionBatch(date, FUSION_RECIPES.length),
    buildExhibitionBoothBatch(date, BOOTH_RECIPES.length),
    buildMaterialArtBatch(date, MATERIAL_ART_RECIPES.length),
    buildDualMaterialBatch(date, DUAL_MATERIAL_RECIPES.length),
    buildBeverageCampaignBatch(date, BEVERAGE_CAMPAIGN_RECIPES.length),
    buildCulinaryEditorialBatch(date, CULINARY_EDITORIAL_RECIPES.length),
    buildAerialLandscapeBatch(date, AERIAL_LANDSCAPE_RECIPES.length),
    buildEditorialPenSketchBatch(date, EDITORIAL_PEN_SKETCH_RECIPES.length),
    buildSymmetricalStorefrontBatch(date, SYMMETRICAL_STOREFRONT_RECIPES.length),
  ];
  const items = candidatePools.flatMap((pool, index) =>
    selectLeastUsedConcepts(pool, conceptUsage, counts[index]).map(item => applyCreativeEdition(item, sequence))
  );
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
      theme: "Food Fusion + Booths + Still Life + Dual Material + Beverage + Culinary Editorial + Aerial Landscape + Editorial Pen Sketch + Symmetrical Storefront — randomized JPEG concepts",
      targetMarket: "food and beverage, beauty and craft advertisers, exhibition designers, travel publishers, environmental campaigns, editorial art buyers and independent retail brands",
      commercialReasoning: counts[0] + " food fusion, " + counts[1] + " booth, " + counts[2] + " editorial still-life, " + counts[3] + " dual-material, " + counts[4] + " beverage-campaign, " + counts[5] + " culinary-editorial, " + counts[6] + " aerial-landscape, " + counts[7] + " editorial-pen-sketch and " + counts[8] + " symmetrical-storefront briefs. All nine active structures appear in every ten-image batch; one structure receives a second least-used concept. Architectural masterplans are retired. Each has its own USER_INPUT, buyer use and quality rules. No verified sales claims or paid planning calls.",
      seasonalRelevance: "Bangkok production date " + productionDate + ". Thai ingredients where relevant; minimalist studio background.",
      buyerDemandRating: "Research Candidate",
    },
  };
}
