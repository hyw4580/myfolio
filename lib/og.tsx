import { createClient } from "@supabase/supabase-js";

/** 링크 미리보기(OG) 이미지용 공개 조회 클라이언트 — 로그인 없이 공개 데이터만 */
export function publicSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * 공유 미리보기 카드 이미지 (1200x630).
 * 한글 글꼴이 기본 포함되지 않아 영문 정보만 넣는다.
 */
export function OgCard({ photo, name, kicker, stats, bg = "#F8F7F4", fg = "#0A0A0A" }: {
  photo: string | null; name: string; kicker: string; stats: { label: string; value: string }[]; bg?: string; fg?: string;
}) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: bg, color: fg }}>
      <div style={{ width: 470, height: "100%", display: "flex", background: "#2A2A2A" }}>
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photo} alt="" width={470} height={630} style={{ width: 470, height: 630, objectFit: "cover" }} />
          : <div style={{ display: "flex", width: "100%", height: "100%" }} />}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 64px 56px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, letterSpacing: 6, opacity: 0.55 }}>{kicker}</div>
          <div style={{ fontSize: name.length > 16 ? 58 : 72, fontWeight: 700, letterSpacing: 2, marginTop: 18, lineHeight: 1.05 }}>{name.toUpperCase()}</div>
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 40 }}>
            {stats.slice(0, 6).map(s => (
              <div key={s.label} style={{ display: "flex", flexDirection: "column", width: 190, marginBottom: 26 }}>
                <div style={{ fontSize: 16, letterSpacing: 4, opacity: 0.55 }}>{s.label.toUpperCase()}</div>
                <div style={{ fontSize: 30, marginTop: 6 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 30, letterSpacing: 1 }}>myfolio</div>
      </div>
    </div>
  );
}

/** 한글 등 기본 글꼴에 없는 글자를 뺀 값 (빈 값이면 제외) */
export const latinOnly = (v: string) => v.replace(/[^\x20-\x7E]/g, "").trim();
