import type { ConceptPlanSummary, MarketTrend, StockImageItem } from "./types";
import { BATCH_SIZE, getBangkokDate, getDailyCategory, type GenerationMode } from "./production-plan";
import { generateUniqueStockFilename } from "./csv";
import { summarizeConceptPlan } from "./structured-concepts";
import { GENERATION_BRIEF_VERSION, NO_VISIBLE_FACE_RULE, THAI_CONTEXT_RULE } from "./generation-policy";

export { getDailyScheduledMode } from "./production-plan";

// Retained for compatibility only. Environment flags cannot restore the retired planner.
export function isStructuredConceptsEnabled(_value?: string): boolean {
  void _value;
  return false;
}

/**
 * Use the reviewed monthly shot list verbatim. No paid planning call, material
 * metaphor transformation, or unrelated fallback objects.
 */
export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString(),
  forcedMode?: GenerationMode,
): Promise<{ trend: MarketTrend; items: StockImageItem[]; mode: GenerationMode; conceptPlan: ConceptPlanSummary }> {
  if (forcedMode === "transparent_png") {
    throw new Error("PNG generation has been disabled. Prepare a new JPEG batch.");
  }
  const date = new Date(currentDate);
  const category = getDailyCategory(date);
  const productionDate = getBangkokDate(date);
  const mode = "regular_scene" as const;
  const items: StockImageItem[] = category.seeds.slice(0, BATCH_SIZE).map((subject, index) => {
    const title = subject.charAt(0).toUpperCase() + subject.slice(1) + " in Thailand";
    const keywords = [...new Set([
      subject,
      "Thailand", "Thai lifestyle", "Southeast Asia",
      ...subject.toLowerCase().split(/[^a-z]+/).filter(word => word.length > 3),
      category.name.toLowerCase(), "photography", "realistic", "everyday life",
      "natural light", "commercial photography", "authentic setting", "detail",
      "unbranded", "composition", "horizontal image", "visual communication",
      "natural colors", "real world", "clear subject", "advertising",
    ])].filter(keyword => keyword.length <= 100).slice(0, 25);
    return {
      id: index + 1,
      seoTitle: title,
      category: category.name,
      aspectRatio: index % 2 === 0 ? "3:2" : "16:9",
      composition: "advertising",
      prompt: [
        "Create one realistic full-bleed commercial photograph.",
        "Photograph this exact visible subject at normal real-world scale: " + subject + ".",
        THAI_CONTEXT_RULE,
        "Preserve the named objects, people, action and location. A stationary room, meal, animal or landscape can be the complete subject; do not invent an action.",
        "Use believable geometry, anatomy, materials and natural lighting. Show enough of the real setting to make the subject understandable at a glance.",
        "Do not reinterpret the subject as a miniature, sculpture, diorama, craft project, symbolic installation, abstract metaphor or collage.",
        "Use only props that naturally belong to the subject. Keep the main subject visually clear with useful natural space for a designer's crop.",
        NO_VISIBLE_FACE_RULE,
        "No rendered text, letters, logos, signatures, watermarks, frames, white borders, inset images or graphic panels.",
      ].join(" "),
      negativePrompt: "visible human face, facial features, side profile, partial face, reflected face, background faces, abstract metaphor, symbolic objects, miniature scene, diorama, surreal hybrid, object collage, artificial border, text, logo, watermark",
      keywords,
      modelUsed: "google/gemini-3.1-flash-lite-image",
      generationMode: mode,
      isTransparent: false,
      conceptMode: "existing",
      planningSource: "curated_fallback",
      generationBriefVersion: GENERATION_BRIEF_VERSION,
      filename: generateUniqueStockFilename(title, index + 1, date, mode),
      commercialIntent: {
        targetBuyer: category.buyer,
        intendedUse: "Thailand-focused website, article or advertisement for " + category.buyer + ".",
        purchaseReason: "The literal subject is visible without explanation and the full setting gives the buyer usable context and crop options. Sales are unverified.",
      },
    };
  });
  return {
    mode, items, conceptPlan: summarizeConceptPlan(items, mode),
    trend: {
      theme: "Day " + category.day + " · " + category.name + " — Thai-context JPEG photography",
      targetMarket: category.buyer,
      commercialReasoning: "Reviewed shot list informed by Adobe's evergreen-content guidance and curated collections. No live sales ranking, paid planning call or abstract concept conversion.",
      seasonalRelevance: "Bangkok production date " + productionDate + ". Review the actual image before submission.",
      buyerDemandRating: "Research Candidate",
    },
  };
}
