import assert from "node:assert/strict";
import test from "node:test";
import { conductMarketResearchAndGeneratePrompts } from "../lib/market-research";
import { isStockImageItem } from "../lib/validation";
import { getGenerationBlockReason } from "../lib/generation-policy";
import { generateSingleImage } from "../lib/image-generator";
import { generateMetadataCsv } from "../lib/csv";

test("all 31 daily plans produce valid JPEG briefs without paid planning or concept conversion", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Planning must not make a network call"); };
  try {
    for (let day = 1; day <= 31; day++) {
      const result = await conductMarketResearchAndGeneratePrompts(new Date(Date.UTC(2026, 9, day, 5)).toISOString());
      assert.equal(result.items.length, 10);
      assert.equal(result.conceptPlan.transparentPngCount, 0);
      assert.equal(result.conceptPlan.enabled, false);
      for (const item of result.items) {
        assert.equal(item.generationMode, "regular_scene");
        assert.equal(item.isTransparent, false);
        assert.equal(item.conceptStructure, undefined);
        assert.match(item.prompt, /No visible human faces anywhere/);
        assert.match(item.prompt, /Set this photograph in contemporary Thailand/);
        assert.ok(item.keywords.includes("Thailand"));
        assert.match(item.seoTitle, /in Thailand$/);
        assert.match(item.negativePrompt || "", /visible human face/);
        assert.equal(isStockImageItem(item), true);
        assert.equal(getGenerationBlockReason(item), undefined);
        assert.match(item.filename || "", /\.jpeg$/);
        const subjectTitle = item.seoTitle.replace(/ in Thailand$/, "");
        assert.ok(item.prompt.includes(subjectTitle.charAt(0).toLowerCase() + subjectTitle.slice(1)));
      }
      assert.doesNotMatch(generateMetadataCsv(result.items, result.mode), /\.png/);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("forced PNG plans and stale browser briefs cannot spend credits", async () => {
  await assert.rejects(conductMarketResearchAndGeneratePrompts(undefined, "transparent_png"), /PNG generation has been disabled/);
  const { items } = await conductMarketResearchAndGeneratePrompts();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Unexpected billed request"); };
  try {
    const stale = { ...items[0], generationBriefVersion: undefined };
    const result = await generateSingleImage(stale, "test-key");
    assert.equal(result.imageUrl, "");
    assert.match(result.error || "", /retired generation brief/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
