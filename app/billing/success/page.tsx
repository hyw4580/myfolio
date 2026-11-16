"use client";
import { track } from "@/lib/analytics";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Nav from "../../components/Nav";

/** 카드 등록 성공 후 돌아오는 페이지: 서버에 빌링키 발급 + 첫 결제를 요청 */
function SuccessInner() {
  const params = useSearchParams();
  const authKey = params.get("authKey");
  const customerKey = params.get("customerKey");
  const plan = params.get("plan") === "pro_yearly" ? "pro_yearly" : "pro_monthly";
  const missing = !authKey || !customerKey;
  const [result, setResult] = useState<"working" | "done" | "changed" | "error">("working");
  const [fetchMessage, setMessage] = useState("");
  const state = missing ? "error" : result;
  const message = missing ? "결제 정보가 없어요." : fetchMessage;
  const setState = setResult;
  const sent = useRef(false); // authKey는 1회용이라 한 번만 보냄

  useEffect(() => {
    if (sent.current || !authKey || !customerKey) return;
    sent.current = true;
    fetch("/api/billing/confirm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authKey, customerKey, plan }),
    })
      .then(async r => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setState("error"); setMessage(j.error ?? "결제에 실패했어요."); return; }
        setState(j.changedCard ? "changed" : "done");
        track("subscribe_completed", { plan: plan ?? "?" });
      })
      .catch(() => { setState("error"); setMessage("결제 처리 중 연결이 끊겼어요. 마이페이지에서 결제 상태를 확인해 주세요."); });
  }, [authKey, customerKey, plan]);

  return (
    <div style={{ maxWidth: "520px", margin: "0 auto", padding: "160px 24px 80px", textAlign: "center" }}>
      {state === "working" && <>
        <h1 className="font-display" style={{ fontSize: "36px", fontWeight: 400, marginBottom: "12px" }}>결제 처리 중...</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px" }}>잠시만 기다려 주세요. 창을 닫지 마세요.</p>
      </>}
      {state === "done" && <>
        <h1 className="font-display" style={{ fontSize: "36px", fontWeight: 400, marginBottom: "12px" }}>Pro 구독이 시작됐어요 ✓</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "32px" }}>이제 컴카드를 무제한으로 다운로드하고 포트폴리오를 마음껏 채울 수 있어요.</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <Link href="/comcard" style={{ padding: "14px 28px", background: "var(--text)", color: "#fff", textDecoration: "none", fontSize: "12px", letterSpacing: "0.12em" }}>컴카드 만들기</Link>
          <Link href="/mypage" style={{ padding: "14px 28px", border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none", fontSize: "12px", letterSpacing: "0.12em" }}>마이페이지</Link>
        </div>
      </>}
      {state === "changed" && <>
        <h1 className="font-display" style={{ fontSize: "36px", fontWeight: 400, marginBottom: "12px" }}>결제 카드가 변경됐어요 ✓</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "32px" }}>다음 결제일부터 새 카드로 결제돼요.</p>
        <Link href="/mypage" style={{ padding: "14px 28px", background: "var(--text)", color: "#fff", textDecoration: "none", fontSize: "12px" }}>마이페이지</Link>
      </>}
      {state === "error" && <>
        <h1 className="font-display" style={{ fontSize: "36px", fontWeight: 400, marginBottom: "12px" }}>결제하지 못했어요</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "32px" }}>{message}</p>
        <Link href="/pricing" style={{ padding: "14px 28px", background: "var(--text)", color: "#fff", textDecoration: "none", fontSize: "12px" }}>다시 시도하기</Link>
      </>}
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />
      <Suspense><SuccessInner /></Suspense>
    </div>
  );
}
