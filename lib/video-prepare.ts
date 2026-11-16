"use client";
/**
 * 포트폴리오 영상 올리기 전 준비 (휴대폰·PC 브라우저 안에서 처리, 서버 비용 없음)
 * - 길이: 최대 MAX_VIDEO_SECONDS초
 * - 1080p보다 크거나, 용량이 크거나, mp4가 아니면 → 1080p H.264 mp4로 자동 변환 (WebCodecs)
 * - 변환 후에도 MAX_UPLOAD_BYTES를 넘으면 화질을 한 번 더 낮춰 재시도
 * 변환을 지원하지 않는 오래된 브라우저는 원본이 한도 안일 때만 그대로 올림
 */
export const MAX_VIDEO_SECONDS = 60;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 저장소 한도와 같게
const TARGET_SHORT_SIDE = 1080;

export class VideoPrepareError extends Error {}

export type PrepareResult = { file: File; duration: number; converted: boolean };

export async function prepareVideo(file: File, onProgress?: (p: number) => void): Promise<PrepareResult> {
  const mb = await import("mediabunny");
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) });
  let duration = 0;
  try { duration = await input.computeDuration(); } catch { /* 읽을 수 없는 형식 */ }
  if (duration > MAX_VIDEO_SECONDS + 0.5) {
    throw new VideoPrepareError(`영상이 ${Math.round(duration)}초예요. ${MAX_VIDEO_SECONDS}초 이하로 잘라서 올려 주세요. 긴 영상은 유튜브·비메오 링크로 추가할 수 있어요.`);
  }

  const track = await input.getPrimaryVideoTrack().catch(() => null);
  const w = track?.displayWidth ?? 0, h = track?.displayHeight ?? 0;
  const shortSide = Math.min(w, h);
  const codec = track ? await track.getCodec().catch(() => null) : null;
  const needsConvert = !track || shortSide > TARGET_SHORT_SIDE || file.size > MAX_UPLOAD_BYTES * 0.8 || codec !== "avc" || !/mp4/i.test(file.type);

  const canConvert = track && typeof VideoEncoder !== "undefined" && await mb.canEncodeVideo("avc").catch(() => false);
  if (!needsConvert || !canConvert) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new VideoPrepareError(`영상 용량이 ${Math.round(file.size / 1024 / 1024)}MB예요. 이 브라우저에서는 자동으로 줄일 수 없어서 50MB 이하로 줄여 주세요. (최신 크롬·사파리에서는 자동으로 줄여 올려요)`);
    }
    return { file, duration, converted: false };
  }

  // 긴 쪽 방향 유지하며 짧은 쪽을 1080으로 (이미 작으면 크기 그대로, 코덱·용량만 정리)
  const size = shortSide > TARGET_SHORT_SIDE ? (w >= h ? { height: TARGET_SHORT_SIDE } : { width: TARGET_SHORT_SIDE }) : {};
  for (const bitrate of [4_000_000, 2_200_000]) {
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
    const conv = await mb.Conversion.init({
      input, output,
      video: { codec: "avc", bitrate, ...size },
      audio: { codec: "aac", bitrate: 128_000 },
      trim: duration > MAX_VIDEO_SECONDS ? { end: MAX_VIDEO_SECONDS } : undefined,
    });
    if (!conv.isValid) break;
    conv.onProgress = p => onProgress?.(p);
    await conv.execute();
    const buf = output.target.buffer;
    if (!buf) break;
    if (buf.byteLength <= MAX_UPLOAD_BYTES) {
      const name = file.name.replace(/\.[^.]+$/, "") + ".mp4";
      return { file: new File([buf], name, { type: "video/mp4" }), duration, converted: true };
    }
  }
  if (file.size <= MAX_UPLOAD_BYTES) return { file, duration, converted: false };
  throw new VideoPrepareError("영상을 50MB 이하로 줄이지 못했어요. 길이를 줄이거나 유튜브 링크로 추가해 주세요.");
}
