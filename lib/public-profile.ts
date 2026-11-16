import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 다른 사람의 프로필을 보여줄 때(명함·공유 카드·홈·미리보기 이미지·연락처 저장) 쓰는 공개 조회.
 *
 * 데이터베이스는 "본인 프로필만 읽기"로 잠그고(supabase/migrations/20261118000000_privacy.sql),
 * 공개 화면은 서버가 대신 읽은 뒤 모델이 공개로 설정한 항목만 넘긴다.
 * (서버 키 설정 전에는 일반 조회로 동작)
 */
export async function publicReadClient() {
  return createAdminClient() ?? (await createClient());
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_VISIBLE_SPECS = ["eng_name", "kor_name", "height", "chest", "waist", "hip", "shoe_size", "hair", "eye"];
/** visible_specs로 공개 여부를 정하는 항목 */
const SPEC_FIELDS = ["gender", "birth_year", "height", "weight", "chest", "waist", "hip", "shoe_size", "hair", "eye", "email"] as const;

export type PublicProfile = {
  id: string; slug: string | null; is_public: boolean | null;
  eng_name: string | null; kor_name: string | null; photo_url: string | null; career: string | null;
  instagram: string | null; kakao_link: string | null; tel: string | null;
  video_urls: string[]; visible_specs: string[];
  gender: string | null; birth_year: number | null; height: number | null; weight: number | null;
  chest: number | null; waist: number | null; hip: number | null; shoe_size: number | null;
  hair: string | null; eye: string | null; email: string | null;
};

/** 공개로 설정하지 않은 항목은 비워서 돌려줌 */
export function sanitizeProfile(p: Record<string, unknown>): PublicProfile {
  const visible = Array.isArray(p.visible_specs) ? (p.visible_specs as string[]) : DEFAULT_VISIBLE_SPECS;
  const out: Record<string, unknown> = {
    id: p.id, slug: p.slug ?? null, is_public: p.is_public ?? null,
    eng_name: p.eng_name ?? null, kor_name: p.kor_name ?? null, photo_url: p.photo_url ?? null, career: p.career ?? null,
    instagram: p.instagram ?? null, kakao_link: p.kakao_link ?? null, tel: p.tel ?? null,
    video_urls: Array.isArray(p.video_urls) ? p.video_urls : [], visible_specs: visible,
  };
  for (const f of SPEC_FIELDS) out[f] = visible.includes(f) ? (p[f] ?? null) : null;
  return out as PublicProfile;
}

/** 주소(이름) 또는 아이디로 공개 프로필 찾기 — 한 요청 안에서는 한 번만 조회 */
export const getPublicProfile = cache(async (param: string): Promise<PublicProfile | null> => {
  const db = await publicReadClient();
  let { data } = await db.from("profiles").select("*").eq("slug", param).maybeSingle();
  if (!data && UUID.test(param)) ({ data } = await db.from("profiles").select("*").eq("id", param).maybeSingle());
  return data ? sanitizeProfile(data) : null;
});
