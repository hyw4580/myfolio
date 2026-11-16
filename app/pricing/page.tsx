"use client";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import Link from "next/link";
import Nav from "../components/Nav";
import { PLANS, PLAN_FEATURES, formatKRW, planOf, yearlyPerMonth, type PlanId } from "@/lib/billing/plans";
import { formatDate, startSubscription, useBillingStatus } from "@/lib/billing/client";
import { useIsNativeApp } from "@/lib/native";

export default function PricingPage() {
  const [status, , loaded] = useBillingStatus();
  const [busy, setBusy] = useState(false);
  const inApp = useIsNativeApp(); // 앱 안에서는 판매 버튼을 두지 않음 (스토어 규정)
  const [plan, setPlan] = useState<PlanId>("pro_yearly");
  const P = PLANS[plan];
  const yearlySave = Math.round((1 - PLANS.pro_yearly.priceKRW / (PLANS.pro_monthly.priceKRW * 12)) * 100);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { track("pricing_viewed", { app: inApp }); }, [inApp]);
  const loggedIn = loaded && status !== null; // 불러오는 중에는 로그인 여부를 판단하지 않음

  const subscribe = async () => {
    if (!loaded) return;
    if (!loggedIn) { window.location.href = "/login?next=/pricing"; return; }
    setBusy(true); setError(null);
    try {
      const err = await startSubscription(plan);
      if (err) setError(err);
    } catch (e) {
      // 사용자가 결제창을 닫은 경우 등
      const msg = e instanceof Error ? e.message : "";
      if (!/USER_CANCEL|취소/.test(msg)) setError(msg || "결제를 시작하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const col: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", padding: "36px 32px", display: "flex", flexDirection: "column" };
  const li: React.CSSProperties = { fontSize: "14px", color: "var(--text)", lineHeight: 1.6, padding: "10px 0", borderBottom: "1px solid var(--border)" };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />
      <div style={{ maxWidth: "880px", margin: "0 auto", padding: "130px 24px 80px" }}>
        <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "12px" }}>Pricing</p>
        <h1 className="font-display" style={{ fontSize: "44px", fontWeight: 400, marginBottom: "12px" }}>요금제</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "40px", lineHeight: 1.7 }}>
          컴카드는 무료로 만들고 수정할 수 있어요. 첫 컴카드 1장은 무료로 다운로드·공개할 수 있고, 그 이상은 Pro 구독으로 이용해요.
        </p>

        {status && status.configured === false && (
          <p style={{ fontSize: "12px", color: "#b07a2a", background: "#f8efe0", padding: "10px 14px", marginBottom: "24px" }}>
            결제 기능 설정 전이에요. 지금은 구독할 수 없어요.
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          {/* Free */}
          <div style={col}>
            <p style={{ fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>Free</p>
            <p className="font-display" style={{ fontSize: "36px", margin: "10px 0 24px" }}>0원</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", flex: 1 }}>
              {PLAN_FEATURES.free.map(f => <li key={f} style={li}>{f}</li>)}
            </ul>
            <Link href="/comcard" style={{ textAlign: "center", padding: "14px", border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              컴카드 만들기
            </Link>
          </div>

          {/* Pro */}
          <div style={{ ...col, border: "2px solid var(--text)" }}>
            <p style={{ fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text)" }}>Pro</p>
            {/* 월간 / 연간 선택 */}
            <div style={{ display: "flex", margin: "14px 0 0" }}>
              {(["pro_monthly", "pro_yearly"] as const).map((id, i) => (
                <button key={id} onClick={() => setPlan(id)} style={{
                  flex: 1, padding: "8px 0", fontSize: "12px", cursor: "pointer",
                  border: "1px solid var(--border)", borderLeft: i ? "none" : "1px solid var(--border)",
                  background: plan === id ? "var(--text)" : "#fff", color: plan === id ? "#fff" : "var(--muted)",
                }}>
                  {id === "pro_monthly" ? "월간" : `연간 · ${yearlySave}% 할인`}
                </button>
              ))}
            </div>
            <p className="font-display" style={{ fontSize: "36px", margin: "14px 0 2px" }}>
              {formatKRW(P.priceKRW)}<span style={{ fontSize: "14px", color: "var(--muted)" }}> / {P.unit}</span>
            </p>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "20px", minHeight: "18px" }}>
              {plan === "pro_yearly" ? `월 ${formatKRW(yearlyPerMonth)}꼴 · 1년마다 결제` : "매달 결제 · 언제든 취소"}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", flex: 1 }}>
              {PLAN_FEATURES.pro.map(f => <li key={f} style={li}>{f}</li>)}
            </ul>
            {status?.isPro ? (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "13px", color: "var(--text)", marginBottom: "6px" }}>{planOf(status.plan).name} 이용 중 ✓</p>
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {status.cancelAtPeriodEnd ? `${formatDate(status.currentPeriodEnd)}까지 이용 후 해지돼요` : `다음 결제일 ${formatDate(status.currentPeriodEnd)}`}
                </p>
                <Link href="/mypage" style={{ display: "inline-block", marginTop: "12px", fontSize: "12px", color: "var(--muted)" }}>마이페이지에서 관리</Link>
              </div>
            ) : inApp ? (
              <p style={{ fontSize: "12px", color: "var(--muted)", textAlign: "center", lineHeight: 1.7 }}>Pro 회원은 앱에서도 모든 Pro 기능을 쓸 수 있어요.</p>
            ) : (
              <button onClick={subscribe} disabled={!loaded || busy || status?.configured === false} style={{
                padding: "15px", background: "var(--text)", color: "#fff", border: "none", cursor: busy ? "wait" : "pointer",
                fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase", opacity: busy || status?.configured === false ? 0.5 : 1,
              }}>
                {!loaded ? "불러오는 중..." : busy ? "결제창 여는 중..." : loggedIn ? `${P.name} 구독하기` : "로그인하고 구독하기"}
              </button>
            )}
            {error && <p style={{ fontSize: "12px", color: "#c00", marginTop: "10px" }}>{error}</p>}
          </div>
        </div>

        <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.8, marginTop: "28px" }}>
          · 카드를 등록하면 바로 첫 결제가 되고, 이후 월간은 매달·연간은 매년 같은 날 자동으로 결제돼요.<br />
          · 언제든 마이페이지에서 구독을 취소할 수 있어요. 취소해도 이미 결제한 기간이 끝날 때까지 Pro 기능을 쓸 수 있어요.<br />
          · 결제 후 7일 안에 Pro 기능을 쓰지 않고 취소하면 바로 전액 환불돼요. 연간 구독은 중간에 끝내면 남은 금액을 돌려받을 수도 있어요. 자세한 기준은 <Link href="/refund" style={{ color: "inherit" }}>환불정책</Link>을 확인해 주세요.<br />
          · 결제는 토스페이먼츠를 통해 안전하게 처리되며, myfolio는 카드 번호를 저장하지 않아요.<br />
          · 구독하면 <Link href="/terms" style={{ color: "inherit" }}>이용약관</Link>·<Link href="/refund" style={{ color: "inherit" }}>환불정책</Link>에 동의하는 것으로 봐요.
        </p>
      </div>
    </div>
  );
}
