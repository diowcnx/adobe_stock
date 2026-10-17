import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { assessGeneratedImageQuality, detectUnintendedLightBorder } from "../lib/image-quality";
import { buildQualityRetryDirection, ensureGenuineAlphaTransparency, generateSingleImage } from "../lib/image-generator";
import type { StockImageItem } from "../lib/types";
import { buildExhibitionBoothBatch } from "../lib/exhibition-booth";
import { buildResortMasterplanBatch } from "../lib/resort-masterplan";
import { buildMaterialArtBatch } from "../lib/material-art";
import { buildDualMaterialBatch } from "../lib/dual-material";
import { buildBeverageCampaignBatch } from "../lib/beverage-campaign";
import { buildCulinaryEditorialBatch } from "../lib/culinary-editorial";

async function solidImage(background: string): Promise<Buffer> {
  return sharp({ create: { width: 256, height: 256, channels: 3, background } }).jpeg().toBuffer();
}

test("beverage campaign QA and retry preserve exactly three named drinks and their hierarchy", async () => {
  const originalFetch = globalThis.fetch;
  const item = buildBeverageCampaignBatch(new Date("2026-10-17T12:00:00Z"), 1)[0];
  const image = await solidImage("#c9bca4");
  const prompts: string[] = [];
  let qaCalls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      prompts.push(body.messages[0].content);
      return new Response(JSON.stringify({ choices: [{ message: { images: [{ b64_json: image.toString("base64") }] } }] }));
    }
    const inspection = body.messages[0].content[0].text;
    assert.match(inspection, /INTENTIONAL THREE-DRINK BEVERAGE CAMPAIGN/);
    assert.doesNotMatch(inspection, /INTENTIONAL DUAL-MATERIAL/);
    qaCalls++;
    const passed = qaCalls === 2;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      passed, hasVisibleHumanFace: false, hasText: false, hasArtificialBorder: false,
      hasPosterLayout: false, isImmediatelyRecognizable: true, hasClearLiteralStory: passed,
      hasClearCommercialUse: true, hasCutoutDamage: false, hasMultipleConfusingSubjects: !passed,
      issues: passed ? [] : ["fourth drink and unclear center hierarchy"],
    }) } }] }));
  };
  try {
    const result = await generateSingleImage(item, "test-key");
    assert.equal(qaCalls, 2);
    assert.match(prompts[0], /exactly three complete drinks/);
    assert.match(prompts[1], /SAME three named drinks with the SAME recipes/);
    assert.doesNotMatch(prompts[1], /single food-hardware hybrid/);
    assert.equal(result.qualityReview?.status, "passed_after_retries");
  } finally { globalThis.fetch = originalFetch; }
});

test("culinary editorial QA and retry preserve dish, lifted bite and text-free copy space", async () => {
  const originalFetch = globalThis.fetch;
  const item = buildCulinaryEditorialBatch(new Date("2026-10-17T12:00:00Z"), 1)[0];
  const image = await solidImage("#c9bca4");
  const prompts: string[] = [];
  let qaCalls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      prompts.push(body.messages[0].content);
      return new Response(JSON.stringify({ choices: [{ message: { images: [{ b64_json: image.toString("base64") }] } }] }));
    }
    const inspection = body.messages[0].content[0].text;
    assert.match(inspection, /INTENTIONAL EDITORIAL CULINARY ADVERTISING/);
    assert.doesNotMatch(inspection, /INTENTIONAL THREE-DRINK/);
    qaCalls++;
    const passed = qaCalls === 2;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      passed, hasVisibleHumanFace: false, hasText: false, hasArtificialBorder: false,
      hasPosterLayout: false, isImmediatelyRecognizable: passed, hasClearLiteralStory: passed,
      hasClearCommercialUse: true, hasCutoutDamage: false, hasMultipleConfusingSubjects: false,
      issues: passed ? [] : ["dish is unclear and utensil geometry is broken"],
    }) } }] }));
  };
  try {
    const result = await generateSingleImage(item, "test-key");
    assert.equal(qaCalls, 2);
    assert.match(prompts[0], /named hero dish dominant in the foreground/);
    assert.match(prompts[1], /SAME named dish, SAME utensil-held bite/);
    assert.match(prompts[1], /No chef, people, hands, package, label, lettering/);
    assert.equal(result.qualityReview?.status, "passed_after_retries");
  } finally { globalThis.fetch = originalFetch; }
});

test("dual-material inspection and retry preserve a single recognizable two-material subject", async () => {
  const originalFetch = globalThis.fetch;
  const item = buildDualMaterialBatch(new Date("2026-10-16T12:00:00Z"), 1)[0];
  const image = await solidImage("#c9bca4");
  const prompts: string[] = [];
  let qaCalls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      prompts.push(body.messages[0].content);
      return new Response(JSON.stringify({ choices: [{ message: { images: [{ b64_json: image.toString("base64") }] } }] }));
    }
    const inspection = body.messages[0].content[0].text;
    assert.match(inspection, /INTENTIONAL DUAL-MATERIAL SCULPTURE/);
    assert.doesNotMatch(inspection, /This is an INTENTIONAL MATERIAL-ART/);
    assert.doesNotMatch(inspection, /This is an INTENTIONAL SURREAL FOOD-HARDWARE/);
    qaCalls++;
    const passed = qaCalls === 2;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      passed, hasVisibleHumanFace: false, hasText: false, hasArtificialBorder: false,
      hasPosterLayout: false, isImmediatelyRecognizable: passed, hasClearLiteralStory: passed,
      hasClearCommercialUse: true, hasCutoutDamage: false, hasMultipleConfusingSubjects: !passed,
      issues: passed ? [] : ["subject is fragmented and its silhouette is unclear"],
    }) } }] }));
  };
  try {
    const result = await generateSingleImage(item, "test-key");
    assert.equal(qaCalls, 2);
    assert.match(prompts[1], /SAME subject using the SAME two named materials/);
    assert.doesNotMatch(prompts[1], /Use only the single food-hardware hybrid/);
    assert.equal(result.qualityReview?.status, "passed_after_retries");
    assert.match(result.imageUrl, /^data:image\/jpeg/);
  } finally { globalThis.fetch = originalFetch; }
});

test("material-art QA and replacements preserve the physical artwork and raw materials", async () => {
  const originalFetch = globalThis.fetch;
  const item = buildMaterialArtBatch(new Date("2026-10-16T12:00:00Z"), 1)[0];
  const image = await solidImage("#c9bca4");
  const prompts: string[] = [];
  let qaCalls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      prompts.push(body.messages[0].content);
      return new Response(JSON.stringify({ choices: [{ message: { images: [{ b64_json: image.toString("base64") }] } }] }));
    }
    const inspection = body.messages[0].content[0].text;
    assert.match(inspection, /INTENTIONAL MATERIAL-ART STILL-LIFE PHOTOGRAPH/);
    assert.doesNotMatch(inspection, /This is an INTENTIONAL SURREAL FOOD-HARDWARE FUSION/);
    assert.doesNotMatch(inspection, /This is an ARCHITECTURAL PROJECT MASTERPLAN/);
    qaCalls++;
    const passed = qaCalls === 2;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      passed, hasVisibleHumanFace: false, hasText: false, hasArtificialBorder: false,
      hasPosterLayout: false, isImmediatelyRecognizable: true, hasClearLiteralStory: true,
      hasClearCommercialUse: true, hasCutoutDamage: false, hasMultipleConfusingSubjects: !passed,
      issues: passed ? [] : ["too many competing motifs obscure the artwork"],
    }) } }] }));
  };
  try {
    const result = await generateSingleImage(item, "test-key");
    assert.equal(qaCalls, 2);
    assert.match(prompts[1], /SAME material-art motif using the SAME raw materials/);
    assert.doesNotMatch(prompts[1], /Use only the single food-hardware hybrid/);
    assert.equal(result.qualityReview?.status, "passed_after_retries");
    assert.match(result.imageUrl, /^data:image\/jpeg/);
  } finally { globalThis.fetch = originalFetch; }
});

test("masterplan inspection and retry preserve sketch medium and bird's-eye perspective", async () => {
  const originalFetch = globalThis.fetch;
  const item = buildResortMasterplanBatch(new Date("2026-10-16T12:00:00Z"), 1)[0];
  const image = await solidImage("#eceadf");
  let qaCalls = 0;
  const prompts: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      prompts.push(body.messages[0].content);
      return new Response(JSON.stringify({ choices: [{ message: { images: [{ b64_json: image.toString("base64") }] } }] }));
    }
    const inspection = body.messages[0].content[0].text;
    assert.match(inspection, /ARCHITECTURAL PROJECT MASTERPLAN SKETCH/);
    assert.doesNotMatch(inspection, /This is a FULL-SIZE EXHIBITION-BOOTH/);
    assert.doesNotMatch(inspection, /This is an INTENTIONAL SURREAL FOOD-HARDWARE/);
    qaCalls++;
    const passed = qaCalls === 2;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      passed, hasVisibleHumanFace: false, hasText: false, hasArtificialBorder: false,
      hasPosterLayout: false, isImmediatelyRecognizable: true, hasClearLiteralStory: true,
      hasClearCommercialUse: true, hasCutoutDamage: false, hasMultipleConfusingSubjects: false,
      issues: passed ? [] : ["render is photorealistic rather than linework with sparse tints"],
    }) } }] }));
  };
  try {
    const result = await generateSingleImage(item, "test-key");
    assert.equal(qaCalls, 2);
    assert.match(prompts[0], /SKETCH ILLUSTRATION/);
    assert.match(prompts[1], /Redraw the SAME project/);
    assert.doesNotMatch(prompts[1], /Use only the single food-hardware hybrid/);
    assert.equal(result.qualityReview?.status, "passed_after_retries");
    assert.match(result.imageUrl, /^data:image\/jpeg/);
  } finally { globalThis.fetch = originalFetch; }
});

test("booth QA permits white presentation space and retries preserve booth structure", async () => {
  const originalFetch = globalThis.fetch;
  const item = buildExhibitionBoothBatch(new Date("2026-10-16T12:00:00Z"), 1)[0];
  const source = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#ffffff" } })
    .composite([{ input: await sharp({ create: { width: 160, height: 160, channels: 3, background: "#718154" } }).png().toBuffer(), left: 48, top: 48 }])
    .jpeg().toBuffer();
  assert.equal(await detectUnintendedLightBorder(source), true);
  const prompts: string[] = [];
  let qaCalls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      prompts.push(body.messages[0].content);
      return new Response(JSON.stringify({ choices: [{ message: { images: [{ b64_json: source.toString("base64") }] } }] }));
    }
    const inspection = body.messages[0].content[0].text;
    assert.match(inspection, /EXHIBITION-BOOTH ARCHITECTURAL VISUALIZATION/);
    assert.doesNotMatch(inspection, /INTENTIONAL SURREAL FOOD-HARDWARE FUSION/);
    qaCalls++;
    const passed = qaCalls === 2;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      passed, hasVisibleHumanFace: false, hasText: false, hasArtificialBorder: false,
      hasPosterLayout: false, isImmediatelyRecognizable: true, hasClearLiteralStory: true,
      hasClearCommercialUse: true, hasCutoutDamage: false, hasMultipleConfusingSubjects: false,
      issues: passed ? [] : ["camera is angled instead of strictly frontal"],
    }) } }] }));
  };
  try {
    const result = await generateSingleImage(item, "test-key");
    assert.equal(qaCalls, 2);
    assert.equal(prompts.length, 2);
    assert.match(prompts[1], /SAME exhibition-booth design/);
    assert.doesNotMatch(prompts[1], /Use only the single food-hardware hybrid/);
    assert.equal(result.qualityReview?.status, "passed_after_retries");
    assert.match(result.imageUrl, /^data:image\/jpeg/);
  } finally { globalThis.fetch = originalFetch; }
});

test("alpha extraction preserves light details enclosed inside the subject", async () => {
  const image = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#ffffff" } })
    .composite([
      { input: await sharp({ create: { width: 40, height: 40, channels: 3, background: "#303030" } }).png().toBuffer(), left: 12, top: 12 },
      { input: await sharp({ create: { width: 20, height: 20, channels: 3, background: "#f4f4f4" } }).png().toBuffer(), left: 22, top: 22 },
    ])
    .png()
    .removeAlpha()
    .toBuffer();

  const { data, info } = await sharp(await ensureGenuineAlphaTransparency(image)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];

  assert.equal(alphaAt(0, 0), 0, "edge-connected white background should become transparent");
  assert.equal(alphaAt(32, 32), 255, "enclosed light-colored product detail must stay opaque");
});

test("pixel guard rejects obvious white side mats", async () => {
  const image = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#6f3f68" } })
    .composite([
      { input: await sharp({ create: { width: 28, height: 256, channels: 3, background: "#ffffff" } }).png().toBuffer(), left: 0, top: 0 },
      { input: await sharp({ create: { width: 28, height: 256, channels: 3, background: "#ffffff" } }).png().toBuffer(), left: 228, top: 0 },
    ])
    .jpeg()
    .toBuffer();

  assert.equal(await detectUnintendedLightBorder(image), true);
  const result = await assessGeneratedImageQuality(image, "test-key");
  assert.equal(result.passed, false);
  assert.equal(result.source, "pixel_guard");
});

test("vision guard rejects rendered text and poster layouts", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      passed: false,
      hasText: true,
      hasVisibleHumanFace: false,
      hasArtificialBorder: false,
      hasPosterLayout: true,
      isImmediatelyRecognizable: false,
      hasClearLiteralStory: false,
      hasClearCommercialUse: false,
      hasCutoutDamage: false,
      hasMultipleConfusingSubjects: true,
      issues: ["title text appears in a blank header panel"],
    }) } }],
  }), { status: 200, headers: { "content-type": "application/json" } });

  try {
    const result = await assessGeneratedImageQuality(await solidImage("#6f3f68"), "test-key");
    assert.equal(result.passed, false);
    assert.equal(result.source, "vision_guard");
    assert.match(result.issues.join(" "), /title text/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("vision guard accepts intentional fusion without applying retired literal-scene rules", async () => {
  const originalFetch = globalThis.fetch;
  let inspectionPrompt = "";
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    inspectionPrompt = body.messages[0].content[0].text;
    return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      passed: true,
      hasText: false,
      hasVisibleHumanFace: false,
      hasArtificialBorder: false,
      hasPosterLayout: false,
      isImmediatelyRecognizable: true,
      hasClearLiteralStory: true,
      hasClearCommercialUse: true,
      hasCutoutDamage: false,
      hasMultipleConfusingSubjects: false,
      issues: [],
    }) } }],
  }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const result = await assessGeneratedImageQuality(await solidImage("#52715a"), "test-key", {
      mode: "regular_scene", expectedTitle: "Pork Belly Battery", isFoodFusion: true,
    });
    assert.match(inspectionPrompt, /INTENTIONAL SURREAL FOOD-HARDWARE FUSION/);
    assert.doesNotMatch(inspectionPrompt, /Reject abstract assemblages, surreal hybrids/);
    assert.deepEqual(result, { passed: true, issues: [], source: "vision_guard", faceCheckCompleted: true, hasVisibleHumanFace: false, hasText: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const testItem: StockImageItem = {
  generationBriefVersion: "food-hardware-fusion-v1",
  fusionStructure: {
    CONCEPT_THEME: "Food energy recharge",
    ORGANIC_FOOD_PART: "one layered pork belly strip",
    MECHANICAL_HARDWARE_PART: "one copper battery terminal fused to its end",
    PLACEMENT_AND_ANGLE: "horizontal side view",
    BACKGROUND_SURFACE: "matte ivory",
    LIGHTING_AND_MOOD: "diffused studio lighting",
    COLOR_PALETTE: "pink, cream and copper",
  },
  id: 1,
  seoTitle: "Pork Belly Battery Fusion",
  category: "Food Hardware Fusion",
  aspectRatio: "4:5",
  composition: "advertising",
  prompt: "one pork belly battery hybrid with a seamless joint on matte ivory",
  keywords: ["parent", "child", "raincoat"],
  modelUsed: "test-model",
  generationMode: "regular_scene",
};

test("visible faces are withheld after the retry limit even when QA is configured off", async () => {
  const originalFetch = globalThis.fetch;
  const originalGate = process.env.IMAGE_QUALITY_GATE;
  process.env.IMAGE_QUALITY_GATE = "false";
  const image = await solidImage("#52715a");
  let imageCalls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      imageCalls++;
      assert.match(body.messages[0].content, /No visible human faces anywhere/);
      return new Response(JSON.stringify({
        choices: [{ message: { images: [{ b64_json: image.toString("base64") }] } }],
      }));
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        passed: true,
        hasVisibleHumanFace: true,
        hasText: false,
        hasArtificialBorder: false,
        hasPosterLayout: false,
        isImmediatelyRecognizable: true,
        hasClearLiteralStory: true,
        hasClearCommercialUse: true,
        hasCutoutDamage: false,
        hasMultipleConfusingSubjects: false,
        issues: [],
      }) } }],
    }));
  };
  try {
    const result = await generateSingleImage(testItem, "test-key");
    assert.equal(imageCalls, 4);
    assert.equal(result.imageUrl, "");
    assert.match(result.error || "", /visible human face remains/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalGate === undefined) delete process.env.IMAGE_QUALITY_GATE;
    else process.env.IMAGE_QUALITY_GATE = originalGate;
  }
});

test("rendered or pseudo-text is withheld after the retry limit", async () => {
  const originalFetch = globalThis.fetch;
  const image = await solidImage("#52715a");
  let imageCalls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      imageCalls++;
      return new Response(JSON.stringify({ choices: [{ message: { images: [{ b64_json: image.toString("base64") }] } }] }));
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      passed: false, hasVisibleHumanFace: false, hasText: true, hasArtificialBorder: false,
      hasPosterLayout: false, isImmediatelyRecognizable: true, hasClearLiteralStory: true,
      hasClearCommercialUse: true, hasCutoutDamage: false, hasMultipleConfusingSubjects: false,
      issues: ["pseudo-text appears on the product surface"],
    }) } }] }));
  };
  try {
    const result = await generateSingleImage(testItem, "test-key");
    assert.equal(imageCalls, 4);
    assert.equal(result.imageUrl, "");
    assert.match(result.error || "", /rendered text or pseudo-text remains/);
  } finally { globalThis.fetch = originalFetch; }
});

test("retry direction explicitly changes the rejected composition", () => {
  const direction = buildQualityRetryDirection(2, ["title text appears in a blank header panel"]);
  assert.match(direction, /genuinely new alternative/i);
  assert.match(direction, /different camera angle/i);
  assert.match(direction, /title text appears/i);
  assert.match(direction, /no frame, border, mat/i);
});

test("generator replaces a QA-rejected image and records the successful retry", async () => {
  const originalFetch = globalThis.fetch;
  const image = await solidImage("#52715a");
  const prompts: string[] = [];
  let qaCalls = 0;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      prompts.push(body.messages[0].content);
      return new Response(JSON.stringify({
        choices: [{ message: { images: [{ b64_json: image.toString("base64") }] } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    qaCalls++;
    const passed = qaCalls === 2;
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        passed,
        hasText: !passed,
        hasVisibleHumanFace: false,
        hasArtificialBorder: false,
        hasPosterLayout: !passed,
        isImmediatelyRecognizable: passed,
        hasClearLiteralStory: passed,
        hasClearCommercialUse: passed,
        hasCutoutDamage: false,
        hasMultipleConfusingSubjects: !passed,
        issues: passed ? [] : ["title text appears in a blank header panel"],
      }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const result = await generateSingleImage(testItem, "test-key");
    assert.match(result.imageUrl, /^data:image\/jpeg;base64,/);
    assert.deepEqual(result.qualityReview, {
      status: "passed_after_retries",
      attempts: 2,
      rejectionCount: 1,
      rejectionReasons: ["title text appears in a blank header panel"],
    });
    assert.equal(prompts.length, 2);
    assert.match(prompts[0], /^ABSOLUTE NO-TEXT OUTPUT RULE/);
    assert.doesNotMatch(prompts[0], /QUALITY REPLACEMENT/);
    assert.match(prompts[1], /QUALITY REPLACEMENT 1\/3/);
    assert.match(prompts[1], /same specified food-hardware pair/);
    assert.doesNotMatch(prompts[1], /Set this photograph in contemporary Thailand/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generator returns the latest image with all rejection reasons after three replacements", async () => {
  const originalFetch = globalThis.fetch;
  const image = await solidImage("#52715a");
  let imageCalls = 0;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      imageCalls++;
      return new Response(JSON.stringify({
        choices: [{ message: { images: [{ b64_json: image.toString("base64") }] } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        passed: false,
        hasText: false,
        hasVisibleHumanFace: false,
        hasArtificialBorder: true,
        hasPosterLayout: false,
        isImmediatelyRecognizable: true,
        hasClearLiteralStory: true,
        hasClearCommercialUse: true,
        hasCutoutDamage: false,
        hasMultipleConfusingSubjects: false,
        issues: ["artificial white border around the image"],
      }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const result = await generateSingleImage(testItem, "test-key");
    assert.match(result.imageUrl, /^data:image\/jpeg;base64,/);
    assert.equal(imageCalls, 4);
    assert.equal(result.qualityReview?.status, "accepted_after_retry_limit");
    assert.equal(result.qualityReview?.attempts, 4);
    assert.equal(result.qualityReview?.rejectionCount, 4);
    assert.equal(result.qualityReview?.rejectionReasons.length, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("transparent PNG is blocked before any billed request", async () => {
  const originalFetch = globalThis.fetch;
  const source = await sharp({ create: { width: 128, height: 128, channels: 3, background: "#ffffff" } })
    .composite([{ input: await sharp({ create: { width: 72, height: 72, channels: 3, background: "#845b34" } }).png().toBuffer(), left: 28, top: 28 }])
    .png()
    .toBuffer();
  const prompts: string[] = [];
  let qaCalls = 0;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      prompts.push(body.messages[0].content);
      return new Response(JSON.stringify({
        choices: [{ message: { images: [{ b64_json: source.toString("base64") }] } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    qaCalls++;
    const passed = qaCalls === 2;
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        passed,
        hasText: false,
        hasVisibleHumanFace: false,
        hasArtificialBorder: false,
        hasPosterLayout: false,
        isImmediatelyRecognizable: passed,
        hasClearLiteralStory: passed,
        hasClearCommercialUse: passed,
        hasCutoutDamage: !passed,
        hasMultipleConfusingSubjects: !passed,
        issues: passed ? [] : ["subject is an ambiguous fragmented object with missing areas"],
      }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const transparentItem: StockImageItem = {
    ...testItem,
    seoTitle: "Solid Wooden Kitchen Spoon Isolated",
    composition: "asset",
    generationMode: "transparent_png",
    isTransparent: true,
    prompt: "one solid wooden kitchen spoon",
  };

  try {
    const result = await generateSingleImage(transparentItem, "test-key");
    assert.equal(result.imageUrl, "");
    assert.equal(prompts.length, 0);
    assert.equal(qaCalls, 0);
    assert.match(result.error || "", /PNG generation is disabled/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
