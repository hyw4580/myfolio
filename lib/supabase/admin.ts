import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * 서버 전용 관리자 클라이언트 (RLS 우회).
 * 결제·구독 기록처럼 사용자가 직접 쓰면 안 되는 데이터에만 사용한다.
 * SUPABASE_SERVICE_ROLE_KEY는 절대 NEXT_PUBLIC_ 으로 노출하지 말 것.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
