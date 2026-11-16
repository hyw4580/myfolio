-- ─────────────────────────────────────────────────────────────
-- myfolio 월 구독(유료 회원) + 컴카드 무료 1장 제한
-- Supabase 대시보드 → SQL Editor에 붙여넣어 한 번 실행하세요.
-- ─────────────────────────────────────────────────────────────

-- 1) 구독 상태 (본인만 조회, 쓰기는 서버(service role)만)
create table if not exists public.subscriptions (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  plan                 text not null default 'pro_monthly'   -- pro_monthly / pro_yearly
                       check (plan in ('pro', 'pro_monthly', 'pro_yearly')),
  status               text not null default 'inactive'
                       check (status in ('inactive', 'active', 'past_due', 'expired')),
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  failed_attempts      int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions: read own" on public.subscriptions;
create policy "subscriptions: read own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- 2) 결제 비밀 정보 (빌링키) — 정책 없음 = 브라우저에서 절대 접근 불가, 서버만 사용
create table if not exists public.billing_customers (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  customer_key text not null unique,
  billing_key  text,
  card_label   text,          -- 예: "신한카드 4330****" (화면 표시용)
  updated_at   timestamptz not null default now()
);
alter table public.billing_customers enable row level security;

-- 3) 결제 내역 (본인만 조회)
--    전자상거래법상 거래 기록은 5년 보관 → 회원 탈퇴 시 기록은 남기고 사용자 연결만 끊음(set null)
create table if not exists public.payments (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  order_id    text not null unique,
  payment_key text,
  amount      int not null,
  status      text not null,              -- DONE / FAILED ...
  approved_at timestamptz,
  error       text,
  created_at  timestamptz not null default now()
);
alter table public.payments enable row level security;
drop policy if exists "payments: read own" on public.payments;
create policy "payments: read own" on public.payments
  for select using (auth.uid() = user_id);

-- 4) 컴카드 다운로드 기록 (무료 회원은 카드 1장까지 다운로드)
create table if not exists public.comcard_exports (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  card_id    uuid not null,
  kind       text not null check (kind in ('png', 'pdf')),
  created_at timestamptz not null default now()
);
create index if not exists comcard_exports_user_idx on public.comcard_exports(user_id);
alter table public.comcard_exports enable row level security;
drop policy if exists "comcard_exports: read own" on public.comcard_exports;
create policy "comcard_exports: read own" on public.comcard_exports
  for select using (auth.uid() = user_id);

-- 5) 유료 회원 여부 (해지 예약해도 기간 끝날 때까지는 유료)
create or replace function public.is_pro(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and s.status in ('active', 'past_due')
      and s.current_period_end > now()
  );
$$;

-- 6) 포트폴리오 게시물(스냅·갤러리 사진)은 유료 회원만 새로 올릴 수 있음
--    (기존 정책은 그대로 두고, "추가 조건"으로만 막는 restrictive 정책)
drop policy if exists "snaps: insert requires pro" on public.snaps;
create policy "snaps: insert requires pro" on public.snaps
  as restrictive for insert
  with check (public.is_pro(auth.uid()));
