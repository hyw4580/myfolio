import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserAndAdmin } from "@/lib/billing/server";
import { cancelPreview } from "@/lib/billing/refund-server";
import { cancelPayment, TossError } from "@/lib/billing/toss";

/**
 * 구독 취소 (환불정책과 같은 규칙: lib/billing/refund.ts)
 * GET  → 지금 취소하면 어떻게 되는지 미리보기 (전액 환불 / 기간 끝까지 이용 + 연간이면 남은 개월 환불 금액)
 * POST { action: "cancel" }           → 요건 맞으면 전액 환불 후 즉시 종료, 아니면 기간 끝에 종료 예약
 * POST { action: "refund_remaining" } → (연간) 남은 개월만큼 환불하고 즉시 종료
 * POST { action: "resume" }           → 종료 예약 취소, 계속 구독
 */
const Body = z.object({ action: z.enum(["cancel", "refund_remaining", "resume"]) });

async function activeSub(admin: NonNullable<Awaited<ReturnType<typeof requireUserAndAdmin>>["admin"]>, userId: string) {
  const { data: sub } = await admin.from("subscriptions").select("plan, status, current_period_end, cancel_at_period_end").eq("user_id", userId).maybeSingle();
  if (!sub || (sub.status !== "active" && sub.status !== "past_due") || !sub.current_period_end) return null;
  return sub as { plan: string; status: string; current_period_end: string; cancel_at_period_end: boolean };
}

export async function GET() {
  const ctx = await requireUserAndAdmin();
  if ("error" in ctx) return ctx.error;
  const sub = await activeSub(ctx.admin, ctx.user.id);
  if (!sub) return NextResponse.json({ error: "진행 중인 구독이 없어요." }, { status: 400 });
  const { option } = await cancelPreview(ctx.admin, ctx.user.id, sub);
  return NextResponse.json({ option, cancelAtPeriodEnd: sub.cancel_at_period_end });
}

export async function POST(request: Request) {
  const ctx = await requireUserAndAdmin();
  if ("error" in ctx) return ctx.error;
  const { admin, user } = ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  const { action } = parsed.data;

  const sub = await activeSub(admin, user.id);
  if (!sub) return NextResponse.json({ error: "진행 중인 구독이 없어요." }, { status: 400 });
  const stamp = new Date().toISOString();

  if (action === "resume") {
    const { error } = await admin.from("subscriptions").update({ cancel_at_period_end: false, updated_at: stamp }).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "처리 중 오류가 났어요." }, { status: 500 });
    return NextResponse.json({ ok: true, result: "resumed" });
  }

  // 서버에서 다시 계산 (화면에서 본 미리보기와 상관없이 지금 기준으로 판단)
  const { pay, option } = await cancelPreview(admin, user.id, sub);
  const refundAmount = option.kind === "full_refund" ? option.amount
    : action === "refund_remaining" ? option.partialRefund : null;

  if (action === "refund_remaining" && !refundAmount) {
    return NextResponse.json({ error: "환불할 남은 금액이 없어요. 기간이 끝날 때까지 이용하고 종료돼요." }, { status: 400 });
  }

  // 환불 없이 기간 끝에 종료
  if (!refundAmount || !pay) {
    const { error } = await admin.from("subscriptions").update({ cancel_at_period_end: true, updated_at: stamp }).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "처리 중 오류가 났어요." }, { status: 500 });
    return NextResponse.json({ ok: true, result: "period_end", until: sub.current_period_end });
  }

  // 환불 후 즉시 종료
  const reason = option.kind === "full_refund" ? "full_7days" : "yearly_remaining";
  try {
    await cancelPayment(pay.payment_key, {
      cancelReason: reason === "full_7days" ? "구독 취소 (결제 7일 이내, 미사용)" : "연간 구독 중도 취소 (남은 개월 환불)",
      cancelAmount: refundAmount < pay.amount ? refundAmount : undefined,
      idempotencyKey: `refund-${pay.order_id}`,
    });
  } catch (e) {
    const msg = e instanceof TossError ? e.message : "환불 요청 중 오류가 났어요.";
    console.error("[billing/cancel] toss cancel failed", user.id, pay.order_id, e);
    return NextResponse.json({ error: `${msg} 잠시 후 다시 시도하거나 문의해 주세요.` }, { status: 502 });
  }

  const [{ error: payErr }, { error: subErr }] = await Promise.all([
    admin.from("payments").update({
      refunded_amount: refundAmount, refunded_at: stamp, refund_reason: reason,
      status: refundAmount >= pay.amount ? "CANCELED" : "PARTIAL_CANCELED",
    }).eq("id", pay.id),
    admin.from("subscriptions").update({
      status: "expired", current_period_end: stamp, cancel_at_period_end: false, updated_at: stamp,
    }).eq("user_id", user.id),
  ]);
  if (payErr || subErr) {
    // 환불은 됐는데 기록 실패 — 운영자 확인 필요
    console.error("[billing/cancel] REFUNDED BUT NOT SAVED", user.id, pay.order_id, payErr, subErr);
  }
  return NextResponse.json({ ok: true, result: "refunded", amount: refundAmount });
}
