# 결제(월 구독) 설정 가이드

코드는 모두 들어가 있고, 아래 설정을 넣으면 동작합니다. **설정 전에는 결제 제한이 꺼져 있어** 모든 기능을 무료로 쓸 수 있습니다.

## 1. 토스페이먼츠 (테스트 → 실서비스)
1. [토스페이먼츠](https://www.tosspayments.com) 회원가입 → 개발자센터 → **API 키** 메뉴
2. **API 개별 연동 키**를 사용 (결제위젯 키 `gck/gsk` 아님)
   - 테스트: `test_ck_...` (클라이언트 키), `test_sk_...` (시크릿 키)
   - 실서비스: 전자결제 계약 + **자동결제(빌링) 추가 계약** 후 `live_ck_...`, `live_sk_...`
3. 테스트 모드에서는 실제 돈이 나가지 않음 (본인인증 코드 `000000`)

## 2. Supabase
1. 대시보드 → SQL Editor → `supabase/migrations/20261116000000_billing.sql` 내용을 붙여넣고 실행
2. Project Settings → API → **service_role** 키 복사 (절대 외부 공개 금지)

## 3. 환경변수 (`.env.local` 과 Vercel → Settings → Environment Variables)
| 이름 | 값 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | `test_ck_...` | 브라우저에서 사용 |
| `TOSS_SECRET_KEY` | `test_sk_...` | 서버 전용 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 | 서버 전용 |
| `CRON_SECRET` | 아무 긴 임의 문자열 | 매일 자동결제 작업 보호용 |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | AI 추천 (별도) |
| `NEXT_PUBLIC_SITE_URL` | `https://내도메인` | 공유 링크 미리보기용 (도메인 연결 후) |
| `ADMIN_EMAILS` | `내이메일@gmail.com` | 관리자 페이지(/admin/voc) 접근 허용 (쉼표로 여러 명) |
| `RESEND_API_KEY` | `re_...` | 주간 VOC 보고 이메일 발송 ([resend.com](https://resend.com) 무료 가입) |
| `REPORT_EMAIL` | `내이메일@gmail.com` | 주간 보고 받을 주소 |
| `REPORT_FROM` | `myfolio <report@내도메인>` | 보내는 주소 (도메인 인증 후, 없으면 Resend 테스트 주소) |

## 4. 동작 방식
- **무료**: 컴카드 만들기·수정 무제한, 다운로드(PNG/PDF)는 카드 1장, 포트폴리오에 컴카드 1장 공개
- **Pro (월 4,900원 / 연 39,000원)**: 다운로드 무제한, 컴카드 여러 장 공개, 포트폴리오 게시물(갤러리·스냅·영상·경력·링크)
- 구독: 요금제 페이지에서 월간·연간 선택 → 카드 등록 → 즉시 첫 결제 → 이후 매달(연간은 매년) 같은 날 자동 결제
  (매일 01:00 UTC `vercel.json`의 cron이 `/api/cron/billing` 실행)
- 결제 실패 시 하루씩 유예하며 3번 재시도, 그래도 실패하면 만료
- 해지: 마이페이지에서 해지 예약 → 결제한 기간 끝까지 이용 후 만료
- 가격·혜택 문구: `lib/billing/plans.ts`

## 5. 실서비스 전 확인
- 사업자등록, 통신판매업 신고, 토스페이먼츠 자동결제 계약
- 이용약관·환불정책 페이지 (정기결제는 고지 의무가 있음)

## 6. 사용자 의견(VOC) 주간 보고
- Supabase SQL Editor에서 `supabase/migrations/20261117000000_feedback.sql` 실행
- 메뉴의 **의견 보내기** → `feedback` 테이블에 저장
- 매주 월요일 09:00(한국시간) `/api/cron/voc`가 지난 7일 의견을 AI(Claude)로 분석 → `voc_reports` 저장 → 이메일 발송
- 관리자 페이지 `/admin/voc`: 최신 보고서, 지난 보고서, 최근 의견, "지금 분석하기"
- 의견을 AI에 보낼 때 이메일·전화번호는 가려서 보냄. 개인정보처리방침에 "서비스 개선을 위한 의견 분석(AI 위탁)" 문구 추가 필요

## 사용 패턴 기록 (행동 분석)

- `supabase/migrations/20261119000000_events.sql` 실행 → `events` 테이블, `usage_summary`, `purge_old_events` 생성

## 구독 취소·환불

- `supabase/migrations/20261120000000_refund.sql` 실행 (events 다음)
- 마이페이지 [구독 취소] → 결제 7일 이내 + Pro 기능 미사용이면 토스 결제 취소로 **자동 전액 환불**, 아니면 기간 끝에 종료
- 연간은 [지금 끝내고 환불받기]로 남은 개월 환불 (결제액 − 이용 개월 × 4,900원)
- 규칙 코드: `lib/billing/refund.ts` (환불정책 페이지와 같은 내용 — 바꿀 때 둘 다 수정)
- 토스 결제 취소 API는 같은 시크릿 키 사용. 테스트 키로 먼저 확인
- 브라우저가 `/api/events`로 모아 보냄 (서버 키 `SUPABASE_SERVICE_ROLE_KEY` 없으면 그냥 버림)
- 이름·연락처·사진 주소는 기록하지 않음. 기기별 임의 번호(anon_id)와 화면 주소(쿼리 제거)만
- 컴카드 편집은 `editor_summary` 한 건으로 묶음: 머문 시간, 편집 종류별 횟수(사진 이동·크기, 글자, 색, 프리셋 바꾸기, 되돌리기 등), 끝난 방식(저장/다운로드/공유/떠남)
- 매주 VOC 보고서에 함께 들어가 AI가 이탈 지점·편집 패턴·양식/AI 추천 효과를 분석
- 180일 지난 기록은 주간 작업에서 자동 삭제
- 개인정보처리방침에 "서비스 개선을 위한 이용 기록(기기 식별용 임의 번호, 이용 화면, 기능 사용 횟수) 수집, 180일 보관" 문구 추가 필요

## 사용자 행동 → 추천 개선

- `supabase/migrations/20261121000000_template_performance.sql` 실행 (refund 다음)
- 방향·장수·양식별로 "다운로드·공유까지 간 비율"과 "평균 편집 횟수"를 최근 90일 기준으로 집계
- 템플릿 단계: 같은 조건 사용자가 20명 이상 쌓이면 완성률 높은 양식을 앞으로 정렬하고 ★ 표시 (적으면 업계 표준 순서 그대로)
- AI 추천: 같은 데이터와 "끝까지 간 카드의 인기 색 조합"을 참고 자료로 받아, 3안 중 하나는 검증된 양식으로 제안
- 서버가 1시간마다 새로 계산(캐시). 규칙 코드: `lib/comcard-ranking.ts`

## 사진 촬영 컨셉 · Pro 종료 시 숨김

- `supabase/migrations/20261124000000_photo_concepts.sql` 실행 (ai_cost 다음)
- **결제를 실제로 시작할 때** SQL 한 줄: `update public.app_flags set value = true where key = 'billing_enabled';`
  (이걸 켜기 전에는 Pro가 아니어도 포트폴리오 사진이 공개됨)
- 사진을 올리면 Haiku 5.5가 촬영 컨셉(10개 + 추가된 것)을 고름. 사용자가 고친 기록 → 자주 틀리는 패턴을 다음 판독에 자동 반영
- 관리자 `/admin/renewal` 아래 "사진 컨셉 AI 판독"에서 정확도·자주 고친 것·새 컨셉 후보(직접 입력 5명 이상) 확인 → [목록에 추가]
