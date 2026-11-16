/**
 * 칸 안의 사진 위치·크기 (편집기·미리보기·공개 카드·다운로드 공통)
 * - fx, fy: 사진의 어느 쪽을 보여줄지 (0 = 왼쪽/위, 1 = 오른쪽/아래). 기본은 가운데·얼굴 쪽(위 30%)
 * - zoom: 1 = 칸을 꽉 채우는 최소 크기, 최대 3배
 * 다운로드(html2canvas)가 object-fit을 지원하지 않아 배경 이미지 + 안쪽 상자 이동으로 구현
 */
import type { CSSProperties } from "react";

export type PhotoCrop = { fx?: number; fy?: number; zoom?: number };

export const DEFAULT_FX = 0.5;
export const DEFAULT_FY = 0.3;
export const MAX_ZOOM = 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function normCrop(c: PhotoCrop | undefined) {
  return {
    fx: clamp(c?.fx ?? DEFAULT_FX, 0, 1),
    fy: clamp(c?.fy ?? DEFAULT_FY, 0, 1),
    zoom: clamp(c?.zoom ?? 1, 1, MAX_ZOOM),
  };
}

/** 칸(overflow hidden) 안에 넣는 사진 상자의 스타일 */
export function photoFillStyle(src: string, crop?: PhotoCrop): CSSProperties {
  const { fx, fy, zoom } = normCrop(crop);
  return {
    position: "absolute",
    width: `${zoom * 100}%`,
    height: `${zoom * 100}%`,
    left: `${-(zoom - 1) * 100 * fx}%`,
    top: `${-(zoom - 1) * 100 * fy}%`,
    backgroundImage: `url("${src}")`,
    backgroundSize: "cover",
    backgroundPosition: `${fx * 100}% ${fy * 100}%`,
    backgroundRepeat: "no-repeat",
    pointerEvents: "none",
  };
}

/** 끌기(px)만큼 보이는 부분 옮기기 — 사진을 오른쪽으로 끌면 왼쪽이 더 보임 */
export function panCrop(c: PhotoCrop | undefined, dx: number, dy: number, frameW: number, frameH: number): PhotoCrop {
  const { fx, fy, zoom } = normCrop(c);
  // 이동 감도: 확대할수록 같은 거리에 덜 움직이게
  const sx = frameW * Math.max(zoom - 1, 0.5);
  const sy = frameH * Math.max(zoom - 1, 0.5);
  return { fx: clamp(fx - dx / sx, 0, 1), fy: clamp(fy - dy / sy, 0, 1), zoom };
}

export function zoomCrop(c: PhotoCrop | undefined, nextZoom: number): PhotoCrop {
  const { fx, fy } = normCrop(c);
  return { fx, fy, zoom: clamp(nextZoom, 1, MAX_ZOOM) };
}
