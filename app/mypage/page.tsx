"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "../components/Nav";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type CompCard = { id: string; title: string; canvas_type: string; created_at: string; };

type Profile = {
  id: string;
  slug: string | null;
  eng_name: string | null;
  kor_name: string | null;
  gender: string | null;
  birth_year: number | null;
  height: number | null;
  weight: number | null;
  chest: number | null;
  waist: number | null;
  hip: number | null;
  shoe_size: number | null;
  hair: string | null;
  eye: string | null;
  instagram: string | null;
  email: string | null;
  tel: string | null;
  kakao_link: string | null;
  photo_url: string | null;
  video_urls: string[];
  is_public: boolean;
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  border: "1px solid var(--border)", fontSize: "13px",
  outline: "none", color: "var(--text)", background: "#fff",
  boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase",
  color: "var(--muted)", display: "block", marginBottom: "6px",
};

export default function MyPage() {
  const router   = useRouter();
  const supabase = createClient();
  const [user,      setUser]      = useState<User | null>(null);
  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [compCards, setCompCards] = useState<CompCard[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [slugInput,  setSlugInput]  = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/login?next=/mypage"); return; }
      const u = data.user;
      setUser(u);

      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.id).single();
      if (p) {
        setProfile({ ...p, video_urls: p.video_urls ?? [], kakao_link: p.kakao_link ?? null });
        if (p.slug) setSlugInput(p.slug);
      } else {
        const empty: Profile = {
          id: u.id, slug: null, eng_name: u.user_metadata?.full_name ?? "", kor_name: null,
          gender: null, birth_year: null, height: null, weight: null,
          chest: null, waist: null, hip: null, shoe_size: null,
          hair: null, eye: null, instagram: null, email: u.email ?? null,
          tel: null, kakao_link: null, photo_url: null, video_urls: [], is_public: false,
        };
        await supabase.from("profiles").upsert(empty);
        setProfile(empty);
      }

      const { data: cards } = await supabase.from("comp_cards").select("id, title, canvas_type, created_at").order("created_at", { ascending: false });
      if (cards) setCompCards(cards);
    })();
  }, []);

  const update = (field: keyof Profile, value: string | number | boolean | string[] | null) => {
    setProfile(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase.from("profiles").upsert({ ...profile, id: user!.id });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };


  const saveSlug = async () => {
    const val = slugInput.trim().toLowerCase();
    if (!val) return;
    if (!/^[a-z0-9-]+$/.test(val)) { setSlugStatus("invalid"); return; }
    setSlugStatus("checking");
    const { data } = await supabase.from("profiles").select("id").eq("slug", val).single();
    if (data && data.id !== user!.id) { setSlugStatus("taken"); return; }
    await supabase.from("profiles").update({ slug: val }).eq("id", user!.id);
    setProfile(prev => prev ? { ...prev, slug: val } : prev);
    setSlugStatus("ok");
    setTimeout(() => setSlugStatus("idle"), 2500);
  };

  if (!profile) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--muted)", fontSize: "13px" }}>불러오는 중...</p>
    </div>
  );

  const portfolioUrl = `/model/${profile.slug ?? user?.id}`;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "clamp(80px, 12vw, 120px) clamp(16px, 5vw, 24px) 80px" }}>

        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "48px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <p style={{ fontSize: "11px", letterSpacing: "0.2em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "8px" }}>My Page</p>
            <h1 style={{ fontSize: "32px", fontWeight: 400, fontFamily: "var(--font-cormorant), var(--font-korean), serif" }}>
              {profile.eng_name || user?.email || "내 계정"}
            </h1>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>갤러리 공개</span>
              <button onClick={() => update("is_public", !profile.is_public)} style={{
                width: "40px", height: "22px", borderRadius: "11px", border: "none",
                background: profile.is_public ? "var(--text)" : "var(--border)",
                cursor: "pointer", position: "relative", transition: "background 0.2s",
              }}>
                <span style={{
                  position: "absolute", top: "3px",
                  left: profile.is_public ? "21px" : "3px",
                  width: "16px", height: "16px", borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                }} />
              </button>
            </div>
            <Link href={portfolioUrl} target="_blank" style={{
              fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--muted)", textDecoration: "none",
              border: "1px solid var(--border)", padding: "10px 18px",
            }}>
              포트폴리오 보기 →
            </Link>
          </div>
        </div>

        {/* ── 포트폴리오 주소 ── */}
        <section style={{ marginBottom: "48px", paddingBottom: "48px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "14px", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>포트폴리오 주소</h2>
          <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "20px", lineHeight: 1.6 }}>
            영문 소문자, 숫자, 하이픈(-)만 사용 가능해요. 중복되지 않아야 해요.
          </p>
          <div style={{ display: "flex", gap: "0", alignItems: "stretch" }}>
            <span style={{ ...inputStyle, width: "auto", background: "var(--surface)", color: "var(--muted)", borderRight: "none", display: "flex", alignItems: "center", padding: "10px 12px", fontSize: "13px", whiteSpace: "nowrap" }}>
              myfolio.com/model/
            </span>
            <input
              style={{ ...inputStyle, flex: 1, borderRadius: 0 }}
              value={slugInput}
              onChange={e => { setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugStatus("idle"); }}
              placeholder="your-name"
            />
            <button onClick={saveSlug} style={{
              padding: "10px 20px", background: "var(--text)", color: "#fff",
              border: "none", fontSize: "12px", letterSpacing: "0.08em", cursor: "pointer", whiteSpace: "nowrap",
            }}>
              저장
            </button>
          </div>
          {slugStatus === "ok"      && <p style={{ fontSize: "12px", color: "#22c55e", marginTop: "8px" }}>✓ 저장됐어요</p>}
          {slugStatus === "taken"   && <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "8px" }}>이미 사용 중인 주소예요</p>}
          {slugStatus === "invalid" && <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "8px" }}>영문 소문자, 숫자, 하이픈만 입력해주세요</p>}
          {slugStatus === "checking"&& <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "8px" }}>확인 중...</p>}
        </section>

        {/* ── 프로필 정보 ── */}
        <section style={{ marginBottom: "48px", paddingBottom: "48px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "14px", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "28px" }}>프로필 정보</h2>

          {/* 메인 사진 */}
          <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "28px" }}>
            <div style={{ width: "100px", height: "133px", background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden", flexShrink: 0 }}>
              {profile.photo_url
                ? <img src={profile.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>No Photo</span>
                  </div>
              }
            </div>
            <div>
              <p style={{ fontSize: "13px", marginBottom: "8px" }}>메인 프로필 사진</p>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "14px", lineHeight: 1.6 }}>포트폴리오 상단에 표시되는 대표 사진</p>
              <label style={{ display: "inline-block", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", border: "1px solid var(--border)", padding: "10px 18px", cursor: "pointer" }}>
                사진 업로드
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file || !user) return;
                  const ext  = file.name.split(".").pop();
                  const path = `${user.id}/avatar.${ext}`;
                  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
                  if (error) { alert("업로드 실패: " + error.message); return; }
                  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
                  update("photo_url", publicUrl);
                }} />
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {/* 영문/한글 이름 */}
            {[
              { label: "영문 이름", field: "eng_name", placeholder: "Emma Johnson",   type: "text" },
              { label: "한글 이름", field: "kor_name", placeholder: "엠마 존슨",        type: "text" },
            ].map(({ label, field, placeholder, type }) => (
              <div key={field}>
                <label style={labelStyle}>{label}</label>
                <input
                  style={inputStyle} type={type} placeholder={placeholder}
                  value={(profile[field as keyof Profile] as string) ?? ""}
                  onChange={e => update(field as keyof Profile, e.target.value)}
                />
              </div>
            ))}

            {/* 성별 — 셀렉트 */}
            <div>
              <label style={labelStyle}>성별</label>
              <select
                style={{ ...inputStyle, cursor: "pointer" }}
                value={profile.gender ?? ""}
                onChange={e => update("gender", e.target.value)}
              >
                <option value="">— Select —</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>

            {/* 출생연도 — 고정 높이 스크롤 피커 */}
            {(() => {
              const currentYear = new Date().getFullYear();
              const defaultYear = currentYear - 20;
              const years = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i);
              const selectedYear = profile.birth_year ?? defaultYear;
              // eslint-disable-next-line react-hooks/rules-of-hooks
              const scrollRef = useRef<HTMLDivElement>(null);
              // eslint-disable-next-line react-hooks/rules-of-hooks
              useEffect(() => {
                const el = scrollRef.current;
                if (!el) return;
                const item = el.querySelector(`[data-year="${selectedYear}"]`) as HTMLElement | null;
                if (item) item.scrollIntoView({ block: "center" });
              }, []);
              return (
                <div>
                  <label style={labelStyle}>출생연도</label>
                  <div
                    ref={scrollRef}
                    style={{ ...inputStyle, padding: 0, height: 160, overflowY: "scroll", cursor: "default" }}
                  >
                    {years.map(y => (
                      <div
                        key={y}
                        data-year={y}
                        onClick={() => update("birth_year", y)}
                        style={{
                          padding: "9px 14px",
                          fontSize: "14px",
                          cursor: "pointer",
                          background: y === selectedYear ? "var(--text)" : "transparent",
                          color: y === selectedYear ? "#fff" : "var(--text)",
                          userSelect: "none",
                        }}
                      >
                        {y}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 나머지 필드 */}
            {[
              { label: "키 (cm)",         field: "height",     placeholder: "170",             type: "number" },
              { label: "몸무게 (kg)",      field: "weight",     placeholder: "52",              type: "number" },
              { label: "가슴 (in)",       field: "chest",      placeholder: "34",              type: "number" },
              { label: "허리 (in)",       field: "waist",      placeholder: "24",              type: "number" },
              { label: "힙 (in)",         field: "hip",        placeholder: "35",              type: "number" },
              { label: "신발 사이즈 (mm)", field: "shoe_size",  placeholder: "250",             type: "number" },
              { label: "헤어 컬러",        field: "hair",       placeholder: "Dark Brown",      type: "text"   },
              { label: "아이 컬러",        field: "eye",        placeholder: "Black",           type: "text"   },
              { label: "이메일",           field: "email",      placeholder: "hello@email.com", type: "text"   },
            ].map(({ label, field, placeholder, type }) => (
              <div key={field}>
                <label style={labelStyle}>{label}</label>
                <input
                  style={inputStyle} type={type} placeholder={placeholder}
                  value={(profile[field as keyof Profile] as string | number) ?? ""}
                  onChange={e => update(field as keyof Profile, type === "number" ? Number(e.target.value) : e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── 컴카드 관리 ── */}
        <section style={{ marginBottom: "48px", paddingBottom: "48px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{ fontSize: "14px", letterSpacing: "0.12em", textTransform: "uppercase" }}>내 컴카드</h2>
            <Link href="/comcard" style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", background: "var(--text)", color: "#fff", padding: "10px 18px" }}>
              + 새로 만들기
            </Link>
          </div>
          {compCards.length === 0 ? (
            <div style={{ padding: "40px", border: "1px solid var(--border)", textAlign: "center", color: "var(--muted)" }}>
              <p style={{ fontSize: "13px" }}>저장된 컴카드가 없어요</p>
              <p style={{ fontSize: "12px", marginTop: "6px" }}>컴카드 디자인 후 "마이페이지에 저장" 버튼을 눌러주세요</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
              {compCards.map(card => (
                <div key={card.id} style={{ border: "1px solid var(--border)", padding: "20px" }}>
                  <div style={{ aspectRatio: card.canvas_type === "portrait" ? "2/3" : "3/2", background: "var(--surface)", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {card.canvas_type === "portrait" ? "세로형" : "가로형"}
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", marginBottom: "4px" }}>{card.title}</p>
                  <p style={{ fontSize: "11px", color: "var(--muted)" }}>{new Date(card.created_at).toLocaleDateString("ko-KR")}</p>
                  <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                    <Link href={`/comcard?id=${card.id}`} style={{ fontSize: "11px", background: "var(--text)", color: "#fff", border: "none", padding: "6px 10px", cursor: "pointer", textDecoration: "none" }}>편집</Link>
                    <button onClick={async () => { await createClient().from("comp_cards").delete().eq("id", card.id); setCompCards(prev => prev.filter(c => c.id !== card.id)); }} style={{ fontSize: "11px", color: "var(--muted)", background: "none", border: "1px solid var(--border)", padding: "6px 10px", cursor: "pointer" }}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 저장 */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={save} disabled={saving} style={{
            background: "var(--text)", color: "#fff", border: "none",
            padding: "14px 44px", fontSize: "12px", letterSpacing: "0.14em",
            textTransform: "uppercase", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
          }}>
            {saved ? "저장됨 ✓" : saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
