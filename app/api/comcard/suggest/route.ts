import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiQuota, downscalePhoto, getCachedSuggestion, recordAiUse, saveSuggestion, suggestionKey } from "@/lib/ai-cost";
import { getPerformance } from "@/lib/comcard-insights";
import { rankTemplates, topStyles, type Performance } from "@/lib/comcard-ranking";
import { LAYOUT_TEMPLATES, availablePresets, presetOptions, type Preset } from "@/lib/comcard-layouts";

/* ── AI가 돌려줄 추천안 형식 ── */
const Suggestion = z.object({
  title: z.string().describe("추천안 이름 (한국어, 12자 이내)"),
  reason: z.string().describe("이 구성을 추천하는 이유 (한국어, 1~2문장)"),
  template: z.enum(LAYOUT_TEMPLATES).describe("고른 프리셋 id"),
  photoOrder: z.array(z.number().int()).describe("사진 번호 순서. 첫 번째가 메인 사진. 모든 번호를 한 번씩 포함"),
  bgColor: z.string().describe("배경색 #RRGGBB"),
  txtColor: z.string().describe("글자색 #RRGGBB"),
  fontWeight: z.enum(["300", "400", "500", "700"]),
  statsLayout: z.enum(["1단", "2단"]),
  nameSize: z.number().int().describe("영문 이름 글자 크기 px (16~40)"),
  nameCaps: z.boolean().describe("영문 이름을 대문자로 표시할지"),
});
export const PHOTO_TYPES = ["headshot", "half", "full", "profile", "lifestyle", "empty"] as const;
const SuggestionList = z.object({
  photoTypes: z.array(z.enum(PHOTO_TYPES)).describe("사진 번호 순서대로 각 사진의 컷 종류. 빈 칸은 empty"),
  defaultOrder: z.array(z.number().int()).describe("어떤 양식에든 쓸 기본 사진 순서. 첫 번째가 가장 좋은 대표(메인) 사진. 모든 번호를 한 번씩 포함"),
  suggestions: z.array(Suggestion),
});
export type ComcardSuggestion = z.infer<typeof Suggestion>;
export type PhotoType = (typeof PHOTO_TYPES)[number];
export type SuggestResponse = { photoTypes: PhotoType[]; defaultOrder: number[]; suggestions: ComcardSuggestion[]; cached?: boolean; remaining?: number | null };

const RequestBody = z.object({
  canvas: z.enum(["portrait", "landscape"]),
  photos: z.array(z.string().nullable()).max(10),
  name: z.string().max(80).optional(),
  fieldLabels: z.array(z.string().max(40)).max(20),
});

/** 이번 요청(방향·장수)에 쓸 수 있는 프리셋만 AI에게 알려줌 */
const presetGuide = (presets: Preset[]) => presets.map(p =>
  `- ${p.id} (${p.name}): ${p.description}. 근거: ${p.basis}. 언제: ${p.aiHint} ` +
  `기본 스타일: 배경 ${p.style.bgColor}, 글자 ${p.style.txtColor}, 굵기 ${p.style.fontWeight}, 이름 ${p.style.nameSize}px${p.style.nameCaps ? " 대문자" : ""}.`
).join("\n");

const systemPrompt = (presets: Preset[], userData: string) => `당신은 모델 에이전시의 컴카드(comp card) 아트 디렉터입니다.
모델의 사진과 정보를 보고, 아래 업계 표준 프리셋 중에서 이 모델에게 가장 어울리는 구성 3가지를 골라 조정해 제안합니다.

프리셋 (반드시 이 중에서 template을 고르세요):
${presetGuide(presets)}
${userData}

업계 공통 규칙 (에이전시 가이드·유럽 제드카드 관행):
- 메인 사진은 얼굴이 잘 보이는 헤드샷이나 상반신으로 고르세요. 전신 사진은 메인으로 거의 쓰지 않습니다.
- 보조 컷은 서로 다른 룩(클로즈업, 상반신, 전신, 옆모습, 커머셜/라이프스타일)이 되도록 순서를 정하세요. 비슷한 컷이 붙지 않게 하세요.
- 글자는 작고 깔끔하게. 배경과 글자는 대비가 충분해야 합니다. 에이전시 카드는 이름을 대문자로 쓰는 경우가 많습니다.
- 색은 프리셋 기본 스타일에서 출발하되, 사진 톤에 맞게 조정해도 됩니다 (예: 웜톤 사진이면 크림 배경).
- 위 목록은 이번 캔버스 방향과 사진 장수에 맞는 프리셋만 추린 것입니다. 목록에 없는 id는 쓰지 마세요.
- 세 가지 추천안은 (가능하면) 서로 다른 프리셋이어야 합니다.
- "실제 사용자 데이터"가 있으면 참고하세요: 다른 사용자들이 끝까지 완성(다운로드·공유)한 비율이 높고 덜 고친 양식·스타일이 검증된 선택입니다. 세 안 중 적어도 하나는 완성률 상위 양식으로 하되, 이 모델의 사진에 더 맞는 양식이 있으면 사진을 우선하세요. 데이터를 근거로 썼다면 reason에 "많은 모델이 완성한 구성" 정도로 짧게 언급해도 됩니다.
- photoTypes에는 각 사진의 컷 종류를 적으세요: headshot(얼굴 클로즈업), half(상반신·허리 위), full(전신), profile(옆모습), lifestyle(소품·상황이 있는 커머셜 컷), empty(빈 칸).
- defaultOrder는 양식과 상관없이 쓸 기본 순서입니다. 첫 번째는 가장 좋은 헤드샷, 이어서 서로 다른 컷이 번갈아 오게 하세요.
- reason에는 어떤 표준 양식을 바탕으로 했고 왜 이 모델에게 맞는지 한국어로 짧게 쓰세요.
- 사진이 없거나 적으면 사진 번호 순서는 0부터 차례대로 두고, 프리셋과 색 위주로 제안하세요.`;

/** 실제 사용자 행동 데이터(최근 90일)를 AI가 읽을 수 있게 정리 — 표본이 적으면 빈 문자열 */
function userDataGuide(perf: Performance | null, canvas: string, count: number, allowed: Preset[]): string {
  const ins = rankTemplates(perf, canvas, count, allowed.map(p => p.id));
  if (!ins.enough) return "";
  const name = (id: string) => allowed.find(p => p.id === id)?.name ?? id;
  const lines = ins.ranked.map((t, i) => {
    const styles = topStyles(perf, canvas, t.template)
      .map(st => `배경 ${st.bg}/글자 ${st.txt}/굵기 ${st.weight}${st.caps === "true" ? "/대문자" : ""}/${st.stats} (${st.users}명)`).join(", ");
    return `${i + 1}. ${t.template} (${name(t.template)}): ` +
      (t.users >= 5 ? `${t.users}명 중 ${Math.round(t.rate * 100)}%가 다운로드·공유까지, 평균 편집 ${t.avgEdits ?? "-"}번` : "데이터 적음") +
      (styles ? ` · 끝까지 간 카드의 인기 스타일: ${styles}` : "");
  });
  return `\n실제 사용자 데이터 (최근 90일, ${ins.basis === "combo" ? `같은 방향·${count}장` : "같은 방향"} 사용자 ${ins.users}명, 완성률 높은 순):\n${lines.join("\n")}\n`;
}

/** 우리 Supabase Storage에 올라간 공개 사진만 AI에 보냄 */
function isOurPhoto(url: string | null): url is string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !!base && url.startsWith(`${base}/storage/v1/object/public/`);
}

export async function POST(request: Request) {
  // 로그인한 사용자만 사용 가능 (비용 보호)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI 추천을 쓰려면 서버에 ANTHROPIC_API_KEY 설정이 필요해요." }, { status: 503 });
  }

  const parsedBody = RequestBody.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  const { canvas, photos, name, fieldLabels } = parsedBody.data;
  // 방향(세로/가로)·장수 규칙: 맞는 양식만 후보로
  const fit = availablePresets(canvas, photos.length);
  const allowed = fit.length ? fit : presetOptions(canvas, photos.length).map(o => o.preset);
  const allowedIds = new Set<string>(allowed.map(p => p.id));

  // 같은 사진·조건으로 받은 추천이 있으면 다시 씀 (비용 0, 횟수 안 셈)
  const admin = createAdminClient();
  const ourPhotos = photos.map(u => (isOurPhoto(u) ? u : null));
  const key = suggestionKey({ canvas, photos: ourPhotos, name, fieldLabels, allowed: [...allowedIds] });
  const hit = await getCachedSuggestion<SuggestResponse>(admin, key);
  if (hit) return NextResponse.json({ ...hit, cached: true });

  // 무료 회원 한 달 횟수 확인
  const quota = await aiQuota(admin, user.id);
  if (quota.limited) {
    return NextResponse.json({
      error: `이번 달 무료 AI 추천 ${quota.limit}회를 모두 썼어요. 양식은 그대로 고를 수 있고, Pro는 AI 추천이 무제한이에요.`,
      reason: "ai_limit", remaining: 0,
    }, { status: 402 });
  }

  // 사진을 줄여서 보냄 (비용 약 1/3)
  const scaled = await Promise.all(ourPhotos.map(u => (u ? downscalePhoto(u) : Promise.resolve(null))));

  // 사진 블록: "사진 N" 라벨 + 이미지
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  scaled.forEach((data, i) => {
    if (data) {
      content.push({ type: "text", text: `사진 ${i}` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    } else {
      content.push({ type: "text", text: `사진 ${i}: (아직 올리지 않은 빈 칸)` });
    }
  });
  content.push({
    type: "text",
    text: [
      `캔버스: ${canvas === "portrait" ? "세로형 A4 (480x680)" : "가로형 A4 (680x480)"}`,
      `사진 수: ${photos.length}장 (번호 0~${photos.length - 1})`,
      `모델 이름: ${name || "(미입력)"}`,
      `카드에 표시할 정보: ${fieldLabels.join(", ") || "(없음)"}`,
      "",
      "이 모델에게 어울리는 컴카드 구성 3가지를 제안해 주세요.",
    ].join("\n"),
  });

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      // 사진 분류·양식 고르기엔 Sonnet으로 충분 (Opus의 절반 가격)
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      // 거절 시 서버에서 다른 모델로 자동 재시도
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(SuggestionList) },
      system: systemPrompt(allowed, userDataGuide(await getPerformance(), canvas, photos.length, allowed)),
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.error("[comcard/suggest] no usable output:", response.stop_reason, response.stop_details);
      return NextResponse.json({ error: "추천을 만들지 못했어요. 다시 시도해 주세요." }, { status: 502 });
    }
    const out = response.parsed_output;
    const body: SuggestResponse = { photoTypes: out.photoTypes, defaultOrder: out.defaultOrder, suggestions: out.suggestions
      .filter(sg => allowedIds.has(sg.template)) // 규칙 밖 양식은 버림
      .filter((sg, i, arr) => arr.findIndex(o => o.template === sg.template) === i)
      .slice(0, 3) };
    await Promise.all([saveSuggestion(admin, key, body), recordAiUse(admin, user.id)]);
    return NextResponse.json({ ...body, remaining: quota.remaining === null ? null : Math.max(0, quota.remaining - 1) });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "요청이 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[comcard/suggest] invalid ANTHROPIC_API_KEY");
      return NextResponse.json({ error: "AI 설정에 문제가 있어요(API 키 확인 필요)." }, { status: 503 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`[comcard/suggest] API error ${error.status}:`, error.message);
      return NextResponse.json({ error: "AI 추천 중 오류가 났어요. 다시 시도해 주세요." }, { status: 502 });
    }
    throw error;
  }
}
