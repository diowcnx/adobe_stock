import { randomInt } from "node:crypto";
import type { ExhibitionBoothStructure, StockImageItem } from "./types";
import { GENERATION_BRIEF_VERSION, NO_VISIBLE_FACE_RULE } from "./generation-policy";
import { generateUniqueStockFilename } from "./csv";

export const BOOTH_RECIPES = [
  ["Thai Community Craft Root Pavilion", "three monumental branching columns inspired by tree roots, connected overhead into an irregular open canopy", "woven baskets, bamboo containers, artisan ceramics and natural-dyed cloth", "curved merchandise trays growing from the left root column", "branch-supported floating shelves and suspended craft-display capsules"],
  ["Thai Woven Bamboo Pavilion", "three laminated bamboo portal frames interlaced into an open woven canopy with engineered bracing", "bamboo household objects, woven handbags and handmade storage baskets", "a gently curved woven-bamboo display wall", "open bamboo shelving with integrated lighting"],
  ["Thai Textile Wave Pavilion", "two broad curved ribbed frames supporting an undulating overhead canopy inspired by draped cloth", "plain natural-dyed textile swatches, folded cotton and handmade fabric bags", "layered textile rails supported by a curved rib", "low illuminated fabric display shelves"],
  ["Thai Ceramic Arch Pavilion", "three rounded mineral-composite arches joined by a shallow continuous canopy", "unbranded ceramic bowls, vases and small handcrafted planters", "stepped ceramic display plinths integrated into the left arch", "wall niches and open shelves integrated into the right arch"],
  ["Thai Rice Husk Craft Pavilion", "three tapered columns with rice-husk composite cladding supporting a gently curved lightweight roof", "wooden craft objects, rice-husk composite containers and woven trays", "a curved low counter with a visible composite surface", "tiered shelving supported by the right structural column"],
  ["Thai Botanical Soap Pavilion", "rounded timber frames forming a leaf-vein canopy with a clear open front", "unbranded soap bars, plain refill containers and woven gift boxes", "a rounded product sampling counter with blank labels", "integrated shallow display shelves with concealed storage"],
  ["Thai Rattan Loop Pavilion", "three freestanding reinforced rattan-clad loop frames joined by a shallow organic canopy", "rattan lampshades, small woven homewares and natural-fiber handbags", "a large structural loop containing tiered display trays", "a smaller connected loop with suspended display shelves"],
  ["Thai Community Gift Pavilion", "two branching timber columns and one curved rear panel supporting a compact open canopy", "handmade gift baskets, plain cloth pouches, ceramics and bamboo accessories", "integrated curved gift display counter", "three levels of open merchandise shelving"],
] as const;

export function formatExhibitionBoothPrompt(fields: ExhibitionBoothStructure): string {
  return [
    "[USER_INPUT]", ...Object.entries(fields).map(([key, value]) => key + ": " + value),
    "[ROLE & TASK] Create a premium exhibition-booth design visualization based on USER_INPUT.",
    "Follow VIEW_ANGLE strictly: straight-on frontal orthographic elevation, eye-level centered camera. Adapt the composition to the canvas; keep the complete booth, canopy and platform fully visible with balanced breathing room. No cropping or dramatic perspective.",
    "Construct BOOTH_STRUCTURE with credible proportions, concealed reinforcement, connected canopy and display supports. Preserve an open accessible front and practical circulation. Do not force a tall wall, central shelf or symmetry when the chosen organic structure is asymmetric.",
    "Render LEFT_FEATURE_ELEMENT, RIGHT_FEATURE_ELEMENT and DISPLAY_FIXTURES as connected architectural elements. Arrange PRODUCT_DISPLAY neatly, leaving space between objects so merchandise does not overwhelm the booth.",
    "Use MATERIAL_PALETTE, LIGHTING_STYLE, SIDE_DECORATION and FLOOR_TREATMENT. Pure seamless white studio background and floor continue to every edge, with soft realistic contact shadows. No shopping mall, event hall, neighboring booths, pedestrians or environmental clutter.",
    "PRIMARY_SIGNAGE is a BLANK architectural sign area for later typography. Do not render brand names, Thai or English lettering, subtitles, numbers, pseudo-text, logos or watermarks. GRAPHIC_BACKDROP may use original abstract root or fiber relief textures, with no readable marks. DECORATIVE_MARKS must remain non-branded architectural relief, never a logo.",
    "This is a full-size architectural design visualization, not a miniature craft sculpture or a multi-panel presentation board. High material fidelity, refined fixtures, realistic merchandising, complete booth silhouette on white.",
    NO_VISIBLE_FACE_RULE,
    "No people, frame, border, page mockup, diagrams or text overlays.",
  ].join("\n");
}

export function buildExhibitionBoothBatch(date: Date, count = 5): StockImageItem[] {
  if (!Number.isInteger(count) || count < 1 || count > BOOTH_RECIPES.length) throw new Error("Invalid booth batch size");
  const pool = [...BOOTH_RECIPES];
  const palettes = [
    "olive green #91A547, pale sage #D3DCB5, warm ivory #F4F0E6, textured recycled composite and natural bamboo",
    "warm ivory #F4F0E6, natural bamboo honey, muted sage and matte mineral surfaces",
    "terracotta clay, pale sand, natural rattan and matte warm ivory",
  ];
  return Array.from({ length: count }, (_, index) => {
    const [title, structure, products, left, right] = pool.splice(randomInt(pool.length), 1)[0];
    const fields: ExhibitionBoothStructure = {
      BOOTH_CONCEPT: title + " — premium community-craft exhibition architecture",
      VIEW_ANGLE: "Strict straight-on frontal orthographic elevation, camera centered at eye level, entire booth fully visible",
      BACKGROUND_STYLE: "Pure seamless solid white #FFFFFF studio background",
      BOOTH_STRUCTURE: structure + ", with realistic structural connections, concealed reinforcement and open accessible circulation",
      PRIMARY_SIGNAGE: "Blank warm-ivory sign surface suspended below the canopy; no lettering or brand",
      GRAPHIC_BACKDROP: "Minimal freestanding panels with original abstract root-system relief and subtle organic fiber texture, without text",
      DECORATIVE_MARKS: "Original subtle branching-line relief integrated into a panel, no logo or emblem",
      LEFT_FEATURE_ELEMENT: left,
      RIGHT_FEATURE_ELEMENT: right,
      DISPLAY_FIXTURES: "Three levels of supported merchandise platforms with ivory surfaces, discreet integrated LEDs and concealed low storage",
      PRODUCT_DISPLAY: products,
      MATERIAL_PALETTE: palettes[randomInt(palettes.length)],
      SIDE_DECORATION: "One restrained sculptural foliage cluster integrated with a structural base",
      FLOOR_TREATMENT: "Low accessible platform following the booth footprint, matte finish and soft studio contact shadows",
      LIGHTING_STYLE: "Soft daylight-inspired studio illumination with concealed warm-neutral shelf lights and controlled highlights",
      DESIGN_FOCUS: "Thai community craft, organic architectural structure, practical retail display, clear access and material identity; no certification or environmental-performance claims",
      VISUAL_STYLE: "Hyperrealistic exhibition architecture visualization, finely detailed merchandise, complete frontal orthographic presentation isolated on pure white",
    };
    return {
      id: index + 1, seoTitle: title, category: "Thai Craft Exhibition Booth",
      aspectRatio: "3:2", composition: "advertising", generationMode: "regular_scene",
      isTransparent: false, conceptMode: "existing", planningSource: "curated_fallback",
      generationBriefVersion: GENERATION_BRIEF_VERSION, boothStructure: fields,
      prompt: formatExhibitionBoothPrompt(fields),
      negativePrompt: "visible human face, people, lettering, Thai text, logo, watermark, environmental clutter, cropped canopy, cropped platform, perspective view, miniature, collage, border",
      keywords: [title.toLowerCase(), "exhibition booth", "pavilion design", "Thai craft", "community craft", "retail display", "organic architecture", "frontal elevation", "white background", "architectural visualization", "merchandising", "display shelves", "bamboo", "natural materials", "studio lighting", "blank signage", "event design", "craft exhibition"],
      modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(title, index + 1, date, "regular_scene"),
      commercialIntent: {
        targetBuyer: "exhibition designers, event agencies, craft-market organizers and Thai community-product marketers",
        intendedUse: "Booth-design proposal, trade-show pitch or community-craft exhibition presentation with buyer-added branding",
        purchaseReason: "The complete frontal view makes the structure, merchandising layout and blank sign surfaces easy to reuse in a design proposal. Sales and structural performance are unverified.",
      },
    };
  });
}
