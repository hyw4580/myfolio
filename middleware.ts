import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // ── Locale detection ──────────────────────────────────────────
  if (!request.cookies.get('locale')) {
    const lang = request.headers.get('accept-language') ?? '';
    const locale = lang.startsWith('ko') ? 'ko' : lang.startsWith('ru') ? 'ru' : 'en';
    supabaseResponse.cookies.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  }

  // ── Supabase auth ─────────────────────────────────────────────
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

  // 이미 로그인된 상태에서 /login 접근 시 메인으로
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon).*)",
  ],
};
