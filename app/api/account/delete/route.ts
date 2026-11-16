import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteBillingKey } from "@/lib/billing/toss";

const BUCKETS = ["snaps", "avatars", "videos"] as const;

/** 버킷 안의 userId/ 폴더 아래 파일을 하위 폴더까지 모두 삭제 */
async function removeUserFiles(admin: SupabaseClient, bucket: string, prefix: string) {
  const { data: items } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (!items?.length) return;
  const files: string[] = [];
  for (const it of items) {
    const path = `${prefix}/${it.name}`;
    if (it.id === null) await removeUserFiles(admin, bucket, path); // 폴더
    else files.push(path);
  }
  if (files.length) await admin.storage.from(bucket).remove(files);
}

/**
 * 회원 탈퇴 (앱 스토어 필수 기능 · 개인정보 삭제).
 * 데이터베이스 함수 delete_account 로 컴카드·게시물·프로필·계정을 한 번에 삭제(트랜잭션)한 뒤,
 * 업로드 파일과 결제 카드 정보(빌링키)를 정리한다. 구독은 계정과 함께 삭제되어 다음 결제가 일어나지 않는다.
 * 결제 기록(payments)은 전자상거래법상 5년 보관 의무가 있어 삭제하지 않고 사용자 연결만 끊는다(FK set null).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== "탈퇴") return NextResponse.json({ error: "확인 문구가 올바르지 않아요." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "탈퇴 기능이 아직 설정되지 않았어요. 고객센터로 문의해 주세요." }, { status: 503 });

  const uid = user.id;
  try {
    // 0) 결제 카드 정보는 탈퇴 후에는 찾을 수 없으므로 먼저 읽어둠
    const { data: cust } = await admin.from("billing_customers").select("billing_key").eq("user_id", uid).maybeSingle();

    // 1) 컴카드·게시물·프로필·계정을 한 번에 삭제 (데이터베이스 트랜잭션 — 실패하면 아무것도 지워지지 않음)
    const { error } = await admin.rpc("delete_account", { uid });
    if (error) throw error;

    // 2) 계정 삭제가 확정된 뒤 정리 (실패해도 계정은 이미 삭제됨 → 기록만 남김)
    if (cust?.billing_key && process.env.TOSS_SECRET_KEY) {
      await deleteBillingKey(cust.billing_key).catch(e => console.error("[account/delete] billing key cleanup", uid, e));
    }
    for (const b of BUCKETS) {
      await removeUserFiles(admin, b, uid).catch(e => console.error(`[account/delete] storage cleanup ${b}`, uid, e));
    }

    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[account/delete]", e);
    return NextResponse.json({ error: "탈퇴 처리 중 오류가 났어요. 다시 시도하거나 문의해 주세요." }, { status: 500 });
  }
}
