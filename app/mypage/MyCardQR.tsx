"use client";
import { useState } from "react";
import { track } from "@/lib/analytics";

/**
 * 내 명함 QR: 오디션·촬영 현장에서 휴대폰 화면을 보여주면 상대가 찍어서 바로 내 명함(포트폴리오)으로.
 * 이미지로 저장해 인쇄 컴카드 뒷면에 넣을 수도 있다.
 */
export default function MyCardQR({ path, name }: { path: string; name: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  const open = async () => {
    track("qr_opened", {});
    const full = `${window.location.origin}${path}`;
    const QRCode = (await import("qrcode")).default;
    const data = await QRCode.toDataURL(full, { width: 720, margin: 2, color: { dark: "#0A0A0A", light: "#FFFFFF" }, errorCorrectionLevel: "M" });
    setUrl(full);
    setQr(data);
  };

  const save = () => {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `myfolio-qr-${(name || "card").replace(/[^A-Za-z0-9_-]+/g, "_")}.png`;
    a.click();
  };

  return (
    <>
      <button onClick={open} style={{ padding: "12px 16px", fontSize: "12px", letterSpacing: "0.06em", border: "1px solid var(--border)", background: "#fff", color: "var(--text)", cursor: "pointer", width: "100%" }}>
        ▣ 내 명함 QR 보기
      </button>
      {qr && (
        <div onClick={() => setQr(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: "360px", padding: "28px 24px 22px", textAlign: "center" }}>
            <p style={{ fontSize: "10px", letterSpacing: "0.24em", color: "#999", textTransform: "uppercase", marginBottom: "6px" }}>myfolio</p>
            <p className="font-display" style={{ fontSize: "24px", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{name || "My Card"}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="내 명함 QR 코드" style={{ width: "100%", maxWidth: "280px", aspectRatio: "1", display: "block", margin: "0 auto" }} />
            <p style={{ fontSize: "11px", color: "#888", marginTop: "10px", wordBreak: "break-all" }}>{url.replace(/^https?:\/\//, "")}</p>
            <p style={{ fontSize: "11px", color: "#aaa", marginTop: "6px" }}>카메라로 찍으면 내 명함이 열려요</p>
            <div style={{ display: "flex", gap: "6px", marginTop: "18px" }}>
              <button onClick={save} style={{ flex: 1, padding: "11px", fontSize: "12px", background: "#0A0A0A", color: "#fff", border: "none", cursor: "pointer" }}>이미지로 저장</button>
              <button onClick={() => setQr(null)} style={{ flex: 1, padding: "11px", fontSize: "12px", background: "#fff", color: "#333", border: "1px solid #ddd", cursor: "pointer" }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
