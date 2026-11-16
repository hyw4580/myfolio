-- ─────────────────────────────────────────────────────────────
-- 사용 패턴 기록(행동 이벤트) + 주간 집계 함수
-- Supabase SQL Editor에서 한 번 실행하세요.
-- 개인정보(이름·연락처)는 저장하지 않고, 기기별 임의 번호(anon_id)로만 구분합니다.
-- 브라우저에서 직접 읽기·쓰기 불가(정책 없음) — 서버만 사용, 180일 지나면 자동 삭제(주간 작업: purge_old_events)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.events (
  id         bigserial primary key,
  anon_id    text not null,           -- 기기별 임의 번호
  user_id    uuid references auth.users(id) on delete set null,
  session_id text,
  name       text not null,
  props      jsonb not null default '{}'::jsonb,
  path       text,
  platform   text,                    -- web / ios / android
  created_at timestamptz not null default now()
);
create index if not exists events_created_idx on public.events(created_at);
create index if not exists events_name_created_idx on public.events(name, created_at);
create index if not exists events_user_idx on public.events(user_id, created_at);
create index if not exists events_anon_idx on public.events(anon_id, created_at);
alter table public.events enable row level security;

-- 주간 사용 패턴 집계 (서버만 호출) — 단계별 사용자 수, 기능 사용, 기기, 많이 본 화면, 공유 효과
create or replace function public.usage_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  with e as (
    select * from public.events where created_at >= p_from and created_at < p_to
  ),
  -- 재방문 계산용: 가입 완료한 사람(가입 시각, 계정, 기기)
  signups as (
    select distinct on (coalesce(user_id::text, anon_id)) user_id, anon_id, created_at as signed_at
    from public.events where name = 'signup_completed'
    order by coalesce(user_id::text, anon_id), created_at
  ),
  -- 가입 후 N일 안에 다시 왔는지 / 컴카드를 고쳤는지 (가입 당일은 제외)
  retention as (
    select s.signed_at,
      exists (select 1 from public.events x where (x.user_id = s.user_id or x.anon_id = s.anon_id)
              and x.created_at >= s.signed_at + interval '1 day' and x.created_at < s.signed_at + interval '7 days') as back7,
      exists (select 1 from public.events x where (x.user_id = s.user_id or x.anon_id = s.anon_id)
              and x.name in ('card_saved', 'editor_summary')
              and x.created_at >= s.signed_at + interval '1 day' and x.created_at < s.signed_at + interval '7 days') as edit7,
      exists (select 1 from public.events x where (x.user_id = s.user_id or x.anon_id = s.anon_id)
              and x.created_at >= s.signed_at + interval '1 day' and x.created_at < s.signed_at + interval '30 days') as back30,
      exists (select 1 from public.events x where (x.user_id = s.user_id or x.anon_id = s.anon_id)
              and x.name in ('card_saved', 'editor_summary')
              and x.created_at >= s.signed_at + interval '1 day' and x.created_at < s.signed_at + interval '30 days') as edit30
    from signups s
    where s.signed_at >= p_to - interval '60 days' and s.signed_at < p_to - interval '7 days'
  ),
  actors as (select name, props, anon_id from e)
  select jsonb_build_object(
    'funnel', jsonb_build_object(
      'visited',         (select count(distinct anon_id) from e where name = 'page_view'),
      'signed_up',       (select count(distinct anon_id) from e where name = 'signup_completed'),
      'started_card',    (select count(distinct anon_id) from e where name = 'comcard_step' and props->>'step' = 'count'),
      'uploaded_photos', (select count(distinct anon_id) from e where name = 'photo_uploaded'),
      'chose_template',  (select count(distinct anon_id) from e where name = 'template_chosen'),
      'saved_card',      (select count(distinct anon_id) from e where name = 'card_saved'),
      'downloaded_or_shared', (select count(distinct anon_id) from e where name in ('card_downloaded', 'card_published', 'share_clicked')),
      'subscribed',      (select count(distinct anon_id) from e where name = 'subscribe_completed')
    ),
    -- 가입 완료율: 가입 화면을 본 기기 중 실제로 가입을 마친 비율
    'signup', jsonb_build_object(
      'viewed',    (select count(distinct anon_id) from e where name = 'signup_view'),
      'completed', (select count(distinct anon_id) from e where name = 'signup_completed')
    ),
    -- 재방문·수정률: 7일 지표는 기간 끝 기준 7~14일 전 가입자, 30일 지표는 30~60일 전 가입자
    'retention', jsonb_build_object(
      'd7_cohort',  (select count(*) from retention where signed_at >= p_to - interval '14 days'),
      'd7_return',  (select count(*) from retention where signed_at >= p_to - interval '14 days' and back7),
      'd7_edit',    (select count(*) from retention where signed_at >= p_to - interval '14 days' and edit7),
      'd30_cohort', (select count(*) from retention where signed_at < p_to - interval '30 days'),
      'd30_return', (select count(*) from retention where signed_at < p_to - interval '30 days' and back30),
      'd30_edit',   (select count(*) from retention where signed_at < p_to - interval '30 days' and edit30)
    ),
    'comcard_steps', coalesce((select jsonb_object_agg(step, n) from (
        select props->>'step' as step, count(distinct anon_id) as n from e where name = 'comcard_step' group by 1) s), '{}'::jsonb),
    'template_sources', coalesce((select jsonb_object_agg(src, n) from (
        select coalesce(props->>'source', 'unknown') as src, count(*) as n from e where name = 'template_chosen' group by 1) s), '{}'::jsonb),
    'templates', coalesce((select jsonb_object_agg(t, n) from (
        select coalesce(props->>'template', 'unknown') as t, count(*) as n from e where name = 'template_chosen' group by 1) s), '{}'::jsonb),
    'editor_changes', coalesce((select jsonb_object_agg(src, n) from (
        select coalesce(props->>'source', 'unknown') as src, count(*) as n from e where name = 'layout_applied' group by 1) s), '{}'::jsonb),
    'ai_suggest_requests', (select count(*) from e where name = 'ai_suggest_requested'),
    'paywall', coalesce((select jsonb_object_agg(r, n) from (
        select coalesce(props->>'reason', 'limit') as r, count(*) as n from e where name = 'paywall_shown' group by 1) s), '{}'::jsonb),
    'downloads', coalesce((select jsonb_object_agg(k, n) from (
        select coalesce(props->>'kind', '?') as k, count(*) as n from e where name = 'card_downloaded' group by 1) s), '{}'::jsonb),
    'pricing', jsonb_build_object(
      'viewed',  (select count(distinct anon_id) from e where name = 'pricing_viewed'),
      'clicked', (select count(distinct anon_id) from e where name = 'subscribe_clicked'),
      'completed', (select count(distinct anon_id) from e where name = 'subscribe_completed'),
      'plans', coalesce((select jsonb_object_agg(p, n) from (
          select coalesce(props->>'plan', '?') as p, count(*) as n from e where name = 'subscribe_clicked' group by 1) s), '{}'::jsonb)
    ),
    'sharing', jsonb_build_object(
      'share_clicks',      (select count(*) from e where name = 'share_clicked'),
      'public_card_views', (select count(*) from e where name = 'public_view' and props->>'kind' = 'card' and coalesce((props->>'owner')::boolean, false) = false),
      'public_profile_views', (select count(*) from e where name = 'public_view' and props->>'kind' = 'profile' and coalesce((props->>'owner')::boolean, false) = false),
      'vcard_downloads',   (select count(*) from e where name = 'vcard_downloaded'),
      'qr_opened',         (select count(*) from e where name = 'qr_opened'),
      'signups_from_share', (select count(distinct anon_id) from e where name = 'signup_completed' and props->>'ref' in ('card', 'profile'))
    ),
    'platforms', coalesce((select jsonb_object_agg(pf, n) from (
        select coalesce(platform, 'web') as pf, count(distinct anon_id) as n from e where name = 'page_view' group by 1) s), '{}'::jsonb),
    'top_pages', coalesce((select jsonb_agg(jsonb_build_object('page', pg, 'views', n) order by n desc) from (
        select case
                 when path = '/' then '/'
                 when path ~ '^/card/' then '/card/:id (공유 카드)'
                 when path ~ '^/model/' then '/model/:id (명함)'
                 when path ~ '^/(comcard|mypage|pricing|login|signup|gallery|billing|admin|auth|terms|privacy|refund)(/|$)' then regexp_replace(path, '^(/[^/]+).*$', '\1')
                 else '/:이름 (명함)'
               end as pg,
               count(*) as n
        from e where name = 'page_view' group by 1 order by 2 desc limit 10) s), '[]'::jsonb),
    -- 템플릿 선택: 방향·장수·출처(AI/프리셋/기본)별
    'template_combos', coalesce((select jsonb_agg(jsonb_build_object('canvas', cv, 'count', cnt, 'source', src, 'template', t, 'n', n) order by n desc) from (
        select props->>'canvas' as cv, props->>'count' as cnt, props->>'source' as src, props->>'template' as t, count(*) as n
        from e where name = 'template_chosen' group by 1, 2, 3, 4 order by 5 desc limit 30) s), '[]'::jsonb),
    'ai_suggest_where', coalesce((select jsonb_object_agg(w, n) from (
        select coalesce(props->>'where', '?') as w, count(*) as n from e where name = 'ai_suggest_requested' group by 1) s), '{}'::jsonb),
    -- 컴카드 편집 과정 패턴 (편집기 1회 체류 = editor_summary 1건)
    'editor', jsonb_build_object(
      'sessions',        (select count(*) from e where name = 'editor_summary'),
      'outcomes',        coalesce((select jsonb_object_agg(o, n) from (
                            select coalesce(props->>'outcome', '?') as o, count(*) as n from e where name = 'editor_summary' group by 1) s), '{}'::jsonb),
      'median_seconds',  (select percentile_cont(0.5) within group (order by (props->>'seconds')::numeric) from e where name = 'editor_summary'),
      'avg_edits',       (select round(avg((props->>'edits')::numeric), 1) from e where name = 'editor_summary'),
      'no_edit_sessions', (select count(*) from e where name = 'editor_summary' and coalesce((props->>'edits')::int, 0) = 0),
      'undo_or_reset_sessions', (select count(*) from e where name = 'editor_summary'
                                   and (coalesce((props->>'n_undo')::int, 0) + coalesce((props->>'n_reset')::int, 0)) > 0),
      -- 무엇을 가장 많이 고치나 (사진 이동/크기, 글자 이동/크기, 색, 굵기, 프리셋 바꾸기, 되돌리기 등)
      'edit_kinds',      coalesce((select jsonb_object_agg(k, n) from (
                            select substr(kv.key, 3) as k, sum((kv.value #>> '{}')::numeric) as n
                            from e, jsonb_each(e.props) kv
                            where e.name = 'editor_summary' and kv.key like 'n\_%'
                            group by 1) s), '{}'::jsonb),
      -- 시작 방식별(AI 추천/프리셋/기본/다시 열기): 체류·편집량·다운로드까지 간 비율
      'by_source',       coalesce((select jsonb_object_agg(src, jsonb_build_object('sessions', n, 'avg_edits', ae, 'median_seconds', ms, 'downloaded_or_shared', ds)) from (
                            select coalesce(props->>'source', '?') as src, count(*) as n,
                                   round(avg((props->>'edits')::numeric), 1) as ae,
                                   percentile_cont(0.5) within group (order by (props->>'seconds')::numeric) as ms,
                                   count(*) filter (where props->>'outcome' in ('downloaded', 'shared')) as ds
                            from e where name = 'editor_summary' group by 1) s), '{}'::jsonb),
      -- 양식별 편집량: 많이 고치는 양식 = 기본 배치가 마음에 안 드는 양식
      'by_template',     coalesce((select jsonb_object_agg(t, jsonb_build_object('sessions', n, 'avg_edits', ae)) from (
                            select coalesce(props->>'template', '?') as t, count(*) as n, round(avg((props->>'edits')::numeric), 1) as ae
                            from e where name = 'editor_summary' group by 1) s), '{}'::jsonb)
    ),
    'feedback_sent', (select count(*) from e where name = 'feedback_sent'),
    'total_events', (select count(*) from e)
  );
$$;
revoke all on function public.usage_summary(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.usage_summary(timestamptz, timestamptz) to service_role;

-- 180일 지난 기록 삭제 (주간 보고 작업이 호출)
create or replace function public.purge_old_events()
returns void language sql security definer set search_path = public as $$
  delete from public.events where created_at < now() - interval '180 days';
$$;
revoke all on function public.purge_old_events() from public, anon, authenticated;
grant execute on function public.purge_old_events() to service_role;
