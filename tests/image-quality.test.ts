import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { assessGeneratedImageQuality, detectUnintendedLightBorder } from "../lib/image-quality";

async function solidImage(background: string): Promise<Buffer> {
  return sharp({ create: { width: 256, height: 256, channels: 3, background } }).jpeg().toBuffer();
}

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
      hasArtificialBorder: false,
      hasPosterLayout: true,
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
      hasArtificialBorder: false,
      hasPosterLayout: false,
      issues: [],
    }) } }],
  }), { status: 200, headers: { "content-type": "application/json" } });

  try {
    const result = await assessGeneratedImageQuality(await solidImage("#52715a"), "test-key");
    assert.deepEqual(result, { passed: true, issues: [], source: "vision_guard" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
