"use client";

import React, { useState, useEffect } from "react";
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
  Download,
  FileSpreadsheet,
  FolderArchive,
  ArrowDownToLine,
  Loader2
} from "lucide-react";
import JSZip from "jszip";
import { WorkflowResult, OpenRouterCreditInfo, StockImageItem } from "@/lib/types";
import { generateMetadataCsv } from "@/lib/csv";

export default function Dashboard() {
  const [credits, setCredits] = useState<OpenRouterCreditInfo | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [latestResult, setLatestResult] = useState<WorkflowResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "images" | "setup">("overview");
  const [selectedMode, setSelectedMode] = useState<"auto" | "transparent_png" | "regular_scene">("auto");
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<any>(null);

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch("/api/test-email");
      const json = await res.json();
      setTestEmailResult(json);
      if (json.success) {
        alert("✅ ส่งอีเมลทดสอบไปยัง " + (json.recipientEmail || "hs5ckt@gmail.com") + " สำเร็จเรียบร้อยแล้ว! โปรดตรวจสอบใน Inbox หรือ Spam");
      } else {
        const errorDetail = json.error || json.smtpResponse?.errors?.join(", ") || json.smtpResponse?.data?.failures?.join(", ") || `HTTP ${json.httpStatus || 500}`;
        alert("❌ ส่งอีเมลไม่สำเร็จ:\n" + errorDetail + "\n\nคำแนะนำ: ตรวจสอบ SMTP2GO_API_KEY หรือตั้งค่า SENDER_EMAIL ให้ตรงกับ Verified Senders ในบัญชี SMTP2GO");
      }
    } catch (e: any) {
      alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ: " + (e.message || String(e)));
    } finally {
      setTestingEmail(false);
    }
  };

  const todayScheduledMode =
    typeof window !== "undefined"
      ? Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000) % 2 === 0
        ? "transparent_png"
        : "regular_scene"
      : "transparent_png";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (e) {
      window.location.href = "/login";
    }
  };

  // ดึงเครดิต OpenRouter เมื่อโหลดหน้าเว็บ
  const fetchCredits = async () => {
    setLoadingCredits(true);
    try {
      const res = await fetch("/api/credits");
      const json = await res.json();
      if (json.success && json.data) {
        setCredits(json.data);
      }
    } catch (e) {
      console.error("Failed to load credits:", e);
    } finally {
      setLoadingCredits(false);
    }
  };

  const [loadingBatch, setLoadingBatch] = useState(false);

  // ดึงชุดภาพล่าสุดอัตโนมัติ (จาก URL Query หรือจาก Cache บนเซิร์ฟเวอร์)
  const fetchLatestBatch = async () => {
    setLoadingBatch(true);
    try {
      let queryParam = "";
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const batch = urlParams.get("batch");
        if (batch) {
          queryParam = `?batch=${encodeURIComponent(batch)}`;
        }
      }

      const res = await fetch(`/api/latest-batch${queryParam}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.images && data.images.length > 0) {
          setLatestResult(data);
          setActiveTab("images");
        }
      }
    } catch (e) {
      console.warn("Could not load latest batch:", e);
    } finally {
      setLoadingBatch(false);
    }
  };

  useEffect(() => {
    fetchCredits();
    fetchLatestBatch();
  }, []);

  // กดเริ่มกระบวนการทันที
  const triggerManualRun = async () => {
    setIsRunning(true);
    try {
      const res = await fetch("/api/manual-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode }),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server status ${res.status}: ${text.slice(0, 200)}`);
      }

      if (!res.ok || data.error) {
        throw new Error(data.error || `Server responded with status ${res.status}`);
      }

      setLatestResult(data);
      if (data.credits) {
        setCredits(data.credits);
      }
      setActiveTab("images");
    } catch (err: any) {
      console.error("Run error:", err);
      alert("Failed to execute generation: " + (err.message || String(err)));
    } finally {
      setIsRunning(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadMetadataCsv = () => {
    if (!latestResult || !latestResult.images || latestResult.images.length === 0) return;
    const csvContent = generateMetadataCsv(latestResult.images);
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
  };

  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<string>("");

  const downloadAllImagesZip = async () => {
    if (!latestResult || !latestResult.images || latestResult.images.length === 0) return;
    setIsZipping(true);
    setZipProgress("กำลังเริ่มเตรียมแพ็กเกจ ZIP...");
    try {
      const zip = new JSZip();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

      // 1. แนบไฟล์ CSV เข้าไปใน ZIP เพื่อความสะดวกในการใช้งานทันที
      const csvContent = generateMetadataCsv(latestResult.images);
      zip.file(`adobe_stock_metadata_${dateStr}.csv`, csvContent);

      // 2. ดึงภาพทั้ง 20 ภาพ
      let count = 0;
      for (const img of latestResult.images) {
        if (img.imageUrl) {
          count++;
          setZipProgress(`กำลังโหลดภาพที่ ${count}/${latestResult.images.length}...`);
          try {
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
              const filename = img.filename || `stock_image_${img.id}.png`;
              zip.file(filename, blob);
            }
          } catch (fetchErr) {
            console.warn(`Could not add image #${img.id} to zip:`, fetchErr);
          }
        }
      }

      setZipProgress("กำลังสร้างและบีบอัดไฟล์ ZIP ทั้งหมด...");
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      const modeSlug = latestResult.generationMode || "stock";
      link.download = `adobe_stock_batch_${modeSlug}_${dateStr}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("ZIP creation error:", err);
      alert("ไม่สามารถสร้างไฟล์ ZIP ได้: " + (err.message || String(err)));
    } finally {
      setIsZipping(false);
      setZipProgress("");
    }
  };

  const downloadSingleImage = async (img: StockImageItem) => {
    if (!img.imageUrl) return;
    try {
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
        link.download = img.filename || `stock_image_${img.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        window.open(img.imageUrl, "_blank");
      }
    } catch (e) {
      window.open(img.imageUrl, "_blank");
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
              <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
                Adobe Stock AI Producer
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">
                  Daily 18:00 ICT
                </span>
              </h1>
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
                onClick={fetchCredits}
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
              onChange={(e) => setSelectedMode(e.target.value as any)}
              className="bg-slate-800/90 border border-slate-700/80 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 font-medium"
              title="เลือกโหมดการสร้างภาพ (สลับวันต่อวันอัตโนมัติ หรือบังคับโหมดใดโหมดหนึ่ง)"
            >
              <option value="auto">
                🔄 Auto: {todayScheduledMode === "transparent_png" ? "🔲 วันนี้โหมด Transparent PNG" : "🏞️ วันนี้โหมด Regular Scene"}
              </option>
              <option value="transparent_png">🔲 Force Transparent PNG Set (พื้นหลังโปร่งใส 100%)</option>
              <option value="regular_scene">🏞️ Force Regular Stock Set (มีฉากหลังปกติ 100%)</option>
            </select>

            {/* Run Button */}
            <button
              onClick={triggerManualRun}
              disabled={isRunning}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-xl text-xs transition shadow-md shadow-indigo-600/20 active:scale-95"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Researching &amp; Generating...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Generate Batch Now</span>
                </>
              )}
            </button>

            {/* Logout Button */}
            <button
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

        {/* Hero Download Banner: เด่นชัด 100% เห็นทันทีที่เปิดหน้าเว็บ */}
        {latestResult && latestResult.images && latestResult.images.length > 0 && (
          <div className="bg-gradient-to-r from-blue-950/90 via-indigo-950/90 to-slate-900 border-2 border-sky-500/80 rounded-2xl p-5 mb-6 shadow-2xl shadow-sky-500/15 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-400/30 shadow-inner">
                <FolderArchive className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-base text-white">
                    🎉 ภาพชุดล่าสุดพร้อมดาวน์โหลดแล้ว ({latestResult.images.length} ภาพ)
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                    {latestResult.generationMode === "transparent_png" ? "🔲 PNG โปร่งใส (Alpha Cutout)" : "🏞️ ฉากทั่วไป (Copy Space)"}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  ไฟล์ภาพทั้งหมดพร้อมชื่อไฟล์เฉพาะตัวและไฟล์ CSV จัดเตรียมเรียบร้อยแล้ว กดปุ่มสีฟ้านี้เพื่อดาวน์โหลดทันที
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
              <button
                onClick={downloadAllImagesZip}
                disabled={isZipping}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 flex-1 md:flex-initial cursor-pointer"
              >
                {isZipping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{zipProgress || "กำลังบีบอัด ZIP..."}</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="w-4 h-4" />
                    <span>ดาวน์โหลดทั้ง 20 ภาพ (ZIP + CSV)</span>
                  </>
                )}
              </button>
              <button
                onClick={downloadMetadataCsv}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold px-4 py-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 space-x-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-sm font-medium transition relative ${
              activeTab === "overview"
                ? "text-sky-400 border-b-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            System Status &amp; Daily Schedule
          </button>
          <button
            onClick={() => setActiveTab("images")}
            className={`pb-3 text-sm font-medium transition relative ${
              activeTab === "images"
                ? "text-sky-400 border-b-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Generated Batches ({latestResult ? latestResult.images.length : 0})
          </button>
          <button
            onClick={() => setActiveTab("setup")}
            className={`pb-3 text-sm font-medium transition relative ${
              activeTab === "setup"
                ? "text-sky-400 border-b-2 border-sky-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Environment &amp; Setup Guide
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
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
                <div className="text-xl font-bold text-white">20 Images / Day</div>
                <p className="text-xs text-slate-500 mt-1">100% Homogeneous Set</p>
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
                  <span className="text-xs font-medium text-slate-400">Today's Mode</span>
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-sm font-bold text-cyan-300 truncate">
                  {todayScheduledMode === "transparent_png" ? "🔲 Transparent PNG" : "🏞️ Regular Scene"}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {todayScheduledMode === "transparent_png" ? "Save as .PNG" : "Save as .JPG/.PNG"}
                </p>
              </div>
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
                  <p className="text-slate-400">Scans seasonal cycles &amp; proven winner niches (Cloud, Mockup, Metaphor, Food, Telecom).</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center">2</div>
                  <div className="font-semibold text-white">20 Stock Prompts</div>
                  <p className="text-slate-400">Creates 20 diverse items with commercial copy space across 5 high-converting niches.</p>
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
                  <h3 className="font-bold text-white text-base">Ready to test today's stock batch?</h3>
                  <p className="text-xs text-slate-400">
                    Click the button to test market research, prompt crafting, and email delivery right now.
                  </p>
                </div>
                <button
                  onClick={triggerManualRun}
                  disabled={isRunning}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap shadow-lg shadow-indigo-600/30"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isRunning ? "Running Batch..." : "Trigger Test Run Now"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Generated Images & Metadata */}
        {activeTab === "images" && (
          <div className="space-y-6">
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
                      🎯 Winning Niche: {latestResult.trend.buyerDemandRating} Demand
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
                  <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 border-t border-slate-800 pt-3">
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <strong className="text-slate-300">Target Market:</strong> {latestResult.trend.targetMarket}
                      </div>
                      <div>
                        <strong className="text-slate-300">Seasonal Horizon:</strong> {latestResult.trend.seasonalRelevance}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
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
                            <span>ดาวน์โหลดทั้ง 20 ภาพ (ZIP + CSV)</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={downloadMetadataCsv}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition shadow-md shadow-emerald-950/40"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Download CSV Only</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Email Delivery Warning Banner if failed */}
                {!latestResult.emailDelivery.success && (
                  <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/80 text-amber-200 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <strong className="block text-amber-300 text-sm font-bold">
                          ⚠️ อีเมลยังไม่ถูกส่งไปยัง hs5ckt@gmail.com
                        </strong>
                        <span className="text-slate-300">
                          สาเหตุ: {latestResult.emailDelivery.error || "ไม่ได้ตั้งค่า SMTP2GO_API_KEY หรือ SENDER_EMAIL ไม่ได้รับการ Verify ในระบบ SMTP2GO"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleTestEmail}
                      disabled={testingEmail}
                      className="shrink-0 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {testingEmail ? "Testing..." : "ทดสอบส่ง Email ทันที"}
                    </button>
                  </div>
                )}

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
                          ? "100% Transparent PNG Set (พื้นหลังโปร่งใสทั้งชุด 20 ภาพ)"
                          : "100% Regular Commercial Stock Set (ภาพทั่วไปมีฉากหลังทั้งชุด 20 ภาพ)"}
                      </strong>
                      <span className="text-slate-300">
                        {latestResult.generationMode === "transparent_png"
                          ? "💡 คำแนะนำการ Upscale: บันทึกไฟล์เป็น .PNG เท่านั้น เพื่อรักษาความโปร่งใส (Alpha Transparency) สำหรับส่งขายหมวด Isolated PNG"
                          : "💡 คำแนะนำการ Upscale: สามารถเลือกบันทึกเป็น .JPG หรือ .PNG ได้ตามสะดวก ทุกภาพมี Negative Copy Space พร้อมใช้งาน"}
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
                              <img
                                src={img.imageUrl}
                                alt={img.seoTitle}
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
                                onClick={() => copyToClipboard(img.filename || `stock_${img.id}.png`, `filename-${img.id}`)}
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
                              {img.filename || `stock_${img.id}.png`}
                            </div>
                          </div>

                          {/* SEO Title */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Adobe Stock SEO Title
                              </span>
                              <button
                                onClick={() => copyToClipboard(img.seoTitle, `title-${img.id}`)}
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
                                onClick={() => copyToClipboard(img.prompt, `prompt-${img.id}`)}
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
                                onClick={() => copyToClipboard(img.keywords.join(", "), `kw-${img.id}`)}
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
          <div className="space-y-6">
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
