import { NextResponse } from "next/server";
import { getEntitlements } from "@/lib/billing/entitlements";
import { billingConfigured, requireUserAndAdmin } from "@/lib/billing/server";

/** 내 구독 상태 + 무료 사용량 */
export async function GET() {
  const ctx = await requireUserAndAdmin();
  if ("error" in ctx && ctx.error) {
    // 결제 설정 전에는 "설정 안 됨"으로 알려주고 화면은 무료 기준으로 동작
    if (ctx.error.status === 503) return NextResponse.json({ configured: false });
    return ctx.error;
  }
  if (!("admin" in ctx)) return NextResponse.json({ configured: false });
  const ent = await getEntitlements(ctx.admin, ctx.user.id);
  return NextResponse.json({ configured: billingConfigured(), ...ent });
}
