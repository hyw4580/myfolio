"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { track } from "@/lib/analytics";

const CATEGORIES = [
  { id: "inconvenience", label: "불편해요" },
  { id: "request", label: "이런 기능이 있으면 좋겠어요" },
  { id: "bug", label: "오류가 있어요" },
  { id: "praise", label: "좋아요" },
  { id: "other", label: "기타" },
] as const;
type Category = (typeof CATEGORIES)[number]["id"];

/** 메뉴의 "의견 보내기" — 모인 의견은 매주 AI가 분석해 운영자에게 보고 */
export default function FeedbackButton({ style, onOpen }: { style?: React.CSSProperties; onOpen?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("inconvenience");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const send = async () => {
    setState("sending");
    const res = await fetch("/api/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, message, page: pathname, platform: Capacitor.getPlatform() }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setState("error"); setError(j.error ?? "보내지 못했어요."); return; }
    setState("sent"); setMessage("");
    track("feedback_sent", { category });
  };
  const close = () => { setOpen(false); setState("idle"); setError(""); };

  return (
    <>
      <button onClick={() => { onOpen?.(); setOpen(true); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", ...style }}>
        의견 보내기
      </button>
      {/* 메뉴 바 안에 그리면 화면 밖으로 밀리므로 페이지 맨 위(body)에 띄움 */}
      {open && createPortal(
        <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: "420px", padding: "26px 24px", textAlign: "left", letterSpacing: "normal", textTransform: "none" }}>
            {state === "sent" ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <p className="font-display" style={{ fontSize: "24px", marginBottom: "8px" }}>고마워요 ✓</p>
                <p style={{ fontSize: "13px", color: "#777", lineHeight: 1.7, marginBottom: "20px" }}>보내주신 의견은 매주 모아서 꼼꼼히 살펴보고 개선에 반영할게요.</p>
                <button onClick={close} style={{ padding: "11px 28px", background: "#0A0A0A", color: "#fff", border: "none", fontSize: "12px", cursor: "pointer" }}>닫기</button>
              </div>
            ) : (
              <>
                <p className="font-display" style={{ fontSize: "24px", marginBottom: "6px" }}>의견 보내기</p>
                <p style={{ fontSize: "12px", color: "#888", marginBottom: "16px" }}>불편한 점, 바라는 기능, 무엇이든 편하게 알려주세요.</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                  {CATEGORIES.map(c => (
                    <button key={c.id} onClick={() => setCategory(c.id)} style={{
                      padding: "7px 11px", fontSize: "12px", cursor: "pointer", borderRadius: "999px",
                      border: `1px solid ${category === c.id ? "#0A0A0A" : "#ddd"}`, background: category === c.id ? "#0A0A0A" : "#fff", color: category === c.id ? "#fff" : "#444",
                    }}>{c.label}</button>
                  ))}
                </div>
                <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} rows={5}
                  placeholder="예) 컴카드에 사진을 올릴 때 순서를 바꾸기 어려워요"
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px", border: "1px solid #ddd", fontSize: "14px", lineHeight: 1.6, resize: "vertical", fontFamily: "inherit" }} />
                <p style={{ fontSize: "11px", color: "#aaa", textAlign: "right", margin: "4px 0 12px" }}>{message.length}/2000</p>
                {state === "error" && <p style={{ fontSize: "12px", color: "#c00", marginBottom: "10px" }}>{error}</p>}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={send} disabled={state === "sending" || message.trim().length < 2} style={{
                    flex: 2, padding: "12px", border: "none", fontSize: "12px", letterSpacing: "0.06em", cursor: "pointer",
                    background: message.trim().length < 2 ? "#ccc" : "#0A0A0A", color: "#fff",
                  }}>{state === "sending" ? "보내는 중..." : "보내기"}</button>
                  <button onClick={close} style={{ flex: 1, padding: "12px", background: "#fff", border: "1px solid #ddd", fontSize: "12px", cursor: "pointer" }}>취소</button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
