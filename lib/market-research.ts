import type { ConceptPlanSummary, MarketTrend, StockImageItem } from "./types";
import { BATCH_SIZE, getBangkokDate, type GenerationMode } from "./production-plan";
import { summarizeConceptPlan } from "./structured-concepts";
import { buildFoodFusionBatch, FUSION_RECIPES } from "./food-fusion";
import { BOOTH_RECIPES, buildExhibitionBoothBatch } from "./exhibition-booth";
import { buildResortMasterplanBatch, MASTERPLAN_RECIPES } from "./resort-masterplan";
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

function selectLeastUsedConcept(
  candidates: StockImageItem[],
  conceptUsage: Record<string, number>,
): StockImageItem {
  if (candidates.length === 0) throw new Error("Structure has no prompt candidates");
  const minimumUsage = Math.min(...candidates.map(item => conceptUsage[getPromptConceptKey(item)] ?? 0));
  const leastUsed = candidates.filter(item => (conceptUsage[getPromptConceptKey(item)] ?? 0) === minimumUsage);
  return leastUsed[randomInt(leastUsed.length)];
}

export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString(),
  forcedMode?: GenerationMode,
  planningState?: PromptPlanningState,
): Promise<{ trend: MarketTrend; items: StockImageItem[]; mode: GenerationMode; conceptPlan: ConceptPlanSummary }> {
  if (forcedMode === "transparent_png") throw new Error("PNG generation has been disabled. Prepare a new JPEG batch.");
  const date = new Date(currentDate);
  const productionDate = getBangkokDate(date);
  // Ten active structures fill the ten-image batch with exactly one image each.
  const counts = allocateDailyStructureCounts(10);
  const conceptUsage = planningState?.conceptUsage ?? {};
  const sequence = planningState?.sequence ?? getDateBasedCreativeSequence(date);
  const candidatePools = [
    buildFoodFusionBatch(date, FUSION_RECIPES.length),
    buildExhibitionBoothBatch(date, BOOTH_RECIPES.length),
    buildResortMasterplanBatch(date, MASTERPLAN_RECIPES.length),
    buildMaterialArtBatch(date, MATERIAL_ART_RECIPES.length),
    buildDualMaterialBatch(date, DUAL_MATERIAL_RECIPES.length),
    buildBeverageCampaignBatch(date, BEVERAGE_CAMPAIGN_RECIPES.length),
    buildCulinaryEditorialBatch(date, CULINARY_EDITORIAL_RECIPES.length),
    buildAerialLandscapeBatch(date, AERIAL_LANDSCAPE_RECIPES.length),
    buildEditorialPenSketchBatch(date, EDITORIAL_PEN_SKETCH_RECIPES.length),
    buildSymmetricalStorefrontBatch(date, SYMMETRICAL_STOREFRONT_RECIPES.length),
  ];
  const items = candidatePools.map(pool => applyCreativeEdition(selectLeastUsedConcept(pool, conceptUsage), sequence));
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
      theme: "Food Fusion + Booths + Masterplans + Still Life + Dual Material + Beverage + Culinary Editorial + Aerial Landscape + Editorial Pen Sketch + Symmetrical Storefront — randomized JPEG concepts",
      targetMarket: "food and beverage, beauty and craft advertisers, exhibition designers, architectural presentation teams, travel publishers, environmental campaigns, editorial art buyers and independent retail brands",
      commercialReasoning: counts[0] + " food fusion, " + counts[1] + " booth, " + counts[2] + " masterplan, " + counts[3] + " editorial still-life, " + counts[4] + " dual-material, " + counts[5] + " beverage-campaign, " + counts[6] + " culinary-editorial, " + counts[7] + " aerial-landscape, " + counts[8] + " editorial-pen-sketch and " + counts[9] + " symmetrical-storefront brief. The ten structures each receive exactly one daily image, with a unique recipe selected inside every structure before the ten results are shuffled. Each has its own USER_INPUT, buyer use and quality rules. No verified sales claims or paid planning calls.",
      seasonalRelevance: "Bangkok production date " + productionDate + ". Thai ingredients where relevant; minimalist studio background.",
      buyerDemandRating: "Research Candidate",
    },
  };
}
