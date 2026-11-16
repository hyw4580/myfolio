import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Performance } from "./comcard-ranking";

/** 양식 성과 집계 (DB 함수 template_performance) — 서버 메모리에 1시간 보관 */
let cache: { at: number; data: Performance | null } | null = null;
const TTL = 60 * 60 * 1000;

export async function getPerformance(): Promise<Performance | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  const admin = createAdminClient();
  if (!admin) return null; // 서버 키 설정 전
  const { data, error } = await admin.rpc("template_performance", { p_days: 90 });
  if (error) { console.warn("[insights] template_performance:", error.message); cache = { at: Date.now(), data: null }; return null; }
  cache = { at: Date.now(), data: data as Performance };
  return cache.data;
}
