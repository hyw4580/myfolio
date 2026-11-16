import "server-only";
import { createHash } from "crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FREE_AI_MONTHLY_LIMIT } from "./billing/plans";
import { billingConfigured } from "./billing/server";

/**
 * AI 추천 비용 줄이기
 * 1) 사진을 줄여서 보냄 (긴 쪽 768px, JPEG) — 구성 판단엔 원본 화질이 필요 없음
 * 2) 같은 사진·조건이면 저장된 결과를 다시 씀 (30일)
 * 3) 무료 회원은 한 달 FREE_AI_MONTHLY_LIMIT회 (저장된 결과 재사용은 안 셈)
 */
export const AI_IMAGE_MAX = 768;

/** 사진을 받아 줄인 뒤 base64로 (실패하면 null → 그 칸은 빈 칸으로 처리) */
export async function downscalePhoto(url: string, max = AI_IMAGE_MAX): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 25 * 1024 * 1024) return null;
    const out = await sharp(buf, { failOn: "none" }).rotate()
      .resize(max, max, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 }).toBuffer();
    return out.toString("base64");
  } catch (e) {
    console.warn("[ai-cost] downscale failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/** 추천 결과 저장 키 — 결과에 영향을 주는 입력만 */
export function suggestionKey(parts: { canvas: string; photos: (string | null)[]; name?: string; fieldLabels: string[]; allowed: string[] }) {
  return "v1:" + createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export async function getCachedSuggestion<T>(admin: SupabaseClient | null, key: string): Promise<T | null> {
  if (!admin) return null;
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await admin.from("ai_suggestions").select("result").eq("key", key).gte("created_at", since).maybeSingle();
  return (data?.result as T) ?? null;
}
export async function saveSuggestion(admin: SupabaseClient | null, key: string, result: unknown) {
  if (!admin) return;
  const { error } = await admin.from("ai_suggestions").upsert({ key, result, created_at: new Date().toISOString() });
  if (error) console.warn("[ai-cost] cache save", error.message);
}

/** 이번 달 시작 (한국시간 기준 1일 0시) */
function monthStartKST(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 3600_000);
}

export type AiQuota = { limited: boolean; used: number; limit: number | null; remaining: number | null };

/** 무료 회원 한도 확인 — 결제 기능 설정 전이거나 Pro면 제한 없음 */
export async function aiQuota(admin: SupabaseClient | null, userId: string): Promise<AiQuota> {
  if (!admin || !billingConfigured()) return { limited: false, used: 0, limit: null, remaining: null };
  const { data: pro } = await admin.rpc("is_pro", { uid: userId });
  if (pro === true) return { limited: false, used: 0, limit: null, remaining: null };
  const { count } = await admin.from("ai_usage").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("kind", "comcard_suggest").gte("created_at", monthStartKST().toISOString());
  const used = count ?? 0;
  return { limited: used >= FREE_AI_MONTHLY_LIMIT, used, limit: FREE_AI_MONTHLY_LIMIT, remaining: Math.max(0, FREE_AI_MONTHLY_LIMIT - used) };
}
export async function recordAiUse(admin: SupabaseClient | null, userId: string) {
  if (!admin) return;
  await admin.from("ai_usage").insert({ user_id: userId, kind: "comcard_suggest" });
}
