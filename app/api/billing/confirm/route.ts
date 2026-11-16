import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserAndAdmin } from "@/lib/billing/server";
import { getEntitlements } from "@/lib/billing/entitlements";
import { PLANS } from "@/lib/billing/plans";
import { captureUsageBaseline } from "@/lib/billing/refund-server";
import { addMonths, chargeBilling, issueBillingKey, newOrderId, TossError } from "@/lib/billing/toss";

const Body = z.object({
  authKey: z.string().min(1).max(300),
  customerKey: z.string().min(22).max(50),
  plan: z.enum(["pro_monthly", "pro_yearly"]).default("pro_monthly"),
});

/**
 * 카드 등록 성공 후 호출.
 * 1) authKey로 빌링키 발급 → 2) 첫 달 결제 → 3) 구독 활성화.
 * 이미 유료 회원이면 카드만 바꾸고 결제하지 않음.
 */
export async function POST(request: Request) {
  const ctx = await requireUserAndAdmin();
  if ("error" in ctx) return ctx.error;
  const { admin, user } = ctx;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  const { authKey, customerKey } = parsed.data;
  const PLAN = PLANS[parsed.data.plan];

  // 이 고객 키가 정말 이 사용자 것인지 확인
  const { data: cust } = await admin.from("billing_customers").select("customer_key").eq("user_id", user.id).maybeSingle();
  if (!cust || cust.customer_key !== customerKey) {
    return NextResponse.json({ error: "결제 정보가 일치하지 않아요. 다시 시도해 주세요." }, { status: 400 });
  }

  try {
    // 1) 빌링키 발급 (authKey는 1회용)
    const billing = await issueBillingKey(authKey, customerKey);
    const cardLabel = billing.card?.number ? `카드 ${billing.card.number}` : "등록된 카드";
    await admin.from("billing_customers")
      .update({ billing_key: billing.billingKey, card_label: cardLabel, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    // 이미 유료 회원이면 카드 변경만
    const ent = await getEntitlements(admin, user.id);
    if (ent.isPro) return NextResponse.json({ ok: true, changedCard: true });

    // 2) 첫 달 결제
    const orderId = newOrderId();
    try {
      const pay = await chargeBilling(billing.billingKey, {
        customerKey, amount: PLAN.priceKRW, orderId, orderName: PLAN.orderName,
        customerEmail: user.email ?? null,
      });
      await admin.from("payments").insert({
        user_id: user.id, order_id: orderId, payment_key: pay.paymentKey, amount: PLAN.priceKRW,
        status: pay.status, approved_at: pay.approvedAt, plan: PLAN.id,
        usage_baseline: await captureUsageBaseline(admin, user.id), // 7일 환불 판단 기준
      });
      if (pay.status !== "DONE") throw new TossError("NOT_DONE", "결제가 완료되지 않았어요.", 402);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "결제 실패";
      await admin.from("payments").upsert({ user_id: user.id, order_id: orderId, amount: PLAN.priceKRW, status: "FAILED", error: msg }, { onConflict: "order_id" });
      throw e;
    }

    // 3) 구독 활성화
    const now = new Date();
    const { error } = await admin.from("subscriptions").upsert({
      user_id: user.id, plan: PLAN.id, status: "active",
      current_period_end: addMonths(now, PLAN.periodMonths).toISOString(),
      cancel_at_period_end: false, failed_attempts: 0, updated_at: now.toISOString(),
    });
    if (error) {
      // 결제는 됐는데 기록 실패 — 운영자가 확인해야 하는 상황
      console.error("[billing/confirm] PAID BUT SUBSCRIPTION NOT SAVED", user.id, orderId, error);
      return NextResponse.json({ error: "결제는 완료됐지만 구독 반영 중 오류가 났어요. 문의해 주세요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TossError) {
      console.error("[billing/confirm] toss error", e.code, e.message);
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status >= 500 ? 502 : 402 });
    }
    console.error("[billing/confirm]", e);
    return NextResponse.json({ error: "결제 처리 중 오류가 났어요." }, { status: 500 });
  }
}
