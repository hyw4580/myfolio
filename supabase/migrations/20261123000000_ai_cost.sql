-- ─────────────────────────────────────────────────────────────
-- AI 추천 비용 관리 (20261122000000_ops.sql 다음에 실행)
-- 1) 같은 사진·조건이면 저장된 추천을 다시 씀 (30일)
-- 2) 무료 회원 AI 추천 횟수 세기 (저장된 추천을 다시 쓴 건 세지 않음)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.ai_suggestions (
  key        text primary key,          -- 방향·장수·사진 주소·표시 항목의 해시
  result     jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ai_suggestions enable row level security;

create table if not exists public.ai_usage (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'comcard_suggest',
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_idx on public.ai_usage(user_id, created_at);
alter table public.ai_usage enable row level security;

-- 오래된 저장 추천 정리 (주간 작업이 purge_old_errors와 함께 호출)
create or replace function public.purge_old_ai()
returns void language sql security definer set search_path = public as $$
  delete from public.ai_suggestions where created_at < now() - interval '30 days';
  delete from public.ai_usage where created_at < now() - interval '400 days';
$$;
revoke all on function public.purge_old_ai() from public, anon, authenticated;
grant execute on function public.purge_old_ai() to service_role;
