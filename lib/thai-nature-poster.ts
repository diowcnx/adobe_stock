import { randomInt } from "node:crypto";
import type { StockImageItem, ThaiNaturePosterStructure } from "./types";
import { AERIAL_NO_VISIBLE_FACE_RULE, GENERATION_BRIEF_VERSION } from "./generation-policy";
import { generateUniqueStockFilename, normalizeStockKeywords } from "./csv";

export const THAI_NATURE_POSTER_RECIPES = [
  ["Siam Tulip Rain Meadow", "Rain-season Siam tulip meadow in Pa Hin Ngam, Chaiyaphum, with misty northeastern Thai hills", "broad magenta-pink flower bands rolling across fresh green meadow slopes toward layered blue-gray hills", "one narrow ochre footpath with two minuscule faceless visitors seen from behind as simple color marks", "one wind-shaped native tree at the meadow crest", "Thai tourism publishers, botanical campaigns and hospitality brands", "seasonal destination campaign, botanical editorial or travel cover", "recognizable Siam tulips and monsoon highland atmosphere give the scene a specific Thai seasonal identity"],
  ["Golden Lotus Wetland", "Golden lotus wetland at dawn in southern Thailand with calm water and low tropical hills", "wide gold-yellow lotus bands and blue-green water channels layered across the wetland", "one gently curving wooden walkway with a tiny empty woven basket resting near the foreground", "one simple open-sided Thai wetland shelter on short posts", "eco-tourism publishers, conservation groups and wellness brands", "wetland travel editorial, nature campaign or calming hospitality artwork", "lotus fields, water channels and a modest local shelter communicate a clear wetland experience"],
  ["Mae Hong Son Sunflower Hills", "Wild sunflower hills in Mae Hong Son under clear late-year mountain light", "sweeping yellow flower ribbons following steep moss-green mountain contours", "one narrow red-earth trail with three tiny faceless hikers shown only as distant back-facing marks", "one small timber viewpoint pavilion on a ridge", "outdoor brands, mountain resorts and travel publishers", "hiking campaign, seasonal destination feature or nature poster", "the yellow hillside bloom and mountain pavilion make the northern Thai season immediately legible"],
  ["Chiang Mai Chrysanthemum Valley", "Chrysanthemum flower farm valley near Chiang Mai with soft northern mountain layers", "curved white and pale-yellow flower beds alternating with muted green cultivation bands", "one winding farm lane with a tiny unbranded utility cart and no visible driver", "one modest wooden flower-drying barn beside the central beds", "floral brands, rural tourism campaigns and garden publishers", "flower-origin story, northern destination editorial or botanical campaign", "ordered chrysanthemum bands and the working barn create a readable flower-farm narrative"],
  ["Udon Red Lotus Lake", "Red lotus lake in Udon Thani at first light with broad open water and distant reed islands", "floating rose-red lotus ribbons separated by calm indigo and turquoise water lanes", "one slim wooden boat without branding, seen at a distance with a single tiny back-facing figure", "one compact reed-roof landing shelter at the water edge", "travel publishers, regional hospitality and nature organizations", "lake destination campaign, wetland feature or cultural travel artwork", "the expansive red lotus bloom and small local boat establish the famous wetland character without text"],
  ["Lopburi Sunflower Plain", "Sunflower plain in Lopburi beneath limestone hills and bright dry-season sky", "bold golden flower bands flowing across warm green fields toward pale limestone silhouettes", "one curved farm track with a tiny plain bicycle parked beside it and no people", "one solitary tamarind tree casting a long violet shadow", "agricultural publishers, food brands and domestic tourism campaigns", "ingredient-origin editorial, rural destination campaign or seasonal artwork", "sunflower bands, limestone horizon and tamarind landmark create an unmistakable central-Thai landscape"],
  ["Nan Rice Flower Mosaic", "Rice fields and small flowering field edges in Nan province during the green season", "layered emerald rice ribbons edged with tiny white and yellow wildflower bands across a mountain basin", "one S-curve footpath with two minuscule farmers shown only as featureless overhead color marks", "one raised bamboo field hut near the visual center", "food-origin publishers, sustainable agriculture campaigns and boutique hotels", "rice-origin story, rural editorial or regional hospitality artwork", "rice geometry, wildflower edges and a bamboo hut give buyers a clear cultivated-landscape story"],
  ["Khao Yai Cosmos Meadow", "Cosmos meadow near Khao Yai with forested ridges and cool early-morning haze", "airy pink, white and coral flower ribbons layered over soft green meadow contours", "one pale gravel path curving toward the horizon with a tiny empty wooden bench", "one broad-canopy rain tree at the path bend", "wellness brands, park campaigns and lifestyle publishers", "slow-travel campaign, seasonal nature feature or calming wall artwork", "cosmos color bands, forest ridges and the bench provide a welcoming, commercially flexible scene"],
  ["Nakhon Ratchasima Hydrangea Garden", "Highland hydrangea garden in northeastern Thailand after light rain", "rounded blue, lavender and blush flower masses stepping down gentle dark-green terraces", "one narrow stone walkway with no people and scattered rain-darkened edges", "one small glasshouse with plain unmarked panels at the upper terrace", "garden publishers, beauty brands and countryside hospitality", "botanical color campaign, garden editorial or rainy-season retreat visual", "recognizable hydrangea terraces and a restrained glasshouse give the illustration a clear destination purpose"],
  ["Phu Ruea Poinsettia Terraces", "Cool-season poinsettia terraces in Loei with distant misty mountains", "deep red and warm cream planting ribbons alternating across sage-green hill contours", "one gently rising farm path with a tiny unbranded handcart and no people", "one simple timber shade house on the upper slope", "holiday campaigns, plant nurseries and mountain tourism publishers", "seasonal botanical campaign, nursery editorial or winter destination artwork", "red poinsettia bands and misty highland terrain communicate a useful Thai cool-season story"],
  ["Krabi Beach Morning Glory", "Tropical beach morning-glory flowers along a quiet Krabi shore with limestone islands", "violet flower drifts crossing pale sand ribbons toward turquoise water and layered karst silhouettes", "one natural sand trail with a small empty woven beach mat placed far from the water", "one leaning sea-almond tree framing the central shoreline", "coastal resorts, wellness brands and travel publishers", "beach campaign, tropical nature editorial or hospitality wall art", "native beach flowers, karst horizon and sea-almond tree anchor the scene in southern Thailand"],
  ["Doi Ang Khang Peach Blossom", "Peach blossom orchard at Doi Ang Khang under crisp northern morning light", "soft pink-white blossom rows curving across terraced cool-green slopes", "one narrow orchard path with a tiny plain wooden crate and no people", "one compact hill-farm cabin with a muted terracotta roof", "produce brands, mountain hospitality and seasonal travel publishers", "orchard-origin story, spring destination campaign or botanical editorial", "blossom terraces, highland cabin and cool mountain layers make the agricultural season understandable at a glance"],
] as const;

const MEDIA = [
  "Hand-painted opaque poster color with visible dry-brush edges, delicate chalky layering and authentic warm vintage paper fibers across the full image",
  "Traditional poster-paint illustration with matte opaque color shapes, subtle bristle variation and softly aged uncoated paper grain",
  "Layered hand-painted poster color with restrained stippling, lightly weathered pigment edges and tactile cream vintage-paper texture",
] as const;

const LIGHTING = [
  "Clear early-morning light from the right, gentle mist, long coherent cool-violet shadows and an inviting nostalgic travel mood",
  "Warm late-afternoon light from upper left, softly lengthened shadows and an optimistic vintage tourism mood",
  "Diffused post-rain daylight with luminous flowers, quiet blue-gray shadows and a fresh contemplative mood",
] as const;

const PALETTES = [
  "muted leaf green, botanical pink, warm ochre, dusty turquoise and vintage cream with restrained indigo shadows",
  "meadow green, marigold yellow, coral, pale sky blue and aged ivory with soft violet shadow accents",
  "deep teal, moss, faded rose, clay orange and warm paper beige with desaturated blue-gray distance",
] as const;

export function formatThaiNaturePosterPrompt(fields: ThaiNaturePosterStructure): string {
  const visualFields = Object.entries(fields).filter(([key]) => key !== "TYPOGRAPHY_OVERLAY");
  return [
    "[VISUAL_USER_INPUT]", ...visualFields.map(([key, value]) => key + ": " + value),
    "[ROLE & TASK] Create one original full-bleed hand-painted poster color landscape of Thai nature and flower fields. TYPOGRAPHY_OVERLAY is a non-visual control fixed to None (Text-free).",
    "Compose a scenic gently elevated panoramic view, not a top-down plan. Use AERIAL_TERRAIN_RIBBONS only as natural overlapping hill, meadow, field, water or flower bands that follow plausible terrain and lead the eye into depth. The result must read immediately as a beautiful real landscape, never as a map, masterplan, site plan, satellite image, infographic or diagram.",
    "Make the named Thai flowers, vegetation, landform and season visually accurate and dominant. Do not invent a famous landmark or mix incompatible regions. Keep the Thai identity natural through geography, plants, farm details and modest local structures rather than flags, temples, costumes or decorative symbols.",
    "Place WINDING_PATH_AND_SUBJECTS as a believable route through the landscape. People are optional scale marks only and must remain extremely small, featureless and fully faceless; never make a person the subject.",
    "Use one clearly grounded FOCAL_LANDMARK_ELEMENT as a compositional anchor. Preserve coherent scale, perspective, light and shadow. Do not add a second landmark or floating structure.",
    "Make the poster color brushwork and vintage paper texture visibly handcrafted while keeping flower species, route and landmark readable. The paper grain is integrated across the painted image, not a blank border, frame, page, poster mockup or aged margin.",
    "Fill every edge with continuous painted scenery. No border, mat, blank margin, title panel, letters, words, numerals, pseudo-text, logo, signature, watermark, legend, compass, pin, route symbol, scale bar or label.",
    AERIAL_NO_VISIBLE_FACE_RULE,
  ].join("\n");
}

export function buildThaiNaturePosterBatch(date: Date, count = 1): StockImageItem[] {
  if (!Number.isInteger(count) || count < 1 || count > THAI_NATURE_POSTER_RECIPES.length) throw new Error("Invalid Thai-nature-poster batch size");
  const pool = [...THAI_NATURE_POSTER_RECIPES];
  return Array.from({ length: count }, (_, index) => {
    const [title, theme, terrain, path, landmark, buyer, use, reason] = pool.splice(randomInt(pool.length), 1)[0];
    const fields: ThaiNaturePosterStructure = {
      SCENE_THEME: theme,
      AERIAL_TERRAIN_RIBBONS: terrain,
      WINDING_PATH_AND_SUBJECTS: path,
      FOCAL_LANDMARK_ELEMENT: landmark,
      ARTISTIC_MEDIUM_AND_TEXTURE: MEDIA[randomInt(MEDIA.length)],
      COLOR_HARMONY_AND_PALETTE: PALETTES[randomInt(PALETTES.length)],
      TYPOGRAPHY_OVERLAY: "None (Text-free)",
      LIGHTING_AND_MOOD: LIGHTING[randomInt(LIGHTING.length)],
    };
    return {
      id: index + 1,
      seoTitle: title + " Hand Painted Thai Landscape",
      category: "Thai Nature Poster Illustration",
      aspectRatio: "3:2",
      composition: "artwork",
      generationMode: "regular_scene",
      isTransparent: false,
      conceptMode: "existing",
      planningSource: "curated_fallback",
      generationBriefVersion: GENERATION_BRIEF_VERSION,
      thaiNaturePosterStructure: fields,
      prompt: formatThaiNaturePosterPrompt(fields),
      negativePrompt: "visible human face, portrait, detailed person, text, lettering, numeral, pseudo-text, logo, signature, watermark, map, masterplan, site plan, satellite image, infographic, diagram, legend, compass, pin, route symbol, border, mat, paper margin, title panel, poster mockup, photorealism, collage, floating structure, incompatible Thai regions",
      keywords: normalizeStockKeywords([title.toLowerCase(), "thailand nature", "thai landscape", "flower field", "poster color", "hand painted", "vintage paper", "botanical art", "travel illustration", "scenic meadow", "terrain bands", "winding path", "seasonal flowers", "rural thailand", "full bleed", "text free", "commercial illustration", "tourism artwork"]),
      modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(title, index + 1, date, "regular_scene"),
      commercialIntent: {
        targetBuyer: buyer,
        intendedUse: use,
        purchaseReason: reason + ". The full-bleed text-free composition supports covers, campaigns, packaging backgrounds and hospitality decor. This is a buyer-use hypothesis; sales are unverified.",
      },
    };
  });
}
