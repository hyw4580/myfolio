"use client";
import { useState } from "react";

/** 회원 탈퇴 (앱 스토어 필수). "탈퇴"를 직접 입력해야 진행돼서 실수로 누를 수 없음 */
export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true); setError(null);
    const res = await fetch("/api/account/delete", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: text.trim() }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(j.error ?? "탈퇴하지 못했어요."); return; }
    alert("탈퇴가 완료됐어요. 그동안 이용해 주셔서 감사합니다.");
    window.location.href = "/";
  };

  return (
    <section style={{ marginTop: "56px", paddingTop: "28px", borderTop: "1px solid var(--border)" }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ fontSize: "12px", color: "var(--muted)", background: "none", border: "none", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
          회원 탈퇴
        </button>
      ) : (
        <div style={{ border: "1px solid #f0c9c9", background: "#fff8f8", padding: "20px 22px", maxWidth: "480px" }}>
          <p style={{ fontSize: "14px", color: "#111", marginBottom: "10px" }}>정말 탈퇴할까요?</p>
          <ul style={{ fontSize: "12px", color: "#666", lineHeight: 1.8, paddingLeft: "18px", marginBottom: "14px" }}>
            <li>컴카드, 사진, 영상, 프로필이 모두 삭제되고 되돌릴 수 없어요.</li>
            <li>내 명함·공유 링크가 더 이상 열리지 않아요.</li>
            <li>구독 중이면 다음 결제가 멈추고, 남은 기간은 환불되지 않아요.</li>
            <li>결제 기록은 법에 따라 5년간 보관돼요(개인 연결 정보 없이).</li>
          </ul>
          <p style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>계속하려면 <b>탈퇴</b>라고 입력하세요.</p>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="탈퇴"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box", marginBottom: "10px" }} />
          {error && <p style={{ fontSize: "12px", color: "#c00", marginBottom: "10px" }}>{error}</p>}
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={remove} disabled={busy || text.trim() !== "탈퇴"} style={{
              flex: 1, padding: "11px", fontSize: "12px", border: "none", cursor: busy ? "wait" : "pointer",
              background: text.trim() === "탈퇴" ? "#c62828" : "#e8b4b4", color: "#fff",
            }}>{busy ? "탈퇴 처리 중..." : "탈퇴하기"}</button>
            <button onClick={() => { setOpen(false); setText(""); setError(null); }} style={{ flex: 1, padding: "11px", fontSize: "12px", background: "#fff", border: "1px solid #ddd", cursor: "pointer" }}>취소</button>
          </div>
        </div>
      )}
    </section>
  );
}
