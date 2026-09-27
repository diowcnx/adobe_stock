import { OpenRouterCreditInfo } from "./types";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

/**
 * ดึงข้อมูลเครดิตและการใช้งานของบัญชี OpenRouter
 */
export async function getOpenRouterCredits(apiKey?: string): Promise<OpenRouterCreditInfo> {
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

  try {
    // 1. ลองเรียก endpoint /credits ของ OpenRouter
    const creditsRes = await fetch(`${OPENROUTER_API_BASE}/credits`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 0 },
    });

    if (creditsRes.ok) {
      const data = await creditsRes.json();
      const totalCredits = data?.data?.total_credits ?? 0;
      const totalUsage = data?.data?.total_usage ?? 0;
      const remainingCredits = Math.max(0, totalCredits - totalUsage);

      return {
        totalCredits,
        totalUsage,
        remainingCredits,
      };
    }

    // 2. ถ้า /credits ไม่สำเร็จ ให้ลองเรียก /auth/key
    const keyRes = await fetch(`${OPENROUTER_API_BASE}/auth/key`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 0 },
    });

    if (keyRes.ok) {
      const keyData = await keyRes.json();
      const usage = keyData?.data?.usage ?? 0;
      const limit = keyData?.data?.limit;
      const remainingCredits = limit !== null && limit !== undefined ? Math.max(0, limit - usage) : 0;

      return {
        totalCredits: limit ?? usage,
        totalUsage: usage,
        remainingCredits,
        label: keyData?.data?.label,
        isFreeTier: keyData?.data?.is_free_tier,
      };
    }

    return {
      totalCredits: 0,
      totalUsage: 0,
      remainingCredits: 0,
      label: "Unable to retrieve credits",
    };
  } catch (error) {
    console.error("Error fetching OpenRouter credits:", error);
    return {
      totalCredits: 0,
      totalUsage: 0,
      remainingCredits: 0,
      label: "Connection Error",
    };
  }
}

/**
 * เรียก LLM บน OpenRouter สำหรับสร้างผลลัพธ์แบบ JSON
 * รองรับ TypeSafe: Jev Router (typesafe/jev-router)
 */
export async function callOpenRouterJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  model: string = "typesafe/jev-router",
  apiKey?: string
): Promise<T> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;

  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not defined in environment variables.");
  }

  const systemWithJsonInstruction = `${systemPrompt}\n\nIMPORTANT: Respond with pure JSON only, without any introductory or concluding text.`;

  // 1. ลองเรียกพร้อม response_format: { type: "json_object" }
  let response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
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
    }),
  });

  // ถ้า router ไม่รองรับ response_format (เช่น เกิด 400) ให้ส่งคำขอแบบปกติ
  if (!response.ok && response.status === 400) {
    console.warn(`Router ${model} does not support response_format, retrying with standard prompt...`);
    response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
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
        temperature: 0.7,
      }),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API failed (${response.status}): ${errorText}`);
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
