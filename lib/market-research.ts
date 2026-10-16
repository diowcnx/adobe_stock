import type { ConceptPlanSummary, MarketTrend, StockImageItem } from "./types";
import { BATCH_SIZE, getBangkokDate, type GenerationMode } from "./production-plan";
import { summarizeConceptPlan } from "./structured-concepts";
import { buildFoodFusionBatch } from "./food-fusion";
import { buildExhibitionBoothBatch } from "./exhibition-booth";
import { buildResortMasterplanBatch } from "./resort-masterplan";
import { randomInt } from "node:crypto";
import { generateUniqueStockFilename } from "./csv";

export { getDailyScheduledMode } from "./production-plan";

/** The retired 18-field planner remains disabled. The new fusion schema has seven fields. */
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
  // Spread the extra slot across structures on successive Bangkok dates.
  const counts = [0, 0, 0];
  for (let index = 0; index < BATCH_SIZE; index++) {
    counts[(index + Number(productionDate.slice(-2)) % 3) % 3]++;
  }
  const items = [
    ...buildFoodFusionBatch(date, counts[0]),
    ...buildExhibitionBoothBatch(date, counts[1]),
    ...buildResortMasterplanBatch(date, counts[2]),
  ];
  for (let index = items.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [items[index], items[other]] = [items[other], items[index]];
  }
  items.forEach((item, index) => {
    item.id = index + 1;
    item.filename = generateUniqueStockFilename(item.seoTitle, item.id, date, "regular_scene");
  });
  const mode = "regular_scene" as const;
  return {
    mode, items, conceptPlan: summarizeConceptPlan(items, mode),
    trend: {
      theme: "Food Fusion + Thai Craft Booths + Resort Masterplan Sketches — randomized JPEG concepts",
      targetMarket: "food advertising buyers, exhibition designers and hospitality/landscape design teams",
      commercialReasoning: counts[0] + " food fusion, " + counts[1] + " booth and " + counts[2] + " masterplan briefs, selected without duplicate concepts within each structure and shuffled together. The extra slot rotates daily. Each has its own USER_INPUT, buyer use and quality rules. No verified sales claims or paid planning calls.",
      seasonalRelevance: "Bangkok production date " + productionDate + ". Thai ingredients where relevant; minimalist studio background.",
      buyerDemandRating: "Research Candidate",
    },
  };
}
