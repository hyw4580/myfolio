"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Nav from "../../components/Nav";

/** 카드 등록 실패/취소 시 돌아오는 페이지 (쿼리로 에러 코드·메시지가 옴) */
function FailInner() {
  const params = useSearchParams();
  const code = params.get("code");
  const message = params.get("message");
  const canceled = code === "PAY_PROCESS_CANCELED" || code === "USER_CANCEL";
  return (
    <div style={{ maxWidth: "520px", margin: "0 auto", padding: "160px 24px 80px", textAlign: "center" }}>
      <h1 className="font-display" style={{ fontSize: "36px", fontWeight: 400, marginBottom: "12px" }}>
        {canceled ? "카드 등록을 취소했어요" : "카드를 등록하지 못했어요"}
      </h1>
      {!canceled && message && <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "8px" }}>{message}</p>}
      {!canceled && code && <p style={{ color: "var(--border)", fontSize: "11px", marginBottom: "32px" }}>{code}</p>}
      <Link href="/pricing" style={{ display: "inline-block", marginTop: "24px", padding: "14px 28px", background: "var(--text)", color: "#fff", textDecoration: "none", fontSize: "12px" }}>요금제로 돌아가기</Link>
    </div>
  );
}

export default function BillingFailPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />
      <Suspense><FailInner /></Suspense>
    </div>
  );
}
