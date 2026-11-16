-- ─────────────────────────────────────────────────────────────
-- 사진 촬영 컨셉 (20261123000000_ai_cost.sql 다음에 실행)
-- - 사진마다 컨셉(최대 2개). AI가 먼저 고르고(ai_concepts), 사용자가 고친 결과를 기록해 정확도를 높임
-- - 사용자가 직접 입력한 컨셉("c:라벨")이 여러 명에게서 쌓이면 운영자가 목록에 추가
-- - 갤러리·스냅을 "사진" 하나로 합침: 기존 스냅 사진은 '일상·스냅' 컨셉으로 옮김
-- ─────────────────────────────────────────────────────────────
alter table public.snaps add column if not exists concepts text[] not null default '{}';
alter table public.snaps add column if not exists ai_concepts text[];
update public.snaps set concepts = '{snap}' where category is distinct from 'gallery' and concepts = '{}';

-- 기본 10개 외에 운영자가 추가한 컨셉
create table if not exists public.photo_concepts (
  id         text primary key,            -- 예: 'kids'
  label      text not null unique,        -- 예: '키즈'
  hint       text,                        -- AI 판독용 설명
  created_at timestamptz not null default now()
);
alter table public.photo_concepts enable row level security;
drop policy if exists "photo_concepts: read all" on public.photo_concepts;
create policy "photo_concepts: read all" on public.photo_concepts for select using (true);

-- AI 판독 vs 사용자 최종 선택 (학습·정확도 측정용)
create table if not exists public.concept_feedback (
  id         bigserial primary key,
  snap_id    text,                     -- snaps.id (형식에 상관없이 문자로)
  user_id    uuid references auth.users(id) on delete cascade,
  ai         text[] not null,
  final      text[] not null,
  created_at timestamptz not null default now()
);
create index if not exists concept_feedback_created_idx on public.concept_feedback(created_at);
alter table public.concept_feedback enable row level security;

-- 판독 성과: 컨셉별 정확도, 자주 바뀌는 쌍(AI→사용자), 새 컨셉 후보(직접 입력)
create or replace function public.concept_stats(p_days int default 180)
returns jsonb language sql stable security definer set search_path = public as $$
  with latest as (   -- 사진마다 마지막 수정만
    select distinct on (snap_id) snap_id, ai, final, created_at
    from public.concept_feedback where created_at >= now() - make_interval(days => p_days)
    order by snap_id, created_at desc
  ),
  f as (             -- 고친 사진 + 고치지 않고 그대로 둔 사진(= AI가 맞힘)
    select ai, final from latest
    union all
    select s.ai_concepts, s.concepts from public.snaps s
    where s.ai_concepts is not null and cardinality(s.ai_concepts) > 0
      and not exists (select 1 from public.concept_feedback cf where cf.snap_id = s.id::text)
  ),
  ai_each as (select unnest(f.ai) as c, f.final from f),
  per as (
    select c, count(*) as suggested, count(*) filter (where c = any(final)) as kept from ai_each group by c
  ),
  swaps as (   -- AI가 고른 것 중 빠진 것 → 사용자가 새로 넣은 것
    select a.c as from_c, b.c as to_c, count(*) as n
    from f, unnest(f.ai) a(c), unnest(f.final) b(c)
    where not (a.c = any(f.final)) and not (b.c = any(f.ai))
    group by 1, 2
  ),
  customs as (
    select lower(trim(substr(c, 3))) as label, count(distinct s.user_id) as users
    from public.snaps s, unnest(s.concepts) c
    where c like 'c:%'
    group by 1
  )
  select jsonb_build_object(
    'samples', (select count(*) from f),
    'exact', (select count(*) from f where ai @> final and final @> ai),
    'per_concept', coalesce((select jsonb_agg(jsonb_build_object('concept', c, 'suggested', suggested, 'kept', kept) order by suggested desc) from per), '[]'::jsonb),
    'swaps', coalesce((select jsonb_agg(jsonb_build_object('from', from_c, 'to', to_c, 'n', n) order by n desc) from (select * from swaps order by n desc limit 15) t), '[]'::jsonb),
    'custom_candidates', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'users', users) order by users desc)
                                   from (select * from customs order by users desc limit 20) t), '[]'::jsonb)
  );
$$;
revoke all on function public.concept_stats(int) from public, anon, authenticated;
grant execute on function public.concept_stats(int) to service_role;

-- ── Pro가 끝나면 포트폴리오 사진 숨김 (삭제 안 함) ──
-- 결제를 실제로 시작하기 전에는 모두 공개. 결제 오픈 시 아래 한 줄 실행:
--   update public.app_flags set value = true where key = 'billing_enabled';
create table if not exists public.app_flags (key text primary key, value boolean not null default false);
insert into public.app_flags(key, value) values ('billing_enabled', false) on conflict (key) do nothing;
alter table public.app_flags enable row level security;

create or replace function public.billing_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.app_flags where key = 'billing_enabled'), false);
$$;

drop policy if exists "snaps: visible while pro" on public.snaps;
create policy "snaps: visible while pro" on public.snaps
  as restrictive for select
  using (user_id = auth.uid() or not public.billing_enabled() or public.is_pro(user_id));
