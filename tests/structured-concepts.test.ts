import assert from "node:assert/strict";
import test from "node:test";
import { generateMetadataCsv } from "../lib/csv";
import { conductMarketResearchAndGeneratePrompts } from "../lib/market-research";
import {
  summarizeConceptPlan,
  THAI_EDITORIAL_STILL_LIFE_FIELDS,
  THAI_EDITORIAL_STILL_LIFE_TYPE,
} from "../lib/structured-concepts";
import { isWorkflowResult } from "../lib/validation";
import type { StockImageItem, ThaiEditorialStillLifeStructure, WorkflowResult } from "../lib/types";

function keywords(prefix: string): string[] {
  return Array.from({ length: 15 }, (_, index) => `${prefix} keyword ${index + 1}`);
}

function structure(index: number): ThaiEditorialStillLifeStructure {
  const isTransparent = index <= 6;
  return {
    CAMPAIGN_THEME: `Thai material story campaign number ${index}`,
    MAIN_CONCEPT: isTransparent ? `One literal useful household object number ${index}` : `A parent preparing a child safely for rainy weather number ${index}`,
    CAMERA_ANGLE: `Unique camera angle treatment number ${index}`,
    LENS_TYPE: `Macro lens treatment with material detail number ${index}`,
    SHOT_TYPE: `Editorial advertising still life format number ${index}`,
    LIGHTING: `Controlled studio light direction number ${index}`,
    BACKGROUND_BASE: isTransparent ? `Matte background material number ${index}` : `Recognizable home entry setting number ${index}`,
    BACKGROUND_TEXTURE: isTransparent ? `Tactile background texture number ${index}` : `Real painted wall and wooden floor number ${index}`,
    BACKGROUND_DETAILS: isTransparent ? `Restrained background detail number ${index}` : `Closed umbrella and rain boots for context number ${index}`,
    CENTRAL_INSTALLATION: isTransparent ? `One matte ceramic household object number ${index}` : `Parent fastening a child's raincoat before a walk number ${index}`,
    PRIMARY_COMPONENTS: isTransparent ? `One solid opaque ceramic subject number ${index}` : `Raincoat and practical entryway clothing number ${index}`,
    SUPPORTING_ACCENT_1: isTransparent ? `None for isolated object number ${index}` : `One closed umbrella number ${index}`,
    SUPPORTING_ACCENT_2: isTransparent ? `No supporting accent for object number ${index}` : `No decorative accent number ${index}`,
    MATERIAL_FOCUS: isTransparent ? `Solid opaque ceramic surface detail number ${index}` : `Real skin fabric and clothing detail number ${index}`,
    COMPOSITION_LOGIC: `Intentional asymmetric layout and copy space number ${index}`,
    ATMOSPHERIC_STYLE: `Refined editorial atmosphere number ${index}`,
    COLOR_PALETTE: `Distinct coordinated color palette number ${index}`,
    TEXT_ELEMENTS: `No rendered text; reserve clean copy space number ${index} for later typography`,
  };
}

function mockedPlan() {
  return {
    concepts: Array.from({ length: 10 }, (_, index) => ({
      title: `Buyer Context Editorial Material Story ${index + 1}`,
      targetBuyer: `Commercial design buyer segment number ${index + 1}`,
      intendedUse: `Campaign hero and article opener application number ${index + 1}`,
      purchaseReason: `Distinctive tactile story with flexible copy space and crop utility number ${index + 1}`,
      differentiation: `A unique installation material and camera treatment number ${index + 1}`,
      structure: structure(index + 1),
      keywords: keywords(`editorial ${index + 1}`),
    })),
  };
}

function assertStructuredBatch(items: StockImageItem[]) {
  assert.equal(items.length, 10);
  assert.deepEqual(items.map((item) => item.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(new Set(items.map((item) => item.filename)).size, 10);
  assert.ok(items.every((item) => item.conceptMode === "structured_concept"));
  assert.equal(new Set(items.map((item) => item.seoTitle)).size, 10);

  assert.equal(items.filter((item) => item.generationMode === "transparent_png").length, 6);
  assert.equal(items.filter((item) => item.generationMode === "regular_scene").length, 4);

  for (const item of items) {
    const isTransparent = item.generationMode === "transparent_png";
    assert.equal(item.isTransparent, isTransparent);
    assert.equal(item.composition, isTransparent ? "asset" : "advertising");
    assert.match(item.filename || "", isTransparent ? /\.png$/ : /\.jpeg$/);
    assert.ok(item.keywords.length >= 15 && item.keywords.length <= 25);
    assert.equal(item.conceptStructure?.type, THAI_EDITORIAL_STILL_LIFE_TYPE);
    assert.ok(item.commercialIntent?.targetBuyer);
    assert.ok(item.commercialIntent?.intendedUse);
    assert.ok(item.commercialIntent?.purchaseReason);
    assert.doesNotMatch(item.commercialIntent?.purchaseReason || "", /guaranteed|will sell|low competition|high demand|best.?seller/i);
    assert.equal(Object.keys(item.conceptStructure?.fields || {}).length, 18);
    for (const field of THAI_EDITORIAL_STILL_LIFE_FIELDS) assert.ok(item.conceptStructure?.fields[field]);
    assert.match(item.conceptStructure?.fields.TEXT_ELEMENTS || "", /(no|without|reserve|copy space)/i);
    assert.match(item.prompt, /Do not render (?:any )?letters, words, numerals,.*logos.*pseudo-text/);
    if (isTransparent) {
      assert.match(item.prompt, /transparent-background commercial design asset/i);
      assert.match(item.prompt, /exactly one familiar, concrete, immediately recognizable object/i);
      assert.match(item.prompt, /solid opaque materials/i);
      assert.doesNotMatch(item.prompt, /Primary components:|Supporting details:/i);
      assert.match(item.prompt, /No floor, wall, horizon/i);
      assert.ok(item.keywords.includes("transparent png"));
    } else {
      assert.match(item.prompt, /full-bleed photograph/);
      assert.match(item.prompt, /viewer must identify the subject, action and purpose within two seconds/i);
      assert.match(item.prompt, /Do not create an abstract still life/i);
      assert.match(item.prompt, /no frame, mat, white margin, canvas border, inset image, poster layout or page mockup/i);
    }
    assert.doesNotMatch(item.prompt, /Create an original Thai editorial/i);
    assert.match(item.prompt, /Do not default to Thailand/i);
    assert.doesNotMatch(item.prompt, /reserve clean copy space number/i);
  }
}

test("mocked planner produces ten validated 18-field Editorial Still Life concepts", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalFlag = process.env.ENABLE_STRUCTURED_CONCEPTS;
  process.env.OPENROUTER_API_KEY = "test-only-key";
  process.env.ENABLE_STRUCTURED_CONCEPTS = "true";
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(mockedPlan()) } }],
  }), { status: 200, headers: { "content-type": "application/json" } });

  try {
    const result = await conductMarketResearchAndGeneratePrompts("2026-10-04T05:00:00.000Z", "transparent_png");
    assertStructuredBatch(result.items);
    assert.equal(result.mode, "regular_scene");
    assert.deepEqual(result.conceptPlan, {
      enabled: true,
      structuredCount: 10,
      legacyCount: 0,
      transparentPngCount: 6,
      regularSceneCount: 4,
      structureType: THAI_EDITORIAL_STILL_LIFE_TYPE,
    });

    const csv = generateMetadataCsv(result.items, result.mode);
    assert.equal(csv.split("\r\n").length, 11);
    for (const item of result.items) assert.ok(csv.includes(item.filename || ""));

    const workflow: WorkflowResult = {
      success: true,
      timestamp: "2026-10-04T05:00:00.000Z",
      generationMode: result.mode,
      conceptPlan: result.conceptPlan,
      trend: result.trend,
      images: result.items,
      credits: { totalCredits: 1, totalUsage: 0, remainingCredits: 1 },
      emailDelivery: { success: false, recipient: "test@example.com" },
      durationMs: 1,
    };
    assert.equal(isWorkflowResult(workflow), true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.ENABLE_STRUCTURED_CONCEPTS; else process.env.ENABLE_STRUCTURED_CONCEPTS = originalFlag;
  }
});

test("curated fallback retains ten structured concepts and stable daily ordering", async () => {
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalFlag = process.env.ENABLE_STRUCTURED_CONCEPTS;
  delete process.env.OPENROUTER_API_KEY;
  process.env.ENABLE_STRUCTURED_CONCEPTS = "true";
  try {
    const first = await conductMarketResearchAndGeneratePrompts("2026-10-04T05:00:00.000Z");
    const retry = await conductMarketResearchAndGeneratePrompts("2026-10-04T05:00:00.000Z");
    assertStructuredBatch(first.items);
    assert.ok(first.items.every((item) => item.planningSource === "curated_fallback"));
    assert.deepEqual(first.items.map((item) => item.seoTitle), retry.items.map((item) => item.seoTitle));
  } finally {
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.ENABLE_STRUCTURED_CONCEPTS; else process.env.ENABLE_STRUCTURED_CONCEPTS = originalFlag;
  }
});

test("rollback switch restores the legacy output planner", async () => {
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalFlag = process.env.ENABLE_STRUCTURED_CONCEPTS;
  delete process.env.OPENROUTER_API_KEY;
  process.env.ENABLE_STRUCTURED_CONCEPTS = "false";
  try {
    const result = await conductMarketResearchAndGeneratePrompts("2026-10-04T05:00:00.000Z", "transparent_png");
    assert.equal(result.items.length, 10);
    assert.ok(result.items.every((item) => item.conceptMode === "existing"));
    assert.ok(result.items.every((item) => item.generationMode === "transparent_png"));
    assert.deepEqual(summarizeConceptPlan(result.items, result.mode), {
      enabled: false,
      structuredCount: 0,
      legacyCount: 10,
      transparentPngCount: 10,
      regularSceneCount: 0,
      structureType: null,
    });
  } finally {
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.ENABLE_STRUCTURED_CONCEPTS; else process.env.ENABLE_STRUCTURED_CONCEPTS = originalFlag;
  }
});

test("all 31 buyer contexts keep valid structured fallback metadata", async () => {
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalFlag = process.env.ENABLE_STRUCTURED_CONCEPTS;
  const originalWarn = console.warn;
  delete process.env.OPENROUTER_API_KEY;
  process.env.ENABLE_STRUCTURED_CONCEPTS = "true";
  console.warn = () => undefined;
  try {
    for (let day = 1; day <= 31; day += 1) {
      const date = new Date(Date.UTC(2026, 9, day, 5)).toISOString();
      const result = await conductMarketResearchAndGeneratePrompts(date);
      assertStructuredBatch(result.items);
      assert.equal(result.trend.theme.includes("10 clear buyer-context commercial stories"), true);
    }
  } finally {
    console.warn = originalWarn;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.ENABLE_STRUCTURED_CONCEPTS; else process.env.ENABLE_STRUCTURED_CONCEPTS = originalFlag;
  }
});
