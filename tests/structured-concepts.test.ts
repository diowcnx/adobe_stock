import assert from "node:assert/strict";
import test from "node:test";
import { conductMarketResearchAndGeneratePrompts } from "../lib/market-research";
import { isStockImageItem } from "../lib/validation";
import { getGenerationBlockReason } from "../lib/generation-policy";
import { generateSingleImage } from "../lib/image-generator";
import { generateMetadataCsv } from "../lib/csv";
import { buildExhibitionBoothBatch, BOOTH_RECIPES } from "../lib/exhibition-booth";
import { buildResortMasterplanBatch, MASTERPLAN_RECIPES } from "../lib/resort-masterplan";
import { buildMaterialArtBatch, MATERIAL_ART_RECIPES } from "../lib/material-art";
import { buildDualMaterialBatch } from "../lib/dual-material";
import { buildBeverageCampaignBatch, BEVERAGE_CAMPAIGN_RECIPES } from "../lib/beverage-campaign";
import { buildCulinaryEditorialBatch, CULINARY_EDITORIAL_RECIPES } from "../lib/culinary-editorial";

test("editorial still life supports product campaigns and adapts composition to canvas shape", () => {
  const date = new Date("2026-10-16T12:00:00Z");
  for (const ratio of ["3:2", "16:9", "4:5", "1:1"] as const) {
    const items = buildMaterialArtBatch(date, MATERIAL_ART_RECIPES.length, ratio);
    for (const item of items) {
      assert.equal(item.aspectRatio, ratio);
      assert.equal(isStockImageItem(item), true);
      assert.match(item.prompt, new RegExp("Canvas aspect ratio: " + ratio));
      assert.match(item.prompt, /never crop essential parts/);
      assert.equal(item.materialArtStructure?.TEXT_ELEMENTS, "No text");
      if (ratio === "4:5") assert.match(item.materialArtStructure?.COMPOSITION_LOGIC || "", /vertical frame/);
      if (ratio === "1:1") assert.match(item.materialArtStructure?.COMPOSITION_LOGIC || "", /within a square/);
    }
    const skincare = items.find(item => item.seoTitle.includes("Skincare"))!;
    assert.match(skincare.materialArtStructure?.PRIMARY_COMPONENTS || "", /skincare bottle/);
    assert.match(skincare.materialArtStructure?.CAMERA_ANGLE || "", /frontal three-quarter/);
    assert.match(skincare.commercialIntent?.targetBuyer || "", /beauty/);
  }
});

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

test("beverage and culinary structures keep products, ingredients and blank buyer copy zones coherent", () => {
  const date = new Date("2026-10-17T12:00:00Z");
  const beverages = buildBeverageCampaignBatch(date, BEVERAGE_CAMPAIGN_RECIPES.length);
  assert.equal(new Set(beverages.map(item => item.seoTitle)).size, BEVERAGE_CAMPAIGN_RECIPES.length);
  for (const item of beverages) {
    assert.equal(Object.keys(item.beverageCampaignStructure || {}).length, 9);
    assert.match(item.prompt, /exactly three finished drinks/);
    assert.match(item.prompt, /highest central plinth/i);
    assert.match(item.negativePrompt || "", /fourth drink/);
    assert.equal(isStockImageItem(item), true);
  }

  const culinary = buildCulinaryEditorialBatch(date, CULINARY_EDITORIAL_RECIPES.length);
  assert.equal(new Set(culinary.map(item => item.seoTitle)).size, CULINARY_EDITORIAL_RECIPES.length);
  for (const item of culinary) {
    assert.equal(Object.keys(item.culinaryEditorialStructure || {}).length, 11);
    assert.match(item.prompt, /copy-space reservations only/);
    assert.match(item.prompt, /Do not render any text/);
    assert.match(item.prompt, /no hand, arm, chef, person or face/i);
    assert.match(item.culinaryEditorialStructure?.BRAND_TITLE_UPPER_LEFT || "", /render absolutely no letters/);
    assert.equal(isStockImageItem(item), true);
  }
});

test("all seven structures contribute valid rotating briefs without paid planning", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Planning must not make a network call"); };
  try {
    const firstWeekTotals = [0, 0, 0, 0, 0, 0, 0];
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
        result.items.filter(item => item.dualMaterialStructure).length,
        result.items.filter(item => item.beverageCampaignStructure).length,
        result.items.filter(item => item.culinaryEditorialStructure).length,
      ];
      assert.equal(counts.reduce((sum, count) => sum + count, 0), 10);
      assert.ok(counts.every(count => count === 1 || count === 2));
      assert.equal(counts.filter(count => count === 2).length, 3);
      if (day <= 7) counts.forEach((count, index) => { firstWeekTotals[index] += count; });
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
        } else if (item.materialArtStructure) {
          assert.equal(Object.keys(item.materialArtStructure || {}).length, 18);
          assert.equal(item.materialArtStructure?.TEXT_ELEMENTS, "No text");
          assert.match(item.prompt, /single clearly readable CENTRAL_INSTALLATION/);
          assert.equal(isStockImageItem({ ...item, materialArtStructure: { ...item.materialArtStructure, TEXT_ELEMENTS: "Render a title" } }), false);
          assert.equal(isStockImageItem({ ...item, boothStructure: result.items.find(entry => entry.boothStructure)?.boothStructure }), false);
        } else if (item.dualMaterialStructure) {
          assert.equal(Object.keys(item.dualMaterialStructure || {}).length, 6);
          assert.match(item.prompt, /exactly one complete, immediately recognizable silhouette/);
          assert.match(item.prompt, /Add no third construction material/);
          assert.equal(isStockImageItem({ ...item, dualMaterialStructure: { ...item.dualMaterialStructure, PRIMARY_MATERIAL: "" } }), false);
          assert.equal(isStockImageItem({ ...item, boothStructure: result.items.find(entry => entry.boothStructure)?.boothStructure }), false);
        } else if (item.beverageCampaignStructure) {
          assert.equal(Object.keys(item.beverageCampaignStructure).length, 9);
          assert.match(item.prompt, /exactly three finished drinks/);
          assert.match(item.prompt, /no labels, letters, numbers/i);
          assert.equal(isStockImageItem({ ...item, beverageCampaignStructure: { ...item.beverageCampaignStructure, STAGING_PLINTHS: "" } }), false);
          assert.equal(isStockImageItem({ ...item, dualMaterialStructure: buildDualMaterialBatch(new Date(), 1)[0].dualMaterialStructure }), false);
        } else {
          assert.equal(Object.keys(item.culinaryEditorialStructure || {}).length, 11);
          assert.match(item.prompt, /one clear appetizing bite/);
          assert.match(item.prompt, /buyer will add copy after licensing/i);
          assert.equal(isStockImageItem({ ...item, culinaryEditorialStructure: { ...item.culinaryEditorialStructure!, FOREGROUND_HERO_CULINARY_ITEM: "" } }), false);
          assert.equal(isStockImageItem({ ...item, beverageCampaignStructure: buildBeverageCampaignBatch(new Date(), 1)[0].beverageCampaignStructure }), false);
        }
        assert.doesNotMatch(item.prompt, /Do not reinterpret the subject|Set this photograph in contemporary Thailand/);
        assert.match(item.negativePrompt || "", /visible human face/);
        assert.equal(isStockImageItem(item), true);
        assert.equal(getGenerationBlockReason(item), undefined);
        assert.match(item.filename || "", /\.jpeg$/);
      }
      assert.doesNotMatch(generateMetadataCsv(result.items, result.mode), /\.png/);
    }
    assert.deepEqual(firstWeekTotals, [10, 10, 10, 10, 10, 10, 10]);
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
