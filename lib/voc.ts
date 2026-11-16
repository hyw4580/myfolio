import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { specPendingIdeas } from "./renewal";
import { BUILTIN_CONCEPTS } from "./photo-concepts";

/* ── AI 보고서 형식 ── */
const Theme = z.object({
  title: z.string().describe("주제 이름 (한국어, 짧게)"),
  type: z.enum(["bug", "inconvenience", "request", "praise", "other"]),
  severity: z.enum(["high", "medium", "low"]).describe("사용자 이탈·매출에 미치는 영향"),
  count: z.number().int().describe("이 주제에 해당하는 의견 수"),
  description: z.string().describe("무엇이 문제/요청인지 1~2문장"),
  quotes: z.array(z.string()).describe("대표 의견 원문 1~3개 (개인정보 제외, 80자 이내)"),
  suggestion: z.string().describe("구체적인 개선 방법 1~2문장"),
});
const Action = z.object({
  title: z.string().describe("이번 주에 할 일 (동사로 끝나게)"),
  why: z.string().describe("왜 우선인지 (근거: 의견 수·심각도·지표)"),
  effort: z.enum(["small", "medium", "large"]).describe("예상 작업 크기"),
});
const UsageInsight = z.object({
  bottleneck: z.string().describe("가입→컴카드 시작→사진→양식→저장→다운로드/공유 중 가장 많이 빠지는 단계와 추정 이유 (데이터 없으면 빈 문자열)"),
  editing: z.array(z.string()).describe("컴카드 편집 과정에서 보인 패턴 2~4개 (무엇을 많이 고치는지, 되돌리기·초기화, 체류 시간, 양식별 편집량)"),
  templates: z.string().describe("방향·장수·양식·AI 추천 선택 경향과 AI 추천이 실제로 도움이 됐는지 (데이터 없으면 빈 문자열)"),
});
/** 안정화 제안 (갈래 A) — 운영자 승인 후 Claude가 작업 */
export const Proposal = z.object({
  title: z.string().describe("할 일 (동사로 끝나게, 30자 이내)"),
  problem: z.string().describe("무엇이 문제인지 1~2문장"),
  evidence: z.string().describe("근거: 의견 몇 건, 오류 몇 회·몇 기기, 이탈률 등 숫자"),
  plan: z.string().describe("무엇을 어떻게 바꿀지 2~4문장 (개발자가 바로 작업할 수 있게 화면·기능 이름으로)"),
  risk: z.enum(["low", "medium", "high"]).describe("바꿨을 때 위험도. 결제·로그인·개인정보·데이터 삭제와 관련되면 high"),
  effort: z.enum(["small", "medium", "large"]),
});
export type ProposalT = z.infer<typeof Proposal>;

export const VocReport = z.object({
  headline: z.string().describe("이번 주 한 줄 요약"),
  summary: z.string().describe("전체 요약 3~5문장"),
  themes: z.array(Theme).describe("의견을 주제별로 묶은 것, 중요한 순"),
  actions: z.array(Action).describe("이번 주 개선 우선순위 Top 3"),
  liked: z.string().describe("사용자들이 좋아한 점 (없으면 빈 문자열)"),
  watch: z.array(z.string()).describe("아직 적지만 지켜봐야 할 신호"),
  usage: UsageInsight.describe("사용 패턴(행동 기록) 분석"),
  proposals: z.array(Proposal).describe("안정화 제안 0~5개 (오류 수정·불편 개선·작은 UX 개선). 이미 진행 중인 항목과 겹치면 제외"),
});
export type VocReportT = z.infer<typeof VocReport>;

export type VocMetrics = {
  feedback: number; byCategory: Record<string, number>;
  newUsers: number; cardsCreated: number; exports: number;
  newPayments: number; revenueKRW: number; activePro: number;
  /** 사용 패턴 집계 (usage_summary) — 기록 기능 설정 전이면 null */
  usage?: UsageSummary | null;
  /** 오류 요약 (error_summary) */
  errors?: { total: number; top: { message: string; path: string | null; source: string; count: number; devices: number; new: boolean }[] } | null;
  /** 이번 주 자체 점검에서 실패·경고였던 항목 */
  health?: { name: string; detail?: string; ok: boolean }[];
};
export type UsageSummary = {
  funnel?: Record<string, number>;
  editor?: { sessions?: number; median_seconds?: number | null; avg_edits?: number | null; edit_kinds?: Record<string, number> };
  signup?: { viewed?: number; completed?: number };
  retention?: { d7_cohort?: number; d7_return?: number; d7_edit?: number; d30_cohort?: number; d30_return?: number; d30_edit?: number };
  total_events?: number;
  [key: string]: unknown;
};

const CATEGORY_KO: Record<string, string> = { bug: "오류", inconvenience: "불편", request: "기능요청", praise: "칭찬", other: "기타" };

/** 개인정보(이메일·전화번호) 가리기 */
const redact = (t: string) => t
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[이메일]")
  .replace(/(\+?\d[\d\s-]{7,}\d)/g, "[전화번호]");

/** 기간 안의 개수 세기 (테이블이 아직 없으면 0) */
async function countSince(admin: SupabaseClient, table: string, from: string, to: string, extra?: (q: any) => any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = admin.from(table).select("*", { count: "exact", head: true }).gte("created_at", from).lt("created_at", to);
  if (extra) q = extra(q);
  const { count } = await q;
  return count ?? 0;
}

/** 지난 기간의 의견과 지표를 모아 AI 보고서를 만든다 */
export async function buildVocReport(admin: SupabaseClient, from: Date, to: Date) {
  const fromIso = from.toISOString(), toIso = to.toISOString();
  const { data: items } = await admin.from("feedback")
    .select("category, message, page, platform, created_at")
    .gte("created_at", fromIso).lt("created_at", toIso)
    .order("created_at", { ascending: true }).limit(800);
  const feedback = items ?? [];

  const byCategory: Record<string, number> = {};
  for (const f of feedback) byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;

  const { data: pays } = await admin.from("payments").select("amount").eq("status", "DONE").gte("created_at", fromIso).lt("created_at", toIso);
  const { count: activePro } = await admin.from("subscriptions").select("user_id", { count: "exact", head: true })
    .in("status", ["active", "past_due"]).gt("current_period_end", new Date().toISOString());
  const metrics: VocMetrics = {
    feedback: feedback.length, byCategory,
    newUsers: await countSince(admin, "profiles", fromIso, toIso),
    cardsCreated: await countSince(admin, "comp_cards", fromIso, toIso),
    exports: await countSince(admin, "comcard_exports", fromIso, toIso),
    newPayments: pays?.length ?? 0,
    revenueKRW: (pays ?? []).reduce((s, p) => s + (p.amount ?? 0), 0),
    activePro: activePro ?? 0,
  };
  // 사용 패턴 집계 (events 테이블·함수가 아직 없으면 null)
  const { data: usage, error: usageErr } = await admin.rpc("usage_summary", { p_from: fromIso, p_to: toIso });
  if (usageErr) console.warn("[voc] usage_summary unavailable:", usageErr.message);
  metrics.usage = (usage as UsageSummary | null) ?? null;
  const hasUsage = (metrics.usage?.total_events ?? 0) > 0;

  // 오류·자체 점검 (테이블이 아직 없으면 건너뜀)
  const { data: errs } = await admin.rpc("error_summary", { p_from: fromIso, p_to: toIso });
  metrics.errors = (errs as VocMetrics["errors"]) ?? null;
  const { data: checks } = await admin.from("health_checks").select("results").gte("created_at", fromIso).lt("created_at", toIso).order("created_at", { ascending: false }).limit(7);
  const bad = new Map<string, { name: string; detail?: string; ok: boolean }>();
  for (const c of checks ?? []) for (const r of ((c.results as { checks?: { name: string; ok: boolean; warn?: boolean; detail?: string }[] })?.checks ?? []))
    if ((!r.ok || r.warn) && !bad.has(r.name)) bad.set(r.name, { name: r.name, detail: r.detail, ok: r.ok });
  metrics.health = [...bad.values()];
  const hasErrors = (metrics.errors?.total ?? 0) > 0 || metrics.health.some(h => !h.ok);

  // 진행 중인 리뉴얼 항목 (같은 제안 반복 방지)
  const { data: open } = await admin.from("renewal_items").select("title, status").in("status", ["idea", "proposed", "approved", "held", "in_progress"]).limit(50);
  const openTitles = (open ?? []).map(o => `- ${o.title} (${o.status})`).join("\n");

  // 의견·사용 기록·오류가 모두 없으면 AI를 부르지 않음 (비용 절약)
  if ((feedback.length === 0 && !hasUsage && !hasErrors) || !process.env.ANTHROPIC_API_KEY) return { metrics, report: null as VocReportT | null, feedbackCount: feedback.length };

  const lines = feedback.map((f, i) =>
    `${i + 1}. [${CATEGORY_KO[f.category] ?? f.category}][${f.platform ?? "web"}][${f.page ?? "-"}] ${redact(f.message).replace(/\s+/g, " ").slice(0, 600)}`);

  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(VocReport) },
    system: `당신은 모델 컴카드·디지털 명함 서비스 "myfolio"의 프로덕트 매니저입니다.
지난 1주일 동안 사용자가 보낸 의견(VOC)과 서비스 지표를 보고, 대표에게 보낼 주간 개선 보고서를 씁니다.

원칙:
- 비슷한 의견은 하나의 주제로 묶고, 의견 수(count)는 실제로 해당하는 의견 개수로 정확히 세세요.
- severity는 사용자 이탈·결제·핵심 기능(컴카드 만들기, 명함 공유)에 미치는 영향으로 판단하세요. 오류(bug)는 보통 높게.
- actions는 정확히 3개 이하, 이번 주에 실제로 할 수 있는 구체적인 일로. 근거(의견 수·심각도·지표)를 why에 쓰세요.
- quotes는 의견 원문에서 그대로 짧게 인용하고, 개인정보는 넣지 마세요.
- 한 명이 반복한 의견이나 장난성 의견은 비중을 낮추세요.
- 쉬운 한국어로, 개발 용어 없이 쓰세요. (proposals의 plan만은 개발자가 작업할 수 있게 화면·기능 이름을 구체적으로)
- proposals(안정화 제안): 오류·불편·이탈 원인을 고치는 작고 안전한 작업 위주로 0~5개. 반복되거나 새로 생긴 오류, 여러 명이 겪는 불편을 우선하세요. 큰 새 기능은 넣지 말고 actions나 watch에 적으세요. "진행 중인 항목"과 겹치면 넣지 마세요. 가격·약관·결제 규칙 변경은 제안하지 마세요(운영자가 직접 결정).
- "오류" 데이터의 new=true는 이번 주에 처음 생긴 오류입니다. 같은 오류가 여러 기기에서 반복되면 high severity로 보세요.
- "사용 패턴" JSON은 실제 행동 기록입니다. 의견이 적어도 행동 기록에서 문제를 찾으세요 (예: 사진 단계에서 많이 이탈, 특정 양식은 편집량이 많음 = 기본 배치가 마음에 안 듦, 되돌리기가 잦음 = 프리셋이 기대와 다름, AI 추천으로 시작한 사람이 다운로드까지 더 많이 감 등).
- 숫자가 너무 작으면(예: 10명 미만) 결론을 단정하지 말고 "지켜볼 신호"로 두세요.
- 의견이 없으면 themes는 빈 배열로 두고, actions는 행동 기록 근거로만 쓰세요.
- 사용 패턴 용어: funnel(visited 방문, signed_up 가입, started_card 컴카드 시작, uploaded_photos 사진 올림, chose_template 양식 선택, saved_card 저장, downloaded_or_shared 다운로드·공유, subscribed 결제), editor.edit_kinds(photo_move 사진 이동, photo_resize 사진 크기, text_move 글자 이동, text_size 글자 크기, bg_color 배경색, text_color 글자색, font_weight 굵기, name_caps 대문자, stats_layout 신체정보 단, photo_add/remove/replace 사진 추가·삭제·교체, field_toggle 표시 항목, preset_apply 프리셋 바꾸기, ai_apply AI안 적용, undo 되돌리기, reset 초기화), editor.by_source(ai/preset/default/reopen 시작 방식별), signup(viewed 가입 화면 본 기기, completed 가입 완료 — 가입 완료율), retention(d7_cohort 7~14일 전 가입자 수, d7_return 가입 후 7일 안에 다시 온 수, d7_edit 7일 안에 컴카드를 다시 고친 수, d30_* 같은 방식으로 30~60일 전 가입자의 30일 기준).`,
    messages: [{
      role: "user",
      content: `기간: ${from.toLocaleDateString("ko-KR")} ~ ${new Date(to.getTime() - 1).toLocaleDateString("ko-KR")}
지표: 신규 가입 ${metrics.newUsers}명, 컴카드 생성 ${metrics.cardsCreated}개, 다운로드 ${metrics.exports}회, 신규 결제 ${metrics.newPayments}건(${metrics.revenueKRW.toLocaleString("ko-KR")}원), 현재 Pro ${metrics.activePro}명
사용 패턴(행동 기록 집계): ${hasUsage ? JSON.stringify(metrics.usage) : "(아직 기록 없음)"}
오류(이번 주): ${metrics.errors?.total ? JSON.stringify(metrics.errors) : "(없음)"}
자체 점검 문제: ${metrics.health.length ? JSON.stringify(metrics.health) : "(없음)"}
진행 중인 항목:
${openTitles || "(없음)"}
의견 ${feedback.length}개:
${lines.join("\n") || "(없음)"}`,
    }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`AI 분석 실패: ${response.stop_reason}`);
  return { metrics, report: response.parsed_output, feedbackCount: feedback.length };
}

/** 보고서를 이메일 본문(HTML)으로 */
export function reportEmailHtml(r: VocReportT | null, m: VocMetrics, period: string, adminUrl: string, renewal?: { proposals: number; ideas: number; concepts?: number; url: string }): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const sev: Record<string, string> = { high: "🔴 높음", medium: "🟠 보통", low: "⚪ 낮음" };
  const eff: Record<string, string> = { small: "작음", medium: "보통", large: "큼" };
  const approve = renewal && renewal.proposals + renewal.ideas + (renewal.concepts ?? 0) > 0
    ? `<p style="background:#111;color:#fff;padding:12px 14px;font-size:14px">승인 대기: 안정화 제안 <b>${renewal.proposals}</b>건 · 새 기능 기획서 <b>${renewal.ideas}</b>건${renewal.concepts ? ` · 새 촬영 컨셉 후보 <b>${renewal.concepts}</b>개` : ""} → <a style="color:#fff" href="${renewal.url}">검토하고 승인하기</a><br><span style="font-size:12px;color:#bbb">승인한 항목은 화요일 오전에 작업을 시작해요.</span></p>` : "";
  const errRow = m.errors?.total ? ` · 오류 <b>${m.errors.total}</b>` : "";
  const metricsRow = `신규 가입 <b>${m.newUsers}</b> · 컴카드 <b>${m.cardsCreated}</b> · 다운로드 <b>${m.exports}</b> · 결제 <b>${m.newPayments}건 ${m.revenueKRW.toLocaleString("ko-KR")}원</b> · Pro <b>${m.activePro}</b> · 의견 <b>${m.feedback}</b>${errRow}`;
  if (!r) return `<div style="font-family:sans-serif;max-width:640px"><h2>myfolio 주간 보고 (${period})</h2>${approve}<p>${metricsRow}</p><p>이번 주에는 들어온 의견이 없어요.</p><p><a href="${adminUrl}">관리자 페이지에서 보기</a></p></div>`;
  return `<div style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:640px;color:#111;line-height:1.6">
  <p style="color:#999;font-size:12px;margin:0">myfolio 주간 VOC 보고 · ${period}</p>
  <h2 style="margin:6px 0 10px">${esc(r.headline)}</h2>
  ${approve}
  <p style="background:#f6f6f6;padding:10px 12px;font-size:13px">${metricsRow}</p>
  <p>${esc(r.summary)}</p>
  <h3>이번 주 개선 우선순위</h3>
  <ol>${r.actions.map(a => `<li style="margin-bottom:8px"><b>${esc(a.title)}</b> <span style="color:#888;font-size:12px">(작업 ${eff[a.effort]})</span><br><span style="color:#555;font-size:13px">${esc(a.why)}</span></li>`).join("")}</ol>
  <h3>주제별 의견</h3>
  ${r.themes.map(t => `<div style="border:1px solid #eee;padding:10px 12px;margin-bottom:8px"><b>${esc(t.title)}</b> · ${sev[t.severity]} · ${t.count}건<br><span style="font-size:13px">${esc(t.description)}</span>${t.quotes.length ? `<br><span style="font-size:12px;color:#777">“${t.quotes.map(esc).join("” / “")}”</span>` : ""}<br><span style="font-size:13px;color:#2a6">→ ${esc(t.suggestion)}</span></div>`).join("")}
  ${r.usage && (r.usage.bottleneck || r.usage.editing.length || r.usage.templates) ? `<h3>사용 패턴</h3>
  ${r.usage.bottleneck ? `<p><b>가장 많이 빠지는 곳</b><br>${esc(r.usage.bottleneck)}</p>` : ""}
  ${r.usage.editing.length ? `<p><b>컴카드 편집 패턴</b></p><ul>${r.usage.editing.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
  ${r.usage.templates ? `<p><b>양식·AI 추천</b><br>${esc(r.usage.templates)}</p>` : ""}` : ""}
  ${r.liked ? `<h3>좋았던 점</h3><p>${esc(r.liked)}</p>` : ""}
  ${r.watch.length ? `<h3>지켜볼 신호</h3><ul>${r.watch.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
  <p><a href="${adminUrl}">관리자 페이지에서 전체 보기</a></p>
</div>`;
}

/** 이메일 보내기 (Resend) — RESEND_API_KEY · REPORT_EMAIL 설정 시 */
export async function sendReportEmail(subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY, to = process.env.REPORT_EMAIL;
  if (!key || !to) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.REPORT_FROM ?? "myfolio <onboarding@resend.dev>", to: to.split(",").map(s => s.trim()), subject, html }),
  });
  if (!res.ok) console.error("[voc] email failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}

/** 지난 7일 보고서 생성 → 저장 → 이메일 (매주 자동 실행 + 관리자 "지금 분석") */
export async function runWeeklyVoc(admin: SupabaseClient, siteUrl: string) {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { metrics, report, feedbackCount } = await buildVocReport(admin, from, to);
  // 180일 지난 사용 기록 정리 (실패해도 보고는 계속)
  const { error: purgeErr } = await admin.rpc("purge_old_events");
  if (purgeErr) console.warn("[voc] purge_old_events:", purgeErr.message);
  await admin.rpc("purge_old_errors");
  await admin.rpc("purge_old_ai");
  const { data: row, error } = await admin.from("voc_reports")
    .insert({ period_start: from.toISOString(), period_end: to.toISOString(), feedback_count: feedbackCount, metrics, report })
    .select("id").single();
  if (error) throw error;

  // 안정화 제안 → 리뉴얼 항목(승인 대기)으로 등록, 새 아이디어 → 기획서 작성
  const proposals = report?.proposals ?? [];
  if (proposals.length) {
    const { error: pErr } = await admin.from("renewal_items").insert(proposals.map(p => ({
      lane: "stabilize", source: "ai", status: "proposed", report_id: row.id,
      title: p.title, problem: p.problem, evidence: p.evidence, plan: p.plan, risk: p.risk, effort: p.effort, stage: "MODEL",
    })));
    if (pErr) console.error("[voc] renewal insert", pErr.message);
  }
  const specced = await specPendingIdeas(admin).catch(e => { console.error("[voc] idea spec", e); return 0; });
  // 사용자들이 직접 입력한 촬영 컨셉 중 5명 이상 쓴 것 → 목록 추가 후보
  const [{ data: cst }, { data: extra }] = await Promise.all([admin.rpc("concept_stats", { p_days: 180 }), admin.from("photo_concepts").select("label")]);
  const knownLabels = new Set([...BUILTIN_CONCEPTS.map(c => c.label), ...(extra ?? []).map(e => e.label)].map(l => l.toLowerCase()));
  const conceptCandidates = ((cst as { custom_candidates?: { label: string; users: number }[] } | null)?.custom_candidates ?? [])
    .filter(c => c.users >= 5 && !knownLabels.has(c.label)).length;

  const period = `${from.toLocaleDateString("ko-KR")} ~ ${to.toLocaleDateString("ko-KR")}`;
  const sent = await sendReportEmail(
    `[myfolio] 주간 보고 · 승인 대기 ${proposals.length + specced}건 · ${report?.headline ?? "의견 없음"}`,
    reportEmailHtml(report, metrics, period, `${siteUrl}/admin/voc`, { proposals: proposals.length, ideas: specced, concepts: conceptCandidates, url: `${siteUrl}/admin/renewal` }));
  if (sent) await admin.from("voc_reports").update({ emailed_at: new Date().toISOString() }).eq("id", row.id);
  return { id: row.id as number, feedbackCount, emailed: sent, proposals: proposals.length, ideasSpecced: specced };
}
