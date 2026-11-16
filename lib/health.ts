import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendReportEmail } from "./voc";

export type CheckResult = { name: string; ok: boolean; ms: number; detail?: string; warn?: boolean };

async function timed(name: string, fn: () => Promise<string | void>, warnOnly = false): Promise<CheckResult> {
  const t = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, ms: Date.now() - t, detail: detail || undefined };
  } catch (e) {
    return { name, ok: warnOnly, warn: warnOnly || undefined, ms: Date.now() - t, detail: e instanceof Error ? e.message.slice(0, 200) : "실패" };
  }
}

/** 주소를 열어 기대한 응답 코드인지 확인 */
const page = (base: string, path: string, expect: number[] = [200]) => async () => {
  const res = await fetch(`${base}${path}`, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!expect.includes(res.status)) throw new Error(`${path} → ${res.status} (기대 ${expect.join("/")})`);
  return `${res.status}`;
};

/**
 * 매일 자체 점검 — 사이트가 정상인지 서버가 스스로 확인
 * 화면·API 응답, DB·사진 저장소 연결, 필수 설정, 지난 24시간 새 오류
 */
export async function runHealthCheck(admin: SupabaseClient, base: string) {
  const env = (k: string) => !!process.env[k];
  const checks = await Promise.all([
    timed("홈 화면", page(base, "/")),
    timed("로그인 화면", page(base, "/login")),
    timed("약관 화면", page(base, "/terms")),
    timed("컴카드(로그인 필요 → 로그인으로 이동)", page(base, "/comcard", [307, 308, 302])),
    timed("양식 순위 API(로그인 필요 → 401)", page(base, "/api/comcard/insights?canvas=portrait&count=4", [401])),
    timed("DB 연결", async () => {
      const { count, error } = await admin.from("profiles").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `회원 ${count ?? 0}명`;
    }),
    timed("사진 저장소", async () => {
      const { error } = await admin.storage.from("snaps").list("", { limit: 1 });
      if (error) throw new Error(error.message);
    }),
    timed("결제 설정(토스 키)", async () => { if (!env("TOSS_SECRET_KEY") || !env("NEXT_PUBLIC_TOSS_CLIENT_KEY")) throw new Error("토스 키 없음"); }, true),
    timed("AI 설정(Anthropic 키)", async () => { if (!env("ANTHROPIC_API_KEY")) throw new Error("AI 키 없음 — AI 추천·주간 분석 꺼짐"); }, true),
    timed("메일 설정(Resend)", async () => { if (!env("RESEND_API_KEY") || !env("REPORT_EMAIL")) throw new Error("메일 키 없음 — 보고서 메일 안 감"); }, true),
    timed("결제 실패 회원", async () => {
      const { count } = await admin.from("subscriptions").select("user_id", { count: "exact", head: true }).eq("status", "past_due");
      if ((count ?? 0) > 0) throw new Error(`결제 재시도 중 ${count}명`);
    }, true),
  ]);

  // 지난 24시간 오류
  const to = new Date(), from = new Date(to.getTime() - 24 * 3600_000);
  const { data: errs } = await admin.rpc("error_summary", { p_from: from.toISOString(), p_to: to.toISOString() });
  const top = ((errs as { top?: { new: boolean; count: number; message: string; path: string | null; source: string }[] } | null)?.top) ?? [];
  const fresh = top.filter(e => e.new);
  checks.push({
    name: "지난 24시간 오류", ok: fresh.length === 0, ms: 0,
    detail: top.length ? `${(errs as { total: number }).total}건 (새 오류 ${fresh.length}종)` : "없음",
    warn: top.length > 0 && fresh.length === 0 ? true : undefined,
  });

  const ok = checks.every(c => c.ok);
  await admin.from("health_checks").insert({ ok, results: { checks, newErrors: fresh.slice(0, 5) } });

  // 문제가 있으면 바로 메일 (경고만 있으면 주간 보고에서 다룸)
  if (!ok) {
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    const html = `<div style="font-family:-apple-system,sans-serif;max-width:600px">
      <h2>myfolio 자체 점검: 문제 발견</h2>
      <ul>${checks.filter(c => !c.ok).map(c => `<li><b>${esc(c.name)}</b> — ${esc(c.detail ?? "실패")}</li>`).join("")}</ul>
      ${fresh.length ? `<h3>새로 생긴 오류</h3><ul>${fresh.slice(0, 5).map(e => `<li>[${e.source}] ${esc(e.message)} · ${esc(e.path ?? "-")} · ${e.count}회</li>`).join("")}</ul>` : ""}
      <p><a href="${base}/admin/renewal">관리자 화면에서 보기</a> — 다음 주간 제안서에 수정 항목으로 올라가요.</p></div>`;
    await sendReportEmail("[myfolio] 자체 점검: 문제 발견", html);
  }
  return { ok, checks };
}
