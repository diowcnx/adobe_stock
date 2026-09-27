export interface MarketTrend {
  theme: string;
  targetMarket: string;
  commercialReasoning: string;
  seasonalRelevance: string;
  buyerDemandRating: "High" | "Very High" | "Trending Commercial";
}

export interface StockImageItem {
  id: number;
  seoTitle: string;
  category: string;
  aspectRatio: "16:9" | "3:2" | "4:5" | "1:1";
  prompt: string;
  negativePrompt?: string;
  keywords: string[];
  modelUsed: string;
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
