import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWeeklyVoc } from "@/lib/voc";
import { siteUrl } from "@/lib/admin";

/** 매주 월요일 09:00(한국시간) 자동 실행 — 지난 7일 의견 AI 분석 → 저장 → 이메일 보고 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });
  try {
    return NextResponse.json(await runWeeklyVoc(admin, siteUrl()));
  } catch (e) {
    console.error("[cron/voc]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
