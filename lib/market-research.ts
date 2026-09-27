import { callOpenRouterJSON } from "./openrouter";
import { MarketTrend, StockImageItem } from "./types";

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
You are an expert Adobe Stock commercial photography consultant, top-earning stock contributor, and SEO metadata specialist.
Your mission is to identify high-converting, guaranteed-to-sell stock photo topics for current and upcoming seasons (1-3 months ahead for commercial advertising buyers globally: Asia, Europe, Middle East, Americas, etc.).

CRITICAL ADOBE STOCK REQUIREMENTS:
1. Commercial Usability: Every image MUST have "copy space" (clean negative space for typography, banners, headlines) or contextual authenticity.
2. Zero Copyright/IP: Absolutely NO brand logos, recognizable trademarks, copyrighted character designs, or branded devices.
3. 5 Distinct Prompts: All 5 prompts must target the same broad winning niche but feature completely different photographic angles, subjects, or compositions:
   - Image 1: Landscape (16:9) - Wide commercial banner, environmental context, plenty of copy space.
   - Image 2: Classic Stock (3:2) - Professional authentic interaction, commercial lifestyle or business.
   - Image 3: Portrait / Social (4:5) - Human emotion, genuine expression, warm natural lighting.
   - Image 4: Flat Lay / Macro (1:1 or 3:2) - Curated props, clean aesthetic, top-down or close-up detail.
   - Image 5: Documentary / In-action (3:2) - Candid, dynamic, modern storytelling, authentic cultural or workplace moment.
4. SEO Metadata per image:
   - SEO Title: 5 to 10 words, clear, concise, descriptive, containing the primary keyword naturally.
5. Model Choice: Choose the most fitting model for each prompt:
   - 'recraft/recraft-v4.1-flash' (Recraft V4.1 Flash - best for commercial design, flat lay, product aesthetics, clean studio background, modern stock styling)
   - 'google/gemini-2.5-flash-image' (Gemini 2.5 Flash Image - best for cinematic landscapes, lifestyle, human emotions, realistic outdoor lighting)

OUTPUT FORMAT: Strict JSON matching the requested schema.
`;

export async function conductMarketResearchAndGeneratePrompts(
  currentDate: string = new Date().toISOString()
): Promise<{ trend: MarketTrend; items: StockImageItem[] }> {
  const userPrompt = `
Current Date: ${currentDate}.
Please conduct comprehensive market research on current high-demand commercial stock imagery.
Consider upcoming holidays, cultural events, corporate quarters, and evergreen commercial demand (Healthcare, Clean Tech & AI, Authentic Asian/Global Lifestyles, Senior Care, Sustainable Living, Festive Celebrations).
Find a specific market niche with confirmed buyer demand worldwide.

Generate:
1. The market trend analysis (theme, target market, commercial reasoning, seasonal relevance, demand rating).
2. Exactly 5 distinct, high-quality image prompts with aspect ratios (16:9, 3:2, 4:5, 1:1), SEO titles, categories, and 40-50 keywords each.

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
      "prompt": "Full detailed photorealistic prompt with camera settings, lighting, composition, copy space...",
      "negativePrompt": "blurry, deformed, logos, text, watermark, bad hands",
      "keywords": ["keyword1", "keyword2", ... 40-50 keywords],
      "compositionStyle": "Wide Landscape Banner",
      "modelSuggestion": "google/gemini-2.5-flash-image"
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

    const items: StockImageItem[] = data.prompts.map((p) => ({
      id: p.id,
      seoTitle: p.seoTitle,
      category: p.category,
      aspectRatio: p.aspectRatio,
      prompt: p.prompt,
      negativePrompt: p.negativePrompt,
      keywords: p.keywords,
      modelUsed: p.modelSuggestion || "recraft/recraft-v4.1-flash",
      costEstimate: (p.modelSuggestion && p.modelSuggestion.includes("recraft")) ? "~$0.007 / image" : "~$0.00003 / image",
    }));

    return {
      trend: data.trend,
      items,
    };
  } catch (error) {
    console.error("OpenRouter market research error, falling back to curated market data:", error);
    return getFallbackMarketData();
  }
}

/**
 * Fallback dataset curated for Adobe Stock commercial demand
 */
function getFallbackMarketData(): { trend: MarketTrend; items: StockImageItem[] } {
  return {
    trend: {
      theme: "Sustainable Asian Agri-Tech & Smart Farming Innovation",
      targetMarket: "Global Commercial, Southeast Asia & Modern ESG Agribusiness",
      commercialReasoning: "Massive surge in corporate ESG reports, sustainable agriculture investment, and modern smart food supply chain imagery with high demand across APAC and Europe.",
      seasonalRelevance: "Upcoming Q4 Harvest Season & Year-end Sustainability Annual Reports",
      buyerDemandRating: "Very High",
    },
    items: [
      {
        id: 1,
        seoTitle: "Smart Greenhouse with Automated Hydroponics and Clean Copy Space",
        category: "Agriculture / Technology",
        aspectRatio: "16:9",
        prompt: "Ultra-wide 16:9 commercial photograph of a state-of-the-art sustainable vertical greenhouse with vibrant green hydroponic crops, subtle automated drone sensor light, soft natural diffused daylight through glass ceiling, vast clean negative copy space on the right side for editorial text, 8k resolution, shot on Hasselblad H6D-100c, clean, sharp focus.",
        negativePrompt: "distorted, watermark, logos, text, blurry, messy",
        keywords: [
          "smart farming", "hydroponics", "sustainable agriculture", "greenhouse", "agritech",
          "vertical farming", "clean energy", "organic food", "copy space", "modern agriculture",
          "food security", "technology in farming", "innovation", "automation", "indoor farming",
          "fresh produce", "vegetables", "eco friendly", "environmental sustainability", "future farming",
          "horticulture", "botanical", "agribusiness", "commercial agriculture", "green technology",
          "sustainable living", "asian agriculture", "precision farming", "clean background", "agricultural science",
          "botany", "crop cultivation", "healthy nutrition", "smart industry", "green economy",
          "esg report", "nature and technology", "high tech farming", "farming solutions", "modern greenhouse",
          "leafy greens", "agriculture banner", "growth", "cultivation", "vertical garden", "agritech banner"
        ],
        modelUsed: "google/gemini-2.5-flash-image",
        costEstimate: "~$0.00003 / image",
      },
      {
        id: 2,
        seoTitle: "Young Asian Agricultural Engineer Inspecting Crops with Tablet",
        category: "Business / Science & Technology",
        aspectRatio: "3:2",
        prompt: "Commercial 3:2 medium shot of a confident young Asian female agricultural scientist in modern field vest holding a digital tablet examining lush green tea plantation leaves, warm golden hour sun flare in the background, authentic cheerful expression, professional corporate stock quality, photorealistic, Canon EOS R5 85mm f/1.4 lens, natural cinematic bokeh.",
        negativePrompt: "deformed fingers, extra limbs, artificial look, logo, watermark",
        keywords: [
          "agricultural engineer", "asian scientist", "smart farming tablet", "crop inspection", "sustainable farm",
          "female agronomist", "golden hour", "tea plantation", "modern technology", "field research",
          "data analysis", "eco agriculture", "plant science", "agribusiness professional", "environmental science",
          "renewable future", "young entrepreneur", "rural development", "precision agriculture", "bio research",
          "organic inspection", "green future", "farming lifestyle", "authentic worker", "asia pacific",
          "professional woman", "modern farming", "agricultural technology", "cultivation inspection", "food industry",
          "sustainable development", "fieldwork", "nature inspection", "commercial stock photo", "real expression",
          "healthy crops", "farm management", "esg agriculture", "crop monitoring", "smart device in farm"
        ],
        modelUsed: "google/gemini-2.5-flash-image",
        costEstimate: "~$0.00003 / image",
      },
      {
        id: 3,
        seoTitle: "Close Up Hands of Senior Farmer Holding Organic Soil with Sprout",
        category: "Nature / Lifestyle",
        aspectRatio: "4:5",
        prompt: "Inspiring 4:5 vertical portrait composition focusing on weathered hands of a senior farmer gently cradling rich fertile dark organic soil with a vibrant young green seedling sprout, soft diffused morning sunlight, rich earthy textures, symbol of hope and sustainable growth, photorealistic, 50mm f/1.8 macro lens, highly detailed skin texture.",
        negativePrompt: "extra fingers, deformed hands, cartoon, text, watermark",
        keywords: [
          "hands holding soil", "seedling", "new growth", "organic soil", "senior farmer",
          "sprout", "sustainability", "nature conservation", "earth care", "gardening",
          "agriculture hands", "fertile earth", "hope", "future generations", "eco concept",
          "planting tree", "environmental protection", "biodiversity", "reforestation", "rural wisdom",
          "farming tradition", "green sprout", "life beginning", "clean agriculture", "soil health",
          "regenerative farming", "world environment day", "earth day", "organic gardening", "eco friendly",
          "cultivating life", "botanical sprout", "spring growth", "macro soil", "texture",
          "close up hands", "sustainable future", "care and protection", "global conservation", "living nature"
        ],
        modelUsed: "google/gemini-2.5-flash-image",
        costEstimate: "~$0.00003 / image",
      },
      {
        id: 4,
        seoTitle: "Flat Lay Composition of Fresh Harvest Vegetables on Wooden Table",
        category: "Food & Beverage / Backgrounds",
        aspectRatio: "1:1",
        prompt: "Elegant 1:1 top-down flat lay photograph of vibrant freshly harvested farm vegetables (organic heirloom tomatoes, crisp kale, purple radishes, baby carrots, herbs) arranged neatly on a rustic distressed wooden farmhouse table, with generous clean negative copy space in the center, soft natural window light from the left, food magazine editorial styling.",
        negativePrompt: "plastic, fake vegetables, bad lighting, text, watermark",
        keywords: [
          "vegetable flat lay", "organic harvest", "fresh produce", "copy space", "farmers market",
          "wooden table", "healthy food", "raw ingredients", "culinary background", "nutrition",
          "heirloom vegetables", "clean eating", "vegan lifestyle", "farm to table", "food styling",
          "tomatoes and greens", "dietary food", "harvest basket", "organic agriculture", "superfood",
          "rustic tabletop", "food editorial", "healthy cooking", "gourmet ingredients", "balanced diet",
          "fresh vegetables", "natural food", "autumn harvest", "market display", "food photography",
          "colorful vegetables", "sustainable dining", "wholesome nutrition", "farm kitchen", "top view"
        ],
        modelUsed: "google/gemini-2.5-flash-image",
        costEstimate: "~$0.00003 / image",
      },
      {
        id: 5,
        seoTitle: "Modern Solar Powered Water Irrigation System in Commercial Rice Field",
        category: "Environment / Technology",
        aspectRatio: "3:2",
        prompt: "Documentary style 3:2 landscape shot of modern photovoltaic solar panels installed alongside a clean water irrigation pump canal in a vast vibrant green terraced rice field during blue hour dawn, clear reflection of morning sky in the water, innovative green energy in rural agriculture, photorealistic, sharp focus, cinematic lighting.",
        negativePrompt: "smudged, blurry, oversaturated, deformed, watermark",
        keywords: [
          "solar irrigation", "clean energy farming", "photovoltaic panels", "rice fields", "solar powered pump",
          "sustainable energy", "agrivoltaics", "renewable energy", "green farming", "water canal",
          "terraced field", "blue hour", "dawn landscape", "asia agriculture", "eco technology",
          "carbon neutral", "rural innovation", "irrigation system", "environmental technology", "esg",
          "modern rice farming", "clean water", "energy transition", "farming infrastructure", "asian landscape",
          "sunrise agricultural", "climate change solution", "nature and energy", "sustainable investment", "green power"
        ],
        modelUsed: "google/gemini-2.5-flash-image",
        costEstimate: "~$0.00003 / image",
      }
    ]
  };
}
