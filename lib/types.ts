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

export interface CommercialIntent {
  targetBuyer: string;
  intendedUse: string;
  purchaseReason: string;
}

export interface ConceptPlanSummary {
  enabled: boolean;
  structuredCount: number;
  legacyCount: number;
  transparentPngCount: number;
  regularSceneCount: number;
  structureType: ConceptStructureType | null;
}

export type ImageQualityStatus =
  | "passed"
  | "passed_after_retries"
  | "accepted_after_retry_limit";

export interface ImageQualityReview {
  status: ImageQualityStatus;
  attempts: number;
  rejectionCount: number;
  rejectionReasons: string[];
}

export interface FoodFusionStructure {
  CONCEPT_THEME: string;
  ORGANIC_FOOD_PART: string;
  MECHANICAL_HARDWARE_PART: string;
  PLACEMENT_AND_ANGLE: string;
  BACKGROUND_SURFACE: string;
  LIGHTING_AND_MOOD: string;
  COLOR_PALETTE: string;
}

export interface StockImageItem {
  masterplanStructure?: ResortMasterplanStructure;
  boothStructure?: ExhibitionBoothStructure;
  fusionStructure?: FoodFusionStructure;
  generationBriefVersion?: string;
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
  commercialIntent?: CommercialIntent;
  planningSource?: PlanningSource;
  imageUrl?: string;
  imageBase64?: string;
  costEstimate?: string;
  description?: string;
  qualityReview?: ImageQualityReview;
}

export interface ResortMasterplanStructure {
  PROJECT_THEME: string;
  PROJECT_TITLE: string;
  VIEW_AND_PERSPECTIVE: string;
  LINEWORK_AND_TINT_STYLE: string;
  WATERPARK_AND_AMENITY_ZONE: string;
  ACCOMMODATION_AND_STRUCTURES: string;
  LANDSCAPE_AND_TERRAIN: string;
  COLOR_PALETTE: string;
}

export interface ExhibitionBoothStructure {
  BOOTH_CONCEPT: string;
  VIEW_ANGLE: string;
  BACKGROUND_STYLE: string;
  BOOTH_STRUCTURE: string;
  PRIMARY_SIGNAGE: string;
  GRAPHIC_BACKDROP: string;
  DECORATIVE_MARKS: string;
  LEFT_FEATURE_ELEMENT: string;
  RIGHT_FEATURE_ELEMENT: string;
  DISPLAY_FIXTURES: string;
  PRODUCT_DISPLAY: string;
  MATERIAL_PALETTE: string;
  SIDE_DECORATION: string;
  FLOOR_TREATMENT: string;
  LIGHTING_STYLE: string;
  DESIGN_FOCUS: string;
  VISUAL_STYLE: string;
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
