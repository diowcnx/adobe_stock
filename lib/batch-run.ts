import fs from "node:fs";
import { appendBatchLog, imagePath, saveImageDataUrl, type BatchPlan } from "./batch-output";
import { getErrorMessage } from "./errors";
import { generateSingleImage } from "./image-generator";
import { getOpenRouterCredits } from "./openrouter";

const CONCURRENCY = 3;
const MIN_CREDIT = 0.01;

export interface BatchRunReport {
  folder: string;
  saved: string[];
  warnings: string[];
  failed: string[];
  creditsBefore: number;
  creditsAfter: number;
}

async function confirmedCredits(): Promise<number> {
  const credits = await getOpenRouterCredits();
  if (credits.label === "Connection Error" || credits.label === "Unable to retrieve credits") {
    throw new Error("Unable to verify the OpenRouter balance; no images were generated");
  }
  return credits.remainingCredits;
}

/** Generate every image in the plan that has no file yet, saving each as it finishes. */
export async function runBatch(folder: string, plan: BatchPlan): Promise<BatchRunReport> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set; add it to .env.local");
  const creditsBefore = await confirmedCredits();
  if (creditsBefore <= MIN_CREDIT) throw new Error(`OpenRouter balance is too low ($${creditsBefore.toFixed(4)})`);

  const report: BatchRunReport = { folder, saved: [], warnings: [], failed: [], creditsBefore, creditsAfter: creditsBefore };
  const statuses: Record<number, string> = {};
  const queue = plan.items.filter(item => !fs.existsSync(imagePath(folder, item)));

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const label = `#${item.id} ${item.seoTitle}`;
      try {
        let result = await generateSingleImage(item);
        if (!result.imageUrl && item.manualFallbackPrompt && /visible human face/i.test(result.error ?? "")) {
          result = await generateSingleImage({ ...item, prompt: item.manualFallbackPrompt });
        }
        if (!result.imageUrl) throw new Error(result.error || "no image returned");
        report.saved.push(saveImageDataUrl(folder, item, result.imageUrl));
        statuses[item.id] = result.qualityReview?.status ?? "saved";
        if (result.qualityReview?.status === "accepted_after_retry_limit") {
          report.warnings.push(`${label}: ${result.qualityReview.rejectionReasons.join("; ")}`);
        }
        console.log(`done ${label}`);
      } catch (error: unknown) {
        statuses[item.id] = "failed";
        report.failed.push(`${label}: ${getErrorMessage(error, "unknown error")}`);
        console.warn(`failed ${label}`);
      }
    }
  });
  await Promise.all(workers);

  report.creditsAfter = await confirmedCredits().catch(() => creditsBefore);
  appendBatchLog(plan, statuses);
  return report;
}
