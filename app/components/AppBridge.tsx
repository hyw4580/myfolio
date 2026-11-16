"use client";
import { useEffect } from "react";
import { APP_SCHEME, isNativeApp } from "@/lib/native";

/**
 * 앱에서만 동작하는 연결 고리 (웹에서는 아무것도 안 함).
 * - 로그인 후 com.myfolio.app://auth/callback?code=... 로 앱이 열리면
 *   시스템 브라우저를 닫고, 앱 화면에서 /auth/callback 으로 이동해 로그인을 마무리한다.
 *   (로그인 시작 시 앱 화면에 저장된 보안 코드로 교환하므로 같은 화면에서 처리해야 함)
 * - 링크(myfolio.com/이름 등)로 앱이 열리면 해당 페이지로 이동.
 */
export default function AppBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    (async () => {
      const { App } = await import("@capacitor/app");
      const { Browser } = await import("@capacitor/browser");
      const handle = await App.addListener("appUrlOpen", async ({ url }) => {
        try {
          const u = new URL(url);
          if (url.startsWith(`${APP_SCHEME}://`)) {
            // com.myfolio.app://auth/callback?code=... → /auth/callback?code=...
            const path = `/${u.host}${u.pathname}`.replace(/\/+$/, "") || "/";
            await Browser.close().catch(() => {});
            window.location.href = `${path}${u.search}`;
          } else if (u.origin === window.location.origin) {
            window.location.href = `${u.pathname}${u.search}`;
          }
        } catch { /* 잘못된 주소는 무시 */ }
      });
      remove = () => handle.remove();
    })();
    return () => remove?.();
  }, []);
  return null;
}
