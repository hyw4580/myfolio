/**
 * 기능 노출 스위치.
 * 지금은 컴카드 제작 + 마이페이지(포트폴리오)에 집중하고,
 * 나머지는 코드는 그대로 두되 화면에서만 숨긴다. 나중에 true로 바꾸면 다시 보인다.
 */
export const FEATURES = {
  /**
   * 유료 제한 스위치. false면 토스 키가 있어도 결제·Pro 제한을 모두 끄고 전부 무료로 동작
   * (다운로드·공개·AI 추천 횟수·포트폴리오 게시물 제한 없음, 요금제 메뉴 숨김).
   * 결제를 시작할 때 true로 바꾸고, Supabase app_flags의 billing_enabled도 켜기.
   */
  paywall: false,
  /** 공개 갤러리(모델 목록·검색) — 막아둠. (각자 명함 페이지의 개인 갤러리는 항상 사용) */
  gallery: false,
  /** 메뉴의 Contact, 홈 문의 섹션, 푸터 Contact 링크 */
  contact: false,
  /** Apple 로그인 버튼 (Supabase에 Apple 로그인 설정 후 true) — iOS 앱 출시 시 필수 */
  appleLogin: false,
} as const;
