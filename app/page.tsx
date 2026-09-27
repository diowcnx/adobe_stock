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
  AlertCircle
} from "lucide-react";
import { WorkflowResult, OpenRouterCreditInfo, StockImageItem } from "@/lib/types";

export default function Dashboard() {
  const [credits, setCredits] = useState<OpenRouterCreditInfo | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [latestResult, setLatestResult] = useState<WorkflowResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "images" | "setup">("overview");

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

  useEffect(() => {
    fetchCredits();
  }, []);

  // กดเริ่มกระบวนการทันที
  const triggerManualRun = async () => {
    setIsRunning(true);
    try {
      const res = await fetch("/api/manual-trigger", { method: "POST" });
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
                  <span>Run Today's Batch Now</span>
                </>
              )}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Scheduled Trigger</span>
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white">18:00 ICT</div>
                <p className="text-xs text-slate-500 mt-1">Every day (11:00 UTC Cron)</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Target Email</span>
                  <Mail className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-base font-bold text-white truncate">hs5ckt@gmail.com</div>
                <p className="text-xs text-slate-500 mt-1">SMTP2GO API Dispatcher</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">Daily Production</span>
                  <ImageIcon className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white">5 Images / Day</div>
                <p className="text-xs text-slate-500 mt-1">16:9, 3:2, 4:5, 1:1 Stock Ratios</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">SEO Keywords</span>
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white">40 - 50 Tags</div>
                <p className="text-xs text-slate-500 mt-1">Per image with Adobe Stock SEO Title</p>
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
                  <p className="text-slate-400">Scans seasonal cycles (1-3 months ahead) &amp; global buyer demand (APAC, EU, US, LATAM).</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center">2</div>
                  <div className="font-semibold text-white">5 Stock Prompts</div>
                  <p className="text-slate-400">Creates 5 diverse angles: Wide Banner, Commercial Lifestyle, Portrait, Flat Lay, and In-action.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 font-bold flex items-center justify-center">3</div>
                  <div className="font-semibold text-white">Image Generation</div>
                  <p className="text-slate-400">Generates photorealistic images using cost-effective FLUX models via OpenRouter.</p>
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
            {!latestResult ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
                <ImageIcon className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="font-semibold text-white text-base">No batch generated in this session yet</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click the button below to generate today's 5 commercial prompts, SEO titles, and keywords.
                </p>
                <button
                  onClick={triggerManualRun}
                  disabled={isRunning}
                  className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
                >
                  Generate Batch Now
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
                      <span className={latestResult.emailDelivery.success ? "text-emerald-400" : "text-amber-400"}>
                        {latestResult.emailDelivery.success ? "Sent to hs5ckt@gmail.com" : "Simulation Mode"}
                      </span>
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">{latestResult.trend.theme}</h2>
                  <p className="text-sm text-slate-300 mb-3">{latestResult.trend.commercialReasoning}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400 border-t border-slate-800 pt-3">
                    <div>
                      <strong className="text-slate-300">Target Market:</strong> {latestResult.trend.targetMarket}
                    </div>
                    <div>
                      <strong className="text-slate-300">Seasonal Horizon:</strong> {latestResult.trend.seasonalRelevance}
                    </div>
                  </div>
                </div>

                {/* 5 Cards */}
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
                        <span className="text-xs font-mono text-sky-400 bg-sky-950/50 px-2 py-0.5 rounded border border-sky-800/40">
                          {img.modelUsed}
                        </span>
                      </div>

                      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Image Preview */}
                        <div className="lg:col-span-4 flex flex-col justify-center">
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
                        </div>

                        {/* Metadata Details */}
                        <div className="lg:col-span-8 space-y-4">
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
                                40-50 Curated Keywords ({img.keywords.length} tags)
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
