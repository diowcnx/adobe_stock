import { randomInt } from "node:crypto";
import type { BeverageCampaignStructure, StockImageItem } from "./types";
import { GENERATION_BRIEF_VERSION, NO_VISIBLE_FACE_RULE } from "./generation-policy";
import { generateUniqueStockFilename, normalizeStockKeywords } from "./csv";

export const BEVERAGE_CAMPAIGN_RECIPES = [
  ["Thai Tropical Refreshment Trio", "Contemporary Thai tropical refreshment campaign for a premium cafe menu", "tall clear glass of amber Thai tea with milk, large ice cubes and fine condensation, no label", "short clear glass of pale coconut-pandan milk with ice and one pandan-leaf garnish", "slender clear glass of sparkling calamansi-honey soda with citrus wheel and ice", "pale travertine center cylinder with two lower woven-rattan and light teak blocks", "one opened calamansi, two pandan leaves, a small coconut wedge and a restrained scatter of tea leaves", "warm cream limewash wall and sand-toned tabletop with a soft palm-leaf shadow falling from upper left", "late-afternoon diffused sunlight with crisp glass highlights, believable liquid translucency and fresh condensation", "amber tea, coconut cream, fresh green, pale citrus yellow and warm sand", "cafes, beverage brands and hospitality designers", "seasonal menu, social campaign or cafe poster background", "three distinct Thai-inspired refreshments form a ready-made premium menu family"],
  ["Bangkok Coffee Energy Flight", "Modern specialty-coffee energy campaign with subtle Thai ingredients", "highball glass of coconut espresso tonic with a dark espresso layer, clear bubbles, ice and condensation", "low tumbler of Thai iced coffee with creamy swirls and ice", "stemless glass of orange cold brew with a thin orange wheel and ice", "dark walnut center cube with two lower brushed-stone blocks", "roasted coffee beans, one orange half and a small fresh coconut piece placed sparingly", "smoky taupe plaster wall and dark stone counter with a narrow window shadow", "directional morning studio light defining coffee layers, bubbles, condensation and glass rims", "espresso brown, caramel cream, burnt orange, coconut white and charcoal", "coffee shops, roasters and food-service agencies", "coffee flight launch, menu banner or delivery-app promotion", "recognizable coffee variations communicate choice and energy without labels"],
  ["Thai Botanical Tea Color Story", "Naturally colorful Thai botanical tea campaign", "tall clear glass of violet-blue butterfly-pea lime cooler with ice and condensation", "small clear glass of golden lemongrass tea with a tied lemongrass stalk", "fluted clear glass of ruby roselle soda with ice and one roselle calyx", "white terrazzo center pedestal with two lower pale bamboo blocks", "butterfly-pea blossoms, a lime half, one lemongrass stalk and two roselle calyces", "soft ivory wall with a faint botanical shadow and pale terrazzo counter", "clean side-lit studio daylight preserving natural drink colors and transparent glass detail", "indigo violet, lemongrass gold, roselle red, lime green and soft ivory", "tea brands, wellness cafes and hospitality art directors", "botanical drink menu, summer campaign or editorial feature", "the three naturally distinct colors make the ingredient story understandable at a glance"],
  ["Green Tea Texture Trio", "Premium green-tea menu campaign built around three familiar preparations", "clear ribbed glass of iced matcha latte with a clean green-and-milk gradient, ice and condensation", "small ceramic cup of hot whisked matcha with smooth foam and no markings", "clear tumbler of sparkling yuzu green tea with ice and a thin yuzu peel", "light oak center block with lower matte-ivory ceramic and gray-stone plinths", "a bamboo whisk, a small restrained spoonful of matcha powder and one cut yuzu", "warm off-white microcement wall and pale oak surface with soft diagonal shadows", "large diffused studio light with gentle highlights, readable foam, powder and condensation textures", "matcha green, milk white, yuzu yellow, pale oak and warm gray", "tea houses, beverage chains and lifestyle publishers", "green-tea collection menu, packaging backdrop or wellness article hero", "hot, creamy and sparkling formats give buyers one coherent green-tea family"],
  ["Citrus Sparkling Summer Set", "Bright summer hydration campaign featuring three citrus profiles", "tall clear glass of grapefruit rosemary sparkling water with ice, bubbles and condensation", "low clear glass of lime cucumber cooler with thin cucumber ribbon and ice", "slender clear glass of mandarin ginger soda with a mandarin wheel and ice", "matte limestone center cylinder with two lower sun-bleached wood blocks", "one grapefruit wedge, a lime half, cucumber slices, a ginger piece and one mandarin", "pale sky-blue stucco wall and ivory stone surface with a soft sunlit arc", "bright diffused midday light making bubbles, citrus pulp and condensation sharply believable", "grapefruit coral, lime green, mandarin orange, cucumber jade and pale blue", "non-alcoholic beverage brands, resorts and campaign designers", "summer refreshment campaign, pool-menu background or hydration article", "three ingredient-led citrus colors read immediately as a refreshing product family"],
  ["Cacao Comfort Beverage Trio", "Cozy premium cacao campaign for cooler-season menus", "tall clear glass of iced dark cacao latte with a creamy top layer and condensation", "matte ceramic cup of hot cacao with smooth microfoam and no pattern", "short clear glass of cacao coconut shake with ice and a light cacao dusting", "warm walnut center cube with two lower cream-stone plinths", "one broken cacao pod section, a few cacao beans and one small coconut piece", "deep warm-beige plaster wall and walnut tabletop with a soft oval light gradient", "soft side studio lighting with warm highlights and accurate foam, cacao and glass texture", "cacao brown, cream, coconut white, walnut and muted copper", "cafes, chocolate brands and hospitality marketers", "seasonal drink menu, chocolate promotion or comfort-food editorial", "three recognizable temperatures and textures communicate a complete cacao collection"],
  ["Ginger Wellness Morning Trio", "Clean morning wellness beverage campaign led by ginger and citrus", "clear footed glass of golden ginger-turmeric tonic with ice and condensation", "small handleless ceramic cup of hot ginger tea with a thin ginger slice", "clear bottle-shaped glass of lemon ginger infusion with ice, no cap and no label", "pale sandstone center pedestal with two lower raw-oak blocks", "fresh ginger root, one lemon half and a restrained turmeric root segment", "sun-washed cream wall and pale sandstone surface with a narrow morning-window shadow", "fresh early-morning directional light with controlled golden glow and realistic liquid clarity", "ginger gold, lemon yellow, turmeric orange, raw oak and cream", "wellness brands, spas and health publishers", "morning routine campaign, spa menu or wellness article hero", "the familiar ingredients make the wellness theme readable without health claims"],
  ["Tropical Smoothie Color Flight", "Tropical fruit smoothie campaign with three clearly differentiated flavors", "tall clear glass of mango-passionfruit smoothie with a smooth thick texture and condensation", "short clear glass of dragon-fruit banana smoothie with natural pink seed flecks", "stemless clear glass of pineapple coconut smoothie with a small pineapple-leaf garnish", "light teak center block with two lower woven-cane and pale-stone plinths", "one mango cheek, half a passionfruit, a dragon-fruit wedge, banana slice and pineapple wedge", "warm peach limewash wall and light teak surface with a soft leaf shadow", "soft tropical daylight showing believable fruit pulp, creamy body and cold-glass condensation", "mango gold, dragon-fruit pink, pineapple yellow, coconut cream and light teak", "smoothie bars, hotels and tropical-food advertisers", "smoothie menu launch, travel campaign or social-media background", "three strong natural colors let buyers communicate flavor variety instantly"],
  ["Berry Yogurt Drink Collection", "Fresh berry-and-yogurt beverage campaign for breakfast and snack occasions", "tall clear glass of blueberry yogurt drink with a pale violet swirl and condensation", "small clear glass of strawberry yogurt smoothie with visible natural fruit flecks", "short clear glass of raspberry oat drink with a soft blush tone and ice", "white marble center cylinder with two lower pale-birch blocks", "a few blueberries, one sliced strawberry, three raspberries and a restrained oat sprinkle", "soft blush plaster wall and light marble surface with diffused side shadows", "bright softbox lighting with natural dairy texture, berry detail and clean glass reflections", "blueberry violet, strawberry red, raspberry blush, yogurt white and pale birch", "breakfast brands, cafes and food publishers", "healthy breakfast campaign, cafe menu or recipe feature", "distinct real berries connect every glass to an obvious flavor and use"],
  ["Zero Proof Evening Mocktails", "Sophisticated alcohol-free evening drink campaign", "elevated coupe glass of pomegranate rosemary mocktail with clear ruby liquid and no branding", "low rocks glass of smoked orange tonic with a single large ice cube", "slender highball of cucumber basil fizz with bubbles, ice and condensation", "dark green marble center plinth with lower brass-toned and walnut blocks", "pomegranate seeds, one orange peel, cucumber ribbon and two basil leaves placed sparingly", "deep olive plaster wall and dark stone bar surface with a soft arch of light", "moody controlled studio light with elegant rim highlights, believable bubbles and glass transparency", "pomegranate ruby, burnt orange, cucumber green, dark olive and muted brass", "restaurants, hotels and zero-proof beverage brands", "evening menu, hospitality campaign or celebration feature", "three mature glass styles communicate a premium alcohol-free set without text"],
  ["Milk Tea Flavor Collection", "Contemporary milk-tea campaign with three recognizable Asian flavor directions", "tall clear glass of brown sugar milk tea with ice and a clean caramel ribbon, no pearls obscuring the drink", "short clear glass of taro milk tea with a natural pale-lilac tone and ice", "slender clear glass of pandan coconut milk tea with a soft green tone and ice", "cream terrazzo center cylinder with lower light-oak and woven-rattan blocks", "a small brown-sugar piece, one cut taro piece, two pandan leaves and a coconut wedge", "warm ivory wall and cream terrazzo counter with rounded window-light shadows", "clean commercial side light revealing caramel, creamy opacity and condensation without artificial neon color", "caramel brown, taro lilac, pandan green, coconut cream and light oak", "bubble-tea shops, drink franchises and menu designers", "flavor collection campaign, delivery-app hero or store menu background", "three familiar ingredient colors communicate assortment while remaining unbranded"],
  ["Spiced Festive Warmers", "Warm spiced beverage campaign for festive hospitality without holiday text", "clear handled glass of cinnamon orange tea elevated at center with visible orange peel and steam", "small ceramic cup of ginger apple infusion with a cinnamon stick beside the rim", "short clear handled glass of cardamom cacao with smooth foam", "dark oak center block with two lower natural-stone plinths", "one orange slice, a few apple wedges, fresh ginger, two cinnamon sticks and three cardamom pods", "warm clay-colored wall and dark oak tabletop with subtle firelight-like gradients", "warm directional studio light with restrained steam, natural spice texture and controlled highlights", "clay red, orange, apple gold, cacao brown, dark oak and cream", "hotels, cafes and seasonal campaign designers", "festive menu, winter promotion or hospitality editorial", "three warm drinks and their visible spices create a clear seasonal story without typography"],
] as const;

export function formatBeverageCampaignPrompt(fields: BeverageCampaignStructure): string {
  return [
    "[USER_INPUT]", ...Object.entries(fields).map(([key, value]) => key + ": " + value),
    "[ROLE & TASK] Create a premium photorealistic commercial beverage-advertising still life based strictly on all nine USER_INPUT fields.",
    "Obey DRINK_COUNT_AND_SELECTION literally. Show only the named one, two or three finished drinks as separate complete vessels; do not add, duplicate, merge or omit a drink. HERO_DRINK remains the unmistakable priority and SUPPORTING_DRINKS contains either the exact supporting recipes or an explicit instruction to omit them.",
    "Obey COMPOSITION_AND_CAMERA instead of defaulting to a centered three-level triangle. The permitted layouts deliberately include a single off-center hero, an asymmetric pair, a top-down ingredient story, a shallow editorial row or a diagonal depth composition. Do not silently convert any of them into three drinks on tiered blocks.",
    "Use STAGING_SURFACE as a physically believable support with every vessel base fully supported. Keep RELEVANT_INGREDIENT_PROPS sparse, fresh and visibly matched only to the selected drinks; props remain secondary and never block a vessel. Add no unrelated fruit, flowers, tableware, packages or decorative clutter.",
    "Render accurate liquid color and viscosity, plausible ice geometry, natural bubbles or foam where named, fine cold-glass condensation, clean rims, realistic refraction and controlled reflections. Glasses and handles must be intact, symmetric and usable. Steam appears only when explicitly requested.",
    "BACKGROUND_AND_LIGHTING is one continuous physical set reaching every image edge. Apply COLOR_PALETTE faithfully while preserving natural copy space for a buyer to add typography later. This is the final full-bleed photograph, not a poster, menu page, collage, packaging mockup or contact sheet.",
    "All vessels, plinths and props are completely unbranded. No labels, letters, numbers, logos, watermarks, captions or rendered typography. No people, hands, human faces, bartenders or customers.",
    NO_VISIBLE_FACE_RULE,
  ].join("\n");
}

const BEVERAGE_LAYOUTS = [
  {
    label: "Single Hero",
    count: 1,
    supporting: (left: string, right: string) => `None. Omit both supporting recipes entirely: ${left}; ${right}`,
    composition: "One off-center hero vessel in a close eye-level three-quarter view, occupying the left third with a broad uninterrupted copy field on the right; no tiered trio and no symmetric product lineup",
    staging: "one low honed-stone slab flush with the tabletop, with no extra blocks or empty drink stands",
    ratio: "3:2" as const,
  },
  {
    label: "Asymmetric Pair",
    count: 2,
    supporting: (left: string) => left,
    composition: "Two drinks at unequal depth in an asymmetric diagonal conversation, photographed from a slightly elevated 35-degree angle; the hero is nearer and larger while the supporting vessel sits behind, with side copy space and no central pyramid",
    staging: "one shared narrow natural-stone shelf and continuous tabletop, not separate tiered cubes",
    ratio: "16:9" as const,
  },
  {
    label: "Overhead Ingredient Story",
    count: 1,
    supporting: (left: string, right: string) => `None. Omit both supporting recipes entirely: ${left}; ${right}`,
    composition: "Strict overhead editorial view of one hero drink placed off-center, with its few matching ingredients tracing a loose crop-safe curve and a clean negative-space quadrant; no plinth and no upright front-view lineup",
    staging: "flat tactile tabletop only, with the vessel fully supported and no blocks, risers or pedestal",
    ratio: "1:1" as const,
  },
  {
    label: "Editorial Pair",
    count: 2,
    supporting: (_left: string, right: string) => right,
    composition: "Two drinks in a calm horizontal editorial spread seen at table height, separated by generous breathing room rather than stacked together; one vessel may be partially backlit, with no triangular hierarchy",
    staging: "continuous table surface with one thin coaster beneath the hero and no display plinths",
    ratio: "3:2" as const,
  },
  {
    label: "Shallow Flavor Row",
    count: 3,
    supporting: (left: string, right: string) => `${left}; ${right}`,
    composition: "Three drinks in a shallow left-to-right editorial row with varied vessel heights but all bases on one plane, photographed straight-on with an open upper copy field; no raised center, no pyramid and no separate blocks",
    staging: "one continuous counter surface with no risers or pedestals",
    ratio: "16:9" as const,
  },
  {
    label: "Diagonal Flavor Journey",
    count: 3,
    supporting: (left: string, right: string) => `${left}; ${right}`,
    composition: "Three drinks receding along one diagonal from foreground hero to two smaller background vessels, photographed from a high three-quarter angle with visible depth and a protected corner copy zone; no centered triangle",
    staging: "one continuous matte tabletop with a single shallow tray linking the set, no individual blocks",
    ratio: "4:5" as const,
  },
] as const;

export function buildBeverageCampaignBatch(date: Date, count = 2): StockImageItem[] {
  if (!Number.isInteger(count) || count < 1 || count > BEVERAGE_CAMPAIGN_RECIPES.length) throw new Error("Invalid beverage-campaign batch size");
  const pool = [...BEVERAGE_CAMPAIGN_RECIPES];
  return Array.from({ length: count }, (_, index) => {
    const [title, theme, hero, left, right, , props, background, lighting, palette, buyer, use, reason] = pool.splice(randomInt(pool.length), 1)[0];
    const dayIndex = Math.floor(date.getTime() / 86_400_000);
    const layout = BEVERAGE_LAYOUTS[(dayIndex + index) % BEVERAGE_LAYOUTS.length];
    const supporting = layout.supporting(left, right);
    const fields: BeverageCampaignStructure = {
      CAMPAIGN_THEME: theme,
      DRINK_COUNT_AND_SELECTION: `Exactly ${layout.count} finished drink${layout.count === 1 ? "" : "s"}. Use HERO_DRINK${layout.count > 1 ? " plus only the recipes named in SUPPORTING_DRINKS" : " only"}`,
      HERO_DRINK: hero,
      SUPPORTING_DRINKS: supporting,
      COMPOSITION_AND_CAMERA: layout.composition,
      STAGING_SURFACE: layout.staging,
      RELEVANT_INGREDIENT_PROPS: props,
      BACKGROUND_AND_LIGHTING: `${background}. ${lighting}`,
      COLOR_PALETTE: palette,
    };
    return {
      id: index + 1,
      seoTitle: `${title} ${layout.label} Beverage Campaign`,
      category: "Commercial Beverage Still Life",
      aspectRatio: layout.ratio,
      composition: "advertising",
      generationMode: "regular_scene",
      isTransparent: false,
      conceptMode: "existing",
      planningSource: "curated_fallback",
      generationBriefVersion: GENERATION_BRIEF_VERSION,
      beverageCampaignStructure: fields,
      prompt: formatBeverageCampaignPrompt(fields),
      negativePrompt: "people, hands, visible human face, extra drink, missing drink, duplicate glass, merged vessels, default triangular plinth arrangement, floating glass, unsupported vessel, broken rim, deformed handle, irrelevant ingredients, clutter, packaging, bottle label, text, lettering, logo, watermark, frame, border, poster, menu layout",
      keywords: normalizeStockKeywords([title.toLowerCase(), layout.label.toLowerCase(), "beverage campaign", "commercial still life", "premium cafe", "menu background", "refreshment", "product staging", "ingredient story", "glass condensation", "studio photography", "hospitality marketing", "drink collection", "copy space", "unbranded", "photorealistic drinks", "advertising background"]),
      modelUsed: "google/gemini-3.1-flash-lite-image",
      filename: generateUniqueStockFilename(title, index + 1, date, "regular_scene"),
      commercialIntent: {
        targetBuyer: buyer,
        intendedUse: use,
        purchaseReason: `${reason}. The ${layout.label.toLowerCase()} composition and natural copy space give buyers a layout that differs from a routine three-glass pyramid. This is a buyer-use hypothesis; sales are unverified.`,
      },
    };
  });
}
