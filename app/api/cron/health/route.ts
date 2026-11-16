import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHealthCheck } from "@/lib/health";
import { siteUrl } from "@/lib/admin";

/** 매일 09:30(한국시간) 자체 점검 — 문제가 있으면 바로 메일 */
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });
  try {
    return NextResponse.json(await runHealthCheck(admin, siteUrl()));
  } catch (e) {
    console.error("[cron/health]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
