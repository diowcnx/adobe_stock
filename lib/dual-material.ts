import { randomInt } from "node:crypto";
import type { DualMaterialStructure, StockImageItem } from "./types";
import { GENERATION_BRIEF_VERSION, NO_VISIBLE_FACE_RULE } from "./generation-policy";
import { generateUniqueStockFilename, normalizeStockKeywords } from "./csv";

export const DUAL_MATERIAL_RECIPES = [
  ["Porcelain Denim Swan", "one simple swan sculpture with a continuous curved neck and compact wing", "matte ivory porcelain forming the main body and neck", "folded indigo denim forming one broad wing accent", "fashion and homeware art directors", "soft-versus-hard material campaign", "softness and strength in one familiar silhouette"],
  ["Concrete Silk Lotus", "one open lotus-flower sculpture with broad readable petals", "fine matte gray concrete forming the broad outer petals", "plain Thai silk forming a compact inner-petal group", "design studios and textile brands", "material contrast or tactile craft campaign", "delicacy meeting solidity"],
  ["Paper Copper Heart", "one simple sculptural anatomical-heart silhouette with only major rounded chambers and short vessel forms", "folded warm-white paper forming the main connected volume", "smooth copper strips tracing a few major contours", "editorial designers and wellbeing publishers", "symbolic care-and-connection article hero, not a diagnostic illustration", "care and connection represented by a recognizable heart shape"],
  ["Walnut Ceramic Brain", "one simplified sculptural brain silhouette with two clear rounded hemispheres and no tiny loose details", "joined walnut kernels forming a compact main volume", "smooth matte ceramic forming a broad lower support integrated into the shape", "education and creative-thinking publishers", "creativity or learning article opener, not a medical diagram", "natural complexity and a calm supporting structure"],
  ["Felt Stone Teapot", "one unmistakable compact teapot sculpture with a stout spout, broad handle and fitted lid", "dense wool felt forming the main body with realistic fiber texture", "smooth dark stone forming the lid and short spout tip", "homeware brands and craft publishers", "tactile home-comfort campaign", "warmth and permanence in a familiar household shape"],
  ["Glass Rattan Pear", "one clearly recognizable upright pear sculpture with a short simple stem", "smooth pale amber glass forming the continuous main pear volume", "woven rattan forming one broad curved band around the lower body", "interior-design and material-research studios", "transparent-versus-woven materials editorial", "clarity wrapped in handcrafted texture"],
  ["Clay Rubber Running Shoe", "one simplified recognizable running-shoe sculpture with a clean upper and broad sole, no branding", "unglazed terracotta forming the main upper shape", "matte charcoal rubber forming the continuous outsole", "footwear art directors and product-design publishers", "footwear material-experiment campaign", "craft tradition contrasted with functional performance materials"],
] as const;

export function formatDualMaterialPrompt(fields: DualMaterialStructure): string {
  return [
    "[USER_INPUT]", ...Object.entries(fields).map(([key, value]) => key + ": " + value),
    "[ROLE & TASK] Create one original dual-material sculptural art object following all six USER_INPUT fields.",
    "Construct SUBJECT as exactly one complete, immediately recognizable silhouette from PRIMARY_MATERIAL and SECONDARY_MATERIAL. The primary material defines the main volume; use the secondary material only in the named connected accent region. The material pairing is deliberately unexpected, but the subject shape remains familiar.",
    "Keep both materials visibly distinct with credible surface texture, scale, reflections and thickness. Join them coherently into one sculpture, not two objects side by side, an exploded view or a random patchwork of fragments. Add no third construction material, props, tools or scenery.",
    "Use a clean three-quarter studio view with the entire subject visible, generous breathing room and natural negative space on BACKGROUND. Apply SHADOW_STYLE exactly, with coherent support and no unexplained levitation. The physical background continues naturally to every edge.",
    "Follow VISUAL_STYLE with photographic material rendering. Animal faces and sculptural organ shapes are allowed; no human faces, people, portrait busts, faces hidden in textures, lettering, logos, watermarks, border, frame, poster layout or page mockup. A stylized organ sculpture is not an anatomical diagnosis or a claim of medical accuracy.",
    NO_VISIBLE_FACE_RULE,
  ].join("\n");
}

export function buildDualMaterialBatch(date: Date, count = 2): StockImageItem[] {
  if (!Number.isInteger(count) || count < 1 || count > DUAL_MATERIAL_RECIPES.length) throw new Error("Invalid dual-material batch size");
  const pool = [...DUAL_MATERIAL_RECIPES];
  const backgrounds = ["warm ivory matte studio sweep", "soft warm-gray matte studio surface", "pale sand-colored seamless studio background"];
  const shadows = ["soft natural contact shadow directly beneath the supported object", "gently directional studio contact shadow cast to the lower right by a large upper-left softbox"];
  return Array.from({ length: count }, (_, index) => {
    const [title, subject, primary, secondary, buyer, use, meaning] = pool.splice(randomInt(pool.length), 1)[0];
    const fields: DualMaterialStructure = {
      SUBJECT: subject,
      PRIMARY_MATERIAL: primary,
      SECONDARY_MATERIAL: secondary,
      BACKGROUND: backgrounds[randomInt(backgrounds.length)],
      SHADOW_STYLE: shadows[randomInt(shadows.length)],
      VISUAL_STYLE: "Minimalist sculptural studio art, familiar subject shape, restrained palette, highly realistic material textures, clean lighting and one readable concept: " + meaning,
    };
    return {
      id: index + 1, seoTitle: title + " Dual Material Sculpture", category: "Dual Material Sculpture",
      aspectRatio: "3:2", composition: "advertising", generationMode: "regular_scene",
      isTransparent: false, conceptMode: "existing", planningSource: "curated_fallback",
      generationBriefVersion: GENERATION_BRIEF_VERSION, dualMaterialStructure: fields,
      prompt: formatDualMaterialPrompt(fields),
      negativePrompt: "visible human face, people, portrait bust, third material, extra objects, detached fragments, collage, broken silhouette, text, lettering, logo, watermark, frame, border",
      keywords: normalizeStockKeywords([title.toLowerCase(), "dual material sculpture", "material contrast", "sculptural object", "conceptual art", "studio photography", "tactile detail", "mixed materials", "single object", "recognizable silhouette", "creative campaign", "product design", "material experiment", "natural shadow", "copy space", "minimalist background", "unbranded", "photorealistic textures"]),
      modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(title, index + 1, date, "regular_scene"),
      commercialIntent: {
        targetBuyer: buyer, intendedUse: use,
        purchaseReason: "One recognizable subject communicates " + meaning + " through a distinct two-material construction with reusable negative space. This is a buyer-use hypothesis; sales are unverified.",
      },
    };
  });
}
