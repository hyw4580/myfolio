import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import RenewalBoard, { type RenewalItem } from "./RenewalBoard";
import ConceptPanel, { type ConceptStats } from "./ConceptPanel";
import { conceptCatalog } from "@/lib/photo-concepts-server";

export const metadata = { title: "리뉴얼 승인 | myfolio 관리자", robots: { index: false } };

/** 지난 7일 범위 (요청 시점 기준) */
function lastWeek() {
  const to = new Date();
  return { from: new Date(to.getTime() - 7 * 86_400_000).toISOString(), to: to.toISOString() };
}

type Check = { name: string; ok: boolean; warn?: boolean; detail?: string };
type ErrTop = { message: string; path: string | null; source: string; count: number; devices: number; new: boolean };

/** 운영자 전용: 안정화 제안·새 기능 기획서 승인 + 기능 아이디어함 + 자체 점검·오류 현황 */
export default async function AdminRenewalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) notFound();
  const admin = createAdminClient();
  if (!admin) return <div style={{ padding: "60px 24px", textAlign: "center" }}>서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 필요해요.</div>;

  const { from: weekAgo, to: nowIso } = lastWeek();
  const [{ data: items }, { data: health }, { data: errs }, { data: cstats }, catalog] = await Promise.all([
    admin.from("renewal_items").select("*").order("created_at", { ascending: false }).limit(200),
    admin.from("health_checks").select("ok, results, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.rpc("error_summary", { p_from: weekAgo, p_to: nowIso }),
    admin.rpc("concept_stats", { p_days: 180 }),
    conceptCatalog(admin),
  ]);
  const checks = ((health?.results as { checks?: Check[] } | null)?.checks ?? []);
  const errors = (errs as { total: number; top: ErrTop[] } | null);

  return (
    <div style={{ background: "#fafafa", minHeight: "100vh", color: "#111" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid #eee", background: "#fff", flexWrap: "wrap", gap: "10px" }}>
        <div><Link href="/" className="font-display" style={{ fontSize: "22px", color: "#111", textDecoration: "none" }}>myfolio</Link> <span style={{ fontSize: "12px", color: "#999", marginLeft: "8px" }}>관리자 · 리뉴얼 승인</span></div>
        <nav style={{ display: "flex", gap: "14px", fontSize: "13px" }}>
          <Link href="/admin/voc" style={{ color: "#555" }}>주간 보고서</Link>
          <span style={{ color: "#111", fontWeight: 600 }}>리뉴얼 승인</span>
        </nav>
      </header>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "28px 20px 60px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: "28px" }} className="admin-voc-grid">
        <main>
          <RenewalBoard items={(items ?? []) as RenewalItem[]} />
          <ConceptPanel stats={cstats as ConceptStats | null} catalog={catalog} />
        </main>

        <aside>
          <h3 style={{ fontSize: "12px", letterSpacing: "0.1em", color: "#888", marginBottom: "8px" }}>
            최근 자체 점검 {health ? `· ${new Date(health.created_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
          </h3>
          <div style={{ background: "#fff", border: "1px solid #eee", padding: "10px 12px", marginBottom: "24px", fontSize: "12px", lineHeight: 1.8 }}>
            {checks.length === 0 && <p style={{ color: "#aaa" }}>아직 점검 기록이 없어요. 매일 오전 9시 30분에 자동으로 점검해요.</p>}
            {checks.map(c => (
              <p key={c.name}>{c.ok ? (c.warn ? "🟡" : "🟢") : "🔴"} {c.name} <span style={{ color: "#999" }}>{c.detail ?? ""}</span></p>
            ))}
          </div>

          <h3 style={{ fontSize: "12px", letterSpacing: "0.1em", color: "#888", marginBottom: "8px" }}>지난 7일 오류 {errors ? `· ${errors.total}건` : ""}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {(!errors || errors.top.length === 0) && <p style={{ fontSize: "13px", color: "#aaa" }}>없어요.</p>}
            {errors?.top.map((e, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #eee", padding: "8px 10px", fontSize: "12px" }}>
                <p style={{ color: "#999", marginBottom: "2px" }}>{e.new && <b style={{ color: "#c62828" }}>NEW · </b>}{e.source === "server" ? "서버" : "화면"} · {e.path ?? "-"} · {e.count}회 · {e.devices}기기</p>
                <p style={{ wordBreak: "break-word" }}>{e.message}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
