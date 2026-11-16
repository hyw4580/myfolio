-- ─────────────────────────────────────────────────────────────
-- 사용자 행동 → 추천 개선 (20261120000000_refund.sql 다음에 실행)
-- 방향·장수·양식별로 "실제로 다운로드·공유까지 간 비율"과 "얼마나 고쳤는지"를 집계하고,
-- 끝까지 간 카드들의 색·굵기 조합을 모은다. 서버가 이 결과로 양식 순서와 AI 추천을 조정.
-- 개인을 알아볼 수 있는 정보는 다루지 않음(기기별 임의 번호로만 묶어 셈).
-- ─────────────────────────────────────────────────────────────
create or replace function public.template_performance(p_days int default 90)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (   -- 편집기 체류 1회 (최종 양식 기준)
    select anon_id, props->>'canvas' as canvas, (props->>'count')::int as cnt, props->>'template' as template,
           props->>'outcome' as outcome, coalesce((props->>'edits')::int, 0) as edits
    from public.events
    where name = 'editor_summary' and created_at >= now() - make_interval(days => p_days)
      and props->>'template' is not null and props->>'template' not in ('custom', 'saved')
      and props->>'canvas' in ('portrait', 'landscape') and (props->>'count') ~ '^[0-9]+$'
  ),
  u as (        -- 같은 기기·같은 조합은 한 명으로 (중간 저장으로 나뉜 기록 합치기)
    select anon_id, canvas, cnt, template,
           bool_or(outcome in ('downloaded', 'shared')) as completed, sum(edits) as edits
    from s group by 1, 2, 3, 4
  ),
  perf as (
    select canvas, cnt, template, count(*) as users, count(*) filter (where completed) as completed,
           round(avg(edits), 1) as avg_edits
    from u group by 1, 2, 3
  ),
  d as (        -- 다운로드·공유된 카드의 최종 스타일
    select props->>'canvas' as canvas, props->>'template' as template,
           upper(props->>'bg') as bg, upper(props->>'txt') as txt, props->>'weight' as weight,
           props->>'caps' as caps, props->>'stats' as stats, anon_id
    from public.events
    where name in ('card_downloaded', 'card_published') and created_at >= now() - make_interval(days => p_days)
      and props->>'bg' ~ '^#[0-9A-Fa-f]{6}$' and props->>'txt' ~ '^#[0-9A-Fa-f]{6}$'
  ),
  st as (
    select canvas, template, bg, txt, weight, caps, stats, count(distinct anon_id) as users,
           row_number() over (partition by canvas, template order by count(distinct anon_id) desc) as rk
    from d group by 1, 2, 3, 4, 5, 6, 7
  )
  select jsonb_build_object(
    'days', p_days,
    'templates', coalesce((select jsonb_agg(jsonb_build_object(
        'canvas', canvas, 'count', cnt, 'template', template, 'users', users, 'completed', completed, 'avg_edits', avg_edits)) from perf), '[]'::jsonb),
    'styles', coalesce((select jsonb_agg(jsonb_build_object(
        'canvas', canvas, 'template', template, 'bg', bg, 'txt', txt, 'weight', weight, 'caps', caps, 'stats', stats, 'users', users))
        from st where rk <= 3), '[]'::jsonb)
  );
$$;
revoke all on function public.template_performance(int) from public, anon, authenticated;
grant execute on function public.template_performance(int) to service_role;
