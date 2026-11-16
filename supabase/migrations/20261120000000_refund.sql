-- ─────────────────────────────────────────────────────────────
-- 구독 취소·환불 (20261119000000_events.sql 다음에 실행)
-- - 결제할 때마다 "그 시점 사용 상태"를 남겨, 취소할 때 Pro 기능을 썼는지 판단
-- - 환불 금액·시각·사유 기록 (결제 기록은 5년 보관)
-- ─────────────────────────────────────────────────────────────
alter table public.payments add column if not exists plan text;
alter table public.payments add column if not exists usage_baseline jsonb;   -- 결제 시점 사진·영상·경력·공개 카드 상태
alter table public.payments add column if not exists refunded_amount int not null default 0;
alter table public.payments add column if not exists refunded_at timestamptz;
alter table public.payments add column if not exists refund_reason text;     -- full_7days / yearly_remaining
create index if not exists payments_user_done_idx on public.payments(user_id, approved_at desc) where status = 'DONE';
