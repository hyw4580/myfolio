"use client";
import { useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";

const noopSubscribe = () => () => {};

/**
 * 공유 버튼: 링크 복사 + (휴대폰이면) 기기 공유창(카카오톡·인스타그램·메시지 등).
 * path는 "/card/..." 처럼 사이트 안 경로, 실제 주소는 현재 도메인 기준으로 만든다.
 */
export default function ShareButtons({ path, title, text, compact = false }: {
  path: string; title: string; text?: string; compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}${path}`;
  // 서버 렌더링에선 false, 브라우저에선 실제 지원 여부 (화면 불일치 방지)
  const canNativeShare = useSyncExternalStore(noopSubscribe, () => typeof navigator.share === "function", () => false);

  const copy = async () => {
    track("share_clicked", { channel: "copy", page: path.startsWith("/card/") ? "card" : "profile" });
    try {
      await navigator.clipboard.writeText(url());
    } catch {
      window.prompt("이 주소를 복사하세요", url());
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const share = async () => {
    track("share_clicked", { channel: "native", page: path.startsWith("/card/") ? "card" : "profile" });
    try { await navigator.share({ title, text, url: url() }); } catch { /* 사용자가 닫음 */ }
  };

  const btn = (primary: boolean): React.CSSProperties => ({
    flex: 1, padding: compact ? "6px 10px" : "12px 16px", fontSize: compact ? "11px" : "12px", letterSpacing: "0.06em",
    cursor: "pointer", whiteSpace: "nowrap",
    border: primary ? "none" : "1px solid var(--border)", background: primary ? "var(--text)" : "#fff", color: primary ? "#fff" : "var(--text)",
  });
  return (
    <div style={{ display: "flex", gap: "6px" }}>
      {canNativeShare && <button onClick={share} style={btn(true)}>공유하기</button>}
      <button onClick={copy} style={btn(!canNativeShare)}>{copied ? "복사됨 ✓" : "링크 복사"}</button>
    </div>
  );
}
