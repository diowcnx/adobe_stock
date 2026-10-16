import assert from "node:assert/strict";
import test from "node:test";
import { conductMarketResearchAndGeneratePrompts } from "../lib/market-research";
import { isStockImageItem } from "../lib/validation";
import { getGenerationBlockReason } from "../lib/generation-policy";
import { generateSingleImage } from "../lib/image-generator";
import { generateMetadataCsv } from "../lib/csv";
import { buildExhibitionBoothBatch, BOOTH_RECIPES } from "../lib/exhibition-booth";
import { buildResortMasterplanBatch, MASTERPLAN_RECIPES } from "../lib/resort-masterplan";

test("structures adapt merchandise, buildings, amenities and buyers to their categories", () => {
  const date = new Date("2026-10-16T12:00:00Z");
  const booths = buildExhibitionBoothBatch(date, BOOTH_RECIPES.length);
  const technology = booths.find(item => item.seoTitle.includes("Technology"))!;
  assert.match(technology.boothStructure?.PRODUCT_DISPLAY || "", /sensors/);
  assert.doesNotMatch(technology.boothStructure?.PRODUCT_DISPLAY || "", /baskets|ceramics/);
  assert.match(technology.commercialIntent?.intendedUse || "", /Technology/);
  assert.equal(isStockImageItem(technology), true);

  const plans = buildResortMasterplanBatch(date, MASTERPLAN_RECIPES.length);
  const school = plans.find(item => item.seoTitle.includes("School Campus"))!;
  assert.match(school.masterplanStructure?.ACCOMMODATION_AND_STRUCTURES || "", /classroom/);
  assert.match(school.masterplanStructure?.WATERPARK_AND_AMENITY_ZONE || "", /no swimming pool or waterpark/);
  assert.match(school.commercialIntent?.intendedUse || "", /School Campus/);
  assert.doesNotMatch(school.keywords.join(" "), /resort|waterpark|villa/);
  assert.equal(isStockImageItem(school), true);
  assert.match(school.prompt, /Add pools and slides ONLY when explicitly included/);
});

test("all four structures rotate a 3/3/2/2 split without paid planning", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Planning must not make a network call"); };
  try {
    for (let day = 1; day <= 31; day++) {
      const result = await conductMarketResearchAndGeneratePrompts(new Date(Date.UTC(2026, 9, day, 5)).toISOString());
      assert.equal(result.items.length, 10);
      assert.equal(result.conceptPlan.transparentPngCount, 0);
      assert.equal(result.conceptPlan.enabled, false);
      assert.equal(new Set(result.items.map(item => item.seoTitle)).size, 10);
      const counts = [
        result.items.filter(item => item.fusionStructure).length,
        result.items.filter(item => item.boothStructure).length,
        result.items.filter(item => item.masterplanStructure).length,
        result.items.filter(item => item.materialArtStructure).length,
      ];
      assert.deepEqual([...counts].sort(), [2, 2, 3, 3]);
      assert.equal(counts[day % 4], 3);
      assert.equal(counts[(day + 1) % 4], 3);
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
        } else if (item.boothStructure) {
          assert.equal(Object.keys(item.boothStructure || {}).length, 17);
          assert.match(item.prompt, /straight-on frontal orthographic/);
          assert.match(item.prompt, /PRIMARY_SIGNAGE is a BLANK architectural sign area/);
          assert.doesNotMatch(item.prompt, /Fuse ORGANIC_FOOD_PART/);
          assert.equal(isStockImageItem({ ...item, fusionStructure: result.items.find(entry => entry.fusionStructure)?.fusionStructure }), false);
        } else if (item.masterplanStructure) {
          assert.equal(Object.keys(item.masterplanStructure || {}).length, 8);
          assert.match(item.prompt, /elevated bird's-eye oblique/);
          assert.match(item.prompt, /sparse pale watercolor tints/);
          assert.match(item.prompt, /PROJECT_TITLE is metadata/);
          assert.equal(item.composition, "artwork");
          assert.equal(isStockImageItem({ ...item, boothStructure: result.items.find(entry => entry.boothStructure)?.boothStructure }), false);
          const invalid = { ...item.masterplanStructure, PROJECT_THEME: "" };
          assert.equal(isStockImageItem({ ...item, masterplanStructure: invalid }), false);
        } else {
          assert.equal(Object.keys(item.materialArtStructure || {}).length, 18);
          assert.equal(item.materialArtStructure?.TEXT_ELEMENTS, "No text");
          assert.match(item.prompt, /single clearly readable CENTRAL_INSTALLATION/);
          assert.equal(isStockImageItem({ ...item, materialArtStructure: { ...item.materialArtStructure, TEXT_ELEMENTS: "Render a title" } }), false);
          assert.equal(isStockImageItem({ ...item, boothStructure: result.items.find(entry => entry.boothStructure)?.boothStructure }), false);
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
