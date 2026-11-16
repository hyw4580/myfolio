import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile } from "@/lib/public-profile";
import CompCardCanvas from "../../model/[id]/CompCardCanvas";
import ShareButtons from "../../components/ShareButtons";
import { TrackView } from "../../components/Track";
import { profilePath } from "@/lib/slug";

type Field = { label: string; value: string };
type Card = { id: string; title: string; canvas_type: string; data: Record<string, unknown>; user_id: string; is_featured: boolean | null };

/** 공개된 카드(또는 본인 카드)만 보여줌 */
const loadCard = cache(async (id: string) => { // 메타데이터와 페이지가 같은 요청에서 한 번만 조회
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: card } = await supabase.from("comp_cards")
    .select("id, title, canvas_type, data, user_id, is_featured").eq("id", id).maybeSingle<Card>();
  if (!card) return null;
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === card.user_id;
  if (!card.is_featured && !isOwner) return null;
  const profile = await getPublicProfile(card.user_id);
  return { card, isOwner, profile };
});

const fieldsOf = (card: Card): Field[] => {
  const raw = (card.data as { fields?: unknown }).fields;
  return Array.isArray(raw) ? (raw as Field[]).filter(f => f && typeof f.label === "string") : [];
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const res = await loadCard(id);
  if (!res) return { title: "myfolio" };
  const fields = fieldsOf(res.card);
  const name = fields.find(f => f.label === "English Name")?.value ?? res.profile?.eng_name ?? "Model";
  const stats = fields.filter(f => ["Height", "Bust", "Waist", "Hip"].includes(f.label)).map(f => f.value).join(" · ");
  return {
    title: `${name} · Comp Card | myfolio`,
    description: stats ? `${name} — ${stats}` : `${name}의 컴카드`,
    openGraph: { title: `${name} · Comp Card`, description: stats || "myfolio로 만든 컴카드", type: "profile" },
    twitter: { card: "summary_large_image" },
  };
}

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadCard(id);
  if (!res) notFound();
  const { card, isOwner, profile } = res;
  const name = fieldsOf(card).find(f => f.label === "English Name")?.value ?? profile?.eng_name ?? "";
  const portfolio = profilePath(profile?.slug, card.user_id);

  return (
    <div style={{ background: "#EBEBEB", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <TrackView kind="card" />
      <header style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", boxSizing: "border-box" }}>
        <Link href="/" className="font-display" style={{ fontSize: "22px", color: "#0A0A0A", textDecoration: "none" }}>myfolio</Link>
        <Link href={portfolio} style={{ fontSize: "12px", color: "#555", textDecoration: "none", letterSpacing: "0.06em" }}>포트폴리오 보기 →</Link>
      </header>

      {isOwner && !card.is_featured && (
        <p style={{ fontSize: "12px", color: "#8a5a10", background: "#f8efe0", padding: "8px 14px", margin: "0 16px 12px" }}>
          비공개 카드예요. 다른 사람은 볼 수 없어요. 마이페이지나 편집기에서 공개로 바꾸면 공유할 수 있어요.
        </p>
      )}

      <main style={{ padding: "8px 16px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "18px", width: "100%", boxSizing: "border-box" }}>
        <div style={{ boxShadow: "0 6px 30px rgba(0,0,0,0.15)", maxWidth: "100%" }}>
          <CompCardCanvas canvasType={card.canvas_type} data={card.data} maxWidth={card.canvas_type === "portrait" ? 520 : 760} />
        </div>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <ShareButtons path={`/card/${card.id}`} title={`${name || "모델"} 컴카드`} text="myfolio로 만든 컴카드를 확인해 보세요" />
        </div>
      </main>

      {/* 공유받은 사람을 가입으로 이어주는 안내 */}
      {!isOwner && (
        <section style={{ marginTop: "auto", width: "100%", background: "#fff", borderTop: "1px solid #ddd", padding: "28px 20px 36px", textAlign: "center", boxSizing: "border-box" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.18em", color: "#999", textTransform: "uppercase", marginBottom: "8px" }}>Made with myfolio</p>
          <p style={{ fontSize: "15px", color: "#111", marginBottom: "16px" }}>사진만 올리면 컴카드가 완성돼요. 나도 무료로 만들어 보세요.</p>
          <Link href="/signup?next=/comcard&ref=card" style={{ display: "inline-block", padding: "13px 28px", background: "#0A0A0A", color: "#fff", textDecoration: "none", fontSize: "12px", letterSpacing: "0.12em" }}>
            무료로 컴카드 만들기
          </Link>
        </section>
      )}
    </div>
  );
}
