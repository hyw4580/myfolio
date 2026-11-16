import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EVENT_NAMES } from "@/lib/analytics-events";

const Value = z.union([z.string().max(80), z.number().finite(), z.boolean(), z.null()]);
const Event = z.object({
  name: z.enum(EVENT_NAMES),
  props: z.record(z.string().max(40), Value).refine(o => Object.keys(o).length <= 30).default({}),
  path: z.string().max(200).optional(),
  session_id: z.string().max(64).optional(),
  ts: z.number().optional(),
});
const Body = z.object({
  anon_id: z.string().min(8).max(64),
  platform: z.enum(["web", "ios", "android"]).default("web"),
  events: z.array(Event).min(1).max(50),
});

/** 공개 화면 주소에서 쿼리·해시 제거 (토큰 등이 섞이지 않게) */
const cleanPath = (p?: string) => (p ? p.split(/[?#]/)[0].slice(0, 200) : null);

/** 사용 패턴 이벤트 모아 저장 (로그인 안 해도 됨, 실패해도 화면엔 영향 없음) */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return new NextResponse(null, { status: 204 }); // 서버 키 설정 전엔 버림

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch { /* 비로그인 */ }

  const { anon_id, platform, events } = parsed.data;
  const rows = events.map(e => ({
    anon_id, user_id: userId, session_id: e.session_id ?? null, name: e.name,
    props: e.props, path: cleanPath(e.path), platform,
  }));
  const { error } = await admin.from("events").insert(rows);
  if (error) console.error("[events]", error.message);
  return new NextResponse(null, { status: 204 });
}
