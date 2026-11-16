import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get("code");
  const next  = safeNext(searchParams.get("next"), "/"); // 외부 사이트로 보내지 않도록

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 처음 가입한 사용자(프로필 없음)는 프로필 입력 화면으로 보냄
      const { data: profile } = await supabase
        .from("profiles").select("id").eq("id", data.user.id).maybeSingle();
      if (!profile) {
        return NextResponse.redirect(`${origin}/signup?next=${encodeURIComponent(next)}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] error:", JSON.stringify(error));
    return NextResponse.redirect(`${origin}/login?error=auth&msg=${encodeURIComponent(error.message)}`);
  }

  const oauthError = searchParams.get("error_description") ?? searchParams.get("error") ?? "no_code";
  console.error("[auth/callback] no code. params:", request.url);
  return NextResponse.redirect(`${origin}/login?error=auth&msg=${encodeURIComponent(oauthError)}`);
}
