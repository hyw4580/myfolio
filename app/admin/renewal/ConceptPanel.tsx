"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { conceptLabel, type Concept } from "@/lib/photo-concepts";

export type ConceptStats = {
  samples: number; exact: number;
  per_concept: { concept: string; suggested: number; kept: number }[];
  swaps: { from: string; to: string; n: number }[];
  custom_candidates: { label: string; users: number }[];
};

/** 이만큼 쓰이면 목록 추가를 권해요 */
const CANDIDATE_MIN_USERS = 5;

/** 사진 컨셉 AI 판독 성과 + 사용자들이 직접 입력한 새 컨셉 후보 */
export default function ConceptPanel({ stats, catalog }: { stats: ConceptStats | null; catalog: Concept[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const label = (id: string) => conceptLabel(id, catalog);
  const known = new Set(catalog.map(c => c.label.toLowerCase()));
  const candidates = (stats?.custom_candidates ?? []).filter(c => !known.has(c.label));

  const add = async (name: string) => {
    if (!confirm(`'${name}'을(를) 촬영 컨셉 목록에 추가할까요?\n이 컨셉으로 직접 입력한 사진들도 함께 정리되고, 다음 판독부터 AI가 이 컨셉을 고를 수 있어요.`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/renewal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_concept", label: name }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { alert(j.error ?? "추가하지 못했어요."); return; }
    alert(`추가했어요. 사진 ${j.migrated}장을 정리했어요.`);
    router.refresh();
  };

  const box: React.CSSProperties = { background: "#fff", border: "1px solid #eee", padding: "14px 16px", fontSize: "13px", lineHeight: 1.7 };
  return (
    <section style={{ marginTop: "36px" }}>
      <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "10px" }}>📸 사진 컨셉 AI 판독</h2>
      {!stats || stats.samples === 0 ? (
        <p style={{ fontSize: "13px", color: "#aaa" }}>아직 판독 기록이 없어요. 사진이 올라오고 사용자가 확인·수정할수록 정확도가 쌓여요.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={box}>
            <b>정확도 {Math.round((stats.exact / stats.samples) * 100)}%</b> <span style={{ color: "#888" }}>· AI가 고른 그대로 둔 사진 {stats.exact} / 전체 {stats.samples}장</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
              {stats.per_concept.map(p => (
                <span key={p.concept} style={{ background: p.kept / p.suggested < 0.6 ? "#fdecea" : "#f2f2f2", padding: "2px 8px", fontSize: "12px" }}>
                  {label(p.concept)} {Math.round((p.kept / p.suggested) * 100)}% <span style={{ color: "#999" }}>({p.suggested})</span>
                </span>
              ))}
            </div>
          </div>
          {stats.swaps.length > 0 && (
            <div style={box}>
              <b>자주 고친 것</b> <span style={{ color: "#888", fontSize: "12px" }}>— 다음 판독 때 AI에게 자동으로 알려줘요 (3번 이상)</span>
              <ul style={{ paddingLeft: "18px", margin: "6px 0 0" }}>
                {stats.swaps.slice(0, 8).map((s, i) => <li key={i}>{label(s.from)} → {label(s.to)} <span style={{ color: "#999" }}>{s.n}번</span></li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <h3 style={{ fontSize: "13px", fontWeight: 600, margin: "18px 0 8px" }}>새 컨셉 후보 (사용자가 직접 입력)</h3>
      {candidates.length === 0 ? <p style={{ fontSize: "13px", color: "#aaa" }}>아직 없어요.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {candidates.map(c => (
            <div key={c.label} style={{ ...box, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
              <span>{c.label} <span style={{ color: "#999", fontSize: "12px" }}>· {c.users}명이 사용{c.users >= CANDIDATE_MIN_USERS ? " · 추가 권장" : ""}</span></span>
              <button disabled={busy} onClick={() => add(c.label)} style={{ padding: "6px 12px", fontSize: "12px", cursor: "pointer", border: c.users >= CANDIDATE_MIN_USERS ? "none" : "1px solid #ddd", background: c.users >= CANDIDATE_MIN_USERS ? "#111" : "#fff", color: c.users >= CANDIDATE_MIN_USERS ? "#fff" : "#333" }}>목록에 추가</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
