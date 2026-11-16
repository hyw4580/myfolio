"use client";
import { FEATURES } from "@/lib/features";
import { startOAuth } from "@/lib/oauth";

/**
 * Apple로 계속하기 — iOS 앱에서 구글·카카오 로그인을 제공하면 애플 로그인도 필수(App Store 규정 4.8).
 * Supabase에 Apple 로그인을 설정한 뒤 lib/features.ts의 appleLogin을 true로 켜면 보인다.
 */
export default function AppleLoginButton({ next, label }: { next: string; label: string }) {
  if (!FEATURES.appleLogin) return null;
  return (
    <button
      onClick={() => startOAuth("apple", next)}
      style={{
        width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
        border: "none", background: "#000", fontSize: "14px", color: "#fff", cursor: "pointer", letterSpacing: "0.01em",
      }}
    >
      <svg width="16" height="18" viewBox="0 0 16 19" fill="#fff" aria-hidden>
        <path d="M13.3 10.1c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9zM10.9 2.9c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z" />
      </svg>
      {label}
    </button>
  );
}
