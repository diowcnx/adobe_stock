import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { findLatestResearchFile, parseManualResearch, prepareManualResearchItems } from "../lib/manual-research";
import { getGenerationBlockReason } from "../lib/generation-policy";
import { isStockImageItem } from "../lib/validation";
import { generateSingleImage } from "../lib/image-generator";
import sharp from "sharp";

const DATE = new Date("2026-10-28T12:00:00Z");
const KEYWORDS = "alpha, bravo, charlie, delta, echo, foxtrot, golf, hotel, india, juliet, kilo, lima, mike, november, oscar";

function brief(n: number, extra: string | undefined = `   - Category: Test\n   - Keywords: ${KEYWORDS}`) {
  return `${n}. **Brief number ${n}** — Buyer: test buyer. Photorealistic scene ${n}, no faces, no text.\n${extra}\n`;
}

test("the latest research file creates ten valid distinct manual JPEG briefs", async () => {
  const { items, researchDate, sourceFile } = await prepareManualResearchItems(DATE);
  assert.match(researchDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(sourceFile, new RegExp(`^research/manual-prompts-${researchDate}(-\\d+)?\\.md$`));
  assert.equal(items.length, 10);
  assert.equal(new Set(items.map(item => item.prompt)).size, 10);
  for (const item of items) {
    assert.equal(isStockImageItem(item), true, item.seoTitle);
    assert.equal(getGenerationBlockReason(item), undefined);
    assert.equal(item.generationMode, "regular_scene");
    assert.ok(item.keywords.length >= 15 && item.keywords.every(keyword => /^[a-z]+$/.test(keyword)), item.seoTitle);
  }
});

test("the newest dated research file wins and unrelated files are ignored", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "research-"));
  try {
    const body = Array.from({ length: 10 }, (_, i) => brief(i + 1)).join("\n");
    await writeFile(path.join(dir, "manual-prompts-2026-10-28.md"), body);
    await writeFile(path.join(dir, "manual-prompts-2026-11-05.md"), body.replace("Brief number 1**", "Newest brief**"));
    await writeFile(path.join(dir, "manual-prompts-draft.md"), "ignored");
    await writeFile(path.join(dir, "README.md"), "ignored");
    assert.deepEqual(await findLatestResearchFile(dir), { file: "manual-prompts-2026-11-05.md", researchDate: "2026-11-05" });
    const { items } = await prepareManualResearchItems(DATE, dir);
    assert.equal(items[0].seoTitle, "Newest brief");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a numbered second round on the same date wins over the first", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "research-"));
  try {
    const body = Array.from({ length: 10 }, (_, i) => brief(i + 1)).join("\n");
    await writeFile(path.join(dir, "manual-prompts-2026-11-02.md"), body);
    await writeFile(path.join(dir, "manual-prompts-2026-11-02-2.md"), body);
    await writeFile(path.join(dir, "manual-prompts-2026-11-01-3.md"), body);
    assert.deepEqual(await findLatestResearchFile(dir), { file: "manual-prompts-2026-11-02-2.md", researchDate: "2026-11-02" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("category, keywords and fallback come from the research file", () => {
  const body = brief(1, `   - Category: Garden\n   - Keywords: ${KEYWORDS}\n   - Fallback: Empty garden bench, no people.`)
    + Array.from({ length: 9 }, (_, i) => brief(i + 2)).join("\n");
  const [first, second] = parseManualResearch(body, DATE);
  assert.equal(first.category, "Garden");
  assert.equal(first.manualFallbackPrompt, "Empty garden bench, no people.");
  assert.equal(second.manualFallbackPrompt, undefined);
  assert.deepEqual(first.keywords.slice(0, 3), ["alpha", "bravo", "charlie"]);
  assert.equal(isStockImageItem(first), true);
});

test("malformed research files are rejected before any generation", () => {
  const ten = (n: number) => brief(n);
  assert.throws(() => parseManualResearch(Array.from({ length: 9 }, (_, i) => ten(i + 1)).join("\n"), DATE), /exactly ten/);
  assert.throws(() => parseManualResearch([1, 3].map(ten).join("\n"), DATE), /out of order/);
  assert.throws(() => parseManualResearch(Array.from({ length: 10 }, (_, i) => brief(i + 1, `   - Keywords: ${KEYWORDS}`)).join("\n"), DATE), /Category/);
  assert.throws(() => parseManualResearch(Array.from({ length: 10 }, (_, i) => brief(i + 1, "   - Category: Test\n   - Keywords: one, two")).join("\n"), DATE), /at least 15/);
});

test("a fallback prompt is only valid on manual research items", () => {
  const [item] = parseManualResearch(Array.from({ length: 10 }, (_, i) => brief(i + 1)).join("\n"), DATE);
  assert.equal(isStockImageItem({ ...item, manualFallbackPrompt: "x" }), true);
  assert.equal(isStockImageItem({ ...item, manualResearch: undefined, manualFallbackPrompt: "x" }), false);
});

test("a research brief can ask for a watercolor illustration and an isolated layout", () => {
  const body = Array.from({ length: 10 }, (_, i) => brief(i + 1,
    i === 0 ? `   - Category: Animals\n   - Keywords: ${KEYWORDS}\n   - Medium: loose watercolor painting\n   - Layout: isolated`
    : i === 1 ? `   - Category: Landscapes\n   - Keywords: ${KEYWORDS}\n   - Medium: loose watercolor painting`
    : undefined)).join("\n");
  const [cutout, scene, photo] = parseManualResearch(body, DATE);
  assert.equal(cutout.manualMedium, "loose watercolor painting");
  assert.equal(cutout.manualLayout, "isolated_white");
  assert.equal(cutout.aspectRatio, "1:1");
  assert.equal(scene.manualMedium, "loose watercolor painting");
  assert.equal(scene.manualLayout, undefined);
  assert.equal(scene.aspectRatio, "3:2");
  assert.equal(photo.manualMedium, undefined);
  for (const item of [cutout, scene, photo]) assert.equal(isStockImageItem(item), true);
  assert.equal(isStockImageItem({ ...cutout, manualResearch: undefined }), false);
  assert.equal(isStockImageItem({ ...scene, manualMedium: " " }), false);
  assert.throws(() => parseManualResearch(Array.from({ length: 10 }, (_, i) => brief(i + 1, `   - Category: Test\n   - Keywords: ${KEYWORDS}\n   - Layout: frame`)).join("\n"), DATE), /unknown "- Layout:"/);
});

async function runResearchItem(item: ReturnType<typeof parseManualResearch>[number], background: string) {
  const originalFetch = globalThis.fetch;
  const image = await sharp({ create: { width: 256, height: 256, channels: 3, background } }).jpeg().toBuffer();
  const prompts: string[] = [];
  const inspections: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      prompts.push(body.messages[0].content);
      return new Response(JSON.stringify({ choices: [{ message: { images: [{ b64_json: image.toString("base64") }] } }] }));
    }
    inspections.push(body.messages[0].content[0].text);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      passed: true, hasVisibleHumanFace: false, hasText: false, hasArtificialBorder: false,
      hasPosterLayout: false, isImmediatelyRecognizable: true, hasClearLiteralStory: true,
      hasClearCommercialUse: true, hasCutoutDamage: false, hasMultipleConfusingSubjects: false, issues: [],
    }) } }] }));
  };
  try {
    const result = await generateSingleImage(item, "test-key");
    return { result, prompt: prompts[0], inspection: inspections[0] };
  } finally { globalThis.fetch = originalFetch; }
}

test("a watercolor isolated research brief is painted on white and inspected as an illustration", async () => {
  const body = Array.from({ length: 10 }, (_, i) => brief(i + 1, `   - Category: Animals\n   - Keywords: ${KEYWORDS}\n   - Medium: loose watercolor painting\n   - Layout: isolated`)).join("\n");
  const [item] = parseManualResearch(body, DATE);
  const { result, prompt, inspection } = await runResearchItem(item, "#ffffff");
  assert.ok(result.imageUrl, result.error);
  assert.match(prompt, /isolated stock element painted as a loose watercolor painting illustration on seamless pure white/);
  assert.match(prompt, /Render the whole image as a loose watercolor painting illustration, not a photograph/);
  assert.match(inspection, /ISOLATED STOCK ELEMENT/);
  assert.match(inspection, /intentional LOOSE WATERCOLOR PAINTING ILLUSTRATION, not a photograph/);
});

test("a watercolor scene research brief stays full bleed, and a plain brief stays a photograph", async () => {
  const body = Array.from({ length: 10 }, (_, i) => brief(i + 1, i === 0 ? `   - Category: Landscapes\n   - Keywords: ${KEYWORDS}\n   - Medium: loose watercolor painting` : undefined)).join("\n");
  const [scene, photo] = parseManualResearch(body, DATE);
  const painted = await runResearchItem(scene, "#9bb08a");
  assert.match(painted.prompt, /full-bleed commercial loose watercolor painting illustration, not a photograph/);
  assert.doesNotMatch(painted.inspection, /ISOLATED STOCK ELEMENT/);
  assert.match(painted.inspection, /LOOSE WATERCOLOR PAINTING ILLUSTRATION/);
  const plain = await runResearchItem(photo, "#9bb08a");
  assert.match(plain.prompt, /photographed background reaches every edge/);
  assert.doesNotMatch(plain.prompt, /illustration, not a photograph/);
  assert.doesNotMatch(plain.inspection, /ILLUSTRATION, not a photograph/);
});
