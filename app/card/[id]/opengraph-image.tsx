import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard, latinOnly, publicSupabase } from "@/lib/og";

export const alt = "myfolio comp card";
export const size = OG_SIZE;
export const contentType = "image/png";

type Field = { label: string; value: string };
const STAT_LABELS = ["Height", "Bust", "Waist", "Hip", "Shoe Size", "Hair", "Eyes", "Weight"];

/** 공개된 컴카드의 링크 미리보기 이미지 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = publicSupabase();
  const { data: card } = /^[0-9a-f-]{36}$/i.test(id)
    ? await supabase.from("comp_cards").select("data, is_featured").eq("id", id).maybeSingle()
    : { data: null };

  const data = (card?.is_featured ? card.data : null) as { fields?: Field[]; photos?: { src: string | null }[]; bgColor?: string; txtColor?: string } | null;
  const fields = Array.isArray(data?.fields) ? data!.fields : [];
  const name = latinOnly(fields.find(f => f.label === "English Name")?.value ?? "") || "Comp Card";
  const stats = STAT_LABELS
    .map(l => ({ label: l === "Shoe Size" ? "Shoe" : l, value: latinOnly(fields.find(f => f.label === l)?.value ?? "") }))
    .filter(s => s.value);
  const photo = data?.photos?.find(p => p.src && p.src.startsWith("http"))?.src ?? null;

  return new ImageResponse(
    <OgCard photo={photo} name={name} kicker="COMP CARD" stats={stats} />,
    { ...size },
  );
}
