# 자동 개선(리뉴얼) 운영

```
매일 09:30  자체 점검 (/api/cron/health) ── 문제 있으면 즉시 메일
매주 월 09:00  주간 보고 (/api/cron/voc)
              의견 + 사용 패턴 + 오류 + 점검 → AI 분석
              → 안정화 제안(A)·아이디어 기획서(B)를 "승인 대기"로 등록 → 메일
운영자        /admin/renewal 에서 승인·보류·거절 (승인 안 하면 아무것도 안 함)
매주 화 09:00  Claude 예약 작업 (클라우드)
              승인 항목만 가져와 브랜치에서 작업 → 검사 → PR → 상태 기록
운영자        PR 확인 후 합치기 → Vercel 자동 배포
```

## 준비 (한 번만)

1. Supabase SQL: `supabase/migrations/20261122000000_ops.sql` 실행 (template_performance 다음)
2. Vercel 환경변수 `AGENT_TOKEN`: 32자 이상 임의 문자열 (예: 터미널에서 `openssl rand -hex 32`)
3. 지금 작업을 GitHub에 올리기 (예약 작업은 GitHub 저장소에서 시작)
4. 클라우드 예약 작업 만들기 — Claude Code에서 `/schedule` 실행 후 아래 내용으로:
   - 저장소: `hyw4580/myfolio`
   - 일정: 매주 화요일 09:00 (한국시간) = cron `0 0 * * 2` (UTC)
   - 환경변수: `AGENT_TOKEN`, `SITE_URL`(배포 주소)
   - 지시문: 아래 "예약 작업 지시문" 그대로

## 예약 작업 지시문

```
너는 myfolio(모델 컴카드·디지털 명함 서비스, Next.js 16 + Supabase)의 주간 개선 담당이다. 모든 보고와 PR 설명은 쉬운 한국어로.

1) 승인 항목 가져오기
   curl -s -H "Authorization: Bearer $AGENT_TOKEN" "$SITE_URL/api/agent/renewal"
   items가 비어 있으면 4)의 자체 점검만 하고 끝낸다. rejected 목록은 하지 말아야 할 방향으로 참고한다.

2) 항목마다 (승인 순, 최대 5건)
   - 시작 기록: POST {"id":ID,"status":"in_progress"} 를 $SITE_URL/api/agent/renewal 로 (같은 인증 헤더)
   - main에서 새 브랜치 renewal/ID-짧은이름 을 만들고, plan과 owner_note(운영자 조건)를 지켜 구현한다.
     범위를 넓히지 않는다. plan에 없는 큰 변경이 필요하면 구현하지 말고 failed로 이유를 남긴다.
   - 검사: npx tsc --noEmit, npx eslint (기존 오류 수가 늘면 안 됨), npx next build. 레이아웃 등 규칙이 있는 곳은 관련 테스트 스크립트를 만들어 확인.
   - 통과하면 커밋·푸시하고 PR을 연다 (main 대상, 제목 "[리뉴얼 #ID] 제목"). PR 본문: 무엇을 왜 바꿨는지, 확인한 것, 운영자가 직접 확인할 것.
   - 완료 기록: POST {"id":ID,"status":"done","pr_url":"PR 주소","agent_note":"요약 2~3줄"}
   - 실패하면: POST {"id":ID,"status":"failed","agent_note":"이유와 필요한 결정"}

3) 절대 하지 않는 것
   - PR 합치기·배포·main에 직접 푸시
   - Supabase SQL 실행 (필요하면 supabase/migrations/에 새 파일만 만들고 PR에 "운영자 실행 필요"로 표시)
   - 가격·약관·환불 규칙·결제 흐름 변경 (항목에 명시되어 승인된 경우만)
   - 비밀 키 읽기·출력·커밋, 개인정보가 담긴 데이터 조회
   - 승인되지 않은 일 하기

4) 코드 자체 점검 (매주)
   - npm audit --omit=dev (높음 이상), npx tsc, eslint, next build 결과를 확인
   - 문제가 있으면 PR을 만들지 말고 "자체 점검 결과" 이슈를 하나 열어 요약한다 (다음 주 제안서에서 운영자가 승인하면 고침)
```

## 안전장치
- 승인은 관리자 화면에서 운영자만 가능 (예약 작업의 API로는 승인 불가)
- 위험 높음(결제·로그인·개인정보)은 일괄 승인에서 제외
- 한 번에 최대 5건, 배포는 운영자가 PR을 합칠 때만
