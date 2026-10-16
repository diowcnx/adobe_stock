import assert from "node:assert/strict";
import test from "node:test";
import { conductMarketResearchAndGeneratePrompts } from "../lib/market-research";
import { isStockImageItem } from "../lib/validation";
import { getGenerationBlockReason } from "../lib/generation-policy";
import { generateSingleImage } from "../lib/image-generator";
import { generateMetadataCsv } from "../lib/csv";

test("every batch uses five fusion and five booth briefs without paid planning", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Planning must not make a network call"); };
  try {
    for (let day = 1; day <= 31; day++) {
      const result = await conductMarketResearchAndGeneratePrompts(new Date(Date.UTC(2026, 9, day, 5)).toISOString());
      assert.equal(result.items.length, 10);
      assert.equal(result.conceptPlan.transparentPngCount, 0);
      assert.equal(result.conceptPlan.enabled, false);
      assert.equal(new Set(result.items.map(item => item.seoTitle)).size, 10);
      assert.equal(result.items.filter(item => item.fusionStructure).length, 5);
      assert.equal(result.items.filter(item => item.boothStructure).length, 5);
      assert.deepEqual(result.items.map(item => item.id), [1,2,3,4,5,6,7,8,9,10]);
      assert.equal(new Set(result.items.map(item => item.filename)).size, 10);
      for (const item of result.items) {
        assert.equal(item.generationMode, "regular_scene");
        assert.equal(item.isTransparent, false);
        assert.equal(item.conceptStructure, undefined);
        assert.match(item.prompt, /No visible human faces anywhere/);
        if (item.fusionStructure) {
          assert.equal(Object.keys(item.fusionStructure).length, 7);
          assert.match(item.prompt, /seamless transition joint/);
          assert.match(item.prompt, /soft natural studio contact shadow/);
          assert.ok(item.prompt.includes(item.fusionStructure.ORGANIC_FOOD_PART));
          assert.ok(item.prompt.includes(item.fusionStructure.MECHANICAL_HARDWARE_PART));
        } else {
          assert.equal(Object.keys(item.boothStructure || {}).length, 17);
          assert.match(item.prompt, /straight-on frontal orthographic/);
          assert.match(item.prompt, /PRIMARY_SIGNAGE is a BLANK architectural sign area/);
          assert.doesNotMatch(item.prompt, /Fuse ORGANIC_FOOD_PART/);
          assert.equal(isStockImageItem({ ...item, fusionStructure: result.items.find(entry => entry.fusionStructure)?.fusionStructure }), false);
        }
        assert.doesNotMatch(item.prompt, /Do not reinterpret the subject|Set this photograph in contemporary Thailand/);
        assert.match(item.negativePrompt || "", /visible human face/);
        assert.equal(isStockImageItem(item), true);
        assert.equal(getGenerationBlockReason(item), undefined);
        assert.match(item.filename || "", /\.jpeg$/);
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
