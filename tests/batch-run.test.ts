import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { createBatchFolder, readBatchPlan, writeBatchPlan, type BatchPlan } from "../lib/batch-output";
import { runBatch } from "../lib/batch-run";
import { prepareManualResearchItems } from "../lib/manual-research";

const REPORT = {
  passed: true, hasVisibleHumanFace: false, hasText: false, hasArtificialBorder: false, hasPosterLayout: false,
  isImmediatelyRecognizable: true, hasClearLiteralStory: true, hasClearCommercialUse: true,
  hasCutoutDamage: false, hasMultipleConfusingSubjects: false, issues: [],
};

async function withTempEnv(run: (root: string) => Promise<void>): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "batch-run-"));
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  process.env.ADOBE_OUTPUT_DIR = root;
  process.env.BATCH_LOG_FILE = path.join(root, "batches.jsonl");
  process.env.OPENROUTER_API_KEY = "test-key";
  try {
    await run(root);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = saved;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function mockOpenRouter(image: Buffer, counts: { images: number }, failFirst = 0) {
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("/credits")) {
      return new Response(JSON.stringify({ data: { total_credits: 5, total_usage: 1 } }));
    }
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.1-flash-lite-image") {
      counts.images++;
      if (counts.images <= failFirst) return new Response("{}", { status: 500 });
      return new Response(JSON.stringify({ choices: [{ message: { images: [{ b64_json: image.toString("base64") }] } }] }));
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(REPORT) } }] }));
  };
}

async function samplePlan(): Promise<BatchPlan> {
  const { items } = await prepareManualResearchItems(new Date("2026-10-30T05:00:00Z"));
  return {
    source: "research", createdAt: "2026-10-30T05:00:00.000Z", items,
    trend: { theme: "Test", targetMarket: "Test", commercialReasoning: "Test", seasonalRelevance: "Test", buyerDemandRating: "Research Candidate" },
  };
}

test("a batch saves each JPEG, the CSV and a log entry with no image data", async () => {
  await withTempEnv(async root => {
    const image = await sharp({ create: { width: 512, height: 342, channels: 3, background: "#3b6b4f" } }).jpeg().toBuffer();
    const counts = { images: 0 };
    mockOpenRouter(image, counts);
    const plan = await samplePlan();
    const folder = createBatchFolder(plan.source, new Date("2026-10-30T05:00:00Z"));
    assert.ok(folder.startsWith(root) && folder.endsWith("2026-10-30_120000_research"));
    writeBatchPlan(folder, plan);

    const report = await runBatch(folder, readBatchPlan(folder));
    assert.equal(report.saved.length, 10);
    assert.deepEqual(report.failed, []);
    const files = fs.readdirSync(folder);
    assert.equal(files.filter(file => file.endsWith(".jpeg")).length, 10);
    assert.ok(files.includes("metadata.csv"));
    assert.equal((await sharp(report.saved[0]).metadata()).format, "jpeg");

    const log = fs.readFileSync(process.env.BATCH_LOG_FILE as string, "utf8");
    assert.equal(log.trim().split("\n").length, 1);
    assert.doesNotMatch(log, /base64/);
  });
});

test("resume generates only the images that are missing", async () => {
  await withTempEnv(async () => {
    const image = await sharp({ create: { width: 512, height: 342, channels: 3, background: "#3b6b4f" } }).jpeg().toBuffer();
    const counts = { images: 0 };
    mockOpenRouter(image, counts);
    const plan = await samplePlan();
    const folder = createBatchFolder(plan.source);
    writeBatchPlan(folder, plan);
    const first = await runBatch(folder, plan);
    fs.rmSync(first.saved[0]);

    counts.images = 0;
    const second = await runBatch(folder, plan);
    assert.equal(counts.images, 1);
    assert.equal(second.saved.length, 1);
  });
});

test("nothing is generated without an API key", async () => {
  await withTempEnv(async () => {
    delete process.env.OPENROUTER_API_KEY;
    const counts = { images: 0 };
    mockOpenRouter(Buffer.alloc(0), counts);
    const plan = await samplePlan();
    await assert.rejects(() => runBatch(createBatchFolder(plan.source), plan), /OPENROUTER_API_KEY/);
    assert.equal(counts.images, 0);
  });
});
