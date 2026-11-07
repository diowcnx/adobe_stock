import assert from "node:assert/strict";
import test from "node:test";
import { generateMetadataCsv } from "../lib/csv";
import { getGenerationBlockReason } from "../lib/generation-policy";
import { analyzeSoldReference } from "../lib/sale-reference";
import { isStockImageItem } from "../lib/validation";
import { generateVectorImage, sizeArtboardForAdobe, svgProblem } from "../lib/vector-generator";
import type { StockImageItem } from "../lib/types";

const SNOWMAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 2048 1536"><rect width="2048" height="1536" fill="#ffffff"/><circle cx="1024" cy="1000" r="300" fill="#eef4ff"/><path d="M 900 600 C 950 500 1100 500 1150 600 Z" fill="#d33"/><metadata><recraft-signature>{}</recraft-signature></metadata></svg>`;

function referenceDataUrl(): string {
  const bytes = Buffer.alloc(256, 0);
  bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff;
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

function concepts() {
  return Array.from({ length: 10 }, (_, index) => ({
    title: `Festive Winter Character ${index + 1}`,
    category: "Holidays",
    aspectRatio: "3:2",
    newConcept: `A different winter character number ${index + 1}`,
    targetBuyer: "Greeting card designers",
    intendedUse: "Holiday cards and banners",
    purchaseReason: "Clean editable seasonal clip art",
    subjectTreatment: `Character ${index + 1} waving`,
    compositionAndCamera: "Front view, centered",
    settingAndProps: "Plain white",
    lightingAndMood: "Cheerful flat colours",
    colorPalette: "Red, white and mint",
    keywords: ["snowman", "christmas", "winter", "holiday", "cute", "cartoon", "festive", "snow", "seasonal", "character", "december", "greeting", "card", "scarf", "hat"],
  }));
}

async function vectorPlan(): Promise<{ items: StockImageItem[]; analyzerPrompt: string }> {
  let analyzerPrompt = "";
  global.fetch = async (_input, init) => {
    analyzerPrompt = JSON.parse(String(init?.body)).messages[0].content[0].text;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ referenceLayout: "isolated_cutout", subject: "cartoon snowman", concepts: concepts() }) } }] }), { status: 200 });
  };
  const plan = await analyzeSoldReference(referenceDataUrl(), "test-key", undefined, { vector: true });
  return { items: plan.items, analyzerPrompt };
}

test("a sold vector expands into ten SVG vector illustration briefs", async () => {
  const originalFetch = global.fetch;
  try {
    const { items, analyzerPrompt } = await vectorPlan();
    assert.match(analyzerPrompt, /sold asset is a VECTOR illustration/);
    assert.equal(items.length, 10);
    for (const item of items) {
      assert.equal(item.outputFormat, "svg");
      assert.equal(item.saleReferenceLayout, "isolated_white");
      assert.match(item.filename ?? "", /\.svg$/);
      assert.match(item.modelUsed, /^recraft\//);
      assert.match(item.prompt, /flat vector illustration/);
      assert.match(item.prompt, /no ground, floor ellipse, cast shadow/);
      assert.ok(["vector", "illustration"].every(word => item.keywords.includes(word)));
      assert.equal(item.keywords.includes("photography"), false);
      assert.equal(isStockImageItem(item), true);
      assert.equal(getGenerationBlockReason(item), undefined);
    }
    assert.match(generateMetadataCsv(items, "regular_scene"), /\.svg"/);
    assert.doesNotMatch(generateMetadataCsv(items, "regular_scene"), /\.jpeg"/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("svg output is only allowed on sold-reference items", async () => {
  const originalFetch = global.fetch;
  try {
    const [item] = (await vectorPlan()).items;
    assert.equal(isStockImageItem({ ...item, saleReferenceStructure: undefined, saleReferenceLayout: undefined }), false);
    assert.equal(isStockImageItem({ ...item, outputFormat: "pdf" as "svg" }), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("SVG checks reject embedded rasters, scripts and external links", () => {
  assert.equal(svgProblem(SNOWMAN_SVG), undefined);
  assert.match(svgProblem(SNOWMAN_SVG.replace("<rect", `<image href="data:image/png;base64,AAAA"/><rect`)) ?? "", /raster/);
  assert.match(svgProblem(SNOWMAN_SVG.replace("<rect", "<script>alert(1)</script><rect")) ?? "", /active content/);
  assert.match(svgProblem(SNOWMAN_SVG.replace("<rect", `<use href="https://example.com/a.svg#x"/><rect`)) ?? "", /external/);
  assert.match(svgProblem("<html></html>") ?? "", /not an SVG/);
  assert.match(svgProblem(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>`) ?? "", /no vector shapes/);
});

test("the artboard is resized into Adobe's 15–65 MP range and keeps its viewBox", () => {
  const { svg, width, height } = sizeArtboardForAdobe(SNOWMAN_SVG);
  assert.ok(width * height >= 15_000_000 && width * height <= 65_000_000);
  assert.equal(Math.round((width / height) * 100), Math.round((2048 / 1536) * 100));
  assert.match(svg, new RegExp(`<svg width="${width}" height="${height}"`));
  assert.match(svg, /viewBox="0 0 2048 1536"/);
  assert.equal((svg.match(/\swidth=/g) ?? []).length, 2); // the root and the background rect only
});

test("vector generation requests SVG, inspects it and retries a rejected drawing", async () => {
  const originalFetch = global.fetch;
  const imageBodies: Array<Record<string, unknown>> = [];
  let inspections = 0;
  try {
    const [item] = (await vectorPlan()).items;
    global.fetch = async (input, init) => {
      const body = JSON.parse(String(init?.body));
      if (String(input).endsWith("/images")) {
        imageBodies.push(body);
        return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(SNOWMAN_SVG).toString("base64"), media_type: "image/svg+xml" }] }), { status: 200 });
      }
      inspections++;
      assert.match(body.messages[0].content[0].text, /FLAT VECTOR ILLUSTRATION/);
      assert.match(body.messages[0].content[0].text, /cartoon faces .+ are allowed/);
      const passed = inspections > 1;
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        passed, hasVisibleHumanFace: false, hasText: false, hasArtificialBorder: false, hasPosterLayout: false,
        isImmediatelyRecognizable: true, hasClearLiteralStory: true, hasClearCommercialUse: true, hasCutoutDamage: false,
        hasMultipleConfusingSubjects: false, issues: passed ? [] : ["snowman arm is broken"],
      }) } }] }), { status: 200 });
    };
    const result = await generateVectorImage(item, "test-key");
    assert.equal(imageBodies.length, 2);
    assert.equal(imageBodies[0].output_format, "svg");
    assert.equal(imageBodies[0].aspect_ratio, "4:3");
    assert.match(String(imageBodies[1].prompt), /rejected because: snowman arm is broken/);
    assert.equal(result.qualityReview?.status, "passed_after_retries");
    assert.match(result.svg ?? "", /<svg width="\d+" height="\d+"/);
  } finally {
    global.fetch = originalFetch;
  }
});
