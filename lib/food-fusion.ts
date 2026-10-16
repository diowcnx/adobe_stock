import { randomInt } from "node:crypto";
import type { FoodFusionStructure, StockImageItem } from "./types";
import { GENERATION_BRIEF_VERSION, NO_VISIBLE_FACE_RULE } from "./generation-policy";
import { generateUniqueStockFilename } from "./csv";

// Matched pairs preserve a readable advertising idea. Randomness chooses
// among pairs; it never joins arbitrary ingredients and hardware.
export const FUSION_RECIPES = [
  ["Pork Belly Battery", "Culinary energy recharge", "thick raw pork belly strip with ruby-pink meat and creamy white fat layers", "copper-and-silver cylindrical battery terminal cap with a raised positive contact nub fused to the right end", "ruby pink, creamy white, copper and silver", "food publishers and restaurant marketers", "food-as-fuel article hero or playful restaurant advertisement", "food supplying energy"],
  ["Red Chili Pressure Valve", "Flavor under pressure", "single glossy Thai red chili with its curved silhouette intact", "small brass pressure-release valve fused into its thick stem end", "chili red, brass gold and deep green", "hot-sauce brands and Thai restaurant marketers", "spicy-menu launch banner", "intense spicy heat"],
  ["Tamarind Spring", "Tangy flavor kick", "single ripe tamarind pod with brown shell opened along a small section to reveal dense pulp", "short steel compression spring fused into one end of the pod", "tamarind brown and brushed steel", "snack and condiment marketers", "tangy-flavor product campaign", "a sharp tangy kick"],
  ["Ginger Spark Plug", "A warming flavor spark", "one compact fresh ginger rhizome with one clean pale cut end", "one ceramic-and-steel spark-plug tip fused at the cut end", "ginger tan, pale yellow, ceramic white and silver", "tea and culinary ingredient brands", "ginger-drink advertising hero without health claims", "warming flavor activation"],
  ["Lime Faucet", "Freshness on tap", "one whole Thai lime with realistic textured green rind", "compact brushed-steel faucet spout seamlessly growing from one side", "lime green and stainless silver", "beverage and restaurant marketers", "citrus refresher menu campaign", "fresh citrus refreshment"],
  ["Mango Battery", "Sweet energy recharge", "single long ripe Thai mango cheek with smooth golden flesh and a narrow skin edge", "small copper battery terminal seamlessly fused to its rounded end", "mango gold, green and copper", "fruit snack and smoothie marketers", "mango snack campaign with room for headline", "an enjoyable energy break"],
  ["Coffee Bean Dynamo", "Morning power", "one oversized but otherwise realistic roasted coffee bean with a clear center crease", "compact brushed copper generator axle fused into one end", "coffee brown and copper", "coffee roasters and cafe marketers", "morning coffee promotional banner", "a morning energy boost"],
  ["Coconut Cooling Fan", "Tropical cooling", "one young coconut cut to show white flesh and a pale green shell rim", "single compact metal cooling-fan grille fused flush into the cut plane", "coconut white, pale green and brushed silver", "coconut beverage brands", "summer refreshment advertisement", "cool tropical refreshment"],
  ["Pineapple Gear", "Tropical flavor drive", "one short ripe pineapple cylinder showing juicy golden flesh and a small band of patterned rind", "one solid brass gear fused to one end as a continuous single object", "pineapple yellow, olive green and brass", "juice and fruit snack marketers", "tropical product-launch hero", "bright flavor that gets things moving"],
  ["Banana Charging Plug", "Snack recharge", "one short curved ripe banana with a neat peeled-back edge exposing cream flesh", "compact silver two-pin electrical plug fused into its thick end with no cord", "banana yellow, cream and silver", "snack brands and food educators", "food-as-fuel editorial illustration", "a portable food energy source"],
  ["Turmeric Light Bulb", "Bright culinary ideas", "one compact turmeric root with vivid orange cut flesh and natural tan skin", "small warm brass screw-base light-bulb fitting fused to its cut end without glass", "turmeric orange and warm brass", "spice brands and recipe publishers", "creative cooking article opener", "a bright flavor idea"],
  ["Salmon Precision Dial", "Precision flavor", "one clean thick salmon fillet portion with visible orange flesh and pale fat bands", "one compact stainless temperature-control dial fused flush into the short end without markings", "salmon orange, cream and steel", "seafood retailers and cooking publishers", "precision-cooking campaign hero", "careful control of culinary quality"],
  ["Durian Zipper", "Unlock bold flavor", "one plump golden durian flesh segment with soft natural folds", "short closed brushed-metal zipper track seamlessly integrated along its upper ridge", "durian gold and brushed silver", "Thai dessert and travel-food publishers", "durian discovery article or bold-flavor campaign", "opening up a distinctive flavor"],
  ["Shrimp Turbine", "Fast fresh delivery", "one peeled cooked shrimp with orange-white curved segments and no detached pieces", "small silver turbine housing seamlessly fused into its thick end", "shrimp coral, white and silver", "seafood delivery brands", "fast seafood-delivery campaign", "speed and freshness"],
  ["Eggplant Padlock", "Keep freshness secure", "one compact glossy Thai purple eggplant with its skin intact", "small steel padlock shackle fused into its top as a continuous joint", "aubergine purple, green and steel", "fresh-produce storage and grocery brands", "food-storage advertising hero", "protecting fresh ingredients"],
  ["Chili Thermostat", "Turn up the heat", "one plump glossy red chili body with natural skin pores", "one compact brushed brass thermostat knob fused flush into the thick end without numbers", "chili red and brass", "Thai restaurant and spicy snack brands", "adjustable spice-level menu campaign", "control over spicy intensity"],
] as const;

export function formatFoodFusionPrompt(fields: FoodFusionStructure): string {
  return [
    "[USER_INPUT]", ...Object.entries(fields).map(([key, value]) => key + ": " + value),
    "[ROLE & TASK] Create a minimalist surrealist still-life photograph based strictly on USER_INPUT.",
    "Fuse ORGANIC_FOOD_PART and MECHANICAL_HARDWARE_PART into exactly one unified hero object with a seamless transition joint. The fusion is deliberately impossible; render both materials photorealistically and keep both components clearly recognizable.",
    "Use authentic culinary texture, moisture and subsurface scattering on food; crisp industrial precision and realistic highlights on hardware. Keep the total silhouette simple and readably connected.",
    "Single-row staging: one horizontal hybrid centered in frame, resting on BACKGROUND_SURFACE, generous surrounding negative space and a soft natural studio contact shadow. Follow PLACEMENT_AND_ANGLE, LIGHTING_AND_MOOD and COLOR_PALETTE.",
    "The matte physical studio backdrop continues to every edge. No scene, unrelated props, extra objects, collage, panels, frames, borders, detached parts or exploded view. No text, labels, symbols, logos, watermarks or people.",
    "Thai identity comes only from relevant ingredient choice; do not add scenery, flags, cultural decorations or extra food.",
    NO_VISIBLE_FACE_RULE,
  ].join("\n");
}

export function buildFoodFusionBatch(date: Date, count = 10, choose = randomInt): StockImageItem[] {
  if (count > FUSION_RECIPES.length || count < 1) throw new Error("Invalid fusion batch size");
  const pool = [...FUSION_RECIPES];
  const backgrounds = ["flat matte soft ivory #F5F3EF", "flat matte warm pale gray #ECEAE6", "flat matte pale cream #F2EBDD"];
  const views = ["clean frontal-side view", "slightly elevated three-quarter side view", "low studio side view"];
  return Array.from({ length: count }, (_, index) => {
    const [title, theme, food, hardware, palette, buyer, use, meaning] = pool.splice(choose(pool.length), 1)[0];
    const fields: FoodFusionStructure = {
      CONCEPT_THEME: theme,
      ORGANIC_FOOD_PART: food,
      MECHANICAL_HARDWARE_PART: hardware,
      PLACEMENT_AND_ANGLE: "Single horizontal unified hybrid centered in frame, " + views[choose(views.length)],
      BACKGROUND_SURFACE: backgrounds[choose(backgrounds.length)],
      LIGHTING_AND_MOOD: "Clean diffused commercial food photography lighting, restrained specular highlights, realistic food texture and a soft natural contact shadow",
      COLOR_PALETTE: palette + ", soft ivory",
    };
    const keywords = [...new Set([
      title.toLowerCase(), theme.toLowerCase(), meaning, "food hardware fusion", "surreal food",
      "conceptual photography", "hybrid object", "visual metaphor", "minimalist still life",
      "food texture", "mechanical component", "seamless fusion", "commercial advertising",
      "copy space", "studio lighting", "single object", "creative campaign", "innovation",
      "food concept", "photorealistic", "minimalism",
    ])];
    return {
      id: index + 1, seoTitle: title + " Food Hardware Fusion", category: "Food Hardware Fusion",
      aspectRatio: "3:2", composition: "advertising", generationMode: "regular_scene",
      isTransparent: false, conceptMode: "existing", planningSource: "curated_fallback",
      generationBriefVersion: GENERATION_BRIEF_VERSION, fusionStructure: fields,
      prompt: formatFoodFusionPrompt(fields),
      negativePrompt: "visible human face, people, extra objects, detached hardware, collage, exploded view, text, logo, watermark, border, frame",
      keywords, modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(title, index + 1, date, "regular_scene"),
      commercialIntent: {
        targetBuyer: buyer, intendedUse: use,
        purchaseReason: "The visible food-hardware pairing communicates " + meaning + " in a single hero with usable copy space. This is a buyer-use hypothesis, not verified sales.",
      },
    };
  });
}
