import assert from "node:assert/strict";
import test from "node:test";
import { summarizeConceptMix } from "../lib/concept-mix";
import { generateMetadataCsv } from "../lib/csv";
import { conductMarketResearchAndGeneratePrompts } from "../lib/market-research";
import { isWorkflowResult } from "../lib/validation";
import type { MaterialStructure, StockImageItem, WorkflowResult } from "../lib/types";

const MATERIAL_FIELDS: Array<keyof MaterialStructure> = [
  "SUBJECT",
  "PRIMARY_MATERIAL",
  "SECONDARY_MATERIAL",
  "BACKGROUND",
  "SHADOW_STYLE",
  "VISUAL_STYLE",
  "COMMERCIAL_CONCEPT",
];

function keywords(prefix: string): string[] {
  return Array.from({ length: 15 }, (_, index) => `${prefix} keyword ${index + 1}`);
}

function mockedPlan() {
  return {
    existingConcepts: Array.from({ length: 5 }, (_, index) => ({
      title: `Distinct Botanical Asset ${index + 1}`,
      subject: `Detailed botanical ingredient number ${index + 1} with a unique closed silhouette and accurate natural structure`,
      buyerUse: `Packaging designer use case number ${index + 1}`,
      differentiation: `Different plant structure and practical packaging role number ${index + 1}`,
      keywords: keywords(`botanical ${index + 1}`),
    })),
    materialConcepts: Array.from({ length: 5 }, (_, index) => ({
      title: `Material Campaign Scene ${index + 1}`,
      buyerUse: `Commercial campaign application number ${index + 1}`,
      differentiation: `A distinct product category and construction detail number ${index + 1}`,
      materialStructure: {
        SUBJECT: `Unbranded product subject number ${index + 1} with credible functional construction`,
        PRIMARY_MATERIAL: `Primary natural material number ${index + 1}`,
        SECONDARY_MATERIAL: `Compatible secondary material number ${index + 1}`,
        BACKGROUND: `Quiet mineral background number ${index + 1}`,
        SHADOW_STYLE: `Soft directional side shadow number ${index + 1}`,
        VISUAL_STYLE: `Tactile commercial editorial style number ${index + 1}`,
        COMMERCIAL_CONCEPT: `Buyer campaign concept number ${index + 1}`,
      },
      keywords: keywords(`material ${index + 1}`),
    })),
  };
}

function assertExactMixedBatch(items: StockImageItem[], batchMode: "transparent_png" | "regular_scene") {
  assert.equal(items.length, 10);
  assert.deepEqual(items.map((item) => item.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(new Set(items.map((item) => item.filename)).size, 10);
  assert.equal(items.filter((item) => item.conceptMode === "existing").length, 5);
  assert.equal(items.filter((item) => item.conceptMode === "material_concept").length, 5);

  for (const item of items) {
    assert.ok(item.keywords.length >= 15 && item.keywords.length <= 25);
    if (item.conceptMode === "material_concept") {
      assert.equal(item.generationMode, "regular_scene");
      assert.equal(item.aspectRatio, "16:9");
      assert.equal(item.composition, "advertising");
      assert.match(item.filename || "", /\.jpeg$/);
      assert.match(item.prompt, /55% deliberate clean copy space/);
      assert.ok(item.materialStructure);
      for (const field of MATERIAL_FIELDS) assert.ok(item.materialStructure?.[field]);
    } else {
      assert.equal(item.generationMode, batchMode);
      assert.match(item.filename || "", batchMode === "transparent_png" ? /\.png$/ : /\.jpeg$/);
    }
  }
}

test("mocked planner produces exactly five existing and five material concepts", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalFlag = process.env.ENABLE_MATERIAL_MIX;
  process.env.OPENROUTER_API_KEY = "test-only-key";
  process.env.ENABLE_MATERIAL_MIX = "true";
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(mockedPlan()) } }],
  }), { status: 200, headers: { "content-type": "application/json" } });

  try {
    const result = await conductMarketResearchAndGeneratePrompts("2026-10-04T05:00:00.000Z", "transparent_png");
    assertExactMixedBatch(result.items, "transparent_png");
    assert.deepEqual(result.conceptMix, {
      enabled: true,
      existingCount: 5,
      materialConceptCount: 5,
      transparentPngCount: 5,
      regularSceneCount: 5,
    });

    const csv = generateMetadataCsv(result.items, result.mode);
    assert.equal(csv.split("\r\n").length, 11);
    for (const item of result.items) assert.ok(csv.includes(item.filename || ""));

    const workflow: WorkflowResult = {
      success: true,
      timestamp: "2026-10-04T05:00:00.000Z",
      generationMode: result.mode,
      conceptMix: result.conceptMix,
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
    if (originalFlag === undefined) delete process.env.ENABLE_MATERIAL_MIX; else process.env.ENABLE_MATERIAL_MIX = originalFlag;
  }
});

test("curated fallback retains an exact 5:5 batch without an API key", async () => {
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalFlag = process.env.ENABLE_MATERIAL_MIX;
  delete process.env.OPENROUTER_API_KEY;
  process.env.ENABLE_MATERIAL_MIX = "true";
  try {
    const first = await conductMarketResearchAndGeneratePrompts("2026-10-04T05:00:00.000Z", "transparent_png");
    const retry = await conductMarketResearchAndGeneratePrompts("2026-10-04T05:00:00.000Z", "transparent_png");
    assertExactMixedBatch(first.items, "transparent_png");
    assert.ok(first.items.every((item) => item.planningSource === "curated_fallback"));
    assert.deepEqual(
      first.items.map((item) => [item.conceptMode, item.seoTitle]),
      retry.items.map((item) => [item.conceptMode, item.seoTitle]),
    );
  } finally {
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.ENABLE_MATERIAL_MIX; else process.env.ENABLE_MATERIAL_MIX = originalFlag;
  }
});

test("rollback flag restores ten legacy concepts", async () => {
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalFlag = process.env.ENABLE_MATERIAL_MIX;
  delete process.env.OPENROUTER_API_KEY;
  process.env.ENABLE_MATERIAL_MIX = "false";
  try {
    const result = await conductMarketResearchAndGeneratePrompts("2026-10-04T05:00:00.000Z", "transparent_png");
    assert.equal(result.items.length, 10);
    assert.ok(result.items.every((item) => item.conceptMode === "existing"));
    assert.ok(result.items.every((item) => item.generationMode === "transparent_png"));
    assert.deepEqual(summarizeConceptMix(result.items, result.mode), {
      enabled: false,
      existingCount: 10,
      materialConceptCount: 0,
      transparentPngCount: 10,
      regularSceneCount: 0,
    });
  } finally {
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.ENABLE_MATERIAL_MIX; else process.env.ENABLE_MATERIAL_MIX = originalFlag;
  }
});

test("all 31 monthly themes keep valid 5:5 fallback metadata and composition rules", async () => {
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalFlag = process.env.ENABLE_MATERIAL_MIX;
  const originalWarn = console.warn;
  delete process.env.OPENROUTER_API_KEY;
  process.env.ENABLE_MATERIAL_MIX = "true";
  console.warn = () => undefined;
  try {
    for (let day = 1; day <= 31; day += 1) {
      const date = new Date(Date.UTC(2026, 9, day, 5)).toISOString();
      const result = await conductMarketResearchAndGeneratePrompts(date);
      assertExactMixedBatch(result.items, result.mode);
      for (const item of result.items.filter((candidate) => candidate.conceptMode === "existing")) {
        if (item.composition === "asset" || item.composition === "artwork") {
          assert.doesNotMatch(item.prompt, /55% deliberate clean copy space/);
        }
      }
    }
  } finally {
    console.warn = originalWarn;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.ENABLE_MATERIAL_MIX; else process.env.ENABLE_MATERIAL_MIX = originalFlag;
  }
});
