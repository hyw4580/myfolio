"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** 매주 자동 보고를 기다리지 않고 지금 바로 분석 */
export default function RunNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/voc-report", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(j.error ?? "분석에 실패했어요."); return; }
    setMsg(`완료 · 의견 ${j.feedbackCount}개 분석${j.emailed ? " · 이메일 발송" : ""}`);
    router.refresh();
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <button onClick={run} disabled={busy} style={{ padding: "10px 18px", background: "#111", color: "#fff", border: "none", fontSize: "12px", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
        {busy ? "AI가 분석하는 중... (1~2분)" : "지금 분석하기"}
      </button>
      {msg && <span style={{ fontSize: "12px", color: "#666" }}>{msg}</span>}
    </div>
  );
}
