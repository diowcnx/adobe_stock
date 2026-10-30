import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateMetadataCsv, getStockImageFilename } from "./csv";
import { getBangkokDate } from "./production-plan";
import type { MarketTrend, StockImageItem } from "./types";

export interface BatchPlan {
  source: string;
  createdAt: string;
  trend: MarketTrend;
  items: StockImageItem[];
}

const PLAN_FILE = "plan.json";

/** Images stay on the machine that made them; override with ADOBE_OUTPUT_DIR. */
export function outputRoot(): string {
  return process.env.ADOBE_OUTPUT_DIR || path.join(os.homedir(), "Downloads", "adobe");
}

export function createBatchFolder(source: string, date: Date = new Date()): string {
  const time = date.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour12: false }).replace(/:/g, "");
  const folder = path.join(outputRoot(), `${getBangkokDate(date)}_${time}_${source}`);
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

export function writeBatchPlan(folder: string, plan: BatchPlan): void {
  fs.writeFileSync(path.join(folder, PLAN_FILE), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(folder, "metadata.csv"), generateMetadataCsv(plan.items, "regular_scene"), "utf8");
}

export function readBatchPlan(folder: string): BatchPlan {
  const file = path.join(folder, PLAN_FILE);
  if (!fs.existsSync(file)) throw new Error(`No ${PLAN_FILE} in ${folder}`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as BatchPlan;
}

export function imagePath(folder: string, item: StockImageItem): string {
  return path.join(folder, getStockImageFilename(item, "regular_scene"));
}

export function saveImageDataUrl(folder: string, item: StockImageItem, dataUrl: string): string {
  const match = /^data:image\/[a-z+]+;base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error(`Image ${item.id} did not return inline image data`);
  const file = imagePath(folder, item);
  fs.writeFileSync(file, Buffer.from(match[1], "base64"));
  return file;
}

/** One line per batch in git, without image data, so other machines can see past work. */
export function appendBatchLog(plan: BatchPlan, statuses: Record<number, string>): void {
  const file = process.env.BATCH_LOG_FILE || path.join(process.cwd(), "history", "batches.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify({
    createdAt: plan.createdAt,
    source: plan.source,
    theme: plan.trend.theme,
    images: plan.items.map(item => ({ title: item.seoTitle, category: item.category, status: statuses[item.id] })),
  })}\n`, "utf8");
}
