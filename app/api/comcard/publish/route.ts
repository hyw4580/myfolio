import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlements } from "@/lib/billing/entitlements";
import { FREE_FEATURED_LIMIT } from "@/lib/billing/plans";

const Body = z.object({ cardId: z.string().uuid(), publish: z.boolean() });

/**
 * 컴카드 공개/비공개 (공유 링크 + 포트폴리오에 노출).
 * 무료 회원은 FREE_FEATURED_LIMIT장까지, Pro는 제한 없음.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  const { cardId, publish } = parsed.data;

  const { data: card } = await supabase.from("comp_cards").select("id, is_featured").eq("id", cardId).eq("user_id", user.id).maybeSingle();
  if (!card) return NextResponse.json({ error: "카드를 찾을 수 없어요." }, { status: 404 });

  if (publish && !card.is_featured) {
    const admin = createAdminClient();
    if (admin) { // 결제 설정 전에는 제한 없음
      const ent = await getEntitlements(admin, user.id);
      if (!ent.isPro) {
        const { count } = await supabase.from("comp_cards").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("is_featured", true);
        if ((count ?? 0) >= FREE_FEATURED_LIMIT) {
          return NextResponse.json({ error: `무료 회원은 컴카드 ${FREE_FEATURED_LIMIT}장까지 공개할 수 있어요.`, reason: "limit" }, { status: 402 });
        }
      }
    }
  }

  const { error } = await supabase.from("comp_cards").update({ is_featured: publish }).eq("id", cardId).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "처리하지 못했어요." }, { status: 500 });
  return NextResponse.json({ ok: true, published: publish });
}
