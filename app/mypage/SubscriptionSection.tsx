"use client";
import { useState } from "react";
import Link from "next/link";
import { formatDate, startSubscription, useBillingStatus } from "@/lib/billing/client";
import { FREE_EXPORT_CARD_LIMIT, PRO_PLAN, formatKRW, planOf } from "@/lib/billing/plans";
import { useIsNativeApp } from "@/lib/native";
import type { CancelOption } from "@/lib/billing/refund";

/** 마이페이지: 내 요금제 · 다음 결제일 · 해지/재개 · 카드 변경 */
export default function SubscriptionSection() {
  const [status, reload] = useBillingStatus();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<CancelOption | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const inApp = useIsNativeApp(); // 앱 안에서는 결제·카드 변경 버튼 숨김 (스토어 규정)

  if (!status) return null;

  const box: React.CSSProperties = { border: "1px solid var(--border)", padding: "20px 22px", background: "#fff" };
  const btn = (primary = false): React.CSSProperties => ({
    padding: "10px 18px", fontSize: "11px", letterSpacing: "0.1em", cursor: busy ? "wait" : "pointer",
    border: primary ? "none" : "1px solid var(--border)", background: primary ? "var(--text)" : "#fff", color: primary ? "#fff" : "var(--text)",
    textDecoration: "none", display: "inline-block",
  });

  /** 구독 취소 1단계: 지금 취소하면 어떻게 되는지 서버에서 받아 보여줌 */
  const openCancel = async () => {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/billing/cancel");
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(j.error ?? "취소 정보를 불러오지 못했어요."); return; }
    setPreview(j.option as CancelOption);
  };
  /** 2단계: 실제 처리 (서버가 규칙을 다시 확인) */
  const act = async (action: "cancel" | "refund_remaining" | "resume") => {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/billing/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(j.error ?? "처리하지 못했어요."); return; }
    setPreview(null);
    if (j.result === "refunded") setDone(`${formatKRW(j.amount)} 환불을 요청했어요. 카드사에 따라 3~7일 안에 반영돼요. 구독은 바로 종료됐어요.`);
    else if (j.result === "period_end") setDone(`구독을 취소했어요. ${formatDate(j.until)}까지 Pro 기능을 쓸 수 있고, 다음 결제는 되지 않아요.`);
    reload();
  };

  const changeCard = async () => {
    setBusy(true); setMsg(null);
    try { const err = await startSubscription(); if (err) setMsg(err); }
    catch (e) { const m = e instanceof Error ? e.message : ""; if (!/USER_CANCEL|취소/.test(m)) setMsg(m || "카드 변경을 시작하지 못했어요."); }
    finally { setBusy(false); }
  };

  return (
    <section style={{ marginBottom: "48px", paddingBottom: "48px", borderBottom: "1px solid var(--border)" }}>
      <h2 style={{ fontSize: "14px", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "20px" }}>요금제</h2>
      <div style={box}>
        {status.configured === false ? (
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>결제 기능 설정 전이에요. 지금은 모든 기능을 제한 없이 쓸 수 있어요.</p>
        ) : status.isPro ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px", marginBottom: "6px" }}>
              <p style={{ fontSize: "16px", color: "var(--text)" }}>{planOf(status.plan).name} <span style={{ fontSize: "12px", color: "var(--muted)" }}>· {formatKRW(planOf(status.plan).priceKRW)}/{planOf(status.plan).unit}</span></p>
              {status.status === "past_due" && <span style={{ fontSize: "11px", color: "#c00" }}>결제 실패 · 카드를 확인해 주세요</span>}
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "4px" }}>
              {status.cancelAtPeriodEnd
                ? `구독 취소됨 · ${formatDate(status.currentPeriodEnd)}까지 이용 가능`
                : `다음 결제일 ${formatDate(status.currentPeriodEnd)}`}
            </p>
            {status.cardLabel && <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>{status.cardLabel}</p>}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {status.cancelAtPeriodEnd
                ? <button onClick={() => act("resume")} disabled={busy} style={btn(true)}>취소 철회하고 계속 이용</button>
                : !preview && <button onClick={openCancel} disabled={busy} style={btn()}>구독 취소</button>}
              {!inApp && <button onClick={changeCard} disabled={busy} style={btn()}>결제 카드 변경</button>}
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: "16px", color: "var(--text)", marginBottom: "6px" }}>Free</p>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px", lineHeight: 1.7 }}>
              컴카드 다운로드 {Math.min(status.exportedCardIds?.length ?? 0, FREE_EXPORT_CARD_LIMIT)}/{FREE_EXPORT_CARD_LIMIT}장 사용 ·
              {status.status === "expired" ? " 이전 Pro 구독이 만료됐어요." : (inApp ? " Pro 회원은 다운로드·AI 추천 무제한 + 포트폴리오 게시물을 쓸 수 있어요." : " Pro로 다운로드·AI 추천 무제한 + 포트폴리오 게시물을 이용해 보세요.")}
            </p>
            {!inApp && <Link href="/pricing" style={btn(true)}>Pro 구독하기 · 월 {formatKRW(PRO_PLAN.priceKRW)}부터</Link>}
          </>
        )}
        {preview && <CancelPanel option={preview} busy={busy} onConfirm={act} onClose={() => setPreview(null)} btn={btn} />}
        {done && <p style={{ fontSize: "12px", color: "#1f7a3a", marginTop: "10px", lineHeight: 1.6 }}>{done}</p>}
        {msg && <p style={{ fontSize: "12px", color: "#c00", marginTop: "10px" }}>{msg}</p>}
      </div>
    </section>
  );
}

/** 구독 취소 확인 칸: 규칙에 따라 "전액 환불" 또는 "기간 끝까지 이용"을 먼저 보여주고 확인받음 */
function CancelPanel({ option, busy, onConfirm, onClose, btn }: {
  option: CancelOption; busy: boolean; onConfirm: (a: "cancel" | "refund_remaining") => void; onClose: () => void;
  btn: (primary?: boolean) => React.CSSProperties;
}) {
  const box: React.CSSProperties = { marginTop: "16px", border: "1px solid var(--text)", padding: "16px 18px", fontSize: "13px", lineHeight: 1.7 };
  if (option.kind === "full_refund") {
    return (
      <div style={box}>
        <p style={{ fontWeight: 600, marginBottom: "4px" }}>지금 취소하면 {formatKRW(option.amount)} 전액 환불돼요</p>
        <p style={{ color: "var(--muted)", marginBottom: "14px" }}>결제 후 7일 안이고 Pro 기능을 쓰지 않았어요. 취소하면 Pro는 바로 종료되고 무료 회원으로 돌아가요.</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => onConfirm("cancel")} disabled={busy} style={btn(true)}>{busy ? "처리 중..." : "취소하고 전액 환불받기"}</button>
          <button onClick={onClose} disabled={busy} style={btn()}>계속 이용하기</button>
        </div>
      </div>
    );
  }
  return (
    <div style={box}>
      <p style={{ fontWeight: 600, marginBottom: "4px" }}>{formatDate(option.until)}까지 쓰고 구독이 종료돼요</p>
      <p style={{ color: "var(--muted)", marginBottom: option.partialRefund ? "8px" : "14px" }}>
        다음 결제는 되지 않아요.
        {option.usedFeatures.length > 0 && <> 결제 후 Pro 기능({option.usedFeatures.join(", ")})을 써서 전액 환불 대상은 아니에요.</>}
      </p>
      {option.partialRefund && (
        <p style={{ color: "var(--muted)", marginBottom: "14px" }}>
          연간 구독이라 지금 바로 끝내고 남은 금액을 돌려받을 수도 있어요: 이용 {option.usedMonths}개월 × {formatKRW(PRO_PLAN.priceKRW)}을 빼고 <b style={{ color: "var(--text)" }}>{formatKRW(option.partialRefund)}</b> 환불 (Pro 즉시 종료)
        </p>
      )}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button onClick={() => onConfirm("cancel")} disabled={busy} style={btn(true)}>{busy ? "처리 중..." : "구독 취소 (기간 끝까지 이용)"}</button>
        {option.partialRefund && <button onClick={() => { if (confirm(`Pro를 지금 바로 끝내고 ${formatKRW(option.partialRefund!)}을 환불받을까요?`)) onConfirm("refund_remaining"); }} disabled={busy} style={btn()}>지금 끝내고 {formatKRW(option.partialRefund)} 환불받기</button>}
        <button onClick={onClose} disabled={busy} style={btn()}>계속 이용하기</button>
      </div>
    </div>
  );
}
