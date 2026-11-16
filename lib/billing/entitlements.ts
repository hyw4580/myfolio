import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FREE_EXPORT_CARD_LIMIT } from "./plans";

export type Entitlements = {
  isPro: boolean;
  plan: string | null;
  status: "inactive" | "active" | "past_due" | "expired";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** 무료 회원이 이미 다운로드한 컴카드 id 목록 */
  exportedCardIds: string[];
  /** 카드별 처음(사진이 있던) 다운로드 때의 사진 목록 — 사진을 통째로 바꿔 쓰는 것 방지용 */
  baselinePhotos: Record<string, string[]>;
  cardLabel: string | null;
};

/** 사용자의 구독·사용량 상태 (서버 관리자 클라이언트로 조회) */
export async function getEntitlements(admin: SupabaseClient, userId: string): Promise<Entitlements> {
  const [{ data: sub }, { data: exports }, { data: cust }] = await Promise.all([
    admin.from("subscriptions").select("plan, status, current_period_end, cancel_at_period_end").eq("user_id", userId).maybeSingle(),
    admin.from("comcard_exports").select("card_id, photos, created_at").eq("user_id", userId).order("created_at", { ascending: true }),
    admin.from("billing_customers").select("card_label").eq("user_id", userId).maybeSingle(),
  ]);
  const periodEnd = sub?.current_period_end ?? null;
  const isPro = !!sub && (sub.status === "active" || sub.status === "past_due") && !!periodEnd && new Date(periodEnd) > new Date();
  return {
    isPro,
    plan: sub?.plan ?? null,
    status: (sub?.status ?? "inactive") as Entitlements["status"],
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
    exportedCardIds: [...new Set((exports ?? []).map(e => e.card_id as string))],
    baselinePhotos: baselineOf(exports ?? []),
    cardLabel: cust?.card_label ?? null,
  };
}

function baselineOf(rows: { card_id: string; photos?: string[] | null }[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of rows) {
    const photos = Array.isArray(r.photos) ? r.photos : [];
    if (!out[r.card_id] && photos.length > 0) out[r.card_id] = photos; // 사진이 있던 첫 다운로드가 기준
  }
  return out;
}

/** 실제로 올린 사진 주소만, 중복 없이 */
export function cardPhotoSet(photos: { src?: string | null }[] | undefined): string[] {
  return [...new Set((photos ?? []).map(p => p.src ?? "").filter(s => s.startsWith("http")))].sort();
}

/**
 * 이 카드를 다운로드할 수 있는지.
 * - Pro: 항상
 * - 무료: 다운로드한 카드가 없으면 OK. 이미 다운로드한 같은 카드면, 처음 사진의 절반 이상이 그대로일 때만 OK
 *   (사진 일부 교체·글자 수정은 자유, 사진을 통째로 바꿔 다른 사람·다른 룩 카드로 쓰는 건 새 카드로 봄)
 */
export function canExportCard(e: Entitlements, cardId: string, photos: string[]): { ok: boolean; reason?: "limit" | "changed" } {
  if (e.isPro) return { ok: true };
  if (e.exportedCardIds.length === 0) return { ok: true };
  if (!e.exportedCardIds.includes(cardId)) {
    return e.exportedCardIds.length < FREE_EXPORT_CARD_LIMIT ? { ok: true } : { ok: false, reason: "limit" };
  }
  const base = e.baselinePhotos[cardId];
  if (!base || base.length === 0) return { ok: true }; // 사진 없이 받은 적만 있으면 이번이 기준이 됨
  const kept = photos.filter(p => base.includes(p)).length;
  return kept * 2 >= base.length ? { ok: true } : { ok: false, reason: "changed" };
}
