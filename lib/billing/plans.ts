/**
 * 요금제 설정. 가격·혜택 문구는 여기만 바꾸면 전체에 반영된다.
 * (가격은 임시값 — 확정되면 수정)
 */
export const PLANS = {
  pro_monthly: { id: "pro_monthly", name: "Pro 월간", priceKRW: 4900, periodMonths: 1, orderName: "myfolio Pro 월 구독", unit: "월" },
  pro_yearly:  { id: "pro_yearly",  name: "Pro 연간", priceKRW: 39000, periodMonths: 12, orderName: "myfolio Pro 연 구독", unit: "년" },
} as const;
export type PlanId = keyof typeof PLANS;
export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && v in PLANS;
/** 예전 기록(plan = "pro")은 월간으로 취급 */
export const planOf = (id: string | null | undefined) => PLANS[isPlanId(id) ? id : "pro_monthly"];
/** 화면 표시용: 기본(월간) 요금 */
export const PRO_PLAN = PLANS.pro_monthly;
/** 연간 요금의 월 환산 */
export const yearlyPerMonth = Math.round(PLANS.pro_yearly.priceKRW / 12);

/** 무료 회원이 다운로드(PNG·PDF)할 수 있는 컴카드 수 */
export const FREE_EXPORT_CARD_LIMIT = 1;
/** 무료 회원이 포트폴리오에 대표로 공개할 수 있는 컴카드 수 */
export const FREE_FEATURED_LIMIT = 1;
/** 무료 회원 AI 컴카드 추천: 한 달 횟수 (같은 사진으로 다시 본 건 세지 않음) */
export const FREE_AI_MONTHLY_LIMIT = 3;
/** 자동결제 실패 시 재시도 횟수 (매일 1회) — 넘으면 만료 */
export const MAX_RETRY = 3;

export const PLAN_FEATURES = {
  free: [
    "컴카드 만들기·수정 무제한",
    "업계 표준 양식 7종 + AI 추천 월 3회",
    "컴카드 1장 다운로드(PNG·PDF)",
    "포트폴리오에 컴카드 1장 공개",
  ],
  pro: [
    "컴카드 다운로드 무제한",
    "AI 컴카드 추천 무제한",
    "포트폴리오에 컴카드 여러 장 공개",
    "포트폴리오에 사진(촬영 컨셉 자동 분류)·영상·경력 올리기",
    "언제든 구독 취소 · 7일 이내 미사용 시 전액 환불",
  ],
} as const;

export const formatKRW = (n: number) => `${n.toLocaleString("ko-KR")}원`;
