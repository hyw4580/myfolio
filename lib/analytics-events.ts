/** 기록할 수 있는 이벤트 이름 (서버도 이 목록만 받음) */
export const EVENT_NAMES = [
  "page_view",
  "signup_view", "signup_completed",
  "comcard_step", "photo_uploaded", "template_chosen", "layout_applied", "ai_suggest_requested",
  "editor_summary", "card_saved", "card_downloaded", "paywall_shown", "card_published",
  "share_clicked", "qr_opened", "vcard_downloaded", "public_view",
  "pricing_viewed", "subscribe_clicked", "subscribe_completed",
  "feedback_sent",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
