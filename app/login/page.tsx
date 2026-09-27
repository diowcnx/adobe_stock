"use client";

import React, { useState } from "react";
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("กรุณากรอกรหัสผ่าน (Please enter password)");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // นำทางไปยัง Dashboard
        window.location.href = "/";
      } else {
        setError(data.error || "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      }
    } catch (err: any) {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* Header Icon */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/25">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              Adobe Stock Admin
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              ระบบหลังบ้านสำหรับผู้ดูแล <strong>diowcnx</strong> เท่านั้น
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-slate-400">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>ระบบถูกปกป้องด้วย Session Cookie เข้ารหัส HMAC-SHA256 ป้องกันการเข้าถึงโดยไม่ได้รับอนุญาต</span>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              รหัสผ่านผู้ดูแลระบบ (Admin Password)
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านของคุณ..."
                autoFocus
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm py-3 px-4 rounded-xl transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <span>กำลังตรวจสอบความปลอดภัย...</span>
            ) : (
              <>
                <span>เข้าสู่ระบบหลังบ้าน</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-[11px] text-slate-500">
            สามารถกำหนดรหัสผ่านของตนเองได้ที่ Environment Variable <code>ADMIN_PASSWORD</code> ใน Vercel
          </p>
        </div>
      </div>
    </div>
  );
}
