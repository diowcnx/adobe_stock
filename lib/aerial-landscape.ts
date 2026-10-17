import { randomInt } from "node:crypto";
import type { AerialLandscapeStructure, StockImageItem } from "./types";
import { AERIAL_NO_VISIBLE_FACE_RULE, GENERATION_BRIEF_VERSION } from "./generation-policy";
import { generateUniqueStockFilename, normalizeStockKeywords } from "./csv";

export const AERIAL_LANDSCAPE_RECIPES = [
  ["Northern Thai Tea Hills", "Rhythmic tea-growing landscape in the northern Thai highlands", "broad curved tea rows wrapping rolling hills in layered green ribbons with narrow ochre soil seams", "one pale winding farm road with a tiny unbranded pickup and three extremely small faceless workers seen only as overhead color marks", "one simple hilltop tea shelter near center with a long diagonal shadow", "travel publishers, tea brands and regional campaign designers", "destination editorial, tea-origin story or agricultural campaign", "terraced crop rhythm and one small shelter communicate cultivated highland identity"],
  ["Rice Terrace Water Ribbons", "Seasonal Thai rice terraces shaped by water and cultivation", "sweeping flooded rice bands with reflective blue-green curves, young chartreuse shoots and warm earthen dividers", "one narrow footpath carrying two tiny faceless top-down figures and a small plain farm cart", "one compact field hut on a raised terrace casting a crisp afternoon shadow", "rice producers, food publishers and tourism art directors", "ingredient-origin campaign, farming article or rural travel visual", "water, seedlings and terrace geometry make rice cultivation immediately recognizable"],
  ["Mangrove Conservation Mosaic", "Coastal mangrove restoration landscape and community access", "organic tidal channels interlacing dark mangrove-green islands and pale wet-sand ribbons", "one winding raised boardwalk with four minuscule faceless overhead visitors and one tiny unbranded utility boat", "one elevated circular observation deck near center casting a readable shadow across the canopy", "conservation publishers, coastal planners and travel campaigns", "mangrove education, coastal conservation story or eco-tourism feature", "tidal channels and the observation deck clearly communicate wetland access"],
  ["Salt Farm Geometry", "Traditional coastal salt-production landscape under bright dry-season light", "curved and angular evaporation ponds forming pale aqua, blush and white mineral ribbons", "one narrow service track with a tiny plain truck and three minuscule faceless workers reduced to overhead silhouettes", "one small pyramidal salt mound at the central pond edge with a long clean shadow", "food-origin publishers, travel brands and agricultural editors", "sea-salt origin story, regional feature or ingredient campaign", "mineral ponds and a salt mound make the production landscape legible"],
  ["Vineyard Harvest Curves", "Autumn vineyard landscape organized by flowing contour rows", "burgundy, olive and ochre vine rows bending across gentle slopes as broad parallel ribbons", "one serpentine gravel lane with a tiny unbranded harvest tractor and four very small faceless pickers viewed from directly above", "one simple stone harvest pavilion at the visual center with an elongated late-day shadow", "wine publishers, hospitality brands and destination marketers", "harvest editorial, vineyard campaign or culinary travel feature", "vine rows, harvest subjects and pavilion create a clear seasonal story"],
  ["Wind Energy Farmland", "Agricultural landscape sharing space with clean-energy infrastructure", "large curving crop fields in wheat gold, sage and muted green separated by smooth contour bands", "one winding maintenance road with a tiny plain service vehicle and two minuscule faceless technicians seen from above", "one elegant white wind turbine near center with a strong blade-and-tower shadow across the field", "energy publishers, infrastructure consultants and sustainability campaigns", "renewable-energy editorial, infrastructure report cover or agriculture story", "one turbine and productive fields communicate shared land use without performance claims"],
  ["Orchard Irrigation Flow", "Productive tropical orchard shaped by water management", "rounded orchard blocks and narrow irrigation channels flowing in alternating deep green and turquoise ribbons", "one curved farm lane with a tiny unbranded utility cart and three extremely small faceless orchard workers", "one circular water reservoir near center with a single tall shade tree casting a long shadow", "agriculture publishers, produce brands and landscape designers", "fruit-origin campaign, irrigation article or farm-planning editorial", "orchard rows, reservoir and service path show a coherent working landscape"],
  ["Highland Cycling Route", "Scenic highland road journey through layered natural terrain", "flowing mountain-meadow bands in moss green, muted gold and cool slate following broad contours", "one narrow switchback road with three tiny faceless cyclists seen only as overhead silhouettes and one small plain support vehicle", "one compact lookout pavilion on a ridge near center with a dramatic side shadow", "outdoor brands, tourism publishers and route planners", "cycling destination campaign, route feature or adventure editorial", "the switchback, cyclists and lookout make the travel activity instantly readable"],
  ["River Wetland Bird Habitat", "Protected river wetland with habitat islands and quiet visitor access", "meandering blue river ribbons surrounding reed-green islands, mudflat ochre curves and shallow lagoons", "one slim boardwalk with three minuscule faceless overhead visitors and no vehicles", "one simple bird-observation hide at center-right casting a crisp shadow onto reeds", "wildlife publishers, conservation organizations and eco-tourism campaigns", "wetland education, habitat story or nature-travel campaign", "river channels, reeds and observation hide clearly signal a bird habitat"],
  ["Desert Geology Road", "Remote geological landscape crossed by one scenic road", "sweeping sandstone strata in rust, peach and cream forming broad eroded ribbons around dry gullies", "one dark winding road with a tiny unbranded car and two minuscule faceless figures at a pull-off, viewed from high overhead", "one isolated balanced rock near center with a long cool-violet shadow", "travel publishers, automotive creatives and geology educators", "road-trip campaign, geology feature or destination poster background", "bold strata, road and rock landmark make the route narrative clear"],
  ["Lavender Farm Pathways", "Flower-growing landscape with graphic seasonal color bands", "soft violet lavender rows curving between sage-green buffer strips and pale dry-grass ribbons", "one cream gravel path with a tiny plain farm cart and three extremely small faceless workers as overhead color marks", "one small stone distillation shed near center casting a warm directional shadow", "beauty brands, fragrance publishers and rural tourism marketers", "botanical ingredient story, fragrance campaign or seasonal travel feature", "lavender bands and a distillation shed connect crop to buyer use"],
  ["Floodplain Adaptation Fields", "Climate-adaptive agricultural floodplain organized around seasonal water", "broad crop ribbons stepping around pale blue retention basins, reed buffers and raised earthen bands", "one raised winding access road with a tiny unbranded farm vehicle and two minuscule faceless overhead workers", "one elevated refuge pavilion near center with a long shadow crossing a water basin", "climate publishers, planning organizations and agricultural educators", "adaptation editorial, resilience report cover or landscape-planning story", "raised access, retention basins and refuge pavilion show adaptation without technical claims"],
] as const;

const MEDIA = [
  "Layered gouache with dry-brush edges, soft chalk-pastel transitions and fine stippled grain; painterly but geographically coherent",
  "Opaque gouache terrain shapes, restrained chalk-pastel shading and delicate stippled texture visible across broad color fields",
  "Hand-painted gouache bands with dusty chalk-pastel highlights and subtle stippled paper grain, no photorealistic rendering",
] as const;

const LIGHTING = [
  "Warm low afternoon light from upper left, long coherent shadows and a calm optimistic editorial mood",
  "Clear early-morning light from the right, cool-to-warm shadow contrast and a fresh contemplative mood",
  "Soft golden-hour light from lower left, elongated shadows and a quiet cinematic travel mood",
] as const;

const PALETTES = [
  "moss green, sage, muted ochre and dusty cyan, contrasted with coral accents and cool violet shadows",
  "olive, terracotta, pale turquoise and warm cream, contrasted with muted crimson accents and blue-gray shadows",
  "deep teal, meadow green, sand and clay, contrasted with soft saffron accents and desaturated indigo shadows",
] as const;

export function formatAerialLandscapePrompt(fields: AerialLandscapeStructure): string {
  const visualFields = Object.entries(fields).filter(([key]) => key !== "TYPOGRAPHY_OVERLAY");
  return [
    "[VISUAL_USER_INPUT]", ...visualFields.map(([key, value]) => key + ": " + value),
    "[ROLE & TASK] Create one original full-bleed aerial landscape artwork following the seven visual input fields; TYPOGRAPHY_OVERLAY is a non-visual control fixed to None (Text-free).",
    "Use a high bird's-eye oblique viewpoint bordering on top-down. AERIAL_TERRAIN_RIBBONS must remain broad, flowing and geographically connected, following plausible elevation, water or cultivated contours. The image is a landscape illustration, not a map, masterplan, infographic, satellite photograph or collage.",
    "Place WINDING_PATH_AND_SUBJECTS naturally through the terrain. Vehicles remain tiny, intact and unbranded. Human subjects are optional scale cues only: render them as extremely small, featureless top-down silhouettes or color marks with no face, profile, limbs, clothing detail or portrait anatomy. Never enlarge a person into a subject.",
    "Make FOCAL_LANDMARK_ELEMENT the single clear visual anchor near the central region. It must sit physically on the terrain and cast one coherent shadow matching LIGHTING_AND_MOOD. Do not add a second landmark, floating structure or impossible shadow direction.",
    "Apply ARTISTIC_MEDIUM_AND_TEXTURE visibly across the artwork while preserving readable roads, terrain bands and landmark geometry. Use COLOR_HARMONY_AND_PALETTE with restrained natural harmony, one controlled contrast and coherent shadow color.",
    "Fill every edge with painted terrain. No border, paper margin, poster layout, legend, compass, pin, route label, map symbol, icon, scale bar, lettering, numeral, logo, watermark or pseudo-text.",
    AERIAL_NO_VISIBLE_FACE_RULE,
  ].join("\n");
}

export function buildAerialLandscapeBatch(date: Date, count = 1): StockImageItem[] {
  if (!Number.isInteger(count) || count < 1 || count > AERIAL_LANDSCAPE_RECIPES.length) throw new Error("Invalid aerial-landscape batch size");
  const pool = [...AERIAL_LANDSCAPE_RECIPES];
  return Array.from({ length: count }, (_, index) => {
    const [title, theme, terrain, path, landmark, buyer, use, reason] = pool.splice(randomInt(pool.length), 1)[0];
    const fields: AerialLandscapeStructure = {
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
      seoTitle: title + " Painterly Aerial Landscape",
      category: "Aerial Landscape Illustration",
      aspectRatio: "3:2",
      composition: "artwork",
      generationMode: "regular_scene",
      isTransparent: false,
      conceptMode: "existing",
      planningSource: "curated_fallback",
      generationBriefVersion: GENERATION_BRIEF_VERSION,
      aerialLandscapeStructure: fields,
      prompt: formatAerialLandscapePrompt(fields),
      negativePrompt: "visible human face, portrait, detailed person, large person, text, lettering, numeral, map label, legend, compass, pin, route symbol, logo, watermark, border, paper margin, poster, satellite photo, photorealism, collage, floating landmark, conflicting shadows",
      keywords: normalizeStockKeywords([title.toLowerCase(), "aerial landscape", "terrain ribbons", "winding path", "gouache illustration", "chalk pastel", "stippled grain", "bird eye view", "painterly terrain", "landmark shadow", "travel artwork", "environment editorial", "topographic rhythm", "faceless figures", "full bleed", "text free", "original landscape", "commercial illustration"]),
      modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(title, index + 1, date, "regular_scene"),
      commercialIntent: {
        targetBuyer: buyer,
        intendedUse: use,
        purchaseReason: reason + ". Flowing terrain bands and a text-free full-bleed composition leave flexible use for editorial design. This is a buyer-use hypothesis; sales are unverified.",
      },
    };
  });
}
