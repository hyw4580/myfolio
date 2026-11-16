import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUILTIN_CONCEPTS, MAX_CONCEPTS_PER_PHOTO, type Concept } from "./photo-concepts";
import { downscalePhoto } from "./ai-cost";

/** 기본 10개 + 운영자가 추가한 컨셉 */
export async function conceptCatalog(admin: SupabaseClient | null): Promise<Concept[]> {
  if (!admin) return BUILTIN_CONCEPTS;
  const { data } = await admin.from("photo_concepts").select("id, label, hint").order("created_at");
  return [...BUILTIN_CONCEPTS, ...(data ?? []).map(d => ({ id: d.id, label: d.label, hint: d.hint ?? "" }))];
}

type Stats = { samples: number; swaps: { from: string; to: string; n: number }[]; per_concept: { concept: string; suggested: number; kept: number }[] };

/** 사용자 수정 기록에서 배운 판독 요령 (1시간 캐시) — 이게 쌓일수록 판독이 정확해짐 */
let learned: { at: number; text: string } | null = null;
async function learnedHints(admin: SupabaseClient | null, catalog: Concept[]): Promise<string> {
  if (!admin) return "";
  if (learned && Date.now() - learned.at < 3600_000) return learned.text;
  const { data } = await admin.rpc("concept_stats", { p_days: 180 });
  const st = data as Stats | null;
  const label = (id: string) => catalog.find(c => c.id === id)?.label ?? id.replace(/^c:/, "");
  let text = "";
  if (st && st.samples >= 20) {
    const swaps = st.swaps.filter(s => s.n >= 3 && !s.to.startsWith("c:")).slice(0, 8)
      .map(s => `- AI가 "${label(s.from)}"로 본 사진을 사용자가 "${label(s.to)}"로 바꾼 경우 ${s.n}번`);
    const weak = st.per_concept.filter(p => p.suggested >= 10 && p.kept / p.suggested < 0.6)
      .map(p => `- "${label(p.concept)}"는 맞힌 비율 ${Math.round((p.kept / p.suggested) * 100)}% — 확실할 때만 고르세요`);
    if (swaps.length || weak.length) text = `\n실제 모델들이 고친 기록에서 배운 점 (${st.samples}장 기준):\n${[...swaps, ...weak].join("\n")}\n`;
  }
  learned = { at: Date.now(), text };
  return text;
}

/** 사진 여러 장의 촬영 컨셉 판독 (Haiku 5.5, 사진을 작게 줄여서) — 실패한 사진은 빈 배열 */
export async function classifyPhotos(admin: SupabaseClient | null, urls: string[]): Promise<string[][]> {
  const empty = urls.map(() => [] as string[]);
  if (!process.env.ANTHROPIC_API_KEY || urls.length === 0) return empty;
  const catalog = await conceptCatalog(admin);
  const ids = catalog.map(c => c.id) as [string, ...string[]];
  const Result = z.object({
    photos: z.array(z.object({
      index: z.number().int(),
      concepts: z.array(z.enum(ids)).describe(`이 사진의 촬영 컨셉 1~${MAX_CONCEPTS_PER_PHOTO}개, 가장 맞는 것부터`),
    })),
  });

  const images = await Promise.all(urls.map(u => downscalePhoto(u, 512)));
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  images.forEach((data, i) => {
    if (!data) return;
    content.push({ type: "text", text: `사진 ${i}` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
  });
  if (content.length === 0) return empty;
  content.push({ type: "text", text: "각 사진의 촬영 컨셉을 골라 주세요." });

  const system = `모델 포트폴리오 사진의 촬영 컨셉을 분류합니다. 에이전시·브랜드가 원하는 컨셉의 사진을 찾을 때 쓰입니다.
컨셉 목록 (이 id만 사용):
${catalog.map(c => `- ${c.id} (${c.label}): ${c.hint}`).join("\n")}
${await learnedHints(admin, catalog)}
규칙: 사진마다 가장 맞는 것 1개, 두 번째가 분명할 때만 2개. 애매하면 1개만. 의상·배경·조명·연출을 근거로 판단하세요.`;

  try {
    const client = new Anthropic();
    const res = await client.beta.messages.parse({
      model: "claude-haiku-5-5",
      max_tokens: 2000,
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: betaZodOutputFormat(Result) },
      system,
      messages: [{ role: "user", content }],
    });
    const out = res.parsed_output;
    if (res.stop_reason === "refusal" || !out) return empty;
    return urls.map((_, i) => {
      const hit = out.photos.find(p => p.index === i);
      return hit ? [...new Set(hit.concepts)].slice(0, MAX_CONCEPTS_PER_PHOTO) : [];
    });
  } catch (e) {
    console.error("[concepts] classify failed", e instanceof Error ? e.message : e);
    return empty;
  }
}
