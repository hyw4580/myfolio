"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Nav from "../components/Nav";
import { createClient } from "@/lib/supabase/client";

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

/* ─────────────────────── mock profile ──────────────────────── */
const mockProfile: Record<string, string> = {
  engName: "Emma Johnson", korName: "엠마 존슨",
  gender: "Female", birthYear: "2001", height: "170 cm",
  weight: "52 kg", chest: "34 in", waist: "24 in", hip: "35 in",
  shoeSize: "250 mm", hairColor: "Dark Brown", eyeColor: "Black",
  instagram: "@emmajohnson", email: "emma@email.com", phone: "+82 010-0000-0000",
};
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
      onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); onMoveStart(getClientPos(e)); }}
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

function CanvasEditor({ canvas, bgColor, txtColor, fontWeight, photos, setPhotos, textBlocks, setTextBlocks, selectedFields, statsLayout, onPhotoResize, canvasRef, scale }: {
  canvas: CanvasType; bgColor: string; txtColor: string; fontWeight: number;
  photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
  textBlocks: TextBlock[]; setTextBlocks: React.Dispatch<React.SetStateAction<TextBlock[]>>;
  selectedFields: { label: string; value: string }[];
  statsLayout: "1단" | "2단";
  onPhotoResize: (w: number) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
}) {
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [snapLines, setSnapLines]     = useState<SnapLines>({ xs: [], ys: [] });
  const dragRef        = useRef<DragState>(null);
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
  const subColor  = bgColor === "#0C0C0C" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)";

  // 사진/핸들 위에서만 scroll 차단 — 배경 터치 시 페이지 스크롤 허용
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      const rect = el.getBoundingClientRect();
      const t = e.touches[0];
      const s = scaleRefOuter.current;
      const cx = (t.clientX - rect.left) / s;
      const cy = (t.clientY - rect.top) / s;
      const curPhotos = photosRef.current;
      const curSel = selectedIdRef.current;
      // 리사이즈 핸들 체크
      if (curSel !== null) {
        const sel = curPhotos.find(p => p.id === curSel);
        if (sel) {
          const ph = Math.round(sel.w * (4/3));
          const corners = [
            { x: sel.x, y: sel.y }, { x: sel.x + sel.w, y: sel.y },
            { x: sel.x, y: sel.y + ph }, { x: sel.x + sel.w, y: sel.y + ph },
          ];
          if (corners.some(c => Math.abs(cx - c.x) <= 20 && Math.abs(cy - c.y) <= 20)) {
            e.preventDefault(); return;
          }
        }
      }
      // 사진 영역 체크
      for (let i = curPhotos.length - 1; i >= 0; i--) {
        const p = curPhotos[i];
        if (cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + Math.round(p.w * (4/3))) {
          e.preventDefault(); return;
        }
      }
      // 배경 터치 → preventDefault 없음 → 페이지 스크롤 허용
    };
    el.addEventListener("touchstart", handler, { passive: false });
    return () => el.removeEventListener("touchstart", handler);
  }, []);

  useEffect(() => {
    const scaleRef = { current: scale };
    scaleRef.current = scale;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const d = dragRef.current;
      if (!d) return; // 드래그 중이 아니면 스크롤 허용
      if (e.cancelable) e.preventDefault();
      const { clientX, clientY } = getClientPos(e);
      const s = scaleRef.current;

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

        // 칼선 2mm — 먼저 체크, 더 넓은 임계값(SNAP*4)으로 우선 흡착
        const m = (cv.w > cv.h ? cv.w / 297 : cv.w / 210) * 2;
        const CROP_SNAP = SNAP * 4;
        if (Math.abs(nx - m) < CROP_SNAP)                        { nx = m;              snapXs.push(m); }
        else if (Math.abs(nx + moving.w - (cv.w - m)) < CROP_SNAP) { nx = cv.w - m - moving.w; snapXs.push(cv.w - m); }
        if (Math.abs(ny - m) < CROP_SNAP)                        { ny = m;              snapYs.push(m); }
        else if (Math.abs(ny + ph - (cv.h - m)) < CROP_SNAP)     { ny = cv.h - m - ph; snapYs.push(cv.h - m); }

        // Canvas edge snaps (칼선 스냅 안 됐을 때만)
        if (!snapXs.length) {
          if      (Math.abs(nx) < SNAP)                        { nx = 0;              snapXs.push(0); }
          else if (Math.abs(nx + moving.w - cv.w) < SNAP)     { nx = cv.w - moving.w; snapXs.push(cv.w); }
        }
        if (!snapYs.length) {
          if      (Math.abs(ny) < SNAP)                        { ny = 0;              snapYs.push(0); }
          else if (Math.abs(ny + ph - cv.h) < SNAP)           { ny = cv.h - ph;      snapYs.push(cv.h); }
        }
        // Canvas center snaps
        const midX = cv.w / 2, midY = cv.h / 2;
        if (!snapXs.length && Math.abs(nx + moving.w / 2 - midX) < SNAP) { nx = midX - moving.w / 2; snapXs.push(midX); }
        if (!snapYs.length && Math.abs(ny + ph / 2 - midY) < SNAP)       { ny = midY - ph / 2; snapYs.push(midY); }

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

    const onUp = () => { dragRef.current = null; setSnapLines({ xs: [], ys: [] }); };
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
    const cx = (clientX - rect.left) / scale;
    const cy = (clientY - rect.top) / scale;

    // Resize handles of selected photo (corners + edges)
    if (selectedId !== null) {
      const sel = photos.find(p => p.id === selectedId);
      if (sel) {
        const ph = sel.h;
        const mx = sel.x + sel.w / 2, my = sel.y + ph / 2;
        const handles: { handle: Handle; x: number; y: number }[] = [
          { handle: "tl", x: sel.x,        y: sel.y      },
          { handle: "tr", x: sel.x + sel.w, y: sel.y      },
          { handle: "bl", x: sel.x,        y: sel.y + ph  },
          { handle: "br", x: sel.x + sel.w, y: sel.y + ph },
          { handle: "t",  x: mx,            y: sel.y      },
          { handle: "b",  x: mx,            y: sel.y + ph  },
          { handle: "l",  x: sel.x,        y: my          },
          { handle: "r",  x: sel.x + sel.w, y: my          },
        ];
        for (const { handle, x: hx, y: hy } of handles) {
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
  const statsFields   = selectedFields.filter(d => !["English Name","Korean Name","Instagram","Email","Phone"].includes(d.label));
  const contactFields = selectedFields.filter(d => ["Instagram","Email","Phone"].includes(d.label));
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

      {/* 2mm 칼선 (재단선) — 인쇄 시 재단될 영역 표시 */}
      {(() => {
        const mm2px = (w > h ? w / 297 : w / 210) * 2; // 2mm in canvas px
        return (
          <div className="crop-guide" style={{
            position: "absolute",
            top: mm2px,
            left: mm2px,
            width: w - mm2px * 2,
            height: h - mm2px * 2,
            border: "0.5px dashed rgba(180,0,0,0.5)",
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

      {/* Invisible hit-zone overlays for 4 corners */}
      {selectedId !== null && (() => {
        const sel = photos.find(p => p.id === selectedId);
        if (!sel) return null;
        const ph = Math.round(sel.w * (4/3));
        const corners = [
          { corner: "tl", left: sel.x - RESIZE_ZONE,          top: sel.y - RESIZE_ZONE,       cursor: "nwse-resize" },
          { corner: "tr", left: sel.x + sel.w - RESIZE_ZONE,  top: sel.y - RESIZE_ZONE,       cursor: "nesw-resize" },
          { corner: "bl", left: sel.x - RESIZE_ZONE,          top: sel.y + ph - RESIZE_ZONE,  cursor: "nesw-resize" },
          { corner: "br", left: sel.x + sel.w - RESIZE_ZONE,  top: sel.y + ph - RESIZE_ZONE,  cursor: "nwse-resize" },
        ] as const;
        return <>{corners.map(c => (
          <div key={c.corner} style={{ position: "absolute", left: c.left, top: c.top, width: RESIZE_ZONE * 2, height: RESIZE_ZONE * 2, zIndex: 15, cursor: c.cursor, pointerEvents: "none" }} />
        ))}</>;
      })()}

      {/* Text: English Name */}
      {nameField && nameBlock && (
        <TextElement block={nameBlock} onSize={handleTextSize} onMoveStart={(pos) => { dragRef.current = { type: "text-move", id: "name", mx: pos.clientX, my: pos.clientY, ox: nameBlock.x, oy: nameBlock.y }; }}>
          <span className="font-display" style={{ fontSize: nameBlock.fontSize, fontWeight, color: txtColor, display: "block", lineHeight: 1.1, whiteSpace: "nowrap" }}>{nameField.value}</span>
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
function PhotoPanel({ photos, setPhotos, onAdd, onRemove }: {
  photos: PhotoItem[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
  onAdd: () => void;
  onRemove: (id: number) => void;
}) {
  const handleFile = (id: number, file: File) => {
    const url = URL.createObjectURL(file);
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, src: url } : p));
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <p style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
          Photos <span style={{ color: "var(--text)" }}>{photos.length}</span>
        </p>
        {photos.length < 6 && (
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

  const sidebarW = 220;
  const popupW = 234;
  const fixedLeft = anchorRect ? Math.max(sidebarW + 12, anchorRect.right + 8) : sidebarW + 12;
  const fixedTop  = anchorRect ? Math.min(anchorRect.top, window.innerHeight - 420) : 100;

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

/* ─────────────────── controls panel ────────────────────────── */
const BG_PRESETS  = [{ v: "#FFFFFF", l: "White" }, { v: "#F8F7F4", l: "Warm" }, { v: "#F3F0EA", l: "Cream" }, { v: "#0C0C0C", l: "Black" }];
const TXT_PRESETS = [{ v: "#0A0A0A", l: "Black" }, { v: "#FFFFFF", l: "White" }, { v: "#888888", l: "Gray" }];
const WEIGHT_OPTS: { label: string; value: number }[] = [
  { label: "Light",   value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium",  value: 500 },
  { label: "Bold",    value: 700 },
];

function ControlsPanel({ canvas, bgColor, setBgColor, txtColor, setTxtColor, fontWeight, setFontWeight, photos, setPhotos, onAddPhoto, onRemovePhoto, textBlocks, setTextBlocks, statsLayout, setStatsLayout }: {
  canvas: CanvasType;
  bgColor: string;  setBgColor:  (c: string) => void;
  txtColor: string; setTxtColor: (c: string) => void;
  fontWeight: number; setFontWeight: (w: number) => void;
  photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
  onAddPhoto: () => void; onRemovePhoto: (id: number) => void;
  textBlocks: TextBlock[]; setTextBlocks: React.Dispatch<React.SetStateAction<TextBlock[]>>;
  statsLayout: "1단" | "2단"; setStatsLayout: (v: "1단" | "2단") => void;
}) {
  const isBgCustom  = !BG_PRESETS.some(o => o.v === bgColor);
  const isTxtCustom = !TXT_PRESETS.some(o => o.v === txtColor);

  const updateTextSize = (tag: string, delta: number) =>
    setTextBlocks(prev => prev.map(b => b.tag === tag ? { ...b, fontSize: Math.max(8, Math.min(60, b.fontSize + delta)) } : b));

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

      <PhotoPanel photos={photos} setPhotos={setPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />

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
        <p><strong style={{ color: "var(--text)" }}>우하단 파란 핸들</strong> 드래그 → 크기 (그리드 연동)</p>
        <p>텍스트 호버 후 드래그 → 이동</p>
      </div>
    </div>
  );
}

/* ─────────────────────── main page ──────────────────────────── */
function ComcardPageInner() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("id"); // 기존 카드 불러오기용

  const [step,         setStep]        = useState<"orient" | "fields" | "design">("orient");
  const [canvas,       setCanvas]      = useState<CanvasType>("portrait");
  const [enabledFields,setEnabledFields]= useState<string[]>(["engName","korName","height","chest","waist","hip","instagram"]);
  const [bgColor,      setBgColor]     = useState("#FFFFFF");
  const [txtColor,     setTxtColor]    = useState("#0A0A0A");
  const [fontWeight,   setFontWeight]  = useState(400);
  const [statsLayout,  setStatsLayout] = useState<"1단" | "2단">("2단");
  const [photos,       setPhotos]      = useState<PhotoItem[]>(() => getDefaultPhotos("portrait", 3));
  const [textBlocks,   setTextBlocks]  = useState<TextBlock[]>(() => getDefaultTextBlocks("portrait"));
  const nextIdRef       = useRef(3);
  const lastResizedWRef = useRef<number | null>(null);
  const canvasRef       = useRef<HTMLDivElement>(null);
  const mainAreaRef     = useRef<HTMLDivElement>(null);
  const editIdRef       = useRef<string | null>(editId); // 저장 시 update vs insert 판단용
  const [canvasScale,   setCanvasScale]  = useState(1);
  const [controlsOpen,  setControlsOpen] = useState(false);
  const [mobileTab,     setMobileTab]    = useState<"canvas" | "controls">("canvas");

  // 기존 카드 불러오기
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("comp_cards").select("*").eq("id", editId).single();
      if (!data) return;
      const d = data.data;
      setCanvas(data.canvas_type as CanvasType);
      if (d.bgColor)       setBgColor(d.bgColor);
      if (d.txtColor)      setTxtColor(d.txtColor);
      if (d.fontWeight)    setFontWeight(d.fontWeight);
      if (d.statsLayout)   setStatsLayout(d.statsLayout);
      if (d.enabledFields) setEnabledFields(d.enabledFields);
      if (d.photos)        setPhotos(d.photos.map((p: PhotoItem) => ({ ...p, h: p.h ?? Math.round(p.w * (4/3)) })));
      if (d.textBlocks)    setTextBlocks(d.textBlocks);
      if (d.photos)        nextIdRef.current = Math.max(...d.photos.map((p: PhotoItem) => p.id)) + 1;
      setStep("design");
    })();
  }, [editId]);

  const [cardSaving, setCardSaving] = useState(false);
  const [cardSaved,  setCardSaved]  = useState(false);

  const saveCard = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert("로그인이 필요합니다."); return; }
    setCardSaving(true);
    const cardData = { bgColor, txtColor, fontWeight, statsLayout, enabledFields, photos, textBlocks };
    if (editIdRef.current) {
      // 기존 카드 업데이트
      await supabase.from("comp_cards").update({ canvas_type: canvas, data: cardData, updated_at: new Date().toISOString() }).eq("id", editIdRef.current);
    } else {
      // 새 카드 저장
      const { data } = await supabase.from("comp_cards").insert({ user_id: user.id, title: "내 컴카드", canvas_type: canvas, data: cardData }).select("id").single();
      if (data) editIdRef.current = data.id; // 이후 저장은 update로
    }
    setCardSaving(false);
    setCardSaved(true);
    setTimeout(() => setCardSaved(false), 2500);
  };

  const saveImage = async () => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    el.style.overflow = "hidden";
    const { default: html2canvas } = await import("html2canvas");
    const c = await html2canvas(el, { useCORS: true, scale: 2, ignoreElements: (e) => e.classList.contains("crop-guide") });
    el.style.overflow = "visible";
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "myfolio-comcard.png";
    a.click();
  };

  const downloadPDF = async () => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    el.style.overflow = "hidden";
    const { default: html2canvas } = await import("html2canvas");
    const { default: jsPDF } = await import("jspdf");
    const c = await html2canvas(el, { useCORS: true, scale: 2, ignoreElements: (e) => e.classList.contains("crop-guide") });
    const imgData = c.toDataURL("image/png");
    const { w, h } = CANVAS[canvas];
    const orientation = w > h ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, "PNG", 0, 0, pw, ph);
    pdf.save("myfolio-comcard.pdf");
    el.style.overflow = "visible";
  };

  const addPhoto = useCallback(() => {
    setPhotos(prev => {
      if (prev.length >= 6) return prev;
      // Use last manually resized width, else match last photo, else default
      const baseW = lastResizedWRef.current ?? prev[prev.length - 1]?.w ?? prev[0]?.w ?? 160;
      const last  = prev[prev.length - 1];
      const x = last ? Math.min(last.x + last.w + 8, 320) : 16;
      const y = last ? last.y : 16;
      const id = nextIdRef.current++;
      return [...prev, { id, src: null, x, y, w: baseW, h: Math.round(baseW * (4/3)) }];
    });
  }, []);

  const removePhoto = useCallback((id: number) => {
    setPhotos(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev);
  }, []);

  const toggleField = (key: string) =>
    setEnabledFields(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);

  const selectedData = profileFields
    .filter(f => f.always || enabledFields.includes(f.key))
    .map(f => ({ label: f.label, value: mockProfile[f.key] }));

  const chooseCanvas = (type: CanvasType) => {
    setCanvas(type);
    setPhotos(prev => { const base = getDefaultPhotos(type, prev.length); return base.map((b, i) => ({ ...b, src: prev[i]?.src ?? null })); });
    setTextBlocks(getDefaultTextBlocks(type));
  };

  const { w, h } = CANVAS[canvas];

  // 모바일에서 캔버스를 화면에 맞게 축소 — step이 "design"으로 바뀔 때 재계산
  useEffect(() => {
    if (step !== "design") return;
    const update = () => {
      const el = mainAreaRef.current;
      if (!el) return;
      const padding = window.innerWidth <= 768 ? 32 : 48;
      const available = el.clientWidth - padding;
      setCanvasScale(Math.min(1, available / w));
    };
    // ref가 DOM에 붙은 후 실행되도록 setTimeout 0
    const t = setTimeout(update, 0);
    window.addEventListener("resize", update);
    return () => { clearTimeout(t); window.removeEventListener("resize", update); };
  }, [w, step]);

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
            <button onClick={() => setStep("fields")} style={{ width: "100%", background: "var(--text)", color: "#fff", border: "none", padding: "16px", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>Next →</button>
          </div>
        )}

        {/* ── Step: Fields ── */}
        {step === "fields" && (
          <div style={{ maxWidth: "640px", margin: "0 auto", padding: "60px 24px 80px" }}>
            <h1 className="font-display" style={{ fontSize: "44px", fontWeight: 400, marginBottom: "12px" }}>Select Fields</h1>
            <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "32px" }}>컴카드에 표시할 항목을 선택하세요.</p>
            <div style={{ border: "1px solid var(--border)", marginBottom: "28px" }}>
              {profileFields.map(f => (
                <div key={f.key} onClick={() => !f.always && toggleField(f.key)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid var(--border)", background: (f.always || enabledFields.includes(f.key)) ? "var(--surface)" : "#fff", cursor: f.always ? "default" : "pointer" }}>
                  <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                    <div style={{ width: "15px", height: "15px", border: "1px solid var(--border)", flexShrink: 0, background: (f.always || enabledFields.includes(f.key)) ? "var(--text)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {(f.always || enabledFields.includes(f.key)) && <span style={{ color: "#fff", fontSize: "9px" }}>✓</span>}
                    </div>
                    <span style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", minWidth: "90px" }}>{f.label}</span>
                    <span style={{ fontSize: "13px", color: "var(--text)" }}>{mockProfile[f.key]}</span>
                  </div>
                  {f.always && <span style={{ fontSize: "10px", color: "var(--muted)" }}>Always</span>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setStep("orient")} style={{ flex: 1, background: "#fff", color: "var(--text)", border: "1px solid var(--border)", padding: "15px", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>← Back</button>
              <button onClick={() => { chooseCanvas(canvas); setStep("design"); }} style={{ flex: 2, background: "var(--text)", color: "#fff", border: "none", padding: "15px", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>Design →</button>
            </div>
          </div>
        )}

        {/* ── Step: Design ── */}
        {step === "design" && (
          <div className={`comcard-design-layout comcard-tab-${mobileTab}`}>
            {/* 모바일 탭바 */}
            <div className="comcard-mobile-tabs">
              <button className={mobileTab === "canvas" ? "active" : ""} onClick={() => setMobileTab("canvas")}>Canvas</button>
              <button className={mobileTab === "controls" ? "active" : ""} onClick={() => setMobileTab("controls")}>Controls</button>
            </div>
            {/* 캔버스 영역 */}
            <main ref={mainAreaRef} className="comcard-canvas-main" style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "40px 24px 60px", overflow: "auto", background: "#EBEBEB" }}>
              <CanvasEditor
                canvas={canvas} bgColor={bgColor} txtColor={txtColor} fontWeight={fontWeight}
                photos={photos} setPhotos={setPhotos}
                textBlocks={textBlocks} setTextBlocks={setTextBlocks}
                selectedFields={selectedData} statsLayout={statsLayout}
                onPhotoResize={(canvasW) => { lastResizedWRef.current = canvasW; }}
                canvasRef={canvasRef}
                scale={canvasScale}
              />
              <div style={{ display: "flex", gap: "10px", marginTop: "24px", width: w * canvasScale, flexWrap: "wrap" }}>
                <button onClick={saveCard} disabled={cardSaving} style={{ flex: 1, minWidth: "120px", background: "#fff", color: "var(--text)", border: "1px solid var(--border)", padding: "13px", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
                  {cardSaved ? "저장됨 ✓" : cardSaving ? "저장 중..." : "마이페이지에 저장"}
                </button>
                <button onClick={saveImage} style={{ flex: 1, minWidth: "100px", background: "#fff", color: "var(--text)", border: "1px solid var(--border)", padding: "13px", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>Save Image</button>
                <button onClick={downloadPDF} style={{ flex: 1, minWidth: "120px", background: "var(--text)", color: "#fff", border: "none", padding: "13px", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>Download PDF</button>
              </div>
            </main>
            {/* 컨트롤 사이드바 (데스크탑: 좌측 / 모바일: 캔버스 아래 full-width) */}
            <aside className="comcard-sidebar">
              <div style={{ marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={() => setStep("fields")} style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", border: "none", background: "none", color: "var(--muted)", cursor: "pointer" }}>← Back</button>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>{CANVAS[canvas].label}</span>
              </div>
              <ControlsPanel
                canvas={canvas}
                bgColor={bgColor}   setBgColor={setBgColor}
                txtColor={txtColor} setTxtColor={setTxtColor}
                fontWeight={fontWeight} setFontWeight={setFontWeight}
                photos={photos}     setPhotos={setPhotos}
                onAddPhoto={addPhoto} onRemovePhoto={removePhoto}
                textBlocks={textBlocks} setTextBlocks={setTextBlocks}
                statsLayout={statsLayout} setStatsLayout={setStatsLayout}
              />
            </aside>
          </div>
        )}
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
