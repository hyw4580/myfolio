"use client";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

export type BillingStatus = {
  configured: boolean;
  isPro?: boolean;
  plan?: string | null;
  status?: "inactive" | "active" | "past_due" | "expired";
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  exportedCardIds?: string[];
  cardLabel?: string | null;
};

/**
 * 내 구독 상태 불러오기.
 * 반환: [상태(로그인 안 했으면 null), 다시 불러오기, 불러오기 끝났는지]
 * 로그인했는데 서버 오류면 { configured: false } 로 돌려줘서 "로그인 안 함"과 구분.
 */
export function useBillingStatus(): [BillingStatus | null, () => void, boolean] {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/status", { cache: "no-store" })
      .then(async r => (r.status === 401 ? null : r.ok ? r.json() : { configured: false }))
      .then(j => { if (!cancelled) { setStatus(j); setLoaded(true); } })
      .catch(() => { if (!cancelled) { setStatus({ configured: false }); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [tick]);
  return [status, () => setTick(t => t + 1), loaded];
}

/** 카드 등록(빌링 인증) 창 열기 → 성공 시 /billing/success 로 돌아옴 */
export async function startSubscription(plan: "pro_monthly" | "pro_yearly" = "pro_monthly"): Promise<string | null> {
  track("subscribe_clicked", { plan });
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!clientKey) return "결제 기능이 아직 설정되지 않았어요.";
  const res = await fetch("/api/billing/prepare", { method: "POST" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return json.error ?? "결제를 시작하지 못했어요.";
  const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
  const toss = await loadTossPayments(clientKey);
  const payment = toss.payment({ customerKey: json.customerKey });
  const origin = window.location.origin;
  await payment.requestBillingAuth({
    method: "CARD",
    successUrl: `${origin}/billing/success?plan=${plan}`,
    failUrl: `${origin}/billing/fail`,
    customerEmail: json.customerEmail,
    customerName: json.customerName,
  });
  return null;
}

export const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "";
