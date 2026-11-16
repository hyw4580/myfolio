"use client";
import { useEffect } from "react";
import Link from "next/link";
import { reportClientError } from "@/lib/error-reporter";

/** 화면 오류 시 보이는 안내 (오류는 자동 기록되어 매일 점검에 반영) */
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { reportClientError(error); }, [error]);
  return (
    <div style={{ minHeight: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
      <p className="font-display" style={{ fontSize: "28px", marginBottom: "10px" }}>잠시 문제가 생겼어요</p>
      <p style={{ fontSize: "13px", color: "#888", lineHeight: 1.7, marginBottom: "22px" }}>오류 내용은 자동으로 전달돼 빠르게 고칠게요.<br />다시 시도하거나 홈으로 이동해 주세요.</p>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={() => unstable_retry()} style={{ padding: "12px 22px", background: "#0A0A0A", color: "#fff", border: "none", fontSize: "12px", cursor: "pointer" }}>다시 시도</button>
        <Link href="/" style={{ padding: "12px 22px", border: "1px solid #ddd", color: "#111", fontSize: "12px", textDecoration: "none" }}>홈으로</Link>
      </div>
    </div>
  );
}
