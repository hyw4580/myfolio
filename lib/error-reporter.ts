"use client";
/** 화면 오류를 서버로 보냄 — 같은 오류는 한 번만, 한 번 방문에 최대 10건 */
import { Capacitor } from "@capacitor/core";
import { anonId } from "./analytics";

const sent = new Set<string>();
const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i, /chrome-extension:|moz-extension:|safari-extension:/i, /AbortError/i, /Load failed$/i];

export function reportClientError(err: unknown) {
  if (typeof window === "undefined") return;
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err ?? "unknown"));
  const message = e.message || String(err);
  const stack = e.stack ?? null;
  if (IGNORE.some(r => r.test(message) || (stack && r.test(stack)))) return;
  const key = `${message}|${(stack ?? "").split("\n")[1] ?? ""}`;
  if (sent.has(key) || sent.size >= 10) return;
  sent.add(key);
  let platform = "web";
  try { platform = Capacitor.getPlatform(); } catch { /* web */ }
  const body = JSON.stringify({ anon_id: anonId(), platform, errors: [{ message: message.slice(0, 1000), stack: stack?.slice(0, 4000), path: location.pathname }] });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/errors", new Blob([body], { type: "application/json" }));
  else fetch("/api/errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}
