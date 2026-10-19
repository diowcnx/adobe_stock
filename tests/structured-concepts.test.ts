import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { allocateDailyStructureCounts, conductMarketResearchAndGeneratePrompts } from "../lib/market-research";
import { isStockImageItem } from "../lib/validation";
import { getGenerationBlockReason } from "../lib/generation-policy";
import { generateSingleImage } from "../lib/image-generator";
import { generateMetadataCsv, normalizeStockKeywords } from "../lib/csv";
import { buildExhibitionBoothBatch, BOOTH_RECIPES } from "../lib/exhibition-booth";
import { buildMaterialArtBatch, MATERIAL_ART_RECIPES } from "../lib/material-art";
import { buildDualMaterialBatch } from "../lib/dual-material";
import { buildBeverageCampaignBatch, BEVERAGE_CAMPAIGN_RECIPES } from "../lib/beverage-campaign";
import { buildCulinaryEditorialBatch, CULINARY_EDITORIAL_RECIPES } from "../lib/culinary-editorial";
import { AERIAL_LANDSCAPE_RECIPES, buildAerialLandscapeBatch } from "../lib/aerial-landscape";
import { buildEditorialPenSketchBatch, EDITORIAL_PEN_SKETCH_RECIPES } from "../lib/editorial-pen-sketch";
import { buildSymmetricalStorefrontBatch, SYMMETRICAL_STOREFRONT_RECIPES } from "../lib/symmetrical-storefront";
import { buildThaiNaturePosterBatch, THAI_NATURE_POSTER_RECIPES } from "../lib/thai-nature-poster";
import { reserveUniquePromptBatch } from "../lib/prompt-history";
import { getPromptConceptKey } from "../lib/prompt-novelty";
import { clearLatestBatch } from "../lib/batch-store";

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

test("booth structures adapt merchandise and buyers to their categories", () => {
  const date = new Date("2026-10-16T12:00:00Z");
  const booths = buildExhibitionBoothBatch(date, BOOTH_RECIPES.length);
  const technology = booths.find(item => item.seoTitle.includes("Technology"))!;
  assert.match(technology.boothStructure?.PRODUCT_DISPLAY || "", /sensors/);
  assert.doesNotMatch(technology.boothStructure?.PRODUCT_DISPLAY || "", /baskets|ceramics/);
  assert.match(technology.commercialIntent?.intendedUse || "", /Technology/);
  assert.equal(isStockImageItem(technology), true);

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
    assert.match(item.prompt, /Leave unobstructed natural background areas/);
    assert.match(item.prompt, /Do not render any text/);
    assert.doesNotMatch(item.prompt, /BRAND_TITLE_UPPER_LEFT|EDITORIAL_HEADLINE_LOWER_LEFT|FOOTER_NOTICE_LOWER_RIGHT/);
    assert.match(item.prompt, /no hand, arm, chef, person or face/i);
    assert.match(item.culinaryEditorialStructure?.BRAND_TITLE_UPPER_LEFT || "", /render absolutely no letters/);
    assert.equal(isStockImageItem(item), true);
  }
});

test("CSV exports only prioritized single-word keywords", () => {
  assert.deepEqual(
    normalizeStockKeywords(["Commercial Still Life", "still life", "Food & Beverage", "the studio", "Thai-food"]),
    ["commercial", "still", "life", "food", "beverage", "studio", "thai"],
  );
  const item = buildBeverageCampaignBatch(new Date("2026-10-17T12:00:00Z"), 1)[0];
  item.keywords = ["Commercial Still Life", "Food & Beverage", "copy space"];
  const csv = generateMetadataCsv([item], "regular_scene");
  assert.match(csv, /"commercial, still, life, food, beverage, copy, space"/);
  assert.doesNotMatch(csv, /commercial still life|food & beverage|copy space/i);
});

test("aerial landscapes keep the eight-field structure text-free and visually coherent", () => {
  const items = buildAerialLandscapeBatch(new Date("2026-10-17T12:00:00Z"), AERIAL_LANDSCAPE_RECIPES.length);
  assert.equal(new Set(items.map(item => item.seoTitle)).size, AERIAL_LANDSCAPE_RECIPES.length);
  for (const item of items) {
    assert.equal(Object.keys(item.aerialLandscapeStructure || {}).length, 8);
    assert.equal(item.aerialLandscapeStructure?.TYPOGRAPHY_OVERLAY, "None (Text-free)");
    assert.match(item.prompt, /high bird's-eye oblique viewpoint bordering on top-down/);
    assert.match(item.prompt, /Fill every edge with painted terrain/);
    assert.doesNotMatch(item.prompt, /^TYPOGRAPHY_OVERLAY:/m);
    assert.equal(item.aspectRatio, "3:2");
    assert.equal(item.composition, "artwork");
    assert.ok(item.keywords.every(keyword => !/[\s,]/u.test(keyword)));
    assert.equal(isStockImageItem(item), true);
  }
});

test("Thai nature posters keep eight fields, real flower landscapes and vintage poster-color direction", () => {
  const items = buildThaiNaturePosterBatch(new Date("2026-10-19T12:00:00Z"), THAI_NATURE_POSTER_RECIPES.length);
  assert.equal(new Set(items.map(item => item.seoTitle)).size, THAI_NATURE_POSTER_RECIPES.length);
  for (const item of items) {
    assert.equal(Object.keys(item.thaiNaturePosterStructure || {}).length, 8);
    assert.equal(item.thaiNaturePosterStructure?.TYPOGRAPHY_OVERLAY, "None (Text-free)");
    assert.match(item.prompt, /Thai nature and flower fields/);
    assert.match(item.prompt, /poster color/i);
    assert.match(item.prompt, /vintage paper/i);
    assert.match(item.prompt, /not a top-down plan/);
    assert.doesNotMatch(item.prompt, /^TYPOGRAPHY_OVERLAY:/m);
    assert.equal(item.aspectRatio, "3:2");
    assert.equal(item.composition, "artwork");
    assert.ok(item.keywords.every(keyword => !/[\s,]/u.test(keyword)));
    assert.equal(isStockImageItem(item), true);
  }
});

test("structure allocation fills ten slots without omitting any active structure", () => {
  assert.deepEqual(allocateDailyStructureCounts(10, 10, () => 0), Array(10).fill(1));
  assert.deepEqual(allocateDailyStructureCounts(9, 10, () => 0), [2, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(allocateDailyStructureCounts(8, 10, () => 0), [2, 2, 1, 1, 1, 1, 1, 1]);
  assert.throws(() => allocateDailyStructureCounts(11, 10), /cover every active structure/);
});

test("editorial pen sketches keep ten fields, readable subjects and no text instruction", () => {
  const items = buildEditorialPenSketchBatch(new Date("2026-10-18T12:00:00Z"), EDITORIAL_PEN_SKETCH_RECIPES.length);
  assert.equal(new Set(items.map(item => item.seoTitle)).size, EDITORIAL_PEN_SKETCH_RECIPES.length);
  for (const item of items) {
    assert.equal(Object.keys(item.editorialPenSketchStructure || {}).length, 10);
    assert.equal(item.editorialPenSketchStructure?.TEXT_ELEMENTS, "No text");
    assert.match(item.prompt, /full-bleed editorial pen-and-ink illustration/);
    assert.match(item.prompt, /MAIN_SUBJECT complete, immediately recognizable/);
    assert.match(item.prompt, /colored-pen linework and restrained hatched accents/);
    assert.doesNotMatch(item.prompt, /TEXT_ELEMENTS/);
    assert.equal(item.composition, "artwork");
    assert.ok(item.keywords.every(keyword => !/[\s,]/u.test(keyword)));
    assert.equal(isStockImageItem(item), true);
  }
});

test("symmetrical storefronts keep eight fields, readable businesses and original text-free direction", () => {
  const items = buildSymmetricalStorefrontBatch(new Date("2026-10-18T12:00:00Z"), SYMMETRICAL_STOREFRONT_RECIPES.length);
  assert.equal(new Set(items.map(item => item.seoTitle)).size, SYMMETRICAL_STOREFRONT_RECIPES.length);
  for (const item of items) {
    assert.equal(Object.keys(item.symmetricalStorefrontStructure || {}).length, 8);
    assert.match(item.prompt, /single standalone small storefront/);
    assert.match(item.prompt, /centered straight-on eye-level camera/);
    assert.match(item.prompt, /No letters, words, numerals, shop names/);
    assert.doesNotMatch(item.prompt + item.seoTitle + item.keywords.join(" "), /Wes Anderson/i);
    assert.equal(item.aspectRatio, "3:2");
    assert.equal(item.composition, "advertising");
    assert.ok(item.keywords.every(keyword => !/[\s,]/u.test(keyword)));
    assert.equal(isStockImageItem(item), true);
  }
});

test("all ten active structures contribute exactly one valid brief without paid planning", async () => {
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
        result.items.filter(item => item.materialArtStructure).length,
        result.items.filter(item => item.dualMaterialStructure).length,
        result.items.filter(item => item.beverageCampaignStructure).length,
        result.items.filter(item => item.culinaryEditorialStructure).length,
        result.items.filter(item => item.aerialLandscapeStructure).length,
        result.items.filter(item => item.editorialPenSketchStructure).length,
        result.items.filter(item => item.symmetricalStorefrontStructure).length,
        result.items.filter(item => item.thaiNaturePosterStructure).length,
      ];
      assert.equal(counts.reduce((sum, count) => sum + count, 0), 10);
      assert.ok(counts.every(count => count === 1));
      assert.equal(result.items.some(item => item.masterplanStructure), false);
      assert.deepEqual(result.items.map(item => item.id), [1,2,3,4,5,6,7,8,9,10]);
      assert.equal(new Set(result.items.map(item => item.filename)).size, 10);
      for (const item of result.items) {
        assert.equal(item.generationMode, "regular_scene");
        assert.equal(item.isTransparent, false);
        assert.equal(item.conceptStructure, undefined);
        assert.ok(item.keywords.length >= 15 && item.keywords.length <= 25);
        assert.ok(item.keywords.every(keyword => !/[\s,]/u.test(keyword)), item.keywords.join(" | "));
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
          assert.match(item.prompt, /plain unmarked warm-ivory architectural panel/);
          assert.doesNotMatch(item.prompt, /PRIMARY_SIGNAGE/);
          assert.doesNotMatch(item.prompt, /Fuse ORGANIC_FOOD_PART/);
          assert.equal(isStockImageItem({ ...item, fusionStructure: result.items.find(entry => entry.fusionStructure)?.fusionStructure }), false);
        } else if (item.materialArtStructure) {
          assert.equal(Object.keys(item.materialArtStructure || {}).length, 18);
          assert.equal(item.materialArtStructure?.TEXT_ELEMENTS, "No text");
          assert.match(item.prompt, /single clearly readable CENTRAL_INSTALLATION/);
          assert.doesNotMatch(item.prompt, /TEXT_ELEMENTS/);
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
        } else if (item.aerialLandscapeStructure) {
          assert.equal(Object.keys(item.aerialLandscapeStructure).length, 8);
          assert.equal(item.aerialLandscapeStructure.TYPOGRAPHY_OVERLAY, "None (Text-free)");
          assert.match(item.prompt, /terrain (?:ribbons|bands)/i);
          assert.match(item.prompt, /featureless top-down silhouettes or color marks/);
          assert.doesNotMatch(item.prompt, /^TYPOGRAPHY_OVERLAY:/m);
          assert.equal(isStockImageItem({ ...item, aerialLandscapeStructure: { ...item.aerialLandscapeStructure, TYPOGRAPHY_OVERLAY: "Title" } }), false);
          assert.equal(isStockImageItem({ ...item, beverageCampaignStructure: buildBeverageCampaignBatch(new Date(), 1)[0].beverageCampaignStructure }), false);
        } else if (item.editorialPenSketchStructure) {
          assert.equal(Object.keys(item.editorialPenSketchStructure).length, 10);
          assert.equal(item.editorialPenSketchStructure.TEXT_ELEMENTS, "No text");
          assert.match(item.prompt, /hatching/i);
          assert.match(item.prompt, /PAPER_STYLE/);
          assert.doesNotMatch(item.prompt, /TEXT_ELEMENTS/);
          assert.equal(isStockImageItem({ ...item, editorialPenSketchStructure: { ...item.editorialPenSketchStructure, TEXT_ELEMENTS: "Draw a title" } }), false);
          assert.equal(isStockImageItem({ ...item, aerialLandscapeStructure: buildAerialLandscapeBatch(new Date(), 1)[0].aerialLandscapeStructure }), false);
        } else if (item.symmetricalStorefrontStructure) {
          assert.equal(Object.keys(item.symmetricalStorefrontStructure).length, 8);
          assert.match(item.prompt, /disciplined bilateral symmetry/);
          assert.match(item.prompt, /visible interior merchandise/i);
          assert.doesNotMatch(item.prompt, /Wes Anderson/i);
          assert.equal(isStockImageItem({ ...item, symmetricalStorefrontStructure: { ...item.symmetricalStorefrontStructure, ARCHITECTURAL_FACADE: "" } }), false);
          assert.equal(isStockImageItem({ ...item, editorialPenSketchStructure: buildEditorialPenSketchBatch(new Date(), 1)[0].editorialPenSketchStructure }), false);
        } else if (item.thaiNaturePosterStructure) {
          assert.equal(Object.keys(item.thaiNaturePosterStructure).length, 8);
          assert.equal(item.thaiNaturePosterStructure.TYPOGRAPHY_OVERLAY, "None (Text-free)");
          assert.match(item.prompt, /Thai nature and flower fields/);
          assert.match(item.prompt, /vintage paper/i);
          assert.match(item.prompt, /never as a map, masterplan, site plan/i);
          assert.doesNotMatch(item.prompt, /^TYPOGRAPHY_OVERLAY:/m);
          assert.equal(isStockImageItem({ ...item, thaiNaturePosterStructure: { ...item.thaiNaturePosterStructure, TYPOGRAPHY_OVERLAY: "Thai title" } }), false);
          assert.equal(isStockImageItem({ ...item, aerialLandscapeStructure: buildAerialLandscapeBatch(new Date(), 1)[0].aerialLandscapeStructure }), false);
        } else {
          assert.equal(Object.keys(item.culinaryEditorialStructure || {}).length, 11);
          assert.match(item.prompt, /one clear appetizing bite/);
          assert.match(item.prompt, /unobstructed natural background areas/i);
          assert.doesNotMatch(item.prompt, /BRAND_TITLE|HEADLINE|TAGLINE|FOOTER_NOTICE/);
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
  } finally { globalThis.fetch = originalFetch; }
});

test("a prompt already used on an earlier production date is never selected again", async () => {
  const seenPrompts = new Set<string>();
  for (let day = 1; day <= 13; day++) {
    const result = await conductMarketResearchAndGeneratePrompts(new Date(Date.UTC(2026, 9, day, 5)).toISOString());
    for (const item of result.items) {
      assert.equal(seenPrompts.has(item.prompt), false, `reused prompt: ${item.seoTitle}`);
      seenPrompts.add(item.prompt);
    }
  }
});

test("durable planning survives batch deletion and rotates base concepts before same-day image generation", async () => {
  const localHistory = "/tmp/adobe-stock-prompt-history-v1.json";
  fs.rmSync(localHistory, { force: true });
  const originalVercel = process.env.VERCEL;
  delete process.env.VERCEL;
  try {
    const first = await reserveUniquePromptBatch("2026-10-19T11:50:00.000Z");
    await clearLatestBatch();
    const second = await reserveUniquePromptBatch("2026-10-19T11:51:00.000Z");
    const firstPrompts = new Set(first.items.map(item => item.prompt));
    const firstConcepts = new Set(first.items.map(getPromptConceptKey));
    assert.ok(second.items.every(item => !firstPrompts.has(item.prompt)));
    assert.ok(second.items.every(item => !firstConcepts.has(getPromptConceptKey(item))));
  } finally {
    fs.rmSync(localHistory, { force: true });
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
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
    const retiredMasterplan = {
      ...items[0],
      fusionStructure: undefined,
      boothStructure: undefined,
      materialArtStructure: undefined,
      dualMaterialStructure: undefined,
      beverageCampaignStructure: undefined,
      culinaryEditorialStructure: undefined,
      aerialLandscapeStructure: undefined,
      editorialPenSketchStructure: undefined,
      symmetricalStorefrontStructure: undefined,
      thaiNaturePosterStructure: undefined,
      masterplanStructure: {
        PROJECT_THEME: "retired plan",
        PROJECT_TITLE: "No text",
        VIEW_AND_PERSPECTIVE: "bird eye view",
        LINEWORK_AND_TINT_STYLE: "fine linework",
        WATERPARK_AND_AMENITY_ZONE: "central amenity",
        ACCOMMODATION_AND_STRUCTURES: "small buildings",
        LANDSCAPE_AND_TERRAIN: "connected paths",
        COLOR_PALETTE: "pale green",
      },
    };
    const retiredResult = await generateSingleImage(retiredMasterplan, "test-key");
    assert.equal(retiredResult.imageUrl, "");
    assert.match(retiredResult.error || "", /retired generation brief/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
