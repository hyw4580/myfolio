import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";

/** 로그인 확인·세션 갱신이 필요한 경로 */
const AUTH_PATHS = ["/comcard", "/mypage", "/login", "/signup", "/card", "/admin", "/billing", "/pricing", "/auth"];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // ── Locale detection ──────────────────────────────────────────
  if (!request.cookies.get('locale')) {
    const lang = request.headers.get('accept-language') ?? '';
    const locale = lang.startsWith('ko') ? 'ko' : lang.startsWith('ru') ? 'ru' : 'en';
    supabaseResponse.cookies.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  }

  // ── Supabase auth ─────────────────────────────────────────────
  // 로그인 정보가 필요한 화면에서만 확인 (명함·미리보기 이미지·연락처 저장 같은 공개 페이지는 건너뜀 → 빠르게)
  // 서버에서 로그인 정보를 읽는 페이지는 여기서 세션을 갱신해야 로그인이 풀리지 않음
  const path = request.nextUrl.pathname;
  const needsAuth = AUTH_PATHS.some(p => path === p || path.startsWith(`${p}/`)) && !path.endsWith("/opengraph-image");
  if (!needsAuth) return supabaseResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          // Re-apply locale cookie after supabaseResponse is recreated
          if (!request.cookies.get('locale')) {
            const lang = request.headers.get('accept-language') ?? '';
            const locale = lang.startsWith('ko') ? 'ko' : lang.startsWith('ru') ? 'ru' : 'en';
            supabaseResponse.cookies.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
          }
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // /comcard, /mypage 는 로그인 필수
  if (!user && (request.nextUrl.pathname.startsWith("/comcard") || request.nextUrl.pathname.startsWith("/mypage"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // 이미 로그인된 상태에서 /login 접근 시 원래 가려던 곳으로 (없으면 메인)
  if (user && request.nextUrl.pathname === "/login") {
    const target = safeNext(request.nextUrl.searchParams.get("next"), "/");
    return NextResponse.redirect(new URL(target, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon).*)",
  ],
};
