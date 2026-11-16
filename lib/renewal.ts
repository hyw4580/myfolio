import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 갈래 B — 운영자 아이디어를 기획서로 만들기
 * 아이디어(status: idea) → AI가 지금 서비스 상황(성장 단계·사용 데이터·의견)에 맞춰 기획 → proposed(승인 대기)
 */
const Spec = z.object({
  title: z.string().describe("기능 이름 (짧게)"),
  problem: z.string().describe("누구의 어떤 문제를 푸는지 1~2문장"),
  plan: z.string().describe("무엇을 만들지: 화면·흐름·데이터를 개발자가 바로 작업할 수 있게 4~8문장. 꼭 필요한 최소 범위(1차)와 나중에 할 것(2차)을 나눠서"),
  evidence: z.string().describe("근거: 관련 의견·사용 데이터·업계 사례. 데이터가 없으면 '데이터 없음 — 출시 후 확인할 지표: ...'"),
  stage: z.enum(["MODEL", "CONNECT", "PLATFORM"]).describe("성장 단계 중 어디에 해당하는지"),
  fit_now: z.boolean().describe("지금 단계(MODEL: 모델 사용자 확보·재방문)에 맞아서 지금 하는 게 좋은지"),
  fit_reason: z.string().describe("지금 할지/나중에 할지 이유 1문장"),
  risk: z.enum(["low", "medium", "high"]).describe("결제·로그인·개인정보·데이터 구조를 건드리면 high"),
  effort: z.enum(["small", "medium", "large"]),
});

const SYSTEM = `당신은 모델 컴카드·디지털 명함 서비스 "myfolio"의 프로덕트 매니저입니다.
운영자가 적은 기능 아이디어를 개발 가능한 기획서로 만듭니다.

서비스 현황:
- 지금 있는 것: 컴카드 만들기(방향·장수·7개 양식·AI 추천·편집), 디지털 명함(개인 주소·QR·연락처 저장), 포트폴리오(갤러리·스냅·영상·경력, 명함 링크로만 공개), Pro 구독(월 4,900원/연 39,000원), 의견 보내기, 주간 AI 분석
- 성장 순서: 1) MODEL 모델 사용자 확보·재방문 (지금 집중) → 2) CONNECT 사진가·에이전시·브랜드 유입·검색·캐스팅 → 3) PLATFORM 매칭·계약·결제·리뷰
- 공개 모델 목록(갤러리)은 지금 막아 둠. 웹 + iOS/Android 앱(같은 화면) 동시 지원

원칙:
- 1차 범위는 1~2주 안에 만들 수 있게 작게. 큰 아이디어는 1차/2차로 나누세요.
- 지금 단계에 안 맞으면 fit_now=false로 하고 이유를 쓰세요(운영자가 보류할지 결정).
- 개인정보·앱 마켓 정책(앱 내 결제)·저작권(사진) 문제가 있으면 plan에 꼭 적으세요.
- 쉬운 한국어로 쓰세요.`;

export async function specIdea(admin: SupabaseClient, id: number): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  const { data: item } = await admin.from("renewal_items").select("id, title, problem, owner_note").eq("id", id).maybeSingle();
  if (!item) return false;

  // 참고 자료: 최근 기능 요청 의견, 최근 주간 보고 요약
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [{ data: reqs }, { data: rep }] = await Promise.all([
    admin.from("feedback").select("message").eq("category", "request").gte("created_at", since).order("created_at", { ascending: false }).limit(40),
    admin.from("voc_reports").select("report, metrics").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const redact = (t: string) => t.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[이메일]").replace(/(\+?\d[\d\s-]{7,}\d)/g, "[번호]");
  const context = [
    `운영자 아이디어: ${item.title}`,
    item.problem ? `설명: ${item.problem}` : "",
    item.owner_note ? `운영자 메모: ${item.owner_note}` : "",
    `최근 기능 요청 의견(${reqs?.length ?? 0}건):\n${(reqs ?? []).map(r => `- ${redact(r.message).slice(0, 200)}`).join("\n") || "(없음)"}`,
    rep?.report ? `최근 주간 보고 요약: ${(rep.report as { summary?: string }).summary ?? ""}` : "",
    rep?.metrics ? `최근 지표: ${JSON.stringify({ funnel: (rep.metrics as { usage?: { funnel?: unknown } }).usage?.funnel ?? null })}` : "",
  ].filter(Boolean).join("\n\n");

  const client = new Anthropic();
  const res = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(Spec) },
    system: SYSTEM,
    messages: [{ role: "user", content: context }],
  });
  const s = res.parsed_output;
  if (res.stop_reason === "refusal" || !s) return false;
  const { error } = await admin.from("renewal_items").update({
    title: s.title, problem: s.problem, plan: s.plan,
    evidence: `${s.evidence}\n\n[단계 판단] ${s.fit_now ? "지금 하기 좋음" : "나중에 권장"} — ${s.fit_reason}`,
    stage: s.stage, risk: s.risk, effort: s.effort, status: "proposed", updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "idea");
  return !error;
}

/** 아직 기획서가 없는 아이디어 모두 처리 (주간 작업) — 처리한 개수 */
export async function specPendingIdeas(admin: SupabaseClient): Promise<number> {
  const { data: ideas } = await admin.from("renewal_items").select("id").eq("status", "idea").order("created_at").limit(10);
  let n = 0;
  for (const i of ideas ?? []) if (await specIdea(admin, i.id)) n++;
  return n;
}
