import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { specIdea } from "@/lib/renewal";

export const maxDuration = 120;

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("idea"), title: z.string().trim().min(2).max(200), description: z.string().max(3000).optional(), specNow: z.boolean().default(false) }),
  z.object({ action: z.literal("spec"), id: z.number().int() }),
  z.object({ action: z.literal("add_concept"), label: z.string().trim().min(1).max(20), hint: z.string().max(200).optional() }),
  z.object({ action: z.literal("status"), ids: z.array(z.number().int()).min(1).max(50), status: z.enum(["approved", "held", "rejected", "proposed"]), note: z.string().max(2000).optional() }),
]);

/** 관리자: 아이디어 등록 / 기획서 만들기 / 승인·보류·거절 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 필요해요." }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "입력을 확인해 주세요." }, { status: 400 });
  const b = parsed.data;
  const now = new Date().toISOString();

  if (b.action === "idea") {
    const { data, error } = await admin.from("renewal_items").insert({
      lane: "feature", source: "owner", status: "idea", title: b.title, problem: b.description ?? null,
    }).select("id").single();
    if (error) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
    const specced = b.specNow ? await specIdea(admin, data.id).catch(() => false) : false;
    return NextResponse.json({ ok: true, id: data.id, specced });
  }

  if (b.action === "spec") {
    const ok = await specIdea(admin, b.id).catch(e => { console.error("[admin/renewal] spec", e); return false; });
    if (!ok) return NextResponse.json({ error: process.env.ANTHROPIC_API_KEY ? "기획서를 만들지 못했어요." : "AI 키(ANTHROPIC_API_KEY) 설정 후 쓸 수 있어요." }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "add_concept") {
    // 사용자들이 직접 입력한 컨셉을 정식 목록에 추가 → 다음 판독부터 AI도 이 컨셉을 고름
    const id = `k${Date.now().toString(36)}`;
    const { error } = await admin.from("photo_concepts").insert({ id, label: b.label, hint: b.hint ?? `${b.label} 촬영` });
    if (error) return NextResponse.json({ error: error.code === "23505" ? "이미 있는 컨셉이에요." : "추가하지 못했어요." }, { status: 400 });
    // 직접 입력해 둔 사진들도 정식 컨셉으로 바꿔 줌
    const { data: rows } = await admin.from("snaps").select("id, concepts").contains("concepts", [`c:${b.label}`]);
    await Promise.all((rows ?? []).map(r => admin.from("snaps").update({ concepts: (r.concepts as string[]).map(c => (c === `c:${b.label}` ? id : c)) }).eq("id", r.id)));
    return NextResponse.json({ ok: true, id, migrated: rows?.length ?? 0 });
  }

  // 상태 바꾸기 — 작업 중·완료된 항목은 건드리지 않음
  const patch: Record<string, unknown> = { status: b.status, updated_at: now };
  if (b.status === "approved") patch.approved_at = now;
  if (b.note !== undefined) patch.owner_note = b.note;
  const { error, count } = await admin.from("renewal_items").update(patch, { count: "exact" })
    .in("id", b.ids).not("status", "in", "(in_progress,done,idea)");
  if (error) return NextResponse.json({ error: "처리하지 못했어요." }, { status: 500 });
  return NextResponse.json({ ok: true, updated: count ?? 0 });
}
