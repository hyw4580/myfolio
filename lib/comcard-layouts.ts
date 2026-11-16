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
    // 사진 칸이 너무 납작하거나 길쭉하면(자연스러운 사진 비율이 안 나오면) 이 조합엔 안 맞는 양식
    const shapesOk = L.photos.every((x, i) => (p.id === "cover" && i === 0) || (x.h / x.w >= MIN_R - 0.01 && x.h / x.w <= MAX_R + 0.01));
    // 사진이 카드를 너무 적게 채우면(빈 공간이 큼) 이 조합엔 안 맞는 양식 — 미니멀은 여백이 특징이라 기준을 낮춤
    const { w: CWd, h: CHd } = SIZE[canvas];
    const coverage = L.photos.reduce((acc, x) => acc + x.w * x.h, 0) / (CWd * CHd);
    const coverageOk = coverage >= (p.id === "minimal" ? 0.3 : 0.4);
    return { preset: p, minThumb, fits: minThumb >= (p.minThumbW ?? MIN_THUMB_W) && shapesOk && coverageOk };
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
/*
 * 레이아웃 공통 규칙 (모든 양식)
 * 1) 콘텐츠 영역 하나: 사진과 글자의 왼쪽·오른쪽 끝선을 같은 여백(M)에 맞춤
 * 2) 빈 칸 없음: 사진 묶음은 영역 폭을 끝까지 채움 (마지막 줄이 적으면 그 줄 칸을 넓힘)
 * 3) 칸 비율(세로/가로)은 MIN_R~MAX_R 안에서 조정, 사진은 칸에 꽉 채워 잘림(얼굴 쪽 기준)
 * 4) 메인 사진은 영역 왼쪽·위에 붙이고, 옆·아래 사진 묶음과 끝선(높이·폭)을 맞춤
 * 5) 간격 고정: 사진 사이 GAP, 사진과 글자 사이 TEXT_GAP, 열 사이 COL_GAP
 */
const GAP = 4;
const M = 16;          // 바깥 여백 = 콘텐츠 영역 끝선
const TEXT_GAP = 14;   // 사진 묶음과 글자 사이
const COL_GAP = 12;    // 메인 사진과 옆 열 사이
const RATIO = 4 / 3;   // 기본 사진 비율 (세로/가로)
const MIN_R = 0.72;    // 가장 납작한 칸
const MAX_R = 1.5;     // 가장 길쭉한 칸

/** 비율이 범위를 벗어난 만큼 점수를 깎음 */
const ratioPenalty = (r: number) => (r < MIN_R ? 0.01 * (r / MIN_R) : r > MAX_R ? (MAX_R / r) ** 2 : 1); // 너무 납작한 칸은 거의 고르지 않음

/**
 * rect를 n장으로 빈틈없이 채우는 격자 — 줄마다 칸이 rect 폭 끝까지 늘어남.
 * 열 수는 "가장 작은 칸이 가장 크고 비율이 자연스러운" 쪽으로 고름.
 * 칸이 너무 길쭉해지면 높이를 줄이고 위쪽에 붙임(폭 끝선은 유지).
 */
function gridIn(rect: Rect, n: number, alignTop = true, maxCols = n): LayoutPhoto[] {
  if (n <= 0) return [];
  let best: { counts: number[]; score: number } | null = null;
  for (let cols = 1; cols <= Math.min(n, maxCols); cols++) {
    const rows = Math.ceil(n / cols);
    // 줄마다 칸 수를 고르게 (앞줄부터 하나씩 더)
    const counts = Array.from({ length: rows }, (_, i) => Math.floor(n / rows) + (i < n % rows ? 1 : 0));
    const ws = counts.map(k => (rect.w - GAP * (k - 1)) / k);
    // 실제 줄 높이(가장 좁은 칸이 너무 길쭉해지지 않게 자른 값)로 평가
    const rowH = Math.min((rect.h - GAP * (rows - 1)) / rows, Math.min(...ws) * MAX_R);
    const fill = (rows * rowH + GAP * (rows - 1)) / rect.h; // 영역을 얼마나 채우는지
    let score = Infinity;
    for (const w of ws) score = Math.min(score, w * rowH * ratioPenalty(rowH / w));
    score *= Math.sqrt(fill);
    if (!best || score > best.score) best = { counts, score };
  }
  const counts = best!.counts;
  const rows = counts.length;
  const widths = counts.map(k => (rect.w - GAP * (k - 1)) / k);
  // 줄 높이: 영역을 나눈 값, 단 가장 좁은 칸이 MAX_R보다 길쭉해지지 않게
  const rowH = Math.floor(Math.min((rect.h - GAP * (rows - 1)) / rows, Math.min(...widths) * MAX_R));
  const totalH = rows * rowH + GAP * (rows - 1);
  let y = alignTop ? rect.y : rect.y + Math.floor((rect.h - totalH) / 2);
  const out: LayoutPhoto[] = [];
  counts.forEach(k => {
    // 마지막 칸이 정확히 오른쪽 끝선에 닿도록 정수 폭 분배
    for (let j = 0; j < k; j++) {
      const x0 = rect.x + Math.round(j * (rect.w + GAP) / k);
      const x1 = rect.x + Math.round((j + 1) * (rect.w + GAP) / k) - GAP;
      out.push({ x: x0, y, w: x1 - x0, h: rowH });
    }
    y += rowH + GAP;
  });
  return out;
}

/** 메인 사진: 영역 왼쪽·위에 붙여 폭을 채움, 비율이 범위를 벗어나면 높이(길면)나 폭(납작하면)을 줄임 */
function fitOne(rect: Rect): LayoutPhoto {
  let w = Math.floor(rect.w);
  const h = Math.floor(Math.min(rect.h, w * MAX_R));
  if (h < w * MIN_R) w = Math.floor(h / MIN_R);
  return { x: Math.round(rect.x), y: Math.round(rect.y), w, h };
}
/** 옆 열이 메인보다 짧게 끝나면 메인 높이를 옆 열에 맞춤 (메인 비율이 범위 안일 때만) */
function matchHeight(main: LayoutPhoto, rest: LayoutPhoto[]): LayoutPhoto {
  if (!rest.length) return main;
  const rb = Math.max(...rest.map(p => p.y + p.h));
  const h = rb - main.y;
  return h < main.h && h / main.w >= MIN_R ? { ...main, h } : main;
}
const right = (p: LayoutPhoto) => p.x + p.w;
const bottom = (p: LayoutPhoto) => p.y + p.h;

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
  const CW = W - 2 * M;      // 콘텐츠 폭
  const CH = H - 2 * M;      // 콘텐츠 높이

  switch (template) {
    /* 큰 헤드샷 + 아래(세로형) / 옆(가로형) 보조 컷 + 이름·정보 */
    case "classic": {
      if (portrait) {
        const t = textAtBottom(M, CW, H - M, size, nameLen);
        const area = { x: M, y: M, w: CW, h: t.y - TEXT_GAP - M };
        if (n === 1) return { photos: [fitOne(area)], textBlocks: t.blocks };
        const main = fitOne({ ...area, h: Math.round(area.h * 0.66) });
        const rest = gridIn({ x: M, y: bottom(main) + GAP, w: CW, h: area.y + area.h - bottom(main) - GAP }, n - 1, true);
        return { photos: [main, ...rest], textBlocks: t.blocks };
      }
      const main = fitOne({ x: M, y: M, w: Math.round(CH / 1.4), h: CH });
      const rx = right(main) + COL_GAP;
      const t = textAtBottom(rx, W - M - rx, H - M, size, nameLen);
      const rest = gridIn({ x: rx, y: M, w: W - M - rx, h: t.y - TEXT_GAP - M }, n - 1, true);
      return { photos: [main, ...rest], textBlocks: t.blocks };
    }

    /* 균등 그리드(최대 2열) + 옆 이름 열 */
    case "sidename": {
      const textW = portrait ? 170 : 210;
      // 스탯이 옆 열에 안 들어가면(항목이 아주 많을 때) 텍스트를 아래 전체 폭으로 내림
      if (Math.ceil(Math.max(1, SPEC.statsCount) / 2) * STAT_CELL_W > textW) {
        const t = textAtBottom(M, CW, H - M, size, nameLen);
        const photos = gridIn({ x: M, y: M, w: CW, h: t.y - TEXT_GAP - M }, n, true, portrait ? 2 : n);
        return { photos, textBlocks: t.blocks };
      }
      const photos = gridIn({ x: M, y: M, w: CW - textW - COL_GAP, h: CH }, n, true, portrait ? 2 : 3);
      const tx = W - M - textW;
      const s = fitNameSize(size, textW, nameLen);
      const blocks = placeText({ x: tx, y: M, w: textW, h: textHeight(s, textW) }, s);
      return { photos, textBlocks: blocks };
    }

    /* 대표 사진을 꽉 채우고(여백 없음), 이름은 사진 위 아래쪽에 얹음 */
    case "cover": {
      if (portrait) {
        const main = { x: 0, y: 0, w: W, h: Math.round(W * RATIO) }; // 480 x 640, 아래 40은 바탕 띠
        const stripH = 110;
        const rest = n > 1 ? gridIn({ x: Math.round(W * 0.55), y: bottom(main) - M - stripH, w: W - M - Math.round(W * 0.55), h: stripH }, n - 1, false, n - 1) : [];
        const t = textAtBottom(M, Math.round(W * 0.55) - M - COL_GAP, bottom(main) - M, size, nameLen);
        return { photos: [main, ...rest], textBlocks: t.blocks };
      }
      const main = { x: 0, y: 0, w: Math.round(H / RATIO), h: H }; // 360 x 480, 왼쪽 꽉 채움
      const rx = right(main) + COL_GAP;
      const rest = gridIn({ x: rx, y: M, w: W - M - rx, h: CH }, n - 1, true);
      const t = textAtBottom(M, main.w - 2 * M, H - M, size, nameLen);
      return { photos: [main, ...rest], textBlocks: t.blocks };
    }

    /* 왼쪽 큰 헤드샷 + 오른쪽 보조 컷 (같은 높이) + 아래 전체 폭 정보 띠 */
    case "zed": {
      const t = textAtBottom(M, CW, H - M, size, nameLen);
      const areaH = t.y - TEXT_GAP - M;
      const main0 = fitOne({ x: M, y: M, w: Math.round(CW * (portrait ? 0.55 : 0.4)), h: areaH });
      const rx = right(main0) + GAP;
      const rest = gridIn({ x: rx, y: M, w: W - M - rx, h: main0.h }, n - 1, true, portrait ? 2 : 3);
      const main = matchHeight(main0, rest);
      // 메인이 영역보다 짧으면 정보 띠를 사진 바로 아래로 (아래쪽 빈 공간 방지)
      if (bottom(main) < t.y - TEXT_GAP - 1) {
        const s2 = fitNameSize(size, CW, nameLen);
        return { photos: [main, ...rest], textBlocks: placeText({ x: M, y: bottom(main) + TEXT_GAP + 6, w: CW, h: textHeight(s2, CW) }, s2) };
      }
      return { photos: [main, ...rest], textBlocks: t.blocks };
    }

    /* 위쪽 이름 헤더 + 아래 같은 크기 룩들 */
    case "showcase": {
      const s = fitNameSize(size, CW, nameLen);
      const headH = textHeight(s, CW);
      const blocks = placeText({ x: M, y: M, w: CW, h: headH }, s);
      const gy = M + headH + TEXT_GAP;
      const photos = gridIn({ x: M, y: gy, w: CW, h: H - M - gy }, n, true);
      return { photos, textBlocks: blocks };
    }

    /* 넓은 여백 안에 사진, 그 아래 텍스트 (같은 끝선) */
    case "minimal": {
      const MM = portrait ? 48 : 40;
      const t = textAtBottom(MM, W - 2 * MM, H - MM, size, nameLen);
      const photos = gridIn({ x: MM, y: MM, w: W - 2 * MM, h: t.y - TEXT_GAP - 10 - MM }, n, true);
      return { photos, textBlocks: t.blocks };
    }

    /* 비대칭: 큰 메인 + 옆 열(세로형, 같은 높이) / 위 한 줄(가로형) */
    case "editorial":
    default: {
      if (portrait) {
        const t = textAtBottom(M, CW, H - M, size, nameLen);
        const areaH = t.y - TEXT_GAP - M;
        if (n === 1) return { photos: [fitOne({ x: M, y: M, w: CW, h: areaH })], textBlocks: t.blocks };
        const main0 = fitOne({ x: M, y: M, w: Math.round(CW * 0.68), h: areaH });
        const rx = right(main0) + GAP;
        const rest = gridIn({ x: rx, y: M, w: W - M - rx, h: main0.h }, n - 1, true, 2);
        const main = matchHeight(main0, rest);
        // 사진이 영역보다 짧아지면 글자를 사진 바로 아래로
        if (bottom(main) < t.y - TEXT_GAP - 1) {
          const s2 = fitNameSize(size, CW, nameLen);
          return { photos: [main, ...rest], textBlocks: placeText({ x: M, y: bottom(main) + TEXT_GAP + 6, w: CW, h: textHeight(s2, CW) }, s2) };
        }
        return { photos: [main, ...rest], textBlocks: t.blocks };
      }
      const main = fitOne({ x: M, y: M, w: Math.round(CH / 1.4), h: CH });
      const rx = right(main) + COL_GAP;
      const rw = W - M - rx;
      const t = textAtBottom(rx, rw, H - M, size, nameLen);
      const rowH = Math.min(Math.round(CH * 0.45), t.y - TEXT_GAP - M);
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
