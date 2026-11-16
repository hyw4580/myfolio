import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const Body = z.object({
  category: z.enum(["bug", "inconvenience", "request", "praise", "other"]),
  message: z.string().trim().min(2).max(2000),
  page: z.string().max(300).optional(),
  platform: z.enum(["web", "ios", "android"]).default("web"),
});

/** 의견 보내기 저장 (로그인 안 해도 가능, 로그인했으면 계정과 연결) */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "내용을 2자 이상 2,000자 이하로 적어주세요." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "의견 보내기가 아직 설정되지 않았어요." }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 같은 사용자가 1분에 5번 넘게 보내면 잠시 막기 (도배 방지)
  if (user) {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin.from("feedback").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
    if ((count ?? 0) >= 5) return NextResponse.json({ error: "잠시 후 다시 보내주세요." }, { status: 429 });
  }

  const { category, message, page, platform } = parsed.data;
  const { error } = await admin.from("feedback").insert({
    user_id: user?.id ?? null, email: user?.email ?? null, category, message, page: page ?? null, platform,
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
  if (error) {
    console.error("[feedback]", error);
    return NextResponse.json({ error: "저장하지 못했어요. 다시 시도해 주세요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
