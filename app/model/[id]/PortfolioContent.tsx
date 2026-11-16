"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CompCardCanvas from "./CompCardCanvas";
import { BUILTIN_CONCEPTS, conceptLabel, type Concept } from "@/lib/photo-concepts";

const font = "var(--font-inter), var(--font-korean), sans-serif";

type Item = { id: string; url: string; concepts: string[] };
type CompCard = {
  id: string; canvas_type: string; created_at: string;
  data: {
    bgColor?: string; txtColor?: string; fontWeight?: number;
    statsLayout?: "1단" | "2단";
    enabledFields?: { label: string; value: string }[];
    photos?: { id: number; src: string | null; x: number; y: number; w: number; h?: number }[];
    textBlocks?: { id: string; tag: "name"|"korName"|"stats"|"contact"; x: number; y: number; fontSize: number }[];
  }
};
type Tab = "photos" | "compcard" | "video";

function isVideoFile(url: string) {
  return /\.(mp4|mov|webm|avi)(\?|$)/i.test(url);
}
function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").pop();
      return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      return `https://player.vimeo.com/video/${u.pathname.split("/").pop()}`;
    }
  } catch {}
  return null;
}

const pillStyle = (active: boolean): React.CSSProperties => ({
  display: "inline-block", padding: "8px 16px", borderRadius: "999px",
  background: active ? "#111" : "#e8e8e8", color: active ? "#fff" : "#555",
  fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase",
  fontWeight: 600, fontFamily: font, cursor: "pointer",
  border: "none", whiteSpace: "nowrap", transition: "background 0.15s, color 0.15s",
});

function Lightbox({ src, isVideo, onClose }: { src: string; isVideo: boolean; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <button onClick={onClose} style={{ position: "absolute", top: "24px", right: "32px", background: "none", border: "none", color: "#fff", fontSize: "32px", cursor: "pointer", lineHeight: 1 }}>×</button>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "90vh" }}>
        {isVideo
          ? <video src={src} controls autoPlay style={{ maxWidth: "90vw", maxHeight: "90vh", display: "block" }} />
          : <img src={src} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", display: "block", objectFit: "contain" }} />
        }
      </div>
    </div>
  );
}

export default function PortfolioContent({ userId, photos, compCards, videoUrls, lockedForOwner = false }: {
  userId: string;
  photos: Item[];
  compCards: CompCard[];
  videoUrls: string[];
  /** 본인이 보고 있고 Pro가 끝난 상태 — 방문자에게는 사진·영상이 숨겨져 있음 */
  lockedForOwner?: boolean;
}) {
  // 처음엔 전체(최신 업로드 순), 보는 사람이 컨셉을 눌러 골라 봄
  const [concept, setConcept] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Concept[]>(BUILTIN_CONCEPTS);
  useEffect(() => {
    fetch("/api/photos/concepts").then(r => r.json()).then(j => { if (Array.isArray(j.concepts)) setCatalog(j.concepts); }).catch(() => {});
  }, []);
  const present = [...new Set(photos.flatMap(p => p.concepts))]
    .sort((a, b) => photos.filter(p => p.concepts.includes(b)).length - photos.filter(p => p.concepts.includes(a)).length);
  const shownPhotos = concept && present.includes(concept) ? photos.filter(p => p.concepts.includes(concept)) : photos;
  const [isOwner, setIsOwner]   = useState(false);
  const [active, setActive]     = useState<Tab>("compcard");
  const [lightbox, setLightbox] = useState<{ src: string; isVideo: boolean } | null>(null);
  const [viewportH, setViewportH] = useState(700);
  const [viewportW, setViewportW] = useState(1100);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      setViewportH(window.innerHeight);
      setViewportW(window.innerWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "1";
    if (isPreview) return;
    createClient().auth.getUser().then(({ data }) => {
      if (data.user?.id === userId) setIsOwner(true);
    });
  }, [userId]);

  const switchTab = (key: Tab) => {
    setActive(key);
    // 콘텐츠 영역 상단으로 스크롤
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const hasPhotos   = isOwner || photos.length > 0;
  const hasCompCard = isOwner || compCards.length > 0;
  const hasVideo    = isOwner || videoUrls.length > 0;

  // 명함 다음엔 컴카드가 먼저 보이도록
  const tabs = [
    { key: "compcard" as Tab, label: "COMP CARD",  show: hasCompCard },
    { key: "photos"   as Tab, label: "PHOTOS",    show: hasPhotos   },
    { key: "video"    as Tab, label: "VIDEO",      show: hasVideo    },
  ].filter(t => t.show);

  if (tabs.length === 0) return null;
  // 선택한 탭이 없으면(내용 없음) 첫 번째 탭을 보여줌
  const current: Tab = tabs.some(t => t.key === active) ? active : tabs[0].key;

  const featuredCard = compCards[0];
  const cardMaxH = viewportH - 200;
  const cardMaxW = Math.min(1100, viewportW - 40); // 콘텐츠 영역 좌우 패딩 40px

  return (
    <>
      {lightbox && (
        <Lightbox src={lightbox.src} isVideo={lightbox.isVideo} onClose={() => setLightbox(null)} />
      )}

      {/* Pill 네비 */}
      <div className="pf-pills-bar">
        <div className="pf-pills-inner">
          {tabs.map(t => (
            <button key={t.key} onClick={() => switchTab(t.key)} style={pillStyle(current === t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div ref={contentRef} className="pf-content-outer">
        <div className="pf-content-inner">

          {lockedForOwner && current !== "compcard" && (
            <p style={{ fontSize: "12px", color: "#8a5a00", background: "#fff6e5", padding: "10px 12px", marginBottom: "14px", fontFamily: font, lineHeight: 1.6 }}>
              Pro 구독이 끝나 방문자에게는 사진·영상·경력이 숨겨져 있어요. 지워지지 않았고, 다시 구독하면 바로 보여요.
            </p>
          )}
          {current === "photos" && (
            photos.length === 0
              ? <p style={{ fontSize: "13px", color: "#ccc", fontFamily: font }}>편집 → 사진에서 사진을 올려 주세요</p>
              : <>
                  {present.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                      <button onClick={() => setConcept(null)} style={{ ...pillStyle(!concept), padding: "6px 12px", fontSize: "11px", textTransform: "none", letterSpacing: "0.02em" }}>전체 {photos.length}</button>
                      {present.map(c => (
                        <button key={c} onClick={() => setConcept(c)} style={{ ...pillStyle(concept === c), padding: "6px 12px", fontSize: "11px", textTransform: "none", letterSpacing: "0.02em" }}>
                          {conceptLabel(c, catalog)} {photos.filter(p => p.concepts.includes(c)).length}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="pf-gallery-grid" style={{ columnGap: "8px" }}>
                    {shownPhotos.map(item => (
                      <div key={item.id} className="portfolio-img-wrap" onClick={() => setLightbox({ src: item.url, isVideo: false })}
                        style={{ breakInside: "avoid", marginBottom: "8px", overflow: "hidden", lineHeight: 0, cursor: "pointer" }}>
                        <img src={item.url} alt="" style={{ width: "100%", display: "block" }} />
                      </div>
                    ))}
                  </div>
                </>
          )}

          {current === "compcard" && (
            !featuredCard
              ? <p style={{ fontSize: "13px", color: "#ccc", fontFamily: font }}>편집 → 컴카드 탭에서 노출할 컴카드를 선택해주세요</p>
              : <div style={{ display: "flex", justifyContent: "center" }}>
                  <CompCardCanvas
                    canvasType={featuredCard.canvas_type}
                    data={featuredCard.data}
                    maxWidth={cardMaxW}
                    maxHeight={cardMaxH}
                  />
                </div>
          )}

          {current === "video" && (
            videoUrls.length === 0
              ? <p style={{ fontSize: "13px", color: "#ccc", fontFamily: font }}>비디오를 등록해주세요</p>
              : <div className="pf-video-grid">
                  {videoUrls.map((url, i) => {
                    if (isVideoFile(url)) return (
                      <div key={i} onClick={() => setLightbox({ src: url, isVideo: true })}
                        style={{ aspectRatio: "16/9", background: "#111", overflow: "hidden", cursor: "pointer", position: "relative" }}>
                        <video src={url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: "20px", marginLeft: "4px" }}>▶</span>
                          </div>
                        </div>
                      </div>
                    );
                    const embedUrl = getEmbedUrl(url);
                    return embedUrl ? (
                      <div key={i} style={{ aspectRatio: "16/9", overflow: "hidden", background: "#111" }}>
                        <iframe src={embedUrl} style={{ width: "100%", height: "100%", border: "none" }} allow="autoplay; fullscreen" allowFullScreen />
                      </div>
                    ) : null;
                  })}
                </div>
          )}

        </div>
      </div>
    </>
  );
}
