import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PortfolioEditor from "./PortfolioEditor";
import PortfolioContent from "./PortfolioContent";
import BusinessCard from "./BusinessCard";
import ShareButtons from "../../components/ShareButtons";
import { profilePath } from "@/lib/slug";
import { getPublicProfile } from "@/lib/public-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingConfigured } from "@/lib/billing/server";

/** 포트폴리오 게시물(사진·영상·경력) 공개 여부: Pro 구독 중이거나 결제 기능 설정 전이면 공개 */
async function portfolioActive(ownerId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin || !billingConfigured()) return true;
  const { data } = await admin.rpc("is_pro", { uid: ownerId });
  return data === true;
}

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const supabase = await createClient();

  // 주소(이름) 또는 아이디로 조회 — 공개 설정한 항목만 받음 (is_public 무관, 링크 공유용)
  const profile = await getPublicProfile(param);

  if (!profile) notFound();

  const id = profile.id;

  // 카드·게시물은 보는 사람 권한으로 조회 → 남의 비공개 카드는 데이터베이스가 걸러줌 (화면에도 실리지 않음)
  const [{ data: allCompCards }, { data: allSnaps }, active, { data: { user: viewer } }] = await Promise.all([
    supabase.from("comp_cards").select("id, title, canvas_type, data, created_at, is_featured").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("snaps").select("id, url, order, category, concepts, ai_concepts").eq("user_id", id).order("order"),
    portfolioActive(id),
    supabase.auth.getUser(),
  ]);
  const isOwner = viewer?.id === id;
  // Pro가 끝나면 사진·영상·경력은 숨김 (삭제 안 함 — 다시 구독하면 바로 공개). 본인에게는 보이되 안내
  const hidePosts = !active && !isOwner;

  const compCards = (allCompCards ?? []).filter(c => c.is_featured);

  const postsSource = hidePosts ? [] : (allSnaps ?? []);
  const gallery = postsSource.filter(s => s.category === "gallery");
  const snaps   = postsSource.filter(s => s.category !== "gallery");
  const career  = hidePosts ? null : (profile.career ?? null);
  const videoUrls: string[] = hidePosts ? [] : (profile.video_urls ?? []);

  const visibleSpecs: string[] = profile.visible_specs;

  const allSpecsMap: { key: string; label: string; value: string | null }[] = [
    { key: "eng_name",   label: "NAME",        value: profile.eng_name   ?? null },
    { key: "kor_name",   label: "KOR NAME",    value: profile.kor_name   ?? null },
    { key: "gender",     label: "GENDER",      value: profile.gender     ?? null },
    { key: "birth_year", label: "BIRTH YEAR",  value: profile.birth_year ? String(profile.birth_year) : null },
    { key: "height",     label: "HEIGHT",      value: profile.height     ? `${profile.height} cm`  : null },
    { key: "weight",     label: "WEIGHT",      value: profile.weight     ? `${profile.weight} kg`  : null },
    { key: "chest",      label: "BUST",        value: profile.chest      ? `${profile.chest} in`   : null },
    { key: "waist",      label: "WAIST",       value: profile.waist      ? `${profile.waist} in`   : null },
    { key: "hip",        label: "HIP",         value: profile.hip        ? `${profile.hip} in`     : null },
    { key: "shoe_size",  label: "SHOE SIZE",   value: profile.shoe_size  ? `${profile.shoe_size} mm` : null },
    { key: "hair",       label: "HAIR",        value: profile.hair       ? profile.hair.toUpperCase() : null },
    { key: "eye",        label: "EYES",        value: profile.eye        ? profile.eye.toUpperCase()  : null },
    { key: "email",      label: "EMAIL",       value: profile.email      ?? null },
  ];
  const specs = allSpecsMap
    .filter(s => visibleSpecs.includes(s.key) && s.value !== null)
    .map(s => ({ label: s.label, value: s.value! }));

  // 대표 사진: 프로필 사진 → 없으면 공개 컴카드의 메인 사진
  const cardPhoto = (compCards[0]?.data as { photos?: { src: string | null }[] } | undefined)?.photos?.find(p => p.src?.startsWith("http"))?.src ?? null;
  const displayPhoto = profile.photo_url ?? cardPhoto;

  // 한 줄 소개: 경력의 첫 줄
  const tagline = (career ?? "").split("\n").map((l: string) => l.trim()).find(Boolean)?.slice(0, 60) ?? "";

  // 명함용 핵심 정보 (공개 설정한 항목만)
  const show = (k: string) => visibleSpecs.includes(k);
  const sizes = [profile.chest, profile.waist, profile.hip].every(Boolean) && show("chest") && show("waist") && show("hip")
    ? `${profile.chest}-${profile.waist}-${profile.hip}` : null;
  const chips = [
    show("height") && profile.height ? `${profile.height}cm` : null,
    sizes,
    show("shoe_size") && profile.shoe_size ? `${profile.shoe_size}mm` : null,
    show("hair") && profile.hair ? `Hair ${profile.hair}` : null,
    show("eye") && profile.eye ? `Eyes ${profile.eye}` : null,
  ].filter(Boolean) as string[];
  // 나머지 상세 정보 (칩에 없는 것)
  const inChips = new Set(["NAME", "KOR NAME", "HEIGHT", "SHOE SIZE", "HAIR", "EYES", ...(sizes ? ["BUST", "WAIST", "HIP"] : [])]);
  const detailSpecs = specs.filter(sp => !inChips.has(sp.label));

  const shareSlug = profilePath(profile.slug, id);
  const font = "var(--font-inter), var(--font-korean), sans-serif";

  return (
    <div style={{ background: "#fff", minHeight: "100vh", color: "#111", fontFamily: font }}>
      {/* 명함 페이지는 가벼운 머리말만 */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 22px", borderBottom: "1px solid #f0f0f0" }}>
        <Link href="/" className="font-display" style={{ fontSize: "22px", color: "#0A0A0A", textDecoration: "none" }}>myfolio</Link>
        <Link href="/signup?next=/comcard&ref=profile" style={{ fontSize: "11px", color: "#666", textDecoration: "none", letterSpacing: "0.06em" }}>내 명함 만들기 →</Link>
      </header>

      <div>
        {/* ── 디지털 명함 ── */}
        <BusinessCard
          id={id} engName={profile.eng_name ?? null} korName={profile.kor_name ?? null} career={career}
          photo={displayPhoto} tagline={tagline} chips={chips} details={detailSpecs.map(sp => `${sp.label} ${sp.value}`)}
          instagram={profile.instagram ?? null} kakaoLink={profile.kakao_link ?? null} tel={profile.tel ?? null}
          sharePath={shareSlug}
        />

        {/* ── 콘텐츠 (탭 방식) ── */}
        <PortfolioContent
          userId={id}
          photos={[...gallery, ...snaps].sort((a, b) => b.order - a.order) /* 최신 업로드 순 */.map(p => ({ id: String(p.id), url: p.url, concepts: (p.concepts as string[] | null) ?? [] }))}
          compCards={compCards ?? []}
          videoUrls={videoUrls}
          lockedForOwner={isOwner && !active}
        />
      </div>

      <PortfolioEditor
        userId={id}
        initialGallery={gallery}
        initialSnaps={snaps}
        initialKakao={profile.kakao_link ?? null}
        initialInstagram={profile.instagram ?? null}
        initialTel={profile.tel ?? null}
        initialVideos={profile.video_urls ?? []}
        initialCompCards={allCompCards ?? []}
        initialCareer={profile.career ?? null}
        initialVisibleSpecs={profile.visible_specs ?? null}
      />

      {/* 공유받아 들어온 사람을 가입으로 이어주는 안내 */}
      <footer style={{ borderTop: "1px solid #eee", padding: "28px 20px 40px", textAlign: "center" }}>
        <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#bbb", textTransform: "uppercase", marginBottom: "8px" }}>Made with myfolio</p>
        <Link href="/signup?next=/comcard&ref=profile" style={{ fontSize: "13px", color: "#111" }}>나도 무료로 컴카드·포트폴리오 만들기 →</Link>
      </footer>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const p = await getPublicProfile(param); // 페이지와 같은 요청 안에서는 한 번만 조회
  const name = p?.eng_name || "Model";
  return {
    title: `${name} · Portfolio | myfolio`,
    description: p?.height ? `${name} · ${p.height}cm — 컴카드·사진·영상 포트폴리오` : `${name}의 모델 포트폴리오`,
    openGraph: { title: `${name} · Portfolio`, description: "myfolio 모델 포트폴리오", type: "profile" as const },
    twitter: { card: "summary_large_image" as const },
  };
}

const pillStyle: React.CSSProperties = {
  display: "inline-block", padding: "8px 20px", borderRadius: "999px",
  background: "#111", color: "#fff", fontSize: "11px",
  letterSpacing: "0.14em", textTransform: "uppercase",
  textDecoration: "none", fontWeight: 600,
};
