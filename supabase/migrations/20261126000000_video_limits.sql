-- ─────────────────────────────────────────────────────────────
-- 영상 저장소 안전장치 (20261125000000_storage_fixes.sql 다음)
-- 화면에서 1분·1080p로 자동 변환해 올리지만, 우회해도 50MB 넘는 파일·영상 아닌 파일은 거부
-- (개수 제한은 두지 않음)
-- ─────────────────────────────────────────────────────────────
update storage.buckets
   set file_size_limit = 52428800,  -- 50MB
       allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
 where id = 'videos';
