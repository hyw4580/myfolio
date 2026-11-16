import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyPhotos, conceptCatalog } from "@/lib/photo-concepts-server";
import { MAX_CONCEPTS_PER_PHOTO, validConcept } from "@/lib/photo-concepts";

export const maxDuration = 60;

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("classify"), ids: z.array(z.string().max(64)).min(1).max(10) }),
  z.object({ action: z.literal("set"), id: z.string().max(64), concepts: z.array(z.string().max(30)).max(MAX_CONCEPTS_PER_PHOTO) }),
]);

/** 컨셉 목록 (기본 + 추가된 것) */
export async function GET() {
  return NextResponse.json({ concepts: await conceptCatalog(createAdminClient()) }, { headers: { "Cache-Control": "public, max-age=600" } });
}

/**
 * classify: 방금 올린 사진들의 컨셉을 AI가 판독 → 사용자가 아직 안 고른 사진에만 적용
 * set: 사용자가 컨셉을 고침 → 저장 + (AI 판독이 있었으면) 수정 기록을 남겨 다음 판독에 반영
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  const admin = createAdminClient();
  const db = admin ?? supabase;
  const b = parsed.data;

  if (b.action === "classify") {
    // 본인 사진만
    const { data: rows } = await db.from("snaps").select("id, url, concepts").eq("user_id", user.id).in("id", b.ids);
    const list = rows ?? [];
    const result = await classifyPhotos(admin, list.map(r => r.url));
    const out: Record<string, { concepts: string[]; ai: string[] }> = {};
    await Promise.all(list.map(async (r, i) => {
      const ai = result[i];
      const keepUser = Array.isArray(r.concepts) && r.concepts.length > 0;
      const concepts = keepUser ? r.concepts as string[] : ai;
      if (ai.length) await db.from("snaps").update({ ai_concepts: ai, ...(keepUser ? {} : { concepts }) }).eq("id", r.id).eq("user_id", user.id);
      out[String(r.id)] = { concepts, ai };
    }));
    return NextResponse.json({ photos: out, aiAvailable: !!process.env.ANTHROPIC_API_KEY });
  }

  // set
  const catalog = await conceptCatalog(admin);
  const concepts = [...new Set(b.concepts)].filter(c => validConcept(c, catalog));
  const { data: row } = await db.from("snaps").select("id, ai_concepts").eq("id", b.id).eq("user_id", user.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "사진을 찾을 수 없어요." }, { status: 404 });
  const { error } = await db.from("snaps").update({ concepts }).eq("id", b.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
  if (admin && Array.isArray(row.ai_concepts) && row.ai_concepts.length) {
    await admin.from("concept_feedback").insert({ snap_id: String(b.id), user_id: user.id, ai: row.ai_concepts, final: concepts });
  }
  return NextResponse.json({ ok: true, concepts });
}
