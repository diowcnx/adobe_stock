import { callOpenRouterJSON } from "./openrouter";
import { isRecord } from "./errors";
import type { ConceptMixSummary, MarketTrend, MaterialStructure, PlanningSource, StockImageItem } from "./types";
import { generateUniqueStockFilename } from "./csv";
import { BATCH_SIZE, getBangkokDate, getDailyCategory, getDailyScheduledMode, type GenerationMode } from "./production-plan";
import {
  EXISTING_CONCEPT_COUNT,
  MATERIAL_CONCEPT_COUNT,
  shuffleForProductionDate,
  summarizeConceptMix,
} from "./concept-mix";

export { getDailyScheduledMode } from "./production-plan";

interface ExistingConcept {
  title: string;
  subject: string;
  buyerUse: string;
  differentiation: string;
  keywords: string[];
}

interface MaterialConcept {
  title: string;
  buyerUse: string;
  differentiation: string;
  materialStructure: MaterialStructure;
  keywords: string[];
}

type StockImageDraft = Omit<StockImageItem, "id" | "filename">;

const MATERIAL_FIELDS: Array<keyof MaterialStructure> = [
  "SUBJECT",
  "PRIMARY_MATERIAL",
  "SECONDARY_MATERIAL",
  "BACKGROUND",
  "SHADOW_STYLE",
  "VISUAL_STYLE",
  "COMMERCIAL_CONCEPT",
];

const MATERIAL_FALLBACKS: MaterialConcept[] = [
  {
    title: "Refillable Skincare Bottle on Cork and Limewash Display",
    buyerUse: "sustainable beauty campaign hero banner",
    differentiation: "A tactile refill story using physically compatible packaging materials and a quiet side-weighted composition.",
    materialStructure: {
      SUBJECT: "Unbranded refillable amber glass skincare bottle with a plain metal pump",
      PRIMARY_MATERIAL: "recycled amber glass",
      SECONDARY_MATERIAL: "natural cork",
      BACKGROUND: "matte warm limewash wall and matching pedestal",
      SHADOW_STYLE: "soft directional morning shadow falling away from the product",
      VISUAL_STYLE: "refined tactile product photography with natural imperfections",
      COMMERCIAL_CONCEPT: "refillable personal care packaging campaign",
    },
    keywords: ["refillable skincare bottle", "amber glass packaging", "sustainable beauty", "cork display", "limewash background", "eco packaging", "refill system", "natural cosmetics", "beauty campaign", "copy space", "product photography", "recycled glass", "unbranded bottle", "tactile materials", "responsible packaging", "minimal still life", "personal care"],
  },
  {
    title: "Wool Felt Acoustic Panel in Pale Oak Workspace",
    buyerUse: "workplace acoustics and interior materials advertisement",
    differentiation: "Shows a credible installed acoustic solution rather than a generic empty office or floating material sample.",
    materialStructure: {
      SUBJECT: "Sculpted wool felt acoustic wall panel installed beside a compact workbench",
      PRIMARY_MATERIAL: "pressed wool felt",
      SECONDARY_MATERIAL: "pale oak veneer",
      BACKGROUND: "subtle clay plaster workplace wall",
      SHADOW_STYLE: "shallow side light revealing the felt relief without harsh contrast",
      VISUAL_STYLE: "warm architectural editorial photography with precise material detail",
      COMMERCIAL_CONCEPT: "healthy acoustic workspace product campaign",
    },
    keywords: ["wool felt acoustic panel", "workspace acoustics", "pale oak interior", "sound absorbing wall", "office material design", "acoustic treatment", "clay plaster wall", "healthy workplace", "interior product", "copy space", "architectural detail", "felt texture", "quiet office", "sustainable interior", "commercial workspace", "material palette", "sound control"],
  },
  {
    title: "Molded Fiber Food Package with Beeswax Paper Wrap",
    buyerUse: "plastic-free food packaging launch visual",
    differentiation: "Pairs a functional molded-fiber container with a believable grease-resistant inner wrap and visible food-safe construction.",
    materialStructure: {
      SUBJECT: "Open unbranded molded-fiber takeaway box lined with folded beeswax-coated paper",
      PRIMARY_MATERIAL: "molded plant fiber",
      SECONDARY_MATERIAL: "beeswax-coated paper",
      BACKGROUND: "honest gray stone preparation surface",
      SHADOW_STYLE: "clean window-frame shadow kept behind the package",
      VISUAL_STYLE: "ingredient-adjacent editorial still life with crisp packaging detail",
      COMMERCIAL_CONCEPT: "plastic-free takeaway packaging campaign",
    },
    keywords: ["molded fiber food package", "plastic free takeaway", "beeswax paper wrap", "sustainable food packaging", "compostable container", "plant fiber box", "eco takeaway", "food service packaging", "packaging innovation", "copy space", "unbranded package", "stone background", "zero waste", "restaurant supply", "responsible materials", "editorial still life", "fiber texture"],
  },
  {
    title: "Recycled Aluminum Chair with Woven Outdoor Seat",
    buyerUse: "durable outdoor furniture collection campaign",
    differentiation: "Communicates weather resistance through realistic joinery, drainage and contrasting recycled materials.",
    materialStructure: {
      SUBJECT: "Single powder-coated recycled aluminum terrace chair with a woven seat",
      PRIMARY_MATERIAL: "powder-coated recycled aluminum",
      SECONDARY_MATERIAL: "woven recycled polymer cord",
      BACKGROUND: "lightly weathered mineral concrete terrace",
      SHADOW_STYLE: "dappled leaf shadow crossing only the rear of the scene",
      VISUAL_STYLE: "premium outdoor lifestyle product photography with believable construction",
      COMMERCIAL_CONCEPT: "long-life circular outdoor furniture campaign",
    },
    keywords: ["recycled aluminum chair", "woven outdoor seat", "circular furniture", "durable terrace chair", "outdoor furniture campaign", "powder coated metal", "recycled polymer cord", "weather resistant design", "patio product", "copy space", "sustainable furniture", "concrete terrace", "material detail", "premium outdoor living", "product hero", "responsible design", "modern chair"],
  },
  {
    title: "Terrazzo Hospitality Counter with Fluted Glass Screen",
    buyerUse: "boutique hospitality materials and renovation campaign",
    differentiation: "Combines serviceable hospitality surfaces in a practical counter detail with a large calm campaign area.",
    materialStructure: {
      SUBJECT: "Compact reception counter corner with integrated tray and rounded edge",
      PRIMARY_MATERIAL: "fine recycled-chip terrazzo",
      SECONDARY_MATERIAL: "vertical fluted glass",
      BACKGROUND: "quiet honed travertine wall",
      SHADOW_STYLE: "controlled architectural shadow defining the rounded counter edge",
      VISUAL_STYLE: "restrained contemporary hospitality photography with true-to-life surfaces",
      COMMERCIAL_CONCEPT: "boutique hospitality renovation materials campaign",
    },
    keywords: ["terrazzo reception counter", "fluted glass interior", "hospitality materials", "boutique hotel design", "recycled chip terrazzo", "renovation campaign", "reception desk detail", "travertine wall", "commercial interior", "copy space", "architectural materials", "rounded counter", "interior surface", "hotel renovation", "material specification", "contemporary hospitality", "recycled aggregate"],
  },
];

export function isMaterialMixEnabled(value: string | undefined = process.env.ENABLE_MATERIAL_MIX): boolean {
  return value?.trim().toLowerCase() !== "false";
}

function validateText(value: unknown, field: string, maxLength = 1200): string {
  if (typeof value !== "string" || value.trim().length < 8 || value.length > maxLength) throw new Error(`Invalid ${field}`);
  return value.trim();
}

function validateKeywords(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 15 || value.length > 25 ||
    !value.every((keyword) => typeof keyword === "string" && keyword.trim().length > 0 && keyword.length <= 80)) {
    throw new Error("Expected 15-25 valid keywords");
  }
  const keywords = [...new Set(value.map((keyword) => String(keyword).trim().toLowerCase()))];
  if (keywords.length < 15) throw new Error("Expected 15 unique keywords");
  return keywords;
}

function assertUniqueConcepts(entries: Array<[string, string]>): void {
  const titles = new Set<string>();
  const subjects = new Set<string>();
  for (const [titleValue, subjectValue] of entries) {
    const title = titleValue.toLowerCase().replace(/[^a-z0-9]/g, "");
    const subject = subjectValue.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (titles.has(title) || subjects.has(subject)) throw new Error("Duplicate concept");
    titles.add(title);
    subjects.add(subject);
  }
}

function validateExistingConcepts(value: unknown, expectedCount: number): ExistingConcept[] {
  if (!Array.isArray(value) || value.length !== expectedCount) throw new Error(`Expected ${expectedCount} existing concepts`);
  const concepts = value.map((candidate) => {
    if (!isRecord(candidate)) throw new Error("Invalid existing concept");
    const concept: ExistingConcept = {
      title: validateText(candidate.title, "title", 150),
      subject: validateText(candidate.subject, "subject"),
      buyerUse: validateText(candidate.buyerUse, "buyerUse"),
      differentiation: validateText(candidate.differentiation, "differentiation"),
      keywords: validateKeywords(candidate.keywords),
    };
    if (/adobe\s*stock|watermarked|matcha|trending|best.?selling/i.test(`${concept.title} ${concept.subject}`)) throw new Error("Unsuitable existing concept");
    return concept;
  });
  assertUniqueConcepts(concepts.map((concept) => [concept.title, concept.subject]));
  return concepts;
}

function validateMaterialConcepts(value: unknown): MaterialConcept[] {
  if (!Array.isArray(value) || value.length !== MATERIAL_CONCEPT_COUNT) throw new Error(`Expected ${MATERIAL_CONCEPT_COUNT} material concepts`);
  const concepts = value.map((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.materialStructure)) throw new Error("Invalid material concept");
    const materialStructure = {} as MaterialStructure;
    for (const field of MATERIAL_FIELDS) materialStructure[field] = validateText(candidate.materialStructure[field], field, 500);
    const concept: MaterialConcept = {
      title: validateText(candidate.title, "material title", 150),
      buyerUse: validateText(candidate.buyerUse, "material buyerUse"),
      differentiation: validateText(candidate.differentiation, "material differentiation"),
      materialStructure,
      keywords: validateKeywords(candidate.keywords),
    };
    const searchable = `${concept.title} ${Object.values(materialStructure).join(" ")}`;
    if (/adobe\s*stock|watermarked|trending|best.?selling/i.test(searchable)) throw new Error("Unsuitable material concept");
    return concept;
  });
  assertUniqueConcepts(concepts.map((concept) => [concept.title, concept.materialStructure.SUBJECT]));
  return concepts;
}

function fallbackKeywords(seed: string, categoryName: string, mode: GenerationMode): string[] {
  const specific = [seed, ...seed.split(" ").filter((word) => word.length > 3).slice(0, 7), categoryName];
  const supporting = mode === "transparent_png"
    ? ["isolated design element", "clean cutout", "transparent png", "crisp silhouette", "design resource", "white background", "commercial asset"]
    : ["commercial scene", "authentic materials", "natural light", "copy space", "buyer focused", "editorial use", "campaign image"];
  return [...new Set([...specific, ...supporting, "tactile detail", "unbranded", "original concept", "visual storytelling"])]
    .map((keyword) => keyword.toLowerCase())
    .slice(0, 25);
}

function createExistingFallbacks(
  seeds: readonly string[], categoryName: string, buyer: string, mode: GenerationMode, count: number,
): ExistingConcept[] {
  return seeds.slice(0, count).map((seed) => ({
    title: seed.charAt(0).toUpperCase() + seed.slice(1),
    subject: seed,
    buyerUse: buyer,
    differentiation: `Focus on the specific material, context and practical function of ${seed}; avoid generic category symbols.`,
    keywords: fallbackKeywords(seed, categoryName, mode),
  }));
}

function buildExistingDrafts(
  concepts: ExistingConcept[], category: ReturnType<typeof getDailyCategory>, mode: GenerationMode, planningSource: PlanningSource,
): StockImageDraft[] {
  const isTransparent = mode === "transparent_png";
  const composition = isTransparent ? "asset" : category.kind === "artwork" ? "artwork" : "advertising";
  return concepts.map((concept, index) => {
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
      seoTitle: title,
      category: category.name,
      aspectRatio: composition === "artwork" ? "4:5" : isTransparent ? "1:1" : index % 2 === 0 ? "16:9" : "3:2",
      composition,
      prompt: `${concept.subject}. ${layout} Distinctive visual direction: ${concept.differentiation}. Intended application (do not render text): ${concept.buyerUse}.`,
      negativePrompt: "text, lettering, logos, signatures, watermarks, preview overlays, branded objects, distorted anatomy, duplicated objects, checkerboard backgrounds, identifiable faces",
      keywords: [...new Set([...concept.keywords, ...(isTransparent ? ["isolated", "cutout", "transparent"] : [])])].slice(0, 25),
      modelUsed: "google/gemini-3.1-flash-lite-image",
      generationMode: mode,
      isTransparent,
      conceptMode: "existing",
      planningSource,
    };
  });
}

function buildMaterialDrafts(concepts: MaterialConcept[], planningSource: PlanningSource): StockImageDraft[] {
  return concepts.map((concept, index) => {
    const structure = concept.materialStructure;
    const copySpaceSide = index % 2 === 0 ? "left" : "right";
    const subjectSide = copySpaceSide === "left" ? "right" : "left";
    return {
      seoTitle: concept.title,
      category: "7-Part Material Concept",
      aspectRatio: "16:9",
      composition: "advertising",
      prompt: `Create a physically plausible ${structure.SUBJECT}, made primarily from ${structure.PRIMARY_MATERIAL} with ${structure.SECONDARY_MATERIAL}, against ${structure.BACKGROUND}. Use ${structure.SHADOW_STYLE} and a ${structure.VISUAL_STYLE}. Compose the subject on the ${subjectSide} third and preserve approximately 55% deliberate clean copy space on the ${copySpaceSide}. Commercial purpose (do not render text): ${structure.COMMERCIAL_CONCEPT}. Distinctive visual direction: ${concept.differentiation}. Intended buyer use (do not render text): ${concept.buyerUse}.`,
      negativePrompt: "text, lettering, logos, signatures, watermarks, preview overlays, branded objects, impossible material joints, floating hardware, plastic AI glossiness, distorted geometry, duplicated objects",
      keywords: concept.keywords,
      modelUsed: "google/gemini-3.1-flash-lite-image",
      generationMode: "regular_scene",
      isTransparent: false,
      conceptMode: "material_concept",
      materialStructure: structure,
      planningSource,
    };
  });
}

export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString(),
  forcedMode?: GenerationMode,
): Promise<{ trend: MarketTrend; items: StockImageItem[]; mode: GenerationMode; conceptMix: ConceptMixSummary }> {
  const date = new Date(currentDate);
  const category = getDailyCategory(date);
  const mode = forcedMode || getDailyScheduledMode(date);
  const productionDate = getBangkokDate(date);
  const mixEnabled = isMaterialMixEnabled();
  const existingCount = mixEnabled ? EXISTING_CONCEPT_COUNT : BATCH_SIZE;
  let planningSource: PlanningSource = "ai";
  let existingConcepts: ExistingConcept[];
  let materialConcepts: MaterialConcept[] = [];

  try {
    const response = await callOpenRouterJSON<unknown>(
      `You are a commercial art director developing buyer-specific image briefs, NOT a live market research tool.
Return exactly ${existingCount} genuinely different existing-style concepts${mixEnabled ? ` and exactly ${MATERIAL_CONCEPT_COUNT} 7-Part Material Concepts` : ""}. Do not create crops, recolors or alternate angles of one idea.
Every concept must solve a concrete buyer task. Titles describe only visible content. Provide 15-25 accurate English keyword phrases in descending relevance, with the ten most specific first. No keyword stuffing.
Existing-style concepts must fit today's supplied theme and output mode. Transparent assets need closed silhouettes and no copy space or shadows. Full-bleed artwork must be the artwork itself and must not reserve advertising copy space.
${mixEnabled ? `Each material concept must have a different subject and commercial use case and contain exactly these seven non-empty string fields: SUBJECT, PRIMARY_MATERIAL, SECONDARY_MATERIAL, BACKGROUND, SHADOW_STYLE, VISUAL_STYLE, COMMERCIAL_CONCEPT. Material combinations and construction must be physically plausible. Each will become a 16:9 regular-scene advertising image with the subject on one third and about 50-60% clean copy space on the opposite side.` : ""}
Prefer specific buyer-intent niches over generic high-volume labels. Differentiate through subject, setting, action, material and composition—not merely color.
Never claim verified demand, low competition, sales figures, search volume or customer validation. No brands, artist imitation, protected characters, generic coffee/matcha, blank frames, generic laptop scenes, typography, signatures, logos, watermarks or marketplace names.
Use culturally specific materials only when accurate and named. Avoid unsupported medical, cultural, accessibility or sustainability claims.
Return JSON ${mixEnabled
        ? `{"existingConcepts":[{"title":"...","subject":"...","buyerUse":"...","differentiation":"...","keywords":["..."]}],"materialConcepts":[{"title":"...","buyerUse":"...","differentiation":"...","materialStructure":{"SUBJECT":"...","PRIMARY_MATERIAL":"...","SECONDARY_MATERIAL":"...","BACKGROUND":"...","SHADOW_STYLE":"...","VISUAL_STYLE":"...","COMMERCIAL_CONCEPT":"..."},"keywords":["..."]}]}`
        : `{"existingConcepts":[{"title":"...","subject":"...","buyerUse":"...","differentiation":"...","keywords":["..."]}]`}.
Keep visual descriptions concise and use natural English.`,
      `Bangkok production date: ${productionDate}. Day-of-month theme ${category.day}/31: ${category.name}. Buyers: ${category.buyer}.
Portfolio review: 50 public Adobe Stock contributor portfolios were reviewed as visual/use-case signals only. Patterns included clear copy space, material-specific product scenes, ingredient-led food, authentic actions, precise cutouts, regional craft and practical finance, healthcare, civic, technology and design tasks. Do not imitate any contributor or existing asset.
Public Adobe Stock result counts are catalog-supply snapshots, not demand or sales evidence. Use broad-page repetition only as a reason to create a more specific and useful brief.
Existing-theme starting points: ${category.seeds.join("; ")}.
Existing output mode: ${mode}. ${mode === "transparent_png"
        ? "The existing concepts are isolated assets on pure white for later background removal; no shadows or copy space."
        : category.kind === "artwork"
          ? "The existing concepts are full-bleed original artwork; no frame, room, mockup or advertising copy space."
          : "The existing concepts are commercial scenes with credible materials and intentional copy space when useful."}
${mixEnabled ? "Material concepts complement the batch but must use five distinct buyer applications, not five material variations of the same product." : ""}
Use the season 60-90 days after this date only when relevant; otherwise remain evergreen.`,
      "google/gemini-3.1-flash-lite",
    );
    if (!isRecord(response)) throw new Error("Invalid planning response");
    existingConcepts = validateExistingConcepts(response.existingConcepts, existingCount);
    if (mixEnabled) materialConcepts = validateMaterialConcepts(response.materialConcepts);
    assertUniqueConcepts([
      ...existingConcepts.map((concept): [string, string] => [concept.title, concept.subject]),
      ...materialConcepts.map((concept): [string, string] => [concept.title, concept.materialStructure.SUBJECT]),
    ]);
  } catch (error) {
    console.warn("Concept planning unavailable; using curated fallback briefs:", error instanceof Error ? error.message : "Invalid response");
    planningSource = "curated_fallback";
    existingConcepts = createExistingFallbacks(category.seeds, category.name, category.buyer, mode, existingCount);
    materialConcepts = mixEnabled ? MATERIAL_FALLBACKS : [];
  }

  const drafts = [
    ...buildExistingDrafts(existingConcepts, category, mode, planningSource),
    ...buildMaterialDrafts(materialConcepts, planningSource),
  ];
  const orderedDrafts = mixEnabled ? shuffleForProductionDate(drafts, productionDate) : drafts;
  const items: StockImageItem[] = orderedDrafts.map((draft, index) => {
    const id = index + 1;
    const itemMode = draft.generationMode || mode;
    return { ...draft, id, filename: generateUniqueStockFilename(draft.seoTitle, id, date, itemMode) };
  });
  const conceptMix = summarizeConceptMix(items, mode);

  return {
    mode,
    items,
    conceptMix,
    trend: {
      theme: mixEnabled
        ? `Day ${category.day} · ${category.name} — 5 existing + 5 material concepts`
        : `Day ${category.day} · ${category.name} — ${BATCH_SIZE} buyer-focused concepts`,
      targetMarket: mixEnabled ? `${category.buyer}; commercial material and product advertisers` : category.buyer,
      commercialReasoning: `${planningSource === "curated_fallback" ? "Curated fallback briefs; AI planning unavailable." : "AI-developed briefs based on curated research signals."} ${mixEnabled ? "The batch contains an exact 5:5 concept mix with per-item file modes." : "The material mix rollback switch is disabled."} No live sales, competition or keyword-volume validation; review before submission.`,
      seasonalRelevance: `Bangkok ${productionDate}; monthly plan day ${category.day}/31. Validate season, materials and cultural details manually.`,
      buyerDemandRating: "Research Candidate",
    },
  };
}
