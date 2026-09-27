import { getOpenRouterCredits } from "./openrouter";
import { conductMarketResearchAndGeneratePrompts } from "./market-research";
import { generateAllStockImages } from "./image-generator";
import { sendDailyStockEmail, sendCreditDepletedEmergencyAlert } from "./smtp2go";
import { WorkflowResult } from "./types";

export async function executeDailyStockWorkflow(
  forcedMode?: "transparent_png" | "regular_scene"
): Promise<WorkflowResult> {
  const startTime = Date.now();
  console.log("Starting Adobe Stock daily generation workflow...");

  // 1. ดึงเครดิต OpenRouter
  const initialCredits = await getOpenRouterCredits();
  console.log(`Initial OpenRouter Credits: $${initialCredits.remainingCredits.toFixed(4)}`);

  // 2. ทำการวิจัยตลาดและสร้าง 20 Prompts ตามโหมดของวัน (สลับวันเว้นวันแบบ 100% Homogeneous)
  console.log(`Conducting market research (mode: ${forcedMode || "auto-scheduled"})...`);
  const { trend, items, mode } = await conductMarketResearchAndGeneratePrompts(undefined, forcedMode);
  console.log(`Resolved generation mode: ${mode} (${items.length} items)`);

  // 3. สร้างภาพทั้ง 20 ภาพ
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

  // 5. ส่งอีเมลประจำวันพร้อมข้อมูลและไฟล์แนบผ่าน SMTP2GO
  console.log("Dispatching email via SMTP2GO to hs5ckt@gmail.com...");
  const emailResult = await sendDailyStockEmail({
    trend,
    images: generatedImages,
    credits: latestCredits,
    mode,
  });

  const durationMs = Date.now() - startTime;
  console.log(`Workflow completed in ${durationMs}ms with email success: ${emailResult.success}`);

  return {
    success: emailResult.success,
    timestamp: new Date().toISOString(),
    generationMode: mode,
    trend,
    images: generatedImages,
    credits: latestCredits,
    emailDelivery: {
      success: emailResult.success,
      recipient: process.env.RECIPIENT_EMAIL || "hs5ckt@gmail.com",
      messageId: emailResult.messageId,
      error: emailResult.error,
    },
    durationMs,
  };
}
