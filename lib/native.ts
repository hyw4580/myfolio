"use client";
import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * 앱(iOS·안드로이드) 안에서 실행 중인지 확인하는 도우미.
 * 웹 브라우저에서는 항상 "web".
 */
export const APP_SCHEME = "com.myfolio.app"; // 앱으로 돌아오는 주소 (capacitor.config의 appId와 같게)

export const isNativeApp = () => Capacitor.isNativePlatform();
export const nativePlatform = () => Capacitor.getPlatform() as "ios" | "android" | "web";

/**
 * 앱 안에서 디지털 상품(Pro 구독)을 판매할 수 있는지.
 * 애플·구글은 앱 안 디지털 구독에 자체 결제를 요구하므로, 인앱결제를 붙이기 전까지 앱에서는 판매 화면을 숨긴다.
 * (웹에서 구독한 Pro는 앱에서도 그대로 이용 가능)
 */
export const canSellInApp = () => !isNativeApp();

/** 화면에서 쓰는 "앱 안인지" 값 — 서버 렌더링에선 false, 브라우저에서 실제 값 (화면 불일치 방지) */
const noop = () => () => {};
export function useIsNativeApp(): boolean {
  return useSyncExternalStore(noop, () => Capacitor.isNativePlatform(), () => false);
}
