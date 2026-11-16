"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type RenewalItem = {
  id: number; lane: "stabilize" | "feature"; source: "ai" | "owner"; title: string;
  problem: string | null; evidence: string | null; plan: string | null;
  risk: "low" | "medium" | "high" | null; effort: "small" | "medium" | "large" | null; stage: string | null;
  status: "idea" | "proposed" | "approved" | "held" | "rejected" | "in_progress" | "done" | "failed";
  owner_note: string | null; agent_note: string | null; pr_url: string | null; created_at: string; approved_at: string | null; done_at: string | null;
};

const RISK = { low: { t: "위험 낮음", c: "#1f7a3a", bg: "#e8f5ec" }, medium: { t: "위험 보통", c: "#b26a00", bg: "#fff4e0" }, high: { t: "위험 높음", c: "#c62828", bg: "#fdecea" } } as const;
const EFFORT = { small: "작업 작음", medium: "작업 보통", large: "작업 큼" } as const;
const STATUS: Record<RenewalItem["status"], string> = {
  idea: "기획서 작성 대기", proposed: "승인 대기", approved: "승인됨 · 화요일 작업", held: "보류", rejected: "거절",
  in_progress: "작업 중", done: "완료", failed: "작업 실패",
};
const fmt = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });

/** 리뉴얼 승인 화면: 갈래 A(안정화) 일괄 승인, 갈래 B(새 기능) 항목별 승인, 아이디어 등록 */
export default function RenewalBoard({ items }: { items: RenewalItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [idea, setIdea] = useState({ title: "", description: "" });

  const call = async (body: unknown, done?: string) => {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/renewal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(j.error ?? "처리하지 못했어요."); return false; }
    if (done) setMsg(done);
    router.refresh();
    return true;
  };
  const setStatus = (ids: number[], status: "approved" | "held" | "rejected" | "proposed", note?: string) =>
    call({ action: "status", ids, status, note }, status === "approved" ? `${ids.length}건 승인했어요. 화요일 오전에 작업을 시작해요.` : undefined);

  const waitingA = items.filter(i => i.lane === "stabilize" && i.status === "proposed");
  const lowA = waitingA.filter(i => i.risk === "low" || i.risk === "medium");
  const waitingB = items.filter(i => i.lane === "feature" && i.status === "proposed");
  const ideas = items.filter(i => i.status === "idea");
  const active = items.filter(i => ["approved", "in_progress", "failed"].includes(i.status));
  const doneList = items.filter(i => i.status === "done").slice(0, 15);
  const parked = items.filter(i => i.status === "held" || i.status === "rejected").slice(0, 20);

  const h2: React.CSSProperties = { fontSize: "15px", fontWeight: 600, margin: "28px 0 10px" };
  const btn = (primary = false): React.CSSProperties => ({ padding: "7px 12px", fontSize: "12px", cursor: busy ? "wait" : "pointer", border: primary ? "none" : "1px solid #ddd", background: primary ? "#111" : "#fff", color: primary ? "#fff" : "#333" });

  const Card = ({ it, actions = true }: { it: RenewalItem; actions?: boolean }) => (
    <div style={{ background: "#fff", border: "1px solid #eee", padding: "14px 16px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
        <b style={{ fontSize: "14px" }}>{it.title}</b>
        {it.risk && <span style={{ fontSize: "11px", padding: "2px 7px", background: RISK[it.risk].bg, color: RISK[it.risk].c }}>{RISK[it.risk].t}</span>}
        {it.effort && <span style={{ fontSize: "11px", padding: "2px 7px", background: "#f2f2f2", color: "#555" }}>{EFFORT[it.effort]}</span>}
        {it.stage && <span style={{ fontSize: "11px", padding: "2px 7px", background: "#f2f2f2", color: "#555" }}>{it.stage}</span>}
        <span style={{ fontSize: "11px", color: "#999" }}>{it.source === "owner" ? "내 아이디어" : "AI 제안"} · {fmt(it.created_at)} · {STATUS[it.status]}</span>
      </div>
      {it.problem && <p style={{ fontSize: "13px", color: "#333", lineHeight: 1.6 }}>{it.problem}</p>}
      {it.evidence && <p style={{ fontSize: "12px", color: "#888", lineHeight: 1.6, marginTop: "4px", whiteSpace: "pre-wrap" }}>근거: {it.evidence}</p>}
      {it.plan && <details style={{ marginTop: "6px" }}><summary style={{ fontSize: "12px", color: "#555", cursor: "pointer" }}>무엇을 바꾸나 (기획)</summary><p style={{ fontSize: "13px", lineHeight: 1.7, marginTop: "6px", whiteSpace: "pre-wrap" }}>{it.plan}</p></details>}
      {it.owner_note && <p style={{ fontSize: "12px", color: "#1f4f9a", marginTop: "6px" }}>내 메모: {it.owner_note}</p>}
      {it.agent_note && <p style={{ fontSize: "12px", color: "#1f7a3a", marginTop: "6px", whiteSpace: "pre-wrap" }}>작업 결과: {it.agent_note}</p>}
      {it.pr_url && <p style={{ fontSize: "12px", marginTop: "4px" }}><a href={it.pr_url} target="_blank" rel="noreferrer">변경 내용(PR) 보기 →</a></p>}
      {actions && (
        <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
          {it.status !== "approved" && <button disabled={busy} style={btn(true)} onClick={() => {
            const note = it.lane === "feature" ? prompt("승인 조건이나 메모가 있으면 적어 주세요 (없으면 빈칸)") ?? undefined : undefined;
            setStatus([it.id], "approved", note || undefined);
          }}>승인</button>}
          {it.status !== "held" && <button disabled={busy} style={btn()} onClick={() => setStatus([it.id], "held")}>보류</button>}
          {it.status !== "rejected" && <button disabled={busy} style={btn()} onClick={() => { const n = prompt("거절 이유 (AI가 비슷한 제안을 다시 안 하도록 참고해요)") ?? undefined; setStatus([it.id], "rejected", n || undefined); }}>거절</button>}
          {it.status === "approved" && <button disabled={busy} style={btn()} onClick={() => setStatus([it.id], "proposed")}>승인 취소</button>}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <h1 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "6px" }}>리뉴얼 승인</h1>
      <p style={{ fontSize: "13px", color: "#777", lineHeight: 1.7 }}>
        매주 월요일 AI가 의견·사용 분석·오류 점검으로 제안을 올려요. 승인한 항목만 화요일 오전에 Claude가 작업해 변경 내용(PR)을 올리고, 확인 후 합치면 배포돼요. 승인하지 않은 건 아무것도 시작하지 않아요.
      </p>
      {msg && <p style={{ fontSize: "13px", background: "#111", color: "#fff", padding: "10px 12px", marginTop: "12px" }}>{msg}</p>}

      {/* 갈래 A */}
      <h2 style={h2}>🛠 안정화 제안 · 승인 대기 {waitingA.length}건</h2>
      {lowA.length > 0 && (
        <button disabled={busy} style={{ ...btn(true), marginBottom: "10px" }} onClick={() => setStatus(lowA.map(i => i.id), "approved")}>
          위험 낮음·보통 {lowA.length}건 일괄 승인
        </button>
      )}
      {waitingA.some(i => i.risk === "high") && <p style={{ fontSize: "12px", color: "#c62828", marginBottom: "8px" }}>위험 높음(결제·로그인·개인정보 관련)은 일괄 승인에서 빠져요. 하나씩 확인해 주세요.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {waitingA.length === 0 && <p style={{ fontSize: "13px", color: "#aaa" }}>승인 대기 중인 안정화 제안이 없어요.</p>}
        {waitingA.map(it => <Card key={it.id} it={it} />)}
      </div>

      {/* 갈래 B */}
      <h2 style={h2}>✨ 새 기능 기획서 · 승인 대기 {waitingB.length}건</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {waitingB.length === 0 && <p style={{ fontSize: "13px", color: "#aaa" }}>승인 대기 중인 기획서가 없어요.</p>}
        {waitingB.map(it => <Card key={it.id} it={it} />)}
      </div>

      {/* 아이디어함 */}
      <h2 style={h2}>💡 기능 아이디어함</h2>
      <div style={{ background: "#fff", border: "1px solid #eee", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <input value={idea.title} onChange={e => setIdea(v => ({ ...v, title: e.target.value }))} placeholder="예) 에이전시가 모델을 검색해서 연락할 수 있으면 좋겠다"
          style={{ padding: "10px 12px", border: "1px solid #ddd", fontSize: "14px" }} />
        <textarea value={idea.description} onChange={e => setIdea(v => ({ ...v, description: e.target.value }))} rows={3} placeholder="(선택) 왜 필요한지, 떠오르는 화면, 참고 서비스 등"
          style={{ padding: "10px 12px", border: "1px solid #ddd", fontSize: "13px", fontFamily: "inherit", resize: "vertical" }} />
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button disabled={busy || idea.title.trim().length < 2} style={btn(true)} onClick={async () => {
            if (await call({ action: "idea", title: idea.title, description: idea.description || undefined, specNow: true }, "기획서를 만들었어요. 위의 '새 기능 기획서'에서 검토해 주세요.")) setIdea({ title: "", description: "" });
          }}>{busy ? "AI가 기획 중..." : "등록하고 바로 기획서 만들기"}</button>
          <button disabled={busy || idea.title.trim().length < 2} style={btn()} onClick={async () => {
            if (await call({ action: "idea", title: idea.title, description: idea.description || undefined }, "등록했어요. 월요일 보고 때 기획서가 만들어져요.")) setIdea({ title: "", description: "" });
          }}>등록만 (월요일에 기획)</button>
        </div>
        {ideas.length > 0 && (
          <div style={{ marginTop: "6px" }}>
            {ideas.map(it => (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center", fontSize: "13px", padding: "6px 0", borderTop: "1px solid #f2f2f2" }}>
                <span>{it.title} <span style={{ color: "#999", fontSize: "11px" }}>· {fmt(it.created_at)}</span></span>
                <button disabled={busy} style={btn()} onClick={() => call({ action: "spec", id: it.id }, "기획서를 만들었어요.")}>지금 기획하기</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 진행 */}
      <h2 style={h2}>⚙️ 승인됨 · 작업 중 {active.length}건</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {active.length === 0 && <p style={{ fontSize: "13px", color: "#aaa" }}>없어요.</p>}
        {active.map(it => <Card key={it.id} it={it} actions={it.status !== "in_progress"} />)}
      </div>

      <h2 style={h2}>✅ 최근 완료</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {doneList.length === 0 && <p style={{ fontSize: "13px", color: "#aaa" }}>없어요.</p>}
        {doneList.map(it => <Card key={it.id} it={it} actions={false} />)}
      </div>

      {parked.length > 0 && <>
        <h2 style={h2}>보류 · 거절</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{parked.map(it => <Card key={it.id} it={it} />)}</div>
      </>}
    </div>
  );
}
