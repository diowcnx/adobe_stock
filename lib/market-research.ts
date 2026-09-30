import { callOpenRouterJSON } from "./openrouter";
import { isRecord } from "./errors";
import { MarketTrend, StockImageItem } from "./types";
import { generateUniqueStockFilename } from "./csv";
import { BATCH_SIZE, getBangkokDate, getDailyCategory, getDailyScheduledMode, GenerationMode } from "./production-plan";

export { getDailyScheduledMode } from "./production-plan";

interface Concept {
  title: string;
  subject: string;
  buyerUse: string;
  differentiation: string;
  keywords: string[];
}

function validateConcepts(value: unknown): Concept[] {
  if (!value || typeof value !== "object" || !("concepts" in value)) throw new Error("Missing concepts");
  const concepts = value.concepts;
  if (!Array.isArray(concepts) || concepts.length !== BATCH_SIZE) throw new Error("Expected ten concepts");
  const titles = new Set<string>();
  const subjects = new Set<string>();
  for (const candidate of concepts) {
    if (!isRecord(candidate)) throw new Error("Invalid concept");
    const concept = candidate;
    for (const key of ["title", "subject", "buyerUse", "differentiation"]) {
      if (typeof concept[key] !== "string" || concept[key].trim().length < 12 || concept[key].length > (key === "title" ? 150 : 1200)) {
        throw new Error(`Invalid ${key}`);
      }
    }
    if (!Array.isArray(concept.keywords) || concept.keywords.length < 10 || concept.keywords.length > 35 ||
      !concept.keywords.every((word: unknown) => typeof word === "string" && word.trim().length > 0 && word.length <= 80)) {
      throw new Error("Invalid keywords");
    }
    const title = String(concept.title).toLowerCase().replace(/[^a-z0-9]/g, "");
    const subject = String(concept.subject).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (titles.has(title) || subjects.has(subject)) throw new Error("Duplicate concept");
    if (/adobe\s*stock|watermarked|matcha|trending|best.?selling/i.test(`${concept.title} ${concept.subject}`)) throw new Error("Unsuitable concept");
    titles.add(title);
    subjects.add(subject);
  }
  return concepts as Concept[];
}

export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString(),
  forcedMode?: GenerationMode,
): Promise<{ trend: MarketTrend; items: StockImageItem[]; mode: GenerationMode }> {
  const date = new Date(currentDate);
  const category = getDailyCategory(date);
  const mode = forcedMode || getDailyScheduledMode(date);
  const isTransparent = mode === "transparent_png";
  const composition = isTransparent ? "asset" : category.kind === "artwork" ? "artwork" : "advertising";
  const productionDate = getBangkokDate(date);
  let fallback = false;
  let concepts: Concept[];
  try {
    concepts = validateConcepts(await callOpenRouterJSON<unknown>(
      `You are a commercial art director developing buyer-specific image briefs, NOT a live market research tool.
Return exactly ${BATCH_SIZE} genuinely different subjects, not crops, recolors or angles of one idea.
Each must solve a concrete buyer task and contain a distinctive subject + context + material combination.
Use the supplied research-inspired seeds as starting points, not mandatory copies. Invent new subjects within today's unique day-of-month theme.
Prefer specific buyer-intent niches over generic high-volume labels. Make each brief distinguishable from the first-page results through a concrete subject, setting, action, material, or composition—not merely a different color. Across the ten concepts, vary at least three of those dimensions and avoid near-duplicate variations.
Treat public result counts and first-page composition as a free, repeatable supply/positioning check only. A smaller result count is not evidence of buyer demand; never inflate a niche or claim a sales advantage from it. If a broad subject is crowded, find a truthful, useful sub-brief rather than adding generic filler.
When a seed names a cultural material or technique, use it only with its named source and do not blend distinct traditions into generic "African" motifs. For people-centered community briefs, make a staged commercial illustration, not a claim of a real documentary event; show adults at a distance or from behind, with no identifiable faces. For nursery interiors, show no child and keep the crib empty of loose bedding or toys.
Never invent sales figures, search volumes, customer validation or claims of low competition. No brands, artist imitation, protected characters, generic coffee/matcha, blank frames or generic laptop scenes.
No typography, signatures, logos, watermarks or marketplace names in image descriptions.
Avoid impossible hardware and unsupported medical, cultural or accessibility compliance claims. Prefer simple physically plausible scenes and accurate details.
Titles describe only visible content, not demand, render quality or buyers. Keywords must be relevant English search terms, ordered with the most specific ten first; no keyword stuffing.
Return JSON {"concepts":[{"title":"...","subject":"detailed visual description","buyerUse":"specific purchaser and intended use","differentiation":"specific visual distinction","keywords":["..."]}]}.
Provide 15-25 keywords per concept. Keep subject descriptions under 65 words.`,
      `Bangkok production date: ${productionDate}. Day-of-month theme ${category.day}/31: ${category.name}. Buyers: ${category.buyer}. Create a fresh, commercially usable interpretation unique to this date.
Portfolio review: 50 public Adobe Stock contributor portfolios have been reviewed: 26 with ranked-first-page observations and 24 supplemental profile/asset examples whose sort order could not be consistently verified. Patterns include clear copy space and room/product mockups; ingredient-led food still life; authentic preparation and serving actions; candid and emotionally specific lifestyle moments; precise botanical cutouts; destination-specific architecture and wildlife; regional craft and food processes; and practical finance, healthcare, civic, technology, editorial, and design-template buyer tasks. Treat these only as visual/use-case signals. Do not imitate a named contributor, recreate an existing asset, or claim these profiles prove marketplace-wide demand.
Free Adobe Stock search-page scan (30 September 2026): generic wall-art results were heavily populated by frame/interior mockups, printable sets, and abstract backgrounds. Narrower phrases such as circus nursery decor, Afrobohemian home decor, accessible home design, climate adaptation agriculture, and regional cuisine returned smaller query-specific catalogs. This is only a snapshot of catalog supply for those exact phrases, not search demand, sales, or a comparable measure of competition. Use it to prompt a manual first-page differentiation check, not to tell the model what will sell.
Other directional signals: Pinterest Predicts 2026 reports searches for "circus interior" +130%, "circus nursery" +50%, "afrobohemian home decor" +220% and "adire fabric" +130%. Adobe Creative Trends 2026 highlights playful imagery, authentic connection and local culture; Etsy Spring/Summer 2026 reports rising wall art and botanical wedding searches. These are cross-platform search/creative signals, NOT proof of Adobe Stock sales; community art, climate and accessibility remain buyer-use hypotheses.
Starting points: ${category.seeds.join("; ")}.
Mode: ${mode}. ${isTransparent
        ? "Create single isolated design elements on pure white for later background removal, saturated midtone subjects, crisp closed silhouettes, no white/translucent fine detail, no shadows. Do not request checkerboards or simulated transparency."
        : composition === "artwork"
          ? "Create the actual full-bleed unframed artwork, NOT a room, frame, poster mockup or photo of artwork. No advertising copy-space requirement. Cohesive palette and print-friendly detail."
          : "Create usable commercial scenes with natural material detail and intentional space for a designer's later text, without making every scene the same empty tabletop."}
Use the season 60-90 days after this date where relevant, otherwise evergreen. Do not repeat another date's subject with only a different palette.`,
      "google/gemini-3.1-flash-lite",
    ));
  } catch (error) {
    console.warn("Concept planning unavailable; using unvalidated curated briefs:", error instanceof Error ? error.message : "Invalid response");
    fallback = true;
    concepts = category.seeds.map((seed) => ({
      title: seed.charAt(0).toUpperCase() + seed.slice(1),
      subject: seed,
      buyerUse: category.buyer,
      differentiation: `Focus on the specific material and function of ${seed}; avoid generic category symbols.`,
      keywords: [...new Set([...seed.split(" "), ...category.name.toLowerCase().split(" "), "design", "texture", "detail", "composition"])],
    }));
  }

  const items: StockImageItem[] = concepts.map((concept, index) => {
    const title = `${concept.title}${isTransparent ? " Isolated Design Element" : ""}`;
    const layout = isTransparent
      ? "Single centered isolated element, pure white background, crisp silhouette, no cast or contact shadows, no translucent or white subject details."
      : composition === "artwork"
        ? "Full-bleed original artwork, balanced print composition, no frame, no room, no mockup, no reserved advertising area."
        : category.name.includes("Community art")
          ? "Wide staged commercial illustration of adult community members collaborating, viewed from behind or at a distance, no identifiable faces, no readable signs, no logos, and no implication that this depicts a real named event."
          : category.name.includes("circus")
            ? "Livable, uncluttered children's interior with no child present; keep the crib entirely empty of bedding, pillows and toys. Use original circus-inspired decor without known characters or trademarks."
            : "Art-directed scene with credible materials, restrained natural lighting and uncluttered copy space appropriate to its buyer use.";
    return {
      id: index + 1, seoTitle: title, category: category.name,
      aspectRatio: composition === "artwork" ? "4:5" : isTransparent ? "1:1" : index % 2 === 0 ? "16:9" : "3:2",
      composition,
      prompt: `${concept.subject}. ${layout} Distinctive visual direction: ${concept.differentiation}. Intended application (do not render text): ${concept.buyerUse}.`,
      negativePrompt: "text, lettering, logos, signatures, watermarks, preview overlays, branded objects, distorted anatomy, duplicated objects, checkerboard backgrounds, identifiable faces",
      keywords: [...new Set([...concept.keywords.map((word) => word.trim().toLowerCase()), ...(isTransparent ? ["isolated", "cutout", "transparent"] : [])])],
      modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(title, index + 1, date, mode),
      generationMode: mode, isTransparent,
    };
  });
  return {
    mode, items,
    trend: {
      theme: `Day ${category.day} · ${category.name} — ${BATCH_SIZE} buyer-focused concepts`,
      targetMarket: category.buyer,
      commercialReasoning: `${fallback ? "Curated fallback briefs; AI planning unavailable." : "AI-developed briefs based on curated research signals."} Each concept targets a distinct buyer use. No live sales, competition or keyword-volume validation; review before submission.`,
      seasonalRelevance: `Bangkok ${productionDate}; monthly plan day ${category.day}/31. Validate season and cultural details manually.`,
      buyerDemandRating: "Research Candidate",
    },
  };
}
