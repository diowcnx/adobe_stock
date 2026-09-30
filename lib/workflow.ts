import { getOpenRouterCredits } from "./openrouter";
import { conductMarketResearchAndGeneratePrompts } from "./market-research";
import { generateAllStockImages } from "./image-generator";
import { sendDailyStockEmail, sendCreditDepletedEmergencyAlert } from "./smtp2go";
import { WorkflowResult } from "./types";

declare global {
  var __dailyStockWorkflowRunning: boolean | undefined;
}

async function runDailyStockWorkflow(
  forcedMode?: "transparent_png" | "regular_scene"
): Promise<WorkflowResult> {
  const startTime = Date.now();
  console.log("Starting Adobe Stock daily generation workflow...");

  // 1. ดึงเครดิต OpenRouter
  const initialCredits = await getOpenRouterCredits();
  console.log(`Initial OpenRouter Credits: $${initialCredits.remainingCredits.toFixed(4)}`);
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  if (initialCredits.label === "Connection Error" || initialCredits.label === "Unable to retrieve credits") {
    throw new Error("Unable to verify OpenRouter credit balance");
  }
  if (initialCredits.remainingCredits <= 0.01) {
    await sendCreditDepletedEmergencyAlert({ credits: initialCredits });
    throw new Error("OpenRouter credit balance is too low");
  }

  // 2. วางแผน 10 briefs ตามหมวดประจำวันของเวลาไทย
  console.log(`Conducting market research (mode: ${forcedMode || "auto-scheduled"})...`);
  const { trend, items, mode } = await conductMarketResearchAndGeneratePrompts(undefined, forcedMode);
  console.log(`Resolved generation mode: ${mode} (${items.length} items)`);

  // 3. สร้างภาพจำนวนตามชุดประจำวันที่กำหนด
  console.log(`Generating ${items.length} commercial images for mode: ${mode}...`);
  const generatedImages = await generateAllStockImages(items);

  // 4. ตรวจสอบเครดิตหลังสร้างภาพ
  const latestCredits = await getOpenRouterCredits();

  // ตรวจสอบว่าเครดิตหมดหรือไม่ (เหลือน้อยกว่า $0.01)
  const isCreditDepleted = latestCredits.remainingCredits <= 0.01 && Boolean(process.env.OPENROUTER_API_KEY);
  if (isCreditDepleted) {
    console.warn(`[ALERT] OpenRouter credit is depleted: $${latestCredits.remainingCredits.toFixed(4)}. Sending emergency alert...`);
    await sendCreditDepletedEmergencyAlert({ credits: latestCredits });
  }

  const workflowResult: WorkflowResult = {
    success: true,
    timestamp: new Date().toISOString(),
    generationMode: mode,
    trend,
    images: generatedImages,
    credits: latestCredits,
    emailDelivery: {
      success: false,
      recipient: process.env.RECIPIENT_EMAIL || "hs5ckt@gmail.com",
      error: "Email dispatch pending",
    },
    durationMs: Date.now() - startTime,
  };

  // เก็บภาพใน shared durable storage ก่อนส่งลิงก์ เพื่อไม่ให้อีเมลชี้ไปยังข้อมูลชั่วคราว
  const { saveLatestBatch } = await import("./batch-store");
  const persistedResult = await saveLatestBatch(workflowResult);

  // ส่งอีเมลหลังยืนยันว่าภาพและ Metadata พร้อมให้หน้าเว็บดาวน์โหลดแล้ว
  console.log("Dispatching email via SMTP2GO to hs5ckt@gmail.com...");
  const emailResult = await sendDailyStockEmail({
    trend,
    images: generatedImages,
    credits: latestCredits,
    mode,
  });

  const durationMs = Date.now() - startTime;
  console.log(`Workflow completed in ${durationMs}ms with email success: ${emailResult.success}`);

  const finalResult: WorkflowResult = {
    ...persistedResult,
    success: emailResult.success,
    emailDelivery: {
      success: emailResult.success,
      recipient: process.env.RECIPIENT_EMAIL || "hs5ckt@gmail.com",
      messageId: emailResult.messageId,
      error: emailResult.error,
    },
    durationMs,
  };
  await saveLatestBatch(finalResult);

  return finalResult;
}

export async function executeDailyStockWorkflow(
  forcedMode?: "transparent_png" | "regular_scene",
): Promise<WorkflowResult> {
  if (globalThis.__dailyStockWorkflowRunning) {
    throw new Error("A stock generation workflow is already running");
  }
  globalThis.__dailyStockWorkflowRunning = true;
  try {
    return await runDailyStockWorkflow(forcedMode);
  } finally {
    globalThis.__dailyStockWorkflowRunning = false;
  }
}
