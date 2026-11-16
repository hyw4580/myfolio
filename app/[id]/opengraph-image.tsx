import ModelOgImage from "../model/[id]/opengraph-image";

export const alt = "myfolio portfolio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** 짧은 주소의 링크 미리보기 이미지 — 포트폴리오와 동일 */
export default function Image(props: { params: Promise<{ id: string }> }) {
  return ModelOgImage(props);
}
