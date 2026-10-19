import fs from "node:fs";
import path from "node:path";
import { BlobError, BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { conductMarketResearchAndGeneratePrompts } from "./market-research";
import { getPromptConceptKey, getPromptFingerprint } from "./prompt-novelty";
import type { GenerationMode } from "./production-plan";
import type { StockImageItem } from "./types";

const PROMPT_HISTORY_PATH = "adobe-stock-prompt-history/ledger-v1.json";
const LOCAL_PROMPT_HISTORY_FILE = path.join("/tmp", "adobe-stock-prompt-history-v1.json");
const MAX_RESERVATION_RETRIES = 8;

export interface PromptHistoryState {
  version: 1;
  nextSequence: number;
  promptHashes: string[];
  conceptUsage: Record<string, number>;
  updatedAt: string;
}

interface StoredPromptHistory {
  state: PromptHistoryState;
  etag?: string;
}

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}

function emptyPromptHistory(): PromptHistoryState {
  return { version: 1, nextSequence: 0, promptHashes: [], conceptUsage: {}, updatedAt: new Date(0).toISOString() };
}

function parsePromptHistory(value: unknown): PromptHistoryState | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<PromptHistoryState>;
  if (candidate.version !== 1 || !Number.isSafeInteger(candidate.nextSequence) || Number(candidate.nextSequence) < 0) return null;
  if (!Array.isArray(candidate.promptHashes) || !candidate.promptHashes.every(hash => typeof hash === "string" && /^[0-9a-f]{64}$/.test(hash))) return null;
  if (typeof candidate.conceptUsage !== "object" || candidate.conceptUsage === null || Array.isArray(candidate.conceptUsage)) return null;
  if (!Object.entries(candidate.conceptUsage).every(([key, count]) => key.length > 0 && key.length <= 500 && Number.isSafeInteger(count) && Number(count) >= 0)) return null;
  if (typeof candidate.updatedAt !== "string" || Number.isNaN(Date.parse(candidate.updatedAt))) return null;
  return candidate as PromptHistoryState;
}

function addItemsToHistory(state: PromptHistoryState, items: StockImageItem[], sequence: number): PromptHistoryState {
  const hashes = new Set(state.promptHashes);
  const conceptUsage = { ...state.conceptUsage };
  for (const item of items) {
    hashes.add(getPromptFingerprint(item.prompt));
    const conceptKey = getPromptConceptKey(item);
    conceptUsage[conceptKey] = (conceptUsage[conceptKey] ?? 0) + 1;
  }
  return {
    version: 1,
    nextSequence: sequence + 1,
    promptHashes: [...hashes],
    conceptUsage,
    updatedAt: new Date().toISOString(),
  };
}

async function seedFromStoredBatches(): Promise<PromptHistoryState> {
  const state = emptyPromptHistory();
  if (!isVercelRuntime()) return state;
  const { getStoredBatches } = await import("./batch-store");
  const batches = await getStoredBatches();
  let seeded = state;
  for (const batch of batches) seeded = addItemsToHistory(seeded, batch.images, seeded.nextSequence);
  return seeded;
}

async function readPromptHistory(): Promise<StoredPromptHistory> {
  if (!isVercelRuntime()) {
    try {
      if (!fs.existsSync(LOCAL_PROMPT_HISTORY_FILE)) return { state: emptyPromptHistory() };
      const parsed = parsePromptHistory(JSON.parse(fs.readFileSync(LOCAL_PROMPT_HISTORY_FILE, "utf8")));
      if (!parsed) throw new Error("Local prompt history is invalid");
      return { state: parsed };
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("Local prompt history is invalid", { cause: error });
      throw error;
    }
  }

  const result = await get(PROMPT_HISTORY_PATH, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return { state: await seedFromStoredBatches() };
  const parsed = parsePromptHistory(JSON.parse(await new Response(result.stream).text()));
  if (!parsed) throw new Error("Stored prompt history is invalid");
  return { state: parsed, etag: result.blob.etag };
}

async function writePromptHistory(state: PromptHistoryState, etag?: string): Promise<boolean> {
  if (!isVercelRuntime()) {
    fs.writeFileSync(LOCAL_PROMPT_HISTORY_FILE, JSON.stringify(state), "utf8");
    return true;
  }

  try {
    await put(PROMPT_HISTORY_PATH, JSON.stringify(state), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      ...(etag ? { allowOverwrite: true, ifMatch: etag } : { allowOverwrite: false }),
    });
    return true;
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) return false;
    if (!etag && error instanceof BlobError) {
      const winner = await get(PROMPT_HISTORY_PATH, { access: "private", useCache: false });
      if (winner?.statusCode === 200) return false;
    }
    throw error;
  }
}

/**
 * Select and durably reserve ten unseen prompts before any image-model request.
 * Optimistic ETag writes keep simultaneous manual/cron prepares from claiming
 * the same edition. The ledger lives outside the deletable batch prefix.
 */
export async function reserveUniquePromptBatch(
  currentDate: string = new Date().toISOString(),
  forcedMode?: GenerationMode,
) {
  for (let attempt = 0; attempt < MAX_RESERVATION_RETRIES; attempt++) {
    const stored = await readPromptHistory();
    const usedHashes = new Set(stored.state.promptHashes);
    let sequence = stored.state.nextSequence;
    let result = await conductMarketResearchAndGeneratePrompts(currentDate, forcedMode, {
      sequence,
      conceptUsage: stored.state.conceptUsage,
    });
    let hashes = result.items.map(item => getPromptFingerprint(item.prompt));

    while (hashes.some(hash => usedHashes.has(hash) || hashes.filter(candidate => candidate === hash).length > 1)) {
      sequence++;
      result = await conductMarketResearchAndGeneratePrompts(currentDate, forcedMode, {
        sequence,
        conceptUsage: stored.state.conceptUsage,
      });
      hashes = result.items.map(item => getPromptFingerprint(item.prompt));
    }

    const nextState = addItemsToHistory(stored.state, result.items, sequence);
    if (await writePromptHistory(nextState, stored.etag)) return result;
  }
  throw new Error("Unable to reserve a unique prompt batch after concurrent updates");
}
