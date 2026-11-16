import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FEATURES } from "@/lib/features";

/** 결제 기능 설정 여부 (토스 키 + Supabase 서버 키) */
export const billingConfigured = () =>
  FEATURES.paywall && // 유료 스위치가 꺼져 있으면 키가 있어도 "결제 설정 전"(전부 무료)으로 동작
  !!process.env.TOSS_SECRET_KEY && !!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/** 로그인 사용자 + 관리자 클라이언트. 실패하면 바로 돌려줄 응답을 같이 반환 */
export async function requireUserAndAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 }) } as const;
  const admin = createAdminClient();
  if (!admin) return { error: NextResponse.json({ error: "결제 기능이 아직 설정되지 않았어요." }, { status: 503 }) } as const;
  return { user, admin, supabase } as const;
}
