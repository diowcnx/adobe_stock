export interface MarketTrend {
  theme: string;
  targetMarket: string;
  commercialReasoning: string;
  seasonalRelevance: string;
  buyerDemandRating: "High" | "Very High" | "Trending Commercial" | "Research Candidate";
}

export interface StockImageItem {
  id: number;
  seoTitle: string;
  category: string;
  aspectRatio: "16:9" | "3:2" | "4:5" | "1:1";
  composition?: "artwork" | "advertising" | "asset";
  prompt: string;
  negativePrompt?: string;
  keywords: string[];
  modelUsed: string;
  filename?: string;
  isTransparent?: boolean;
  generationMode?: "transparent_png" | "regular_scene";
  imageUrl?: string;
  imageBase64?: string;
  costEstimate?: string;
  description?: string;
}

export interface OpenRouterCreditInfo {
  totalCredits: number;
  totalUsage: number;
  remainingCredits: number;
  label?: string;
  isFreeTier?: boolean;
}

export interface WorkflowResult {
  success: boolean;
  timestamp: string;
  generationMode?: "transparent_png" | "regular_scene";
  trend: MarketTrend;
  images: StockImageItem[];
  credits: OpenRouterCreditInfo;
  emailDelivery: {
    success: boolean;
    recipient: string;
    messageId?: string;
    error?: string;
  };
  durationMs: number;
}
