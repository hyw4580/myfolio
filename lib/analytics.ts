"use client";
/**
 * 사용 패턴 기록 (브라우저 쪽)
 * - 이름·연락처 같은 개인정보는 보내지 않음. 기기별 임의 번호(anon_id)로만 구분
 * - 모아서 몇 초마다 한 번에 보냄 (/api/events), 페이지를 닫을 때는 sendBeacon
 * - 컴카드 편집 과정은 "편집 요약"(무엇을 몇 번 고쳤는지, 머문 시간)으로 묶어 보냄
 */
import { Capacitor } from "@capacitor/core";
import type { EventName } from "./analytics-events";

type Props = Record<string, string | number | boolean | null>;
type Queued = { name: EventName; props: Props; path: string; session_id: string; ts: number };

const KEY_ANON = "mf_anon_id";
const KEY_SESSION = "mf_session_id";
const KEY_REF = "mf_ref";
const queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function stored(storage: Storage | undefined, key: string) {
  try {
    if (!storage) return randomId();
    let v = storage.getItem(key);
    if (!v) { v = randomId(); storage.setItem(key, v); }
    return v;
  } catch { return randomId(); }
}
export const anonId = () => stored(typeof localStorage !== "undefined" ? localStorage : undefined, KEY_ANON);
const sessionId = () => stored(typeof sessionStorage !== "undefined" ? sessionStorage : undefined, KEY_SESSION);

function payload(events: Queued[]) {
  let platform = "web";
  try { platform = Capacitor.getPlatform(); } catch { /* web */ }
  return JSON.stringify({ anon_id: anonId(), platform, events });
}

function flush(useBeacon = false) {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  const body = payload(events);
  if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
  if (queue.length) flush(useBeacon);
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const onHide = () => { endEditorSession("left"); flush(true); };
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(true); });
}

/** 어디서 들어왔는지(공유 카드·명함 등) 기억 — 가입 시 함께 기록 */
export function rememberRef(ref: string | null) {
  if (!ref || !/^[a-z_]{1,20}$/.test(ref)) return;
  try { localStorage.setItem(KEY_REF, ref); } catch { /* 무시 */ }
}
export function getRef() {
  try { return localStorage.getItem(KEY_REF); } catch { return null; }
}

/** 이벤트 하나 기록 (값은 짧은 글자·숫자·참거짓만) */
export function track(name: EventName, props: Props = {}) {
  if (typeof window === "undefined") return;
  listen();
  queue.push({ name, props, path: location.pathname, session_id: sessionId(), ts: Date.now() });
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(() => flush(), 4000);
}

/* ── 컴카드 편집 과정 요약 ──
 * 드래그 한 번마다 보내면 너무 많으므로, 편집기에 머무는 동안 종류별 횟수를 세고
 * 저장·다운로드·페이지 떠남 때 한 번에 "editor_summary"로 보냄 */
export type EditKind =
  | "photo_move" | "photo_resize" | "text_move" | "text_size"
  | "bg_color" | "text_color" | "font_weight" | "name_caps" | "stats_layout"
  | "photo_add" | "photo_remove" | "photo_replace" | "field_toggle"
  | "preset_apply" | "ai_apply" | "undo" | "reset";

type EditorSession = { startedAt: number; counts: Partial<Record<EditKind, number>>; canvas: string; count: number; template: string; startTemplate: string; source: string };
let editor: EditorSession | null = null;

export function startEditorSession(info: { canvas: string; count: number; template: string; source: string }) {
  if (editor) endEditorSession("restart");
  editor = { startedAt: Date.now(), counts: {}, startTemplate: info.template, ...info };
}
/** 편집 중 양식을 바꾸거나 사진 수가 바뀌면 "최종 양식"을 갱신 (어떤 양식이 끝까지 가는지 집계용) */
export function setEditorLayout(template: string, count: number) {
  if (!editor) return;
  editor.template = template; editor.count = count;
}
/** 프리셋 적용·되돌리기·불러오기처럼 프로그램이 바꾼 값은 잠깐 편집으로 안 셈 */
let mutedUntil = 0;
export function muteTallies(ms = 1000) { mutedUntil = Date.now() + ms; }
export function talliesMuted() { return Date.now() < mutedUntil; }
export function tallyEdit(kind: EditKind) {
  if (!editor) return;
  editor.counts[kind] = (editor.counts[kind] ?? 0) + 1;
}
/** outcome: saved / downloaded / shared / left / restart */
export function endEditorSession(outcome: string) {
  if (!editor) return;
  const e = editor; editor = null;
  const total = Object.values(e.counts).reduce((a, b) => a + (b ?? 0), 0);
  track("editor_summary", {
    outcome, seconds: Math.round((Date.now() - e.startedAt) / 1000), edits: total,
    canvas: e.canvas, count: e.count, template: e.template, start_template: e.startTemplate, source: e.source,
    ...Object.fromEntries(Object.entries(e.counts).map(([k, v]) => [`n_${k}`, v ?? 0])),
  });
}
/** 저장 등 중간 지점에서 요약을 보내고 이어서 다시 셈 */
export function checkpointEditorSession(outcome: string) {
  if (!editor) return;
  const { canvas, count, template, source } = editor;
  endEditorSession(outcome);
  startEditorSession({ canvas, count, template, source });
}
