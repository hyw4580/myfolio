import "server-only";

/**
 * 토스페이먼츠 자동결제(빌링) 서버 호출.
 * 문서: https://docs.tosspayments.com/guides/v2/billing/integration
 * - 빌링키 발급: POST /v1/billing/authorizations/issue  { authKey, customerKey } → billingKey
 * - 빌링키 결제: POST /v1/billing/{billingKey}          { customerKey, amount, orderId, orderName, ... }
 * - 인증: Authorization: Basic base64(시크릿키 + ":")
 * 시크릿 키는 API 개별 연동 키(test_sk_ / live_sk_)를 사용.
 */
const API = "https://api.tosspayments.com/v1";

export class TossError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

function authHeader(): string {
  const secret = process.env.TOSS_SECRET_KEY?.replace(/^﻿/, "").trim();
  if (!secret) throw new TossError("NOT_CONFIGURED", "TOSS_SECRET_KEY가 설정되지 않았어요.", 503);
  return "Basic " + Buffer.from(`${secret}:`).toString("base64");
}

async function tossPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // 승인에 최대 60초까지 걸릴 수 있음 (문서)
    signal: AbortSignal.timeout(65_000),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new TossError(json.code ?? "UNKNOWN", json.message ?? "결제 요청에 실패했어요.", res.status);
  return json as T;
}

export type TossBilling = {
  billingKey: string;
  customerKey: string;
  method?: string;
  card?: { issuerCode?: string; number?: string; cardType?: string } | null;
};
export type TossPayment = {
  paymentKey: string;
  orderId: string;
  status: string;          // DONE 이면 승인 완료
  approvedAt: string | null;
  totalAmount: number;
};

export const issueBillingKey = (authKey: string, customerKey: string) =>
  tossPost<TossBilling>("/billing/authorizations/issue", { authKey, customerKey });

export const chargeBilling = (billingKey: string, p: {
  customerKey: string; amount: number; orderId: string; orderName: string; customerEmail?: string | null; customerName?: string | null;
}) => tossPost<TossPayment>(`/billing/${encodeURIComponent(billingKey)}`, p);

/**
 * 결제 취소(환불) — POST /v1/payments/{paymentKey}/cancel
 * cancelAmount를 빼면 전액 취소. 같은 요청이 두 번 가도 한 번만 처리되도록 Idempotency-Key 사용.
 */
export async function cancelPayment(paymentKey: string, p: { cancelReason: string; cancelAmount?: number; idempotencyKey: string }) {
  const res = await fetch(`${API}/payments/${encodeURIComponent(paymentKey)}/cancel`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json", "Idempotency-Key": p.idempotencyKey },
    body: JSON.stringify({ cancelReason: p.cancelReason, ...(p.cancelAmount ? { cancelAmount: p.cancelAmount } : {}) }),
    signal: AbortSignal.timeout(65_000),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new TossError(json.code ?? "UNKNOWN", json.message ?? "환불 요청에 실패했어요.", res.status);
  return json as TossPayment & { balanceAmount?: number };
}

/** 빌링키 삭제 (회원 탈퇴 시) — DELETE /v1/billing/{billingKey} */
export async function deleteBillingKey(billingKey: string): Promise<void> {
  const res = await fetch(`${API}/billing/${encodeURIComponent(billingKey)}`, {
    method: "DELETE", headers: { Authorization: authHeader() }, signal: AbortSignal.timeout(30_000), cache: "no-store",
  });
  if (!res.ok && res.status !== 404) {
    const json = await res.json().catch(() => ({}));
    throw new TossError(json.code ?? "UNKNOWN", json.message ?? "빌링키 삭제 실패", res.status);
  }
}

/** 주문번호: 6~64자, 영문·숫자·-_= 만 허용, 주문마다 고유 */
export function newOrderId(prefix = "pro"): string {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

/** 고객 키: 22~50자, 특수문자(-_=.@) 1개 이상, 추측 불가능한 값 */
export function newCustomerKey(): string {
  return `cus_${crypto.randomUUID()}`; // 40자, '_' '-' 포함
}

/** 다음 결제일 (n개월 뒤) */
export function addMonths(from: Date, n: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0); // 31일 → 다음 달 말일
  return d;
}
