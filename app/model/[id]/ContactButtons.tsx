"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ContactButtons({ userId, instagram, kakaoLink, tel }: {
  userId: string;
  instagram: string | null;
  kakaoLink: string | null;
  tel: string | null;
}) {
  const [isOwner, setIsOwner] = useState(false);
  const isPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1";

  useEffect(() => {
    if (isPreview) return;
    createClient().auth.getUser().then(({ data }) => {
      if (data.user?.id === userId) setIsOwner(true);
    });
  }, [userId]);

  const show = isOwner && !isPreview;

  const btnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "44px", height: "44px", borderRadius: "50%", textDecoration: "none",
    flexShrink: 0,
  };

  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
      {/* 인스타그램 — 실제 그라디언트 로고 */}
      {(show || instagram) && (
        <a
          href={instagram ? `https://instagram.com/${instagram.replace("@", "")}` : undefined}
          target="_blank" rel="noreferrer" title="Instagram"
          style={{ ...btnStyle, background: "none", border: "none", padding: 0, opacity: instagram ? 1 : 0.3 }}
        >
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="ig1" cx="30%" cy="107%" r="150%">
                <stop offset="0%" stopColor="#fdf497"/>
                <stop offset="5%" stopColor="#fdf497"/>
                <stop offset="45%" stopColor="#fd5949"/>
                <stop offset="60%" stopColor="#d6249f"/>
                <stop offset="90%" stopColor="#285AEB"/>
              </radialGradient>
            </defs>
            <rect x="2" y="2" width="40" height="40" rx="12" fill="url(#ig1)"/>
            <rect x="2" y="2" width="40" height="40" rx="12" fill="none" stroke="none"/>
            <circle cx="22" cy="22" r="9" stroke="#fff" strokeWidth="2.5" fill="none"/>
            <circle cx="31.5" cy="12.5" r="2.5" fill="#fff"/>
          </svg>
        </a>
      )}

      {/* 카카오톡 — 실제 노란 로고 */}
      {(show || kakaoLink) && (
        <a
          href={kakaoLink ?? undefined}
          target="_blank" rel="noreferrer" title="KakaoTalk"
          style={{ ...btnStyle, background: "#FEE500", opacity: kakaoLink ? 1 : 0.3 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd"
              d="M12 2C6.477 2 2 5.582 2 10.04c0 2.76 1.843 5.19 4.628 6.587l-1.177 4.363c-.107.373.308.668.629.453L11.2 18.38c.265.027.533.04.8.04 5.523 0 10-3.582 10-8.04C22 5.582 17.523 2 12 2z"
              fill="#3C1E1E"/>
          </svg>
        </a>
      )}

      {/* 전화 */}
      {(show || tel) && (
        <a
          href={tel ? `tel:${tel}` : undefined} title={tel ?? "전화번호 미등록"}
          style={{ ...btnStyle, border: `1.5px solid ${tel ? "#111" : "#ddd"}`, color: tel ? "#111" : "#ddd", opacity: tel ? 1 : 0.3 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.06 6.06l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </a>
      )}
    </div>
  );
}
