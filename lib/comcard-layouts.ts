/**
 * 컴카드 레이아웃 프리셋.
 * 업계 표준 컴카드 양식(에이전시 가이드·유럽 제드카드 등)을 조사해 만든 7가지 구성.
 * 프리셋은 "구성 + 기본 스타일"만 정하고, 실제 좌표는 여기서 계산해
 * 사진 수·캔버스 방향이 달라도 항상 캔버스 안에 깔끔하게 들어가도록 한다.
 */

/** 컴카드 항목 분류 — 편집기·미리보기·공유 카드·레이아웃 계산이 모두 같은 기준을 쓰도록 한곳에 */
export const NAME_LABELS = ["English Name", "Korean Name"];
export const CONTACT_LABELS = ["Instagram", "Email", "Phone"];
export const isContactField = (label: string) => CONTACT_LABELS.includes(label);
/** 이름·연락처가 아닌 나머지 = 신체 정보(스탯) */
export const isStatsField = (label: string) => !NAME_LABELS.includes(label) && !CONTACT_LABELS.includes(label);

export const LAYOUT_TEMPLATES = ["classic", "sidename", "cover", "zed", "showcase", "minimal", "editorial"] as const;
export type LayoutTemplate = (typeof LAYOUT_TEMPLATES)[number];

export type CanvasKind = "portrait" | "landscape";
export type StatsLayout = "1단" | "2단";

export type Preset = {
  id: LayoutTemplate;
  name: string;
  description: string;   // 사용자에게 보여줄 한 줄 설명
  basis: string;         // 근거가 된 업계 양식
  aiHint: string;        // AI가 고를 때 참고할 설명
  /** 쓸 수 있는 캔버스 방향 */
  orientations: CanvasKind[];
  /** 보조 사진이 이보다 작아지면(캔버스 px) 그 장수에서는 쓰지 않음 — 기본 80px ≈ A4에서 3.5cm */
  minThumbW?: number;
  style: { bgColor: string; txtColor: string; fontWeight: number; nameSize: number; nameCaps: boolean; statsLayout: StatsLayout };
};

export const PRESETS: Preset[] = [
  {
    id: "classic", name: "클래식 에이전시",
    description: "큰 헤드샷 + 아래 작은 사진 한 줄 + 하단 이름·정보",
    basis: "에이전시 표준 (대표 사진 + 보조 컷 스트립)",
    aiHint: "가장 무난한 표준형. 얼굴이 잘 나온 대표 헤드샷이 있고 보조 컷이 2~4장일 때.",
    orientations: ["portrait", "landscape"],
    style: { bgColor: "#FFFFFF", txtColor: "#0A0A0A", fontWeight: 400, nameSize: 26, nameCaps: true, statsLayout: "1단" },
  },
  {
    id: "sidename", name: "4컷 그리드 + 사이드 네임",
    description: "같은 크기 사진 2×2 + 옆에 이름 블록",
    basis: "균등 4패널 컴포지트",
    aiHint: "사진 4장이 고르게 좋고, 어느 한 장을 메인으로 강조할 필요가 없을 때.",
    orientations: ["landscape"],
    style: { bgColor: "#FFFFFF", txtColor: "#0A0A0A", fontWeight: 500, nameSize: 22, nameCaps: true, statsLayout: "2단" },
  },
  {
    id: "cover", name: "풀블리드 커버",
    description: "대표 사진을 꽉 채우고 이름을 사진 위에, 나머지는 작게",
    basis: "컴카드 앞면 (풀블리드 히어로 + 이름)",
    aiHint: "아주 강한 대표 사진 한 장이 있을 때. 이름이 사진 위에 올라가므로 글자색은 사진 위에서 잘 보이는 색(보통 흰색)으로.",
    orientations: ["portrait"], minThumbW: 60,
    style: { bgColor: "#0C0C0C", txtColor: "#FFFFFF", fontWeight: 500, nameSize: 34, nameCaps: true, statsLayout: "1단" },
  },
  {
    id: "zed", name: "유럽 제드카드",
    description: "왼쪽 큰 헤드샷 + 오른쪽 2×2 + 하단 정보 띠",
    basis: "유럽 A5 제드카드(Sedcard) 뒷면",
    aiHint: "가로형에 가장 잘 맞음. 헤드샷 1장 + 다양한 룩 4장 정도로 범위를 보여줄 때.",
    orientations: ["landscape"],
    style: { bgColor: "#F8F7F4", txtColor: "#0A0A0A", fontWeight: 400, nameSize: 22, nameCaps: true, statsLayout: "1단" },
  },
  {
    id: "showcase", name: "레인지 쇼케이스",
    description: "이름을 위에 두고 다양한 룩 4장을 크게",
    basis: "다양한 룩(비즈니스·피트니스·커머셜 등)을 보여주는 뒷면",
    aiHint: "서로 다른 분위기의 룩이 여러 장 있어 다재다능함을 보여주고 싶을 때.",
    orientations: ["portrait", "landscape"],
    style: { bgColor: "#FFFFFF", txtColor: "#0A0A0A", fontWeight: 700, nameSize: 28, nameCaps: true, statsLayout: "1단" },
  },
  {
    id: "minimal", name: "미니멀",
    description: "넉넉한 여백, 작은 사진, 가는 글씨",
    basis: "미니멀 컴카드 템플릿 스타일",
    aiHint: "하이패션·에디토리얼 모델, 차분하고 고급스러운 인상을 줄 때. 사진 수가 적을수록 잘 어울림.",
    orientations: ["portrait", "landscape"],
    style: { bgColor: "#F3F0EA", txtColor: "#0A0A0A", fontWeight: 300, nameSize: 20, nameCaps: false, statsLayout: "1단" },
  },
  {
    id: "editorial", name: "에디토리얼",
    description: "비대칭 구성, 큰 메인 + 세로 열, 큰 이름",
    basis: "매거진 스프레드 스타일",
    aiHint: "개성 있고 패션 지향적인 분위기. 메인 사진이 강하고 보조 컷이 세로로 잘 어울릴 때.",
    orientations: ["portrait", "landscape"],
    style: { bgColor: "#FFFFFF", txtColor: "#0A0A0A", fontWeight: 400, nameSize: 32, nameCaps: false, statsLayout: "2단" },
  },
];

/** 기본 최소 보조 사진 폭 (캔버스 480px = A4 210mm 기준 80px ≈ 3.5cm) */
const MIN_THUMB_W = 80;
export const SUPPORTED_COUNTS = [3, 4, 5, 6] as const;

export type PresetOption = { preset: Preset; fits: boolean; minThumb: number };

/**
 * 방향 × 사진 장수에 맞는 양식 목록 (템플릿 화면·편집기·AI 추천이 모두 이 기준을 씀).
 * - 방향이 맞지 않는 양식은 빼고
 * - 보조 사진이 너무 작아지는 장수면 fits=false (목록 뒤쪽, "사진이 작아요" 안내)
 */
export function presetOptions(canvas: CanvasKind, count: number): PresetOption[] {
  const n = Math.max(1, count);
  return PRESETS.filter(p => p.orientations.includes(canvas)).map(p => {
    const L = buildLayout(canvas, p.id, n, p.style.nameSize, 12, p.style.statsLayout, 6);
    const thumbs = L.photos.slice(1).map(x => x.w);
    const minThumb = thumbs.length ? Math.min(...thumbs) : L.photos[0].w;
    return { preset: p, minThumb, fits: minThumb >= (p.minThumbW ?? MIN_THUMB_W) };
  }).sort((a, b) => Number(b.fits) - Number(a.fits));
}

/** 이 조합에서 바로 쓸 수 있는 양식만 */
export const availablePresets = (canvas: CanvasKind, count: number) =>
  presetOptions(canvas, count).filter(o => o.fits).map(o => o.preset);

export const PRESET_BY_ID: Record<LayoutTemplate, Preset> =
  Object.fromEntries(PRESETS.map(p => [p.id, p])) as Record<LayoutTemplate, Preset>;

type Rect = { x: number; y: number; w: number; h: number };
export type LayoutPhoto = { x: number; y: number; w: number; h: number };
export type LayoutText = { id: string; tag: "name" | "korName" | "stats" | "contact"; x: number; y: number; fontSize: number };

const SIZE: Record<CanvasKind, { w: number; h: number }> = {
  portrait:  { w: 480, h: 680 },
  landscape: { w: 680, h: 480 },
};
const GAP = 4;
const M = 16;        // 기본 바깥 여백
const RATIO = 4 / 3; // 사진 세로/가로 비율

/** rect 안에 n장을 3:4 칸으로 가장 크게 배치 (가로 가운데, 세로는 가운데 또는 위쪽) */
function gridIn(rect: Rect, n: number, alignTop = false, maxCols = n): LayoutPhoto[] {
  if (n <= 0) return [];
  let best = { cols: 1, rows: n, cellW: 0 };
  for (let cols = 1; cols <= Math.min(n, maxCols); cols++) {
    const rows = Math.ceil(n / cols);
    const cellW = Math.min(
      (rect.w - GAP * (cols - 1)) / cols,
      (rect.h - GAP * (rows - 1)) / rows / RATIO,
    );
    if (cellW > best.cellW) best = { cols, rows, cellW };
  }
  const cellW = Math.max(20, Math.floor(best.cellW));
  const cellH = Math.round(cellW * RATIO);
  const totalW = best.cols * cellW + (best.cols - 1) * GAP;
  const totalH = best.rows * cellH + (best.rows - 1) * GAP;
  const sx = rect.x + Math.floor((rect.w - totalW) / 2);
  const sy = alignTop ? rect.y : rect.y + Math.floor((rect.h - totalH) / 2);
  return Array.from({ length: n }, (_, i) => ({
    x: sx + (i % best.cols) * (cellW + GAP),
    y: sy + Math.floor(i / best.cols) * (cellH + GAP),
    w: cellW, h: cellH,
  }));
}

/** rect 안에 들어가는 가장 큰 3:4 한 칸 */
function fitOne(rect: Rect, alignTop = false, alignLeft = false): LayoutPhoto {
  const w = Math.floor(Math.min(rect.w, rect.h / RATIO));
  const h = Math.round(w * RATIO);
  return {
    x: alignLeft ? rect.x : rect.x + Math.floor((rect.w - w) / 2),
    y: alignTop ? rect.y : rect.y + Math.floor((rect.h - h) / 2),
    w, h,
  };
}

const STAT_CELL_W = 58;  // 스탯 한 칸(라벨 + 값) 폭 여유
const STAT_ROW_H = 28;   // 스탯 한 줄 높이
const CONTACT_W = 150;   // 연락처 블록 폭
const CONTACT_H = 48;    // 연락처 3줄 높이

/** 이번 레이아웃의 스탯 정보 (buildLayout 시작 시 설정) */
let SPEC: { statsLayout: StatsLayout; statsCount: number } = { statsLayout: "1단", statsCount: 6 };

/** 이름 글자 크기 — 요청 크기와 폭에 맞는 크기 중 작은 값 (대문자 세리프 기준 글자폭 0.72em) */
function fitNameSize(requested: number, width: number, nameLength: number): number {
  return Math.max(12, Math.min(requested, Math.floor(width / (0.72 * Math.max(1, nameLength)))));
}

/** 폭에 맞는 스탯 구성 (1단이 안 들어가면 2단으로) + 연락처를 옆에 둘 수 있는지 */
function statsGeometry(width: number) {
  const n = Math.max(1, SPEC.statsCount);
  let layout: StatsLayout = SPEC.statsLayout;
  if (layout === "1단" && n * STAT_CELL_W > width) layout = "2단";
  const cols = layout === "1단" ? n : Math.ceil(n / 2);
  const rows = layout === "1단" ? 1 : 2;
  const w = cols * STAT_CELL_W;
  const h = rows * STAT_ROW_H + (rows - 1) * 6;
  const contactRight = width >= w + CONTACT_W + 16;
  return { layout, w, h, contactRight };
}

/** 텍스트 묶음이 차지하는 높이 */
function textHeight(nameSize: number, width: number): number {
  const kor = Math.max(10, Math.round(nameSize * 0.55));
  const head = Math.round(nameSize * 1.15) + 2 + kor + 8;
  const g = statsGeometry(width);
  return head + (g.contactRight ? Math.max(g.h, CONTACT_H) : g.h + 10 + CONTACT_H);
}

/** 이번 레이아웃에서 실제로 쓴 스탯 구성 (가장 최근 placeText 기준) */
let USED_STATS: StatsLayout = "1단";

/** 텍스트 영역 안에 이름 / 한글 이름 / 스탯 / 연락처 배치 */
function placeText(rect: Rect, nameSize: number): LayoutText[] {
  const kor = Math.max(10, Math.round(nameSize * 0.55));
  const yName = rect.y;
  const yKor = yName + Math.round(nameSize * 1.15) + 2;
  const yStats = yKor + kor + 8;
  const g = statsGeometry(rect.w);
  USED_STATS = g.layout;
  return [
    { id: "name",    tag: "name",    x: rect.x, y: yName,  fontSize: nameSize },
    { id: "korName", tag: "korName", x: rect.x, y: yKor,   fontSize: kor },
    { id: "stats",   tag: "stats",   x: rect.x, y: yStats, fontSize: 11 },
    g.contactRight
      ? { id: "contact", tag: "contact", x: rect.x + rect.w - CONTACT_W, y: yStats, fontSize: 10 }
      : { id: "contact", tag: "contact", x: rect.x, y: yStats + g.h + 10, fontSize: 10 },
  ];
}

/** 텍스트를 영역 맨 아래에 붙여 배치 (폭에 맞게 이름 크기 조정) */
function textAtBottom(x: number, w: number, bottom: number, size: number, nameLen: number) {
  const s = fitNameSize(size, w, nameLen);
  const h = textHeight(s, w);
  return { y: bottom - h, h, blocks: placeText({ x, y: bottom - h, w, h }, s) };
}

/**
 * 프리셋 구성으로 사진 count장 + 텍스트 위치 계산.
 * 반환되는 photos[0]이 메인 사진 자리.
 */
export function buildLayout(
  canvas: CanvasKind, template: LayoutTemplate, count: number, nameSize = 22, nameLen = 12,
  statsLayout: StatsLayout = "1단", statsCount = 6,
): { photos: LayoutPhoto[]; textBlocks: LayoutText[]; statsLayout: StatsLayout } {
  SPEC = { statsLayout, statsCount };
  const result = layoutFor(canvas, template, count, nameSize, nameLen);
  return { ...result, statsLayout: USED_STATS };
}

function layoutFor(canvas: CanvasKind, template: LayoutTemplate, count: number, nameSize: number, nameLen: number): { photos: LayoutPhoto[]; textBlocks: LayoutText[] } {
  const { w: W, h: H } = SIZE[canvas];
  const size = Math.max(14, Math.min(44, Math.round(nameSize)));
  const n = Math.max(1, count);
  const portrait = canvas === "portrait";

  switch (template) {
    /* 큰 헤드샷 + 아래(세로형) / 옆(가로형) 보조 컷 + 이름·정보 */
    case "classic": {
      if (portrait) {
        const t = textAtBottom(M + 4, W - 2 * M - 8, H - M, size, nameLen);
        const areaH = t.y - M - 10;
        const mainH = n === 1 ? areaH : Math.round(areaH * 0.7);
        const main = fitOne({ x: M, y: M, w: W - 2 * M, h: mainH }, true);
        const rest = gridIn({ x: M, y: main.y + main.h + GAP, w: W - 2 * M, h: areaH - main.h - GAP }, n - 1, true);
        return { photos: [main, ...rest], textBlocks: t.blocks };
      }
      const main = fitOne({ x: M, y: M, w: (W - 2 * M) * 0.42, h: H - 2 * M });
      const rx = main.x + main.w + GAP * 3;
      const t = textAtBottom(rx + 4, W - M - rx - 8, H - M, size, nameLen);
      const rest = gridIn({ x: rx, y: M, w: W - M - rx, h: t.y - M - 10 }, n - 1);
      return { photos: [main, ...rest], textBlocks: t.blocks };
    }

    /* 균등 그리드(최대 2열) + 옆 이름 열 */
    case "sidename": {
      const textW = portrait ? 170 : 210;
      // 스탯이 옆 열에 안 들어가면(항목이 아주 많을 때) 텍스트를 아래 전체 폭으로 내림
      if (Math.ceil(Math.max(1, SPEC.statsCount) / 2) * STAT_CELL_W > textW) {
        const t = textAtBottom(M + 4, W - 2 * M - 8, H - M, size, nameLen);
        const photos = gridIn({ x: M, y: M, w: W - 2 * M, h: t.y - M - 12 }, n, true, 2);
        return { photos, textBlocks: t.blocks };
      }
      const gridArea = { x: M, y: M, w: W - 2 * M - textW - 12, h: H - 2 * M };
      const photos = gridIn(gridArea, n, false, 2);
      const tx = W - M - textW;
      const s = fitNameSize(size, textW, nameLen);
      const blocks = placeText({ x: tx, y: M + 8, w: textW, h: textHeight(s, textW) }, s);
      return { photos, textBlocks: blocks };
    }

    /* 대표 사진을 위쪽/왼쪽에 꽉 채우고, 이름은 사진 위 아래쪽에 얹음 */
    case "cover": {
      if (portrait) {
        const main = fitOne({ x: 0, y: 0, w: W, h: H }, true); // 480 x 640, 위쪽 기준
        const restRow = n > 1 ? { x: Math.round(W * 0.55), y: main.h - 12 - 110, w: Math.round(W * 0.45) - 12, h: 110 } : null;
        const rest = restRow ? gridIn(restRow, n - 1, false) : [];
        const t = textAtBottom(M + 4, Math.round(W * 0.5) - M, main.h - 12, size, nameLen);
        return { photos: [main, ...rest], textBlocks: t.blocks };
      }
      const main = fitOne({ x: 0, y: 0, w: W, h: H }, true, true); // 360 x 480, 왼쪽 기준
      const rx = main.w + 12;
      const rest = gridIn({ x: rx, y: M, w: W - M - rx, h: H - 2 * M }, n - 1);
      const t = textAtBottom(M + 4, main.w - 2 * M, H - M, size, nameLen);
      return { photos: [main, ...rest], textBlocks: t.blocks };
    }

    /* 왼쪽 큰 헤드샷 + 오른쪽 보조 컷 + 하단 전체 폭 정보 띠 */
    case "zed": {
      const t = textAtBottom(M + 4, W - 2 * M - 8, H - M, size, nameLen);
      const areaH = t.y - M - 10;
      const main = fitOne({ x: M, y: M, w: (W - 2 * M) * (portrait ? 0.55 : 0.4), h: areaH }, true, true);
      const rx = main.x + main.w + GAP * 2;
      const rest = gridIn({ x: rx, y: M, w: W - M - rx, h: main.h }, n - 1, true, 2);
      // 세로형은 사진 바로 아래에 정보 띠를 붙임 (아래쪽 빈 공간 방지)
      if (portrait) {
        const s2 = fitNameSize(size, W - 2 * M - 8, nameLen);
        const y = main.y + main.h + 20;
        return { photos: [main, ...rest], textBlocks: placeText({ x: M + 4, y, w: W - 2 * M - 8, h: textHeight(s2, W - 2 * M - 8) }, s2) };
      }
      return { photos: [main, ...rest], textBlocks: t.blocks };
    }

    /* 위쪽 이름 헤더 + 아래 같은 크기 룩들 */
    case "showcase": {
      const s = fitNameSize(size, W - 2 * M - 8, nameLen);
      const headH = textHeight(s, W - 2 * M - 8);
      const blocks = placeText({ x: M + 4, y: M + 4, w: W - 2 * M - 8, h: headH }, s);
      const photos = gridIn({ x: M, y: M + headH + 12, w: W - 2 * M, h: H - 2 * M - headH - 12 }, n, true);
      return { photos, textBlocks: blocks };
    }

    /* 넓은 여백 안에 작은 사진, 그 아래 텍스트 */
    case "minimal": {
      const MM = portrait ? 48 : 40;
      const t = textAtBottom(MM, W - 2 * MM, H - MM, size, nameLen);
      const photos = gridIn({ x: MM, y: MM, w: W - 2 * MM, h: t.y - MM - 24 }, n);
      return { photos, textBlocks: t.blocks };
    }

    /* 비대칭: 큰 메인 + 세로 열(세로형) / 위 한 줄(가로형) */
    case "editorial":
    default: {
      if (portrait) {
        const t = textAtBottom(M + 4, W - 2 * M - 8, H - M, size, nameLen);
        const areaH = t.y - M - 10;
        const mainW = n === 1 ? W - 2 * M : Math.round((W - 2 * M) * 0.7);
        const main = fitOne({ x: M, y: M, w: mainW, h: areaH }, true, true);
        const rx = main.x + main.w + GAP;
        const rest = gridIn({ x: rx, y: M, w: W - M - rx, h: main.h }, n - 1);
        return { photos: [main, ...rest], textBlocks: t.blocks };
      }
      const main = fitOne({ x: M, y: M, w: (W - 2 * M) * 0.45, h: H - 2 * M }, true);
      const rx = main.x + main.w + 20;
      const rw = W - M - rx;
      const t = textAtBottom(rx, rw, H - M, size, nameLen);
      const rowH = Math.min(Math.round((H - 2 * M) * 0.42), t.y - M - 16);
      const rest = gridIn({ x: rx, y: M, w: rw, h: rowH }, n - 1, true);
      return { photos: [main, ...rest], textBlocks: t.blocks };
    }
  }
}

/** AI가 준 사진 순서가 올바른 순열인지 확인, 아니면 원래 순서 */
export function safeOrder(order: number[] | undefined, count: number): number[] {
  const identity = Array.from({ length: count }, (_, i) => i);
  if (!order || order.length !== count) return identity;
  const seen = new Set(order);
  if (seen.size !== count || order.some(i => !Number.isInteger(i) || i < 0 || i >= count)) return identity;
  return order;
}
