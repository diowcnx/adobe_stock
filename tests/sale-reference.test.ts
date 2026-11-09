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

function sampleConcepts() {
  return Array.from({ length: 10 }, (_, index) => ({
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
}

function mockProvider(extra: Record<string, unknown> = {}) {
  global.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      subject: "a useful household object",
      visualStrengths: "Immediate clarity and flexible copy space",
      likelyBuyerUses: ["home campaign", "editorial feature"],
      expansionStrategy: "Change story, buyer, setting, camera, light, and palette",
      concepts: sampleConcepts(),
      ...extra,
    }) } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

test("sold reference analysis produces exactly ten valid, distinct JPEG briefs", async () => {
  const originalFetch = global.fetch;
  mockProvider();

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
      assert.equal(item.saleReferenceLayout, undefined);
    }
    assert.equal(plan.analysis.layout, "full_scene");
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

test("a sold cutout asset expands into ten isolated-on-white JPEG briefs", async () => {
  const originalFetch = global.fetch;
  mockProvider({ referenceLayout: "isolated_cutout", subject: "stone garden steps with shrubs" });
  try {
    const plan = await analyzeSoldReference(referenceDataUrl(), "test-key");
    assert.equal(plan.analysis.layout, "isolated_white");
    assert.equal(plan.items.length, 10);
    for (const item of plan.items) {
      assert.equal(item.saleReferenceLayout, "isolated_white");
      assert.equal(item.generationMode, "regular_scene");
      assert.equal(item.filename?.endsWith(".jpeg"), true);
      assert.equal(item.saleReferenceStructure?.SETTING_AND_PROPS, "Seamless pure white background only");
      assert.match(item.prompt, /pure white/i);
      assert.doesNotMatch(item.prompt, /full-bleed/i);
      assert.ok(["isolated", "white", "background", "cutout"].every(keyword => item.keywords.includes(keyword)), item.seoTitle);
      assert.equal(item.keywords.includes("copyspace"), false);
      assert.equal(isStockImageItem(item), true);
      assert.equal(getGenerationBlockReason(item), undefined);
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("isolated layout is only valid on sold-reference items", async () => {
  const originalFetch = global.fetch;
  mockProvider({ referenceLayout: "isolated_cutout" });
  try {
    const [item] = (await analyzeSoldReference(referenceDataUrl(), "test-key")).items;
    assert.equal(isStockImageItem({ ...item, saleReferenceLayout: "poster" }), false);
    assert.equal(isStockImageItem({ ...item, saleReferenceStructure: undefined }), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("an owner-confirmed layout overrides the analyzer", async () => {
  const originalFetch = global.fetch;
  mockProvider({ referenceLayout: "isolated_cutout" });
  try {
    const plan = await analyzeSoldReference(referenceDataUrl(), "test-key", "full_scene");
    assert.equal(plan.analysis.layout, "full_scene");
    assert.equal(plan.items[0].saleReferenceLayout, undefined);
    assert.match(plan.items[0].prompt, /full-bleed/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test("a sold subject on a plain colour backdrop expands into ten briefs on distinct plain backdrops", async () => {
  const originalFetch = global.fetch;
  const concepts = sampleConcepts().map((concept, index) => ({
    ...concept,
    // Repeats, white and a missing colour must all fall back to distinct non-white colours.
    backdropColor: ["pastel pink", "pastel pink", "white", undefined, "Sage Green!"][index] ?? `pastel tone ${"abcdefghij"[index]}`,
  }));
  mockProvider({ referenceLayout: "solid_backdrop", subject: "kitten on a pink backdrop", concepts });
  try {
    const plan = await analyzeSoldReference(referenceDataUrl(), "test-key");
    assert.equal(plan.analysis.layout, "solid_backdrop");
    const colors = plan.items.map(item => /Seamless solid (.+?) studio backdrop/.exec(item.saleReferenceStructure?.SETTING_AND_PROPS ?? "")?.[1]);
    assert.equal(colors.every(Boolean), true);
    assert.equal(new Set(colors).size, 10);
    assert.equal(colors.some(color => /white/.test(color ?? "")), false);
    assert.equal(colors[0], "pastel pink");
    assert.equal(colors[4], "sage green");
    for (const item of plan.items) {
      assert.equal(item.saleReferenceLayout, "solid_backdrop");
      assert.match(item.saleReferenceStructure?.SETTING_AND_PROPS ?? "", /no room, furniture or window/);
      assert.match(item.saleReferenceStructure?.COMPOSITION_AND_CAMERA ?? "", /off-center.+copy space/);
      assert.match(item.prompt, /full-bleed commercial studio JPEG on a seamless plain/);
      assert.equal(isStockImageItem(item), true);
      assert.equal(getGenerationBlockReason(item), undefined);
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("the owner can force the plain backdrop layout", async () => {
  const originalFetch = global.fetch;
  let analyzerPrompt = "";
  global.fetch = async (_input, init) => {
    analyzerPrompt = JSON.parse(String(init?.body)).messages[0].content[0].text;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ referenceLayout: "full_scene", concepts: sampleConcepts() }) } }] }), { status: 200 });
  };
  try {
    const plan = await analyzeSoldReference(referenceDataUrl(), "test-key", "solid_backdrop");
    assert.match(analyzerPrompt, /correct value is "solid_backdrop"/);
    assert.equal(plan.analysis.layout, "solid_backdrop");
    assert.equal(plan.items[0].saleReferenceLayout, "solid_backdrop");
  } finally {
    global.fetch = originalFetch;
  }
});

test("plain backdrop briefs ask for the whole subject facing the camera", async () => {
  const originalFetch = global.fetch;
  let analyzerPrompt = "";
  global.fetch = async (_input, init) => {
    analyzerPrompt = JSON.parse(String(init?.body)).messages[0].content[0].text;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ referenceLayout: "solid_backdrop", concepts: sampleConcepts() }) } }] }), { status: 200 });
  };
  try {
    const plan = await analyzeSoldReference(referenceDataUrl(), "test-key");
    assert.match(analyzerPrompt, /must be whole and fully inside the frame, never cropped to paws/);
    assert.match(analyzerPrompt, /Never ask for binary code, 0s and 1s, digits, program code/);
    for (const item of plan.items) {
      assert.match(item.prompt, /Show the main subject whole and fully inside the frame/);
      assert.match(item.prompt, /faces the camera/);
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("a sold empty background expands into ten backgrounds that differ in both style and colour", async () => {
  const originalFetch = global.fetch;
  let analyzerPrompt = "";
  const concepts = sampleConcepts().map((concept, index) => ({
    ...concept,
    // Repeats and missing values must fall back to unused styles and colours.
    backgroundStyle: ["glitter bokeh", "glitter bokeh", undefined, "Softly Draped Silk!"][index] ?? `style ${"abcdefghij"[index]}`,
    backgroundColor: ["royal blue", "royal blue", "deep red"][index] ?? `colour ${"abcdefghij"[index]}`,
  }));
  global.fetch = async (_input, init) => {
    analyzerPrompt = JSON.parse(String(init?.body)).messages[0].content[0].text;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ referenceLayout: "empty_background", subject: "blue studio backdrop", concepts }) } }] }), { status: 200 });
  };
  try {
    const plan = await analyzeSoldReference(referenceDataUrl(), "test-key");
    assert.match(analyzerPrompt, /never make ten colour swaps of one style/);
    assert.equal(plan.analysis.layout, "empty_background");
    const treatments = plan.items.map(item => item.saleReferenceStructure?.SUBJECT_TREATMENT ?? "");
    const styles = treatments.map(text => /^Empty \S+(?: \S+)? (.+) filling/.exec(text)?.[1]);
    assert.equal(new Set(plan.items.map(item => item.saleReferenceStructure?.SUBJECT_TREATMENT)).size, 10);
    assert.match(treatments[0], /^Empty royal blue glitter bokeh filling/);
    assert.doesNotMatch(treatments[1], /glitter bokeh/);
    assert.doesNotMatch(treatments[1], /royal blue/);
    assert.match(treatments[3], /softly draped silk/);
    assert.equal(styles.every(Boolean), true);
    for (const item of plan.items) {
      assert.equal(item.saleReferenceLayout, "empty_background");
      assert.equal(item.saleReferenceStructure?.SETTING_AND_PROPS, "No objects; empty background only");
      assert.match(item.prompt, /full-bleed empty background JPEG/);
      assert.ok(["background", "backdrop", "abstract"].every(word => item.keywords.includes(word)));
      assert.equal(isStockImageItem(item), true);
      assert.equal(getGenerationBlockReason(item), undefined);
    }
  } finally {
    global.fetch = originalFetch;
  }
});
