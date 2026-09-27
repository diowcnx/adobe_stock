import { callOpenRouterJSON } from "./openrouter";
import { MarketTrend, StockImageItem } from "./types";
import { generateUniqueStockFilename } from "./csv";

interface ResearchResponse {
  trend: MarketTrend;
  prompts: Array<{
    id: number;
    seoTitle: string;
    category: string;
    aspectRatio: "16:9" | "3:2" | "4:5" | "1:1";
    prompt: string;
    negativePrompt?: string;
    keywords: string[];
    compositionStyle: string;
    modelSuggestion: string;
  }>;
}

const SYSTEM_PROMPT = `
You are the elite Adobe Stock commercial photography strategist specializing in high-volume, top-earning contributor portfolios.

PROVEN PORTFOLIO DATA & CRITICAL RULES FOR THIS ACCOUNT:
1. STRICTLY NO HUMAN PORTRAITS / NO CLOSE-UP FACES: Historical sales data for this contributor proves that images of people's faces NEVER sell. Do NOT generate portraits, model poses, smiling corporate workers, or close-up human faces.
2. HUMAN PRESENCE (IF ANY) MUST BE STRICTLY LIMITED TO:
   - Anonymous back view (e.g., silhouette or back of a person at a multi-monitor workstation, walking away into nature).
   - Or hands only interacting with conceptual objects (e.g., hands holding balancing scales, coins, sprout, or conceptual emoji stones).
3. PROVEN TOP-SELLING COMMERCIAL CATEGORIES TO FOCUS ON (Based on actual top download counts):
   - Category A: Cloud Computing, AI, Cybersecurity & Data Infrastructure (e.g., glowing neon cloud icon in dark high-tech server room, fiber-optic data flow, cyber shield, 5G telecom towers, industrial automated manufacturing). This is the account's #1 top seller with 180+ downloads!
   - Category B: Modern Interior Architecture & Blank Frame Mockups (e.g., luxury minimalist bathroom with marble sink, chic Scandinavian living room with empty blank picture frame mockup on the wall, modern home office desk with laptop and plant, sleek corporate building lobby).
   - Category C: Conceptual Metaphors & Business Symbolism (e.g., hands holding happy/sad emotion stones, stack of coins with graduation cap for student finance, one standout colored object in a sea of monochrome items, balancing scales).
   - Category D: Culinary Spices & Food Flat Lays (e.g., vibrant overhead top-down flat lay of exotic Asian/Indian culinary spices, fresh herbs, or coffee beans arranged around a generous blank slate/marble/rustic wood copy space in the center).
   - Category E: Seasonal & Nature Banners (e.g., festive Halloween pumpkin banner with copy space, autumn wildlife, pink cherry blossoms isolated on white, crystal clean water droplets on glass bokeh).
4. MANDATORY COPY SPACE: Every single image MUST feature ample clean negative space (left, right, or center) designed specifically for graphic designers to place marketing copy, headers, or typography.
5. ZERO LOGOS / IP: Strictly no recognizable brand names, logos, or copyrighted elements.
6. MODEL SELECTION:
   - Use 'recraft/recraft-v4.1-flash' for clean product flat lays, interior mockups, isolated assets, and modern design stock.
   - Use 'google/gemini-2.5-flash-image' for glowing server rooms, atmospheric lighting, and high-tech infrastructure.

OUTPUT FORMAT: Strict JSON matching the requested schema.
`;

export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString()
): Promise<{ trend: MarketTrend; items: StockImageItem[] }> {
  const userPrompt = `
Current Date: ${currentDate}.
Analyze current commercial stock market demand strictly matching the proven high-converting niches of this contributor's portfolio (Cloud/Tech Infrastructure, Interior Mockups, Conceptual Metaphors, Culinary Flat Lays, Seasonal Banners).
REMEMBER: NO CLOSE-UP HUMAN FACES OR PORTRAITS AT ALL!

Generate:
1. The market trend analysis (theme, target market, commercial reasoning, seasonal relevance, demand rating).
2. Exactly 5 distinct, high-quality image prompts tailored to this account's proven download patterns with aspect ratios (16:9, 3:2, 4:5, 1:1), SEO titles, categories, and 40-50 keywords each.

Return JSON in this exact structure:
{
  "trend": {
    "theme": "...",
    "targetMarket": "...",
    "commercialReasoning": "...",
    "seasonalRelevance": "...",
    "buyerDemandRating": "Very High"
  },
  "prompts": [
    {
      "id": 1,
      "seoTitle": "...",
      "category": "...",
      "aspectRatio": "16:9",
      "prompt": "Full detailed prompt with lighting, camera angle, clean copy space, no human faces...",
      "negativePrompt": "human face, portrait, blurry, distorted, logos, watermark, text",
      "keywords": ["keyword1", "keyword2", ... 40-50 keywords],
      "compositionStyle": "Wide Landscape Banner / Flat Lay / High-Tech Infrastructure",
      "modelSuggestion": "recraft/recraft-v4.1-flash"
    }
    ... total 5 items
  ]
}
`;

  try {
    const data = await callOpenRouterJSON<ResearchResponse>(
      SYSTEM_PROMPT,
      userPrompt,
      "typesafe/jev-router"
    );

    const items: StockImageItem[] = data.prompts.map((p) => {
      const isRecraft = p.modelSuggestion && p.modelSuggestion.includes("recraft");
      return {
        id: p.id,
        seoTitle: p.seoTitle,
        category: p.category,
        aspectRatio: p.aspectRatio,
        prompt: p.prompt,
        negativePrompt: p.negativePrompt,
        keywords: p.keywords,
        modelUsed: p.modelSuggestion || "recraft/recraft-v4.1-flash",
        filename: generateUniqueStockFilename(p.seoTitle, p.id),
        costEstimate: isRecraft ? "~$0.007 / image" : "~$0.00003 / image",
      };
    });

    return {
      trend: data.trend,
      items,
    };
  } catch (error) {
    console.error("OpenRouter market research error, falling back to account's top-seller dataset:", error);
    return getFallbackMarketData();
  }
}

/**
 * Fallback dataset curated strictly from this account's proven top sellers
 */
function getFallbackMarketData(): { trend: MarketTrend; items: StockImageItem[] } {
  const trend: MarketTrend = {
    theme: "Cloud Computing, Cyber Security & Modern Interior Mockups",
    targetMarket: "Global Enterprise IT, FinTech, Modern Architecture & Commercial Advertising",
    commercialReasoning: "Matches the account's historical top earners: High-demand tech infrastructure, data server rooms, interior frame mockups, and conceptual business metaphors with proven 180+ downloads.",
    seasonalRelevance: "Year-Round Evergreen Commercial Demand + Q4 Enterprise Budget Planning",
    buyerDemandRating: "Very High",
  };

  const rawItems: Array<Omit<StockImageItem, "filename">> = [
    {
      id: 1,
      seoTitle: "Cloud Computing Data Center with Glowing Blue Neon Server Racks",
      category: "Technology / Business",
        aspectRatio: "16:9",
        prompt: "Ultra-wide 16:9 commercial shot of an enterprise cloud data center corridor with rows of sleek dark server racks, vibrant glowing neon blue and orange fiber optic light trails flowing into a central holographic cloud icon, cinematic symmetry, vast dark negative copy space on the right side for tech banner headlines, 8k resolution, shot on Sony A7R IV, clean photorealistic focus, no people.",
        negativePrompt: "people, human face, blurry, text, watermark, logo",
        keywords: [
          "cloud computing", "data center", "server room", "cloud storage", "cybersecurity",
          "big data", "technology banner", "copy space", "network server", "information technology",
          "cloud infrastructure", "data flow", "fiber optic", "telecommunication", "digital transformation",
          "database", "cloud network", "internet server", "enterprise technology", "hosting",
          "artificial intelligence", "data processing", "server rack", "futuristic tech", "blue neon",
          "high tech", "it infrastructure", "data transfer", "cloud service", "web hosting",
          "server hardware", "secure data", "cyber network", "modern technology", "telecom",
          "cloud platform", "smart network", "datacenter aisle", "computer server", "storage network",
          "it solutions", "cloud security", "virtual server", "digital network", "data connection"
        ],
        modelUsed: "google/gemini-2.5-flash-image",
        costEstimate: "~$0.00003 / image",
      },
      {
        id: 2,
        seoTitle: "Minimalist Scandinavian Living Room with Blank Poster Frame Mockup",
        category: "Interiors / Architecture",
        aspectRatio: "3:2",
        prompt: "Clean commercial 3:2 interior photograph of a modern aesthetic living room with a large vertical blank wooden picture frame mockup hanging on a textured warm white wall, elegant brown leather armchair, minimalist ceramic vase with dried pampas grass, soft diffused morning window light casting gentle shadows, high-end architectural digest styling, ample copy space, no people.",
        negativePrompt: "people, human face, cluttered, messy, distorted, text in frame, logos",
        keywords: [
          "frame mockup", "blank poster mockup", "interior mockup", "scandinavian living room", "empty frame",
          "modern interior", "wall mockup", "living room design", "minimalist home", "copy space",
          "leather armchair", "interior styling", "neutral interior", "home decor", "poster template",
          "art display mockup", "clean background", "aesthetic room", "architectural interior", "canvas mockup",
          "warm minimalism", "wooden frame", "pampas grass", "soft daylight", "commercial interior",
          "living room banner", "modern architecture", "picture frame", "gallery wall", "stylish furniture",
          "interior photography", "blank canvas", "print mockup", "designer room", "peaceful interior",
          "contemporary design", "room mockup", "home staging", "art mockup", "empty wall"
        ],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 3,
        seoTitle: "Flat Lay Composition of Aromatic Culinary Spices on Dark Slate",
        category: "Food & Beverage / Backgrounds",
        aspectRatio: "1:1",
        prompt: "Overhead 1:1 top-down flat lay photograph of colorful exotic culinary spices (star anise, cinnamon sticks, golden turmeric, crushed red chili, cardamom pods, black peppercorns) arranged in bowls in an organic circle around a large empty black slate stone copy space in the center, professional food photography lighting, rich textures, no people.",
        negativePrompt: "people, human face, hand, blurry, watermark, text, dirty slate",
        keywords: [
          "spices flat lay", "culinary herbs", "spices background", "copy space", "seasoning",
          "black slate", "food background", "cooking ingredients", "organic spices", "top view",
          "star anise", "cinnamon sticks", "turmeric", "culinary flat lay", "aromatic herbs",
          "indian spices", "asian cuisine", "gourmet seasoning", "food styling", "recipe background",
          "healthy spices", "flavoring", "culinary art", "kitchen ingredients", "spice market",
          "herbal seasonings", "menu background", "colorful spices", "dry spices", "food banner",
          "wholesome ingredients", "cooking background", "table top view", "slate texture", "condiments",
          "food concept", "cooking spices", "chef ingredients", "culinary display", "natural spices"
        ],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 4,
        seoTitle: "Hands Holding Wooden Cubes with Happy and Sad Face Icons",
        category: "Concepts / Business & Lifestyle",
        aspectRatio: "4:5",
        prompt: "Conceptual 4:5 portrait composition focusing exclusively on two hands holding two rounded smooth wooden pebble tokens, one carved with a smiling happy emoji face and the other with a frowning sad face, clean blurred warm neutral studio background, symbol of customer satisfaction, mental health, feedback rating and emotion choice, soft daylight, no visible human face.",
        negativePrompt: "human face, full body, distorted fingers, extra hands, logos, watermark",
        keywords: [
          "customer satisfaction", "feedback rating", "happy and sad", "hands holding stones", "emotion concept",
          "mental health", "positive review", "satisfaction score", "customer experience", "psychology concept",
          "emoji stones", "wooden cubes", "choice concept", "two options", "mood rating",
          "user feedback", "business rating", "quality evaluation", "sentiment analysis", "good and bad",
          "copy space", "conceptual hands", "review concept", "customer service", "client satisfaction",
          "mental wellness", "decision making", "pebble tokens", "rating scale", "survey concept",
          "optimism vs pessimism", "emotional balance", "feedback assessment", "service quality", "business concept"
        ],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      },
      {
        id: 5,
        seoTitle: "Modern Telecom 5G Cellular Tower Antenna Isolated on White Background",
        category: "Technology / Telecom",
        aspectRatio: "3:2",
        prompt: "Commercial 3:2 stock photograph of a modern telecommunication cellular antenna mast tower with high-tech transmitters and microwave dish receivers, perfectly isolated on a pure clean white studio background with abundant copy space, sharp focus, 8k resolution, photorealistic, clean technological cutout asset, no people.",
        negativePrompt: "people, human face, cluttered sky, wires mess, watermark, blurry",
        keywords: [
          "telecom tower", "5g antenna", "cellular mast", "isolated on white", "mobile network",
          "communication tower", "telecommunication", "wireless technology", "5g network", "copy space",
          "radio antenna", "transmitter mast", "base station", "telecom infrastructure", "microwave dish",
          "cell phone tower", "broadband", "network transmitter", "digital communication", "smart city telecom",
          "signal broadcast", "cellular network", "mobile communication", "telephony", "high tech equipment",
          "satellite receiver", "connectivity", "telecom equipment", "isolated tech", "cutout antenna",
          "network tower", "communication infrastructure", "radio mast", "data transmission", "5g technology"
        ],
        modelUsed: "recraft/recraft-v4.1-flash",
        costEstimate: "~$0.007 / image",
      }
    ];

  return {
    trend,
    items: rawItems.map((item) => ({
      ...item,
      filename: generateUniqueStockFilename(item.seoTitle, item.id),
    })),
  };
}
