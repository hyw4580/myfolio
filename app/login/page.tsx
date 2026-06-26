"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

function LoginContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/comcard";
  const error = searchParams.get("error");

  const supabase = createClient();

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  };

  const signInWithKakao = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#fff",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none", marginBottom: "56px" }}>
        <span style={{ fontFamily: "var(--font-cormorant), var(--font-korean), serif", fontSize: "28px", fontStyle: "italic", color: "#0A0A0A", letterSpacing: "-0.01em" }}>
          myfolio
        </span>
      </Link>

      <div style={{ width: "100%", maxWidth: "360px", padding: "0 24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 400, letterSpacing: "-0.01em", marginBottom: "8px", textAlign: "center" }}>
          로그인
        </h1>
        <p style={{ fontSize: "13px", color: "#888", textAlign: "center", marginBottom: "40px", lineHeight: 1.6 }}>
          컴카드 제작을 위해 로그인이 필요해요
        </p>

        {error && (
          <div style={{
            marginBottom: "20px", padding: "12px 16px",
            background: "#fff5f5", border: "1px solid #ffc0c0",
            fontSize: "13px", color: "#c00", textAlign: "center",
          }}>
            로그인에 실패했어요. 다시 시도해 주세요.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Google */}
          <button
            onClick={signInWithGoogle}
            style={{
              width: "100%", padding: "14px 20px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
              border: "1px solid #e0e0e0", background: "#fff",
              fontSize: "14px", color: "#0A0A0A", cursor: "pointer",
              letterSpacing: "0.01em",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
            </svg>
            Google로 계속하기
          </button>

          {/* Kakao */}
          <button
            onClick={signInWithKakao}
            style={{
              width: "100%", padding: "14px 20px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
              border: "none", background: "#FEE500",
              fontSize: "14px", color: "#000000CC", cursor: "pointer",
              letterSpacing: "0.01em",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M9 1.5C4.86 1.5 1.5 4.1 1.5 7.3c0 2.07 1.38 3.89 3.46 4.93l-.88 3.27c-.08.28.23.5.47.34L8.4 13.5c.2.02.4.03.6.03 4.14 0 7.5-2.6 7.5-5.8S13.14 1.5 9 1.5z" fill="#000000"/>
            </svg>
            카카오로 계속하기
          </button>
        </div>

        <p style={{ marginTop: "32px", fontSize: "12px", color: "#aaa", textAlign: "center", lineHeight: 1.7 }}>
          계속 진행하면 myfolio의{" "}
          <span style={{ textDecoration: "underline", cursor: "pointer" }}>이용약관</span>과{" "}
          <span style={{ textDecoration: "underline", cursor: "pointer" }}>개인정보처리방침</span>에 동의하게 됩니다.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
