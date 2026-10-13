export interface MarketTrend {
  theme: string;
  targetMarket: string;
  commercialReasoning: string;
  seasonalRelevance: string;
  buyerDemandRating: "High" | "Very High" | "Trending Commercial" | "Research Candidate";
}

export type GenerationMode = "transparent_png" | "regular_scene";
export type ConceptMode = "existing" | "material_concept";
export type PlanningSource = "ai" | "curated_fallback";

export interface MaterialStructure {
  SUBJECT: string;
  PRIMARY_MATERIAL: string;
  SECONDARY_MATERIAL: string;
  BACKGROUND: string;
  SHADOW_STYLE: string;
  VISUAL_STYLE: string;
  COMMERCIAL_CONCEPT: string;
}

export interface ConceptMixSummary {
  enabled: boolean;
  existingCount: number;
  materialConceptCount: number;
  transparentPngCount: number;
  regularSceneCount: number;
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
  generationMode?: GenerationMode;
  conceptMode?: ConceptMode;
  materialStructure?: MaterialStructure;
  planningSource?: PlanningSource;
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
  generationMode?: GenerationMode;
  conceptMix?: ConceptMixSummary;
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
