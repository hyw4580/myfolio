-- ─────────────────────────────────────────────────────────────
-- 개인정보 보호 · 유료 기능 보호 · 회원 탈퇴
-- (20261116000000_billing.sql 다음에) Supabase SQL Editor에서 한 번 실행하세요.
-- 기존 정책은 그대로 두고 "추가 조건(restrictive)"으로만 좁힙니다.
-- ─────────────────────────────────────────────────────────────

-- 1) 컴카드: 본인 카드 + 공개(is_featured) 카드만 읽을 수 있음 → 비공개 카드·연락처 보호
drop policy if exists "comp_cards: read own or published" on public.comp_cards;
create policy "comp_cards: read own or published" on public.comp_cards
  as restrictive for select
  using (is_featured = true or user_id = auth.uid());

-- 2) 프로필: 브라우저에서는 본인 프로필만 읽을 수 있음 → 숨긴 전화·이메일·신체정보 보호
--    (명함·공유 페이지는 서버가 대신 읽고 공개 설정한 항목만 보여줌: lib/public-profile.ts)
drop policy if exists "profiles: read own only" on public.profiles;
create policy "profiles: read own only" on public.profiles
  as restrictive for select
  using (id = auth.uid());

-- 명함 주소(slug) 중복 방지 (대소문자 구분 없이)
create unique index if not exists profiles_slug_unique on public.profiles (lower(slug)) where slug is not null;

-- 3) Pro 전용 항목(영상·경력)은 유료 회원만 새로 추가·수정 가능 (지우는 건 누구나)
create or replace function public.guard_pro_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 서버(관리자 키)·SQL 작업은 통과
  if auth.uid() is null then return new; end if;
  if public.is_pro(auth.uid()) then return new; end if;
  if coalesce(array_length(new.video_urls, 1), 0) > coalesce(array_length(old.video_urls, 1), 0) then
    raise exception 'PRO_REQUIRED: 영상은 Pro 회원만 추가할 수 있어요.' using errcode = 'P0001';
  end if;
  if new.career is distinct from old.career and coalesce(new.career, '') <> '' then
    raise exception 'PRO_REQUIRED: 경력은 Pro 회원만 작성할 수 있어요.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists guard_pro_profile_fields on public.profiles;
create trigger guard_pro_profile_fields before update on public.profiles
  for each row execute function public.guard_pro_profile_fields();

-- 4) 다운로드 기록에 카드 사진 목록 저장 → 무료 1장으로 사진만 바꿔가며 계속 쓰는 것 방지
alter table public.comcard_exports add column if not exists photos text[] not null default '{}';

-- 5) 회원 탈퇴를 한 번에(트랜잭션) 처리 — 중간에 실패하면 아무것도 지워지지 않음
--    서버(관리자 키)만 호출 가능. 업로드 파일·결제 카드 삭제는 이 함수가 성공한 뒤 서버가 정리.
create or replace function public.delete_account(uid uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from public.comp_cards where user_id = uid;
  delete from public.snaps where user_id = uid;
  delete from public.profiles where id = uid;
  -- 결제 기록(payments)은 FK set null로 익명 보관, 구독·결제고객·다운로드 기록·의견 연결은 FK로 정리
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;
