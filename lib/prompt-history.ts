import fs from "node:fs";
import path from "node:path";
import { conductMarketResearchAndGeneratePrompts } from "./market-research";
import { getPromptConceptKey, getPromptFingerprint } from "./prompt-novelty";
import type { GenerationMode } from "./production-plan";
import type { StockImageItem } from "./types";

const MAX_RECENT_CONCEPTS = 300;

export interface PromptHistoryState {
  version: 1;
  nextSequence: number;
  promptHashes: string[];
  conceptUsage: Record<string, number>;
  recentConceptKeys: string[];
  updatedAt: string;
}

/** Committed to git so every machine and agent sees what has already been used. */
function promptHistoryFile(): string {
  return process.env.PROMPT_HISTORY_FILE || path.join(process.cwd(), "history", "prompt-history.json");
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

function readPromptHistory(): PromptHistoryState {
  const file = promptHistoryFile();
  if (!fs.existsSync(file)) return emptyPromptHistory();
  const parsed = parsePromptHistory(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!parsed) throw new Error(`Prompt history is invalid: ${file}`);
  return parsed;
}

function writePromptHistory(state: PromptHistoryState): void {
  const file = promptHistoryFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 1)}\n`, "utf8");
}

/** Select ten unseen prompts and record them before any image-model request. */
export async function reserveUniquePromptBatch(
  currentDate: string = new Date().toISOString(),
  forcedMode?: GenerationMode,
) {
  const stored = readPromptHistory();
  const usedHashes = new Set(stored.promptHashes);
  let sequence = stored.nextSequence;
  let result = await conductMarketResearchAndGeneratePrompts(currentDate, forcedMode, {
    sequence,
    conceptUsage: stored.conceptUsage,
    recentConceptKeys: stored.recentConceptKeys,
  });
  let hashes = result.items.map(item => getPromptFingerprint(item.prompt));

  while (hashes.some(hash => usedHashes.has(hash) || hashes.filter(candidate => candidate === hash).length > 1)) {
    sequence++;
    result = await conductMarketResearchAndGeneratePrompts(currentDate, forcedMode, {
      sequence,
      conceptUsage: stored.conceptUsage,
      recentConceptKeys: stored.recentConceptKeys,
    });
    hashes = result.items.map(item => getPromptFingerprint(item.prompt));
  }

  writePromptHistory(addItemsToHistory(stored, result.items, sequence));
  return result;
}
