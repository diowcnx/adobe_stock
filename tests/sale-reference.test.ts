import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSoldReference } from "../lib/sale-reference";
import { getGenerationBlockReason } from "../lib/generation-policy";
import { isStockImageItem } from "../lib/validation";

function referenceDataUrl(): string {
  const bytes = Buffer.alloc(256, 0);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

test("sold reference analysis produces exactly ten valid, distinct JPEG briefs", async () => {
  const originalFetch = global.fetch;
  const concepts = Array.from({ length: 10 }, (_, index) => ({
    title: `Distinct Commercial Subject ${index + 1}`,
    category: "Lifestyle",
    aspectRatio: index % 2 ? "4:5" : "3:2",
    newConcept: `A unique buyer story number ${index + 1} in a different physical setting`,
    targetBuyer: `Buyer ${index + 1}`,
    intendedUse: `Campaign ${index + 1}`,
    purchaseReason: "Clear literal subject and useful layout",
    subjectTreatment: `Subject performing practical action ${index + 1}`,
    compositionAndCamera: `Camera treatment ${index + 1}`,
    settingAndProps: `Setting with relevant props ${index + 1}`,
    lightingAndMood: `Lighting direction ${index + 1}`,
    colorPalette: `Palette ${index + 1}`,
    keywords: ["subject", "commercial", "lifestyle", "campaign", "creative", "modern", "editorial", "advertising", "design", "marketing", "premium", "visual", "concept", "copyspace", "photography"],
  }));
  global.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      subject: "a useful household object",
      visualStrengths: "Immediate clarity and flexible copy space",
      likelyBuyerUses: ["home campaign", "editorial feature"],
      expansionStrategy: "Change story, buyer, setting, camera, light, and palette",
      concepts,
    }) } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const plan = await analyzeSoldReference(referenceDataUrl(), "test-key");
    assert.equal(plan.items.length, 10);
    assert.equal(new Set(plan.items.map(item => item.prompt)).size, 10);
    for (const item of plan.items) {
      assert.equal(item.generationMode, "regular_scene");
      assert.equal(item.filename?.endsWith(".jpeg"), true);
      assert.equal(item.saleReferenceStructure?.TEXT_ELEMENTS, "No text");
      assert.equal(isStockImageItem(item), true);
      assert.equal(getGenerationBlockReason(item), undefined);
      assert.match(item.prompt, /DO NOT COPY/i);
      assert.match(item.prompt, /No text/i);
      assert.match(item.prompt, /visible human faces/i);
      assert.ok(item.keywords.length >= 15 && item.keywords.length <= 25);
      assert.equal(item.keywords.every(keyword => !keyword.includes(" ")), true);
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("sold reference analysis rejects mismatched image content before provider call", async () => {
  let called = false;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    called = true;
    throw new Error("unexpected");
  };
  try {
    const fake = `data:image/png;base64,${Buffer.alloc(256, 1).toString("base64")}`;
    await assert.rejects(() => analyzeSoldReference(fake, "test-key"), /does not match/);
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
  }
});
