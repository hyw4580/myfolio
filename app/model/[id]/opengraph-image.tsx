import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard, latinOnly } from "@/lib/og";
import { getPublicProfile } from "@/lib/public-profile";

export const alt = "myfolio portfolio";
export const size = OG_SIZE;
export const contentType = "image/png";

/** 포트폴리오 링크 미리보기 이미지: 프로필 사진 + 이름 + 신체 정보 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPublicProfile(id); // 공개 설정한 항목만
  const num = (v: number | null | undefined, unit: string) => (v ? `${v} ${unit}` : "");
  const stats = p ? [
    { label: "Height", value: num(p.height, "cm") },
    { label: "Bust", value: num(p.chest, "in") },
    { label: "Waist", value: num(p.waist, "in") },
    { label: "Hip", value: num(p.hip, "in") },
    { label: "Shoe", value: num(p.shoe_size, "mm") },
    { label: "Hair", value: latinOnly(p.hair ?? "") },
  ].filter(s => s.value) : [];

  return new ImageResponse(
    <OgCard photo={p?.photo_url ?? null} name={latinOnly(p?.eng_name ?? "") || "Portfolio"} kicker="MODEL PORTFOLIO" stats={stats} />,
    { ...size },
  );
}
