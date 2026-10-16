import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { assessGeneratedImageQuality, detectUnintendedLightBorder } from "../lib/image-quality";
import { buildQualityRetryDirection, ensureGenuineAlphaTransparency, generateSingleImage } from "../lib/image-generator";
import type { StockImageItem } from "../lib/types";

async function solidImage(background: string): Promise<Buffer> {
  return sharp({ create: { width: 256, height: 256, channels: 3, background } }).jpeg().toBuffer();
}

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

test("vision guard accepts a full-bleed scene with no text", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
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

  try {
    const result = await assessGeneratedImageQuality(await solidImage("#52715a"), "test-key");
    assert.deepEqual(result, { passed: true, issues: [], source: "vision_guard", faceCheckCompleted: true, hasVisibleHumanFace: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const testItem: StockImageItem = {
  generationBriefVersion: "literal-jpeg-no-faces-v2",
  id: 1,
  seoTitle: "Parent Fastening Child Raincoat Before Walk",
  category: "Commercial Story",
  aspectRatio: "4:5",
  composition: "advertising",
  prompt: "Parent fastening a child's raincoat at a home entry before a rainy walk",
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
    assert.doesNotMatch(prompts[0], /QUALITY REPLACEMENT/);
    assert.match(prompts[1], /QUALITY REPLACEMENT 1\/3/);
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
