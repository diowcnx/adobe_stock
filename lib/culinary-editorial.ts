import { randomInt } from "node:crypto";
import type { CulinaryEditorialStructure, StockImageItem } from "./types";
import { GENERATION_BRIEF_VERSION, NO_VISIBLE_FACE_RULE } from "./generation-policy";
import { generateUniqueStockFilename } from "./csv";

export const CULINARY_EDITORIAL_RECIPES = [
  ["Holy Basil Wok Heat", "High-heat Thai beef holy-basil stir-fry campaign for a contemporary sauce or restaurant menu", "heavy seasoned black carbon-steel wok filled with dry-fried minced beef, blistered dried chilies, crisp holy-basil leaves and roasted garlic, with restrained hot-oil glints", "black wok spatula entering cleanly from the upper right, lifting one readable bite of beef, chili and basil above the wok; handle support remains outside frame and no hand is visible", "fresh holy-basil sprigs, two dried red chilies and one garlic clove grouped neatly at lower right", "a freestanding layered arch set made from sky-cyan and chili-red matte panels behind the food, with open center and no outer border", "chili red, wok-char black, basil green, sky cyan and warm white", "Thai restaurants, seasoning brands and food publishers", "restaurant campaign, sauce launch or recipe feature", "the lifted bite and exact raw ingredients make wok heat and flavor immediately legible"],
  ["Tom Yum Steam Lift", "Bright Thai tom-yum noodle campaign with aromatic citrus and chili cues", "wide ivory bowl of tom-yum noodles with shrimp, mushrooms, lemongrass and glossy orange-red broth", "slim dark chopsticks entering from the top edge and lifting a compact curl of noodles with one mushroom slice; no hand and no face", "lemongrass segment, kaffir-lime leaves, one lime half and two bird's-eye chilies arranged at lower right", "rounded coral and pale-aqua dimensional panels forming a shallow culinary stage, never a printed poster or frame", "tom-yum orange, lime green, coral, pale aqua and ivory", "instant-noodle brands, restaurants and culinary editors", "menu hero, flavor launch or recipe article", "recognizable soup ingredients and lifted noodles communicate the dish without copy"],
  ["Green Curry Pour Moment", "Premium Thai green-curry campaign emphasizing creamy herb texture", "low ceramic bowl of chicken green curry with eggplant, basil and a glossy coconut-rich green sauce", "small brass ladle entering from upper center and pouring one controlled ribbon of green curry back into the bowl; no hand visible", "Thai eggplant halves, basil leaves, green chili and a small coconut wedge at lower right", "layered leaf-shaped sage and cream panels creating an open dimensional alcove behind the bowl", "curry green, coconut cream, brass, sage and charcoal", "coconut-milk brands, restaurants and recipe publishers", "ingredient campaign, menu visual or cooking feature", "the ladle pour reveals the sauce texture while the raw ingredients identify the flavor"],
  ["Mango Sticky Rice Ribbon", "Modern Thai dessert campaign celebrating ripe mango and coconut", "matte ceramic plate of glossy coconut sticky rice with precise ripe-mango slices and a restrained coconut cream sheen", "polished dessert spoon entering from upper right and lifting one compact spoonful of sticky rice with a mango slice; no hand", "one mango cheek, folded pandan leaf and tiny restrained pile of toasted mung beans at lower right", "soft yellow and pandan-green curved panels forming a dimensional sunrise arch on a warm-cream set", "ripe mango yellow, pandan green, coconut white, warm cream and toasted gold", "dessert shops, tourism publishers and food brands", "seasonal dessert campaign, menu or travel-food story", "familiar mango, rice and coconut cues make the dessert instantly readable"],
  ["Crab Fried Rice Scoop", "Clean premium crab fried-rice campaign for restaurant and ready-meal buyers", "seasoned steel pan of golden fried rice with distinct grains, generous crab meat, egg and scallion", "broad wok spoon entering from the upper left and lifting one tidy mound showing rice grains, crab and egg; no hand visible", "lime wedge, scallion curls, cucumber slices and one small crab-shell accent grouped at lower right", "sun-yellow and sea-blue rectangular planes forming an offset dimensional window behind the pan without an outer frame", "fried-rice gold, crab white, scallion green, sea blue and stainless steel", "restaurants, meal brands and editorial food designers", "menu launch, ready-meal campaign or recipe opener", "separate grains and visible crab meat communicate premium texture and ingredient value"],
  ["Khao Soi Noodle Arc", "Northern Thai curry-noodle campaign combining creamy broth and crisp garnish", "deep ceramic bowl of khao soi with chicken, golden curry broth, soft noodles and a crown of crisp noodles", "dark wooden chopsticks entering from the top and lifting a neat ribbon of curry-coated noodles beside the crisp crown; no hand", "lime half, sliced shallot, pickled mustard greens and one dried chili at lower right", "mustard-yellow arch and brick-red stepped panels creating a warm dimensional northern-inspired stage without motifs or text", "curry gold, brick red, mustard yellow, lime green and dark wood", "Thai restaurants, travel publishers and meal-kit brands", "regional menu, destination feature or recipe campaign", "the two noodle textures and accurate accompaniments distinguish the regional dish"],
  ["Massaman Potato Glaze", "Warm aromatic massaman-curry campaign with slow-cooked richness", "dark stoneware bowl of massaman beef curry with tender beef cubes, potato, onion and glossy brown coconut sauce", "shallow brass spoon entering from upper right and lifting one beef cube and potato piece with a controlled sauce drip; no hand", "cinnamon stick, star anise, roasted peanuts and one shallot arranged sparingly at lower right", "terracotta and sand-toned concentric arches standing behind the bowl as physical set pieces", "massaman brown, terracotta, sand, brass and coconut cream", "curry-paste brands, restaurants and culinary publications", "sauce campaign, menu visual or slow-cooking feature", "recognizable spices and spoon texture convey aromatic slow-cooked richness"],
  ["Pad See Ew Char", "Street-wok wide-noodle campaign focused on smoky caramelization", "blackened steel plate of pad see ew with broad rice noodles, beef, Chinese broccoli and charred soy edges", "wooden chopsticks entering from upper left and lifting a compact folded ribbon of wide noodles with one broccoli leaf; no hand", "Chinese-broccoli stems, one garlic clove and a tiny dish of dark soy with no markings at lower right", "charcoal-gray and warm-amber block panels forming an angled dimensional street-food set", "soy caramel brown, broccoli green, charcoal, amber and warm white", "restaurants, sauce brands and street-food publishers", "wok menu, soy-sauce campaign or recipe article", "broad noodles and charred edges create a strong two-second dish read"],
  ["Grilled Chicken Tamarind Glaze", "Thai grilled-chicken campaign featuring smoke, char and tamarind brightness", "rustic ceramic platter of sliced grilled chicken with crisp char lines and glossy tamarind glaze", "slim metal tongs entering from the upper right and lifting one intact glazed chicken slice; no hand visible", "tamarind pod, lime half, coriander sprig and roasted chili grouped at lower right", "burnt-orange semicircle and dark-green vertical panels creating a freestanding dimensional grill-stage backdrop", "tamarind brown, char black, lime green, burnt orange and cream", "grill restaurants, sauce brands and food-service agencies", "grill campaign, condiment launch or menu hero", "char, glaze and recipe-specific ingredients communicate savory grilled flavor"],
  ["Som Tam Crunch Lift", "Fresh Thai green-papaya salad campaign with vivid crunch and spice", "wide earthenware bowl of green-papaya salad with crisp strands, tomato, long bean, peanuts and lime dressing", "wooden serving fork entering from the top and lifting a tidy bundle of papaya strands with tomato and long bean; no hand", "green papaya wedge, lime half, long-bean pieces and two red chilies at lower right", "lime-green and tomato-red curved panels forming an airy dimensional market-style stage", "papaya green, tomato red, lime, terracotta and warm white", "restaurants, produce campaigns and culinary publishers", "fresh-menu launch, recipe feature or ingredient promotion", "lifted crisp strands and exact produce reveal freshness and texture immediately"],
  ["Pandan Coconut Dessert Cube", "Contemporary Thai pandan-coconut dessert campaign with tactile layers", "small stoneware plate holding neat pandan-coconut custard cubes with glossy green layers and coconut topping", "minimal dessert fork entering from upper left and lifting one complete layered cube; no hand and no bite marks", "pandan leaves, a coconut wedge and a restrained spoonful of rice flour at lower right", "mint-green and coconut-white stepped panels creating a clean dimensional confectionery set", "pandan green, coconut white, pale mint, stone gray and toasted beige", "dessert brands, bakeries and lifestyle publishers", "dessert collection, packaging backdrop or recipe feature", "one lifted intact cube exposes the product layers while ingredients explain the flavor"],
  ["Thai Seafood Lime Toss", "Bright spicy Thai seafood-salad campaign centered on lime and herbs", "shallow blue ceramic bowl of shrimp and squid salad with lime dressing, celery, onion and red chili", "silver serving spoon entering from upper right and lifting one shrimp with squid ring and herbs above the bowl; no hand", "lime halves, celery leaves, red chili and one garlic clove arranged at lower right", "ocean-blue and lime-green wave-shaped panels standing as a physical dimensional backdrop", "ocean blue, shrimp coral, lime green, chili red and silver", "seafood restaurants, travel publishers and food advertisers", "summer menu, seafood campaign or recipe feature", "recognizable seafood and citrus ingredients give the scene a direct fresh-spicy story"],
] as const;

const blankCopyArea = (placement: string, purpose: string) =>
  `Keep a clean natural negative-space zone at ${placement} for the buyer to add ${purpose} later; render absolutely no letters, placeholder marks, symbols, badges or lines.`;

export function formatCulinaryEditorialPrompt(fields: CulinaryEditorialStructure): string {
  return [
    "[USER_INPUT]", ...Object.entries(fields).map(([key, value]) => key + ": " + value),
    "[ROLE & TASK] Create a premium full-bleed editorial culinary advertising photograph based strictly on all eleven USER_INPUT fields.",
    "Build a dramatic but physically credible food hierarchy: FOREGROUND_HERO_CULINARY_ITEM dominates the lower foreground, while SUSPENDED_HERO_ACTION_AND_UTENSIL presents one clear appetizing bite above it. The utensil may enter from an image edge with its support beyond the crop, but no hand, arm, chef, person or face may appear. Keep the whole dish readable and never distort or overscale it into impossible geometry.",
    "Use only DISH_SPECIFIC_RAW_ACCOMPANIMENTS as a restrained lower-right ingredient group. Every raw accompaniment must genuinely belong to the named recipe. Keep ingredients fresh, correctly scaled and secondary; add no unrelated garnish, retail package, branded prop or decorative clutter.",
    "GRAPHIC_BACKDROP_AND_FRAME means freestanding physical dimensional set pieces behind the food. It never means an outer picture frame, poster border, page, card, inset image or flat graphic overlay. The photographed background and surface continue naturally to all four edges.",
    "BRAND_TITLE_UPPER_LEFT, BRAND_SUBLINE_UPPER_LEFT, EDITORIAL_HEADLINE_LOWER_LEFT, EDITORIAL_TAGLINE_LOWER_LEFT and FOOTER_NOTICE_LOWER_RIGHT are layout metadata describing blank natural copy-space reservations only. Do not render any text, pseudo-text, blank text bars, seals, badges, logos, letters, numerals or typography. The buyer will add copy after licensing.",
    "Render appetizing but realistic food texture, ingredient anatomy, steam or oil only when named, clean utensil geometry, plausible gravity and controlled commercial lighting. Follow COLOR_PALETTE without artificial neon saturation.",
    "No people, hands, human faces, packaged products, labels, logos, text, watermarks, poster layout, page border or marketplace preview.",
    NO_VISIBLE_FACE_RULE,
  ].join("\n");
}

export function buildCulinaryEditorialBatch(date: Date, count = 1): StockImageItem[] {
  if (!Number.isInteger(count) || count < 1 || count > CULINARY_EDITORIAL_RECIPES.length) throw new Error("Invalid culinary-editorial batch size");
  const pool = [...CULINARY_EDITORIAL_RECIPES];
  return Array.from({ length: count }, (_, index) => {
    const [title, context, dish, action, ingredients, backdrop, palette, buyer, use, reason] = pool.splice(randomInt(pool.length), 1)[0];
    const fields: CulinaryEditorialStructure = {
      PROJECT_CONTEXT: context,
      BRAND_TITLE_UPPER_LEFT: blankCopyArea("upper left", "a brand title"),
      BRAND_SUBLINE_UPPER_LEFT: blankCopyArea("upper left beneath the title zone", "a short brand subline"),
      EDITORIAL_HEADLINE_LOWER_LEFT: blankCopyArea("lower left", "an editorial headline"),
      EDITORIAL_TAGLINE_LOWER_LEFT: blankCopyArea("lower left beneath the headline zone", "a short campaign tagline"),
      FOOTER_NOTICE_LOWER_RIGHT: blankCopyArea("extreme lower right outside the ingredient group", "small legal or menu copy"),
      FOREGROUND_HERO_CULINARY_ITEM: dish,
      SUSPENDED_HERO_ACTION_AND_UTENSIL: action,
      DISH_SPECIFIC_RAW_ACCOMPANIMENTS: ingredients,
      GRAPHIC_BACKDROP_AND_FRAME: backdrop,
      COLOR_PALETTE: palette,
    };
    return {
      id: index + 1,
      seoTitle: title + " Editorial Food Campaign",
      category: "Editorial Culinary Advertising",
      aspectRatio: "4:5",
      composition: "advertising",
      generationMode: "regular_scene",
      isTransparent: false,
      conceptMode: "existing",
      planningSource: "curated_fallback",
      generationBriefVersion: GENERATION_BRIEF_VERSION,
      culinaryEditorialStructure: fields,
      prompt: formatCulinaryEditorialPrompt(fields),
      negativePrompt: "people, chef, visible human face, hands, arms, retail package, label, text, Thai lettering, Latin lettering, pseudo-text, seal, logo, watermark, outer frame, poster border, menu page, distorted dish, floating unsupported bowl, deformed utensil, irrelevant garnish, ingredient clutter",
      keywords: [title.toLowerCase(), "Thai food campaign", "editorial food", "culinary advertising", "hero dish", "suspended bite", "food photography", "dimensional backdrop", "menu background", "restaurant marketing", "recipe ingredients", "appetizing texture", "copy space", "unbranded", "no people", "commercial food", "Thai cuisine", "studio set"],
      modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(title, index + 1, date, "regular_scene"),
      commercialIntent: {
        targetBuyer: buyer,
        intendedUse: use,
        purchaseReason: reason + ". Reserved natural copy zones let the buyer add campaign typography after licensing. This is a buyer-use hypothesis; sales are unverified.",
      },
    };
  });
}
