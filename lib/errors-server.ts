import "server-only";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** 같은 종류의 오류를 묶는 키: 숫자·아이디를 지운 메시지 + 첫 코드 위치 */
export function fingerprint(source: string, message: string, stack?: string | null) {
  const norm = message.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<id>").replace(/\d+/g, "<n>").slice(0, 300);
  const frame = (stack ?? "").split("\n").map(l => l.trim()).find(l => l.startsWith("at ") || l.includes("@")) ?? "";
  const loc = frame.replace(/:\d+:\d+\)?$/, "").replace(/\?[^)\s]*/, "").slice(0, 200);
  return createHash("sha256").update(`${source}|${norm}|${loc}`).digest("hex").slice(0, 20);
}

/** 개인정보가 섞이지 않게 정리 (이메일·전화번호 가림, 길이 제한) */
const clean = (s: string | null | undefined, max: number) =>
  s ? s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[이메일]").replace(/(\+?\d[\d\s-]{7,}\d)/g, "[번호]").slice(0, max) : null;

export type ErrorInput = { source: "client" | "server"; message: string; stack?: string | null; path?: string | null; route?: string | null; platform?: string | null; anon_id?: string | null };

export async function recordErrors(items: ErrorInput[]) {
  const admin = createAdminClient();
  if (!admin || items.length === 0) return;
  const rows = items.map(e => ({
    fingerprint: fingerprint(e.source, e.message, e.stack),
    source: e.source,
    message: clean(e.message, 500) ?? "(no message)",
    stack: clean(e.stack, 2000),
    path: e.path ? e.path.split(/[?#]/)[0].slice(0, 200) : null,
    route: e.route?.slice(0, 200) ?? null,
    platform: e.platform ?? null,
    anon_id: e.anon_id?.slice(0, 64) ?? null,
  }));
  const { error } = await admin.from("app_errors").insert(rows);
  if (error) console.error("[errors] insert failed:", error.message);
}
