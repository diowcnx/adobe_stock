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
  Trash2
} from "lucide-react";
import JSZip from "jszip";
import { WorkflowResult, OpenRouterCreditInfo, StockImageItem } from "@/lib/types";
import { generateMetadataCsv, getStockImageFilename } from "@/lib/csv";
import { getErrorMessage, isRecord } from "@/lib/errors";
import { BATCH_SIZE, getDailyCategory, getDailyScheduledMode, WEEKLY_CATEGORIES } from "@/lib/production-plan";
import { isWorkflowResult } from "@/lib/validation";

type GenerationModeSelection = "auto" | "transparent_png" | "regular_scene";
type DashboardTab = "overview" | "images" | "setup";

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
  const [selectedMode, setSelectedMode] = useState<GenerationModeSelection>("auto");
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<TestEmailResult | null>(null);
  const [notice, setNotice] = useState<UiNotice | null>(null);

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

  const todayScheduledMode = getDailyScheduledMode();
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
        if (requestedTab === "overview" || requestedTab === "images" || requestedTab === "setup") {
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
  const triggerManualRun = async () => {
    setIsRunning(true);
    setRunProgress(`กำลังวางแผนแนวคิดและเตรียม ${BATCH_SIZE} ภาพ...`);
    try {
      // 1. เรียกวางแผน Prompts และวิจัยตลาด (รวดเร็วเพียง 1-2 วินาที)
      const prepRes = await fetch("/api/prepare-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode }),
      });
      const prepData = await prepRes.json();
      if (!prepRes.ok || !prepData.success) {
        throw new Error(prepData.error || "ไม่สามารถเตรียมชุดภาพได้");
      }

      if (prepData.credits) {
        setCredits(prepData.credits);
      }

      const initialBatch: WorkflowResult = {
        success: true,
        timestamp: new Date().toISOString(),
        generationMode: prepData.mode,
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
            if (genRes.ok) {
              const genData = await genRes.json();
              if (genData.imageUrl) {
                const targetIdx = updatedImages.findIndex((x) => x.id === item.id);
                if (targetIdx !== -1) {
                  updatedImages[targetIdx] = {
                    ...updatedImages[targetIdx],
                    imageUrl: genData.imageUrl,
                  };
                  setLatestResult((prev) => prev ? { ...prev, images: [...updatedImages] } : prev);
                }
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
      if (persistenceReady) {
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

            {/* Generation Mode Selector */}
            <select
              value={selectedMode}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "auto" || value === "transparent_png" || value === "regular_scene") {
                  setSelectedMode(value);
                }
              }}
              className="bg-slate-800/90 border border-slate-700/80 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 font-medium"
              title="เลือกโหมดตามหมวดประจำวันอัตโนมัติ หรือบังคับโหมดใดโหมดหนึ่ง"
            >
              <option value="auto">
                🔄 Auto: {todayScheduledMode === "transparent_png" ? "🔲 วันนี้โหมด Transparent PNG" : "🏞️ วันนี้โหมด Regular Scene"}
              </option>
              <option value="transparent_png">🔲 Force Transparent PNG Set (พื้นหลังโปร่งใส 100%)</option>
              <option value="regular_scene">🏞️ Force Regular Stock Set (มีฉากหลังปกติ 100%)</option>
            </select>

            {/* Run Button */}
            <button
              type="button"
              onClick={triggerManualRun}
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
                    {idx === 0 ? "🌟 [ล่าสุด] " : ""}{b.dateStr} &bull; {b.mode === "transparent_png" ? "🔲 PNG" : "🏞️ ฉาก"} ({b.imageCount} ภาพ)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div id="tab-panel-overview" role="tabpanel" className="space-y-6">
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
                <p className="text-xs text-slate-500 mt-1">7 different categories by weekday</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">SEO Keywords</span>
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-white">25 - 35 Tags</div>
                <p className="text-xs text-slate-500 mt-1">Single words &amp; Top 10</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Today&apos;s Mode</span>
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-sm font-bold text-cyan-300 truncate">
                  {todayCategory.name} · {todayScheduledMode === "transparent_png" ? "🔲 PNG" : "🏞️ JPEG"}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {todayScheduledMode === "transparent_png" ? "Filename: .png" : "Filename: .jpeg"}
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-3">Weekly buyer-use categories · 10 images per day</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {WEEKLY_CATEGORIES.map((category) => (
                  <div key={category.day} className={`rounded-xl border p-3 ${category.name === todayCategory.name ? "border-sky-500/60 bg-sky-950/40" : "border-slate-800 bg-slate-950/50"}`}>
                    <div className="text-[11px] text-slate-500">{category.day}</div>
                    <div className="text-xs font-semibold text-slate-200 mt-1">{category.name}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{category.mode === "transparent_png" ? "PNG assets" : "JPEG scene/art"}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-3">Category ideas use public creative and search trends as directional signals; they are not verified sales or competition rankings.</p>
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
                  <p className="text-slate-400">Uses the weekly category plan and seasonal context without claiming live marketplace demand.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center">2</div>
                  <div className="font-semibold text-white">{BATCH_SIZE} Stock Prompts</div>
                  <p className="text-slate-400">Creates {BATCH_SIZE} focused items across 7 rotating categories, reducing image-generation calls per batch.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 font-bold flex items-center justify-center">3</div>
                  <div className="font-semibold text-white">Image Generation</div>
                  <p className="text-slate-400">Generates photorealistic images using Recraft V4.1 &amp; Gemini Flash via OpenRouter.</p>
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
                  onClick={triggerManualRun}
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

        {/* Tab 2: Generated Images & Metadata */}
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
                  onClick={triggerManualRun}
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
                    latestResult.generationMode === "transparent_png"
                      ? "bg-sky-950/40 border-sky-800/80 text-sky-200"
                      : "bg-emerald-950/40 border-emerald-800/80 text-emerald-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{latestResult.generationMode === "transparent_png" ? "🔲" : "🏞️"}</span>
                    <div>
                      <strong className="block text-white text-sm font-bold">
                        {latestResult.generationMode === "transparent_png"
                          ? `100% Transparent PNG Set (พื้นหลังโปร่งใสทั้งชุด ${latestResult.images.length} ภาพ)`
                          : `100% Regular Commercial Stock Set (ภาพทั่วไปมีฉากหลังทั้งชุด ${latestResult.images.length} ภาพ)`}
                      </strong>
                      <span className="text-slate-300">
                        {latestResult.generationMode === "transparent_png"
                          ? "💡 คำแนะนำการ Upscale: บันทึกไฟล์เป็น .PNG เท่านั้น เพื่อรักษาความโปร่งใส (Alpha Transparency) สำหรับส่งขายหมวด Isolated PNG"
                          : "💡 รูปภาพทั่วไปและงานศิลป์ใช้ชื่อไฟล์ .jpeg โดยองค์ประกอบภาพจะยึดตามหมวดประจำวัน"}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
                    Mode: {latestResult.generationMode === "transparent_png" ? "transparent_png" : "regular_scene"}
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
                          {(img.isTransparent || latestResult.generationMode === "transparent_png") && (
                            <span className="text-xs font-mono text-cyan-300 bg-cyan-950/70 px-2.5 py-0.5 rounded border border-cyan-800/50 flex items-center gap-1 font-semibold">
                              🔲 Transparent PNG
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
                          ) : (
                            <div className="w-full h-48 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center text-slate-500 text-xs">
                              Preview generated
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
