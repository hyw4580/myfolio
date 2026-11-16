-- ─────────────────────────────────────────────────────────────
-- 사용자 의견(VOC) 수집 + AI 주간 분석 보고서
-- Supabase 대시보드 → SQL Editor에 붙여넣어 한 번 실행하세요.
-- 두 테이블 모두 브라우저에서 직접 접근 불가(정책 없음) — 서버만 읽고 씀
-- ─────────────────────────────────────────────────────────────

create table if not exists public.feedback (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete set null,
  email      text,
  category   text not null check (category in ('bug', 'inconvenience', 'request', 'praise', 'other')),
  message    text not null check (char_length(message) between 2 and 2000),
  page       text,            -- 의견을 보낸 화면 경로
  platform   text,            -- web / ios / android
  user_agent text,
  status     text not null default 'new' check (status in ('new', 'reviewed', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback(created_at desc);
alter table public.feedback enable row level security;

create table if not exists public.voc_reports (
  id             bigserial primary key,
  period_start   timestamptz not null,
  period_end     timestamptz not null,
  feedback_count int not null,
  metrics        jsonb not null default '{}'::jsonb,
  report         jsonb,         -- AI 분석 결과 (의견이 없으면 null)
  emailed_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists voc_reports_created_idx on public.voc_reports(created_at desc);
alter table public.voc_reports enable row level security;
