/**
 * 실제 사용자 행동으로 양식 순위 매기기 (서버·테스트 공용, 순수 계산)
 * - 점수 = 끝까지 간 비율(다운로드·공유)을 표본 수로 보정한 값 − 많이 고친 정도(조금)
 * - 표본이 적으면 순위를 바꾸지 않음 (몇 명의 우연한 선택에 휘둘리지 않게)
 */
export type TemplatePerf = { canvas: string; count: number; template: string; users: number; completed: number; avg_edits: number | null };
export type StylePerf = { canvas: string; template: string; bg: string; txt: string; weight: string; caps: string; stats: string; users: number };
export type Performance = { days: number; templates: TemplatePerf[]; styles: StylePerf[] };

export const MIN_COMBO_USERS = 20;   // 이 조합(방향·장수) 전체 표본이 이 정도는 돼야 순위 반영
export const MIN_TEMPLATE_USERS = 5; // 양식 하나에 이 정도는 있어야 그 양식 점수를 믿음
const SMOOTH = 10;                    // 보정 강도 (표본이 적을수록 평균 쪽으로 당김)

export type TemplateInsight = { template: string; users: number; rate: number; avgEdits: number | null; score: number };
export type ComboInsight = {
  enough: boolean;                    // 순위를 반영할 만큼 데이터가 있는지
  basis: "combo" | "canvas" | "none"; // 같은 장수 데이터 / 같은 방향 전체 / 없음
  users: number;
  ranked: TemplateInsight[];          // 점수 높은 순 (허용된 양식만)
};

function aggregate(rows: TemplatePerf[]) {
  const by = new Map<string, { users: number; completed: number; edits: number }>();
  for (const r of rows) {
    const cur = by.get(r.template) ?? { users: 0, completed: 0, edits: 0 };
    cur.users += r.users; cur.completed += r.completed; cur.edits += (r.avg_edits ?? 0) * r.users;
    by.set(r.template, cur);
  }
  return by;
}

export function rankTemplates(perf: Performance | null, canvas: string, count: number, allowed: string[]): ComboInsight {
  const none: ComboInsight = { enough: false, basis: "none", users: 0, ranked: [] };
  if (!perf) return none;
  const combo = perf.templates.filter(t => t.canvas === canvas && t.count === count);
  const sum = (rows: TemplatePerf[]) => rows.reduce((a, r) => a + r.users, 0);
  // 같은 장수 데이터가 적으면 같은 방향 전체(장수 무관)로 판단
  let rows = combo, basis: ComboInsight["basis"] = "combo";
  if (sum(combo) < MIN_COMBO_USERS) { rows = perf.templates.filter(t => t.canvas === canvas); basis = "canvas"; }
  const total = sum(rows);
  if (total < MIN_COMBO_USERS) return { ...none, users: total };

  const by = aggregate(rows);
  const all = [...by.values()];
  const baseRate = all.reduce((a, v) => a + v.completed, 0) / Math.max(1, all.reduce((a, v) => a + v.users, 0));
  const ranked = allowed.map(template => {
    const v = by.get(template);
    if (!v || v.users < MIN_TEMPLATE_USERS) return { template, users: v?.users ?? 0, rate: baseRate, avgEdits: null, score: baseRate };
    const rate = (v.completed + baseRate * SMOOTH) / (v.users + SMOOTH);
    const avgEdits = Math.round((v.edits / v.users) * 10) / 10;
    return { template, users: v.users, rate: v.completed / v.users, avgEdits, score: rate - Math.min(avgEdits, 40) / 400 };
  });
  // 점수가 같으면 원래(업계 표준) 순서 유지
  ranked.sort((a, b) => b.score - a.score || allowed.indexOf(a.template) - allowed.indexOf(b.template));
  return { enough: true, basis, users: total, ranked };
}

/** 이 양식으로 끝까지 간 카드들의 인기 스타일 (최대 3개) */
export function topStyles(perf: Performance | null, canvas: string, template: string, min = 3) {
  return (perf?.styles ?? []).filter(s => s.canvas === canvas && s.template === template && s.users >= min).slice(0, 3);
}
