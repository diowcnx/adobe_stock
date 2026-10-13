import { callOpenRouterJSON } from "./openrouter";
import { isRecord } from "./errors";
import type {
  ConceptPlanSummary,
  MarketTrend,
  PlanningSource,
  StockImageItem,
  ThaiEditorialStillLifeStructure,
} from "./types";
import { generateUniqueStockFilename } from "./csv";
import { BATCH_SIZE, getBangkokDate, getDailyCategory, getDailyScheduledMode, type GenerationMode } from "./production-plan";
import {
  formatThaiEditorialStillLifePrompt,
  shuffleForProductionDate,
  STILL_LIFE_ASPECT_RATIOS,
  summarizeConceptPlan,
  THAI_EDITORIAL_STILL_LIFE_FIELDS,
  THAI_EDITORIAL_STILL_LIFE_TYPE,
} from "./structured-concepts";

export { getDailyScheduledMode } from "./production-plan";

interface StructuredConcept {
  title: string;
  buyerUse: string;
  differentiation: string;
  structure: ThaiEditorialStillLifeStructure;
  keywords: string[];
}

interface LegacyConcept {
  title: string;
  subject: string;
  buyerUse: string;
  differentiation: string;
  keywords: string[];
}

interface FallbackStory extends Omit<ThaiEditorialStillLifeStructure, "CAMPAIGN_THEME" | "TEXT_ELEMENTS"> {
  title: string;
  differentiation: string;
  keywords: string[];
}

type StockImageDraft = Omit<StockImageItem, "id" | "filename">;

const FALLBACK_STORIES: FallbackStory[] = [
  {
    title: "Silk Thread River with Wooden Buttons",
    differentiation: "A flowing craft-continuity metaphor built from humble sewing materials rather than literal landmarks.",
    MAIN_CONCEPT: "generations of Thai craft knowledge flowing forward like a quiet river",
    CAMERA_ANGLE: "three-quarter overhead view at approximately 35 degrees",
    LENS_TYPE: "90 mm macro lens with crisp foreground fibers and gentle depth falloff",
    SHOT_TYPE: "vertical editorial hero still life",
    LIGHTING: "large softbox from upper left with a narrow warm rim light",
    BACKGROUND_BASE: "deep indigo handmade paper",
    BACKGROUND_TEXTURE: "fine deckled fibers and subtle natural irregularity",
    BACKGROUND_DETAILS: "a faint curved tonal path with no printed pattern",
    CENTRAL_INSTALLATION: "an undulating ribbon of handwoven Thai silk offcuts forming a river-like path",
    PRIMARY_COMPONENTS: "silk strands, plain wooden buttons and small unbranded thread spools",
    SUPPORTING_ACCENT_1: "loose cream thread loops suggesting continuity",
    SUPPORTING_ACCENT_2: "three restrained brass sewing weights used as visual anchors",
    MATERIAL_FOCUS: "visible silk slubs, thread twist, worn wood grain and honest metal patina",
    COMPOSITION_LOGIC: "diagonal flow from lower left to upper right with 40 percent clean copy space at upper left",
    ATMOSPHERIC_STYLE: "quietly premium, contemplative and handcrafted",
    COLOR_PALETTE: "indigo, muted mulberry, warm ivory, teak brown and aged brass",
    keywords: ["Thai silk still life", "silk thread river", "wooden sewing buttons", "Thai craft concept", "handwoven silk texture", "editorial advertising", "textile heritage", "creative composition", "studio photography", "copy space", "thread spool", "indigo background", "craft continuity", "material detail", "cultural design"],
  },
  {
    title: "Coffee Bean Sunrise with Indigo Thread",
    differentiation: "Coffee beans and thread form an abstract dawn story without imitating a farm, map or tourism image.",
    MAIN_CONCEPT: "everyday energy rising from patient local craft and careful preparation",
    CAMERA_ANGLE: "direct top-down view",
    LENS_TYPE: "50 mm normal lens with edge-to-edge material clarity",
    SHOT_TYPE: "wide horizontal campaign still life",
    LIGHTING: "low warm side light creating a controlled sunrise gradient",
    BACKGROUND_BASE: "matte terracotta-colored board",
    BACKGROUND_TEXTURE: "fine mineral plaster with slight hand-troweled variation",
    BACKGROUND_DETAILS: "a soft circular glow with no symbols or lettering",
    CENTRAL_INSTALLATION: "a rising arc of roasted coffee beans held together by indigo and saffron thread lines",
    PRIMARY_COMPONENTS: "whole roasted coffee beans, cotton thread and a plain hammered brass disc",
    SUPPORTING_ACCENT_1: "small dried coffee leaves used sparingly",
    SUPPORTING_ACCENT_2: "one folded strip of natural linen",
    MATERIAL_FOCUS: "oily bean surfaces, fibrous thread, brushed brass and dry plaster",
    COMPOSITION_LOGIC: "sunrise arc placed on the right half with broad calm copy space on the left",
    ATMOSPHERIC_STYLE: "optimistic, refined and energetic without rustic clichés",
    COLOR_PALETTE: "coffee brown, terracotta, indigo, saffron and warm brass",
    keywords: ["coffee bean sunrise", "Thai coffee concept", "indigo thread", "creative coffee advertising", "editorial still life", "roasted coffee texture", "studio campaign", "visual metaphor", "brass disc", "copy space", "terracotta background", "artisan coffee", "material photography", "morning energy", "Thai inspired design"],
  },
  {
    title: "Jasmine Welcome Circle on Celadon Surface",
    differentiation: "A contemporary hospitality welcome gesture made from loose botanical and textile details, not a ceremonial object.",
    MAIN_CONCEPT: "a generous welcome expressed through fragrance, softness and an open circle",
    CAMERA_ANGLE: "slightly elevated frontal view",
    LENS_TYPE: "85 mm portrait lens focused across the central floral plane",
    SHOT_TYPE: "square premium hospitality still life",
    LIGHTING: "diffused daylight from the right with a soft reflected fill",
    BACKGROUND_BASE: "pale celadon-toned ceramic slab",
    BACKGROUND_TEXTURE: "subtle crackle-free satin glaze and softly worn edges",
    BACKGROUND_DETAILS: "gentle silk-cord shadow lines kept away from the copy area",
    CENTRAL_INSTALLATION: "an incomplete open circle of fresh jasmine buds and ivory silk cord",
    PRIMARY_COMPONENTS: "jasmine buds, folded silk ribbon and a small plain ceramic dish",
    SUPPORTING_ACCENT_1: "two glossy green leaves for botanical contrast",
    SUPPORTING_ACCENT_2: "a single mother-of-pearl button outside the circle",
    MATERIAL_FOCUS: "fresh petal translucency, silk sheen, ceramic glaze and iridescent shell detail",
    COMPOSITION_LOGIC: "open circle centered low with a clean upper third for later campaign typography",
    ATMOSPHERIC_STYLE: "gracious, calm, contemporary and sensorial",
    COLOR_PALETTE: "jasmine white, celadon green, leaf green and soft pearl",
    keywords: ["jasmine welcome concept", "Thai hospitality still life", "jasmine buds", "celadon surface", "silk ribbon", "editorial advertising", "botanical studio photo", "open circle composition", "premium hospitality", "copy space", "flower texture", "mother of pearl button", "calm campaign", "Thai inspired", "material realism"],
  },
  {
    title: "Lotus Petal Rhythm with Silk Loops",
    differentiation: "Loose petals and thread describe renewal through rhythm and negative space without depicting sacred iconography.",
    MAIN_CONCEPT: "renewal unfolding through small repeated acts",
    CAMERA_ANGLE: "top-down macro view with a slight diagonal crop",
    LENS_TYPE: "100 mm macro lens revealing petal veins and thread fibers",
    SHOT_TYPE: "close editorial detail still life",
    LIGHTING: "cool diffused overhead light with a narrow warm bounce from below",
    BACKGROUND_BASE: "charcoal-gray handmade paper",
    BACKGROUND_TEXTURE: "soft fibrous surface with shallow pressed lines",
    BACKGROUND_DETAILS: "subtle concentric indentations made without printed motifs",
    CENTRAL_INSTALLATION: "lotus petals arranged as a progressive wave interlaced with silk thread loops",
    PRIMARY_COMPONENTS: "fresh pink lotus petals, muted rose silk thread and plain shell buttons",
    SUPPORTING_ACCENT_1: "tiny water droplets placed only on several petals",
    SUPPORTING_ACCENT_2: "a narrow strip of folded banana leaf at the edge",
    MATERIAL_FOCUS: "petal veins, moisture, twisted silk fibers, shell iridescence and matte paper grain",
    COMPOSITION_LOGIC: "rhythmic wave crosses the lower two thirds while the upper right remains visually quiet",
    ATMOSPHERIC_STYLE: "poetic, modern, meditative and tactile",
    COLOR_PALETTE: "lotus pink, charcoal, muted rose, leaf green and pearl",
    keywords: ["lotus petal still life", "silk thread loops", "Thai renewal concept", "editorial macro photography", "flower texture", "shell buttons", "creative advertising", "visual rhythm", "handmade paper", "copy space", "botanical concept", "studio lighting", "material detail", "modern Thai design", "poetic composition"],
  },
  {
    title: "Indigo Weaving Grid with Thread Spools",
    differentiation: "A modern grid reveals process and imperfection without copying any protected regional textile pattern.",
    MAIN_CONCEPT: "many individual threads becoming one resilient shared structure",
    CAMERA_ANGLE: "precise overhead view",
    LENS_TYPE: "60 mm macro lens with a flat field of focus",
    SHOT_TYPE: "graphic editorial flat lay",
    LIGHTING: "broad neutral soft light with small directional highlights on thread",
    BACKGROUND_BASE: "warm off-white cotton canvas",
    BACKGROUND_TEXTURE: "visible plain weave with naturally uneven fibers",
    BACKGROUND_DETAILS: "faint removable alignment marks made from loose thread only",
    CENTRAL_INSTALLATION: "an original abstract grid woven from loose indigo thread and narrow plain silk strips",
    PRIMARY_COMPONENTS: "indigo cotton thread, unpatterned silk offcuts and wooden bobbins",
    SUPPORTING_ACCENT_1: "cream corozo-style buttons with no branding",
    SUPPORTING_ACCENT_2: "small raw cotton tufts at three intersections",
    MATERIAL_FOCUS: "dye variation, thread fuzz, silk slubs, canvas weave and wood grain",
    COMPOSITION_LOGIC: "asymmetric grid weighted left with an uninterrupted vertical copy-space column on the right",
    ATMOSPHERIC_STYLE: "intelligent, crafted, contemporary and quietly human",
    COLOR_PALETTE: "deep indigo, washed blue, warm white, raw cotton and pale wood",
    keywords: ["indigo weaving concept", "Thai textile still life", "thread spool flat lay", "abstract woven grid", "silk offcuts", "editorial advertising", "craft process", "cotton canvas", "material texture", "copy space", "original pattern", "studio flat lay", "handmade detail", "creative textile", "contemporary Thai"],
  },
  {
    title: "Rice Grain Path through Woven Bamboo",
    differentiation: "Food and basketry materials become a precise journey metaphor rather than a literal meal scene.",
    MAIN_CONCEPT: "careful steps from field knowledge to a shared table",
    CAMERA_ANGLE: "low oblique angle close to the surface",
    LENS_TYPE: "70 mm macro lens with controlled selective focus",
    SHOT_TYPE: "cinematic horizontal ingredient still life",
    LIGHTING: "raking afternoon-style studio light from the left",
    BACKGROUND_BASE: "dark warm teak-toned board",
    BACKGROUND_TEXTURE: "fine straight wood grain with a dry matte finish",
    BACKGROUND_DETAILS: "a narrow woven bamboo strip crossing the background diagonally",
    CENTRAL_INSTALLATION: "a carefully curved path of uncooked jasmine rice grains passing through a small bamboo weave opening",
    PRIMARY_COMPONENTS: "jasmine rice grains, woven bamboo strips and red silk thread",
    SUPPORTING_ACCENT_1: "one folded banana-leaf segment",
    SUPPORTING_ACCENT_2: "three tiny toasted rice clusters for tonal variation",
    MATERIAL_FOCUS: "translucent rice edges, bamboo fibers, silk sheen, leaf veins and dry wood grain",
    COMPOSITION_LOGIC: "curved path guides the eye into the frame with clean dark space across the upper left",
    ATMOSPHERIC_STYLE: "grounded, generous, precise and warm",
    COLOR_PALETTE: "rice ivory, bamboo gold, deep teak, leaf green and lacquer red",
    keywords: ["jasmine rice concept", "woven bamboo still life", "Thai food heritage", "rice grain path", "ingredient advertising", "editorial studio photo", "banana leaf", "silk thread", "material texture", "copy space", "culinary story", "creative composition", "warm lighting", "Thai inspired campaign", "food material detail"],
  },
  {
    title: "Orchid Petal Pleats with Pearl Buttons",
    differentiation: "Beauty is described through surface, folds and botanical fragility instead of a conventional cosmetics bottle.",
    MAIN_CONCEPT: "confidence formed by balancing softness with precise structure",
    CAMERA_ANGLE: "front-facing view with a slight downward tilt",
    LENS_TYPE: "105 mm macro lens emphasizing layered surfaces",
    SHOT_TYPE: "vertical beauty editorial still life",
    LIGHTING: "sculpted side light through diffusion with a soft violet edge glow",
    BACKGROUND_BASE: "matte plum-colored fabric-covered panel",
    BACKGROUND_TEXTURE: "fine silk-like weave with shallow pleated relief",
    BACKGROUND_DETAILS: "two restrained curved seams without decorative symbols",
    CENTRAL_INSTALLATION: "architectural pleats of plain silk supporting a cascade of orchid petals",
    PRIMARY_COMPONENTS: "orchid petals, plum silk folds and iridescent shell buttons",
    SUPPORTING_ACCENT_1: "thin copper-colored thread tracing one contour",
    SUPPORTING_ACCENT_2: "a small clear glass bead used as a light-catching point",
    MATERIAL_FOCUS: "petal translucency, woven folds, shell iridescence, metallic thread and glass refraction",
    COMPOSITION_LOGIC: "installation occupies the lower right two thirds with a calm upper-left copy field",
    ATMOSPHERIC_STYLE: "confident, sensorial, fashion-forward and refined",
    COLOR_PALETTE: "orchid violet, deep plum, pearl, copper and soft blush",
    keywords: ["orchid petal editorial", "Thai beauty concept", "silk pleat still life", "pearl buttons", "creative beauty advertising", "macro material detail", "studio photography", "botanical luxury", "copy space", "textile texture", "orchid flower", "fashion still life", "violet palette", "visual metaphor", "contemporary Thai design"],
  },
  {
    title: "Monsoon Thread Lines with Glass Droplets",
    differentiation: "Rain is translated into thread and glass with studio control, avoiding a generic wet-window scene.",
    MAIN_CONCEPT: "adaptability and fresh momentum during changing seasons",
    CAMERA_ANGLE: "straight-on graphic view",
    LENS_TYPE: "80 mm lens with crisp parallel-line rendering",
    SHOT_TYPE: "horizontal conceptual campaign still life",
    LIGHTING: "cool top light with a narrow cyan reflection and soft shadow separation",
    BACKGROUND_BASE: "deep blue-gray limewash panel",
    BACKGROUND_TEXTURE: "subtle vertical brush texture",
    BACKGROUND_DETAILS: "faint tonal cloud shapes formed only by light falloff",
    CENTRAL_INSTALLATION: "descending blue cotton threads carrying clear glass droplets above a fresh green leaf arc",
    PRIMARY_COMPONENTS: "blue thread, clear glass beads and glossy tropical leaves",
    SUPPORTING_ACCENT_1: "small silver-gray buttons arranged as distant rain points",
    SUPPORTING_ACCENT_2: "a single folded strip of pale silk suggesting clearing sky",
    MATERIAL_FOCUS: "wet leaf sheen, thread fibers, glass refraction, limewash brush marks and silk luster",
    COMPOSITION_LOGIC: "rain lines cluster on the left and dissolve toward broad clear space on the right",
    ATMOSPHERIC_STYLE: "fresh, resilient, immersive and clean",
    COLOR_PALETTE: "monsoon blue, slate, leaf green, clear glass and pale sky gray",
    keywords: ["monsoon concept still life", "rain thread installation", "Thai seasonal campaign", "glass droplets", "tropical leaves", "editorial advertising", "creative weather metaphor", "studio photography", "blue background", "copy space", "material realism", "fresh atmosphere", "cotton thread", "resilience concept", "Thai inspired design"],
  },
  {
    title: "Terracotta Mosaic Joined by Silk Cord",
    differentiation: "Everyday ceramic fragments and cord visualize repair without borrowing sacred or antique motifs.",
    MAIN_CONCEPT: "new value emerging when different parts are connected with care",
    CAMERA_ANGLE: "overhead view with subtle perspective",
    LENS_TYPE: "55 mm lens balancing graphic clarity with tactile depth",
    SHOT_TYPE: "square contemporary design still life",
    LIGHTING: "warm directional light with crisp but softened edge shadows",
    BACKGROUND_BASE: "pale sand-colored mineral board",
    BACKGROUND_TEXTURE: "fine granular plaster with small natural speckles",
    BACKGROUND_DETAILS: "shallow curved grooves linking the main fragments",
    CENTRAL_INSTALLATION: "an original abstract mosaic of plain terracotta fragments connected by silk cord",
    PRIMARY_COMPONENTS: "unglazed terracotta pieces, saffron silk cord and matte wooden buttons",
    SUPPORTING_ACCENT_1: "small white flower petals placed at selected junctions",
    SUPPORTING_ACCENT_2: "tiny brass washers used as neutral contemporary accents",
    MATERIAL_FOCUS: "porous clay edges, silk twist, worn wood, petal softness and brushed metal",
    COMPOSITION_LOGIC: "cluster sits off-center with a deliberate open quadrant for campaign layout",
    ATMOSPHERIC_STYLE: "inventive, optimistic, grounded and design-led",
    COLOR_PALETTE: "terracotta, sand, saffron, warm white and muted brass",
    keywords: ["terracotta mosaic concept", "silk cord installation", "Thai design still life", "creative repair metaphor", "ceramic fragments", "editorial advertising", "material composition", "studio photography", "wooden buttons", "copy space", "contemporary craft", "clay texture", "visual storytelling", "design campaign", "Thai inspired materials"],
  },
  {
    title: "Night Market Pulse in Thread and Coffee",
    differentiation: "Urban energy is expressed as an abstract rhythm of small materials without readable signs or literal street-market imagery.",
    MAIN_CONCEPT: "many small independent makers creating one lively shared rhythm",
    CAMERA_ANGLE: "dramatic low three-quarter view",
    LENS_TYPE: "65 mm lens with selective focus and controlled highlight bloom",
    SHOT_TYPE: "cinematic wide editorial still life",
    LIGHTING: "layered magenta and warm amber studio light with a narrow blue fill",
    BACKGROUND_BASE: "near-black matte lacquer board",
    BACKGROUND_TEXTURE: "subtle brushed surface visible only in highlights",
    BACKGROUND_DETAILS: "soft pools of colored light with no signage or text shapes",
    CENTRAL_INSTALLATION: "a rising pulse waveform assembled from thread spools, coffee beans and plain metal discs",
    PRIMARY_COMPONENTS: "bright cotton threads, roasted coffee beans and small brushed-metal circles",
    SUPPORTING_ACCENT_1: "tiny folded flower petals as intermittent color beats",
    SUPPORTING_ACCENT_2: "short woven bamboo segments forming a low baseline",
    MATERIAL_FOCUS: "thread fuzz, coffee oils, brushed metal, petal edges, bamboo fibers and matte lacquer",
    COMPOSITION_LOGIC: "rhythmic installation runs across the lower half with a dark clean upper band",
    ATMOSPHERIC_STYLE: "energetic, contemporary, communal and polished",
    COLOR_PALETTE: "near black, magenta, amber, electric blue, coffee brown and bamboo gold",
    keywords: ["night market concept", "Thai urban still life", "thread spool installation", "coffee bean art", "creative community campaign", "editorial advertising", "studio color lighting", "visual rhythm", "material texture", "copy space", "maker economy", "contemporary Thai", "cinematic still life", "abstract market energy", "commercial concept"],
  },
];

export function isStructuredConceptsEnabled(value: string | undefined = process.env.ENABLE_STRUCTURED_CONCEPTS): boolean {
  return value?.trim().toLowerCase() !== "false";
}

function validateText(value: unknown, field: string, maxLength = 1400): string {
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
  const installations = new Set<string>();
  for (const [titleValue, installationValue] of entries) {
    const title = titleValue.toLowerCase().replace(/[^a-z0-9]/g, "");
    const installation = installationValue.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (titles.has(title) || installations.has(installation)) throw new Error("Duplicate concept");
    titles.add(title);
    installations.add(installation);
  }
}

function validateStructuredConcepts(value: unknown): StructuredConcept[] {
  if (!Array.isArray(value) || value.length !== BATCH_SIZE) throw new Error(`Expected ${BATCH_SIZE} structured concepts`);
  const concepts = value.map((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.structure)) throw new Error("Invalid structured concept");
    const structure = {} as ThaiEditorialStillLifeStructure;
    for (const field of THAI_EDITORIAL_STILL_LIFE_FIELDS) structure[field] = validateText(candidate.structure[field], field, 700);
    if (!/(no|without|reserve|copy space)/i.test(structure.TEXT_ELEMENTS)) throw new Error("TEXT_ELEMENTS must prevent rendered text");
    const concept: StructuredConcept = {
      title: validateText(candidate.title, "title", 150),
      buyerUse: validateText(candidate.buyerUse, "buyerUse"),
      differentiation: validateText(candidate.differentiation, "differentiation"),
      structure,
      keywords: validateKeywords(candidate.keywords),
    };
    const searchable = `${concept.title} ${Object.values(structure).join(" ")}`;
    if (/adobe\s*stock|watermarked|best.?selling|royal insignia|national emblem/i.test(searchable)) throw new Error("Unsuitable structured concept");
    return concept;
  });
  assertUniqueConcepts(concepts.map((concept) => [concept.title, concept.structure.CENTRAL_INSTALLATION]));
  return concepts;
}

function validateLegacyConcepts(value: unknown): LegacyConcept[] {
  if (!Array.isArray(value) || value.length !== BATCH_SIZE) throw new Error(`Expected ${BATCH_SIZE} legacy concepts`);
  return value.map((candidate) => {
    if (!isRecord(candidate)) throw new Error("Invalid legacy concept");
    return {
      title: validateText(candidate.title, "legacy title", 150),
      subject: validateText(candidate.subject, "legacy subject"),
      buyerUse: validateText(candidate.buyerUse, "legacy buyerUse"),
      differentiation: validateText(candidate.differentiation, "legacy differentiation"),
      keywords: validateKeywords(candidate.keywords),
    };
  });
}

function fallbackKeywords(seed: string, categoryName: string, mode: GenerationMode): string[] {
  const specific = [seed, ...seed.split(" ").filter((word) => word.length > 3).slice(0, 7), categoryName];
  const supporting = mode === "transparent_png"
    ? ["isolated design element", "clean cutout", "transparent png", "crisp silhouette", "design resource", "white background", "commercial asset"]
    : ["commercial scene", "authentic materials", "natural light", "copy space", "buyer focused", "editorial use", "campaign image"];
  return [...new Set([...specific, ...supporting, "tactile detail", "unbranded", "original concept", "visual storytelling"])]
    .map((keyword) => keyword.toLowerCase()).slice(0, 25);
}

function createStructuredFallbacks(category: ReturnType<typeof getDailyCategory>): StructuredConcept[] {
  return FALLBACK_STORIES.map((story) => {
    const { title, differentiation, keywords, ...fields } = story;
    return {
      title,
      buyerUse: category.buyer,
      differentiation,
      keywords,
      structure: {
        ...fields,
        CAMPAIGN_THEME: `${category.name}: ${title}`,
        TEXT_ELEMENTS: "No rendered text; reserve the specified clean copy space for typography added later by a designer",
      },
    };
  });
}

function createLegacyFallbacks(category: ReturnType<typeof getDailyCategory>, mode: GenerationMode): LegacyConcept[] {
  return category.seeds.map((seed) => ({
    title: seed.charAt(0).toUpperCase() + seed.slice(1),
    subject: seed,
    buyerUse: category.buyer,
    differentiation: `Focus on the specific material, context and practical function of ${seed}; avoid generic category symbols.`,
    keywords: fallbackKeywords(seed, category.name, mode),
  }));
}

function buildStructuredDrafts(concepts: StructuredConcept[], planningSource: PlanningSource): StockImageDraft[] {
  return concepts.map((concept, index) => ({
    seoTitle: concept.title,
    category: "Thai Editorial Still Life",
    aspectRatio: STILL_LIFE_ASPECT_RATIOS[index] || "4:5",
    composition: "advertising",
    prompt: `${formatThaiEditorialStillLifePrompt(concept.structure)} Distinctive direction: ${concept.differentiation}. Intended buyer use (do not render text): ${concept.buyerUse}.`,
    negativePrompt: "text, lettering, typography, numerals, logos, signatures, watermarks, preview overlays, branded objects, royal insignia, national emblems, religious objects, protected textile patterns, stereotypical tourist props, impossible material joints, plastic AI glossiness, duplicated objects",
    keywords: concept.keywords,
    modelUsed: "google/gemini-3.1-flash-lite-image",
    generationMode: "regular_scene",
    isTransparent: false,
    conceptMode: "structured_concept",
    conceptStructure: { type: THAI_EDITORIAL_STILL_LIFE_TYPE, fields: concept.structure },
    planningSource,
  }));
}

function buildLegacyDrafts(
  concepts: LegacyConcept[], category: ReturnType<typeof getDailyCategory>, mode: GenerationMode, planningSource: PlanningSource,
): StockImageDraft[] {
  const isTransparent = mode === "transparent_png";
  const composition = isTransparent ? "asset" : category.kind === "artwork" ? "artwork" : "advertising";
  return concepts.map((concept, index) => ({
    seoTitle: `${concept.title}${isTransparent ? " Isolated Design Element" : ""}`,
    category: category.name,
    aspectRatio: composition === "artwork" ? "4:5" : isTransparent ? "1:1" : index % 2 === 0 ? "16:9" : "3:2",
    composition,
    prompt: `${concept.subject}. ${isTransparent
      ? "Single centered isolated element on pure white, crisp closed silhouette, no shadows or copy space."
      : composition === "artwork"
        ? "Full-bleed original artwork, no frame, room, mockup or advertising copy space."
        : "Art-directed commercial scene with credible materials and useful clean copy space."} Distinctive direction: ${concept.differentiation}. Intended buyer use (do not render text): ${concept.buyerUse}.`,
    negativePrompt: "text, lettering, logos, signatures, watermarks, preview overlays, branded objects, distorted anatomy, duplicated objects, checkerboard backgrounds, identifiable faces",
    keywords: [...new Set([...concept.keywords, ...(isTransparent ? ["isolated", "cutout", "transparent"] : [])])].slice(0, 25),
    modelUsed: "google/gemini-3.1-flash-lite-image",
    generationMode: mode,
    isTransparent,
    conceptMode: "existing",
    planningSource,
  }));
}

async function planStructuredConcepts(
  category: ReturnType<typeof getDailyCategory>, productionDate: string,
): Promise<StructuredConcept[]> {
  const response = await callOpenRouterJSON<unknown>(
    `You are a commercial art director creating original Thai-inspired Editorial Still Life advertising images from accessible materials such as silk, buttons, thread, flowers, coffee beans, rice, bamboo, leaves, ceramic, paper and plain metal details.
Return exactly ${BATCH_SIZE} concepts. Every concept must tell a different commercially useful story and use a different central installation, material combination, camera treatment and composition. Do not create recolors, crops or alternate angles of one arrangement.
Each concept must contain title, buyerUse, differentiation, 15-25 accurate English keyword phrases in descending relevance, and a structure object with exactly these 18 non-empty string fields: ${THAI_EDITORIAL_STILL_LIFE_FIELDS.join(", ")}.
TEXT_ELEMENTS must explicitly say that no text is rendered and identify clean space reserved for typography added later. Titles describe visible content only.
Prioritize believable studio construction, true material scale, detailed fibers and surfaces, coherent gravity, intentional shadows and an editorial composition. Use everyday Thai material references respectfully and specifically without making unverifiable origin claims.
Do not use royal insignia, national emblems, flags, religious or sacred objects, protected textile patterns, famous designs, tourist clichés, brands, logos, readable text, pseudo-text, watermarks or artist imitation.
No unsupported sales, demand, sustainability, cultural-authenticity or low-competition claims.
Return pure JSON {"concepts":[{"title":"...","buyerUse":"...","differentiation":"...","structure":{"CAMPAIGN_THEME":"...","MAIN_CONCEPT":"...","CAMERA_ANGLE":"...","LENS_TYPE":"...","SHOT_TYPE":"...","LIGHTING":"...","BACKGROUND_BASE":"...","BACKGROUND_TEXTURE":"...","BACKGROUND_DETAILS":"...","CENTRAL_INSTALLATION":"...","PRIMARY_COMPONENTS":"...","SUPPORTING_ACCENT_1":"...","SUPPORTING_ACCENT_2":"...","MATERIAL_FOCUS":"...","COMPOSITION_LOGIC":"...","ATMOSPHERIC_STYLE":"...","COLOR_PALETTE":"...","TEXT_ELEMENTS":"No rendered text; reserve ... copy space ..."},"keywords":["..."]}]}.`,
    `Bangkok production date: ${productionDate}. Today's buyer-use context is ${category.name}. Intended buyers: ${category.buyer}.
Use the buyer context to shape ten distinct campaign stories, while keeping every output an original studio Editorial Still Life rather than a literal lifestyle scene.
Directional starting points from the monthly plan: ${category.seeds.join("; ")}.
Portfolio and public search observations are visual-positioning signals only, not proof of sales or demand. Differentiate through concept, material, construction, camera, lighting and composition.`,
    "google/gemini-3.1-flash-lite",
  );
  if (!isRecord(response)) throw new Error("Invalid structured planning response");
  return validateStructuredConcepts(response.concepts);
}

async function planLegacyConcepts(
  category: ReturnType<typeof getDailyCategory>, mode: GenerationMode, productionDate: string,
): Promise<LegacyConcept[]> {
  const response = await callOpenRouterJSON<unknown>(
    `Create exactly ${BATCH_SIZE} distinct commercial image briefs for one buyer-use theme. Return JSON {"concepts":[{"title":"...","subject":"...","buyerUse":"...","differentiation":"...","keywords":["..."]}]}. Provide 15-25 relevant English keywords per item. No brands, text, logos, watermarks, unsupported demand claims or near-duplicate concepts.`,
    `Bangkok date ${productionDate}. Theme: ${category.name}. Buyer: ${category.buyer}. Output mode: ${mode}. Starting points: ${category.seeds.join("; ")}.`,
    "google/gemini-3.1-flash-lite",
  );
  if (!isRecord(response)) throw new Error("Invalid legacy planning response");
  return validateLegacyConcepts(response.concepts);
}

export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString(),
  forcedMode?: GenerationMode,
): Promise<{ trend: MarketTrend; items: StockImageItem[]; mode: GenerationMode; conceptPlan: ConceptPlanSummary }> {
  const date = new Date(currentDate);
  const category = getDailyCategory(date);
  const productionDate = getBangkokDate(date);
  const structuredEnabled = isStructuredConceptsEnabled();
  const mode: GenerationMode = structuredEnabled ? "regular_scene" : forcedMode || getDailyScheduledMode(date);
  let planningSource: PlanningSource = "ai";
  let drafts: StockImageDraft[];

  try {
    drafts = structuredEnabled
      ? buildStructuredDrafts(await planStructuredConcepts(category, productionDate), planningSource)
      : buildLegacyDrafts(await planLegacyConcepts(category, mode, productionDate), category, mode, planningSource);
  } catch (error) {
    console.warn("Concept planning unavailable; using curated fallback briefs:", error instanceof Error ? error.message : "Invalid response");
    planningSource = "curated_fallback";
    drafts = structuredEnabled
      ? buildStructuredDrafts(createStructuredFallbacks(category), planningSource)
      : buildLegacyDrafts(createLegacyFallbacks(category, mode), category, mode, planningSource);
  }

  const orderedDrafts = structuredEnabled ? shuffleForProductionDate(drafts, productionDate) : drafts;
  const items: StockImageItem[] = orderedDrafts.map((draft, index) => {
    const id = index + 1;
    const itemMode = draft.generationMode || mode;
    return { ...draft, id, filename: generateUniqueStockFilename(draft.seoTitle, id, date, itemMode) };
  });
  const conceptPlan = summarizeConceptPlan(items, mode);

  return {
    mode,
    items,
    conceptPlan,
    trend: {
      theme: structuredEnabled
        ? `Day ${category.day} · ${category.name} — 10 Thai Editorial Still Life concepts`
        : `Day ${category.day} · ${category.name} — ${BATCH_SIZE} legacy concepts`,
      targetMarket: category.buyer,
      commercialReasoning: `${planningSource === "curated_fallback" ? "Curated fallback briefs; AI planning unavailable." : "AI-developed briefs based on the active structured-concept schema."} ${structuredEnabled ? "All ten images use the 18-field Thai Editorial Still Life structure." : "Structured concepts are disabled by rollback switch."} No live sales, competition or keyword-volume validation; review before submission.`,
      seasonalRelevance: `Bangkok ${productionDate}; monthly buyer context day ${category.day}/31. Validate cultural and material details manually.`,
      buyerDemandRating: "Research Candidate",
    },
  };
}
