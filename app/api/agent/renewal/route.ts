import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 매주 화요일 자동 작업(Claude 예약 작업) 전용 API
 * - GET: 운영자가 승인한 항목 (최대 5건, 승인 순)
 * - POST: 작업 상태 기록 (approved → in_progress → done/failed, PR 주소·결과 요약)
 * 인증: Authorization: Bearer AGENT_TOKEN (Vercel 환경변수와 예약 작업에만 저장)
 * 이 API로는 승인·배포·DB 변경을 할 수 없음 — 승인은 운영자만, 배포는 PR 합치기로만.
 */
const MAX_PER_RUN = 5;

function authorized(request: Request) {
  const token = process.env.AGENT_TOKEN;
  const got = request.headers.get("authorization") ?? "";
  if (!token || token.length < 24) return false;
  const a = Buffer.from(got), b = Buffer.from(`Bearer ${token}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const [{ data: approved }, { data: rejected }] = await Promise.all([
    admin.from("renewal_items")
      .select("id, lane, source, title, problem, evidence, plan, risk, effort, stage, owner_note, approved_at")
      .eq("status", "approved").order("approved_at", { ascending: true }).limit(MAX_PER_RUN),
    admin.from("renewal_items").select("title, owner_note").eq("status", "rejected").order("updated_at", { ascending: false }).limit(20),
  ]);
  return NextResponse.json({ items: approved ?? [], rejected: rejected ?? [], maxPerRun: MAX_PER_RUN });
}

const Body = z.object({
  id: z.number().int(),
  status: z.enum(["in_progress", "done", "failed"]),
  agent_note: z.string().max(4000).optional(),
  pr_url: z.string().url().max(300).refine(u => u.startsWith("https://github.com/"), "GitHub PR 주소만").optional(),
});

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { id, status, agent_note, pr_url } = parsed.data;
  // 허용 흐름: approved → in_progress, in_progress → done/failed
  const from = status === "in_progress" ? ["approved"] : ["in_progress"];
  const now = new Date().toISOString();
  const { data, error } = await admin.from("renewal_items")
    .update({ status, agent_note: agent_note ?? null, pr_url: pr_url ?? null, updated_at: now, ...(status === "done" ? { done_at: now } : {}) })
    .eq("id", id).in("status", from).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "상태를 바꿀 수 없는 항목이에요 (승인 안 됨 또는 이미 처리됨)." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
