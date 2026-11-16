-- ─────────────────────────────────────────────────────────────
-- 기존 설정 보완 (20261124000000_photo_concepts.sql 다음에 실행)
-- 1) 공개(is_featured)한 컴카드는 방문자도 볼 수 있게 (공유 카드·명함)
-- 2) 영상 저장소(videos) 만들기 — 정책만 있고 저장소가 없었음
-- 3) 사진·영상·프로필 사진 파일은 본인 폴더만 올리기·고치기·지우기 (다른 사람 파일 삭제 방지)
-- 4) 사진 정보(snaps) 본인 수정 허용 (촬영 컨셉 저장)
-- ─────────────────────────────────────────────────────────────
drop policy if exists "comp_cards: public read published" on public.comp_cards;
create policy "comp_cards: public read published" on public.comp_cards
  for select using (is_featured = true);

insert into storage.buckets (id, name, public) values ('videos', 'videos', true)
  on conflict (id) do nothing;

-- 기존: 로그인만 하면 누구 파일이든 지울 수 있었음 → 본인 폴더({user_id}/...)만
drop policy if exists "snaps upload"   on storage.objects;
drop policy if exists "snaps delete"   on storage.objects;
drop policy if exists "videos upload"  on storage.objects;
drop policy if exists "videos delete"  on storage.objects;
drop policy if exists "avatars upload" on storage.objects;
drop policy if exists "avatars delete" on storage.objects;
drop policy if exists "own files: insert" on storage.objects;
drop policy if exists "own files: update" on storage.objects;
drop policy if exists "own files: delete" on storage.objects;

create policy "own files: insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('snaps', 'videos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files: update" on storage.objects for update to authenticated
  using (bucket_id in ('snaps', 'videos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('snaps', 'videos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files: delete" on storage.objects for delete to authenticated
  using (bucket_id in ('snaps', 'videos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "snaps: update own" on public.snaps;
create policy "snaps: update own" on public.snaps for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5) 결제 시작 전(app_flags.billing_enabled = false)에는 Pro 제한 없이 모두 사용 가능
drop policy if exists "snaps: insert requires pro" on public.snaps;
create policy "snaps: insert requires pro" on public.snaps
  as restrictive for insert
  with check (not public.billing_enabled() or public.is_pro(auth.uid()));

create or replace function public.guard_pro_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;            -- 서버·SQL 작업은 통과
  if not public.billing_enabled() then return new; end if;  -- 결제 시작 전엔 제한 없음
  if public.is_pro(auth.uid()) then return new; end if;
  if coalesce(array_length(new.video_urls, 1), 0) > coalesce(array_length(old.video_urls, 1), 0) then
    raise exception 'PRO_REQUIRED: 영상은 Pro 회원만 추가할 수 있어요.' using errcode = 'P0001';
  end if;
  if new.career is distinct from old.career and coalesce(new.career, '') <> '' then
    raise exception 'PRO_REQUIRED: 경력은 Pro 회원만 작성할 수 있어요.' using errcode = 'P0001';
  end if;
  return new;
end $$;
