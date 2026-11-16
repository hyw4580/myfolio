-- ─────────────────────────────────────────────────────────────
-- 자동 개선 운영 (20261121000000_template_performance.sql 다음에 실행)
-- 1) 오류 수집  2) 매일 자체 점검 기록  3) 리뉴얼 항목(제안·아이디어 → 승인 → 작업)
-- 모두 서버만 읽고 씀 (브라우저 직접 접근 불가)
-- ─────────────────────────────────────────────────────────────

-- 1) 오류 (화면·서버). 같은 오류는 fingerprint로 묶어 셈. 90일 뒤 자동 삭제
create table if not exists public.app_errors (
  id          bigserial primary key,
  fingerprint text not null,           -- 오류 종류 식별 (메시지+위치 해시)
  source      text not null check (source in ('client', 'server')),
  message     text not null,
  stack       text,
  path        text,                    -- 화면 주소 (쿼리 제거)
  route       text,                    -- 서버: 라우트 파일 경로
  platform    text,
  anon_id     text,
  created_at  timestamptz not null default now()
);
create index if not exists app_errors_created_idx on public.app_errors(created_at);
create index if not exists app_errors_fp_idx on public.app_errors(fingerprint, created_at);
alter table public.app_errors enable row level security;

-- 기간 안 오류 요약: 종류별 횟수·영향받은 기기 수·처음/마지막 시각
create or replace function public.error_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*) from public.app_errors where created_at >= p_from and created_at < p_to),
    'top', coalesce((select jsonb_agg(x order by (x->>'count')::int desc) from (
      select jsonb_build_object(
        'fingerprint', fingerprint, 'source', min(source), 'message', min(left(message, 200)),
        'path', mode() within group (order by path), 'route', min(route),
        'count', count(*), 'devices', count(distinct anon_id),
        'first_seen', min(created_at), 'last_seen', max(created_at),
        'new', not exists (select 1 from public.app_errors o where o.fingerprint = a.fingerprint and o.created_at < p_from)
      ) as x
      from public.app_errors a where created_at >= p_from and created_at < p_to
      group by fingerprint order by count(*) desc limit 15) t), '[]'::jsonb)
  );
$$;
revoke all on function public.error_summary(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.error_summary(timestamptz, timestamptz) to service_role;

-- 2) 매일 자체 점검 결과
create table if not exists public.health_checks (
  id         bigserial primary key,
  ok         boolean not null,
  results    jsonb not null,           -- [{ name, ok, ms, detail }]
  created_at timestamptz not null default now()
);
create index if not exists health_checks_created_idx on public.health_checks(created_at desc);
alter table public.health_checks enable row level security;

-- 3) 리뉴얼 항목
--    lane: stabilize(안정화 — AI가 찾음) / feature(새 기능 — 운영자 아이디어 또는 AI 제안)
--    status 흐름: idea(아이디어 접수) → proposed(기획·제안 완료, 승인 대기) → approved → in_progress → done
--                 (held 보류 / rejected 거절 / failed 작업 실패 — 다시 approved로 돌릴 수 있음)
create table if not exists public.renewal_items (
  id           bigserial primary key,
  lane         text not null check (lane in ('stabilize', 'feature')),
  source       text not null default 'ai' check (source in ('ai', 'owner')),
  title        text not null,
  problem      text,                   -- 무엇이 문제/요청인지
  evidence     text,                   -- 근거 (의견 수·이탈률·오류 횟수 등)
  plan         text,                   -- 무엇을 어떻게 바꿀지 (기획)
  risk         text check (risk in ('low', 'medium', 'high')),
  effort       text check (effort in ('small', 'medium', 'large')),
  stage        text,                   -- MODEL / CONNECT / PLATFORM
  status       text not null default 'proposed'
               check (status in ('idea', 'proposed', 'approved', 'held', 'rejected', 'in_progress', 'done', 'failed')),
  owner_note   text,                   -- 운영자 메모 (승인 조건 등)
  agent_note   text,                   -- 작업 결과 요약
  pr_url       text,
  report_id    bigint references public.voc_reports(id) on delete set null,
  approved_at  timestamptz,
  done_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists renewal_items_status_idx on public.renewal_items(status, created_at desc);
alter table public.renewal_items enable row level security;

-- 오래된 오류 정리 (주간 작업이 호출)
create or replace function public.purge_old_errors()
returns void language sql security definer set search_path = public as $$
  delete from public.app_errors where created_at < now() - interval '90 days';
  delete from public.health_checks where created_at < now() - interval '90 days';
$$;
revoke all on function public.purge_old_errors() from public, anon, authenticated;
grant execute on function public.purge_old_errors() to service_role;
