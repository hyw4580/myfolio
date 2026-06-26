import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "../../components/Nav";
import { createClient } from "@/lib/supabase/server";
import PortfolioEditor from "./PortfolioEditor";
import PortfolioContent from "./PortfolioContent";
import ContactButtons from "./ContactButtons";

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").pop();
      return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").pop();
      return `https://player.vimeo.com/video/${id}`;
    }
  } catch {}
  return null;
}

function isVideoFile(url: string) {
  return /\.(mp4|mov|webm|avi)(\?|$)/i.test(url);
}

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const supabase = await createClient();

  // slug로 먼저 조회, 없으면 UUID로 조회
  let { data: profile } = await supabase
    .from("profiles").select("*").eq("slug", param).eq("is_public", true).single();
  if (!profile) {
    const { data } = await supabase
      .from("profiles").select("*").eq("id", param).eq("is_public", true).single();
    profile = data;
  }

  if (!profile) notFound();

  const id = profile.id;

  const [{ data: allCompCards }, { data: allSnaps }] = await Promise.all([
    supabase.from("comp_cards").select("id, title, canvas_type, data, created_at, is_featured").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("snaps").select("id, url, order, category").eq("user_id", id).order("order"),
  ]);

  const compCards = (allCompCards ?? []).filter(c => c.is_featured);

  const gallery = (allSnaps ?? []).filter(s => s.category === "gallery");
  const snaps   = (allSnaps ?? []).filter(s => s.category !== "gallery");

  const defaultVisibleSpecs = ["eng_name","kor_name","height","chest","waist","hip","shoe_size","hair","eye"];
  const visibleSpecs: string[] = profile.visible_specs ?? defaultVisibleSpecs;

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

  // 시안용 플레이스홀더 — 실제 데이터 없을 때 표시 (Unsplash 모델/패션 사진)
  const demoPhoto = "https://images.unsplash.com/photo-1529139522a9154434a932?w=680&h=800&fit=crop&q=80";
  const demoGallery = [
    { id: "d1", url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80&fit=crop" },
    { id: "d2", url: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80&fit=crop" },
    { id: "d3", url: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66ef?w=600&q=80&fit=crop" },
    { id: "d4", url: "https://images.unsplash.com/photo-1496747611176-843f8be85c01?w=600&q=80&fit=crop" },
    { id: "d5", url: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&q=80&fit=crop" },
    { id: "d6", url: "https://images.unsplash.com/photo-1483985988355-763728e1cec4?w=600&q=80&fit=crop" },
  ];
  const demoSnaps = [
    { id: "s1", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80&fit=crop" },
    { id: "s2", url: "https://images.unsplash.com/photo-1524504388951-23e8e41b00a8?w=600&q=80&fit=crop" },
    { id: "s3", url: "https://images.unsplash.com/photo-1539109136090-99b49061bb06?w=600&q=80&fit=crop" },
    { id: "s4", url: "https://images.unsplash.com/photo-1529154166925-574a0236a4f4?w=600&q=80&fit=crop" },
    { id: "s5", url: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&q=80&fit=crop" },
    { id: "s6", url: "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=600&q=80&fit=crop" },
  ];

  const displayPhoto   = profile.photo_url ?? demoPhoto;
  const displayGallery = gallery.length > 0 ? gallery : demoGallery;
  const displaySnaps   = snaps.length > 0   ? snaps   : demoSnaps;

  const hasGallery  = true;  // 항상 표시 (데모 포함)
  const hasSnaps    = true;
  const hasCompCard = compCards && compCards.length > 0;
  const hasVideo    = profile.video_urls && profile.video_urls.length > 0;

  const font = "var(--font-inter), var(--font-korean), sans-serif";

  return (
    <div style={{ background: "#fff", minHeight: "100vh", color: "#111", fontFamily: font }}>
      <Nav />
      <div style={{ paddingTop: "80px" }}>

        {/* ── 헤더 ── */}
        <div className="pf-header-outer">
          <div className="pf-header-inner">

            {/* 메인 사진 */}
            <div>
              <div style={{ aspectRatio: "3/4", overflow: "hidden", background: "#e8e5e0" }}>
                <img src={displayPhoto} alt={profile.eng_name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            </div>

            {/* 이름 + 스펙 + 버튼 */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: "4px" }}>
              <div>
                <h1 style={{ fontSize: "clamp(24px, 2.5vw, 38px)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1.05, marginBottom: "6px", fontFamily: "var(--font-cormorant), serif" }}>
                  {profile.eng_name ?? "—"}
                </h1>
                {profile.kor_name && (
                  <p style={{ fontSize: "13px", color: "#999", letterSpacing: "0.04em", fontFamily: font }}>{profile.kor_name}</p>
                )}
              </div>
              {specs.length > 0 && (
                <div>
                  {specs.map(s => (
                    <p key={s.label} style={{ fontSize: "12px", fontWeight: 500, letterSpacing: "0.06em", lineHeight: 2.2, color: "#222", fontFamily: font }}>
                      {s.label}: {s.value}
                    </p>
                  ))}
                </div>
              )}
              <ContactButtons
                userId={id}
                instagram={profile.instagram ?? null}
                kakaoLink={profile.kakao_link ?? null}
                tel={profile.tel ?? null}
              />
            </div>

            {/* 경력 */}
            <div className="pf-career-col">
              <p style={{ fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#bbb", marginBottom: "20px", fontFamily: font }}>Career</p>
              {profile.career
                ? <p style={{ fontSize: "13px", lineHeight: 2, color: "#444", fontFamily: font, whiteSpace: "pre-line" }}>{profile.career}</p>
                : <p style={{ fontSize: "12px", color: "#ccc", fontFamily: font }}>경력을 입력해주세요</p>
              }
            </div>
          </div>
        </div>

        {/* ── 콘텐츠 (탭 방식) ── */}
        <PortfolioContent
          userId={id}
          gallery={displayGallery}
          snaps={displaySnaps}
          compCards={compCards ?? []}
          videoUrls={profile.video_urls ?? []}
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
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  display: "inline-block", padding: "8px 20px", borderRadius: "999px",
  background: "#111", color: "#fff", fontSize: "11px",
  letterSpacing: "0.14em", textTransform: "uppercase",
  textDecoration: "none", fontWeight: 600,
};
