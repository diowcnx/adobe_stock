import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { findLatestResearchFile, parseManualResearch, prepareManualResearchItems } from "../lib/manual-research";
import { getGenerationBlockReason } from "../lib/generation-policy";
import { isStockImageItem } from "../lib/validation";

const DATE = new Date("2026-10-28T12:00:00Z");
const KEYWORDS = "alpha, bravo, charlie, delta, echo, foxtrot, golf, hotel, india, juliet, kilo, lima, mike, november, oscar";

function brief(n: number, extra = `   - Category: Test\n   - Keywords: ${KEYWORDS}`) {
  return `${n}. **Brief number ${n}** — Buyer: test buyer. Photorealistic scene ${n}, no faces, no text.\n${extra}\n`;
}

test("the latest research file creates ten valid distinct manual JPEG briefs", async () => {
  const { items, researchDate, sourceFile } = await prepareManualResearchItems(DATE);
  assert.match(researchDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(sourceFile, `research/manual-prompts-${researchDate}.md`);
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
