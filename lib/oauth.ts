"use client";
import { createClient } from "@/lib/supabase/client";
import { APP_SCHEME, isNativeApp } from "@/lib/native";

export type OAuthProvider = "google" | "kakao" | "apple";

/**
 * 소셜 로그인 시작.
 * - 웹: 평소처럼 로그인 페이지로 이동 → /auth/callback 으로 돌아옴
 * - 앱: 구글은 앱 안 화면에서의 로그인을 막기 때문에 "시스템 브라우저"로 로그인하고,
 *       끝나면 com.myfolio.app://auth/callback?code=... 로 앱이 다시 열림 → AppBridge가 처리
 */
export async function startOAuth(provider: OAuthProvider, next: string) {
  const supabase = createClient();
  if (!isNativeApp()) {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    return;
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${APP_SCHEME}://auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data?.url) throw error ?? new Error("로그인을 시작하지 못했어요.");
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: data.url, presentationStyle: "popover" });
}
