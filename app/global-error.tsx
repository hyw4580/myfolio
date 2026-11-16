"use client";
import { useEffect } from "react";
import { reportClientError } from "@/lib/error-reporter";

/** 최상위 레이아웃까지 깨졌을 때의 마지막 안내 화면 */
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { reportClientError(error); }, [error]);
  return (
    <html lang="ko">
      <body style={{ fontFamily: "-apple-system, 'Apple SD Gothic Neo', sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px" }}>
        <div>
          <p style={{ fontSize: "22px", marginBottom: "10px" }}>잠시 문제가 생겼어요</p>
          <p style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>오류 내용은 자동으로 전달됐어요.</p>
          <button onClick={() => unstable_retry()} style={{ padding: "12px 22px", background: "#0A0A0A", color: "#fff", border: "none", cursor: "pointer" }}>다시 시도</button>
        </div>
      </body>
    </html>
  );
}
