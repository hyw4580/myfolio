import type { UsageSummary, VocMetrics, VocReportT } from "@/lib/voc";

const SEV = { high: { label: "높음", color: "#c62828", bg: "#fdecea" }, medium: { label: "보통", color: "#b26a00", bg: "#fff4e0" }, low: { label: "낮음", color: "#666", bg: "#f2f2f2" } } as const;
const TYPE = { bug: "오류", inconvenience: "불편", request: "기능요청", praise: "칭찬", other: "기타" } as const;
const EFFORT = { small: "작업 작음", medium: "작업 보통", large: "작업 큼" } as const;

/** 주간 VOC 보고서 화면 */
export default function VocReportView({ report, metrics, period }: { report: VocReportT | null; metrics: VocMetrics; period: string }) {
  const stat = (label: string, value: string | number) => (
    <div style={{ border: "1px solid #eee", padding: "12px 14px", background: "#fff" }}>
      <p style={{ fontSize: "11px", color: "#999", marginBottom: "4px" }}>{label}</p>
      <p style={{ fontSize: "20px", fontWeight: 600 }}>{value}</p>
    </div>
  );
  return (
    <div>
      <p style={{ fontSize: "12px", color: "#999", marginBottom: "6px" }}>{period}</p>
      <h2 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "16px", lineHeight: 1.35 }}>{report?.headline ?? "이번 주에는 들어온 의견이 없어요"}</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px", marginBottom: "24px" }}>
        {stat("의견", metrics.feedback)}
        {stat("신규 가입", metrics.newUsers)}
        {stat("컴카드 생성", metrics.cardsCreated)}
        {stat("다운로드", metrics.exports)}
        {stat("신규 결제", `${metrics.newPayments}건`)}
        {stat("결제 금액", `${metrics.revenueKRW.toLocaleString("ko-KR")}원`)}
        {stat("현재 Pro", metrics.activePro)}
      </div>

      {metrics.usage?.funnel && <UsageFunnel usage={metrics.usage} />}

      {report && <>
        <p style={{ fontSize: "14px", lineHeight: 1.8, color: "#333", marginBottom: "28px" }}>{report.summary}</p>

        <h3 style={{ fontSize: "13px", letterSpacing: "0.1em", color: "#888", marginBottom: "10px" }}>이번 주 개선 우선순위</h3>
        <ol style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {report.actions.map((a, i) => (
            <li key={i} style={{ display: "flex", gap: "12px", border: "1px solid #111", padding: "14px 16px", background: "#fff" }}>
              <span style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1 }}>{i + 1}</span>
              <div>
                <p style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>{a.title} <span style={{ fontSize: "11px", color: "#888", fontWeight: 400 }}>· {EFFORT[a.effort]}</span></p>
                <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.6 }}>{a.why}</p>
              </div>
            </li>
          ))}
        </ol>

        <h3 style={{ fontSize: "13px", letterSpacing: "0.1em", color: "#888", marginBottom: "10px" }}>주제별 의견</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "28px" }}>
          {report.themes.map((t, i) => (
            <div key={i} style={{ border: "1px solid #eee", padding: "14px 16px", background: "#fff" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
                <b style={{ fontSize: "14px" }}>{t.title}</b>
                <span style={{ fontSize: "11px", padding: "2px 8px", background: SEV[t.severity].bg, color: SEV[t.severity].color }}>{SEV[t.severity].label}</span>
                <span style={{ fontSize: "11px", padding: "2px 8px", background: "#f2f2f2", color: "#555" }}>{TYPE[t.type]}</span>
                <span style={{ fontSize: "12px", color: "#888" }}>{t.count}건</span>
              </div>
              <p style={{ fontSize: "13px", color: "#333", lineHeight: 1.6 }}>{t.description}</p>
              {t.quotes.length > 0 && (
                <p style={{ fontSize: "12px", color: "#888", marginTop: "6px", lineHeight: 1.6 }}>{t.quotes.map(q => `“${q}”`).join("  ")}</p>
              )}
              <p style={{ fontSize: "13px", color: "#1f7a3a", marginTop: "6px" }}>→ {t.suggestion}</p>
            </div>
          ))}
        </div>

        {report.usage && (report.usage.bottleneck || report.usage.editing.length > 0 || report.usage.templates) && <>
          <h3 style={{ fontSize: "13px", letterSpacing: "0.1em", color: "#888", marginBottom: "10px" }}>사용 패턴</h3>
          <div style={{ border: "1px solid #eee", padding: "14px 16px", background: "#fff", marginBottom: "28px", fontSize: "13px", lineHeight: 1.7 }}>
            {report.usage.bottleneck && <p style={{ marginBottom: "8px" }}><b>가장 많이 빠지는 곳</b><br />{report.usage.bottleneck}</p>}
            {report.usage.editing.length > 0 && <><b>컴카드 편집 패턴</b><ul style={{ paddingLeft: "18px", margin: "2px 0 8px" }}>{report.usage.editing.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
            {report.usage.templates && <p><b>양식·AI 추천</b><br />{report.usage.templates}</p>}
          </div>
        </>}
        {report.liked && <>
          <h3 style={{ fontSize: "13px", letterSpacing: "0.1em", color: "#888", marginBottom: "8px" }}>좋았던 점</h3>
          <p style={{ fontSize: "14px", lineHeight: 1.7, marginBottom: "24px" }}>{report.liked}</p>
        </>}
        {report.watch.length > 0 && <>
          <h3 style={{ fontSize: "13px", letterSpacing: "0.1em", color: "#888", marginBottom: "8px" }}>지켜볼 신호</h3>
          <ul style={{ paddingLeft: "18px", fontSize: "14px", lineHeight: 1.8 }}>{report.watch.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </>}
      </>}
    </div>
  );
}

const FUNNEL_KO: [string, string][] = [
  ["visited", "방문"], ["signed_up", "가입"], ["started_card", "컴카드 시작"], ["uploaded_photos", "사진 올림"],
  ["chose_template", "양식 선택"], ["saved_card", "저장"], ["downloaded_or_shared", "다운로드·공유"], ["subscribed", "결제"],
];
const EDIT_KO: Record<string, string> = {
  photo_move: "사진 이동", photo_resize: "사진 크기", text_move: "글자 이동", text_size: "글자 크기", bg_color: "배경색", text_color: "글자색",
  font_weight: "굵기", name_caps: "대문자", stats_layout: "신체정보 단", photo_add: "사진 추가", photo_remove: "사진 삭제", photo_replace: "사진 교체",
  field_toggle: "표시 항목", preset_apply: "프리셋 바꾸기", ai_apply: "AI안 적용", undo: "되돌리기", reset: "초기화",
};

/** 단계별 사용자 수(이탈 지점)와 편집기에서 많이 고친 것 — AI 없이도 보이는 원자료 */
function UsageFunnel({ usage }: { usage: UsageSummary }) {
  const f = usage.funnel ?? {};
  const top = Math.max(1, ...FUNNEL_KO.map(([k]) => f[k] ?? 0));
  const kinds = Object.entries(usage.editor?.edit_kinds ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const ed = usage.editor;
  const pct = (a?: number, b?: number) => (b ? `${Math.round(((a ?? 0) / b) * 100)}%` : "-");
  const sg = usage.signup, rt = usage.retention;
  return (
    <div style={{ border: "1px solid #eee", background: "#fff", padding: "14px 16px", marginBottom: "24px", fontSize: "12px" }}>
      <p style={{ fontSize: "11px", color: "#999", marginBottom: "8px" }}>단계별 사용자 수 (기기 기준)</p>
      {FUNNEL_KO.map(([k, label], i) => {
        const v = f[k] ?? 0; const prev = i > 0 ? f[FUNNEL_KO[i - 1][0]] ?? 0 : 0;
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ width: "84px", color: "#555" }}>{label}</span>
            <span style={{ flex: 1, background: "#f3f3f3", height: "14px" }}><span style={{ display: "block", height: "100%", width: `${(v / top) * 100}%`, background: "#111" }} /></span>
            <span style={{ width: "88px", textAlign: "right" }}>{v}{i > 0 && prev > 0 ? <span style={{ color: "#999" }}> ({Math.round((v / prev) * 100)}%)</span> : null}</span>
          </div>
        );
      })}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", margin: "12px 0 0", color: "#555" }}>
        <span>가입 완료율 <b>{pct(sg?.completed, sg?.viewed)}</b> <span style={{ color: "#999" }}>({sg?.completed ?? 0}/{sg?.viewed ?? 0})</span></span>
        <span>7일 재방문 <b>{pct(rt?.d7_return, rt?.d7_cohort)}</b> · 수정 <b>{pct(rt?.d7_edit, rt?.d7_cohort)}</b> <span style={{ color: "#999" }}>(가입 {rt?.d7_cohort ?? 0}명)</span></span>
        <span>30일 재방문 <b>{pct(rt?.d30_return, rt?.d30_cohort)}</b> · 수정 <b>{pct(rt?.d30_edit, rt?.d30_cohort)}</b> <span style={{ color: "#999" }}>(가입 {rt?.d30_cohort ?? 0}명)</span></span>
      </div>
      {ed && (ed.sessions ?? 0) > 0 && <>
        <p style={{ fontSize: "11px", color: "#999", margin: "14px 0 6px" }}>
          편집기 {ed.sessions}회 · 머문 시간 중간값 {Math.round(Number(ed.median_seconds ?? 0) / 60 * 10) / 10}분 · 평균 편집 {ed.avg_edits ?? 0}번
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {kinds.map(([k, n]) => <span key={k} style={{ background: "#f3f3f3", padding: "3px 8px" }}>{EDIT_KO[k] ?? k} {n}</span>)}
        </div>
      </>}
    </div>
  );
}
