import "server-only";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decideCancel, proFeaturesUsed, type CancelOption, type UsageBaseline } from "./refund";

const hash = (s: string | null | undefined) => (s && s.trim() ? createHash("sha256").update(s.trim()).digest("hex").slice(0, 16) : "");

/** 지금 사용 상태 (사진 id 목록, 영상 수, 경력 해시, 공개 카드 수) */
async function usageState(admin: SupabaseClient, userId: string): Promise<UsageBaseline> {
  const [{ data: snaps }, { data: prof }, { count: featured }] = await Promise.all([
    admin.from("snaps").select("id").eq("user_id", userId),
    admin.from("profiles").select("video_urls, career").eq("id", userId).maybeSingle(),
    admin.from("comp_cards").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_featured", true),
  ]);
  return {
    snapIds: (snaps ?? []).map(s => String(s.id)),
    videos: Array.isArray(prof?.video_urls) ? prof.video_urls.length : 0,
    careerHash: hash(prof?.career),
    featured: featured ?? 0,
  };
}

/** 결제 직후 호출: 이 시점 상태를 결제 기록에 남김 (취소 때 "Pro 기능 썼는지" 비교 기준) */
export async function captureUsageBaseline(admin: SupabaseClient, userId: string) {
  try { return await usageState(admin, userId); }
  catch (e) { console.error("[refund] baseline failed", e); return null; }
}

export type CurrentPayment = { id: number; order_id: string; payment_key: string; amount: number; approved_at: string; plan: string | null; usage_baseline: UsageBaseline | null; refunded_amount: number };

/** 지금 구독 기간의 결제(가장 최근 완료 결제) */
export async function currentPayment(admin: SupabaseClient, userId: string): Promise<CurrentPayment | null> {
  const { data } = await admin.from("payments")
    .select("id, order_id, payment_key, amount, approved_at, plan, usage_baseline, refunded_amount")
    .eq("user_id", userId).eq("status", "DONE").not("approved_at", "is", null)
    .order("approved_at", { ascending: false }).limit(1).maybeSingle();
  return (data as CurrentPayment | null) ?? null;
}

/** 취소하면 어떻게 되는지 계산 (미리보기·실제 취소 모두 이걸로 판단) */
export async function cancelPreview(admin: SupabaseClient, userId: string, sub: { plan: string; current_period_end: string }) {
  const pay = await currentPayment(admin, userId);
  const now = new Date();
  if (!pay?.payment_key) {
    const option: CancelOption = { kind: "period_end", until: sub.current_period_end, partialRefund: null, usedMonths: null, usedFeatures: [] };
    return { pay: null, option };
  }
  const [state, { count: exports }] = await Promise.all([
    usageState(admin, userId),
    admin.from("comcard_exports").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", pay.approved_at),
  ]);
  const usedFeatures = proFeaturesUsed(pay.usage_baseline, { ...state, exportsSincePayment: exports ?? 0 });
  const option = decideCancel({
    plan: pay.plan ?? sub.plan, paidAmount: pay.amount, paidAt: new Date(pay.approved_at), periodEnd: new Date(sub.current_period_end),
    now, usedFeatures, alreadyRefunded: (pay.refunded_amount ?? 0) > 0,
  });
  return { pay, option };
}
