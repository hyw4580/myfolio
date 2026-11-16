import { NextResponse } from "next/server";
import { billingConfigured, requireUserAndAdmin } from "@/lib/billing/server";
import { newCustomerKey } from "@/lib/billing/toss";

/** 카드 등록(빌링 인증) 전에 이 사용자의 고객 키를 만들거나 꺼내 줌 */
export async function POST() {
  if (!billingConfigured()) return NextResponse.json({ error: "결제 기능이 아직 설정되지 않았어요." }, { status: 503 });
  const ctx = await requireUserAndAdmin();
  if ("error" in ctx) return ctx.error;
  const { admin, user } = ctx;

  const { data: existing } = await admin.from("billing_customers").select("customer_key").eq("user_id", user.id).maybeSingle();
  let customerKey = existing?.customer_key as string | undefined;
  if (!customerKey) {
    customerKey = newCustomerKey();
    const { error } = await admin.from("billing_customers").insert({ user_id: user.id, customer_key: customerKey });
    if (error) {
      console.error("[billing/prepare]", error);
      return NextResponse.json({ error: "결제 준비 중 오류가 났어요." }, { status: 500 });
    }
  }
  return NextResponse.json({
    customerKey,
    customerEmail: user.email ?? null,
    customerName: (user.user_metadata?.full_name as string | undefined) ?? null,
  });
}
