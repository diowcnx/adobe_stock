import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareManualResearchItems } from "../lib/manual-research";
import { getGenerationBlockReason } from "../lib/generation-policy";
import { isStockImageItem } from "../lib/validation";

test("the research file creates ten valid distinct manual JPEG briefs", async () => {
  const items = await prepareManualResearchItems(new Date("2026-10-28T12:00:00Z"));
  assert.equal(items.length, 10);
  assert.equal(new Set(items.map(item => item.prompt)).size, 10);
  for (const item of items) {
    assert.equal(isStockImageItem(item), true, item.seoTitle);
    assert.equal(getGenerationBlockReason(item), undefined);
    assert.equal(item.generationMode, "regular_scene");
    assert.ok(item.keywords.length >= 15 && item.keywords.every(keyword => /^[a-z]+$/.test(keyword)), item.seoTitle);
  }
});
