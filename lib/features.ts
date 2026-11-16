/**
 * 기능 노출 스위치.
 * 지금은 컴카드 제작 + 마이페이지(포트폴리오)에 집중하고,
 * 나머지는 코드는 그대로 두되 화면에서만 숨긴다. 나중에 true로 바꾸면 다시 보인다.
 */
export const FEATURES = {
  /** 공개 갤러리(모델 목록·검색) — 막아둠. (각자 명함 페이지의 개인 갤러리는 항상 사용) */
  gallery: false,
  /** 메뉴의 Contact, 홈 문의 섹션, 푸터 Contact 링크 */
  contact: false,
  /** Apple 로그인 버튼 (Supabase에 Apple 로그인 설정 후 true) — iOS 앱 출시 시 필수 */
  appleLogin: false,
} as const;
