import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createBatchFolder, readBatchPlan, writeBatchPlan, type BatchPlan } from "../lib/batch-output";
import { runBatch } from "../lib/batch-run";
import { prepareManualResearchItems } from "../lib/manual-research";
import { getOpenRouterCredits } from "../lib/openrouter";
import { reserveUniquePromptBatch } from "../lib/prompt-history";
import { analyzeSoldReference } from "../lib/sale-reference";
import type { SaleReferenceLayout } from "../lib/types";

const LAYOUTS: Record<string, SaleReferenceLayout> = { scene: "full_scene", cutout: "isolated_white" };

const USAGE = `Usage: npm run generate -- <command> [--plan]

  structure           10 images from the structure catalog
  research            10 images from the newest research/manual-prompts-*.md
  sold <image-path>   10 new images expanded from a sold image
  resume <folder>     generate whatever is missing from a batch folder
  credits             show the OpenRouter balance

  --plan           write plan.json and metadata.csv only; generate later with resume
  --layout=scene   treat a sold image as a full scene (--layout=cutout for an isolated element)`;

async function soldImageDataUrl(file: string): Promise<string> {
  const jpeg = await sharp(file).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

async function buildPlan(command: string, target?: string, layout?: SaleReferenceLayout): Promise<BatchPlan> {
  const createdAt = new Date().toISOString();
  if (command === "structure") {
    const { trend, items } = await reserveUniquePromptBatch(createdAt);
    return { source: command, createdAt, trend, items };
  }
  if (command === "research") {
    const { items, researchDate, sourceFile } = await prepareManualResearchItems();
    const categories = [...new Set(items.map(item => item.category))];
    return {
      source: command, createdAt, items,
      trend: {
        theme: `Manual research: ${categories.join(", ")}`,
        targetMarket: [...new Set(items.map(item => item.commercialIntent?.targetBuyer).filter(Boolean))].slice(0, 3).join("; "),
        commercialReasoning: "Ten distinct manually researched visual stories based on observed stock search results, not verified sales rankings.",
        seasonalRelevance: `Stock research conducted ${researchDate} (${sourceFile})`,
        buyerDemandRating: "Research Candidate",
      },
    };
  }
  if (!target || !fs.existsSync(target)) throw new Error(`Sold image not found: ${target ?? "(no path given)"}`);
  const { analysis, trend, items } = await analyzeSoldReference(await soldImageDataUrl(target), undefined, layout);
  console.log(`Sold image: ${analysis.subject}\nLayout: ${analysis.layout}\nStrategy: ${analysis.expansionStrategy}`);
  return { source: command, createdAt, trend, items };
}

async function main(): Promise<void> {
  try { process.loadEnvFile(".env.local"); } catch { /* the key may come from the shell */ }
  const args = process.argv.slice(2);
  const planOnly = args.includes("--plan");
  const layoutArg = args.find(arg => arg.startsWith("--layout="))?.slice("--layout=".length);
  if (layoutArg && !(layoutArg in LAYOUTS)) throw new Error(`Unknown layout: ${layoutArg}`);
  const [command, target] = args.filter(arg => !arg.startsWith("--"));

  if (command === "credits") {
    const credits = await getOpenRouterCredits();
    console.log(`OpenRouter balance: $${credits.remainingCredits.toFixed(4)}${credits.label ? ` (${credits.label})` : ""}`);
    return;
  }
  if (!["structure", "research", "sold", "resume"].includes(command ?? "")) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  let folder: string;
  let plan: BatchPlan;
  if (command === "resume") {
    if (!target) throw new Error("resume needs a batch folder");
    folder = path.resolve(target);
    plan = readBatchPlan(folder);
  } else {
    plan = await buildPlan(command, target, layoutArg ? LAYOUTS[layoutArg] : undefined);
    folder = createBatchFolder(plan.source);
    writeBatchPlan(folder, plan);
  }

  if (planOnly) {
    plan.items.forEach(item => console.log(`#${item.id} [${item.category}] ${item.seoTitle}`));
    console.log(`Plan saved: ${folder}\nGenerate with: npm run generate -- resume "${folder}"`);
    return;
  }

  const report = await runBatch(folder, plan);
  console.log(`\nFolder: ${report.folder}`);
  console.log(`Saved ${report.saved.length} of ${plan.items.length} requested this run`);
  report.warnings.forEach(line => console.log(`QA warning ${line}`));
  report.failed.forEach(line => console.log(`Failed ${line}`));
  console.log(`Credit: $${report.creditsBefore.toFixed(4)} -> $${report.creditsAfter.toFixed(4)} (OpenRouter billing lags; recheck with the credits command)`);
  if (report.failed.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
