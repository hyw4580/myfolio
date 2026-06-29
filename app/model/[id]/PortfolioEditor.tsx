"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Snap     = { id: string; url: string; order: number; category: string };
type CompCard = { id: string; title: string; canvas_type: string; is_featured: boolean | null; data: { bgColor?: string; photos?: { src: string | null }[] } };

const ALL_SPECS = [
  { key: "eng_name",   label: "영문 이름"   },
  { key: "kor_name",   label: "한글 이름"   },
  { key: "gender",     label: "성별"        },
  { key: "birth_year", label: "출생연도"    },
  { key: "height",     label: "키"          },
  { key: "weight",     label: "몸무게"      },
  { key: "chest",      label: "가슴"        },
  { key: "waist",      label: "허리"        },
  { key: "hip",        label: "힙"          },
  { key: "shoe_size",  label: "신발 사이즈" },
  { key: "hair",       label: "헤어 컬러"   },
  { key: "eye",        label: "아이 컬러"   },
  { key: "email",      label: "이메일"      },
];

type Props = {
  userId: string;
  initialGallery: Snap[];
  initialSnaps: Snap[];
  initialKakao: string | null;
  initialInstagram: string | null;
  initialTel: string | null;
  initialVideos: string[];
  initialCompCards: CompCard[];
  initialCareer: string | null;
  initialVisibleSpecs: string[] | null;
};

const font = "var(--font-inter), var(--font-korean), sans-serif";

export default function PortfolioEditor({ userId, initialGallery, initialSnaps, initialKakao, initialInstagram, initialTel, initialVideos, initialCompCards, initialCareer, initialVisibleSpecs }: Props) {
  const supabase = createClient();
  const [isOwner, setIsOwner] = useState(false);
  const [open, setOpen]       = useState(false);
  const [tab, setTab]         = useState<"gallery" | "snaps" | "compcard" | "links" | "video" | "career" | "specs">("gallery");

  const [compCards, setCompCards] = useState<CompCard[]>(initialCompCards);
  const [gallery,   setGallery]   = useState<Snap[]>(initialGallery);
  const [snaps,     setSnaps]     = useState<Snap[]>(initialSnaps);
  const [kakao,     setKakao]     = useState(initialKakao ?? "");
  const [instagram, setInstagram] = useState(initialInstagram ?? "");
  const [tel,       setTel]       = useState(initialTel ?? "");
  const [career,    setCareer]    = useState(initialCareer ?? "");
  const [visibleSpecs, setVisibleSpecs] = useState<string[]>(
    initialVisibleSpecs ?? ALL_SPECS.map(s => s.key)
  );
  const [videos,    setVideos]    = useState<string[]>(initialVideos);
  const [videoInput, setVideoInput]   = useState("");
  const [uploading,  setUploading]    = useState(false);
  const [vidUploading, setVidUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const orderRef = useRef((initialGallery.length + initialSnaps.length));

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1") return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id === userId) setIsOwner(true);
    });
  }, [userId]);

  if (!isOwner) return null;

  const uploadPhotos = async (files: FileList, category: "gallery" | "snap") => {
    setUploading(true);
    const setter = category === "gallery" ? setGallery : setSnaps;
    for (const file of Array.from(files)) {
      const ext  = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("snaps").upload(path, file);
      if (error) { alert(`사진 업로드 실패: ${error.message}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from("snaps").getPublicUrl(path);
      const order = orderRef.current++;
      const { data: row, error: dbError } = await supabase.from("snaps").insert({ user_id: userId, url: publicUrl, order, category }).select("id, url, order, category").single();
      if (dbError) { alert(`DB 저장 실패: ${dbError.message}`); continue; }
      if (row) setter(prev => [...prev, row]);
    }
    setUploading(false);
  };

  const deletePhoto = async (id: string, category: "gallery" | "snap") => {
    await supabase.from("snaps").delete().eq("id", id);
    const setter = category === "gallery" ? setGallery : setSnaps;
    setter(prev => prev.filter(s => s.id !== id));
  };

  const uploadVideo = async (file: File) => {
    setVidUploading(true);
    const ext  = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("videos").upload(path, file);
    if (error) { alert(`영상 업로드 실패: ${error.message}`); }
    else {
      const { data: { publicUrl } } = supabase.storage.from("videos").getPublicUrl(path);
      setVideos(prev => {
        const next = [...prev, publicUrl];
        supabase.from("profiles").update({ video_urls: next }).eq("id", userId);
        return next;
      });
    }
    setVidUploading(false);
  };

  const addVideoUrl = () => {
    const v = videoInput.trim();
    if (!v) return;
    setVideos(prev => {
      const next = [...prev, v];
      supabase.from("profiles").update({ video_urls: next }).eq("id", userId);
      return next;
    });
    setVideoInput("");
  };

  const saveCareer = async () => {
    setSaving(true);
    await supabase.from("profiles").update({ career: career || null }).eq("id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveLinks = async () => {
    setSaving(true);
    await supabase.from("profiles").update({
      kakao_link: kakao || null,
      instagram:  instagram || null,
      tel:        tel || null,
      video_urls: videos,
    }).eq("id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", border: "1px solid #ddd",
    fontSize: "13px", fontFamily: font, outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase",
    color: "#888", display: "block", marginBottom: "5px", fontFamily: font,
  };

  const toggleFeatured = async (id: string, current: boolean | null) => {
    const next = !current;
    await supabase.from("comp_cards").update({ is_featured: next }).eq("id", id);
    setCompCards(prev => prev.map(c => c.id === id ? { ...c, is_featured: next } : c));
  };

  const saveSpecs = async () => {
    setSaving(true);
    await supabase.from("profiles").update({ visible_specs: visibleSpecs }).eq("id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleSpec = (key: string) => {
    setVisibleSpecs(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "gallery",  label: "갤러리" },
    { key: "snaps",    label: "스냅"   },
    { key: "compcard", label: "컴카드" },
    { key: "career",   label: "경력"   },
    { key: "specs",    label: "스펙"   },
    { key: "links",    label: "링크"   },
    { key: "video",    label: "비디오" },
  ];

  const renderPhotoGrid = (items: Snap[], category: "gallery" | "snap") => (
    <div>
      <label style={{
        display: "block", marginBottom: "12px", fontSize: "11px", letterSpacing: "0.12em",
        textTransform: "uppercase", background: "#111", color: "#fff",
        padding: "11px", textAlign: "center", cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1,
      }}>
        {uploading ? "업로드 중..." : "+ 사진 추가"}
        <input type="file" accept="image/*" multiple style={{ display: "none" }} disabled={uploading}
          onChange={e => { if (e.target.files) uploadPhotos(e.target.files, category); }} />
      </label>
      {items.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#bbb", textAlign: "center", padding: "32px 0", fontFamily: font }}>사진이 없어요</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          {items.map(item => (
            <div key={item.id} style={{ position: "relative", aspectRatio: "2/3", overflow: "hidden" }}>
              <img src={item.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <button onClick={() => deletePhoto(item.id, category)} style={{
                position: "absolute", top: "5px", right: "5px", width: "22px", height: "22px",
                borderRadius: "50%", background: "rgba(0,0,0,0.65)", color: "#fff",
                border: "none", fontSize: "13px", lineHeight: 1, cursor: "pointer",
              }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* 편집 버튼 */}
      <button onClick={() => setOpen(o => !o)} style={{
        position: "fixed", bottom: "28px", right: "28px", zIndex: 100,
        background: "#111", color: "#fff", border: "none",
        padding: "13px 24px", fontSize: "12px", letterSpacing: "0.12em",
        textTransform: "uppercase", fontFamily: font, cursor: "pointer",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}>
        {open ? "닫기" : "편집"}
      </button>

      {/* 편집 패널 */}
      {open && (
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "380px", zIndex: 99,
          background: "#fff", borderLeft: "1px solid #eee",
          display: "flex", flexDirection: "column",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)", fontFamily: font,
        }}>
          {/* 미리보기 */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #eee" }}>
            <a href="?preview=1" target="_blank" rel="noreferrer" style={{
              display: "block", textAlign: "center", padding: "10px",
              border: "1px solid #ddd", fontSize: "11px", letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#555", textDecoration: "none", fontFamily: font,
            }}>
              방문자 화면으로 미리보기 →
            </a>
          </div>

          {/* 탭 */}
          <div style={{ display: "flex", borderBottom: "1px solid #eee" }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex: 1, padding: "14px 0", border: "none", background: "none",
                fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase",
                fontFamily: font, cursor: "pointer",
                color: tab === t.key ? "#111" : "#aaa",
                borderBottom: tab === t.key ? "2px solid #111" : "2px solid transparent",
                fontWeight: tab === t.key ? 600 : 400,
              }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

            {tab === "gallery"  && renderPhotoGrid(gallery, "gallery")}
            {tab === "snaps"    && renderPhotoGrid(snaps,   "snap")}

            {/* 컴카드 탭 */}
            {tab === "compcard" && (
              <div>
                <p style={{ fontSize: "12px", color: "#888", marginBottom: "16px", lineHeight: 1.6, fontFamily: font }}>
                  포트폴리오에 노출할 컴카드를 선택하세요
                </p>
                {compCards.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#bbb", textAlign: "center", padding: "32px 0", fontFamily: font }}>저장된 컴카드가 없어요</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {compCards.map(card => {
                      const mainSrc = card.data?.photos?.[0]?.src;
                      return (
                        <div key={card.id} onClick={() => toggleFeatured(card.id, card.is_featured)}
                          style={{
                            display: "flex", alignItems: "center", gap: "14px",
                            padding: "12px", border: `1.5px solid ${card.is_featured ? "#111" : "#eee"}`,
                            cursor: "pointer", background: card.is_featured ? "#fafafa" : "#fff", transition: "border-color 0.15s",
                          }}>
                          <div style={{ width: "48px", height: "72px", overflow: "hidden", background: card.data?.bgColor ?? "#f0f0f0", flexShrink: 0 }}>
                            {mainSrc
                              ? <img src={mainSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <span style={{ fontSize: "8px", color: "#bbb" }}>{card.canvas_type === "portrait" ? "세로" : "가로"}</span>
                                </div>
                            }
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: "13px", fontFamily: font }}>{card.title}</p>
                            <p style={{ fontSize: "11px", color: "#aaa", marginTop: "2px", fontFamily: font }}>
                              {card.canvas_type === "portrait" ? "세로형" : "가로형"}
                            </p>
                          </div>
                          <div style={{
                            width: "20px", height: "20px", borderRadius: "50%",
                            border: `1.5px solid ${card.is_featured ? "#111" : "#ddd"}`,
                            background: card.is_featured ? "#111" : "#fff",
                            flexShrink: 0,
                          }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 경력 탭 */}
            {tab === "career" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <p style={{ fontSize: "12px", color: "#888", lineHeight: 1.6, fontFamily: font }}>
                  경력을 자유롭게 입력하세요. 줄바꿈으로 항목 구분됩니다.
                </p>
                <textarea
                  style={{ ...inputStyle, height: "240px", resize: "vertical", lineHeight: 1.8 }}
                  value={career}
                  onChange={e => setCareer(e.target.value)}
                  placeholder={"2024  브랜드X 시즌 캠페인\n2023  패션위크 런웨이\n2022  매거진 화보"}
                />
                <button onClick={saveCareer} disabled={saving} style={{
                  padding: "12px", background: "#111", color: "#fff",
                  border: "none", fontSize: "12px", letterSpacing: "0.1em",
                  textTransform: "uppercase", cursor: saving ? "default" : "pointer", fontFamily: font,
                  opacity: saving ? 0.6 : 1,
                }}>
                  {saved ? "저장됨 ✓" : saving ? "저장 중..." : "저장"}
                </button>
              </div>
            )}

            {/* 스펙 탭 */}
            {tab === "specs" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <p style={{ fontSize: "12px", color: "#888", lineHeight: 1.6, fontFamily: font }}>
                  포트폴리오에 노출할 스펙을 선택하세요
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {ALL_SPECS.map(spec => {
                    const on = visibleSpecs.includes(spec.key);
                    return (
                      <div key={spec.key} onClick={() => toggleSpec(spec.key)} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 14px", border: `1.5px solid ${on ? "#111" : "#eee"}`,
                        cursor: "pointer", background: on ? "#fafafa" : "#fff", transition: "border-color 0.15s",
                      }}>
                        <span style={{ fontSize: "12px", fontWeight: 500, letterSpacing: "0.08em", fontFamily: font }}>{spec.label}</span>
                        <div style={{
                          width: "20px", height: "20px", borderRadius: "50%",
                          border: `1.5px solid ${on ? "#111" : "#ddd"}`,
                          background: on ? "#111" : "#fff", flexShrink: 0,
                        }} />
                      </div>
                    );
                  })}
                </div>
                <button onClick={saveSpecs} disabled={saving} style={{
                  padding: "12px", background: "#111", color: "#fff",
                  border: "none", fontSize: "12px", letterSpacing: "0.1em",
                  textTransform: "uppercase", cursor: saving ? "default" : "pointer",
                  fontFamily: font, opacity: saving ? 0.6 : 1,
                }}>
                  {saved ? "저장됨 ✓" : saving ? "저장 중..." : "저장"}
                </button>
              </div>
            )}

            {/* 링크 탭 */}
            {tab === "links" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <label style={labelStyle}>카카오톡 채팅 링크</label>
                  <input style={inputStyle} value={kakao} onChange={e => setKakao(e.target.value)} placeholder="https://qr.kakao.com/talk/..." />
                  <p style={{ fontSize: "11px", color: "#aaa", marginTop: "6px", lineHeight: 1.6, fontFamily: font }}>
                    카카오톡 앱 → 프로필 → QR코드 → 링크 공유에서 복사하세요
                  </p>
                </div>
                <div>
                  <label style={labelStyle}>Instagram (@ 포함)</label>
                  <input style={inputStyle} value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@username" />
                </div>
                <div>
                  <label style={labelStyle}>전화번호</label>
                  <input style={inputStyle} value={tel} onChange={e => setTel(e.target.value)} placeholder="010-0000-0000" />
                </div>
                <button onClick={saveLinks} disabled={saving} style={{
                  background: "#111", color: "#fff", border: "none", padding: "13px",
                  fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase",
                  fontFamily: font, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
                }}>
                  {saved ? "저장됨 ✓" : saving ? "저장 중..." : "저장"}
                </button>
              </div>
            )}

            {/* 비디오 탭 */}
            {tab === "video" && (
              <div>
                {/* 파일 업로드 */}
                <label style={{
                  display: "block", marginBottom: "12px", fontSize: "11px", letterSpacing: "0.12em",
                  textTransform: "uppercase", border: "1px solid #ddd", color: "#555",
                  padding: "11px", textAlign: "center", cursor: vidUploading ? "default" : "pointer", opacity: vidUploading ? 0.6 : 1,
                }}>
                  {vidUploading ? "업로드 중..." : "↑ 비디오 파일 업로드"}
                  <input type="file" accept="video/*" style={{ display: "none" }} disabled={vidUploading}
                    onChange={e => { if (e.target.files?.[0]) uploadVideo(e.target.files[0]); }} />
                </label>

                {/* URL 입력 */}
                <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={videoInput}
                    onChange={e => setVideoInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addVideoUrl(); }}
                    placeholder="YouTube / Vimeo 링크" />
                  <button onClick={addVideoUrl} style={{
                    background: "#111", color: "#fff", border: "none",
                    padding: "9px 14px", fontSize: "12px", fontFamily: font, cursor: "pointer",
                  }}>추가</button>
                </div>

                {videos.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#bbb", textAlign: "center", padding: "24px 0", fontFamily: font }}>등록된 비디오가 없어요</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                    {videos.map((url, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", border: "1px solid #eee" }}>
                        <span style={{ flex: 1, fontSize: "12px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
                        <button onClick={async () => {
                          const next = videos.filter((_, idx) => idx !== i);
                          setVideos(next);
                          await supabase.from("profiles").update({ video_urls: next }).eq("id", userId);
                        }}
                          style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                {videos.length > 0 && (
                  <button onClick={saveLinks} disabled={saving} style={{
                    width: "100%", background: "#111", color: "#fff", border: "none", padding: "13px",
                    fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase",
                    fontFamily: font, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
                  }}>
                    {saved ? "저장됨 ✓" : saving ? "저장 중..." : "저장"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
