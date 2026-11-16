import Link from "next/link";
import Nav from "./Nav";
import { BUSINESS, LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export type LegalSection = { title: string; body: (string | string[])[] };

/** 약관·개인정보처리방침·환불정책 공통 화면 */
export default function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />
      <main style={{ maxWidth: "760px", margin: "0 auto", padding: "120px 24px 80px", color: "var(--text)" }}>
        <p style={{ fontSize: "11px", letterSpacing: "0.2em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "8px" }}>Policy</p>
        <h1 className="font-display" style={{ fontSize: "36px", fontWeight: 400, marginBottom: "10px" }}>{title}</h1>
        <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "28px" }}>시행일 {LEGAL_EFFECTIVE_DATE}</p>
        <p style={{ fontSize: "14px", lineHeight: 1.8, marginBottom: "32px" }}>{intro}</p>
        {sections.map((s, i) => (
          <section key={i} style={{ marginBottom: "28px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "10px" }}>{s.title}</h2>
            {s.body.map((b, j) => Array.isArray(b)
              ? <ul key={j} style={{ paddingLeft: "20px", margin: "0 0 10px", fontSize: "14px", lineHeight: 1.8 }}>{b.map((li, k) => <li key={k}>{li}</li>)}</ul>
              : <p key={j} style={{ fontSize: "14px", lineHeight: 1.8, marginBottom: "10px" }}>{b}</p>)}
          </section>
        ))}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "20px", marginTop: "40px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.8 }}>
          <p>{BUSINESS.companyName} · 대표 {BUSINESS.ceo} · 사업자등록번호 {BUSINESS.bizNumber} · 통신판매업 {BUSINESS.mailOrderNumber}</p>
          <p>{BUSINESS.address} · {BUSINESS.email} · {BUSINESS.phone}</p>
          <p style={{ marginTop: "10px" }}>
            <Link href="/terms" style={{ color: "inherit" }}>이용약관</Link> · <Link href="/privacy" style={{ color: "inherit" }}>개인정보처리방침</Link> · <Link href="/refund" style={{ color: "inherit" }}>환불정책</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
