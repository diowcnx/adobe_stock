import type { ConceptPlanSummary, MarketTrend, StockImageItem } from "./types";
import { BATCH_SIZE, getBangkokDate, type GenerationMode } from "./production-plan";
import { summarizeConceptPlan } from "./structured-concepts";
import { buildFoodFusionBatch, FUSION_RECIPES } from "./food-fusion";
import { BOOTH_RECIPES, buildExhibitionBoothBatch } from "./exhibition-booth";
import { buildMaterialArtBatch, MATERIAL_ART_RECIPES } from "./material-art";
import { buildDualMaterialBatch, DUAL_MATERIAL_RECIPES } from "./dual-material";
import { BEVERAGE_CAMPAIGN_RECIPES, buildBeverageCampaignBatch } from "./beverage-campaign";
import { buildCulinaryEditorialBatch, CULINARY_EDITORIAL_RECIPES } from "./culinary-editorial";
import { buildEditorialPenSketchBatch, EDITORIAL_PEN_SKETCH_RECIPES } from "./editorial-pen-sketch";
import { buildSymmetricalStorefrontBatch, SYMMETRICAL_STOREFRONT_RECIPES } from "./symmetrical-storefront";
import { buildThaiNaturePosterBatch, THAI_NATURE_POSTER_RECIPES } from "./thai-nature-poster";
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
 * The production planner may instead assign a deliberate extra slot to a named
 * structure when a structure is retired or buyer strategy changes.
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
  recentConceptKeys: readonly string[],
  count: number,
): StockImageItem[] {
  if (!Number.isInteger(count) || count < 1 || count > candidates.length) throw new Error("Invalid structure selection count");
  const recentIndex = new Map(recentConceptKeys.map((key, index) => [key, index]));
  const cooledCandidates = candidates.filter(item => !recentIndex.has(getPromptConceptKey(item)));
  const usingUnseenConcepts = cooledCandidates.length >= count;
  const shuffled = [...(cooledCandidates.length >= count ? cooledCandidates : candidates)];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled
    .sort((left, right) => {
      const leftKey = getPromptConceptKey(left);
      const rightKey = getPromptConceptKey(right);
      if (!usingUnseenConcepts) {
        const recencyDifference = (recentIndex.get(rightKey) ?? -1) - (recentIndex.get(leftKey) ?? -1);
        if (recencyDifference !== 0) return recencyDifference;
      }
      return (conceptUsage[leftKey] ?? 0) - (conceptUsage[rightKey] ?? 0);
    })
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
  // Nine active structures fill ten images. The retired generic aerial-landscape
  // slot is deliberately reassigned to a second, distinct food-hardware fusion.
  const counts = [2, 1, 1, 1, 1, 1, 1, 1, 1] as const;
  const conceptUsage = planningState?.conceptUsage ?? {};
  const recentConceptKeys = planningState?.recentConceptKeys ?? [];
  const sequence = planningState?.sequence ?? getDateBasedCreativeSequence(date);
  const candidatePools = [
    buildFoodFusionBatch(date, FUSION_RECIPES.length),
    buildExhibitionBoothBatch(date, BOOTH_RECIPES.length),
    buildMaterialArtBatch(date, MATERIAL_ART_RECIPES.length),
    buildDualMaterialBatch(date, DUAL_MATERIAL_RECIPES.length),
    buildBeverageCampaignBatch(date, BEVERAGE_CAMPAIGN_RECIPES.length),
    buildCulinaryEditorialBatch(date, CULINARY_EDITORIAL_RECIPES.length),
    buildEditorialPenSketchBatch(date, EDITORIAL_PEN_SKETCH_RECIPES.length),
    buildSymmetricalStorefrontBatch(date, SYMMETRICAL_STOREFRONT_RECIPES.length),
    buildThaiNaturePosterBatch(date, THAI_NATURE_POSTER_RECIPES.length),
  ];
  const items = candidatePools.flatMap((pool, index) =>
    selectLeastUsedConcepts(pool, conceptUsage, recentConceptKeys, counts[index])
      .map((item, itemIndex) => applyCreativeEdition(item, sequence + itemIndex))
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
      theme: "9-Structure Creative Trend Matrix — 10 distinct daily JPEG stories",
      targetMarket: "food and beverage, beauty and craft advertisers, exhibition designers, travel publishers, environmental campaigns, editorial art buyers and independent retail brands",
      commercialReasoning: counts[0] + " distinct food-hardware fusion, " + counts[1] + " booth, " + counts[2] + " editorial still-life, " + counts[3] + " dual-material, " + counts[4] + " flexible beverage-campaign, " + counts[5] + " culinary-editorial, " + counts[6] + " editorial-pen-sketch, " + counts[7] + " symmetrical-storefront and " + counts[8] + " Thai-nature-poster briefs. The generic painterly aerial-landscape structure is retired. Beverage campaigns rotate one, two or three drinks plus camera and staging instead of repeating a three-glass pyramid. Every structure receives its own rotating narrative hook, buyer layout and one of four Adobe 2026 trend lenses: All the Feels, Connectioneering, Surreal Silliness or Local Flavors. A clarity gate keeps the subject readable within two seconds and preserves all no-text, no-face, count and geometry rules. These are creative research directions, not verified sales claims, and planning makes no paid calls.",
      seasonalRelevance: "Bangkok production date " + productionDate + ". Thai ingredients and seasonally appropriate Thai flowers or landscapes are used only where relevant to each structure.",
      buyerDemandRating: "Research Candidate",
    },
  };
}
