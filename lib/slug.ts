/**
 * 짧은 명함 주소 (myfolio.com/이름) 관련.
 * 사이트의 기존 페이지 이름과 겹치는 단어는 주소로 쓸 수 없다.
 */
export const RESERVED_SLUGS = new Set([
  "api", "auth", "billing", "card", "comcard", "gallery", "login", "logout", "model", "mypage", "pricing", "signup",
  "admin", "about", "help", "support", "terms", "privacy", "refund", "contact", "settings", "app", "static", "public", "_next",
  "favicon.ico", "robots.txt", "sitemap.xml", "myfolio", "www", "dev-comcard-preview",
]);

export const isReservedSlug = (slug: string) => RESERVED_SLUGS.has(slug.toLowerCase());

/** 명함(포트폴리오) 주소: 주소를 정했으면 /이름, 아니면 /model/아이디 */
export function profilePath(slug: string | null | undefined, id: string): string {
  return slug && !isReservedSlug(slug) ? `/${slug}` : `/model/${id}`;
}
