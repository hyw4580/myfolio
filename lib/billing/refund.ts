/**
 * 구독 취소 규칙 (환불정책과 같은 내용)
 * 1) 결제 후 7일 이내 + Pro 기능 안 씀 → 바로 전액 환불, 구독 즉시 종료
 * 2) 그 밖의 월간 → 이번 기간 끝까지 쓰고 종료 (환불 없음)
 * 3) 그 밖의 연간 → 기본은 기간 끝까지 쓰고 종료. 원하면 "남은 개월 환불"
 *    = 결제 금액 − 이용한 개월 수 × 월간 정가 (하루라도 쓴 달은 한 달)
 *
 * 이 파일의 계산 함수는 서버·화면이 같이 씀. DB 조회는 refund-server.ts.
 */
import { PLANS, FREE_AI_MONTHLY_LIMIT, FREE_FEATURED_LIMIT, planOf } from "./plans";

export const REFUND_WINDOW_DAYS = 7;

/** 결제 시점의 사용 상태 (payments.usage_baseline) */
export type UsageBaseline = { snapIds: string[]; videos: number; careerHash: string; featured: number };
/** 지금 사용 상태 + 결제 후 다운로드 수 */
export type UsageNow = UsageBaseline & { exportsSincePayment: number; aiSincePayment?: number };

/** 결제 후 Pro 기능을 썼는지 — 어떤 걸 썼는지도 돌려줌 (안내 문구용) */
export function proFeaturesUsed(base: UsageBaseline | null, now: UsageNow): string[] {
  const used: string[] = [];
  if (now.exportsSincePayment > 0) used.push("컴카드 다운로드");
  if ((now.aiSincePayment ?? 0) > FREE_AI_MONTHLY_LIMIT) used.push("AI 추천 무제한");
  if (!base) return used.length ? used : ["이전 결제 기록 확인 불가"]; // 기준점이 없으면 안전하게 "사용함"으로
  const before = new Set(base.snapIds);
  if (now.snapIds.some(id => !before.has(id))) used.push("갤러리·스냅 사진 올리기");
  if (now.videos > base.videos) used.push("영상 추가");
  if (now.careerHash !== base.careerHash && now.careerHash !== "") used.push("경력 작성");
  if (now.featured > Math.max(FREE_FEATURED_LIMIT, base.featured)) used.push("컴카드 여러 장 공개");
  return used;
}

/** 시작일부터 지금까지 "시작된 달" 수 (하루라도 쓰면 1달) */
export function monthsStarted(start: Date, now: Date): number {
  let m = 0;
  while (m < 120) {
    const d = new Date(start);
    const day = d.getDate();
    d.setMonth(d.getMonth() + m);
    if (d.getDate() < day) d.setDate(0);
    if (d > now) break;
    m++;
  }
  return Math.max(1, m);
}

export type CancelOption =
  | { kind: "full_refund"; amount: number }
  | { kind: "period_end"; until: string; partialRefund: number | null; usedMonths: number | null; usedFeatures: string[] };

export function decideCancel(p: {
  plan: string; paidAmount: number; paidAt: Date; periodEnd: Date; now: Date; usedFeatures: string[]; alreadyRefunded: boolean;
}): CancelOption {
  const days = (p.now.getTime() - p.paidAt.getTime()) / 86_400_000;
  if (!p.alreadyRefunded && days <= REFUND_WINDOW_DAYS && p.usedFeatures.length === 0) {
    return { kind: "full_refund", amount: p.paidAmount };
  }
  const plan = planOf(p.plan);
  let partialRefund: number | null = null, usedMonths: number | null = null;
  if (plan.id === "pro_yearly" && !p.alreadyRefunded) {
    usedMonths = monthsStarted(p.paidAt, p.now);
    partialRefund = Math.max(0, p.paidAmount - usedMonths * PLANS.pro_monthly.priceKRW);
    if (partialRefund === 0) partialRefund = null;
  }
  return { kind: "period_end", until: p.periodEnd.toISOString(), partialRefund, usedMonths, usedFeatures: p.usedFeatures };
}
