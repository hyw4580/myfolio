"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBillingStatus } from "@/lib/billing/client";
import { FREE_FEATURED_LIMIT } from "@/lib/billing/plans";
import { useIsNativeApp } from "@/lib/native";
import Link from "next/link";
import { BUILTIN_CONCEPTS, MAX_CONCEPTS_PER_PHOTO, conceptLabel, customConcept, type Concept } from "@/lib/photo-concepts";

type Snap     = { id: string; url: string; order: number; category: string; concepts?: string[]; ai_concepts?: string[] | null };
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
  const [tab, setTab]         = useState<"photos" | "compcard" | "links" | "video" | "career" | "specs">("photos");

  const [compCards, setCompCards] = useState<CompCard[]>(initialCompCards);
  // 갤러리·스냅을 "사진" 하나로 (촬영 컨셉으로 구분)
  const [photos,    setPhotos]    = useState<Snap[]>(() => [...initialGallery, ...initialSnaps].sort((a, b) => a.order - b.order));
  const [catalog,   setCatalog]   = useState<Concept[]>(BUILTIN_CONCEPTS);
  const [editing,   setEditing]   = useState<{ id: string; picked: string[]; custom: string } | null>(null);
  const [judging,   setJudging]   = useState(false);
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
  const orderRef = useRef(Math.max(0, ...[...initialGallery, ...initialSnaps].map(p => p.order + 1)));
  // 포트폴리오 게시물(갤러리·스냅·영상·경력·링크)은 Pro 전용. 결제 설정 전에는 제한 없음
  const [billing] = useBillingStatus();
  const proLocked = billing?.configured === true && !billing.isPro;
  const inApp = useIsNativeApp(); // 앱 안에서는 외부 결제 안내 숨김

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1") return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id !== userId) return;
      setIsOwner(true);
      // 마이페이지에서 "갤러리 관리" 등으로 들어오면 편집창을 해당 탭으로 바로 열기
      const want = new URLSearchParams(window.location.search).get("edit");
      const tabs = ["photos", "compcard", "links", "video", "career", "specs"] as const;
      const found = want === "gallery" || want === "snaps" ? "photos" : tabs.find(t => t === want);
      if (found) { setTab(found); setOpen(true); }
      fetch("/api/photos/concepts").then(r => r.json()).then(j => { if (Array.isArray(j.concepts)) setCatalog(j.concepts); }).catch(() => {});
    });
  }, [userId]);

  if (!isOwner) return null;

  const uploadPhotos = async (files: FileList) => {
    setUploading(true);
    const added: string[] = [];
    const category = "gallery";
    for (const file of Array.from(files)) {
      const ext  = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("snaps").upload(path, file);
      if (error) { alert(`사진 업로드 실패: ${error.message}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from("snaps").getPublicUrl(path);
      const order = orderRef.current++;
      const { data: row, error: dbError } = await supabase.from("snaps").insert({ user_id: userId, url: publicUrl, order, category }).select("id, url, order, category, concepts").single();
      if (dbError) { alert(dbError.message.includes("row-level security") ? "사진은 Pro 회원만 올릴 수 있어요." : `DB 저장 실패: ${dbError.message}`); continue; }
      if (row) { setPhotos(prev => [...prev, row]); added.push(String(row.id)); }
    }
    setUploading(false);
    // 올린 사진의 촬영 컨셉을 AI가 판독 (틀리면 사진 아래 컨셉을 눌러 고치면 돼요)
    for (let i = 0; i < added.length; i += 10) {
      setJudging(true);
      const res = await fetch("/api/photos/concepts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "classify", ids: added.slice(i, i + 10) }) }).catch(() => null);
      const j = res?.ok ? await res.json().catch(() => null) : null;
      if (j?.photos) setPhotos(prev => prev.map(p => j.photos[p.id] ? { ...p, concepts: j.photos[p.id].concepts, ai_concepts: j.photos[p.id].ai } : p));
    }
    setJudging(false);
  };

  const deletePhoto = async (id: string) => {
    await supabase.from("snaps").delete().eq("id", id);
    setPhotos(prev => prev.filter(s => s.id !== id));
  };

  /** 컨셉 고치기 저장 → 서버가 AI 판독과 비교해 기록 (다음 판독이 더 정확해짐) */
  const saveConcepts = async () => {
    if (!editing) return;
    const extra = editing.custom.trim() ? customConcept(editing.custom) : null;
    const next = [...new Set([...editing.picked, ...(extra ? [extra] : [])])].slice(0, MAX_CONCEPTS_PER_PHOTO);
    const res = await fetch("/api/photos/concepts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set", id: editing.id, concepts: next }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { alert(j.error ?? "저장하지 못했어요."); return; }
    setPhotos(prev => prev.map(p => p.id === editing.id ? { ...p, concepts: j.concepts } : p));
    setEditing(null);
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
    const { error } = await supabase.from("profiles").update({ career: career || null }).eq("id", userId);
    setSaving(false);
    if (error) { alert(error.message.includes("PRO_REQUIRED") ? "경력은 Pro 회원만 작성할 수 있어요." : "저장하지 못했어요."); return; }
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
    if (next && proLocked && compCards.filter(c => c.is_featured).length >= FREE_FEATURED_LIMIT) {
      alert(`무료 회원은 컴카드 ${FREE_FEATURED_LIMIT}장까지 공개할 수 있어요. Pro로 여러 장을 공개해 보세요.`);
      return;
    }
    // 서버에서 한도를 다시 확인하고 공개/비공개 처리
    const res = await fetch("/api/comcard/publish", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: id, publish: next }),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? "처리하지 못했어요."); return; }
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
    { key: "photos",   label: "사진"   },
    { key: "compcard", label: "컴카드" },
    { key: "career",   label: "경력"   },
    { key: "specs",    label: "스펙"   },
    { key: "links",    label: "링크"   },
    { key: "video",    label: "비디오" },
  ];

  const chip = (active: boolean): React.CSSProperties => ({
    padding: "4px 8px", fontSize: "11px", borderRadius: "999px", cursor: "pointer", fontFamily: font,
    border: `1px solid ${active ? "#111" : "#ddd"}`, background: active ? "#111" : "#fff", color: active ? "#fff" : "#555",
  });

  const renderPhotoGrid = () => (
    <div>
      <label style={{
        display: "block", marginBottom: "8px", fontSize: "11px", letterSpacing: "0.12em",
        textTransform: "uppercase", background: "#111", color: "#fff",
        padding: "11px", textAlign: "center", cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1,
      }}>
        {uploading ? "업로드 중..." : "+ 사진 추가"}
        <input type="file" accept="image/*" multiple style={{ display: "none" }} disabled={uploading}
          onChange={e => { if (e.target.files) uploadPhotos(e.target.files); }} />
      </label>
      <p style={{ fontSize: "11px", color: "#999", lineHeight: 1.6, marginBottom: "12px", fontFamily: font }}>
        {judging ? "✨ AI가 촬영 컨셉을 고르는 중..." : "올리면 AI가 촬영 컨셉(패션·뷰티·커머셜 등)을 골라요. 틀리면 컨셉을 눌러 고쳐 주세요. 고친 내용으로 AI가 점점 정확해져요."}
      </p>
      {photos.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#bbb", textAlign: "center", padding: "32px 0", fontFamily: font }}>사진이 없어요</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 6px" }}>
          {photos.map(item => {
            const cs = item.concepts ?? [];
            const fromAi = cs.length > 0 && JSON.stringify(cs) === JSON.stringify(item.ai_concepts ?? []);
            const isEditing = editing?.id === item.id;
            return (
              <div key={item.id} style={{ gridColumn: isEditing ? "1 / -1" : undefined }}>
                <div style={{ position: "relative", aspectRatio: "2/3", overflow: "hidden", maxWidth: isEditing ? "50%" : undefined }}>
                  <img src={item.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <button onClick={() => deletePhoto(item.id)} style={{
                    position: "absolute", top: "5px", right: "5px", width: "22px", height: "22px",
                    borderRadius: "50%", background: "rgba(0,0,0,0.65)", color: "#fff",
                    border: "none", fontSize: "13px", lineHeight: 1, cursor: "pointer",
                  }}>×</button>
                </div>
                {!isEditing ? (
                  <button onClick={() => setEditing({ id: item.id, picked: cs.filter(c => !c.startsWith("c:")), custom: cs.find(c => c.startsWith("c:"))?.slice(2) ?? "" })}
                    style={{ marginTop: "4px", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontSize: "11px", color: cs.length ? "#333" : "#aaa", fontFamily: font }}>
                    {cs.length ? `${fromAi ? "✨ " : ""}${cs.map(c => conceptLabel(c, catalog)).join(" · ")}` : "+ 컨셉 고르기"} <span style={{ color: "#aaa" }}>✎</span>
                  </button>
                ) : (
                  <div style={{ marginTop: "8px", border: "1px solid #eee", padding: "10px" }}>
                    <p style={{ fontSize: "11px", color: "#888", marginBottom: "6px", fontFamily: font }}>촬영 컨셉 (최대 {MAX_CONCEPTS_PER_PHOTO}개)</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
                      {catalog.map(c => {
                        const on = editing.picked.includes(c.id);
                        return <button key={c.id} style={chip(on)} onClick={() => setEditing(e => e && ({
                          ...e, picked: on ? e.picked.filter(x => x !== c.id) : [...e.picked, c.id].slice(-(MAX_CONCEPTS_PER_PHOTO - (e.custom.trim() ? 1 : 0))),
                        }))}>{c.label}</button>;
                      })}
                    </div>
                    <input value={editing.custom} maxLength={20} onChange={e => setEditing(x => x && ({ ...x, custom: e.target.value, picked: e.target.value.trim() ? x.picked.slice(0, MAX_CONCEPTS_PER_PHOTO - 1) : x.picked }))}
                      placeholder="목록에 없으면 직접 입력 (예: 키즈)" style={{ ...inputStyle, marginBottom: "8px" }} />
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={saveConcepts} style={{ flex: 1, padding: "8px", background: "#111", color: "#fff", border: "none", fontSize: "12px", cursor: "pointer" }}>저장</button>
                      <button onClick={() => setEditing(null)} style={{ flex: 1, padding: "8px", background: "#fff", border: "1px solid #ddd", fontSize: "12px", cursor: "pointer" }}>취소</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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

            {proLocked && ["photos", "career", "video"].includes(tab) ? (
              <div style={{ textAlign: "center", padding: "40px 12px", fontFamily: font }}>
                <p style={{ fontSize: "13px", color: "#111", marginBottom: "8px" }}>🔒 Pro 회원 전용 기능이에요</p>
                <p style={{ fontSize: "12px", color: "#888", lineHeight: 1.7, marginBottom: "18px" }}>사진·영상·경력으로 포트폴리오를 채우려면<br />Pro 구독이 필요해요. 구독이 끝나면 올린 내용은 지워지지 않고 숨겨지며, 다시 구독하면 바로 보여요.</p>
                {!inApp && <Link href="/pricing" style={{ display: "inline-block", padding: "10px 20px", background: "#111", color: "#fff", fontSize: "12px", textDecoration: "none" }}>요금제 보기</Link>}
              </div>
            ) : <>
            {tab === "photos"   && renderPhotoGrid()}

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
            </>}
          </div>
        </div>
      )}
    </>
  );
}
