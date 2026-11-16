import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canExportCard, cardPhotoSet, getEntitlements } from "@/lib/billing/entitlements";

const Body = z.object({ cardId: z.string().uuid(), kind: z.enum(["png", "pdf"]) });

/**
 * 컴카드 다운로드 전에 호출: 무료 회원은 카드 1장까지, 유료 회원은 무제한.
 * 허용되면 다운로드 기록을 남기고 ok, 아니면 402.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  const { cardId, kind } = parsed.data;

  // 본인 카드인지 확인
  const { data: card } = await supabase.from("comp_cards").select("id, data").eq("id", cardId).eq("user_id", user.id).maybeSingle();
  if (!card) return NextResponse.json({ error: "카드를 찾을 수 없어요." }, { status: 404 });

  const admin = createAdminClient();
  // 결제 기능 설정 전(서버 키 없음)에는 제한 없이 허용
  if (!admin) return NextResponse.json({ ok: true, billing: "not_configured" });

  // 서버에 저장된 카드의 사진 기준으로 판단 (다운로드 직전에 항상 저장됨)
  const photos = cardPhotoSet((card.data as { photos?: { src?: string | null }[] } | null)?.photos);
  const ent = await getEntitlements(admin, user.id);
  const check = canExportCard(ent, cardId, photos);
  if (!check.ok) {
    const error = check.reason === "changed"
      ? "사진을 대부분 바꾼 카드는 새 컴카드로 봐요. 무료 회원은 컴카드 1장까지 다운로드할 수 있어요."
      : "무료 회원은 컴카드 1장까지 다운로드할 수 있어요.";
    return NextResponse.json({ error, reason: check.reason }, { status: 402 });
  }
  const { error } = await admin.from("comcard_exports").insert({ user_id: user.id, card_id: cardId, kind, photos });
  if (error) {
    console.error("[comcard/export]", error);
    return NextResponse.json({ error: "다운로드 기록 중 오류가 났어요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, isPro: ent.isPro });
}
