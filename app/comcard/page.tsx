"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Nav from "../components/Nav";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useBillingStatus } from "@/lib/billing/client";
import ShareButtons from "../components/ShareButtons";
import { useIsNativeApp } from "@/lib/native";
import { FREE_EXPORT_CARD_LIMIT, FREE_FEATURED_LIMIT, PRO_PLAN, formatKRW } from "@/lib/billing/plans";
import { track, tallyEdit, startEditorSession, endEditorSession, checkpointEditorSession, setEditorLayout, muteTallies, talliesMuted, type EditKind } from "@/lib/analytics";
import { MIN_TEMPLATE_USERS, type ComboInsight } from "@/lib/comcard-ranking";
import { buildLayout, safeOrder, PRESET_BY_ID, presetOptions, availablePresets, isContactField, isStatsField, type LayoutTemplate, type Preset } from "@/lib/comcard-layouts";
import type { ComcardSuggestion, PhotoType, SuggestResponse } from "../api/comcard/suggest/route";

/* ─────────────────────── canvas config ─────────────────────── */
const CANVAS = {
  portrait:  { w: 480, h: 680, label: "세로형", sub: "Portrait A4" },
  landscape: { w: 680, h: 480, label: "가로형", sub: "Landscape A4" },
} as const;
type CanvasType = keyof typeof CANVAS;

/* ─────────────────────────── types ─────────────────────────── */
type PhotoItem = { id: number; src: string | null; x: number; y: number; w: number; h: number };
type TextBlock  = { id: string; tag: "name" | "korName" | "stats" | "contact"; x: number; y: number; fontSize: number };
type SnapLines  = { xs: number[]; ys: number[] };
type Corner = "br" | "bl" | "tr" | "tl";
type Handle = Corner | "t" | "b" | "l" | "r";
type DragState  =
  | { type: "photo-move";   id: number; mx: number; my: number; ox: number; oy: number }
  | { type: "photo-resize"; id: number; mx: number; my: number; ow: number; oh: number; ox: number; oy: number; handle: Handle }
  | { type: "text-move";    id: string; mx: number; my: number; ox: number; oy: number }
  | null;

const SNAP        =  4; // move snap threshold (px)
const RESIZE_SNAP =  4; // resize snap threshold

/* ── touch/mouse 좌표 통합 헬퍼 ── */
function getClientPos(e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } {
  if ("touches" in e) {
    const t = (e as TouchEvent | React.TouchEvent).touches[0] ?? (e as TouchEvent | React.TouchEvent).changedTouches[0];
    return { clientX: t.clientX, clientY: t.clientY };
  }
  return { clientX: (e as MouseEvent | React.MouseEvent).clientX, clientY: (e as MouseEvent | React.MouseEvent).clientY };
}

/* ─────────────────────── profile → card values ──────────────── */
type ProfileRow = {
  eng_name: string | null; kor_name: string | null; gender: string | null; birth_year: number | null;
  height: number | null; weight: number | null; chest: number | null; waist: number | null; hip: number | null;
  shoe_size: number | null; hair: string | null; eye: string | null;
  instagram: string | null; email: string | null; tel: string | null;
};

/** 마이페이지 프로필 → 컴카드 표시용 문자열 (비어 있는 값은 제외) */
function profileToValues(p: ProfileRow): Record<string, string> {
  const num = (v: number | null, unit: string) => (v && v > 0 ? `${v}${unit}` : "");
  const out: Record<string, string> = {
    engName: p.eng_name ?? "", korName: p.kor_name ?? "",
    gender: p.gender ?? "", birthYear: p.birth_year ? String(p.birth_year) : "",
    height: num(p.height, " cm"), weight: num(p.weight, " kg"),
    chest: num(p.chest, " in"), waist: num(p.waist, " in"), hip: num(p.hip, " in"),
    shoeSize: num(p.shoe_size, " mm"), hairColor: p.hair ?? "", eyeColor: p.eye ?? "",
    instagram: p.instagram ?? "", email: p.email ?? "", phone: p.tel ?? "",
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v.trim() !== ""));
}

const profileFields = [
  { key: "engName",   label: "English Name", always: true },
  { key: "korName",   label: "Korean Name" },
  { key: "gender",    label: "Gender" },
  { key: "birthYear", label: "Birth Year" },
  { key: "height",    label: "Height" },
  { key: "weight",    label: "Weight" },
  { key: "chest",     label: "Bust" },
  { key: "waist",     label: "Waist" },
  { key: "hip",       label: "Hip" },
  { key: "shoeSize",  label: "Shoe Size" },
  { key: "hairColor", label: "Hair" },
  { key: "eyeColor",  label: "Eyes" },
  { key: "instagram", label: "Instagram" },
  { key: "email",     label: "Email" },
  { key: "phone",     label: "Phone" },
];

/* ────────────── photo grid helpers ─────────────────────────── */
/**
 * Compute photo positions given a specific base photo width.
 * Portrait: all photos same size. Landscape: main (id=0) uses `mainW`, rest fill right column.
 */
function computePhotoGrid(canvas: CanvasType, count: number, mainW: number): PhotoItem[] {
  const { w, h } = CANVAS[canvas];
  const gap = 4;

  if (canvas === "portrait") {
    const cols   = count <= 4 ? 2 : 3;
    const rows   = Math.ceil(count / cols);
    const photoH = Math.round(mainW * (4/3));
    const totalW = cols * mainW + (cols - 1) * gap;
    const totalH = rows * photoH + (rows - 1) * gap;
    const sx = Math.max(0, Math.floor((w - totalW) / 2));
    const sy = Math.max(0, Math.floor((h - totalH) / 2));
    return Array.from({ length: count }, (_, i) => ({
      id: i, src: null,
      x: sx + (i % cols) * (mainW + gap),
      y: sy + Math.floor(i / cols) * (photoH + gap),
      w: mainW, h: photoH,
    }));
  } else {
    // landscape: big photo left + smaller grid right
    const mainH  = Math.round(mainW * (4/3));
    const rest   = count - 1;
    if (rest === 0) return [{ id: 0, src: null, x: Math.floor((w - mainW) / 2), y: Math.floor((h - mainH) / 2), w: mainW, h: mainH }];
    const rCols  = rest <= 2 ? 1 : 2;
    const rRows  = Math.ceil(rest / rCols);
    const rx     = mainW + gap * 2;
    const availW = w - rx - gap * (rCols + 1);
    const rW     = Math.min(
      Math.floor(availW / rCols),
      Math.floor((h - gap * (rRows + 1)) / (rRows * (4/3))),
    );
    const rH      = Math.round(rW * (4/3));
    const rTotal  = rRows * rH + (rRows - 1) * gap;
    const rStartY = Math.max(gap, Math.floor((h - rTotal) / 2));
    const mainY   = Math.max(gap, Math.floor((h - mainH) / 2));
    return Array.from({ length: count }, (_, i) => {
      if (i === 0) return { id: 0, src: null, x: gap, y: mainY, w: mainW, h: mainH };
      const ri = i - 1;
      return { id: i, src: null, x: rx + gap + (ri % rCols) * (rW + gap), y: rStartY + Math.floor(ri / rCols) * (rH + gap), w: rW, h: rH };
    });
  }
}

/** Compute optimal base photo width so all photos fit within canvas */
function getDefaultPhotos(canvas: CanvasType, count: number): PhotoItem[] {
  const { w, h } = CANVAS[canvas];
  const gap = 4;
  let mainW: number;

  if (canvas === "portrait") {
    const cols = count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    mainW = Math.min(
      Math.floor((w - gap * (cols - 1)) / cols),
      Math.floor((h - gap * (rows - 1)) / (rows * (4/3))),
    );
  } else {
    // Landscape: pick mainW = 35% of canvas width (computePhotoGrid will fit the right column)
    mainW = Math.floor(w * 0.35);
  }
  return computePhotoGrid(canvas, count, mainW);
}

function getDefaultTextBlocks(canvas: CanvasType): TextBlock[] {
  const { w, h } = CANVAS[canvas];
  return [
    { id: "name",    tag: "name",    x: 16, y: h - 100, fontSize: 22 },
    { id: "korName", tag: "korName", x: 16, y: h - 72,  fontSize: 13 },
    { id: "stats",   tag: "stats",   x: 16, y: h - 52,  fontSize: 11 },
    { id: "contact", tag: "contact", x: w - 160, y: h - 46, fontSize: 10 },
  ];
}

/* ─────────────── photo element (display only) ───────────────── */
function PhotoElement({ item, isSelected, isMain, isDark }: { item: PhotoItem; isSelected: boolean; isMain: boolean; isDark: boolean }) {
  const ph = item.h;
  const base: React.CSSProperties = { position: "absolute", background: "#fff", border: "1px solid #0066FF", zIndex: 30, pointerEvents: "none" };
  const corner: React.CSSProperties = { ...base, width: 6, height: 6 };
  const edgeH:  React.CSSProperties = { ...base, width: 16, height: 3, left: "50%", transform: "translateX(-50%)" };
  const edgeV:  React.CSSProperties = { ...base, width: 3, height: 16, top: "50%", transform: "translateY(-50%)" };
  return (
    <div style={{
      position: "absolute", left: item.x, top: item.y, width: item.w, height: ph,
      cursor: "move", userSelect: "none",
      outline: isSelected ? "1px solid rgba(0,102,255,0.7)" : "1px solid rgba(0,0,0,0.08)",
      zIndex: isSelected ? 10 : 5,
    }}>
      {item.src
        ? <img src={item.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
        : <div style={{ width: "100%", height: "100%", background: isDark ? "#2A2A2A" : "#D8D4CF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", pointerEvents: "none" }}>
            <span style={{ fontSize: "20px", color: isDark ? "#555" : "#B0ACA8" }}>+</span>
            <span style={{ fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: isDark ? "#555" : "#A8A49F" }}>{isMain ? "Main" : `Photo`}</span>
          </div>
      }
      {isSelected && (
        <>
          <div style={{ ...corner, top: -3, left: -3 }} />
          <div style={{ ...corner, top: -3, right: -3 }} />
          <div style={{ ...corner, bottom: -3, left: -3 }} />
          <div style={{ ...corner, bottom: -3, right: -3 }} />
          <div style={{ ...edgeH, top: -2 }} />
          <div style={{ ...edgeH, bottom: -2 }} />
          <div style={{ ...edgeV, left: -2 }} />
          <div style={{ ...edgeV, right: -2 }} />
        </>
      )}
      {isMain && <span style={{ position: "absolute", top: 6, left: 6, fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", background: "rgba(0,0,0,0.5)", color: "#fff", padding: "2px 7px", pointerEvents: "none" }}>Main</span>}
    </div>
  );
}

/* ─────────────── text element ───────────────────────────────── */
function TextElement({ block, children, onMoveStart, onSize }: {
  block: TextBlock;
  children: React.ReactNode;
  onMoveStart: (pos: { clientX: number; clientY: number }) => void;
  onSize: (id: string, w: number, h: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const report = () => onSize(block.id, el.offsetWidth, el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [block.id]);

  return (
    <div
      ref={divRef}
      onMouseDown={(e) => { e.stopPropagation(); onMoveStart(getClientPos(e)); }}
      data-text-block=""
      onTouchStart={(e) => { e.stopPropagation(); onMoveStart(getClientPos(e)); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "absolute", left: block.x, top: block.y, cursor: "grab", userSelect: "none", zIndex: 20, outline: hovered ? "1px dashed rgba(0,102,255,0.5)" : "1px dashed transparent", outlineOffset: "4px", touchAction: "none" }}
    >
      {hovered && <span style={{ position: "absolute", top: -16, left: 0, fontSize: "8px", letterSpacing: "0.1em", color: "#0066FF", whiteSpace: "nowrap", textTransform: "uppercase", pointerEvents: "none" }}>drag</span>}
      {children}
    </div>
  );
}

/* ─────────────── canvas editor ─────────────────────────────── */
const RESIZE_ZONE = 22;

/** 선택된 사진의 리사이즈 핸들 위치 (모서리 4 + 변 4) */
function getHandles(sel: PhotoItem): { handle: Handle; x: number; y: number }[] {
  const mx = sel.x + sel.w / 2, my = sel.y + sel.h / 2;
  return [
    { handle: "tl", x: sel.x,         y: sel.y          },
    { handle: "tr", x: sel.x + sel.w, y: sel.y          },
    { handle: "bl", x: sel.x,         y: sel.y + sel.h  },
    { handle: "br", x: sel.x + sel.w, y: sel.y + sel.h  },
    { handle: "t",  x: mx,            y: sel.y          },
    { handle: "b",  x: mx,            y: sel.y + sel.h  },
    { handle: "l",  x: sel.x,         y: my             },
    { handle: "r",  x: sel.x + sel.w, y: my             },
  ];
}

function CanvasEditor({ canvas, bgColor, txtColor, fontWeight, nameCaps, photos, setPhotos, textBlocks, setTextBlocks, selectedFields, statsLayout, onPhotoResize, canvasRef, scale, userZoomRef }: {
  canvas: CanvasType; bgColor: string; txtColor: string; fontWeight: number; nameCaps: boolean;
  photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
  textBlocks: TextBlock[]; setTextBlocks: React.Dispatch<React.SetStateAction<TextBlock[]>>;
  selectedFields: { label: string; value: string }[];
  statsLayout: "1단" | "2단";
  onPhotoResize: (w: number) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
  userZoomRef: React.RefObject<number>;
}) {
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [snapLines, setSnapLines]     = useState<SnapLines>({ xs: [], ys: [] });
  const dragRef        = useRef<DragState>(null);
  const movedRef       = useRef(false); // 실제로 끌었는지 (클릭만 한 건 편집으로 안 셈)
  const photosRef      = useRef(photos);
  const canvasTypeRef  = useRef(canvas);
  const textBlocksRef  = useRef(textBlocks);
  const textSizesRef   = useRef<Record<string, { w: number; h: number }>>({});
  const selectedIdRef  = useRef(selectedId);
  const scaleRefOuter  = useRef(scale);
  photosRef.current      = photos;
  canvasTypeRef.current  = canvas;
  textBlocksRef.current  = textBlocks;
  selectedIdRef.current  = selectedId;
  scaleRefOuter.current  = scale;

  const handleTextSize = useCallback((id: string, w: number, h: number) => {
    textSizesRef.current[id] = { w, h };
  }, []);

  const { w, h } = CANVAS[canvas];

  // 사진/핸들 위에서만 scroll 차단 — 배경 터치 시 페이지 스크롤 허용
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      // 텍스트 블록 드래그 시작 → 스크롤 차단
      if ((e.target as HTMLElement | null)?.closest?.("[data-text-block]")) { e.preventDefault(); return; }
      const rect = el.getBoundingClientRect();
      const t = e.touches[0];
      const s = scaleRefOuter.current * (userZoomRef.current ?? 1);
      const cx = (t.clientX - rect.left) / s;
      const cy = (t.clientY - rect.top) / s;
      const curPhotos = photosRef.current;
      const curSel = selectedIdRef.current;
      // 리사이즈 핸들(모서리 + 변) 체크 — 마우스 판정과 같은 영역
      if (curSel !== null) {
        const sel = curPhotos.find(p => p.id === curSel);
        if (sel && getHandles(sel).some(hd => Math.abs(cx - hd.x) <= RESIZE_ZONE && Math.abs(cy - hd.y) <= RESIZE_ZONE)) {
          e.preventDefault(); return;
        }
      }
      // 사진 영역 체크
      for (let i = curPhotos.length - 1; i >= 0; i--) {
        const p = curPhotos[i];
        if (cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h) {
          e.preventDefault(); return;
        }
      }
      // 배경 터치 → preventDefault 없음 → 페이지 스크롤 허용
    };
    el.addEventListener("touchstart", handler, { passive: false });
    return () => el.removeEventListener("touchstart", handler);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const d = dragRef.current;
      if (!d) return; // 드래그 중이 아니면 스크롤 허용
      movedRef.current = true;
      if (e.cancelable) e.preventDefault();
      const { clientX, clientY } = getClientPos(e);
      const s = scaleRefOuter.current * (userZoomRef.current ?? 1);

      if (d.type === "photo-move") {
        const prev    = photosRef.current;
        const moving  = prev.find(p => p.id === d.id);
        if (!moving) return;
        const ph = moving.h;
        const cv = CANVAS[canvasTypeRef.current];

        let nx = d.ox + (clientX - d.mx) / s;
        let ny = d.oy + (clientY - d.my) / s;
        const snapXs: number[] = [];
        const snapYs: number[] = [];

        // 안전 영역 스냅 (칼선) — 일반 스냅과 동일 임계값으로 가볍게
        const m = (cv.w > cv.h ? cv.w / 297 : cv.w / 210) * 2;
        if (Math.abs(nx - m) < SNAP)                             { nx = m;                  snapXs.push(m); }
        else if (Math.abs(nx + moving.w - (cv.w - m)) < SNAP)   { nx = cv.w - m - moving.w; snapXs.push(cv.w - m); }
        if (Math.abs(ny - m) < SNAP)                             { ny = m;                  snapYs.push(m); }
        else if (Math.abs(ny + ph - (cv.h - m)) < SNAP)         { ny = cv.h - m - ph;       snapYs.push(cv.h - m); }

        // Canvas edge snaps
        if (!snapXs.length) {
          if      (Math.abs(nx) < SNAP)                        { nx = 0;              snapXs.push(0); }
          else if (Math.abs(nx + moving.w - cv.w) < SNAP)     { nx = cv.w - moving.w; snapXs.push(cv.w); }
        }
        if (!snapYs.length) {
          if      (Math.abs(ny) < SNAP)                        { ny = 0;              snapYs.push(0); }
          else if (Math.abs(ny + ph - cv.h) < SNAP)           { ny = cv.h - ph;      snapYs.push(cv.h); }
        }

        // Other photo edge snaps
        for (const other of prev) {
          if (other.id === d.id) continue;
          const oph = other.h;
          if (!snapXs.length) {
            if      (Math.abs(nx - other.x) < SNAP)                     { nx = other.x; snapXs.push(other.x); }
            else if (Math.abs(nx - (other.x + other.w)) < SNAP)         { nx = other.x + other.w; snapXs.push(other.x + other.w); }
            else if (Math.abs(nx + moving.w - other.x) < SNAP)          { nx = other.x - moving.w; snapXs.push(other.x); }
            else if (Math.abs(nx + moving.w - (other.x + other.w)) < SNAP) { nx = other.x + other.w - moving.w; snapXs.push(other.x + other.w); }
          }
          if (!snapYs.length) {
            if      (Math.abs(ny - other.y) < SNAP)                     { ny = other.y; snapYs.push(other.y); }
            else if (Math.abs(ny - (other.y + oph)) < SNAP)             { ny = other.y + oph; snapYs.push(other.y + oph); }
            else if (Math.abs(ny + ph - other.y) < SNAP)                { ny = other.y - ph; snapYs.push(other.y); }
            else if (Math.abs(ny + ph - (other.y + oph)) < SNAP)        { ny = other.y + oph - ph; snapYs.push(other.y + oph); }
          }
        }

        // Equal-gap snapping
        const others = prev.filter(p => p.id !== d.id);
        if (!snapXs.length) {
          const hGaps = new Set<number>();
          for (const a of others) for (const b of others) {
            if (a === b) continue;
            const g = Math.round(b.x - (a.x + a.w));
            if (g > 0 && g <= 80) hGaps.add(g);
          }
          gapX: for (const other of others) {
            for (const g of hGaps) {
              if (Math.abs(nx - (other.x + other.w + g)) < SNAP)      { nx = other.x + other.w + g; snapXs.push(other.x + other.w); break gapX; }
              if (Math.abs(nx + moving.w + g - other.x) < SNAP)       { nx = other.x - moving.w - g; snapXs.push(other.x); break gapX; }
            }
          }
        }
        if (!snapYs.length) {
          const vGaps = new Set<number>();
          for (const a of others) for (const b of others) {
            if (a === b) continue;
            const g = Math.round(b.y - (a.y + a.h));
            if (g > 0 && g <= 80) vGaps.add(g);
          }
          gapY: for (const other of others) {
            const oph = other.h;
            for (const g of vGaps) {
              if (Math.abs(ny - (other.y + oph + g)) < SNAP)          { ny = other.y + oph + g; snapYs.push(other.y + oph); break gapY; }
              if (Math.abs(ny + ph + g - other.y) < SNAP)             { ny = other.y - ph - g; snapYs.push(other.y); break gapY; }
            }
          }
        }

        setSnapLines({ xs: snapXs, ys: snapYs });
        setPhotos(p => p.map(p2 => p2.id === d.id ? { ...p2, x: nx, y: ny } : p2));

      } else if (d.type === "photo-resize") {
        const prev = photosRef.current;
        const cv   = CANVAS[canvasTypeRef.current];
        const dx   = (clientX - d.mx) / s;
        const dy   = (clientY - d.my) / s;
        const h    = d.handle;

        // Compute new W, H, X, Y based on handle
        // Corners: maintain aspect ratio (W drives, H = W × ratio)
        // Edges: free resize in one direction only
        const ratio = d.oh / d.ow;
        let newW = d.ow, newH = d.oh, newX = d.ox, newY = d.oy;
        if (h === "br") { newW = d.ow + dx; newH = Math.round(newW * ratio); }
        else if (h === "bl") { newW = d.ow - dx; newH = Math.round(newW * ratio); newX = d.ox + d.ow - newW; }
        else if (h === "tr") { newW = d.ow + dx; newH = Math.round(newW * ratio); newY = d.oy + d.oh - newH; }
        else if (h === "tl") { newW = d.ow - dx; newH = Math.round(newW * ratio); newX = d.ox + d.ow - newW; newY = d.oy + d.oh - newH; }
        else if (h === "r")  { newW = d.ow + dx; }
        else if (h === "l")  { newW = d.ow - dx; newX = d.ox + dx; }
        else if (h === "b")  { newH = d.oh + dy; }
        else if (h === "t")  { newH = d.oh - dy; newY = d.oy + dy; }

        // Clamp minimums
        if (newW < 40) {
          newW = 40;
          if (h === "bl" || h === "tl" || h === "l") newX = d.ox + d.ow - 40;
          if (h === "bl" || h === "tl" || h === "br" || h === "tr") newH = Math.round(40 * ratio);
          if (h === "tr" || h === "tl") newY = d.oy + d.oh - newH;
        }
        if (newH < 40) { newH = 40; if (h === "tr" || h === "tl" || h === "t") newY = d.oy + d.oh - 40; }

        const snapXs: number[] = [];
        const snapYs: number[] = [];
        const others = prev.filter(p => p.id !== d.id);
        const m = (cv.w > cv.h ? cv.w / 297 : cv.w / 210) * 2;
        const CROP_SNAP = RESIZE_SNAP * 4;

        // X snapping (right or left edge)
        const movesRight = h === "br" || h === "tr" || h === "r";
        const movesLeft  = h === "bl" || h === "tl" || h === "l";
        if (movesRight) {
          const re = newX + newW;
          if      (Math.abs(re - (cv.w - m)) < CROP_SNAP) { newW = cv.w - m - newX; snapXs.push(cv.w - m); }
          else if (Math.abs(re - cv.w) < RESIZE_SNAP)      { newW = cv.w - newX; snapXs.push(cv.w); }
          else for (const o of others) {
            if (Math.abs(re - o.x) < RESIZE_SNAP)          { newW = o.x - newX; snapXs.push(o.x); break; }
            if (Math.abs(re - (o.x + o.w)) < RESIZE_SNAP)  { newW = o.x + o.w - newX; snapXs.push(o.x + o.w); break; }
          }
        } else if (movesLeft) {
          const snapX = (t: number) => { newX = t; newW = d.ox + d.ow - t; snapXs.push(t); };
          if      (Math.abs(newX - m) < CROP_SNAP)   snapX(m);
          else if (Math.abs(newX) < RESIZE_SNAP)      snapX(0);
          else for (const o of others) {
            if (Math.abs(newX - o.x) < RESIZE_SNAP)          { snapX(o.x); break; }
            if (Math.abs(newX - (o.x + o.w)) < RESIZE_SNAP)  { snapX(o.x + o.w); break; }
          }
        }

        // Y snapping (bottom or top edge)
        const movesBottom = h === "br" || h === "bl" || h === "b";
        const movesTop    = h === "tr" || h === "tl" || h === "t";
        if (movesBottom) {
          const be = newY + newH;
          if      (Math.abs(be - (cv.h - m)) < CROP_SNAP) { newH = cv.h - m - newY; snapYs.push(cv.h - m); }
          else if (Math.abs(be - cv.h) < RESIZE_SNAP)      { newH = cv.h - newY; snapYs.push(cv.h); }
          else for (const o of others) {
            if (Math.abs(be - o.y) < RESIZE_SNAP)          { newH = o.y - newY; snapYs.push(o.y); break; }
            if (Math.abs(be - (o.y + o.h)) < RESIZE_SNAP)  { newH = o.y + o.h - newY; snapYs.push(o.y + o.h); break; }
          }
        } else if (movesTop) {
          const snapY = (t: number) => { newY = t; newH = d.oy + d.oh - t; snapYs.push(t); };
          if      (Math.abs(newY - m) < CROP_SNAP)   snapY(m);
          else if (Math.abs(newY) < RESIZE_SNAP)      snapY(0);
          else for (const o of others) {
            if (Math.abs(newY - o.y) < RESIZE_SNAP)          { snapY(o.y); break; }
            if (Math.abs(newY - (o.y + o.h)) < RESIZE_SNAP)  { snapY(o.y + o.h); break; }
          }
        }

        onPhotoResize(newW);
        setSnapLines({ xs: snapXs, ys: snapYs });
        setPhotos(p => p.map(p2 => p2.id === d.id ? { ...p2, w: newW, h: newH, x: newX, y: newY } : p2));

      } else if (d.type === "text-move") {
        const cv   = CANVAS[canvasTypeRef.current];
        const prev = photosRef.current;
        let nx = d.ox + (clientX - d.mx) / s;
        let ny = d.oy + (clientY - d.my) / s;
        const snapXs: number[] = [];
        const snapYs: number[] = [];
        const tSize = textSizesRef.current[d.id] ?? { w: 0, h: 0 };
        const tw = tSize.w;
        const th = tSize.h;

        // outlineOffset in TextElement is 4px — snap uses the outline box edges, not content edges
        const PAD = 4;

        // X snap targets: canvas edges + photo edges + other text block edges
        const xTargets = [0, cv.w, cv.w / 2];
        for (const p of prev) { xTargets.push(p.x, p.x + p.w); }
        for (const b of textBlocksRef.current) {
          if (b.id === d.id) continue;
          const bs = textSizesRef.current[b.id];
          if (bs) { xTargets.push(b.x - PAD, b.x + bs.w + PAD); }
          xTargets.push(b.x);
        }
        for (const tx of xTargets) {
          if (Math.abs(nx - PAD - tx) < SNAP) { nx = tx + PAD; snapXs.push(tx); break; }
          if (tw > 0 && Math.abs(nx + tw + PAD - tx) < SNAP) { nx = tx - tw - PAD; snapXs.push(tx); break; }
        }

        // Y snap targets: canvas edges + photo edges + other text block edges
        const yTargets = [0, cv.h, cv.h / 2];
        for (const p of prev) { yTargets.push(p.y, p.y + p.h); }
        for (const b of textBlocksRef.current) {
          if (b.id === d.id) continue;
          const bs = textSizesRef.current[b.id];
          if (bs) { yTargets.push(b.y - PAD, b.y + bs.h + PAD); }
          yTargets.push(b.y);
        }
        for (const ty of yTargets) {
          if (Math.abs(ny - PAD - ty) < SNAP) { ny = ty + PAD; snapYs.push(ty); break; }
          if (th > 0 && Math.abs(ny + th + PAD - ty) < SNAP) { ny = ty - th - PAD; snapYs.push(ty); break; }
        }

        setSnapLines({ xs: snapXs, ys: snapYs });
        setTextBlocks(p => p.map(b => b.id === d.id ? { ...b, x: nx, y: ny } : b));
      }
    };

    const onUp = () => {
      const d = dragRef.current;
      if (d && movedRef.current) tallyEdit(d.type === "photo-resize" ? "photo_resize" : d.type === "photo-move" ? "photo_move" : "text_move");
      movedRef.current = false;
      dragRef.current = null; setSnapLines({ xs: [], ys: [] });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []); // intentionally empty — all mutable state accessed via refs

  /* Canvas-level mousedown/touchstart: detect resize corner vs photo body */
  const handleCanvasPointerDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const { clientX, clientY } = getClientPos(e);
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const effectiveScale = scale * (userZoomRef.current ?? 1);
    const cx = (clientX - rect.left) / effectiveScale;
    const cy = (clientY - rect.top) / effectiveScale;

    // Resize handles of selected photo (corners + edges)
    if (selectedId !== null) {
      const sel = photos.find(p => p.id === selectedId);
      if (sel) {
        for (const { handle, x: hx, y: hy } of getHandles(sel)) {
          if (Math.abs(cx - hx) <= RESIZE_ZONE && Math.abs(cy - hy) <= RESIZE_ZONE) {
            dragRef.current = { type: "photo-resize", id: selectedId, mx: clientX, my: clientY, ow: sel.w, oh: sel.h, ox: sel.x, oy: sel.y, handle };
            return;
          }
        }
      }
    }
    // Hit-test photos (reverse = topmost first)
    for (let i = photos.length - 1; i >= 0; i--) {
      const p = photos[i];
      const ph = p.h;
      if (cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + ph) {
        setSelectedId(p.id);
        dragRef.current = { type: "photo-move", id: p.id, mx: clientX, my: clientY, ox: p.x, oy: p.y };
        return;
      }
    }
    setSelectedId(null);
  };

  /* Field lookups */
  const nameField     = selectedFields.find(d => d.label === "English Name");
  const korNameField  = selectedFields.find(d => d.label === "Korean Name");
  const statsFields   = selectedFields.filter(d => isStatsField(d.label));
  const contactFields = selectedFields.filter(d => isContactField(d.label));
  const nameBlock     = textBlocks.find(b => b.tag === "name");
  const korNameBlock  = textBlocks.find(b => b.tag === "korName");
  const statsBlock    = textBlocks.find(b => b.tag === "stats");
  const contactBlock  = textBlocks.find(b => b.tag === "contact");

  return (
    <div style={{ width: w * scale, height: h * scale, flexShrink: 0, position: "relative" }}>
    <div
      ref={canvasRef}
      onMouseDown={handleCanvasPointerDown}
      onTouchStart={(e) => { handleCanvasPointerDown(e); }}
      style={{ position: "absolute", top: 0, left: 0, width: w, height: h, background: bgColor, flexShrink: 0, boxShadow: "0 4px 32px rgba(0,0,0,0.14)", overflow: "visible", transformOrigin: "top left", transform: `scale(${scale})` }}
    >
      {/* Photos */}
      {photos.map((item, idx) => (
        <PhotoElement key={item.id} item={item} isSelected={selectedId === item.id} isMain={idx === 0} isDark={bgColor === "#0C0C0C"} />
      ))}

      {/* 안전 영역 가이드 — 저장/출력 시 제외되는 표시용 선 */}
      {(() => {
        const mm2px = (w > h ? w / 297 : w / 210) * 2; // 2mm in canvas px
        return (
          <div className="crop-guide" style={{
            position: "absolute",
            top: mm2px,
            left: mm2px,
            width: w - mm2px * 2,
            height: h - mm2px * 2,
            border: `0.5px dotted ${bgColor === "#0C0C0C" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)"}`,
            pointerEvents: "none",
            zIndex: 100,
            boxSizing: "border-box",
          }} />
        );
      })()}

      {/* Snap guide lines */}
      {snapLines.xs.map((x, i) => (
        <div key={`sx${i}`} style={{ position: "absolute", left: x - 0.5, top: 0, width: 1, height: h, background: "#0066FF", opacity: 0.7, zIndex: 50, pointerEvents: "none" }} />
      ))}
      {snapLines.ys.map((y, i) => (
        <div key={`sy${i}`} style={{ position: "absolute", left: 0, top: y - 0.5, width: w, height: 1, background: "#0066FF", opacity: 0.7, zIndex: 50, pointerEvents: "none" }} />
      ))}

      {/* Text: English Name */}
      {nameField && nameBlock && (
        <TextElement block={nameBlock} onSize={handleTextSize} onMoveStart={(pos) => { dragRef.current = { type: "text-move", id: "name", mx: pos.clientX, my: pos.clientY, ox: nameBlock.x, oy: nameBlock.y }; }}>
          <span className="font-display" style={{ fontSize: nameBlock.fontSize, fontWeight, color: txtColor, display: "block", lineHeight: 1.1, whiteSpace: "nowrap", textTransform: nameCaps ? "uppercase" : "none", letterSpacing: nameCaps ? "0.04em" : undefined }}>{nameField.value}</span>
        </TextElement>
      )}

      {/* Text: Korean Name */}
      {korNameField && korNameBlock && (
        <TextElement block={korNameBlock} onSize={handleTextSize} onMoveStart={(pos) => { dragRef.current = { type: "text-move", id: "korName", mx: pos.clientX, my: pos.clientY, ox: korNameBlock.x, oy: korNameBlock.y }; }}>
          <span style={{ fontSize: korNameBlock.fontSize, fontWeight, color: txtColor, display: "block", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{korNameField.value}</span>
        </TextElement>
      )}

      {/* Text: Stats */}
      {statsFields.length > 0 && statsBlock && (
        <TextElement block={statsBlock} onSize={handleTextSize} onMoveStart={(pos) => { dragRef.current = { type: "text-move", id: "stats", mx: pos.clientX, my: pos.clientY, ox: statsBlock.x, oy: statsBlock.y }; }}>
          {statsLayout === "1단" ? (
            <div style={{ display: "flex", gap: "12px", flexWrap: "nowrap" }}>
              {statsFields.map((d, i) => (
                <span key={i} style={{ display: "inline-flex", flexDirection: "column", gap: "1px" }}>
                  <span style={{ fontSize: Math.max(6, statsBlock.fontSize - 4), letterSpacing: "0.12em", textTransform: "uppercase", color: txtColor, fontWeight, whiteSpace: "nowrap" }}>{d.label}</span>
                  <span style={{ fontSize: statsBlock.fontSize, color: txtColor, fontWeight, whiteSpace: "nowrap" }}>{d.value}</span>
                </span>
              ))}
            </div>
          ) : (
            (() => {
              const half = Math.ceil(statsFields.length / 2);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[statsFields.slice(0, half), statsFields.slice(half)].map((row, ri) => (
                    <div key={ri} style={{ display: "flex", gap: "12px" }}>
                      {row.map((d, i) => (
                        <span key={i} style={{ display: "inline-flex", flexDirection: "column", gap: "1px" }}>
                          <span style={{ fontSize: Math.max(6, statsBlock.fontSize - 4), letterSpacing: "0.12em", textTransform: "uppercase", color: txtColor, fontWeight, whiteSpace: "nowrap" }}>{d.label}</span>
                          <span style={{ fontSize: statsBlock.fontSize, color: txtColor, fontWeight, whiteSpace: "nowrap" }}>{d.value}</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </TextElement>
      )}

      {/* Text: Contact */}
      {contactFields.length > 0 && contactBlock && (
        <TextElement block={contactBlock} onSize={handleTextSize} onMoveStart={(pos) => { dragRef.current = { type: "text-move", id: "contact", mx: pos.clientX, my: pos.clientY, ox: contactBlock.x, oy: contactBlock.y }; }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {contactFields.map((d, i) => {
              const lbl = d.label === "Instagram" ? "Instagram" : d.label === "Email" ? "E-mail" : "Tel";
              return (
                <span key={i} style={{ fontSize: contactBlock.fontSize, color: txtColor, fontWeight, whiteSpace: "nowrap" }}>
                  <span style={{ marginRight: "6px", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: Math.max(6, contactBlock.fontSize - 2) }}>{lbl}</span>
                  {d.value}
                </span>
              );
            })}
          </div>
        </TextElement>
      )}
    </div>
    </div>
  );
}

/* ─────────────── photo upload panel ────────────────────────── */
/** 사진 한 장 올리기: 미리보기는 바로 보여주고, 실제 파일은 Storage에 올려 영구 주소로 교체 */
async function uploadPhotoFile(
  id: number, file: File, userId: string | null,
  setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>,
  setUploading: React.Dispatch<React.SetStateAction<number>>,
) {
  const preview = URL.createObjectURL(file);
  setPhotos(prev => prev.map(p => p.id === id ? { ...p, src: preview } : p));
  if (!userId) return;
  setUploading(n => n + 1);
  const ext  = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/comcard/${Date.now()}-${id}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("snaps").upload(path, file);
  setUploading(n => n - 1);
  if (error) {
    alert(`사진 업로드 실패: ${error.message}\n저장해도 이 사진은 남지 않아요. 다시 올려주세요.`);
    return;
  }
  const { data: { publicUrl } } = supabase.storage.from("snaps").getPublicUrl(path);
  setPhotos(prev => prev.map(p => p.src === preview ? { ...p, src: publicUrl } : p));
  track("photo_uploaded", {});
  tallyEdit("photo_replace"); // 편집기 밖(사진 단계)에서는 세지 않음
  URL.revokeObjectURL(preview);
}

function PhotoPanel({ photos, setPhotos, onAdd, onRemove, userId, setUploading }: {
  photos: PhotoItem[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
  onAdd: () => void;
  onRemove: (id: number) => void;
  userId: string | null;
  setUploading: React.Dispatch<React.SetStateAction<number>>;
}) {
  const handleFile = (id: number, file: File) => uploadPhotoFile(id, file, userId, setPhotos, setUploading);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <p style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
          Photos <span style={{ color: "var(--text)" }}>{photos.length}</span>
        </p>
        {photos.length < 10 && (
          <button onClick={onAdd} style={{ fontSize: "10px", letterSpacing: "0.08em", border: "1px solid var(--border)", background: "#fff", color: "var(--text)", padding: "4px 10px", cursor: "pointer" }}>
            + Add
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
        {photos.map((item, idx) => (
          <div key={item.id} style={{ position: "relative" }}>
            <label style={{ display: "block", aspectRatio: "2/3", cursor: "pointer", background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden", position: "relative" }}>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files?.[0] && handleFile(item.id, e.target.files[0])} />
              {item.src
                ? <img src={item.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                : <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <span style={{ fontSize: "18px", color: "var(--border)" }}>+</span>
                    <span style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>{idx === 0 ? "Main" : `${idx + 1}`}</span>
                  </div>
              }
              {idx === 0 && <span style={{ position: "absolute", top: 5, left: 5, fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--text)", color: "#fff", padding: "2px 6px" }}>Main</span>}
            </label>
            {photos.length > 1 && (
              <button onClick={() => onRemove(item.id)} style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", cursor: "pointer", fontSize: "11px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>×</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────── custom color picker ───────────────────── */
function hsvToHex(h: number, s: number, v: number): string {
  s /= 100; v /= 100;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  const hex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
function hexToHsv(hex: string): [number, number, number] {
  if (!hex || hex.length < 7) return [0, 0, 100];
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d % 6) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : (d / max) * 100, max * 100];
}

function ColorPickerPopup({ value, onChange, onClose, anchorRect }: { value: string; onChange: (c: string) => void; onClose: () => void; anchorRect?: DOMRect }) {
  const R = 80; // 색상환 반지름
  const [hue, setHue] = useState(() => hexToHsv(value)[0]);
  const [sat, setSat] = useState(() => hexToHsv(value)[1]);
  const [val, setVal] = useState(() => hexToHsv(value)[2]);
  const [hex, setHex] = useState(value);
  const wheelRef = useRef<HTMLDivElement>(null);

  const emit = (h: number, s: number, v: number) => {
    const c = hsvToHex(h, s, v); setHex(c); onChange(c);
  };

  const updateWheel = (clientX: number, clientY: number) => {
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = clientX - rect.left - R;
    const dy = clientY - rect.top - R;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nh = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360;
    const ns = Math.min(100, (dist / R) * 100);
    setHue(nh); setSat(ns); emit(nh, ns, val);
  };

  // 도트 위치 (색상환 위)
  const hRad = (hue * Math.PI) / 180;
  const dotDist = (sat / 100) * R;
  const dotX = R + dotDist * Math.sin(hRad);
  const dotY = R - dotDist * Math.cos(hRad);

  // 밝기 슬라이더 배경
  const pureColor = hsvToHex(hue, sat, 100);

  const popupW = 234;
  const fixedLeft = typeof window !== "undefined" ? Math.round((window.innerWidth - popupW) / 2) : 100;
  const fixedTop  = anchorRect ? Math.min(anchorRect.bottom + 8, window.innerHeight - 430) : 100;

  const popup = (
    <div
      style={{ position: "fixed", zIndex: 9999, background: "#fff", border: "1px solid var(--border)", padding: "14px", width: `${popupW}px`, boxShadow: "0 6px 24px rgba(0,0,0,0.18)", left: fixedLeft, top: fixedTop }}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      {/* 색상환 */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
        <div
          ref={wheelRef}
          style={{
            width: R * 2, height: R * 2, borderRadius: "50%", position: "relative",
            cursor: "crosshair", touchAction: "none", flexShrink: 0,
            background: `
              radial-gradient(circle, white 0%, rgba(255,255,255,0) 70%),
              conic-gradient(
                hsl(0,100%,50%) 0deg, hsl(30,100%,50%) 30deg, hsl(60,100%,50%) 60deg,
                hsl(90,100%,50%) 90deg, hsl(120,100%,50%) 120deg, hsl(150,100%,50%) 150deg,
                hsl(180,100%,50%) 180deg, hsl(210,100%,50%) 210deg, hsl(240,100%,50%) 240deg,
                hsl(270,100%,50%) 270deg, hsl(300,100%,50%) 300deg, hsl(330,100%,50%) 330deg,
                hsl(360,100%,50%) 360deg
              )`,
          }}
          onMouseDown={e => { e.preventDefault(); updateWheel(e.clientX, e.clientY); }}
          onMouseMove={e => { if (e.buttons === 1) updateWheel(e.clientX, e.clientY); }}
          onTouchStart={e => { e.preventDefault(); e.stopPropagation(); updateWheel(e.touches[0].clientX, e.touches[0].clientY); }}
          onTouchMove={e => { e.preventDefault(); e.stopPropagation(); updateWheel(e.touches[0].clientX, e.touches[0].clientY); }}
        >
          <div style={{
            position: "absolute", left: dotX, top: dotY,
            width: 14, height: 14, borderRadius: "50%",
            border: "2px solid #fff", background: hsvToHex(hue, sat, val),
            transform: "translate(-50%,-50%)", pointerEvents: "none",
            boxShadow: "0 0 3px rgba(0,0,0,0.5)",
          }} />
        </div>
      </div>
      {/* 밝기 슬라이더 */}
      <input type="range" min="0" max="100" value={Math.round(val)}
        style={{ width: "100%", marginBottom: "10px", height: "12px", borderRadius: "6px", cursor: "pointer",
          background: `linear-gradient(to right, #000, ${pureColor})`,
          appearance: "none" as const, outline: "none" }}
        onChange={e => { const nv = +e.target.value; setVal(nv); emit(hue, sat, nv); }}
        onTouchStart={e => e.stopPropagation()}
      />
      {/* 미리보기 + hex */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{ width: 28, height: 28, background: value, border: "1px solid var(--border)", flexShrink: 0 }} />
        <input type="text" value={hex}
          onChange={e => { setHex(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) { const [nh,ns,nv] = hexToHsv(e.target.value); setHue(nh); setSat(ns); setVal(nv); onChange(e.target.value); } }}
          style={{ flex: 1, fontSize: "11px", padding: "4px 6px", border: "1px solid var(--border)", fontFamily: "monospace", minWidth: 0 }} />
        <button onClick={onClose} style={{ fontSize: "12px", border: "1px solid var(--border)", background: "#fff", padding: "3px 8px", cursor: "pointer", flexShrink: 0 }}>✕</button>
      </div>
    </div>
  );
  return createPortal(popup, document.body);
}

function ColorRow({ label, presets, current, onChange, isCustom }: { label: string; presets: {v:string;l:string}[]; current: string; onChange: (c:string)=>void; isCustom: boolean }) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | undefined>();
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    if (btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect());
    setOpen(o => !o);
  };

  return (
    <div>
      <p style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "8px" }}>{label}</p>
      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
        {presets.map(opt => (
          <button key={opt.v} onClick={() => { onChange(opt.v); setOpen(false); }} title={opt.l}
            style={{ width: "28px", height: "28px", background: opt.v, border: current === opt.v ? "2px solid var(--text)" : "1px solid var(--border)", cursor: "pointer", flexShrink: 0 }} />
        ))}
        <div>
          <button ref={btnRef} onClick={handleOpen} title="Custom"
            style={{ width: "28px", height: "28px", border: isCustom ? "2px solid var(--text)" : "1px solid var(--border)", background: isCustom ? current : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, flexShrink: 0 }}>
            {!isCustom && <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)", pointerEvents: "none" }} />}
          </button>
          {open && <ColorPickerPopup value={isCustom ? current : "#ff0000"} onChange={onChange} onClose={() => setOpen(false)} anchorRect={anchorRect} />}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── 구성 패널: 프리셋 / AI 추천 / 직접 설정 ───────── */
const HEX = /^#[0-9a-fA-F]{6}$/;

/** 프리셋·AI 추천을 캔버스에 적용할 때 쓰는 공통 형식 */
export type LayoutChoice = {
  template: LayoutTemplate;
  photoOrder?: number[];   // photoIds 기준 순서 (첫 번째가 메인)
  photoIds?: number[];     // AI가 본 사진 id 순서
  bgColor: string; txtColor: string; fontWeight: number;
  statsLayout: "1단" | "2단"; nameSize: number; nameCaps: boolean;
};

const presetChoice = (p: Preset): LayoutChoice => ({ template: p.id, ...p.style });

/** 프리셋 미리보기 썸네일 (현재 사진 수·방향 기준) */
function PresetThumb({ preset, canvas, count }: { preset: Preset; canvas: CanvasType; count: number }) {
  const { w, h } = CANVAS[canvas];
  const s = 68 / Math.max(w, h);
  const { photos, textBlocks } = buildLayout(canvas, preset.id, count, preset.style.nameSize, 12);
  return (
    <div style={{ position: "relative", width: w * s, height: h * s, background: preset.style.bgColor, border: "1px solid var(--border)", flexShrink: 0, overflow: "hidden" }}>
      {photos.map((p, i) => (
        <div key={i} style={{ position: "absolute", left: p.x * s, top: p.y * s, width: p.w * s, height: p.h * s, background: i === 0 ? "#8a7b6b" : "#c9bfb3", outline: `0.5px solid ${preset.style.bgColor}` }} />
      ))}
      {textBlocks.filter(b => b.tag === "name").map(b => (
        <div key={b.id} style={{ position: "absolute", left: b.x * s, top: b.y * s, width: 70 * s * (b.fontSize / 20), height: Math.max(2, b.fontSize * s * 0.7), background: preset.style.txtColor, opacity: 0.85, zIndex: 2 }} />
      ))}
    </div>
  );
}

function LayoutPanel({ canvas, photos, selectedFields, onApply, onUndo, canUndo, onReset }: {
  canvas: CanvasType;
  photos: PhotoItem[];
  selectedFields: { label: string; value: string }[];
  onApply: (c: LayoutChoice) => void;
  onUndo: () => void;
  canUndo: boolean;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<"preset" | "ai" | "manual">("preset");
  const [applied, setApplied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ComcardSuggestion[]>([]);
  const [askedIds, setAskedIds] = useState<number[]>([]); // AI가 본 사진 순서 (사진 번호 = 이 배열의 위치)

  const ask = async () => {
    track("ai_suggest_requested", { where: "editor", canvas, count: photos.length });
    setLoading(true); setError(null); setApplied(null);
    setAskedIds(photos.map(p => p.id));
    try {
      const res = await fetch("/api/comcard/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvas,
          // 아직 업로드 중인 임시 사진은 AI가 볼 수 없으므로 빈 칸으로 보냄
          photos: photos.map(p => (p.src && !p.src.startsWith("blob:") ? p.src : null)),
          name: selectedFields.find(f => f.label === "English Name")?.value,
          fieldLabels: selectedFields.map(f => f.label),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "추천을 받지 못했어요.");
      setSuggestions(json.suggestions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "추천을 받지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  const hasPhotos = photos.some(p => p.src && !p.src.startsWith("blob:"));
  const tabBtn = (id: typeof tab, label: string, i: number) => (
    <button key={id} onClick={() => setTab(id)} style={{
      flex: 1, padding: "7px 0", fontSize: "10px", letterSpacing: "0.04em", cursor: "pointer",
      border: "1px solid var(--border)", borderLeft: i === 0 ? "1px solid var(--border)" : "none",
      background: tab === id ? "var(--text)" : "#fff", color: tab === id ? "#fff" : "var(--muted)",
    }}>{label}</button>
  );
  const smallBtn = (active: boolean): React.CSSProperties => ({
    width: "100%", padding: "6px", fontSize: "10px", letterSpacing: "0.08em", cursor: "pointer",
    border: "1px solid var(--border)", background: active ? "var(--text)" : "#fff", color: active ? "#fff" : "var(--text)",
  });

  return (
    <div style={{ marginBottom: "22px", paddingBottom: "20px", borderBottom: "1px solid var(--border)" }}>
      <p style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "8px" }}>구성</p>
      <div style={{ display: "flex", marginBottom: "12px" }}>
        {tabBtn("preset", "프리셋", 0)}
        {tabBtn("ai", "AI 추천", 1)}
        {tabBtn("manual", "직접 설정", 2)}
      </div>

      {/* 프리셋 직접 고르기 */}
      {tab === "preset" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <p style={{ fontSize: "10px", color: "var(--muted)", lineHeight: 1.6, marginBottom: "2px" }}>업계 표준 컴카드 양식이에요. 누르면 바로 적용돼요.</p>
          {presetOptions(canvas, Math.max(1, photos.length)).map(({ preset: p, fits }) => {
            const active = applied === `preset:${p.id}`;
            return (
              <button key={p.id} onClick={() => { onApply(presetChoice(p)); setApplied(`preset:${p.id}`); tallyEdit("preset_apply"); track("layout_applied", { source: "preset", template: p.id, canvas, count: photos.length }); }} title={p.basis}
                style={{ display: "flex", gap: "8px", alignItems: "center", textAlign: "left", padding: "6px", cursor: "pointer", background: "#fff", border: `1px solid ${active ? "var(--text)" : "var(--border)"}` }}>
                <PresetThumb preset={p} canvas={canvas} count={Math.max(1, photos.length)} />
                <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                  <span style={{ fontSize: "11px", color: "var(--text)", fontWeight: 500 }}>{p.name}{active && " ✓"}</span>
                  <span style={{ fontSize: "9px", color: "var(--muted)", lineHeight: 1.4 }}>{p.description}</span>
                  {!fits && <span style={{ fontSize: "9px", color: "#b07a2a" }}>사진 {photos.length}장이면 칸이 작아져요</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* AI 추천 */}
      {tab === "ai" && (
        <div>
          <button onClick={ask} disabled={loading} style={{
            width: "100%", padding: "11px", fontSize: "11px", letterSpacing: "0.08em",
            background: "var(--text)", color: "#fff", border: "none", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "AI가 구성하는 중..." : suggestions.length ? "↻ 다시 추천받기" : "✨ AI에게 추천받기"}
          </button>
          <p style={{ fontSize: "10px", color: "var(--muted)", marginTop: "6px", lineHeight: 1.6 }}>
            {hasPhotos ? "사진을 보고 프리셋 중 어울리는 양식과 메인 사진·색을 골라줘요." : "사진을 먼저 올리면 사진을 보고 메인 사진과 색까지 골라줘요."}
          </p>
          {error && <p style={{ fontSize: "11px", color: "#c00", marginTop: "8px", lineHeight: 1.5 }}>{error}</p>}
          {suggestions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
              {suggestions.map((sg, i) => {
                const active = applied === `ai:${i}`;
                const preset = PRESET_BY_ID[sg.template];
                return (
                  <div key={i} style={{ border: `1px solid ${active ? "var(--text)" : "var(--border)"}`, padding: "10px", background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <span style={{ width: 14, height: 14, background: HEX.test(sg.bgColor) ? sg.bgColor : "#fff", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: HEX.test(sg.txtColor) ? sg.txtColor : "#000", flexShrink: 0 }}>A</span>
                      <span style={{ fontSize: "12px", color: "var(--text)", fontWeight: 500 }}>{sg.title}</span>
                    </div>
                    <p style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "4px" }}>양식: {preset?.name ?? sg.template}</p>
                    <p style={{ fontSize: "10px", color: "var(--muted)", lineHeight: 1.5, marginBottom: "8px" }}>{sg.reason}</p>
                    <button onClick={() => {
                      onApply({
                        template: sg.template, photoOrder: sg.photoOrder, photoIds: askedIds,
                        bgColor: sg.bgColor, txtColor: sg.txtColor, fontWeight: Number(sg.fontWeight),
                        statsLayout: sg.statsLayout, nameSize: sg.nameSize, nameCaps: sg.nameCaps,
                      });
                      setApplied(`ai:${i}`);
                      tallyEdit("ai_apply"); track("layout_applied", { source: "ai", template: sg.template, canvas, count: photos.length });
                    }} style={smallBtn(active)}>{active ? "적용됨 ✓" : "적용"}</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 직접 설정 */}
      {tab === "manual" && (
        <div>
          <p style={{ fontSize: "10px", color: "var(--muted)", lineHeight: 1.7, marginBottom: "10px" }}>
            아래 설정으로 색·글꼴·사진·글자 크기를 직접 정하고, 캔버스에서 사진과 글자를 드래그해 자유롭게 배치하세요.
          </p>
          <button onClick={() => { onReset(); setApplied(null); }} style={smallBtn(false)}>기본 배치로 시작</button>
        </div>
      )}

      {canUndo && (
        <button onClick={() => { onUndo(); setApplied(null); }} style={{ marginTop: "8px", fontSize: "10px", border: "none", background: "none", color: "var(--muted)", textDecoration: "underline", cursor: "pointer", padding: "4px 0" }}>
          적용 전으로 되돌리기
        </button>
      )}
    </div>
  );
}

/* ─────────────────── controls panel ────────────────────────── */
const BG_PRESETS  = [{ v: "#FFFFFF", l: "White" }, { v: "#F8F7F4", l: "Warm" }, { v: "#F3F0EA", l: "Cream" }, { v: "#0C0C0C", l: "Black" }];
const TXT_PRESETS = [{ v: "#0A0A0A", l: "Black" }, { v: "#FFFFFF", l: "White" }, { v: "#888888", l: "Gray" }];
const WEIGHT_OPTS: { label: string; value: number }[] = [
  { label: "Light",   value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium",  value: 500 },
  { label: "Bold",    value: 700 },
];

function ControlsPanel({ canvas, bgColor, setBgColor, txtColor, setTxtColor, fontWeight, setFontWeight, nameCaps, setNameCaps, photos, setPhotos, onAddPhoto, onRemovePhoto, textBlocks, setTextBlocks, statsLayout, setStatsLayout, userId, setUploading }: {
  canvas: CanvasType;
  bgColor: string;  setBgColor:  (c: string) => void;
  txtColor: string; setTxtColor: (c: string) => void;
  fontWeight: number; setFontWeight: (w: number) => void;
  nameCaps: boolean; setNameCaps: (v: boolean) => void;
  photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
  onAddPhoto: () => void; onRemovePhoto: (id: number) => void;
  textBlocks: TextBlock[]; setTextBlocks: React.Dispatch<React.SetStateAction<TextBlock[]>>;
  statsLayout: "1단" | "2단"; setStatsLayout: (v: "1단" | "2단") => void;
  userId: string | null; setUploading: React.Dispatch<React.SetStateAction<number>>;
}) {
  const isBgCustom  = !BG_PRESETS.some(o => o.v === bgColor);
  const isTxtCustom = !TXT_PRESETS.some(o => o.v === txtColor);

  const updateTextSize = (tag: string, delta: number) =>
    { tallyEdit("text_size"); setTextBlocks(prev => prev.map(b => b.tag === tag ? { ...b, fontSize: Math.max(8, Math.min(60, b.fontSize + delta)) } : b)); };

  const textItems: { tag: TextBlock["tag"]; label: string }[] = [
    { tag: "name",    label: "Eng Name" },
    { tag: "korName", label: "Kor Name" },
    { tag: "stats",   label: "Stats" },
    { tag: "contact", label: "Contact" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>

      <ColorRow label="Background" presets={BG_PRESETS}  current={bgColor}  onChange={setBgColor}  isCustom={isBgCustom} />
      <ColorRow label="Text Color" presets={TXT_PRESETS} current={txtColor} onChange={setTxtColor} isCustom={isTxtCustom} />

      {/* Font weight */}
      <div>
        <p style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "8px" }}>Font Weight</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
          {WEIGHT_OPTS.map((opt, i) => {
            const isRight = i % 2 === 1;
            const isBottom = i >= 2;
            return (
              <button key={opt.value} onClick={() => setFontWeight(opt.value)} style={{
                padding: "7px 0", fontSize: "10px", letterSpacing: "0.06em",
                border: "1px solid var(--border)",
                borderRight:  isRight  ? "1px solid var(--border)" : "none",
                borderBottom: isBottom ? "1px solid var(--border)" : "none",
                background: fontWeight === opt.value ? "var(--text)" : "#fff",
                color:      fontWeight === opt.value ? "#fff" : "var(--muted)",
                cursor: "pointer", fontWeight: opt.value,
              }}>{opt.label}</button>
            );
          })}
        </div>
      </div>

      {/* Name caps */}
      <div>
        <p style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "8px" }}>Name Style</p>
        <div style={{ display: "flex" }}>
          {([["Aa", false], ["AA", true]] as const).map(([label, v], i) => (
            <button key={label} onClick={() => setNameCaps(v)} style={{ flex: 1, padding: "7px 0", fontSize: "11px", border: "1px solid var(--border)", borderRight: i === 0 ? "none" : "1px solid var(--border)", background: nameCaps === v ? "var(--text)" : "#fff", color: nameCaps === v ? "#fff" : "var(--muted)", cursor: "pointer" }}>{label}</button>
          ))}
        </div>
        <p style={{ fontSize: "10px", color: "var(--muted)", marginTop: "6px" }}>{nameCaps ? "이름 대문자 (에이전시 관행)" : "이름 그대로"}</p>
      </div>

      <PhotoPanel photos={photos} setPhotos={setPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} userId={userId} setUploading={setUploading} />

      {/* Text sizes */}
      <div>
        <p style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "10px" }}>Text Size</p>
        {textItems.map(({ tag, label }) => {
          const block = textBlocks.find(b => b.tag === tag);
          if (!block) return null;
          return (
            <div key={tag} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>{label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button onClick={() => updateTextSize(tag, -1)} style={{ width: "24px", height: "24px", border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontSize: "14px", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontSize: "11px", color: "var(--text)", minWidth: "20px", textAlign: "center" }}>{block.fontSize}</span>
                <button onClick={() => updateTextSize(tag, 1)} style={{ width: "24px", height: "24px", border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontSize: "14px", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats layout */}
      <div>
        <p style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "8px" }}>Stats Layout</p>
        <div style={{ display: "flex" }}>
          {(["1단","2단"] as const).map((v, i) => (
            <button key={v} onClick={() => setStatsLayout(v)} style={{ flex: 1, padding: "7px 0", fontSize: "11px", border: "1px solid var(--border)", borderRight: i === 0 ? "none" : "1px solid var(--border)", background: statsLayout === v ? "var(--text)" : "#fff", color: statsLayout === v ? "#fff" : "var(--muted)", cursor: "pointer" }}>{v}</button>
          ))}
        </div>
        <p style={{ fontSize: "10px", color: "var(--muted)", marginTop: "6px" }}>{statsLayout === "1단" ? "한 줄 표기" : "두 줄 표기"}</p>
      </div>

      {/* Reset */}
      <button
        onClick={() => {
          setPhotos(prev => { const base = getDefaultPhotos(canvas, prev.length); return base.map((b, i) => ({ ...b, src: prev[i]?.src ?? null })); });
          setTextBlocks(getDefaultTextBlocks(canvas));
        }}
        style={{ padding: "10px", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", border: "1px solid var(--border)", background: "#fff", color: "var(--muted)", cursor: "pointer" }}
      >
        Reset Layout
      </button>

      <div style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.8, borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
        <p>사진 클릭 → 이동 (자동 스냅)</p>
        <p>선택한 사진의 <strong style={{ color: "var(--text)" }}>모서리·변 핸들</strong> 드래그 → 크기 조절</p>
        <p>텍스트 호버 후 드래그 → 이동</p>
      </div>
    </div>
  );
}

/* ─────────────────── 템플릿 미리보기 (내 사진으로) ──────────────── */
const PHOTO_TYPE_LABEL: Record<PhotoType, string> = {
  headshot: "헤드샷", half: "상반신", full: "전신", profile: "옆모습", lifestyle: "라이프스타일", empty: "빈 칸",
};

/** order(사진 번호 순서)에서 main을 맨 앞으로 */
function withMainFirst(order: number[], main: number | null): number[] {
  if (main === null || !order.includes(main)) return order;
  return [main, ...order.filter(i => i !== main)];
}

/** 템플릿 하나를 내 사진·내 정보로 작게 그린 미리보기 */
function CardPreview({ canvas, choice, photos, order, fields, width }: {
  canvas: CanvasType; choice: LayoutChoice; photos: PhotoItem[]; order: number[];
  fields: { label: string; value: string }[]; width: number;
}) {
  const { w, h } = CANVAS[canvas];
  const s = width / w;
  const name = fields.find(f => f.label === "English Name")?.value ?? "";
  const kor = fields.find(f => f.label === "Korean Name")?.value ?? "";
  const stats = fields.filter(f => isStatsField(f.label));
  const contact = fields.filter(f => isContactField(f.label));
  const L = buildLayout(canvas, choice.template, photos.length, choice.nameSize, name.length || 12, choice.statsLayout, stats.length);
  const half = Math.ceil(stats.length / 2);
  const statRows = L.statsLayout === "1단" ? [stats] : [stats.slice(0, half), stats.slice(half)];
  const block = (id: string) => L.textBlocks.find(b => b.id === id)!;
  const txt = (extra: React.CSSProperties): React.CSSProperties => ({ position: "absolute", whiteSpace: "nowrap", color: choice.txtColor, fontWeight: choice.fontWeight, zIndex: 3, lineHeight: 1.25, ...extra });
  return (
    <div style={{ position: "relative", width, height: h * s, background: choice.bgColor, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
      {order.map((oi, i) => {
        const p = L.photos[i]; const src = photos[oi]?.src;
        return (
          <div key={i} style={{ position: "absolute", left: p.x * s, top: p.y * s, width: p.w * s, height: p.h * s, background: choice.bgColor === "#0C0C0C" ? "#2A2A2A" : "#D8D4CF" }}>
            {src && <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
          </div>
        );
      })}
      {name && (() => { const b = block("name"); return (
        <div className="font-display" style={txt({ left: b.x * s, top: b.y * s, fontSize: b.fontSize * s, textTransform: choice.nameCaps ? "uppercase" : "none", letterSpacing: choice.nameCaps ? "0.04em" : undefined })}>{name}</div>
      ); })()}
      {kor && (() => { const b = block("korName"); return <div style={txt({ left: b.x * s, top: b.y * s, fontSize: b.fontSize * s, letterSpacing: "0.04em" })}>{kor}</div>; })()}
      {stats.length > 0 && (() => { const b = block("stats"); return (
        <div style={txt({ left: b.x * s, top: b.y * s })}>
          {statRows.map((row, ri) => (
            <div key={ri} style={{ display: "flex", gap: 12 * s, marginTop: ri ? 6 * s : 0 }}>
              {row.map(f => (
                <span key={f.label} style={{ display: "inline-flex", flexDirection: "column" }}>
                  <span style={{ fontSize: Math.max(6, b.fontSize - 4) * s, letterSpacing: "0.12em", textTransform: "uppercase" }}>{f.label}</span>
                  <span style={{ fontSize: b.fontSize * s }}>{f.value}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      ); })()}
      {contact.length > 0 && (() => { const b = block("contact"); return (
        <div style={txt({ left: b.x * s, top: b.y * s, fontSize: b.fontSize * s, lineHeight: 1.5 })}>
          {contact.map(f => <div key={f.label}>{f.value}</div>)}
        </div>
      ); })()}
    </div>
  );
}

/** 같은 사진 묶음으로는 AI를 다시 부르지 않도록 결과를 기억 (단계 이동·되돌아오기 대비) */
type AiResult = { state: "done" | "unavailable" | "error"; data: SuggestResponse | null; note: string };
const aiCache = new Map<string, AiResult>();
/** 실제 사용자 성과 순위 (방향|장수 별로 한 번만 받음) */
const insightCache = new Map<string, ComboInsight | null>();

function TemplateStep({ canvas, photos, fields, onChoose, onBack }: {
  canvas: CanvasType; photos: PhotoItem[]; fields: { label: string; value: string }[];
  onChoose: (c: LayoutChoice, source: "ai" | "preset" | "default") => void; onBack: () => void;
}) {
  const [mainIdx, setMainIdx] = useState<number | null>(null); // 사용자가 직접 고른 메인 사진
  const [, rerender] = useState(0);
  const [failed, setFailed] = useState<{ key: string; note: string } | null>(null); // 일시 오류 (기억하지 않음)
  const uploaded = photos.filter(p => p.src && !p.src.startsWith("blob:")).length;
  const n = photos.length;
  const identity = Array.from({ length: n }, (_, i) => i);
  // 사진 묶음이 같으면 AI 결과를 다시 씀
  const askedKey = `${canvas}|` + photos.map(p => `${p.id}:${p.src ?? ""}`).join("|");
  const cached = aiCache.get(askedKey);
  const aiState: "idle" | "loading" | "done" | "unavailable" | "error" =
    uploaded === 0 ? "idle" : cached ? cached.state : failed?.key === askedKey ? "error" : "loading";
  const aiNote = cached?.note ?? (failed?.key === askedKey ? failed.note : "");
  const ai = cached?.data ?? null;

  useEffect(() => {
    if (uploaded === 0 || aiCache.has(askedKey)) return;
    let cancelled = false;
    (async () => {
      track("ai_suggest_requested", { where: "template", canvas, count: n });
      try {
        const res = await fetch("/api/comcard/suggest", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canvas,
            photos: photos.map(p => (p.src && !p.src.startsWith("blob:") ? p.src : null)),
            name: fields.find(f => f.label === "English Name")?.value,
            fieldLabels: fields.map(f => f.label),
          }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (res.status === 503) aiCache.set(askedKey, { state: "unavailable", data: null, note: json.error ?? "" });
        else if (res.status === 402) { aiCache.set(askedKey, { state: "unavailable", data: null, note: json.error ?? "" }); track("paywall_shown", { reason: "ai_limit" }); }
        else if (!res.ok) { setFailed({ key: askedKey, note: json.error ?? "AI 추천을 받지 못했어요." }); return; }
        else aiCache.set(askedKey, { state: "done", data: json as SuggestResponse, note: "" });
        rerender(v => v + 1);
      } catch {
        if (!cancelled) setFailed({ key: askedKey, note: "AI 추천을 받지 못했어요." });
      }
    })();
    return () => { cancelled = true; };
  }, [askedKey, uploaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const aiValid = aiState === "done" && !!ai;
  const baseOrder = withMainFirst(aiValid ? safeOrder(ai!.defaultOrder, n) : identity, mainIdx);
  const effectiveMain = baseOrder[0];

  type Card = { choice: LayoutChoice; order: number[]; title: string; sub: string; reason?: string; aiPick: boolean; preset: Preset };
  const aiCards: Card[] = aiValid ? ai!.suggestions.map(sg => {
    const preset = PRESET_BY_ID[sg.template];
    return {
      choice: { template: sg.template, bgColor: HEX.test(sg.bgColor) ? sg.bgColor : preset.style.bgColor, txtColor: HEX.test(sg.txtColor) ? sg.txtColor : preset.style.txtColor,
        fontWeight: Number(sg.fontWeight), statsLayout: sg.statsLayout, nameSize: sg.nameSize, nameCaps: sg.nameCaps },
      order: withMainFirst(safeOrder(sg.photoOrder, n), mainIdx), title: sg.title, sub: preset?.name ?? sg.template, reason: sg.reason, aiPick: true, preset,
    };
  }) : [];
  // 지금 방향(세로/가로)·장수에 맞는 양식만 보여줌 (맞는 게 없으면 방향 맞는 것 전부)
  const usable = availablePresets(canvas, photos.length);
  const fitted = usable.length ? usable : presetOptions(canvas, photos.length).map(o => o.preset);
  // 실제 사용자들이 다운로드·공유까지 많이 간 양식을 앞으로 (데이터가 충분할 때만)
  const insightKey = `${canvas}|${photos.length}`;
  const [fetched, setFetched] = useState<{ key: string; data: ComboInsight | null } | null>(null);
  const insight = insightCache.has(insightKey) ? insightCache.get(insightKey) ?? null : fetched?.key === insightKey ? fetched.data : null;
  useEffect(() => {
    if (insightCache.has(insightKey)) return;
    let cancelled = false;
    fetch(`/api/comcard/insights?canvas=${canvas}&count=${photos.length}`)
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: ComboInsight | null) => { insightCache.set(insightKey, j); if (!cancelled) setFetched({ key: insightKey, data: j }); });
    return () => { cancelled = true; };
  }, [insightKey, canvas, photos.length]);
  const rankOf = (id: string) => (insight?.enough ? insight.ranked.findIndex(x => x.template === id) : -1);
  const shown = insight?.enough ? [...fitted].sort((a, b) => rankOf(a.id) - rankOf(b.id)) : fitted;
  const best = insight?.enough ? insight.ranked.find(x => x.users >= MIN_TEMPLATE_USERS) ?? null : null;
  const presetCards: Card[] = shown.map(p => ({ choice: presetChoice(p), order: baseOrder, title: p.name, sub: p.description, aiPick: false, preset: p }));
  const cards = [...aiCards, ...presetCards];
  const previewW = canvas === "portrait" ? 200 : 260;

  return (
    <div style={{ maxWidth: "1180px", margin: "0 auto", padding: "48px 24px 80px" }}>
      <h1 className="font-display" style={{ fontSize: "44px", fontWeight: 400, marginBottom: "12px" }}>Choose Template</h1>
      <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "28px" }}>내 사진으로 만든 미리보기예요. 마음에 드는 구성을 고르면 편집기에서 이어서 다듬을 수 있어요.</p>

      {/* 메인 사진 + 사진 인식 결과 */}
      <div style={{ border: "1px solid var(--border)", background: "#fff", padding: "16px 18px", marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>메인 사진 · 사진 인식</p>
          <span style={{ fontSize: "11px", color: aiState === "error" ? "#c00" : "var(--muted)" }}>
            {uploaded === 0 ? "사진이 없어 기본 순서로 보여줘요"
              : aiState === "loading" ? "AI가 사진을 살펴보는 중..."
              : aiValid ? `AI가 사진을 인식해 배치했어요${typeof ai?.remaining === "number" ? ` · 이번 달 무료 AI 추천 ${ai.remaining}회 남음` : ""}`
              : aiState === "unavailable" ? (aiNote.includes("무료 AI 추천") ? `${aiNote} 지금은 올린 순서대로 배치했어요.` : "AI 설정 전이라 올린 순서대로 배치했어요")
              : aiState === "error" ? `${aiNote} 올린 순서대로 배치했어요` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {photos.map((p, i) => (
            <button key={p.id} onClick={() => setMainIdx(i)} title="메인 사진으로 지정"
              style={{ position: "relative", width: 64, padding: 0, border: `2px solid ${effectiveMain === i ? "var(--text)" : "transparent"}`, background: "none", cursor: "pointer" }}>
              <div style={{ width: "100%", aspectRatio: "3/4", background: "var(--surface)", overflow: "hidden" }}>
                {p.src && <img src={p.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
              </div>
              {effectiveMain === i && <span style={{ position: "absolute", top: 3, left: 3, fontSize: "8px", background: "var(--text)", color: "#fff", padding: "1px 5px", letterSpacing: "0.08em" }}>MAIN</span>}
              <span style={{ display: "block", fontSize: "9px", color: "var(--muted)", marginTop: "3px" }}>
                {aiValid ? PHOTO_TYPE_LABEL[ai!.photoTypes[i] ?? "empty"] : `${i + 1}번`}
              </span>
            </button>
          ))}
        </div>
        <p style={{ fontSize: "10px", color: "var(--muted)", marginTop: "8px" }}>사진을 누르면 그 사진이 모든 템플릿의 메인 자리로 가요.</p>
      </div>

      {/* 템플릿 미리보기 목록 */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${previewW}px, 1fr))`, gap: "28px 22px" }}>
        {aiState === "loading" && Array.from({ length: 3 }, (_, i) => (
          <div key={`sk${i}`} style={{ width: previewW, height: previewW * CANVAS[canvas].h / CANVAS[canvas].w, background: "var(--surface)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "var(--muted)" }}>AI 추천 준비 중...</div>
        ))}
        {cards.map((c, i) => (
          <button key={`${c.aiPick ? "ai" : "p"}-${c.preset?.id ?? i}-${i}`} onClick={() => onChoose({ ...c.choice, photoOrder: c.order, photoIds: photos.map(p => p.id) }, c.aiPick ? "ai" : "preset")}
            style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <CardPreview canvas={canvas} choice={c.choice} photos={photos} order={c.order} fields={fields} width={previewW} />
              {c.aiPick && <span style={{ position: "absolute", top: 8, left: 8, fontSize: "10px", background: "#0A0A0A", color: "#fff", padding: "3px 8px", letterSpacing: "0.06em", zIndex: 5 }}>✨ AI 추천</span>}
            </div>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", margin: "10px 0 2px" }}>{c.title}</p>
            <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.5 }}>{c.sub}</p>
            {!c.aiPick && best && best.template === c.preset.id && (
              <p style={{ fontSize: "10px", color: "#1f7a3a", marginTop: "4px" }}>★ 같은 조건 사용자 중 완성률이 가장 높아요 ({Math.round(best.rate * 100)}%)</p>
            )}
            {c.reason && <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.5, marginTop: "4px" }}>{c.reason}</p>}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "10px", marginTop: "40px", maxWidth: "640px" }}>
        <button onClick={onBack} style={{ flex: 1, background: "#fff", color: "var(--text)", border: "1px solid var(--border)", padding: "15px", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>← Back</button>
        <button onClick={() => onChoose({ ...presetChoice(shown[0]), template: shown[0].id, photoOrder: baseOrder, photoIds: photos.map(p => p.id) }, "default")}
          style={{ flex: 2, background: "#fff", color: "var(--muted)", border: "1px solid var(--border)", padding: "15px", fontSize: "11px", letterSpacing: "0.1em", cursor: "pointer" }}>
          고르지 않고 기본 구성으로 편집하기
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── 사진 올리기 단계 ─────────────────────────── */
function PhotosStep({ photos, setPhotos, userId, uploading, setUploading, onNext, onBack }: {
  photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
  userId: string | null; uploading: number; setUploading: React.Dispatch<React.SetStateAction<number>>;
  onNext: () => void; onBack: () => void;
}) {
  const filled = photos.filter(p => p.src).length;
  const all = filled === photos.length;
  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "60px 24px 80px" }}>
      <h1 className="font-display" style={{ fontSize: "44px", fontWeight: 400, marginBottom: "12px" }}>Upload Photos</h1>
      <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "8px" }}>사진 {photos.length}장을 올려주세요. 칸을 누르면 사진을 고를 수 있어요.</p>
      <p style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "28px", lineHeight: 1.7 }}>
        얼굴이 잘 보이는 헤드샷 1장과 상반신·전신·옆모습처럼 서로 다른 컷을 섞으면 좋아요. 순서는 상관없어요. 다음 단계에서 AI가 메인 사진을 골라 배치해줘요.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${photos.length <= 4 ? photos.length : 3}, 1fr)`, gap: "12px", marginBottom: "16px" }}>
        {photos.map((p, i) => (
          <div key={p.id} style={{ position: "relative" }}>
            <label style={{ display: "block", aspectRatio: "3/4", cursor: "pointer", background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files?.[0] && uploadPhotoFile(p.id, e.target.files[0], userId, setPhotos, setUploading)} />
              {p.src
                ? <img src={p.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: p.src.startsWith("blob:") ? 0.6 : 1 }} />
                : <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <span style={{ fontSize: "24px", color: "var(--border)" }}>+</span>
                    <span style={{ fontSize: "10px", letterSpacing: "0.1em", color: "var(--muted)" }}>{i + 1}</span>
                  </div>}
              {p.src?.startsWith("blob:") && (
                <span style={{ position: "absolute", bottom: 6, left: 6, fontSize: "9px", background: uploading > 0 ? "rgba(0,0,0,0.6)" : "#c00", color: "#fff", padding: "2px 6px" }}>
                  {uploading > 0 ? "업로드 중..." : "저장 안 됨 · 다시 올려주세요"}
                </span>
              )}
            </label>
            {p.src && (
              <button onClick={() => setPhotos(prev => prev.map(q => q.id === p.id ? { ...q, src: null } : q))}
                style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", cursor: "pointer", fontSize: "13px", lineHeight: 1 }}>×</button>
            )}
          </div>
        ))}
      </div>
      <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "28px" }}>{filled} / {photos.length}장{uploading > 0 ? ` · 업로드 중 ${uploading}장` : ""}</p>
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={onBack} style={{ flex: 1, background: "#fff", color: "var(--text)", border: "1px solid var(--border)", padding: "15px", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>← Back</button>
        <button onClick={onNext} disabled={uploading > 0}
          style={{ flex: 2, background: all ? "var(--text)" : "#fff", color: all ? "#fff" : "var(--text)", border: all ? "none" : "1px solid var(--border)", padding: "15px", fontSize: "11px", letterSpacing: "0.14em", textTransform: all ? "uppercase" : "none", cursor: uploading > 0 ? "wait" : "pointer", opacity: uploading > 0 ? 0.6 : 1 }}>
          {uploading > 0 ? "업로드가 끝나면 넘어갈 수 있어요" : all ? "Next →" : "사진 없이(또는 일부만) 진행 →"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────── main page ──────────────────────────── */
/** 디자인 값이 바뀌면 편집 횟수 1회로 셈 (색 고르기처럼 연속으로 바뀌면 0.8초 묶어서 1회) */
function useTallyOnChange(value: unknown, kind: EditKind, enabled: boolean) {
  const prev = useRef(value);
  useEffect(() => {
    if (Object.is(prev.current, value)) return;
    prev.current = value;
    // 프리셋 적용·되돌리기·카드 불러오기로 바뀐 건 사용자가 직접 고친 게 아니므로 제외
    if (!enabled || talliesMuted()) return;
    const t = setTimeout(() => tallyEdit(kind), 800);
    return () => clearTimeout(t);
  }, [value, kind, enabled]);
}

function ComcardPageInner() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("id"); // 기존 카드 불러오기용

  const [step,         setStep]        = useState<"orient" | "count" | "photos" | "fields" | "template" | "design">("orient");
  const [canvas,       setCanvas]      = useState<CanvasType>("portrait");
  const [enabledFields,setEnabledFields]= useState<string[]>(["engName","korName","height","chest","waist","hip","instagram"]);
  const [bgColor,      setBgColor]     = useState("#FFFFFF");
  const [txtColor,     setTxtColor]    = useState("#0A0A0A");
  const [fontWeight,   setFontWeight]  = useState(400);
  const [statsLayout,  setStatsLayout] = useState<"1단" | "2단">("2단");
  const [nameCaps,     setNameCaps]    = useState(false);
  const [photos,       setPhotos]      = useState<PhotoItem[]>(() => getDefaultPhotos("portrait", 5));
  const [textBlocks,   setTextBlocks]  = useState<TextBlock[]>(() => getDefaultTextBlocks("portrait"));
  const nextIdRef       = useRef(5);
  const lastResizedWRef = useRef<number | null>(null);
  const canvasRef       = useRef<HTMLDivElement>(null);
  const mainAreaRef     = useRef<HTMLDivElement>(null);
  const editIdRef       = useRef<string | null>(editId); // 저장 시 update vs insert 판단용
  const [canvasScale,   setCanvasScale]  = useState(1);
  const [cardSaving, setCardSaving] = useState(false);
  const [cardSaved,  setCardSaved]  = useState(false);
  const [cardError,  setCardError]  = useState(false);
  const [cardTitle,  setCardTitle]  = useState("내 컴카드");
  const pinchRef        = useRef<{ dist: number; zoom: number } | null>(null);
  const userZoomRef     = useRef(1);
  const canvasZoomWrapRef = useRef<HTMLDivElement>(null);
  const layoutCanvasRef = useRef<CanvasType>("portrait"); // 현재 배치가 어떤 방향 기준인지
  const [userId,        setUserId]        = useState<string | null>(null);
  const [profileValues, setProfileValues] = useState<Record<string, string>>({});
  const [savedFields,   setSavedFields]   = useState<Record<string, string>>({}); // 저장된 카드의 값 (label → value)
  const [uploading,     setUploading]     = useState(0);

  // ── 사용 패턴: 단계 이동 / 편집기 체류 ──
  const templateRef = useRef<string>("custom"); // 지금 배치의 기준 양식 (성과 집계·추천 개선용)
  useEffect(() => { track("comcard_step", { step }); }, [step]);
  useEffect(() => () => endEditorSession("left"), []);
  useTallyOnChange(bgColor, "bg_color", step === "design");
  useTallyOnChange(txtColor, "text_color", step === "design");
  useTallyOnChange(fontWeight, "font_weight", step === "design");
  useTallyOnChange(nameCaps, "name_caps", step === "design");
  useTallyOnChange(statsLayout, "stats_layout", step === "design");

  // 로그인 사용자 + 마이페이지 프로필 불러오기
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (p) setProfileValues(profileToValues(p as ProfileRow));
    })();
  }, []);

  // 기존 카드 불러오기
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("comp_cards").select("*").eq("id", editId).single();
      if (!data) return;
      const d = data.data;
      setCanvas(data.canvas_type as CanvasType);
      layoutCanvasRef.current = data.canvas_type as CanvasType;
      if (Array.isArray(d.fields)) {
        setSavedFields(Object.fromEntries((d.fields as { label: string; value: string }[]).map(f => [f.label, f.value])));
      }
      muteTallies(1500);
      if (d.bgColor)       setBgColor(d.bgColor);
      if (d.txtColor)      setTxtColor(d.txtColor);
      if (d.fontWeight)    setFontWeight(d.fontWeight);
      if (d.statsLayout)   setStatsLayout(d.statsLayout);
      if (typeof d.nameCaps === "boolean") setNameCaps(d.nameCaps);
      if (d.enabledFields) setEnabledFields(d.enabledFields);
      // 예전 버전에서 저장된 임시 주소(blob:)는 다시 열 수 없으므로 빈 칸으로 표시
      if (d.photos)        setPhotos(d.photos.map((p: PhotoItem) => ({ ...p, src: p.src?.startsWith("blob:") ? null : p.src, h: p.h ?? Math.round(p.w * (4/3)) })));
      if (d.textBlocks)    setTextBlocks(d.textBlocks);
      if (typeof d.template === "string") templateRef.current = d.template;
      if (d.photos)        nextIdRef.current = Math.max(...d.photos.map((p: PhotoItem) => p.id)) + 1;
      if (data.title)      setCardTitle(data.title);
      setStep("design");
      startEditorSession({ canvas: data.canvas_type, count: Array.isArray(d.photos) ? d.photos.length : 0, template: typeof d.template === "string" ? d.template : "custom", source: "reopen" });
    })();
  }, [editId]);


  /** 카드 저장. 성공하면 카드 id, 실패하면 null */
  const saveCard = async (): Promise<string | null> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert("로그인이 필요합니다."); return null; }
    if (uploading > 0) { alert("사진을 올리는 중이에요. 잠시 후 다시 저장해 주세요."); return null; }
    setCardSaving(true);
    setCardError(false);
    // 아직 업로드되지 않은 임시 사진은 저장하지 않음
    const savePhotos = photos.map(p => p.src?.startsWith("blob:") ? { ...p, src: null } : p);
    const cardData = { bgColor, txtColor, fontWeight, statsLayout, nameCaps, enabledFields, fields: selectedData, photos: savePhotos, textBlocks, template: templateRef.current };
    let error: { message: string } | null = null;
    if (editIdRef.current) {
      // 기존 카드 업데이트
      ({ error } = await supabase.from("comp_cards").update({ canvas_type: canvas, title: cardTitle, data: cardData, updated_at: new Date().toISOString() }).eq("id", editIdRef.current));
    } else {
      // 새 카드 저장
      const res = await supabase.from("comp_cards").insert({ user_id: user.id, title: cardTitle, canvas_type: canvas, data: cardData }).select("id").single();
      error = res.error;
      if (res.data) editIdRef.current = res.data.id; // 이후 저장은 update로
    }
    setCardSaving(false);
    if (error) {
      console.error("[comcard] save failed:", error);
      setCardError(true);
      setTimeout(() => setCardError(false), 4000);
      return null;
    }
    setCardSaved(true);
    setTimeout(() => setCardSaved(false), 2500);
    track("card_saved", { canvas, count: photos.length, edit: !!editId });
    return editIdRef.current;
  };

  // ── 다운로드 권한 확인: 저장 → 서버에서 무료 1장/유료 무제한 확인 ──
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<"limit" | "changed" | "publish">("limit");
  const [shareCardId, setShareCardId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  /** 공유: 저장 → 공개로 전환(무료 1장 한도 확인) → 공유 창 */
  const shareCard = async () => {
    setSharing(true);
    try {
      const cardId = await saveCard();
      if (!cardId) return;
      const res = await fetch("/api/comcard/publish", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, publish: true }),
      });
      if (res.status === 402) { setPaywallReason("publish"); setPaywallOpen(true); track("paywall_shown", { reason: "publish" }); return; }
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? "공유를 준비하지 못했어요."); return; }
      setShareCardId(cardId);
      track("card_published", finalStyle());
      checkpointEditorSession("shared");
    } finally { setSharing(false); }
  };
  const [exporting, setExporting] = useState(false);
  /** 다운로드·공유한 카드의 최종 모습 (어떤 양식·색 조합이 끝까지 가는지 집계 → 추천에 반영) */
  const finalStyle = () => ({
    canvas, count: photos.length, template: templateRef.current,
    bg: bgColor.toUpperCase(), txt: txtColor.toUpperCase(), weight: fontWeight, caps: nameCaps, stats: statsLayout,
  });
  const checkExport = async (kind: "png" | "pdf"): Promise<boolean> => {
    const cardId = await saveCard(); // 다운로드한 카드는 항상 저장해 둠
    if (!cardId) return false;
    const res = await fetch("/api/comcard/export", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, kind }),
    });
    if (res.status === 402) {
      const j = await res.json().catch(() => ({}));
      setPaywallReason(j.reason === "changed" ? "changed" : "limit");
      setPaywallOpen(true);
      track("paywall_shown", { reason: j.reason === "changed" ? "changed" : "limit", kind });
      return false;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "다운로드를 준비하지 못했어요.");
      return false;
    }
    track("card_downloaded", { kind, ...finalStyle() });
    checkpointEditorSession("downloaded");
    return true;
  };

  const captureCanvas = async () => {
    if (!canvasRef.current) return null;
    const el = canvasRef.current;
    const { w, h } = CANVAS[canvas];
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(el, {
      useCORS: true,
      scale: 2,
      width: w,
      height: h,
      ignoreElements: (e) => e.classList.contains("crop-guide"),
      onclone: (_doc, clone) => {
        // 캔버스 자신의 scale transform 제거
        clone.style.transform = "none";
        clone.style.overflow = "hidden";
        // 부모 zoom wrapper transform도 제거
        let p = clone.parentElement;
        while (p) { p.style.transform = "none"; p = p.parentElement; }
      },
    });
  };

  const saveImage = async () => {
    setExporting(true);
    try {
      if (!(await checkExport("png"))) return;
      const c = await captureCanvas();
      if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
      a.download = "myfolio-comcard.png";
      a.click();
    } finally { setExporting(false); }
  };

  const downloadPDF = async () => {
    setExporting(true);
    try {
      if (!(await checkExport("pdf"))) return;
      const c = await captureCanvas();
      if (!c) return;
    const { default: jsPDF } = await import("jspdf");
    const imgData = c.toDataURL("image/png");
    const { w, h } = CANVAS[canvas];
    const orientation = w > h ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, "PNG", 0, 0, pw, ph);
      pdf.save("myfolio-comcard.pdf");
    } finally { setExporting(false); }
  };

  const addPhoto = useCallback(() => {
    tallyEdit("photo_add");
    setPhotos(prev => {
      if (prev.length >= 10) return prev;
      // Use last manually resized width, else match last photo, else default
      const baseW = lastResizedWRef.current ?? prev[prev.length - 1]?.w ?? prev[0]?.w ?? 160;
      const last  = prev[prev.length - 1];
      const cv    = CANVAS[canvas];
      const w     = Math.min(baseW, cv.w - 16);
      const h     = Math.round(w * (4/3));
      const x = Math.max(0, Math.min(last ? last.x + last.w + 8 : 16, cv.w - w));
      const y = Math.max(0, Math.min(last ? last.y : 16, cv.h - h));
      const id = nextIdRef.current++;
      return [...prev, { id, src: null, x, y, w, h }];
    });
  }, [canvas]);

  // 사진 장수 정하기: 이미 올린 사진은 앞에서부터 유지
  const setPhotoCount = (count: number) => {
    setPhotos(prev => getDefaultPhotos(canvas, count).map((b, i) => ({ ...b, id: prev[i]?.id ?? nextIdRef.current++, src: prev[i]?.src ?? null })));
  };

  const removePhoto = useCallback((id: number) => {
    tallyEdit("photo_remove");
    setPhotos(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev);
  }, []);

  // ── 프리셋·AI 추천 적용 / 되돌리기 ──
  type Snapshot = { photos: PhotoItem[]; textBlocks: TextBlock[]; bgColor: string; txtColor: string; fontWeight: number; statsLayout: "1단" | "2단"; nameCaps: boolean };
  const [undoSnapshot, setUndoSnapshot] = useState<Snapshot | null>(null);

  const applyLayout = (c: LayoutChoice, remember = true) => {
    muteTallies(1000);
    templateRef.current = c.template;
    setEditorLayout(c.template, photos.length);
    // 여러 안을 번갈아 적용해도 "처음 상태"로 돌아갈 수 있게 첫 스냅샷만 보관
    if (remember) setUndoSnapshot(prev => prev ?? { photos, textBlocks, bgColor, txtColor, fontWeight, statsLayout, nameCaps });
    else setUndoSnapshot(null);
    layoutCanvasRef.current = canvas;
    // AI가 본 순서대로 현재 사진을 다시 줄 세움 (프리셋이거나 그사이 사진이 바뀌었으면 현재 순서 사용)
    const byId = new Map(photos.map(p => [p.id, p]));
    const ids = c.photoIds;
    const sameSet = !!ids && ids.length === photos.length && ids.every(id => byId.has(id));
    const base = sameSet ? ids!.map(id => byId.get(id)!) : photos;
    const order = sameSet ? safeOrder(c.photoOrder, base.length) : safeOrder(undefined, base.length);
    const nameLen = selectedData.find(f => f.label === "English Name")?.value.length ?? 12;
    const statsCount = selectedData.filter(f => isStatsField(f.label)).length;
    const layout = buildLayout(canvas, c.template, base.length, c.nameSize, nameLen, c.statsLayout, statsCount);
    setPhotos(order.map((oi, i) => ({ ...layout.photos[i], id: base[oi].id, src: base[oi].src })));
    setTextBlocks(layout.textBlocks);
    if (HEX.test(c.bgColor))  setBgColor(c.bgColor);
    if (HEX.test(c.txtColor)) setTxtColor(c.txtColor);
    if ([300, 400, 500, 700].includes(c.fontWeight)) setFontWeight(c.fontWeight);
    setStatsLayout(layout.statsLayout); // 폭이 좁으면 엔진이 2단으로 바꿔줌
    setNameCaps(c.nameCaps);
  };

  const undoLayout = () => {
    if (!undoSnapshot) return;
    tallyEdit("undo");
    muteTallies(1000);
    // 그사이 바뀐 사진(업로드 완료 등)은 유지하고 배치만 되돌림
    const srcById = new Map(photos.map(p => [p.id, p.src]));
    setPhotos(undoSnapshot.photos.map(p => ({ ...p, src: srcById.has(p.id) ? srcById.get(p.id)! : p.src })));
    setTextBlocks(undoSnapshot.textBlocks);
    setBgColor(undoSnapshot.bgColor);
    setTxtColor(undoSnapshot.txtColor);
    setFontWeight(undoSnapshot.fontWeight);
    setStatsLayout(undoSnapshot.statsLayout);
    setNameCaps(undoSnapshot.nameCaps);
    setUndoSnapshot(null);
  };

  const resetLayout = () => {
    tallyEdit("reset");
    setUndoSnapshot(prev => prev ?? { photos, textBlocks, bgColor, txtColor, fontWeight, statsLayout, nameCaps });
    setPhotos(prev => { const base = getDefaultPhotos(canvas, prev.length); return base.map((b, i) => ({ ...b, id: prev[i].id, src: prev[i]?.src ?? null })); });
    setTextBlocks(getDefaultTextBlocks(canvas));
  };

  const toggleField = (key: string) =>
    { tallyEdit("field_toggle"); setEnabledFields(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]); };

  const fieldValue = (key: string, label: string) => profileValues[key] ?? savedFields[label] ?? "";
  const selectedData = profileFields
    .filter(f => f.always || enabledFields.includes(f.key))
    .map(f => ({ label: f.label, value: fieldValue(f.key, f.label) }))
    .filter(f => f.value !== "");

  const chooseCanvas = (type: CanvasType) => {
    setCanvas(type);
    layoutCanvasRef.current = type;
    setPhotos(prev => { const base = getDefaultPhotos(type, prev.length); return base.map((b, i) => ({ ...b, src: prev[i]?.src ?? null })); });
    setTextBlocks(getDefaultTextBlocks(type));
  };

  const { w } = CANVAS[canvas];

  // 모바일에서 캔버스를 화면에 맞게 축소 — step이 "design"으로 바뀔 때 재계산
  useEffect(() => {
    if (step !== "design") return;
    const update = () => {
      const el = mainAreaRef.current;
      if (!el) return;
      const padding = window.innerWidth <= 768 ? 56 : 48;
      const available = el.clientWidth - padding;
      setCanvasScale(Math.min(1, available / w));
    };
    const t = setTimeout(update, 0);
    window.addEventListener("resize", update);
    return () => { clearTimeout(t); window.removeEventListener("resize", update); };
  }, [w, step]);

  // 회색 캔버스 영역 핀치 줌
  useEffect(() => {
    if (step !== "design") return;
    const el = mainAreaRef.current;
    if (!el) return;

    const getDist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const applyZoom = (next: number) => {
      const clamped = Math.min(2.0, Math.max(0.4, next));
      userZoomRef.current = clamped;
      if (canvasZoomWrapRef.current) {
        canvasZoomWrapRef.current.style.transform = `scale(${clamped})`;
      }
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { dist: getDist(e.touches), zoom: userZoomRef.current };
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      applyZoom(pinchRef.current.zoom * (getDist(e.touches) / pinchRef.current.dist));
    };
    const onEnd = () => { pinchRef.current = null; };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);

    // 데스크탑: Ctrl+스크롤 또는 트랙패드 핀치(ctrlKey=true로 들어옴)
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      applyZoom(userZoomRef.current * (1 - e.deltaY * 0.003));
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [step]);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />
      <div style={{ paddingTop: "80px" }}>

        {/* ── Step: Orient ── */}
        {step === "orient" && (
          <div style={{ maxWidth: "640px", margin: "0 auto", padding: "60px 24px 80px" }}>
            <h1 className="font-display" style={{ fontSize: "44px", fontWeight: 400, marginBottom: "12px" }}>Comp Card</h1>
            <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "48px" }}>먼저 컴카드 방향을 선택해주세요.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "36px" }}>
              {(Object.entries(CANVAS) as [CanvasType, typeof CANVAS[CanvasType]][]).map(([key, cfg]) => (
                <div key={key} onClick={() => setCanvas(key)} style={{ cursor: "pointer", border: `2px solid ${canvas === key ? "var(--text)" : "var(--border)"}`, overflow: "hidden" }}>
                  <div style={{ background: "var(--surface)", padding: "32px 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "#D8D4CF", width: key === "portrait" ? 80 : 120, height: key === "portrait" ? 113 : 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#A8A49F" }}>{cfg.sub}</span>
                    </div>
                  </div>
                  <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)" }}>
                    <div>
                      <p style={{ fontSize: "14px", color: "var(--text)", marginBottom: "2px" }}>{cfg.label}</p>
                      <p style={{ fontSize: "11px", color: "var(--muted)" }}>{cfg.sub}</p>
                    </div>
                    {canvas === key && <span>✓</span>}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep("count")} style={{ width: "100%", background: "var(--text)", color: "#fff", border: "none", padding: "16px", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>Next →</button>
          </div>
        )}

        {/* ── Step: Photo count ── */}
        {step === "count" && (
          <div style={{ maxWidth: "640px", margin: "0 auto", padding: "60px 24px 80px" }}>
            <h1 className="font-display" style={{ fontSize: "44px", fontWeight: 400, marginBottom: "12px" }}>How Many Photos?</h1>
            <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "8px" }}>컴카드에 넣을 사진 장수를 골라주세요.</p>
            <p style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "32px", lineHeight: 1.7 }}>보통 대표 사진 1장 + 다양한 컷 3~4장, 총 4~5장을 가장 많이 써요.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "36px" }}>
              {[
                { n: 3, note: "최소 구성" }, { n: 4, note: "가장 많이 써요" },
                { n: 5, note: "가장 많이 써요" }, { n: 6, note: "룩을 많이" },
              ].map(({ n, note }) => {
                const active = photos.length === n;
                const popular = n === 4 || n === 5;
                return (
                  <button key={n} onClick={() => setPhotoCount(n)} style={{
                    padding: popular ? "26px 0" : "20px 0", cursor: "pointer", textAlign: "center",
                    border: `2px solid ${active ? "var(--text)" : "var(--border)"}`, background: active ? "var(--surface)" : "#fff",
                    alignSelf: "end",
                  }}>
                    <span className="font-display" style={{ display: "block", fontSize: popular ? "40px" : "30px", color: "var(--text)", lineHeight: 1 }}>{n}</span>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>장</span>
                    <span style={{ display: "block", fontSize: "10px", marginTop: "8px", color: popular ? "#b07a2a" : "var(--muted)" }}>{note}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setStep("orient")} style={{ flex: 1, background: "#fff", color: "var(--text)", border: "1px solid var(--border)", padding: "15px", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>← Back</button>
              <button onClick={() => { if (photos.length < 3 || photos.length > 6) setPhotoCount(5); setStep("photos"); }} style={{ flex: 2, background: "var(--text)", color: "#fff", border: "none", padding: "15px", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>Next →</button>
            </div>
          </div>
        )}

        {/* ── Step: Photos ── */}
        {step === "photos" && (
          <PhotosStep photos={photos} setPhotos={setPhotos} userId={userId} uploading={uploading} setUploading={setUploading}
            onBack={() => setStep("count")} onNext={() => setStep("fields")} />
        )}

        {/* ── Step: Fields ── */}
        {step === "fields" && (
          <div style={{ maxWidth: "640px", margin: "0 auto", padding: "60px 24px 80px" }}>
            <h1 className="font-display" style={{ fontSize: "44px", fontWeight: 400, marginBottom: "12px" }}>Select Fields</h1>
            <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "8px" }}>컴카드에 표시할 항목을 선택하세요.</p>
            <p style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "32px" }}>
              값은 마이페이지 프로필에서 가져와요. 비어 있는 항목은 카드에 표시되지 않아요.{" "}
              <Link href="/mypage" style={{ color: "var(--text)", textDecoration: "underline" }}>프로필 수정</Link>
            </p>
            <div style={{ border: "1px solid var(--border)", marginBottom: "28px" }}>
              {profileFields.map(f => (
                <div key={f.key} onClick={() => !f.always && toggleField(f.key)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid var(--border)", background: (f.always || enabledFields.includes(f.key)) ? "var(--surface)" : "#fff", cursor: f.always ? "default" : "pointer" }}>
                  <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                    <div style={{ width: "15px", height: "15px", border: "1px solid var(--border)", flexShrink: 0, background: (f.always || enabledFields.includes(f.key)) ? "var(--text)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {(f.always || enabledFields.includes(f.key)) && <span style={{ color: "#fff", fontSize: "9px" }}>✓</span>}
                    </div>
                    <span style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", minWidth: "90px" }}>{f.label}</span>
                    <span style={{ fontSize: "13px", color: fieldValue(f.key, f.label) ? "var(--text)" : "var(--border)" }}>{fieldValue(f.key, f.label) || "—"}</span>
                  </div>
                  {f.always && <span style={{ fontSize: "10px", color: "var(--muted)" }}>Always</span>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setStep("photos")} style={{ flex: 1, background: "#fff", color: "var(--text)", border: "1px solid var(--border)", padding: "15px", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>← Back</button>
              <button onClick={() => setStep("template")} style={{ flex: 2, background: "var(--text)", color: "#fff", border: "none", padding: "15px", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>Template →</button>
            </div>
          </div>
        )}

        {/* ── Step: Template ── */}
        {step === "template" && (
          <TemplateStep canvas={canvas} photos={photos} fields={selectedData}
            onBack={() => setStep("fields")}
            onChoose={(c, source) => {
              track("template_chosen", { source, template: c.template, canvas, count: photos.length });
              applyLayout(c, false); setStep("design");
              startEditorSession({ canvas, count: photos.length, template: c.template, source });
            }} />
        )}

        {/* ── Step: Design ── */}
        {step === "design" && (
          <div className="comcard-design-layout">
            {/* 캔버스 영역 */}
            <main ref={mainAreaRef} className="comcard-canvas-main" style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "40px 24px 60px", overflow: "auto", overflowX: "hidden", background: "#EBEBEB" }}>
              <div ref={canvasZoomWrapRef} style={{ transform: "scale(1)", transformOrigin: "center top", flexShrink: 0 }}>
                <CanvasEditor
                  canvas={canvas} bgColor={bgColor} txtColor={txtColor} fontWeight={fontWeight} nameCaps={nameCaps}
                  photos={photos} setPhotos={setPhotos}
                  textBlocks={textBlocks} setTextBlocks={setTextBlocks}
                  selectedFields={selectedData} statsLayout={statsLayout}
                  onPhotoResize={(canvasW) => { lastResizedWRef.current = canvasW; }}
                  canvasRef={canvasRef}
                  scale={canvasScale}
                  userZoomRef={userZoomRef}
                />
              </div>
            </main>
            {/* 컨트롤 사이드바 */}
            <aside className="comcard-sidebar">
              <div style={{ marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={() => setStep("template")} style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", border: "none", background: "none", color: "var(--muted)", cursor: "pointer" }}>← Template</button>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>{CANVAS[canvas].label}</span>
              </div>
              <LayoutPanel
                canvas={canvas}
                photos={photos}
                selectedFields={selectedData}
                onApply={applyLayout}
                onUndo={undoLayout}
                canUndo={undoSnapshot !== null}
                onReset={resetLayout}
              />
              <ControlsPanel
                canvas={canvas}
                bgColor={bgColor}   setBgColor={setBgColor}
                txtColor={txtColor} setTxtColor={setTxtColor}
                fontWeight={fontWeight} setFontWeight={setFontWeight}
                nameCaps={nameCaps} setNameCaps={setNameCaps}
                photos={photos}     setPhotos={setPhotos}
                onAddPhoto={addPhoto} onRemovePhoto={removePhoto}
                textBlocks={textBlocks} setTextBlocks={setTextBlocks}
                statsLayout={statsLayout} setStatsLayout={setStatsLayout}
                userId={userId} setUploading={setUploading}
              />
              {/* 저장 / 다운로드 버튼 */}
              <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  value={cardTitle}
                  onChange={e => setCardTitle(e.target.value)}
                  placeholder="컴카드 이름"
                  style={{ width: "100%", border: "1px solid var(--border)", padding: "10px 12px", fontSize: "12px", fontFamily: "var(--font-inter), sans-serif", outline: "none", boxSizing: "border-box" }}
                />
                <button onClick={() => saveCard()} disabled={cardSaving} style={{ width: "100%", background: "#fff", color: "var(--text)", border: "1px solid var(--border)", padding: "13px", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
                  {cardError ? "저장 실패 — 다시 시도" : cardSaved ? "저장됨 ✓" : cardSaving ? "저장 중..." : uploading > 0 ? "사진 업로드 중..." : "마이페이지에 저장"}
                </button>
                <button onClick={saveImage} disabled={exporting} style={{ width: "100%", background: "#fff", color: "var(--text)", border: "1px solid var(--border)", padding: "13px", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", cursor: exporting ? "wait" : "pointer", opacity: exporting ? 0.6 : 1 }}>Save Image</button>
                <button onClick={downloadPDF} disabled={exporting} style={{ width: "100%", background: "var(--text)", color: "#fff", border: "none", padding: "13px", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", cursor: exporting ? "wait" : "pointer", opacity: exporting ? 0.6 : 1 }}>{exporting ? "준비 중..." : "Download PDF"}</button>
                <button onClick={shareCard} disabled={sharing} style={{ width: "100%", background: "#fff", color: "var(--text)", border: "1px solid var(--text)", padding: "13px", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", cursor: sharing ? "wait" : "pointer", opacity: sharing ? 0.6 : 1 }}>
                  {sharing ? "준비 중..." : "공유하기 (링크)"}
                </button>
                <ExportNote />
              </div>
            </aside>
          </div>
        )}
      </div>
      {paywallOpen && <Paywall reason={paywallReason} onClose={() => setPaywallOpen(false)} />}
      {shareCardId && (
        <div onClick={() => setShareCardId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", maxWidth: "400px", width: "100%", padding: "28px 24px" }}>
            <h2 className="font-display" style={{ fontSize: "24px", fontWeight: 400, marginBottom: "8px" }}>컴카드를 공유해 보세요</h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.7, marginBottom: "16px" }}>
              링크를 받은 사람은 로그인 없이 카드를 볼 수 있어요. 카톡·인스타 DM으로 에이전시나 클라이언트에게 보내보세요.
            </p>
            <ShareButtons path={`/card/${shareCardId}`} title={`${cardTitle} · 컴카드`} text="myfolio로 만든 컴카드를 확인해 보세요" />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "14px" }}>
              <a href={`/card/${shareCardId}`} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "var(--muted)" }}>공개 페이지 보기 ↗</a>
              <button onClick={() => setShareCardId(null)} style={{ fontSize: "12px", background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 다운로드 버튼 아래 무료/유료 안내 */
function ExportNote() {
  const [status] = useBillingStatus();
  const inApp = useIsNativeApp();
  if (!status || status.configured === false) return null;
  if (status.isPro) return <p style={{ fontSize: "10px", color: "var(--muted)", textAlign: "center" }}>Pro · 다운로드 무제한</p>;
  const used = status.exportedCardIds?.length ?? 0;
  return (
    <p style={{ fontSize: "10px", color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
      무료: 컴카드 {FREE_EXPORT_CARD_LIMIT}장 다운로드 ({Math.min(used, FREE_EXPORT_CARD_LIMIT)}/{FREE_EXPORT_CARD_LIMIT} 사용)<br />
      {inApp ? "Pro 회원은 무제한" : <Link href="/pricing" style={{ color: "var(--text)" }}>Pro로 무제한 이용하기</Link>}
    </p>
  );
}

/** 무료 한도를 넘었을 때 뜨는 결제 안내 */
function Paywall({ onClose, reason = "limit" }: { onClose: () => void; reason?: "limit" | "changed" | "publish" }) {
  const inApp = useIsNativeApp();
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", maxWidth: "400px", width: "100%", padding: "32px 28px", textAlign: "center" }}>
        <p style={{ fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "10px" }}>myfolio Pro</p>
        <h2 className="font-display" style={{ fontSize: "26px", fontWeight: 400, marginBottom: "12px" }}>
          {reason === "changed" ? "새 컴카드로 바뀌었어요" : reason === "publish" ? "무료 공개를 모두 썼어요" : "무료 다운로드를 모두 썼어요"}
        </h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.7, marginBottom: "24px" }}>
          {reason === "changed"
            ? <>처음 다운로드했을 때 사진의 절반 이상이 바뀌어서 새 컴카드로 봐요.<br />무료 회원은 컴카드 {FREE_EXPORT_CARD_LIMIT}장까지 다운로드할 수 있어요.<br /></>
            : reason === "publish"
            ? <>무료 회원은 컴카드 {FREE_FEATURED_LIMIT}장까지 공개(링크 공유)할 수 있어요.<br />마이페이지에서 다른 카드를 비공개로 바꾸면 이 카드를 공개할 수 있어요.<br /></>
            : <>무료 회원은 컴카드 {FREE_EXPORT_CARD_LIMIT}장까지 다운로드할 수 있어요.<br /></>}
          {inApp ? <>Pro 회원은 무제한으로 다운로드할 수 있어요.<br /></> : <>Pro(월 {formatKRW(PRO_PLAN.priceKRW)}부터)로 무제한 다운로드하고 포트폴리오도 채워보세요.<br /></>}
          만든 카드는 저장돼 있어요.
        </p>
        {!inApp && <Link href="/pricing" style={{ display: "block", padding: "14px", background: "var(--text)", color: "#fff", textDecoration: "none", fontSize: "12px", letterSpacing: "0.12em", marginBottom: "8px" }}>요금제 보기</Link>}
        <button onClick={onClose} style={{ width: "100%", padding: "12px", background: "none", border: "none", color: "var(--muted)", fontSize: "12px", cursor: "pointer" }}>닫기</button>
      </div>
    </div>
  );
}

export default function ComcardPage() {
  return (
    <Suspense>
      <ComcardPageInner />
    </Suspense>
  );
}
