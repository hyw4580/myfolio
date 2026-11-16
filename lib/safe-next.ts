/**
 * 로그인 후 돌아갈 주소(next) 검사 — 우리 사이트 안 경로만 허용.
 * "//evil.com", "/\\evil.com", ".evil.com", "@evil.com" 처럼 다른 사이트로 새는 값은 기본값으로 바꾼다.
 */
export function safeNext(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
