import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import type { VocMetrics, VocReportT } from "@/lib/voc";
import VocReportView from "./VocReportView";
import RunNowButton from "./RunNowButton";

export const metadata = { title: "VOC 보고서 | myfolio 관리자", robots: { index: false } };

const CAT = { bug: "오류", inconvenience: "불편", request: "기능요청", praise: "칭찬", other: "기타" } as Record<string, string>;
const fmt = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });

/** 운영자 전용: 주간 AI VOC 보고서 + 최근 의견 */
export default async function AdminVocPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) notFound(); // 관리자 외에는 페이지가 있는지도 모르게

  const admin = createAdminClient();
  if (!admin) {
    return <div style={{ padding: "60px 24px", textAlign: "center" }}>서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 필요해요.</div>;
  }
  const { id } = await searchParams;
  const [{ data: reports }, { data: recent }] = await Promise.all([
    admin.from("voc_reports").select("id, period_start, period_end, feedback_count, metrics, report, emailed_at, created_at").order("created_at", { ascending: false }).limit(20),
    admin.from("feedback").select("id, category, message, page, platform, created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const current = (reports ?? []).find(r => String(r.id) === id) ?? reports?.[0];

  return (
    <div style={{ background: "#fafafa", minHeight: "100vh", color: "#111" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid #eee", background: "#fff", flexWrap: "wrap", gap: "10px" }}>
        <div><Link href="/" className="font-display" style={{ fontSize: "22px", color: "#111", textDecoration: "none" }}>myfolio</Link> <span style={{ fontSize: "12px", color: "#999", marginLeft: "8px" }}>관리자 · VOC 보고서</span></div>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <Link href="/admin/renewal" style={{ fontSize: "13px", color: "#111" }}>리뉴얼 승인 →</Link>
          <RunNowButton />
        </div>
      </header>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "28px 20px 60px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: "28px" }} className="admin-voc-grid">
        <main>
          {current
            ? <VocReportView report={current.report as VocReportT | null} metrics={current.metrics as VocMetrics} period={`${fmt(current.period_start)} ~ ${fmt(current.period_end)}${current.emailed_at ? " · 이메일 발송됨" : ""}`} />
            : <p style={{ color: "#888" }}>아직 보고서가 없어요. 매주 월요일 오전 9시에 자동으로 만들어지고, 위의 &quot;지금 분석하기&quot;로 바로 만들 수도 있어요.</p>}
        </main>

        <aside>
          <h3 style={{ fontSize: "12px", letterSpacing: "0.1em", color: "#888", marginBottom: "8px" }}>지난 보고서</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "28px" }}>
            {(reports ?? []).map(r => (
              <Link key={r.id} href={`/admin/voc?id=${r.id}`} style={{ fontSize: "13px", padding: "8px 10px", textDecoration: "none", color: "#111", background: r.id === current?.id ? "#fff" : "transparent", border: `1px solid ${r.id === current?.id ? "#ddd" : "transparent"}` }}>
                {fmt(r.period_start)} ~ {fmt(r.period_end)} <span style={{ color: "#999" }}>· 의견 {r.feedback_count}</span>
              </Link>
            ))}
          </div>

          <h3 style={{ fontSize: "12px", letterSpacing: "0.1em", color: "#888", marginBottom: "8px" }}>최근 들어온 의견</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {(recent ?? []).length === 0 && <p style={{ fontSize: "13px", color: "#aaa" }}>아직 없어요.</p>}
            {(recent ?? []).map(f => (
              <div key={f.id} style={{ background: "#fff", border: "1px solid #eee", padding: "10px 12px" }}>
                <p style={{ fontSize: "11px", color: "#999", marginBottom: "4px" }}>{CAT[f.category] ?? f.category} · {f.platform} · {f.page ?? "-"} · {fmt(f.created_at)}</p>
                <p style={{ fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{f.message}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
