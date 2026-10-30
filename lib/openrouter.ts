import { OpenRouterCreditInfo } from "./types";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

export interface CreditRequestOptions {
  attempts?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
}

interface CreditEndpointResult {
  response: Response | null;
  connectionError: boolean;
}

const DEFAULT_CREDIT_ATTEMPTS = 3;
const DEFAULT_CREDIT_TIMEOUT_MS = 8_000;
const DEFAULT_CREDIT_RETRY_DELAY_MS = 400;

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve();
}

async function requestCreditEndpoint(
  path: "/credits" | "/key",
  key: string,
  options: Required<CreditRequestOptions>,
): Promise<CreditEndpointResult> {
  let lastResponse: Response | null = null;
  let connectionError = false;

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      const response = await fetch(`${OPENROUTER_API_BASE}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      lastResponse = response;
      connectionError = false;

      const retryableStatus = response.status === 429 || response.status >= 500;
      if (response.ok || !retryableStatus || attempt === options.attempts) {
        return { response, connectionError: false };
      }
    } catch (error) {
      connectionError = true;
      console.warn(`OpenRouter credit audit ${path} attempt ${attempt}/${options.attempts} failed:`, error instanceof Error ? error.name : "Connection error");
    }

    if (attempt < options.attempts) {
      await wait(options.retryDelayMs * attempt);
    }
  }

  return { response: lastResponse, connectionError };
}

/**
 * ดึงข้อมูลเครดิตและการใช้งานของบัญชี OpenRouter
 */
export async function getOpenRouterCredits(
  apiKey?: string,
  requestOptions: CreditRequestOptions = {},
): Promise<OpenRouterCreditInfo> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;

  if (!key) {
    return {
      totalCredits: 0,
      totalUsage: 0,
      remainingCredits: 0,
      label: "API Key Not Configured",
      isFreeTier: true,
    };
  }

  const options: Required<CreditRequestOptions> = {
    attempts: requestOptions.attempts ?? DEFAULT_CREDIT_ATTEMPTS,
    timeoutMs: requestOptions.timeoutMs ?? DEFAULT_CREDIT_TIMEOUT_MS,
    retryDelayMs: requestOptions.retryDelayMs ?? DEFAULT_CREDIT_RETRY_DELAY_MS,
  };
  if (!Number.isInteger(options.attempts) || options.attempts < 1 || options.attempts > 5) {
    throw new Error("Credit request attempts must be between 1 and 5");
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100 || options.timeoutMs > 30_000) {
    throw new Error("Credit request timeout must be between 100 and 30000 milliseconds");
  }
  if (!Number.isInteger(options.retryDelayMs) || options.retryDelayMs < 0 || options.retryDelayMs > 5_000) {
    throw new Error("Credit request delay must be between 0 and 5000 milliseconds");
  }

  // First use the account credit endpoint. A transient timeout must not prevent
  // retries or the independent /key fallback from running.
  const creditsResult = await requestCreditEndpoint("/credits", key, options);
  if (creditsResult.response?.ok) {
    try {
      const data = await creditsResult.response.json();
      const totalCredits = data?.data?.total_credits ?? 0;
      const totalUsage = data?.data?.total_usage ?? 0;
      const remainingCredits = Math.max(0, totalCredits - totalUsage);

      return {
        totalCredits,
        totalUsage,
        remainingCredits,
      };
    } catch (error) {
      console.warn("OpenRouter /credits returned invalid JSON; trying /key:", error instanceof Error ? error.name : "Parse error");
    }
  }

  const keyResult = await requestCreditEndpoint("/key", key, options);
  if (keyResult.response?.ok) {
    try {
      const keyData = await keyResult.response.json();
      const usage = keyData?.data?.usage ?? 0;
      const limit = keyData?.data?.limit;
      const limitRemaining = keyData?.data?.limit_remaining;
      const remainingCredits = typeof limitRemaining === "number"
        ? Math.max(0, limitRemaining)
        : typeof limit === "number"
          ? Math.max(0, limit - usage)
          : null;

      if (remainingCredits === null) {
        console.warn("OpenRouter /key did not return a finite credit limit");
      } else {
        return {
          totalCredits: typeof limit === "number" ? limit : usage + remainingCredits,
          totalUsage: usage,
          remainingCredits,
          label: keyData?.data?.label,
          isFreeTier: keyData?.data?.is_free_tier,
        };
      }

    } catch (error) {
      console.warn("OpenRouter /key returned invalid JSON:", error instanceof Error ? error.name : "Parse error");
    }
  }

  const connectionError = !creditsResult.response && !keyResult.response &&
    (creditsResult.connectionError || keyResult.connectionError);
  return {
    totalCredits: 0,
    totalUsage: 0,
    remainingCredits: 0,
    label: connectionError ? "Connection Error" : "Unable to retrieve credits",
  };
}

/**
 * เรียก LLM บน OpenRouter สำหรับสร้างผลลัพธ์แบบ JSON
 * รองรับ TypeSafe: Jev Router (typesafe/jev-router)
 */
export async function callOpenRouterJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  model: string = "google/gemini-3.1-flash-lite",
  apiKey?: string
): Promise<T> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;

  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not defined in environment variables.");
  }

  const systemWithJsonInstruction = `${systemPrompt}\n\nIMPORTANT: Respond with pure JSON only, without any introductory or concluding text.`;

  // 1. ลองเรียกพร้อม response_format: { type: "json_object" }
  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://adobe-stock.vercel.app",
      "X-Title": "Adobe Stock Market Research & Generator",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemWithJsonInstruction },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 6000,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  // One planning request only. The caller uses curated briefs if it fails.

  if (!response.ok) {
    console.error(`OpenRouter API failed with status ${response.status}`);
    throw new Error("OpenRouter request failed");
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenRouter");
  }

  // แยก JSON ออกมาแม้จะมีข้อความ Markdown หรือเกริ่นนำ
  try {
    return JSON.parse(content) as T;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as T;
  }
}
