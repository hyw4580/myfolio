import LegalPage from "../components/LegalPage";
import { BUSINESS } from "@/lib/legal";
import { PLANS, formatKRW } from "@/lib/billing/plans";
import { REFUND_WINDOW_DAYS } from "@/lib/billing/refund";

export const metadata = { title: "환불정책 | myfolio" };

// ※ 초안입니다. 출시 전 법률 검토를 받으세요. 실제 처리 규칙: lib/billing/refund.ts (이 페이지와 같은 내용)
export default function RefundPage() {
  const monthly = formatKRW(PLANS.pro_monthly.priceKRW);
  return (
    <LegalPage
      title="환불정책"
      intro="Pro 구독은 마이페이지의 [구독 취소] 버튼 하나로 정리돼요. 취소하면 아래 기준에 따라 자동으로 전액 환불되거나, 이미 결제한 기간이 끝날 때 구독이 종료돼요."
      sections={[
        { title: `1. 결제 후 ${REFUND_WINDOW_DAYS}일 이내 + Pro 기능 미사용 → 전액 환불`, body: [
          `결제한 때부터 ${REFUND_WINDOW_DAYS}일 이내에 구독을 취소하고, 그동안 Pro 기능을 한 번도 쓰지 않았다면 결제 금액 전액이 바로 환불되고 구독이 종료돼요. 매달·매년 자동 결제된 경우에도 같아요.`,
          "Pro 기능을 쓴 것으로 보는 경우:",
          ["컴카드 다운로드", "무료 한도(1장)를 넘는 컴카드 공개", "갤러리·스냅 사진, 영상, 경력 추가"],
        ]},
        { title: "2. 그 밖의 월간 구독 → 기간 끝까지 이용 후 종료", body: [
          "취소하면 다음 결제가 되지 않고, 이미 결제한 달이 끝날 때까지 Pro 기능을 쓸 수 있어요. 이미 시작한 달의 요금은 환불되지 않아요.",
        ]},
        { title: "3. 그 밖의 연간 구독 → 기간 끝까지 이용, 또는 남은 금액 환불", body: [
          "기본은 월간과 같이 1년 기간이 끝날 때까지 쓰고 종료돼요.",
          `바로 끝내고 싶다면 [지금 끝내고 환불받기]를 고를 수 있어요. 결제 금액에서 이용한 개월 수 × 월간 정가(${monthly})를 뺀 금액을 환불하고 Pro는 즉시 종료돼요. 하루라도 쓴 달은 한 달로 계산해요.`,
          `예) ${formatKRW(PLANS.pro_yearly.priceKRW)} 결제 후 3개월째에 취소 → ${formatKRW(PLANS.pro_yearly.priceKRW)} − 3 × ${monthly} = ${formatKRW(PLANS.pro_yearly.priceKRW - 3 * PLANS.pro_monthly.priceKRW)} 환불`,
        ]},
        { title: "4. 취소 철회", body: [
          "기간 끝 종료를 선택한 뒤에도 기간이 끝나기 전에는 마이페이지에서 [취소 철회]로 계속 이용할 수 있어요. 환불이 끝난 구독은 되돌릴 수 없고, 다시 구독하면 새로 결제돼요.",
        ]},
        { title: "5. 회사 사정으로 이용하지 못한 경우", body: [
          "서비스 장애 등 회사 책임으로 유료 기능을 쓰지 못한 경우, 이용하지 못한 기간만큼 기간을 늘려 드리거나 환불해요.",
        ]},
        { title: "6. 환불 시기와 문의", body: [
          "환불은 결제한 카드로 바로 취소 요청되며, 카드사에 따라 실제 반영까지 3~7영업일이 걸릴 수 있어요.",
          `자동 처리가 안 되거나 궁금한 점이 있으면 ${BUSINESS.email}로 계정 이메일과 함께 알려 주세요.`,
          "앱 마켓(App Store·Google Play)에서 결제한 경우에는 각 마켓의 환불 절차를 따라요.",
        ]},
      ]}
    />
  );
}
