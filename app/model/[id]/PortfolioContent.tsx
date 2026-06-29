"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CompCardCanvas from "./CompCardCanvas";

const font = "var(--font-inter), var(--font-korean), sans-serif";

type Item = { id: string; url: string };
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
type Tab = "gallery" | "snaps" | "compcard" | "video";

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

export default function PortfolioContent({ userId, gallery, snaps, compCards, videoUrls }: {
  userId: string;
  gallery: Item[];
  snaps: Item[];
  compCards: CompCard[];
  videoUrls: string[];
}) {
  const [isOwner, setIsOwner]   = useState(false);
  const [active, setActive]     = useState<Tab>("gallery");
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

  const hasGallery  = isOwner || gallery.length > 0;
  const hasSnaps    = isOwner || snaps.length > 0;
  const hasCompCard = isOwner || compCards.length > 0;
  const hasVideo    = isOwner || videoUrls.length > 0;

  const tabs = [
    { key: "gallery"  as Tab, label: "GALLERY",   show: hasGallery  },
    { key: "snaps"    as Tab, label: "SNAPS",      show: hasSnaps    },
    { key: "compcard" as Tab, label: "COMP CARD",  show: hasCompCard },
    { key: "video"    as Tab, label: "VIDEO",      show: hasVideo    },
  ].filter(t => t.show);

  if (tabs.length === 0) return null;

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
            <button key={t.key} onClick={() => switchTab(t.key)} style={pillStyle(active === t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div ref={contentRef} className="pf-content-outer">
        <div className="pf-content-inner">

          {active === "gallery" && (
            gallery.length === 0
              ? <p style={{ fontSize: "13px", color: "#ccc", fontFamily: font }}>갤러리에 사진을 등록해주세요</p>
              : <div className="pf-gallery-grid" style={{ columnGap: "8px" }}>
                  {gallery.map(item => (
                    <div key={item.id} className="portfolio-img-wrap" onClick={() => setLightbox({ src: item.url, isVideo: false })}
                      style={{ breakInside: "avoid", marginBottom: "8px", overflow: "hidden", lineHeight: 0, cursor: "pointer" }}>
                      <img src={item.url} alt="" style={{ width: "100%", display: "block" }} />
                    </div>
                  ))}
                </div>
          )}

          {active === "snaps" && (
            snaps.length === 0
              ? <p style={{ fontSize: "13px", color: "#ccc", fontFamily: font }}>스냅 사진을 등록해주세요</p>
              : <div className="pf-gallery-grid" style={{ columnGap: "8px" }}>
                  {snaps.map(item => (
                    <div key={item.id} className="portfolio-img-wrap" onClick={() => setLightbox({ src: item.url, isVideo: false })}
                      style={{ breakInside: "avoid", marginBottom: "8px", overflow: "hidden", lineHeight: 0, cursor: "pointer" }}>
                      <img src={item.url} alt="" style={{ width: "100%", display: "block" }} />
                    </div>
                  ))}
                </div>
          )}

          {active === "compcard" && (
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

          {active === "video" && (
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
