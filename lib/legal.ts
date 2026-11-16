/**
 * 사업자 정보 — 사업자 등록·통신판매업 신고 후 채워 주세요.
 * (토스페이먼츠 심사·앱스토어 심사 때 사이트 하단과 약관에 표시돼야 함)
 */
export const BUSINESS = {
  serviceName: "myfolio",
  companyName: "[상호 입력 필요]",
  ceo: "[대표자 입력 필요]",
  bizNumber: "[사업자등록번호 입력 필요]",
  mailOrderNumber: "[통신판매업 신고번호 입력 필요]",
  address: "[사업장 주소 입력 필요]",
  email: "[문의 이메일 입력 필요]",
  phone: "[대표 전화 입력 필요]",
  privacyOfficer: "[개인정보 보호책임자 이름 입력 필요]",
} as const;

/** 약관 시행일·개정일 (내용을 바꾸면 날짜도 바꾸기) */
export const LEGAL_EFFECTIVE_DATE = "2026년 12월 1일";
