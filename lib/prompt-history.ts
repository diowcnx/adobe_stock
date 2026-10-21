import fs from "node:fs";
import path from "node:path";
import { BlobError, get, list, put } from "@vercel/blob";
import { conductMarketResearchAndGeneratePrompts } from "./market-research";
import { getPromptConceptKey, getPromptFingerprint } from "./prompt-novelty";
import type { GenerationMode } from "./production-plan";
import type { StockImageItem } from "./types";

const PROMPT_HISTORY_PATH = "adobe-stock-prompt-history/ledger-v1.json";
const PROMPT_RESERVATION_PREFIX = "adobe-stock-prompt-history/reservations/";
const LOCAL_PROMPT_HISTORY_FILE = path.join("/tmp", "adobe-stock-prompt-history-v1.json");
const MAX_RESERVATION_RETRIES = 8;
const MAX_RECENT_CONCEPTS = 300;

export interface PromptHistoryState {
  version: 1;
  nextSequence: number;
  promptHashes: string[];
  conceptUsage: Record<string, number>;
  recentConceptKeys: string[];
  updatedAt: string;
}

interface StoredPromptHistory {
  state: PromptHistoryState;
}

function getPromptReservationPath(nextSequence: number): string {
  return `${PROMPT_RESERVATION_PREFIX}reservation-${String(nextSequence).padStart(12, "0")}.json`;
}

function getPromptReservationSequence(pathname: string): number | null {
  const match = pathname.match(/\/reservation-(\d{12})\.json$/);
  if (!match) return null;
  const sequence = Number(match[1]);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}

function emptyPromptHistory(): PromptHistoryState {
  return { version: 1, nextSequence: 0, promptHashes: [], conceptUsage: {}, recentConceptKeys: [], updatedAt: new Date(0).toISOString() };
}

function parsePromptHistory(value: unknown): PromptHistoryState | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<PromptHistoryState>;
  if (candidate.version !== 1 || !Number.isSafeInteger(candidate.nextSequence) || Number(candidate.nextSequence) < 0) return null;
  if (!Array.isArray(candidate.promptHashes) || !candidate.promptHashes.every(hash => typeof hash === "string" && /^[0-9a-f]{64}$/.test(hash))) return null;
  if (typeof candidate.conceptUsage !== "object" || candidate.conceptUsage === null || Array.isArray(candidate.conceptUsage)) return null;
  if (!Object.entries(candidate.conceptUsage).every(([key, count]) => key.length > 0 && key.length <= 500 && Number.isSafeInteger(count) && Number(count) >= 0)) return null;
  const recentConceptKeys = candidate.recentConceptKeys ?? [];
  if (!Array.isArray(recentConceptKeys) || recentConceptKeys.length > MAX_RECENT_CONCEPTS ||
      !recentConceptKeys.every(key => typeof key === "string" && key.length > 0 && key.length <= 500)) return null;
  if (typeof candidate.updatedAt !== "string" || Number.isNaN(Date.parse(candidate.updatedAt))) return null;
  return { ...candidate, recentConceptKeys } as PromptHistoryState;
}

function addItemsToHistory(state: PromptHistoryState, items: StockImageItem[], sequence: number): PromptHistoryState {
  const hashes = new Set(state.promptHashes);
  const conceptUsage = { ...state.conceptUsage };
  for (const item of items) {
    hashes.add(getPromptFingerprint(item.prompt));
    const conceptKey = getPromptConceptKey(item);
    conceptUsage[conceptKey] = (conceptUsage[conceptKey] ?? 0) + 1;
  }
  const selectedConceptKeys = items.map(getPromptConceptKey);
  const selectedConceptSet = new Set(selectedConceptKeys);
  return {
    version: 1,
    nextSequence: sequence + 1,
    promptHashes: [...hashes],
    conceptUsage,
    recentConceptKeys: [
      ...selectedConceptKeys,
      ...state.recentConceptKeys.filter(key => !selectedConceptSet.has(key)),
    ].slice(0, MAX_RECENT_CONCEPTS),
    updatedAt: new Date().toISOString(),
  };
}

async function seedFromStoredBatches(): Promise<PromptHistoryState> {
  const state = emptyPromptHistory();
  if (!isVercelRuntime()) return state;
  const { getStoredBatches } = await import("./batch-store");
  const batches = await getStoredBatches();
  let seeded = state;
  for (const batch of [...batches].reverse()) seeded = addItemsToHistory(seeded, batch.images, seeded.nextSequence);
  return seeded;
}

async function hydrateRecentConceptsFromLatestBatch(state: PromptHistoryState): Promise<PromptHistoryState> {
  if (state.recentConceptKeys.length > 0) return state;
  const { getStoredBatches } = await import("./batch-store");
  const latest = (await getStoredBatches())[0];
  return latest ? { ...state, recentConceptKeys: latest.images.map(getPromptConceptKey) } : state;
}

async function readPromptHistory(): Promise<StoredPromptHistory> {
  if (!isVercelRuntime()) {
    try {
      if (!fs.existsSync(LOCAL_PROMPT_HISTORY_FILE)) return { state: emptyPromptHistory() };
      const parsed = parsePromptHistory(JSON.parse(fs.readFileSync(LOCAL_PROMPT_HISTORY_FILE, "utf8")));
      if (!parsed) throw new Error("Local prompt history is invalid");
      return { state: await hydrateRecentConceptsFromLatestBatch(parsed) };
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("Local prompt history is invalid", { cause: error });
      throw error;
    }
  }

  const legacyResult = await get(PROMPT_HISTORY_PATH, { access: "private", useCache: false });
  let state = await seedFromStoredBatches();
  if (legacyResult?.statusCode === 200) {
    const parsed = parsePromptHistory(JSON.parse(await new Response(legacyResult.stream).text()));
    if (!parsed) throw new Error("Stored prompt history is invalid");
    state = parsed;
  }

  // Reservations are immutable snapshots. Selecting the greatest sequence avoids
  // ETag-dependent overwrites while keeping concurrent callers atomic.
  let cursor: string | undefined;
  let latestReservation: { pathname: string; sequence: number } | null = null;
  do {
    const page = await list({ prefix: PROMPT_RESERVATION_PREFIX, limit: 1_000, cursor });
    for (const blob of page.blobs) {
      const sequence = getPromptReservationSequence(blob.pathname);
      if (sequence !== null && (!latestReservation || sequence > latestReservation.sequence)) {
        latestReservation = { pathname: blob.pathname, sequence };
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  if (latestReservation && latestReservation.sequence > state.nextSequence) {
    const reservation = await get(latestReservation.pathname, { access: "private", useCache: false });
    if (!reservation || reservation.statusCode !== 200) throw new Error("Latest prompt reservation is unavailable");
    const parsed = parsePromptHistory(JSON.parse(await new Response(reservation.stream).text()));
    if (!parsed || parsed.nextSequence !== latestReservation.sequence) {
      throw new Error("Latest prompt reservation is invalid");
    }
    state = parsed;
  }

  return { state: await hydrateRecentConceptsFromLatestBatch(state) };
}

async function writePromptHistory(state: PromptHistoryState): Promise<boolean> {
  if (!isVercelRuntime()) {
    fs.writeFileSync(LOCAL_PROMPT_HISTORY_FILE, JSON.stringify(state), "utf8");
    return true;
  }

  const reservationPath = getPromptReservationPath(state.nextSequence);
  try {
    await put(reservationPath, JSON.stringify(state), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return true;
  } catch (error) {
    if (error instanceof BlobError) {
      const winner = await get(reservationPath, { access: "private", useCache: false });
      if (winner?.statusCode === 200) return false;
    }
    throw error;
  }
}

/**
 * Select and durably reserve ten unseen prompts before any image-model request.
 * Immutable, sequence-numbered reservations keep simultaneous manual/cron
 * prepares from claiming the same edition without relying on mutable ETags.
 * The legacy ledger is retained as the migration base and remains outside the
 * deletable batch prefix.
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
      recentConceptKeys: stored.state.recentConceptKeys,
    });
    let hashes = result.items.map(item => getPromptFingerprint(item.prompt));

    while (hashes.some(hash => usedHashes.has(hash) || hashes.filter(candidate => candidate === hash).length > 1)) {
      sequence++;
      result = await conductMarketResearchAndGeneratePrompts(currentDate, forcedMode, {
        sequence,
        conceptUsage: stored.state.conceptUsage,
        recentConceptKeys: stored.state.recentConceptKeys,
      });
      hashes = result.items.map(item => getPromptFingerprint(item.prompt));
    }

    const nextState = addItemsToHistory(stored.state, result.items, sequence);
    if (await writePromptHistory(nextState)) return result;
  }
  throw new Error("Unable to reserve a unique prompt batch after concurrent updates");
}
