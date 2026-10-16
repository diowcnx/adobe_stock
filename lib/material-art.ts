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
  ["Skincare Morning Arc", "A fresh start to the daily routine", "one upright unbranded skincare bottle in front of a simple warm-toned semicircular studio reflector suggesting sunrise", "plain frosted skincare bottle and one matte mineral semicircle", "one folded plain cotton pad at the edge", "skincare and beauty advertisers", "morning skincare routine campaign hero", "warm ivory, soft peach and muted sage"],
  ["Sneaker Paper Rhythm", "Everyday forward motion", "one unbranded sneaker beside a single broad folded-paper wave leading forward", "realistic plain sneaker and one wide matte paper strip", "one subtle natural crease line continuing across the surface", "footwear brands and fashion publishers", "new footwear collection campaign", "chalk, muted cobalt and warm gray"],
  ["Linen Cushion Embrace", "Comfort at home", "one plain linen cushion held visually within a broad curved fabric fold resembling an embrace", "woven linen cushion and one continuous cotton fabric length", "one small plain ceramic tray far from the hero", "home textile brands and lifestyle publishers", "home comfort collection campaign", "oat, ivory and warm clay"],
  ["Pencil Focus Beam", "Creative concentration", "one unbranded pencil aligned with a single triangular pool of studio light that guides attention toward its tip", "plain wooden pencil and a matte paper surface", "one restrained paper curl at the distant edge", "stationery brands and education publishers", "creative focus or back-to-study campaign", "graphite, warm wood and pale cream"],
  ["Refill Bottle Path", "The next step in a refill routine", "one unbranded reusable bottle at the end of one broad curved paper path", "plain reusable bottle and a wide paper ribbon", "one plain refill pouch placed quietly behind the bottle with its blank surface turned away", "refill-product brands and household publishers", "refill routine campaign without environmental-performance claims", "sage, ivory and muted sand"],
  ["Watch Quiet Moment", "Making time for a pause", "one unbranded wristwatch with a blank dial resting inside one loose circular fabric fold", "plain wristwatch with no dial markings and soft woven fabric", "one smooth small stone at the distant edge", "accessory brands and lifestyle publishers", "slow-living accessory editorial", "warm silver, taupe and ivory"],
  ["Jewelry Single Loop", "Simple connection", "one plain unbranded ring beside a single continuous curved silk ribbon loop", "a simple unmarked metal ring and one plain silk ribbon", "one small matte mineral support positioned beneath the ribbon", "jewelry brands and fashion art directors", "minimal jewelry campaign or accessories editorial", "muted gold, champagne and warm white"],
  ["Travel Ribbon Journey", "A clear path to the next trip", "one small unbranded travel pouch at the end of a single broad fabric curve suggesting a journey", "plain woven travel pouch and one continuous broad fabric strip", "one blank luggage tag at the edge without lettering or symbols", "travel accessory brands and tourism publishers", "travel essentials campaign", "indigo, natural linen and warm sand"],
] as const;

export function formatMaterialArtPrompt(fields: ThaiEditorialStillLifeStructure, aspectRatio: StockImageItem["aspectRatio"] = "3:2"): string {
  return [
    "[USER_INPUT]", ...Object.entries(fields).map(([key, value]) => key + ": " + value),
    "[ROLE & TASK] Create one original Editorial Still Life commercial studio photograph following all eighteen USER_INPUT fields.",
    "Arrange PRIMARY_COMPONENTS into the single clearly readable CENTRAL_INSTALLATION described by MAIN_CONCEPT. This may be a raw-material artwork or a recognizable hero product with restrained metaphorical staging for advertising, fashion or lifestyle. Preserve the normal shape and realistic scale of products and source materials; do not fuse hardware into products or replace them with unrelated sculptures.",
    "Canvas aspect ratio: " + aspectRatio + ". Adapt object spacing, scale and negative-space placement to this actual canvas. Keep the complete hero visible with breathing room; never crop essential parts, stretch the subject, add letterboxing or inset a smaller photograph.",
    "Keep one simple recognizable shape or flowing arrangement with a strong thumbnail silhouette. No unrelated material piles, intricate symbolic puzzles or extra motifs. Every component must contribute to the named artwork.",
    "Use CAMERA_ANGLE, LENS_TYPE, SHOT_TYPE and LIGHTING as specified. Render MATERIAL_FOCUS with photographic texture, believable joins, natural contact shadows and coherent physical support.",
    "Build BACKGROUND_BASE and BACKGROUND_TEXTURE as one continuous photographed surface reaching every edge. BACKGROUND_DETAILS and both SUPPORTING_ACCENT fields are restrained; include only the explicitly requested accents. COMPOSITION_LOGIC must leave useful natural negative space, not a blank graphic panel.",
    "Follow ATMOSPHERIC_STYLE and COLOR_PALETTE. TEXT_ELEMENTS is No text: do not render words, letters, numbers, lettering-shaped arrangements, labels, logos, signatures or watermarks.",
    "No people, frame, border, inset photograph, poster layout, collage or page mockup. Thai identity may come from the specified ingredient or craft material; do not add unrelated cultural props.",
    NO_VISIBLE_FACE_RULE,
  ].join("\n");
}

export function buildMaterialArtBatch(date: Date, count = 2, selectedAspectRatio?: StockImageItem["aspectRatio"]): StockImageItem[] {
  if (!Number.isInteger(count) || count < 1 || count > MATERIAL_ART_RECIPES.length) throw new Error("Invalid material-art batch size");
  const pool = [...MATERIAL_ART_RECIPES];
  const views = ["direct overhead view", "gently elevated three-quarter view with the full artwork visible"];
  const ratios: StockImageItem["aspectRatio"][] = ["3:2", "16:9", "4:5", "1:1"];
  if (selectedAspectRatio && !ratios.includes(selectedAspectRatio)) throw new Error("Unsupported editorial aspect ratio");
  const backgrounds = [
    ["warm ivory matte mineral studio surface", "fine subtle mineral grain without distracting marks"],
    ["muted warm-gray plaster studio surface", "fine hand-troweled plaster texture with no distracting scratches"],
    ["natural sand-colored paper studio sweep", "restrained paper fibers visible only in close detail"],
  ];
  return Array.from({ length: count }, (_, index) => {
    const [title, theme, artwork, materials, detail, buyer, use, palette] = pool.splice(randomInt(pool.length), 1)[0];
    const isProductStaging = MATERIAL_ART_RECIPES.slice(8).some(recipe => recipe[0] === title);
    const aspectRatio = selectedAspectRatio || ratios[randomInt(ratios.length)];
    const [backgroundBase, backgroundTexture] = backgrounds[randomInt(backgrounds.length)];
    const composition = aspectRatio === "4:5"
      ? "place the complete hero low in the vertical frame, with natural negative space above and safe breathing room on all sides"
      : aspectRatio === "1:1"
        ? "balance the complete hero and one quiet negative-space area within a square, with safe breathing room on every side"
        : "one dominant hero occupying roughly half the scene, with clear natural negative space beside it and safe breathing room for a horizontal crop";
    const fields: ThaiEditorialStillLifeStructure = {
      CAMPAIGN_THEME: theme,
      MAIN_CONCEPT: "Express " + theme.toLowerCase() + " through " + artwork + ", readable at a glance",
      CAMERA_ANGLE: isProductStaging ? "gently elevated frontal three-quarter view preserving the recognizable hero product" : views[randomInt(views.length)],
      LENS_TYPE: "70 mm studio lens, controlled depth of field preserving the whole artwork and detailed material texture",
      SHOT_TYPE: "single editorial advertising still-life photograph",
      LIGHTING: "large diffused softbox from upper left with soft reflected fill and natural contact shadows",
      BACKGROUND_BASE: backgroundBase,
      BACKGROUND_TEXTURE: backgroundTexture,
      BACKGROUND_DETAILS: detail,
      CENTRAL_INSTALLATION: artwork,
      PRIMARY_COMPONENTS: materials,
      SUPPORTING_ACCENT_1: "none; the named background detail is the only supporting object",
      SUPPORTING_ACCENT_2: "none; keep the artwork clear and uncluttered",
      MATERIAL_FOCUS: "credible texture, natural color variation, edges and scale of " + materials,
      COMPOSITION_LOGIC: composition,
      ATMOSPHERIC_STYLE: "refined, tactile, calm and visually understandable",
      COLOR_PALETTE: palette,
      TEXT_ELEMENTS: "No text",
    };
    return {
      id: index + 1, seoTitle: title + " Editorial Still Life", category: "Editorial Still Life",
      aspectRatio, composition: "advertising", generationMode: "regular_scene",
      isTransparent: false, conceptMode: "existing", planningSource: "curated_fallback",
      generationBriefVersion: GENERATION_BRIEF_VERSION, materialArtStructure: fields,
      prompt: formatMaterialArtPrompt(fields, aspectRatio),
      negativePrompt: "visible human face, people, lettering, text, logo, watermark, unrelated props, intricate object pile, multiple motifs, hardware fusion, border, frame, poster layout",
      keywords: [title.toLowerCase(), theme.toLowerCase(), "editorial still life", "creative still life", "commercial photography", "physical arrangement", "tactile texture", "material detail", "studio lighting", "copy space", "single composition", "minimal arrangement", "surface detail", "natural shadows", "creative campaign", "unbranded", "advertising visual", "original arrangement"],
      modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(title, index + 1, date, "regular_scene"),
      commercialIntent: {
        targetBuyer: buyer, intendedUse: use,
        purchaseReason: "A clear editorial arrangement connects " + theme.toLowerCase() + " with recognizable objects, tactile studio detail and useful space for later typography. This is a buyer-use hypothesis; sales are unverified.",
      },
    };
  });
}
