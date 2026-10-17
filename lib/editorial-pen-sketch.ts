import { randomInt } from "node:crypto";
import type { EditorialPenSketchStructure, StockImageItem } from "./types";
import { GENERATION_BRIEF_VERSION } from "./generation-policy";
import { generateUniqueStockFilename, normalizeStockKeywords } from "./csv";

export const EDITORIAL_PEN_SKETCH_RECIPES = [
  ["Northern Thai Coffee Drying Patio", "Small-scale coffee processing and traceable agricultural craft", "an open mountain coffee farm patio in northern Thailand with distant layered hills", "one large woven drying tray filled with coffee cherries", "two smaller bamboo trays, plain burlap sacks, a wooden rake and a simple shade roof with no signs", "slightly elevated three-quarter wide view with the main tray dominant and a clear route through the supporting objects", "coffee roasters, food-origin publishers and regional campaign designers", "coffee provenance article, sustainable sourcing campaign or cafe wall graphic", "the recognizable drying tray and mountain context communicate coffee origin without requiring labels"],
  ["Tropical Passive Cooling House", "Climate-responsive residential design for hot humid regions", "a contemporary tropical home surrounded by restrained palms and rain-garden planting", "one deep shaded veranda with operable timber screens", "a pitched ventilated roof, broad eaves, stepping stones, rain chain and planted drainage bed", "architectural corner perspective showing the veranda, roof ventilation and garden relationship in one readable scene", "architecture publishers, sustainable housing studios and property marketers", "passive-design editorial, residential brochure background or climate article", "visible shade, ventilation and rain details make the environmental strategy understandable"],
  ["Bangkok Rooftop Food Garden", "Compact urban agriculture above a dense tropical city", "an accessible rooftop garden on a generic contemporary Bangkok building with an unbranded skyline", "one orderly raised vegetable bed with a simple drip line", "three secondary planters, a rainwater barrel, shaded potting bench and solar canopy without controls or labels", "high three-quarter overview with the hero bed in the foreground and skyline kept secondary", "urban-planning publishers, food brands and sustainability teams", "urban farming feature, rooftop campaign or food-security report illustration", "the raised bed, water storage and city roof immediately explain productive urban space"],
  ["Community Bicycle Repair Bench", "Repair culture and practical circular economy", "an open neighborhood repair corner with a plain wall and concrete floor", "one complete commuter bicycle secured on a repair stand", "organized hand tools, tire pump, spare inner tube, parts tray and a second wheel leaning against the wall", "eye-level three-quarter view with the intact bicycle silhouette unobstructed and the workbench leading into the frame", "mobility publishers, repair programs and cycling brands", "repair guide cover, circular-economy article or workshop campaign", "a complete bicycle and organized tools make the repair purpose instantly clear"],
  ["Ceramic Studio Worktable", "Handmade production and tactile craft process", "a quiet daylight ceramic studio with an unmarked plaster wall", "one freshly thrown clay vase centered on a wooden worktable", "pottery wheel, trimming tools, two clay blocks, plain test tiles and one finished bowl without stamps", "close three-quarter tabletop view with the vase as the single hero and tools arranged in a restrained working arc", "craft publishers, ceramic studios and homeware brands", "maker-story editorial, studio campaign or craft-process feature", "the fresh vase and specific tools provide a clear handmade production narrative"],
  ["Monsoon Rain Garden Street", "Neighborhood flood resilience through visible landscape design", "a generic tropical residential street during light monsoon rain with no signs or addresses", "one planted curbside rain garden receiving water from the street", "permeable paving, curb inlet, native grasses, one unbranded parked bicycle and shallow flowing water", "wide street-level diagonal composition following water from pavement into the planted basin", "climate publishers, landscape architects and municipal education teams", "stormwater article, resilient-neighborhood report or public-space campaign", "the water path and planted basin explain rain capture without technical labels"],
  ["Coastal Eco Lodge Deck", "Low-impact hospitality connected to a tropical coast", "a quiet coastal lodge deck overlooking mangroves and open water", "one shaded daybed built from natural timber and woven fiber", "two plain cushions, a small side table, planted clay pot, slatted canopy and distant canoe with no branding", "open corner perspective using the canopy and deck boards to frame the daybed and water horizon", "hospitality designers, travel publishers and eco-resort marketers", "sustainable-stay campaign, travel editorial or accommodation brochure", "the clear resting area and coastal setting offer immediate hospitality use"],
  ["After-Hours Flower Market", "Fresh local flower trade before opening", "a covered tropical wholesale flower market aisle with every stall sign left blank", "one overflowing bucket group of lotus, orchids and marigolds", "stacked plain buckets, folded wrapping paper, hand cart and wet reflective floor without people", "low aisle perspective with the flower group sharply dominant and repeating stalls creating depth", "florists, event publishers and regional lifestyle brands", "flower-market editorial, seasonal campaign or local-culture feature", "recognizable flowers and trade equipment tell a specific market story without a crowd"],
  ["Artisan Bread Cooling Rack", "Small bakery production and fresh batch preparation", "an unbranded neighborhood bakery prep room with a tiled wall", "one wheeled cooling rack holding clearly formed rustic loaves", "wooden peel, flour-dusted worktable, proofing baskets and a plain oven with blank controls", "frontal three-quarter interior view with the complete cooling rack as hero and strong depth lines from the table", "bakery brands, food publishers and hospitality marketers", "fresh-bread campaign, production story or cafe editorial", "the cooling rack and baking tools communicate a real production moment at a glance"],
  ["Botanical Skincare Workbench", "Plant-based formulation in a small clean studio", "a bright botanical product-development workbench with no laboratory labels", "one plain amber dropper bottle beside a small ceramic mixing bowl", "mortar and pestle, measured oil droplets, restrained leaves, glass stirring rod and folded cotton cloth", "direct overhead composition with the bottle and bowl forming one clear center and generous working space around them", "beauty brands, wellness publishers and packaging designers", "ingredient story, skincare editorial or clean-beauty campaign background", "the bottle, mixing bowl and botanical ingredients clearly connect formulation to a finished product"],
  ["Accessible Kitchen Detail", "Independent daily living through inclusive home design", "a contemporary compact kitchen with warm natural materials", "one low work surface with a clear knee space and reachable induction cooktop", "D-shaped cabinet pulls, pull-out shelf, side-opening oven and one plain prepared bowl", "wide frontal corner view keeping the accessible work zone complete and unobstructed", "interior publishers, accessibility organizations and housing designers", "inclusive-design article, housing guide or product-planning presentation", "the reachable appliances and open knee space make the accessibility benefit visually explicit"],
  ["Wetland Observation Shelter", "Quiet nature access and habitat education", "a reed wetland edge under a broad tropical sky", "one simple timber bird-observation shelter connected to a boardwalk", "shallow water, reed clusters, two distant birds, a plain bench and low habitat islands without signs", "wide eye-level landscape view with the boardwalk leading to the shelter and ample sky as natural copy space", "conservation publishers, eco-tourism teams and outdoor brands", "wetland feature, nature-travel campaign or conservation report cover", "the boardwalk and shelter make responsible wildlife observation immediately understandable"],
] as const;

const COLOR_PALETTES = [
  "forest green, sepia brown, muted ochre and one restrained coral accent drawn with colored technical pens",
  "indigo blue, olive green, warm umber and pale terracotta accents drawn with archival ink pens",
  "deep teal, burnt sienna, moss green and soft mustard accents with no solid digital color fills",
] as const;

const HATCHING_STYLES = [
  "controlled diagonal hatching for midtones, tighter cross-hatching only in the deepest shadows and sparse contour hatching on curved surfaces",
  "directional contour hatching that follows material form, light parallel strokes in open areas and compact cross-hatching beneath objects",
  "fine varied line weight with long single-direction hatching, restrained stipple in textured materials and no scribbled shading",
] as const;

const PAPER_STYLES = [
  "warm off-white heavyweight drawing paper with subtle natural tooth filling the entire canvas",
  "pale ivory recycled sketch paper with delicate visible fibers filling every edge",
  "soft cream archival paper with a fine pressed grain and no visible sheet boundary",
] as const;

const MOODS = [
  "calm, observant and editorial with quiet morning clarity",
  "warm, practical and optimistic with an authentic documentary character",
  "thoughtful, tactile and inviting without nostalgia or decorative clutter",
] as const;

export function formatEditorialPenSketchPrompt(fields: EditorialPenSketchStructure): string {
  const visualFields = Object.entries(fields).filter(([key]) => key !== "TEXT_ELEMENTS");
  return [
    "[VISUAL_USER_INPUT]", ...visualFields.map(([key, value]) => key + ": " + value),
    "[ROLE & TASK] Create one original full-bleed editorial pen-and-ink illustration using only the nine visual input fields. The omitted control field requires a completely text-free image.",
    "Make MAIN_SUBJECT complete, immediately recognizable and visually dominant. LOCATION and SCENE_ELEMENTS must form one coherent physical setting and explain a practical buyer use at a glance. Do not invent unrelated symbolic objects or turn the scene into an abstract concept.",
    "Follow COMPOSITION precisely with believable scale, perspective, support and object geometry. Preserve clear separation between the hero and supporting elements. Do not add people, crowds, hands, portraits or visible faces.",
    "Use COLOR_PALETTE as actual colored-pen linework and restrained hatched accents, not broad digital paint. Apply HATCHING_STYLE consistently to form, depth and shadow. PAPER_STYLE must remain visible between strokes and continue naturally to every image edge.",
    "No lettering, words, numerals, handwriting, signatures, labels, logos, watermarks, pseudo-text, poster panels, borders, mats, mockups or visible paper edges.",
    "No visible human faces anywhere. Also no people, crowds, hands, human figures, portraits, reflections of people or human images on any surface.",
  ].join("\n");
}

export function buildEditorialPenSketchBatch(date: Date, count = 1): StockImageItem[] {
  if (!Number.isInteger(count) || count < 1 || count > EDITORIAL_PEN_SKETCH_RECIPES.length) throw new Error("Invalid editorial-pen-sketch batch size");
  const pool = [...EDITORIAL_PEN_SKETCH_RECIPES];
  return Array.from({ length: count }, (_, index) => {
    const [title, theme, location, subject, elements, composition, buyer, use, reason] = pool.splice(randomInt(pool.length), 1)[0];
    const fields: EditorialPenSketchStructure = {
      PROJECT_THEME: theme,
      LOCATION: location,
      MAIN_SUBJECT: subject,
      SCENE_ELEMENTS: elements,
      COMPOSITION: composition,
      COLOR_PALETTE: COLOR_PALETTES[randomInt(COLOR_PALETTES.length)],
      HATCHING_STYLE: HATCHING_STYLES[randomInt(HATCHING_STYLES.length)],
      PAPER_STYLE: PAPER_STYLES[randomInt(PAPER_STYLES.length)],
      TEXT_ELEMENTS: "No text",
      MOOD: MOODS[randomInt(MOODS.length)],
    };
    return {
      id: index + 1,
      seoTitle: title + " Editorial Pen Sketch",
      category: "Editorial Pen Sketch Illustration",
      aspectRatio: "3:2",
      composition: "artwork",
      generationMode: "regular_scene",
      isTransparent: false,
      conceptMode: "existing",
      planningSource: "curated_fallback",
      generationBriefVersion: GENERATION_BRIEF_VERSION,
      editorialPenSketchStructure: fields,
      prompt: formatEditorialPenSketchPrompt(fields),
      negativePrompt: "text, letters, numerals, handwriting, signature, label, logo, watermark, pseudo-text, people, hands, visible human face, portrait, photorealism, watercolor wash, oil paint, digital gradient, abstract symbolism, broken geometry, border, mat, poster, mockup, visible paper edge",
      keywords: normalizeStockKeywords([title.toLowerCase(), "editorial sketch", "pen illustration", "colored ink", "cross hatching", "drawing paper", "documentary artwork", "commercial illustration", "text free", "full bleed", "hand drawn", "buyer ready", "visual storytelling", "practical scene", "authentic materials", "clear subject", "publication art"]),
      modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(title, index + 1, date, "regular_scene"),
      commercialIntent: {
        targetBuyer: buyer,
        intendedUse: use,
        purchaseReason: reason + ". The text-free full-bleed pen treatment gives designers a distinctive editorial alternative to ordinary stock photography. This is a buyer-use hypothesis; sales are unverified.",
      },
    };
  });
}
