import { randomInt } from "node:crypto";
import type { StockImageItem, ThaiEditorialStillLifeStructure } from "./types";
import { GENERATION_BRIEF_VERSION, NO_VISIBLE_FACE_RULE } from "./generation-policy";
import { generateUniqueStockFilename } from "./csv";

export const MATERIAL_ART_RECIPES = [
  ["Citrus Slice Sunrise", "Fresh morning flavor", "a simple half-sun silhouette made from overlapping citrus slices", "fresh lime and orange slices with visible pulp", "one small plain ceramic dish at the far edge", "beverage brands and breakfast publishers", "refreshing morning drink campaign", "citrus orange, lime green and warm ivory"],
  ["Coffee Bean Ripple", "A calm coffee ritual", "three clearly spaced concentric ripple rings made from whole roasted coffee beans", "roasted coffee beans with natural center creases", "one small unbranded ceramic cup placed quietly at the edge", "coffee roasters and cafe marketers", "coffee ritual article or cafe campaign", "coffee brown, warm cream and muted clay"],
  ["Thai Silk Wave", "Tactile flow and textile craftsmanship", "one broad continuous wave formed from a folded unpatterned Thai silk length", "plain woven Thai silk with visible slubs and restrained sheen", "one small plain wooden spool at the frame edge", "textile designers and fashion publishers", "textile collection launch or material-story opener", "muted indigo, ivory and warm wood"],
  ["Bamboo Leaf Relief", "Nature through craft", "one immediately recognizable leaf silhouette formed from broad bamboo strips on a flat surface", "wide smooth bamboo strips with natural grain", "one short unshaped bamboo offcut at the edge for material context", "craft brands and interior-design publishers", "craftsmanship campaign or natural-material editorial", "bamboo gold, sage and warm sand"],
  ["Clay Circle Study", "Handcrafted material balance", "one large simple open circle formed from three broad unglazed clay segments", "matte terracotta clay with subtle pores and hand-shaped edges", "one small plain ceramic bowl placed at the far edge", "ceramic studios and homeware publishers", "ceramic collection campaign or studio article", "terracotta, chalk and warm gray"],
  ["Petal Color Ribbon", "Botanical softness", "one broad gently curving ribbon of overlapping flower petals arranged in a readable color gradient", "orchid petals with natural veins and subtle translucency", "one plain shallow dish with a few matching petals at the edge", "beauty brands and floral designers", "botanical beauty campaign or floral-design editorial", "orchid pink, muted violet and soft cream"],
  ["Rice Terrace Rhythm", "The care behind an everyday ingredient", "three broad clearly separated curved terrace bands made from rice grains", "uncooked rice grains with realistic scale and natural variation", "one small plain rice bowl at the edge", "food publishers and rice producers", "rice ingredient campaign or food-origin article", "rice ivory, straw and warm brown"],
  ["Seedling Seed Silhouette", "Small beginnings", "one clearly recognizable sprouting-seed silhouette formed from a compact arrangement of whole seeds", "whole dark and pale seeds sorted into two simple shapes", "one plain small wooden scoop near the edge", "garden educators and seed suppliers", "seed-growing campaign or beginner gardening article", "seed brown, cream and muted moss"],
] as const;

export function formatMaterialArtPrompt(fields: ThaiEditorialStillLifeStructure): string {
  return [
    "[USER_INPUT]", ...Object.entries(fields).map(([key, value]) => key + ": " + value),
    "[ROLE & TASK] Create one original material-art commercial still-life photograph following all eighteen USER_INPUT fields.",
    "Turn PRIMARY_COMPONENTS into the single clearly readable CENTRAL_INSTALLATION described by MAIN_CONCEPT. It is a deliberately staged physical artwork, not a food-hardware fusion, building, exhibition booth, diagram or drawing. Preserve the identity and realistic scale of the source materials.",
    "Keep one simple recognizable shape or flowing arrangement with a strong thumbnail silhouette. No unrelated material piles, intricate symbolic puzzles or extra motifs. Every component must contribute to the named artwork.",
    "Use CAMERA_ANGLE, LENS_TYPE, SHOT_TYPE and LIGHTING as specified. Render MATERIAL_FOCUS with photographic texture, believable joins, natural contact shadows and coherent physical support.",
    "Build BACKGROUND_BASE and BACKGROUND_TEXTURE as one continuous photographed surface reaching every edge. BACKGROUND_DETAILS and both SUPPORTING_ACCENT fields are restrained; include only the explicitly requested accents. COMPOSITION_LOGIC must leave useful natural negative space, not a blank graphic panel.",
    "Follow ATMOSPHERIC_STYLE and COLOR_PALETTE. TEXT_ELEMENTS is No text: do not render words, letters, numbers, lettering-shaped arrangements, labels, logos, signatures or watermarks.",
    "No people, frame, border, inset photograph, poster layout, collage or page mockup. Thai identity may come from the specified ingredient or craft material; do not add unrelated cultural props.",
    NO_VISIBLE_FACE_RULE,
  ].join("\n");
}

export function buildMaterialArtBatch(date: Date, count = 2): StockImageItem[] {
  if (!Number.isInteger(count) || count < 1 || count > MATERIAL_ART_RECIPES.length) throw new Error("Invalid material-art batch size");
  const pool = [...MATERIAL_ART_RECIPES];
  const views = ["direct overhead view", "gently elevated three-quarter view with the full artwork visible"];
  return Array.from({ length: count }, (_, index) => {
    const [title, theme, artwork, materials, detail, buyer, use, palette] = pool.splice(randomInt(pool.length), 1)[0];
    const fields: ThaiEditorialStillLifeStructure = {
      CAMPAIGN_THEME: theme,
      MAIN_CONCEPT: "Transform the named raw material into " + artwork + ", readable at a glance",
      CAMERA_ANGLE: views[randomInt(views.length)],
      LENS_TYPE: "70 mm studio lens, controlled depth of field preserving the whole artwork and detailed material texture",
      SHOT_TYPE: "single editorial advertising still-life photograph",
      LIGHTING: "large diffused softbox from upper left with soft reflected fill and natural contact shadows",
      BACKGROUND_BASE: "warm ivory matte mineral studio surface",
      BACKGROUND_TEXTURE: "fine subtle mineral grain without distracting marks",
      BACKGROUND_DETAILS: detail,
      CENTRAL_INSTALLATION: artwork,
      PRIMARY_COMPONENTS: materials,
      SUPPORTING_ACCENT_1: "none; the named background detail is the only supporting object",
      SUPPORTING_ACCENT_2: "none; keep the artwork clear and uncluttered",
      MATERIAL_FOCUS: "credible texture, natural color variation, edges and scale of " + materials,
      COMPOSITION_LOGIC: "one dominant artwork occupying roughly half the scene with clear natural negative space beside it for later buyer typography",
      ATMOSPHERIC_STYLE: "refined, tactile, calm and visually understandable",
      COLOR_PALETTE: palette,
      TEXT_ELEMENTS: "No text",
    };
    return {
      id: index + 1, seoTitle: title + " Material Art Still Life", category: "Material Art Still Life",
      aspectRatio: "3:2", composition: "advertising", generationMode: "regular_scene",
      isTransparent: false, conceptMode: "existing", planningSource: "curated_fallback",
      generationBriefVersion: GENERATION_BRIEF_VERSION, materialArtStructure: fields,
      prompt: formatMaterialArtPrompt(fields),
      negativePrompt: "visible human face, people, lettering, text, logo, watermark, unrelated props, intricate object pile, multiple motifs, hardware fusion, border, frame, poster layout",
      keywords: [title.toLowerCase(), theme.toLowerCase(), "material art", "creative still life", "commercial photography", "physical artwork", "tactile texture", "natural materials", "studio lighting", "copy space", "single composition", "minimal arrangement", "surface detail", "natural shadows", "creative campaign", "unbranded", "advertising visual", "original arrangement"],
      modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(title, index + 1, date, "regular_scene"),
      commercialIntent: {
        targetBuyer: buyer, intendedUse: use,
        purchaseReason: "A clear material-built motif connects " + theme.toLowerCase() + " with a tactile campaign image and useful space for later typography. This is a buyer-use hypothesis; sales are unverified.",
      },
    };
  });
}
