import { randomInt } from "node:crypto";
import type { ResortMasterplanStructure, StockImageItem } from "./types";
import { GENERATION_BRIEF_VERSION, NO_VISIBLE_FACE_RULE } from "./generation-policy";
import { generateUniqueStockFilename } from "./csv";

export const MASTERPLAN_RECIPES = [
  ["Thai Hillside Family Waterpark Resort", "gentle Thai foothill terrain with one clearly organized family resort", "a central shallow family lagoon, compact slide tower and separate lap pool", "small low-rise villas following contour terraces"],
  ["Thai Riverside Leisure Resort", "a compact riverside Thai retreat with a protected planted river edge", "a curved pool court, small splash garden and shaded leisure deck set back from the river", "low timber-clad villas arranged along an inland circulation loop"],
  ["Thai Tropical Garden Water Resort", "a low-density tropical garden resort organized around one central water court", "a turquoise leisure pool, short lazy-river loop and a small children's splash zone", "pitched-roof garden villas and one low reception pavilion"],
  ["Thai Mountain Valley Wellness Retreat", "a quiet Thai mountain-valley resort with generous landscape separation", "a calm aqua pool, small shallow water garden and yoga terrace", "compact villas clustered around pedestrian courtyards"],
  ["Thai Coastal Family Holiday Resort", "a Thai coastal family resort behind a planted dune buffer", "two linked leisure pools, a compact slide zone and a shaded family deck", "low-rise villas and a simple central clubhouse"],
  ["Thai Woodland Eco Lodge Concept", "a Thai woodland lodge concept using clustered buildings and preserved canopy corridors", "a small leisure pool, children’s splash pad and shaded walking loop", "small pitched-roof lodges on gently stepping terraces"],
  ["Thai Orchard Leisure Park", "a Thai orchard-inspired leisure resort with readable garden and hospitality zones", "a central swimming lagoon, small splash garden and outdoor picnic court", "low-rise guest cottages with restrained terracotta roofs"],
  ["Thai Terraced Lagoon Resort", "a Thai terraced resort with a clear hierarchy of pools, guest areas and planted slopes", "three softly connected pool terraces, a small slide and one open activity lawn", "small villas stepping up a gentle slope with a central shared pavilion"],
  ["Thai School Campus", "a Thai low-rise school campus organized around shaded learning courtyards", "a multipurpose sports court, outdoor learning garden and shaded playground; no swimming pool or waterpark", "classroom blocks, a library pavilion and one covered dining hall"],
  ["Thai Community Wellness Park", "a Thai neighborhood wellness park with accessible paths and clear activity zones", "gentle exercise stations, a shaded walking loop and an open community lawn; no water slides or resort pool", "a small wellness pavilion, open rest shelters and public facilities"],
  ["Thai Creative Business Campus", "a Thai low-rise office campus with pedestrian-first internal circulation", "shared garden courtyards, an outdoor meeting terrace and one small rain garden; no waterpark", "low-rise workspaces, a shared cafe pavilion and a separate service building"],
  ["Thai Senior Living Community", "a Thai low-rise senior-living community with compact clusters and continuous accessible routes", "a sensory garden, shaded exercise court and sheltered walking loop; no water slides", "single-story residences, a shared dining pavilion and a small care-services building"],
] as const;

export function formatResortMasterplanPrompt(fields: ResortMasterplanStructure): string {
  return [
    "[USER_INPUT]", ...Object.entries(fields).map(([key, value]) => key + ": " + value),
    "[ROLE & TASK] Create one professional architectural project masterplan sketch illustration based strictly on USER_INPUT.",
    "Follow VIEW_AND_PERSPECTIVE: a single coherent elevated bird's-eye oblique masterplan, not a frontal building elevation. Keep the complete project boundary and all major zones visible with consistent scale and spatial relationships.",
    "Use LINEWORK_AND_TINT_STYLE throughout: fine hand-drawn graphite and ink contours with sparse pale watercolor tints only at water, roofs and planting. Preserve plentiful unpainted warm-white paper. This is an architectural sketch, not a photorealistic aerial photograph or a saturated 3D render.",
    "Compose WATERPARK_AND_AMENITY_ZONE, ACCOMMODATION_AND_STRUCTURES and LANDSCAPE_AND_TERRAIN into one legible site. Adapt these fields to the project category: the amenity field may describe gardens, sports or learning facilities without water; the structures field may describe classrooms, offices or homes instead of villas. Add pools and slides ONLY when explicitly included in USER_INPUT. Separate buildings, amenities, circulation and planting with plausible access and terrain.",
    "PROJECT_TITLE is metadata for a designer only. Preserve its requested position as quiet unmarked paper, not a boxed title area. Render no title, words, letters, numbers, legend, scale bar, labels, arrows, logos, watermark or pseudo-text.",
    "The paper texture continues naturally to all four edges; no visible sheet edge, frame, mat, inset image, collage, multi-panel presentation, photographs, drafting tools or mockup.",
    "Invent an original design rather than depicting a specific real venue. No people, vehicles as scale figures, faces or decorative cultural symbols. Thai context comes from plausible tropical landscape, roof materials and project-appropriate low-rise architecture.",
    NO_VISIBLE_FACE_RULE,
  ].join("\n");
}

export function buildResortMasterplanBatch(date: Date, count = 3): StockImageItem[] {
  if (!Number.isInteger(count) || count < 1 || count > MASTERPLAN_RECIPES.length) throw new Error("Invalid masterplan batch size");
  const pool = [...MASTERPLAN_RECIPES];
  const palettes = [
    "warm white paper, graphite-gray lines, pale turquoise water, faint sage planting and muted terracotta roofs",
    "ivory paper, soft charcoal lines, pale aqua water, light olive planting and washed clay roofs",
    "off-white paper, fine sepia-gray lines, soft cyan water, muted mint planting and dusty taupe roofs",
  ];
  return Array.from({ length: count }, (_, index) => {
    const [title, theme, amenities, buildings] = pool.splice(randomInt(pool.length), 1)[0];
    const fields: ResortMasterplanStructure = {
      PROJECT_THEME: theme,
      PROJECT_TITLE: title + "; metadata only, reserve unmarked negative space near the upper left for a designer to add a title later",
      VIEW_AND_PERSPECTIVE: "Elevated bird's-eye oblique overview of the entire site, consistent architectural perspective and clear zoning proportions",
      LINEWORK_AND_TINT_STYLE: "Fine loose graphite and ink sketch lines, subtle line-weight hierarchy, light terrain contours, sparse transparent pastel watercolor accents and mostly unpainted paper",
      WATERPARK_AND_AMENITY_ZONE: amenities + "; retain clear paths between amenities; use pale aqua only for water explicitly specified here",
      ACCOMMODATION_AND_STRUCTURES: buildings + "; coherent roof geometry with sparse pale earth-tone roof accents",
      LANDSCAPE_AND_TERRAIN: "A clear entry and service route, linked pedestrian paths, lightly sketched gentle hills and tropical planting in faint green washes; avoid dense clutter",
      COLOR_PALETTE: palettes[randomInt(palettes.length)],
    };
    return {
      id: index + 1, seoTitle: title + " Architectural Sketch Masterplan", category: "Architectural Masterplan Sketch",
      aspectRatio: "3:2", composition: "artwork", generationMode: "regular_scene",
      isTransparent: false, conceptMode: "existing", planningSource: "curated_fallback",
      generationBriefVersion: GENERATION_BRIEF_VERSION, masterplanStructure: fields,
      prompt: formatResortMasterplanPrompt(fields),
      negativePrompt: "visible human face, people, readable title, lettering, labels, legend, scale bar, logo, watermark, cropped site, frontal elevation, photorealistic aerial photo, saturated 3D rendering, collage, border, frame",
      keywords: [title.toLowerCase(), "project masterplan", "architectural sketch", "site planning", "amenity zones", "bird eye view", "pastel watercolor", "ink linework", "landscape design", "Thai architecture", "project design", "circulation layout", "building clusters", "terrain contours", "tropical landscape", "concept illustration", "unlabeled plan", "presentation background"],
      modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(title, index + 1, date, "regular_scene"),
      commercialIntent: {
        targetBuyer: "architects, landscape designers and developers planning a " + title,
        intendedUse: title + ": project-design mood board, early masterplan proposal or planning presentation with designer-added annotations",
        purchaseReason: "The readable site overview and restrained linework show amenity, accommodation and landscape relationships with space for later annotation. It is an illustrative concept, not a certified construction or engineering plan; sales are unverified.",
      },
    };
  });
}
