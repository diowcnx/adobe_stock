export interface MarketTrend {
  theme: string;
  targetMarket: string;
  commercialReasoning: string;
  seasonalRelevance: string;
  buyerDemandRating: "High" | "Very High" | "Trending Commercial" | "Research Candidate";
}

export type GenerationMode = "transparent_png" | "regular_scene";
export type ConceptMode = "existing" | "structured_concept";
export type PlanningSource = "ai" | "curated_fallback";
export type ConceptStructureType = "thai_editorial_still_life_v1";

export interface ThaiEditorialStillLifeStructure {
  CAMPAIGN_THEME: string;
  MAIN_CONCEPT: string;
  CAMERA_ANGLE: string;
  LENS_TYPE: string;
  SHOT_TYPE: string;
  LIGHTING: string;
  BACKGROUND_BASE: string;
  BACKGROUND_TEXTURE: string;
  BACKGROUND_DETAILS: string;
  CENTRAL_INSTALLATION: string;
  PRIMARY_COMPONENTS: string;
  SUPPORTING_ACCENT_1: string;
  SUPPORTING_ACCENT_2: string;
  MATERIAL_FOCUS: string;
  COMPOSITION_LOGIC: string;
  ATMOSPHERIC_STYLE: string;
  COLOR_PALETTE: string;
  TEXT_ELEMENTS: string;
}

export interface ConceptStructurePayload {
  type: ConceptStructureType;
  fields: ThaiEditorialStillLifeStructure;
}

export interface ConceptPlanSummary {
  enabled: boolean;
  structuredCount: number;
  legacyCount: number;
  transparentPngCount: number;
  regularSceneCount: number;
  structureType: ConceptStructureType | null;
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
  conceptStructure?: ConceptStructurePayload;
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
  conceptPlan?: ConceptPlanSummary;
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
