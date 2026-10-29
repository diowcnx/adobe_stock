"use client";

import React, { useState, useEffect, useCallback } from "react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  RefreshCw,
  Send,
  Copy,
  Check,
  Coins,
  TrendingUp,
  Image as ImageIcon,
  Clock,
  ExternalLink,
  Mail,
  Sliders,
  CheckCircle2,
  AlertCircle,
  LogOut,
  FileSpreadsheet,
  FolderArchive,
  ArrowDownToLine,
  Loader2,
  History,
  Trash2,
  Upload,
  Trophy
} from "lucide-react";
import JSZip from "jszip";
import { WorkflowResult, OpenRouterCreditInfo, StockImageItem } from "@/lib/types";
import { generateMetadataCsv, getStockImageFilename } from "@/lib/csv";
import { getErrorMessage, isRecord } from "@/lib/errors";
import { BATCH_SIZE, getDailyCategory, MONTHLY_CATEGORIES } from "@/lib/production-plan";
import { isWorkflowResult } from "@/lib/validation";
import { getItemGenerationMode, summarizeConceptPlan } from "@/lib/structured-concepts";

type DashboardTab = "overview" | "sale" | "images" | "setup";

interface PreparedBatchResponse {
  mode: "regular_scene";
  trend: WorkflowResult["trend"];
  items: StockImageItem[];
  credits: OpenRouterCreditInfo;
  conceptPlan?: WorkflowResult["conceptPlan"];
}

interface SoldReferenceAnalysisView {
  subject: string;
  visualStrengths: string;
  likelyBuyerUses: string[];
  expansionStrategy: string;
}

interface UiNotice {
  tone: "success" | "error" | "info";
  message: string;
}

interface TestEmailResult {
  success: boolean;
  configured?: boolean;
  error?: string;
  httpStatus?: number;
  senderEmail?: string;
  recipientEmail?: string;
}

interface SavedBatch {
  id: string;
  dateStr: string;
  theme: string;
  mode: "transparent_png" | "regular_scene";
  imageCount: number;
  data: WorkflowResult;
}

function parseSavedBatches(value: unknown): SavedBatch[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is SavedBatch =>
    isRecord(entry) &&
    typeof entry.id === "string" &&
    typeof entry.dateStr === "string" &&
    typeof entry.theme === "string" &&
    (entry.mode === "transparent_png" || entry.mode === "regular_scene") &&
    typeof entry.imageCount === "number" &&
    isWorkflowResult(entry.data),
  );
}

function mergeSavedBatches(serverEntries: unknown, localEntries: unknown): SavedBatch[] {
  const serverBatches = parseSavedBatches(serverEntries);
  const serverIds = new Set(serverBatches.map((batch) => batch.id));
  return [...serverBatches, ...parseSavedBatches(localEntries).filter((batch) => !serverIds.has(batch.id))];
}

function getSavedBatchModeLabel(batch: SavedBatch): string {
  const summary = batch.data.conceptPlan || summarizeConceptPlan(batch.data.images, batch.mode);
  if (summary.enabled) return `🧵 ${summary.transparentPngCount} PNG + ${summary.regularSceneCount} JPEG`;
  return batch.mode === "transparent_png" ? "🔲 PNG" : "🏞️ ฉาก";
}

async function compressReferenceImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("รองรับเฉพาะไฟล์ JPEG, PNG และ WebP");
  if (file.size > 20_000_000) throw new Error("ไฟล์ต้นฉบับต้องมีขนาดไม่เกิน 20 MB");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = document.createElement("img");
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("เบราว์เซอร์ไม่สามารถเตรียมภาพได้");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function Dashboard() {
  const router = useRouter();
  const [credits, setCredits] = useState<OpenRouterCreditInfo | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<string>("");
  const [latestResult, setLatestResult] = useState<WorkflowResult | null>(null);
  const [savedBatches, setSavedBatches] = useState<SavedBatch[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<TestEmailResult | null>(null);
  const [notice, setNotice] = useState<UiNotice | null>(null);
  const [saleReferenceFile, setSaleReferenceFile] = useState<File | null>(null);
  const [saleReferencePreview, setSaleReferencePreview] = useState<string>("");
  const [saleReferenceAnalysis, setSaleReferenceAnalysis] = useState<SoldReferenceAnalysisView | null>(null);

  const showNotice = useCallback((message: string, tone: UiNotice["tone"] = "info") => {
    setNotice({ message, tone });
  }, []);

  const selectTab = useCallback((tab: DashboardTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch("/api/test-email", { method: "POST" });
      const json = (await res.json()) as TestEmailResult;
      setTestEmailResult(json);
      if (json.success) {
        if (latestResult) {
          setLatestResult({
            ...latestResult,
            emailDelivery: {
              success: true,
              recipient: json.recipientEmail || "hs5ckt@gmail.com",
            },
          });
        }
        alert("✅ ส่งอีเมลทดสอบไปยัง " + (json.recipientEmail || "hs5ckt@gmail.com") + " สำเร็จเรียบร้อยแล้ว! โปรดตรวจสอบใน Inbox หรือ Spam");
      } else {
        const errorDetail = json.error || `HTTP ${json.httpStatus || 500}`;
        alert("❌ ส่งอีเมลไม่สำเร็จ:\n" + errorDetail + "\n\nคำแนะนำ: ตรวจสอบ SMTP2GO_API_KEY หรือตั้งค่า SENDER_EMAIL ให้ตรงกับ Verified Senders ในบัญชี SMTP2GO");
      }
    } catch (error: unknown) {
      alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ: " + getErrorMessage(error, "Unknown error"));
    } finally {
      setTestingEmail(false);
    }
  };

  const todayCategory = getDailyCategory();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.removeItem("adobe_stock_history");
      router.replace("/login");
      router.refresh();
    } catch {
      router.replace("/login");
    }
  };

  // ดึงเครดิต OpenRouter เมื่อโหลดหน้าเว็บ
  const fetchCredits = useCallback(async (announce = false) => {
    setLoadingCredits(true);
    try {
      const res = await fetch("/api/credits");
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) throw new Error(json.error || "ไม่สามารถโหลดเครดิตได้");
      setCredits(json.data);
      if (announce) showNotice("อัปเดตยอดเครดิตเรียบร้อยแล้ว", "success");
    } catch (e) {
      console.error("Failed to load credits:", e);
      if (announce) showNotice(getErrorMessage(e, "ไม่สามารถโหลดเครดิตได้"), "error");
    } finally {
      setLoadingCredits(false);
    }
  }, [showNotice]);

  const [loadingBatch, setLoadingBatch] = useState(false);

  // บันทึกชุดภาพลงใน Local History เพื่อให้เปิดดูย้อนหลังได้ตลอดเวลา
  const saveBatchToHistory = useCallback((batchData: WorkflowResult) => {
    if (!batchData || !batchData.images || batchData.images.length === 0) return;
    try {
      const existing: SavedBatch[] = JSON.parse(localStorage.getItem("adobe_stock_history") || "[]");
      const dateStr = new Date(batchData.timestamp || Date.now()).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        dateStyle: "medium",
        timeStyle: "short",
      });
      const batchId = batchData.timestamp || String(Date.now());
      const filtered = existing.filter((b) => b.id !== batchId);
      const cleanData: WorkflowResult = {
        ...batchData,
        images: batchData.images.map((image) => {
          const cleanImage = { ...image };
          delete cleanImage.imageBase64;
          if (cleanImage.imageUrl?.startsWith("data:")) delete cleanImage.imageUrl;
          return cleanImage;
        }),
      };
      const newEntry: SavedBatch = {
        id: batchId,
        dateStr,
        theme: batchData.trend?.theme || "Commercial Stock Set",
        mode: batchData.generationMode || "regular_scene",
        imageCount: batchData.images.length,
        data: cleanData,
      };
      const updated = [newEntry, ...filtered].slice(0, 20);
      localStorage.setItem("adobe_stock_history", JSON.stringify(updated));
      setSavedBatches(updated);
    } catch (e) {
      console.warn("Could not save to history:", e);
    }
  }, []);

  // ดึงชุดภาพล่าสุดอัตโนมัติ (จาก URL Query หรือจาก Cache บนเซิร์ฟเวอร์)
  const fetchLatestBatch = useCallback(async () => {
    setLoadingBatch(true);
    try {
      const res = await fetch("/api/latest-batch");
      if (res.ok) {
        const data = await res.json();
        const { batchHistory: historyPayload, ...latestBatch } = data;
        const batchHistory: unknown = historyPayload;
        if (Array.isArray(batchHistory)) {
          const localHistory: unknown = JSON.parse(localStorage.getItem("adobe_stock_history") || "[]");
          setSavedBatches(mergeSavedBatches(batchHistory, localHistory));
        }
        if (latestBatch.success && isWorkflowResult(latestBatch)) {
          setLatestResult(latestBatch);
          saveBatchToHistory(latestBatch);
          if (Array.isArray(batchHistory)) {
            const localHistory: unknown = JSON.parse(localStorage.getItem("adobe_stock_history") || "[]");
            setSavedBatches(mergeSavedBatches(batchHistory, localHistory));
          }
          selectTab("images");
        }
      }
    } catch (e) {
      console.warn("Could not load latest batch:", e);
    } finally {
      setLoadingBatch(false);
    }
  }, [saveBatchToHistory, selectTab]);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      await Promise.resolve();
      try {
        const requestedTab = new URLSearchParams(window.location.search).get("tab");
        if (requestedTab === "overview" || requestedTab === "sale" || requestedTab === "images" || requestedTab === "setup") {
          setActiveTab(requestedTab);
        }
        const stored = localStorage.getItem("adobe_stock_history");
        const parsed: unknown = stored ? JSON.parse(stored) : [];
        if (!cancelled && Array.isArray(parsed)) {
          const valid = parsed.filter((entry): entry is SavedBatch =>
            isRecord(entry) &&
            typeof entry.id === "string" &&
            typeof entry.dateStr === "string" &&
            typeof entry.theme === "string" &&
            typeof entry.imageCount === "number" &&
            isWorkflowResult(entry.data),
          );
          setSavedBatches(valid);
          if (valid.length > 0) setLatestResult(valid[0].data);
        }
      } catch (error) {
        console.warn("Could not parse history:", error);
      }
      if (!cancelled) {
        await Promise.all([fetchCredits(), fetchLatestBatch()]);
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, [fetchCredits, fetchLatestBatch]);

  // กดเริ่มกระบวนการทันทีด้วยระบบ Progressive Generation (ป้องกัน 504 Timeout เด็ดขาด และเห็นผลสดทันที)
  const triggerManualRun = async (preparedBatch?: PreparedBatchResponse) => {
    setIsRunning(true);
    setRunProgress(preparedBatch ? `กำลังเตรียมสร้าง ${preparedBatch.items.length} แนวคิดใหม่...` : `กำลังวางแผนแนวคิดและเตรียม ${BATCH_SIZE} ภาพ...`);
    try {
      let prepData: PreparedBatchResponse;
      if (preparedBatch) {
        prepData = preparedBatch;
      } else {
        const prepRes = await fetch("/api/prepare-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "auto" }),
        });
        const responseData = await prepRes.json();
        if (!prepRes.ok || !responseData.success) throw new Error(responseData.error || "ไม่สามารถเตรียมชุดภาพได้");
        prepData = responseData as PreparedBatchResponse;
      }

      if (prepData.credits) {
        setCredits(prepData.credits);
      }

      const initialBatch: WorkflowResult = {
        success: true,
        timestamp: new Date().toISOString(),
        generationMode: prepData.mode,
        conceptPlan: prepData.conceptPlan,
        trend: prepData.trend,
        images: prepData.items,
        credits: prepData.credits,
        emailDelivery: { success: false, recipient: "web" },
        durationMs: 0,
      };

      // นำการ์ดขึ้นจอทันที ผู้ใช้จะเห็น Title, Keywords และคิวสร้างภาพทันที
      setLatestResult(initialBatch);
      selectTab("images");

      // 2. สร้างภาพทั้งชุดแบบต่อเนื่องในพื้นหลัง (สร้างทีละ 3 ภาพพร้อมกัน)
      let completedCount = 0;
      const updatedImages = [...prepData.items];
      const queue = [...prepData.items];
      const concurrency = 3;

      const totalCount = queue.length;
      setRunProgress(`กำลังสร้างภาพ: 0/${totalCount} ภาพเสร็จแล้ว...`);

      const workers = Array(concurrency).fill(null).map(async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;

          try {
            const genRes = await fetch("/api/generate-item-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ item, timestamp: initialBatch.timestamp }),
            });
            const genData = await genRes.json();
            const targetIdx = updatedImages.findIndex((x) => x.id === item.id);
            if (targetIdx !== -1) {
              updatedImages[targetIdx] = {
                ...updatedImages[targetIdx],
                imageUrl: genRes.ok && genData.imageUrl ? genData.imageUrl : undefined,
                qualityReview: genData.qualityReview,
                description: genData.qualityReview?.status === "accepted_after_retry_limit"
                  ? `QA warning: ${genData.qualityReview.rejectionReasons.join("; ")}`
                  : genRes.ok && genData.imageUrl
                    ? undefined
                    : getErrorMessage(genData.error, "สร้างภาพไม่สำเร็จ"),
              };
              setLatestResult((prev) => prev ? { ...prev, images: [...updatedImages] } : prev);
              if (!genData.imageUrl) {
                console.warn(`Image #${item.id} was not accepted:`, genData.error);
              }
            }
          } catch (itemErr) {
            console.warn(`Error generating image #${item.id}:`, itemErr);
          }

          completedCount++;
          const pct = totalCount === 0 ? 100 : Math.round((completedCount / totalCount) * 100);
          setRunProgress(`กำลังสร้างภาพ: ${completedCount}/${totalCount} ภาพเสร็จแล้ว (${pct}%)...`);
        }
      });

      await Promise.all(workers);

      // 3. บันทึกผลลัพธ์ที่เสร็จสมบูรณ์ลง History และ Server Cache
      const finalResult: WorkflowResult = {
        ...initialBatch,
        images: updatedImages,
      };
      const rejectedImageCount = finalResult.images.filter((image) => !image.imageUrl).length;

      // Persist images first so any email download link points to durable storage.
      setRunProgress("กำลังบันทึกภาพลงพื้นที่จัดเก็บถาวร...");
      let persistenceReady = false;
      try {
        const saveRes = await fetch("/api/save-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalResult),
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok || !saveData.success || !isWorkflowResult(saveData.batch)) {
          throw new Error(saveData.error || "ไม่สามารถบันทึกชุดภาพลงพื้นที่ถาวรได้");
        }
        finalResult.images = saveData.batch.images;
        persistenceReady = true;
      } catch (error: unknown) {
        console.error("Could not persist generated batch:", error);
        finalResult.emailDelivery = {
          success: false,
          recipient: "web",
          error: getErrorMessage(error, "Persistent storage failed; email was not sent"),
        };
        showNotice("บันทึกชุดภาพถาวรไม่สำเร็จ ระบบจะไม่ส่งอีเมลลิงก์ที่เปิดไม่ได้", "error");
      }

      // Dispatch only after persistence succeeds, so email links always work.
      if (persistenceReady && rejectedImageCount === 0) {
        setRunProgress("กำลังส่งอีเมลแจ้งเตือนไปยัง hs5ckt@gmail.com...");
        try {
          const emailRes = await fetch("/api/dispatch-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalResult),
          });
          const emailData = await emailRes.json();
          finalResult.emailDelivery = {
            success: emailRes.ok && Boolean(emailData.success),
            recipient: "hs5ckt@gmail.com",
            messageId: emailData.messageId,
            error: emailData.error || (!emailRes.ok ? "Email dispatch request failed" : undefined),
          };
        } catch (error: unknown) {
          console.warn("Could not dispatch email:", error);
          finalResult.emailDelivery = {
            success: false,
            recipient: "hs5ckt@gmail.com",
            error: getErrorMessage(error, "Email dispatch failed"),
          };
        }
      } else if (persistenceReady) {
        finalResult.success = false;
        finalResult.emailDelivery = {
          success: false,
          recipient: "hs5ckt@gmail.com",
          error: `Quality gate rejected ${rejectedImageCount} image(s); incomplete batch was not emailed`,
        };
        showNotice(`ระบบคัดภาพที่ไม่ผ่านออก ${rejectedImageCount} ภาพ และยังไม่ส่งอีเมลชุดที่ไม่ครบ`, "error");
      }

      setLatestResult({ ...finalResult });
      saveBatchToHistory(finalResult);

      try {
        if (persistenceReady) {
          await fetch("/api/save-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalResult),
          });
        }
      } catch {}

      void fetchCredits();
    } catch (error: unknown) {
      console.error("Run error:", error);
      alert("เกิดข้อผิดพลาดในการสร้างภาพ: " + getErrorMessage(error, "Unknown error"));
    } finally {
      setIsRunning(false);
      setRunProgress("");
    }
  };

  const triggerSaleReferenceRun = async () => {
    if (!saleReferenceFile) {
      showNotice("กรุณาเลือกภาพที่มีหลักฐานการขายก่อน", "error");
      return;
    }
    setIsRunning(true);
    setRunProgress("กำลังย่อภาพและวิเคราะห์สัญญาณจากภาพที่ขายได้...");
    try {
      const imageDataUrl = await compressReferenceImage(saleReferenceFile);
      const response = await fetch("/api/analyze-sale-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "วิเคราะห์ภาพไม่สำเร็จ");
      setSaleReferenceAnalysis(data.analysis as SoldReferenceAnalysisView);
      await triggerManualRun(data as PreparedBatchResponse);
    } catch (error: unknown) {
      console.error("Sold reference run error:", error);
      showNotice(getErrorMessage(error, "ไม่สามารถวิเคราะห์และสร้างภาพได้"), "error");
      setIsRunning(false);
      setRunProgress("");
    }
  };

  const triggerResearchRun = async () => {
    setIsRunning(true);
    setRunProgress("กำลังตรวจเครดิตและเตรียม 10 prompt ที่วิจัยไว้...");
    try {
      const response = await fetch("/api/prepare-research-batch", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "ไม่สามารถเตรียมชุดภาพได้");
      await triggerManualRun(data as PreparedBatchResponse);
    } catch (error: unknown) {
      showNotice(getErrorMessage(error, "ไม่สามารถเตรียมชุดภาพได้"), "error");
      setIsRunning(false);
      setRunProgress("");
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch (error: unknown) {
      showNotice(getErrorMessage(error, "เบราว์เซอร์ไม่อนุญาตให้คัดลอกข้อความ"), "error");
    }
  };

  const downloadMetadataCsv = () => {
    if (!latestResult || !latestResult.images || latestResult.images.length === 0) {
      showNotice("ยังไม่มีข้อมูลภาพสำหรับดาวน์โหลด CSV", "error");
      return;
    }
    const csvContent = generateMetadataCsv(latestResult.images, latestResult.generationMode);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    link.setAttribute("href", url);
    link.setAttribute("download", `adobe_stock_metadata_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotice("เริ่มดาวน์โหลดไฟล์ CSV แล้ว", "success");
  };

  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<string>("");
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  const deleteCurrentBatch = async () => {
    if (!latestResult || latestResult.images.length === 0) return;
    const confirmed = window.confirm(
      `ยืนยันลบภาพทั้งหมด ${latestResult.images.length} ภาพในชุดนี้หรือไม่?\n\nระบบจะลบภาพและข้อมูลชุดนี้ออกจากที่เก็บถาวรและประวัติในเบราว์เซอร์ การลบไม่สามารถย้อนกลับได้`,
    );
    if (!confirmed) return;

    setIsDeletingBatch(true);
    try {
      const response = await fetch(`/api/latest-batch?timestamp=${encodeURIComponent(latestResult.timestamp)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Server rejected batch deletion");

      const remaining = savedBatches.filter((saved) => saved.id !== latestResult.timestamp);
      localStorage.setItem("adobe_stock_history", JSON.stringify(remaining));
      setSavedBatches(remaining);
      setLatestResult(remaining[0]?.data ?? null);
      if (remaining.length === 0) selectTab("overview");
      showNotice("ลบภาพทั้งหมดในชุดนี้เรียบร้อยแล้ว", "success");
    } catch (error: unknown) {
      console.error("Batch deletion failed:", error);
      showNotice("ลบชุดภาพไม่สำเร็จ ระบบยังเก็บข้อมูลชุดนี้ไว้", "error");
    } finally {
      setIsDeletingBatch(false);
    }
  };

  const downloadAllImagesZip = async () => {
    if (!latestResult || !latestResult.images || latestResult.images.length === 0) {
      showNotice("ยังไม่มีภาพสำหรับสร้างไฟล์ ZIP", "error");
      return;
    }
    const batch = latestResult;
    setIsZipping(true);
    setZipProgress("กำลังเริ่มเตรียมแพ็กเกจ ZIP...");
    try {
      const zip = new JSZip();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

      // 1. แนบไฟล์ CSV เข้าไปใน ZIP เพื่อความสะดวกในการใช้งานทันที
      const csvContent = generateMetadataCsv(batch.images, batch.generationMode);
      zip.file(`adobe_stock_metadata_${dateStr}.csv`, csvContent);

      // 2. ดึงภาพทั้งหมดในชุด
      let count = 0;
      let addedImageCount = 0;
      for (const img of batch.images) {
        if (img.imageUrl) {
          count++;
          setZipProgress(`กำลังโหลดภาพที่ ${count}/${batch.images.length}...`);
          try {
            const filename = getStockImageFilename(img, batch.generationMode);
            if (img.imageUrl.startsWith("data:")) {
              const base64Data = img.imageUrl.split(",")[1];
              zip.file(filename, base64Data, { base64: true });
              addedImageCount++;
            } else {
              let blob: Blob | null = null;
              try {
                const res = await fetch(img.imageUrl);
                if (res.ok) {
                  blob = await res.blob();
                }
              } catch {
                // fallback to proxy
              }

              if (!blob) {
                const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(img.imageUrl)}`);
                if (proxyRes.ok) {
                  blob = await proxyRes.blob();
                }
              }

              if (blob) {
                zip.file(filename, blob);
                addedImageCount++;
              }
            }
          } catch (fetchErr) {
            console.warn(`Could not add image #${img.id} to zip:`, fetchErr);
          }
        }
      }

      if (addedImageCount === 0) {
        throw new Error("ไม่มีภาพที่ดาวน์โหลดได้ในชุดนี้");
      }

      setZipProgress("กำลังสร้างและบีบอัดไฟล์ ZIP ทั้งหมด...");
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      const modeSlug = batch.generationMode || "stock";
      link.download = `adobe_stock_batch_${modeSlug}_${dateStr}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (addedImageCount < batch.images.filter((image) => Boolean(image.imageUrl)).length) {
        showNotice(`ดาวน์โหลด ZIP แล้ว แต่มีภาพ ${addedImageCount}/${batch.images.filter((image) => Boolean(image.imageUrl)).length} ภาพ`, "error");
      }
    } catch (error: unknown) {
      console.error("ZIP creation error:", error);
      alert("ไม่สามารถสร้างไฟล์ ZIP ได้: " + getErrorMessage(error, "Unknown error"));
    } finally {
      setIsZipping(false);
      setZipProgress("");
    }
  };

  const downloadSingleImage = async (img: StockImageItem) => {
    if (!img.imageUrl) {
      showNotice("ภาพนี้ยังสร้างไม่เสร็จ จึงยังดาวน์โหลดไม่ได้", "error");
      return;
    }
    try {
      const filename = getStockImageFilename(img, latestResult?.generationMode);
      if (img.imageUrl.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = img.imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotice(`เริ่มดาวน์โหลด ${filename} แล้ว`, "success");
        return;
      }

      let blob: Blob | null = null;
      try {
        const res = await fetch(img.imageUrl);
        if (res.ok) blob = await res.blob();
      } catch {}

      if (!blob) {
        const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(img.imageUrl)}`);
        if (proxyRes.ok) blob = await proxyRes.blob();
      }

      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showNotice(`เริ่มดาวน์โหลด ${filename} แล้ว`, "success");
      } else {
        const remoteUrl = new URL(img.imageUrl);
        if (remoteUrl.protocol === "https:") {
          window.open(remoteUrl.toString(), "_blank", "noopener,noreferrer");
          showNotice("เปิดภาพต้นฉบับในแท็บใหม่แล้ว", "info");
        } else {
          throw new Error("URL ของภาพไม่ปลอดภัยหรือไม่รองรับ");
        }
      }
    } catch (error: unknown) {
      showNotice(getErrorMessage(error, "ดาวน์โหลดภาพไม่สำเร็จ"), "error");
    }
  };

  const currentConceptPlan = latestResult
    ? latestResult.conceptPlan || summarizeConceptPlan(latestResult.images, latestResult.generationMode)
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Adobe Stock AI Producer</h1>
              <p className="text-xs text-slate-400">diowcnx/adobe_stock &bull; Vercel Automated Engine</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Credit Pill */}
            <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400">OpenRouter Credit:</span>
              <span className="font-mono font-bold text-sky-400">
                {credits ? `$${credits.remainingCredits.toFixed(4)}` : "Loading..."}
              </span>
              <button
                type="button"
                onClick={() => void fetchCredits(true)}
                disabled={loadingCredits}
                title="Refresh Credit"
                className="hover:text-white text-slate-400 p-0.5 rounded hover:bg-slate-700 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCredits ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="bg-violet-950/70 border border-violet-700/60 text-xs text-violet-200 rounded-xl px-3 py-2 font-medium" title="Food Fusion · Booth · Editorial Still Life · Dual Material · Beverage Campaign · Culinary Editorial · Aerial Landscape · Editorial Pen Sketch · Symmetrical Storefront · Thai Nature Poster">
              10 Structures · JPEG
            </div>

            {/* Run Button */}
            <button
              type="button"
              onClick={() => void triggerManualRun()}
              disabled={isRunning}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{runProgress || "กำลังสร้างภาพ..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>⚡ สั่งสร้างชุดภาพ {BATCH_SIZE} ภาพทันที</span>
                </>
              )}
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              title="ออกจากระบบ"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700/60 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {notice && (
          <div
            role={notice.tone === "error" ? "alert" : "status"}
            aria-live="polite"
            className={`fixed right-4 top-20 z-[60] max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl ${
              notice.tone === "success"
                ? "border-emerald-700 bg-emerald-950 text-emerald-200"
                : notice.tone === "error"
                  ? "border-rose-700 bg-rose-950 text-rose-200"
                  : "border-sky-700 bg-sky-950 text-sky-200"
            }`}
          >
            {notice.message}
          </div>
        )}
        {/* Live Generation Progress Banner */}
        {isRunning && runProgress && (
          <div className="bg-sky-950/80 border-2 border-sky-400 rounded-2xl p-5 mb-4 shadow-xl shadow-sky-500/10 flex items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-400/40">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <h3 className="font-bold text-sky-300 text-sm">{runProgress}</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  ระบบกำลังสร้างภาพแบบ Real-time โดยภาพแต่ละภาพจะทยอยแสดงบนหน้าจอทันที ไม่ต้องรอนาน
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Low Credit Warning Banner */}
        {credits && credits.remainingCredits <= 0.05 && (
          <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-red-500/10">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-red-400 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-red-300 text-sm flex items-center gap-2">
                  เครดิต OpenRouter ของคุณใกล้หมดหรือหมดแล้ว (${credits.remainingCredits.toFixed(4)})
                </h3>
                <p className="text-xs text-red-200/70 mt-0.5">
                  ระบบส่งอีเมลแจ้งเตือนไปยัง hs5ckt@gmail.com เรียบร้อยแล้ว กรุณาเติมเครดิตเพื่อไม่ให้รอบการทำงานถัดไปหยุดชะงัก
                </p>
              </div>
            </div>
            <a
              href="https://openrouter.ai/credits"
              target="_blank"
              rel="noreferrer"
              className="bg-red-600 hover:bg-red-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-red-600/30 whitespace-nowrap"
            >
              <span>เติมเครดิต OpenRouter</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Navigation Tabs & History Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 gap-3 pb-1">
          <div className="flex items-center space-x-4 overflow-x-auto" role="tablist" aria-label="ส่วนต่าง ๆ ของแดชบอร์ด">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overview"}
              aria-controls="tab-panel-overview"
              onClick={() => selectTab("overview")}
              className={`pb-3 text-sm font-medium transition relative whitespace-nowrap ${
                activeTab === "overview"
                  ? "text-sky-400 border-b-2 border-sky-400 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              📊 สถานะระบบ &amp; เวลาทำงาน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "sale"}
              aria-controls="tab-panel-sale"
              onClick={() => selectTab("sale")}
              className={`pb-3 text-sm font-medium transition relative whitespace-nowrap ${
                activeTab === "sale"
                  ? "text-amber-300 border-b-2 border-amber-300 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🏆 ต่อยอดภาพที่ขายได้
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "images"}
              aria-controls="tab-panel-images"
              onClick={() => selectTab("images")}
              className={`pb-3 text-sm font-medium transition relative whitespace-nowrap ${
                activeTab === "images"
                  ? "text-sky-400 border-b-2 border-sky-400 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🖼️ ภาพสต็อกที่สร้างเสร็จแล้ว ({latestResult ? latestResult.images.length : 0} ภาพ)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "setup"}
              aria-controls="tab-panel-setup"
              onClick={() => selectTab("setup")}
              className={`pb-3 text-sm font-medium transition relative whitespace-nowrap ${
                activeTab === "setup"
                  ? "text-sky-400 border-b-2 border-sky-400 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ⚙️ ตั้งค่า &amp; ทดสอบระบบ
            </button>
          </div>

          {/* History Selector Dropdown */}
          {savedBatches.length > 0 && (
            <div className="flex items-center gap-2 mb-2 sm:mb-0 shrink-0">
              <History className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">ประวัติชุดภาพเดิม:</span>
              <select
                onChange={(e) => {
                  const found = savedBatches.find((b) => b.id === e.target.value);
                  if (found) {
                    setLatestResult(found.data);
                    selectTab("images");
                  }
                }}
                className="bg-slate-900 border border-slate-700/80 text-xs text-sky-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500 font-medium max-w-[280px] truncate cursor-pointer"
                value={latestResult?.timestamp || ""}
              >
                {savedBatches.map((b, idx) => (
                  <option key={b.id} value={b.id}>
                    {idx === 0 ? "🌟 [ล่าสุด] " : ""}{b.dateStr} &bull; {getSavedBatchModeLabel(b)} ({b.imageCount} ภาพ)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div id="tab-panel-overview" role="tabpanel" className="space-y-6">
            <div className="rounded-2xl border border-sky-500/30 bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
              <div><h2 className="font-semibold text-white">ชุดวิจัย 28 ตุลาคม: Privacy · Smart Home · Light Pollution</h2><p className="mt-1 text-sm text-slate-400">สร้าง 10 ภาพจาก prompt ที่วิจัยไว้ พร้อมบันทึกและส่งอีเมล ใช้เครดิต OpenRouter และอาจมีการสร้างทดแทนตาม QA</p></div>
              <button type="button" disabled={isRunning} onClick={() => void triggerResearchRun()} className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">สร้างชุดวิจัย 10 ภาพ</button>
            </div>
            {/* Quick Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Scheduled Trigger</span>
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold text-white">18:00 ICT</div>
                <p className="text-xs text-slate-500 mt-1">Every day (11:00 UTC)</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Target Email</span>
                  <Mail className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-sm font-bold text-white truncate">hs5ckt@gmail.com</div>
                <p className="text-xs text-slate-500 mt-1">SMTP2GO Dispatcher</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Daily Production</span>
                  <ImageIcon className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-xl font-bold text-white">{BATCH_SIZE} Images / Day</div>
                <p className="text-xs text-slate-500 mt-1">31 distinct buyer-use themes by day of month</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">SEO Keywords</span>
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-white">15 - 25 Words</div>
                <p className="text-xs text-slate-500 mt-1">Single-word keywords &amp; Top 10 prioritized</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Today&apos;s Mode</span>
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-sm font-bold text-cyan-300 truncate">
                  Fusion · Booth · Still Life · Dual · Drinks · Food Editorial · Aerial · Pen Sketch · Storefront · Thai Nature
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  10 Structure · แบบละ 1 ภาพ · รวม 10 ภาพ · ไม่มีใบหน้าคน
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-3">Ten structures · One image each daily</h3>
              <p className="text-sm text-slate-300">รวม 10 ภาพจาก 10 Structure แบบละ 1 ภาพ: Food Fusion, บูธสินค้า, Editorial Still Life, Dual Material, Beverage Campaign, Culinary Editorial, Aerial Landscape, Editorial Pen Sketch, Symmetrical Minimal Storefront และทิวทัศน์ธรรมชาติ–ทุ่งดอกไม้เมืองไทยแบบสีโปสเตอร์วาดมือ พร้อม Creative Direction Engine ที่เปลี่ยนแกนเรื่อง อารมณ์ ประสาทสัมผัส บริบทท้องถิ่น และเลย์เอาต์สำหรับผู้ซื้อในแต่ละวัน โดยบันทึก Prompt History ถาวรก่อนเริ่มสร้างภาพ</p>
              <details className="mt-3">
              <summary className="cursor-pointer text-xs text-slate-400">แผนหมวดเดิม (ยกเลิกการใช้สร้างภาพ)</summary>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {MONTHLY_CATEGORIES.map((category) => (
                  <div key={category.day} className={`rounded-xl border p-3 ${category.day === todayCategory.day ? "border-sky-500/60 bg-sky-950/40" : "border-slate-800 bg-slate-950/50"}`}>
                    <div className="text-[11px] text-slate-500">Day {category.day}</div>
                    <div className="text-xs font-semibold text-slate-200 mt-1">{category.name}</div>
                    <div className="text-[10px] text-slate-500 mt-1">JPEG photography</div>
                  </div>
                ))}
              </div>
              </details>
              <p className="text-[11px] text-slate-500 mt-3">Creative Direction หมุนเวียนตาม Adobe Creative Trends 2026: All the Feels, Connectioneering, Surreal Silliness และ Local Flavors พร้อมกฎให้ภาพสื่อสารได้ภายใน 2 วินาที ทั้งหมดเป็นสมมติฐานเชิงสร้างสรรค์ที่ต้องทดลอง ไม่ใช่ยอดขายยืนยัน</p>
            </div>

            {/* Workflow Pipeline Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                Daily Automated Pipeline Architecture
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center">1</div>
                  <div className="font-semibold text-white">Market Research</div>
                  <p className="text-slate-400">Uses matched food-hardware ideas with explicit buyers and campaign uses. No live sales claims.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center">2</div>
                  <div className="font-semibold text-white">{BATCH_SIZE} Stock Prompts</div>
                  <p className="text-slate-400">Builds all 10 active structures exactly once in every 10-image JPEG batch and reserves every prompt in durable history before generation. Thai nature poster art replaces retired architectural masterplans.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 font-bold flex items-center justify-center">3</div>
                  <div className="font-semibold text-white">Image Generation</div>
                  <p className="text-slate-400">Generates JPEG photographs and illustrations using Gemini via OpenRouter and checks the resulting images.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center">4</div>
                  <div className="font-semibold text-white">Credit Audit</div>
                  <p className="text-slate-400">Calculates remaining balance and usage directly via OpenRouter API.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">5</div>
                  <div className="font-semibold text-white">SMTP2GO Dispatch</div>
                  <p className="text-slate-400">Emails high-res attachments, SEO titles, and keywords ready to paste to hs5ckt@gmail.com.</p>
                </div>
              </div>
            </div>

            {/* Quick Action Prompt to Run */}
            {!latestResult && (
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-white text-base">พร้อมทดลองสร้างชุดภาพสต็อกใหม่หรือไม่?</h3>
                  <p className="text-xs text-slate-400">
                    กดปุ่มเพื่อวางแผนแนวคิด ออกแบบ Prompt และสั่งสร้างภาพสต็อก {BATCH_SIZE} ภาพ พร้อมดาวน์โหลดไฟล์ ZIP + CSV ทันที
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void triggerManualRun()}
                  disabled={isRunning}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  {isRunning ? "กำลังสร้างชุดภาพ..." : `⚡ สั่งสร้างชุดภาพ ${BATCH_SIZE} ภาพทันที`}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "sale" && (
          <div id="tab-panel-sale" role="tabpanel" className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30">
              <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="p-6 sm:p-8">
                  <div className="mb-5 flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
                      <Trophy className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Confirmed sale signal</p>
                      <h2 className="mt-1 text-xl font-bold text-white">อัปโหลดภาพที่ขายได้ แล้วต่อยอดเป็น 10 แนวคิดใหม่</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                        ระบบจะอ่านหัวเรื่อง องค์ประกอบ และการใช้งานที่ผู้ซื้อน่าจะต้องการ แล้วเปลี่ยนฉาก มุมกล้อง เรื่องราว แสง และกลุ่มผู้ซื้อให้ต่างกันจริง โดยไม่คัดลอกภาพต้นฉบับ
                      </p>
                    </div>
                  </div>

                  <label htmlFor="sold-reference-upload" className="block text-sm font-semibold text-slate-100">ภาพ Capture จากอีเมลแจ้งยอดขาย</label>
                  <label htmlFor="sold-reference-upload" className="mt-2 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-600 bg-slate-950/60 px-6 py-8 text-center transition hover:border-amber-400/70 hover:bg-slate-950 focus-within:ring-2 focus-within:ring-amber-400">
                    <Upload className="mb-3 h-7 w-7 text-amber-300" aria-hidden="true" />
                    <span className="text-sm font-semibold text-white">คลิกเพื่อเลือกภาพ JPEG, PNG หรือ WebP</span>
                    <span className="mt-1 text-xs text-slate-400">ไฟล์ต้นฉบับไม่เกิน 20 MB · ระบบย่อก่อนส่งวิเคราะห์ · ไม่บันทึกภาพอ้างอิงลงคลัง</span>
                    <input
                      id="sold-reference-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setSaleReferenceFile(file);
                        setSaleReferenceAnalysis(null);
                        if (!file) {
                          setSaleReferencePreview("");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => setSaleReferencePreview(typeof reader.result === "string" ? reader.result : "");
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>

                  {saleReferenceFile && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{saleReferenceFile.name}</p>
                        <p className="text-xs text-slate-400">{(saleReferenceFile.size / 1_000_000).toFixed(2)} MB</p>
                      </div>
                      <button type="button" onClick={() => { setSaleReferenceFile(null); setSaleReferencePreview(""); setSaleReferenceAnalysis(null); }} disabled={isRunning} className="text-xs font-semibold text-slate-300 underline-offset-4 hover:text-white hover:underline disabled:opacity-50">
                        เอาภาพออก
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void triggerSaleReferenceRun()}
                    disabled={!saleReferenceFile || isRunning}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/15 transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                  >
                    {isRunning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                    {isRunning ? "กำลังวิเคราะห์หรือสร้างภาพ..." : "วิเคราะห์และสร้าง 10 ภาพใหม่"}
                  </button>
                  <p className="mt-3 text-xs leading-5 text-slate-400">
                    ขั้นวิเคราะห์ใช้ OpenRouter 1 ครั้ง และขั้นสร้างใช้เครดิตภาพสูงสุด 10 ภาพ รวม QA/ภาพทดแทนตามกฎเดิม การขายหนึ่งครั้งเป็นสัญญาณของภาพนี้เท่านั้น ไม่ใช่หลักฐานว่าทั้งหมวดมีความต้องการสูง
                  </p>
                </div>

                <div className="border-t border-slate-800 bg-slate-950/55 p-6 lg:border-l lg:border-t-0">
                  {saleReferencePreview ? (
                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                      <NextImage src={saleReferencePreview} alt="ภาพที่ขายได้ซึ่งเลือกไว้สำหรับวิเคราะห์" fill unoptimized className="object-contain" />
                    </div>
                  ) : (
                    <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-center">
                      <ImageIcon className="h-10 w-10 text-slate-700" aria-hidden="true" />
                      <p className="mt-3 text-sm text-slate-500">ภาพตัวอย่างจะแสดงตรงนี้</p>
                    </div>
                  )}
                  {saleReferenceAnalysis && (
                    <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-4" role="status">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">วิเคราะห์แล้ว</p>
                      <h3 className="mt-1 font-semibold text-white">{saleReferenceAnalysis.subject}</h3>
                      <p className="mt-2 text-xs leading-5 text-slate-300">{saleReferenceAnalysis.expansionStrategy}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["1", "อ่านภาพต้นทาง", "แยกตัวแบบ จุดแข็ง และการใช้งานของผู้ซื้อออกจาก UI และข้อความใน Capture"],
                ["2", "แตก 10 Buyer Stories", "แต่ละภาพเปลี่ยนกลุ่มผู้ซื้อ การใช้งาน ฉาก มุมกล้อง แสง และสี ไม่ใช่แค่เปลี่ยนพร็อพ"],
                ["3", "ตรวจแล้วส่งเข้าคลัง", "บังคับ JPEG ไม่มีข้อความ โลโก้ ลายน้ำ กรอบ หรือใบหน้าคน ก่อนบันทึกและส่งอีเมล"],
              ].map(([number, title, description]) => (
                <div key={number} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/15 text-xs font-bold text-sky-300">{number}</span>
                  <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated Images & Metadata */}
        {activeTab === "images" && (
          <div id="tab-panel-images" role="tabpanel" className="space-y-6">
            {loadingBatch && !latestResult ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
                <Loader2 className="w-10 h-10 text-sky-400 animate-spin mx-auto" />
                <h3 className="font-semibold text-white text-base">กำลังโหลดชุดภาพล่าสุดจากระบบ...</h3>
                <p className="text-xs text-slate-400">กรุณารอสักครู่ ระบบกำลังจัดเตรียมข้อมูลภาพและไฟล์ CSV</p>
              </div>
            ) : !latestResult ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
                <ImageIcon className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="font-semibold text-white text-base">ยังไม่มีชุดภาพที่สร้างในระบบ</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  กดปุ่มด้านล่างเพื่อเริ่มสร้างชุดภาพสต็อกประจำวันทันที หรือรอระบบอัตโนมัติทำงานเวลา 18:00 น.
                </p>
                <button
                  type="button"
                  onClick={() => void triggerManualRun()}
                  disabled={isRunning}
                  className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer"
                >
                  สร้างภาพสต็อกประจำวันทันที
                </button>
              </div>
            ) : (
              <>
                {/* Market Niche Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 rounded-2xl p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                      🎯 Concept Status: {latestResult.trend.buyerDemandRating}
                    </span>
                    <span className="text-xs text-slate-400">
                      Duration: {(latestResult.durationMs / 1000).toFixed(1)}s &bull; Email:{" "}
                      <span className={latestResult.emailDelivery.success ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                        {latestResult.emailDelivery.success
                          ? "Sent to hs5ckt@gmail.com"
                          : `Delivery Failed (${latestResult.emailDelivery.error || "Simulation"})`}
                      </span>
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">{latestResult.trend.theme}</h2>
                  <p className="text-sm text-slate-300 mb-3">{latestResult.trend.commercialReasoning}</p>
                  <p className="text-[11px] text-amber-300/90 mb-3">
                    หมายเหตุ: เป็นแนวคิดจากการวิเคราะห์เชิงกลยุทธ์ ไม่ใช่ข้อมูลยอดขายหรือจำนวนการค้นหาแบบเรียลไทม์
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 border-t border-slate-800 pt-3">
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <strong className="text-slate-300">Target Market:</strong> {latestResult.trend.targetMarket}
                      </div>
                      <div>
                        <strong className="text-slate-300">Seasonal Horizon:</strong> {latestResult.trend.seasonalRelevance}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={downloadAllImagesZip}
                        disabled={isZipping}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition shadow-md shadow-indigo-950/40 disabled:opacity-50"
                      >
                        {isZipping ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{zipProgress || "กำลังบีบอัดไฟล์ ZIP..."}</span>
                          </>
                        ) : (
                          <>
                            <FolderArchive className="w-4 h-4" />
                            <span>ดาวน์โหลดทั้ง {latestResult.images.length} ภาพ (ZIP + CSV)</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={downloadMetadataCsv}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition shadow-md shadow-emerald-950/40"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Download CSV Only</span>
                      </button>
                      <button
                        type="button"
                        onClick={deleteCurrentBatch}
                        disabled={isDeletingBatch || isZipping}
                        className="bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition shadow-md shadow-rose-950/40 disabled:opacity-50"
                      >
                        {isDeletingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        <span>{isDeletingBatch ? "กำลังลบภาพ..." : "ลบภาพทั้งหมด"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mode Indicator & Upscale Recommendation */}
                <div
                  className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs ${
                    currentConceptPlan?.enabled
                      ? "bg-violet-950/40 border-violet-800/80 text-violet-200"
                      : latestResult.generationMode === "transparent_png"
                      ? "bg-sky-950/40 border-sky-800/80 text-sky-200"
                      : "bg-emerald-950/40 border-emerald-800/80 text-emerald-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{currentConceptPlan?.enabled ? "🧵" : latestResult.generationMode === "transparent_png" ? "🔲" : "🏞️"}</span>
                    <div>
                      <strong className="block text-white text-sm font-bold">
                        {currentConceptPlan?.enabled
                          ? `${currentConceptPlan.structuredCount} Structured Assets (${currentConceptPlan.transparentPngCount} PNG + ${currentConceptPlan.regularSceneCount} JPEG)`
                          : latestResult.generationMode === "transparent_png"
                          ? `100% Transparent PNG Set (พื้นหลังโปร่งใสทั้งชุด ${latestResult.images.length} ภาพ)`
                          : `100% Regular Commercial Stock Set (ภาพทั่วไปมีฉากหลังทั้งชุด ${latestResult.images.length} ภาพ)`}
                      </strong>
                      <span className="text-slate-300">
                        {currentConceptPlan?.enabled
                          ? "ภาพ PNG ออกแบบเป็นสินทรัพย์ตัดพื้นหลังที่นำไปจัดวางต่อได้ ส่วน JPEG เป็นฉากเต็มขอบ ทุกภาพใช้ Structure 18 ช่องและห้ามสร้างตัวอักษรลงในภาพ"
                          : latestResult.generationMode === "transparent_png"
                          ? "💡 คำแนะนำการ Upscale: บันทึกไฟล์เป็น .PNG เท่านั้น เพื่อรักษาความโปร่งใส (Alpha Transparency) สำหรับส่งขายหมวด Isolated PNG"
                          : "💡 รูปภาพทั่วไปและงานศิลป์ใช้ชื่อไฟล์ .jpeg โดยองค์ประกอบภาพจะยึดตามหมวดประจำวัน"}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
                    {currentConceptPlan?.enabled ? "Structure: Buyer-Context Editorial Still Life" : `Mode: ${latestResult.generationMode || "regular_scene"}`}
                  </span>
                </div>

                {/* Generated Cards */}
                <div className="space-y-6">
                  {latestResult.images.map((img: StockImageItem) => (
                    <div
                      key={img.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition"
                    >
                      {/* Card Header */}
                      <div className="bg-slate-950/70 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="bg-blue-600/30 text-blue-300 text-xs px-2.5 py-1 rounded-lg font-bold border border-blue-500/40">
                            Image #{img.id}
                          </span>
                          <span className="text-xs text-slate-400">
                            Ratio: <strong className="text-slate-200">{img.aspectRatio}</strong>
                          </span>
                          <span className="text-xs text-slate-400">
                            Category: <strong className="text-slate-200">{img.category}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getItemGenerationMode(img, latestResult.generationMode) === "transparent_png" && (
                            <span className="text-xs font-mono text-cyan-300 bg-cyan-950/70 px-2.5 py-0.5 rounded border border-cyan-800/50 flex items-center gap-1 font-semibold">
                              🔲 Transparent PNG
                            </span>
                          )}
                          {img.conceptMode === "structured_concept" && (
                            <span className="text-xs font-mono text-violet-300 bg-violet-950/70 px-2.5 py-0.5 rounded border border-violet-800/50 flex items-center gap-1 font-semibold">
                              🧵 Structured Still Life
                            </span>
                          )}
                          <span className="text-xs font-mono text-sky-400 bg-sky-950/50 px-2 py-0.5 rounded border border-sky-800/40">
                            {img.modelUsed}
                          </span>
                        </div>
                      </div>

                      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Image Preview */}
                        <div className="lg:col-span-4 flex flex-col justify-center space-y-3">
                          {img.imageUrl ? (
                            <>
                              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner group relative">
                                <NextImage
                                  src={img.imageUrl}
                                  alt={img.seoTitle}
                                  width={640}
                                  height={480}
                                  unoptimized
                                  className="w-full h-auto object-cover max-h-64"
                                />
                              </div>
                              {img.qualityReview?.status === "passed_after_retries" && (
                                <div className="rounded-xl border border-emerald-800/70 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200 leading-relaxed">
                                  ผ่าน QA หลังสร้างภาพทดแทน {img.qualityReview.rejectionCount} ครั้ง
                                </div>
                              )}
                              {img.qualityReview?.status === "accepted_after_retry_limit" && (
                                <div role="alert" className="rounded-xl border border-amber-700/80 bg-amber-950/40 px-3 py-2 text-xs text-amber-100 leading-relaxed">
                                  <strong className="block text-amber-300 mb-1">ส่งภาพล่าสุดหลังลองทดแทนครบ 3 ครั้ง</strong>
                                  <span>เหตุผลที่ QA ปฏิเสธ: {img.qualityReview.rejectionReasons.join("; ")}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="w-full min-h-48 bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center text-xs px-4 gap-2">
                              <AlertCircle className="w-5 h-5 text-amber-400" />
                              <span className="text-slate-400">ไม่มีภาพที่ผ่านการตรวจคุณภาพ</span>
                              {img.description && <span className="text-amber-300 leading-relaxed">{img.description}</span>}
                            </div>
                          )}

                          {img.imageUrl && (
                            <button
                              type="button"
                              onClick={() => downloadSingleImage(img)}
                              className="w-full bg-slate-800/90 hover:bg-slate-700 text-sky-300 hover:text-white text-xs font-semibold py-2 px-3 rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition shadow-sm"
                            >
                              <ArrowDownToLine className="w-3.5 h-3.5" />
                              <span>บันทึกภาพเดี่ยว (Download)</span>
                            </button>
                          )}
                        </div>

                        {/* Metadata Details */}
                        <div className="lg:col-span-8 space-y-4">
                          {/* Unique Filename */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                📁 Unique Filename (ชื่อไฟล์รูปภาพ)
                              </span>
                              <button
                                type="button"
                                onClick={() => void copyToClipboard(getStockImageFilename(img, latestResult.generationMode), `filename-${img.id}`)}
                                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                              >
                                {copiedKey === `filename-${img.id}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Filename</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="text-xs font-mono font-medium text-emerald-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800 break-all select-all">
                              {getStockImageFilename(img, latestResult.generationMode)}
                            </div>
                          </div>

                          {/* SEO Title */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Adobe Stock SEO Title
                              </span>
                              <button
                                type="button"
                                onClick={() => void copyToClipboard(img.seoTitle, `title-${img.id}`)}
                                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                              >
                                {copiedKey === `title-${img.id}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Title</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="text-sm font-semibold text-white bg-slate-950 p-3 rounded-xl border border-slate-800">
                              {img.seoTitle}
                            </div>
                          </div>

                          {img.commercialIntent && (
                            <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-3">
                              <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-3">
                                Buyer Fit · ใครใช้ภาพนี้ และทำไมจึงควรซื้อ
                              </div>
                              <dl className="grid grid-cols-1 gap-2">
                                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                                  <dt className="text-[10px] font-semibold text-amber-300 uppercase">Target buyer</dt>
                                  <dd className="mt-1 text-xs text-slate-300 leading-relaxed">{img.commercialIntent.targetBuyer}</dd>
                                </div>
                                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                                  <dt className="text-[10px] font-semibold text-amber-300 uppercase">Intended use</dt>
                                  <dd className="mt-1 text-xs text-slate-300 leading-relaxed">{img.commercialIntent.intendedUse}</dd>
                                </div>
                                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                                  <dt className="text-[10px] font-semibold text-amber-300 uppercase">Why license this image</dt>
                                  <dd className="mt-1 text-xs text-slate-300 leading-relaxed">{img.commercialIntent.purchaseReason}</dd>
                                </div>
                              </dl>
                            </div>
                          )}

                          {/* Prompt */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Generation Prompt
                              </span>
                              <button
                                type="button"
                                onClick={() => void copyToClipboard(img.prompt, `prompt-${img.id}`)}
                                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                              >
                                {copiedKey === `prompt-${img.id}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Prompt</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono leading-relaxed">
                              {img.prompt}
                            </div>
                          </div>

                          {img.culinaryEditorialStructure && (
                            <details className="rounded-xl border border-orange-900/60 bg-orange-950/20 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-orange-300">USER_INPUT · Culinary Editorial · 11 Fields</summary>
                              <dl className="mt-3 space-y-2">
                                {Object.entries(img.culinaryEditorialStructure).map(([field, value]) => (
                                  <div key={field}>
                                    <dt className="text-xs text-orange-300">{field}</dt>
                                    <dd className="text-xs text-slate-300">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                          {img.beverageCampaignStructure && (
                            <details className="rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-cyan-300">USER_INPUT · Beverage Campaign · 9 Fields</summary>
                              <dl className="mt-3 space-y-2">
                                {Object.entries(img.beverageCampaignStructure).map(([field, value]) => (
                                  <div key={field}>
                                    <dt className="text-xs text-cyan-300">{field}</dt>
                                    <dd className="text-xs text-slate-300">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                          {img.dualMaterialStructure && (
                            <details className="rounded-xl border border-rose-900/60 bg-rose-950/20 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-rose-300">USER_INPUT · Dual Material · 6 Fields</summary>
                              <dl className="mt-3 space-y-2">
                                {Object.entries(img.dualMaterialStructure).map(([field, value]) => (
                                  <div key={field}>
                                    <dt className="text-xs text-rose-300">{field}</dt>
                                    <dd className="text-xs text-slate-300">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                          {img.materialArtStructure && (
                            <details className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-amber-300">USER_INPUT · Editorial Still Life / Material Art · 18 Fields</summary>
                              <dl className="mt-3 space-y-2">
                                {Object.entries(img.materialArtStructure).map(([field, value]) => (
                                  <div key={field}>
                                    <dt className="text-xs text-amber-300">{field}</dt>
                                    <dd className="text-xs text-slate-300">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                          {img.masterplanStructure && (
                            <details className="rounded-xl border border-sky-900/60 bg-sky-950/20 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-sky-300">ประวัติเก่า · Architectural Masterplan ที่ยกเลิกแล้ว · 8 Fields</summary>
                              <dl className="mt-3 space-y-2">
                                {Object.entries(img.masterplanStructure).map(([field, value]) => (
                                  <div key={field}>
                                    <dt className="text-xs text-sky-300">{field}</dt>
                                    <dd className="text-xs text-slate-300">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                          {img.aerialLandscapeStructure && (
                            <details className="rounded-xl border border-teal-900/60 bg-teal-950/20 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-teal-300">USER_INPUT · Aerial Landscape · 8 Fields</summary>
                              <dl className="mt-3 space-y-2">
                                {Object.entries(img.aerialLandscapeStructure).map(([field, value]) => (
                                  <div key={field}>
                                    <dt className="text-xs text-teal-300">{field}</dt>
                                    <dd className="text-xs text-slate-300">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                          {img.thaiNaturePosterStructure && (
                            <details className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-emerald-300">USER_INPUT · Thai Nature Poster · 8 Fields</summary>
                              <dl className="mt-3 space-y-2">
                                {Object.entries(img.thaiNaturePosterStructure).map(([field, value]) => (
                                  <div key={field}>
                                    <dt className="text-xs text-emerald-300">{field}</dt>
                                    <dd className="text-xs text-slate-300">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                          {img.editorialPenSketchStructure && (
                            <details className="rounded-xl border border-orange-900/60 bg-orange-950/20 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-orange-300">USER_INPUT · Editorial Pen Sketch · 10 Fields</summary>
                              <dl className="mt-3 space-y-2">
                                {Object.entries(img.editorialPenSketchStructure).map(([field, value]) => (
                                  <div key={field}>
                                    <dt className="text-xs text-orange-300">{field}</dt>
                                    <dd className="text-xs text-slate-300">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                          {img.symmetricalStorefrontStructure && (
                            <details className="rounded-xl border border-pink-900/60 bg-pink-950/20 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-pink-300">USER_INPUT · Symmetrical Minimal Storefront · 8 Fields</summary>
                              <dl className="mt-3 space-y-2">
                                {Object.entries(img.symmetricalStorefrontStructure).map(([field, value]) => (
                                  <div key={field}>
                                    <dt className="text-xs text-pink-300">{field}</dt>
                                    <dd className="text-xs text-slate-300">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                          {img.boothStructure && (
                            <details className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-emerald-300">USER_INPUT · Exhibition Booth · 17 Fields</summary>
                              <dl className="mt-3 space-y-2">
                                {Object.entries(img.boothStructure).map(([field, value]) => (
                                  <div key={field}>
                                    <dt className="text-xs text-emerald-300">{field}</dt>
                                    <dd className="text-xs text-slate-300">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                          {img.fusionStructure && (
                            <details className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-violet-300">USER_INPUT · Food Hardware Fusion · 7 Fields</summary>
                              <dl className="mt-3 space-y-2">
                                {Object.entries(img.fusionStructure).map(([field, value]) => (
                                  <div key={field}>
                                    <dt className="text-xs text-violet-300">{field}</dt>
                                    <dd className="text-xs text-slate-300">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                          {img.conceptStructure && (
                            <details className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-violet-300 uppercase tracking-wider">
                                USER_INPUT Structure · 18 Fields
                              </summary>
                              <dl className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {Object.entries(img.conceptStructure.fields).map(([field, value]) => (
                                  <div key={field} className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                                    <dt className="text-[10px] font-semibold text-violet-300 break-all">{field}</dt>
                                    <dd className="mt-1 text-xs text-slate-300 leading-relaxed">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}

                          {/* Keywords */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Adobe Stock Optimized Keywords ({img.keywords.length} tags &bull; Top 10 Prioritized)
                              </span>
                              <button
                                type="button"
                                onClick={() => void copyToClipboard(img.keywords.join(", "), `kw-${img.id}`)}
                                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                              >
                                {copiedKey === `kw-${img.id}` ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>Copied All Tags!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy All Keywords</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 leading-relaxed max-h-24 overflow-y-auto">
                              {img.keywords.join(", ")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Setup & Environment Variables */}
        {activeTab === "setup" && (
          <div id="tab-panel-setup" role="tabpanel" className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-base font-bold text-white mb-4">Vercel &amp; Environment Variables Configuration</h2>
              <p className="text-xs text-slate-400 mb-6">
                ตั้งค่าตัวแปรเหล่านี้ใน <strong>Vercel Project Settings &gt; Environment Variables</strong> เพื่อให้ระบบทำงานเต็มรูปแบบ
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-sky-400">OPENROUTER_API_KEY</span>
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Required
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    API Key จาก OpenRouter สำหรับเรียก AI Market Research, สร้าง Prompt, เลือกใช้ Model สร้างภาพ และตรวจสอบยอดเครดิต
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-sky-400">SMTP2GO_API_KEY</span>
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Required
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    API Key จาก SMTP2GO สำหรับยิงส่งอีเมลรายงานและไฟล์ภาพแนบ
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-sky-400">SENDER_EMAIL</span>
                    <span className="text-xs text-slate-500">Optional</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    อีเมลผู้ส่งที่ Verify กับทาง SMTP2GO แล้ว (เช่น stock-alerts@yourdomain.com)
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-sky-400">RECIPIENT_EMAIL</span>
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Default: hs5ckt@gmail.com
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    อีเมลปลายทางที่จะรับรายงานภาพและ Keywords ประจำวัน
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-sky-400">CRON_SECRET</span>
                    <span className="text-xs text-slate-500">Recommended</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Token สุ่มสำหรับป้องกันคนภายนอกยิงเรียก Endpoint <code>/api/cron/daily-stock</code> โดยตรง
                  </p>
                </div>
              </div>

              {/* Interactive Email Diagnostic Card */}
              <div className="mt-6 p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-sky-400" />
                      ทดสอบการส่งอีเมลผ่าน SMTP2GO (Live Diagnostic Tool)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      กดปุ่มนี้เพื่อยิงส่งอีเมลทดสอบไปยัง <strong>hs5ckt@gmail.com</strong> และตรวจสอบ Error ที่ SMTP2GO ตอบกลับมาแบบเรียลไทม์
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestEmail}
                    disabled={testingEmail}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-md shadow-sky-600/20 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {testingEmail ? "Sending Test..." : "Send Test Email"}
                  </button>
                </div>

                {testEmailResult && (
                  <div
                    className={`p-4 rounded-xl text-xs font-mono border ${
                      testEmailResult.success
                        ? "bg-emerald-950/40 border-emerald-800 text-emerald-200"
                        : "bg-rose-950/40 border-rose-800 text-rose-200"
                    }`}
                  >
                    <div className="font-bold mb-2 flex items-center gap-2">
                      {testEmailResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>✅ ส่งอีเมลสำเร็จ (Email Sent Successfully)!</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                          <span>❌ ส่งไม่สำเร็จ (Delivery Failed)</span>
                        </>
                      )}
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-[11px] overflow-x-auto bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      {JSON.stringify(testEmailResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>Adobe Stock AI Production System &bull; GitHub: diowcnx/adobe_stock &bull; Vercel: diowcnx/adobe_stock</p>
      </footer>
    </div>
  );
}
