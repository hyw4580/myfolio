import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get("code");
  const next  = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] error:", JSON.stringify(error));
    return NextResponse.redirect(`${origin}/login?error=auth&msg=${encodeURIComponent(error.message)}`);
  }

  const oauthError = searchParams.get("error_description") ?? searchParams.get("error") ?? "no_code";
  console.error("[auth/callback] no code. params:", request.url);
  return NextResponse.redirect(`${origin}/login?error=auth&msg=${encodeURIComponent(oauthError)}`);
}
