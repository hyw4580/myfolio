import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_RETRY, planOf } from "@/lib/billing/plans";
import { addMonths, chargeBilling, newOrderId } from "@/lib/billing/toss";
import { captureUsageBaseline } from "@/lib/billing/refund-server";

/**
 * 매일 1회 실행되는 정기결제 작업 (vercel.json의 crons).
 * 결제일이 지난 구독을 찾아:
 *  - 해지 예약이면 → 만료
 *  - 아니면 → 저장된 빌링키로 다음 달 결제, 성공 시 기간 연장
 *  - 실패하면 → 하루 유예 후 다음 날 재시도, MAX_RETRY번 넘게 실패하면 만료
 * 토스페이먼츠에는 자동 스케줄러가 없어서 직접 돌려야 함.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  // Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더를 보냄
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const now = new Date();
  const { data: due, error } = await admin.from("subscriptions")
    .select("user_id, plan, status, current_period_end, cancel_at_period_end, failed_attempts")
    .in("status", ["active", "past_due"])
    .lte("current_period_end", now.toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = { renewed: 0, expired: 0, failed: 0 };
  for (const sub of due ?? []) {
    const stamp = new Date().toISOString();
    const PLAN = planOf(sub.plan);
    if (sub.cancel_at_period_end) {
      await admin.from("subscriptions").update({ status: "expired", updated_at: stamp }).eq("user_id", sub.user_id);
      result.expired++;
      continue;
    }
    const { data: cust } = await admin.from("billing_customers").select("customer_key, billing_key").eq("user_id", sub.user_id).maybeSingle();
    const orderId = newOrderId();
    try {
      if (!cust?.billing_key) throw new Error("등록된 카드가 없어요.");
      const pay = await chargeBilling(cust.billing_key, {
        customerKey: cust.customer_key, amount: PLAN.priceKRW, orderId, orderName: PLAN.orderName,
      });
      await admin.from("payments").insert({
        user_id: sub.user_id, order_id: orderId, payment_key: pay.paymentKey, amount: PLAN.priceKRW, status: pay.status, approved_at: pay.approvedAt,
        plan: PLAN.id, usage_baseline: await captureUsageBaseline(admin, sub.user_id),
      });
      if (pay.status !== "DONE") throw new Error(`결제 상태: ${pay.status}`);
      // 기존 결제일 기준으로 한 달 연장 (밀린 경우에도 오늘보다 뒤가 되도록)
      const base = new Date(Math.max(new Date(sub.current_period_end).getTime(), now.getTime()));
      await admin.from("subscriptions").update({
        status: "active", failed_attempts: 0, current_period_end: addMonths(base, PLAN.periodMonths).toISOString(), updated_at: stamp,
      }).eq("user_id", sub.user_id);
      result.renewed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "결제 실패";
      await admin.from("payments").upsert({ user_id: sub.user_id, order_id: orderId, amount: PLAN.priceKRW, status: "FAILED", error: msg }, { onConflict: "order_id" });
      const attempts = (sub.failed_attempts ?? 0) + 1;
      if (attempts > MAX_RETRY) {
        await admin.from("subscriptions").update({ status: "expired", failed_attempts: attempts, updated_at: stamp }).eq("user_id", sub.user_id);
        result.expired++;
      } else {
        // 하루 유예: 내일 다시 시도, 그동안은 계속 이용 가능
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        await admin.from("subscriptions").update({
          status: "past_due", failed_attempts: attempts, current_period_end: tomorrow.toISOString(), updated_at: stamp,
        }).eq("user_id", sub.user_id);
        result.failed++;
      }
    }
  }
  return NextResponse.json(result);
}
