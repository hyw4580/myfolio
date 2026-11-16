import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWeeklyVoc } from "@/lib/voc";
import { isAdminEmail, siteUrl } from "@/lib/admin";

/** 관리자 페이지의 "지금 분석하기" — 매주 자동 보고와 같은 작업을 바로 실행 */
export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 필요해요." }, { status: 503 });
  try {
    return NextResponse.json(await runWeeklyVoc(admin, siteUrl()));
  } catch (e) {
    console.error("[admin/voc-report]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "분석에 실패했어요." }, { status: 500 });
  }
}
