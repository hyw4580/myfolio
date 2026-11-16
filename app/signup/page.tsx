"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import Nav from "../components/Nav";
import NumberScroll from "../components/NumberScroll";
import CountryCodeSelect from "../components/CountryCodeSelect";
import { useT } from "../components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { startOAuth } from "@/lib/oauth";
import { getRef, track } from "@/lib/analytics";
import { safeNext } from "@/lib/safe-next";
import AppleLoginButton from "../components/AppleLoginButton";

const steps = ["Account", "Profile", "Measurements"];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "13px 16px",
  border: "1px solid var(--border)", background: "#fff",
  fontSize: "14px", color: "var(--text)",
  fontFamily: "var(--font-inter)", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--muted)", marginBottom: "8px",
};

const primaryBtn: React.CSSProperties = {
  flex: 2, background: "var(--text)", color: "#fff", border: "none",
  padding: "16px", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  flex: 1, background: "#fff", color: "var(--text)", border: "1px solid var(--border)",
  padding: "16px", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
};

type MeasureKey = "birthYear" | "height" | "weight" | "shoeSize" | "bust" | "waist" | "hip";
const MEASURE_FIELDS: { key: MeasureKey; label: string; min: number; max: number; unit: string }[] = [
  { key: "birthYear", label: "Birth Year", min: 1970, max: new Date().getFullYear() - 10, unit: "" },
  { key: "height",    label: "Height",     min: 140,  max: 210, unit: "cm" },
  { key: "weight",    label: "Weight",     min: 35,   max: 120, unit: "kg" },
  { key: "shoeSize",  label: "Shoe Size",  min: 210,  max: 310, unit: "mm" },
  { key: "bust",      label: "Bust",       min: 26,   max: 50,  unit: "in" },
  { key: "waist",     label: "Waist",      min: 20,   max: 44,  unit: "in" },
  { key: "hip",       label: "Hip",        min: 28,   max: 50,  unit: "in" },
];

/** 저장된 값이 없거나 스크롤 범위를 벗어나면 기본값 사용 */
function inRange(key: MeasureKey, v: number | null | undefined, fallback: number): number {
  const f = MEASURE_FIELDS.find(x => x.key === key)!;
  return typeof v === "number" && v >= f.min && v <= f.max ? v : fallback;
}

/** "+82 010-0000-0000" → ["+82", "010-0000-0000"] */
function splitTel(tel: string | null): [string, string] {
  if (!tel) return ["+82", ""];
  const m = tel.match(/^(\+\d{1,4})\s+(.*)$/);
  return m ? [m[1], m[2]] : ["+82", tel];
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  // 외부 주소로 튕기지 않도록 사이트 내부 경로만 허용
  const next = safeNext(rawNext, "/mypage");
  const t = useT();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countryDial, setCountryDial] = useState("+82");

  const [account, setAccount] = useState({ korName: "", engName: "", email: "", phone: "", instagram: "" });
  const [profile, setProfile] = useState({ gender: "" as "Male" | "Female" | "", hairColor: "", eyeColor: "" });
  const [measurements, setMeasurements] = useState({
    birthYear: 2000, height: 170, weight: 55,
    bust: 34, waist: 24, hip: 35, shoeSize: 250,
  });

  // 로그인 상태 확인 + 기존 정보로 미리 채우기
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) { setLoading(false); track("signup_view", { ref: getRef() }); return; }
      setUser(u);
      setStep(2);

      const meta = u.user_metadata ?? {};
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
      if (p) setHasProfile(true);
      const [dial, phone] = splitTel(p?.tel ?? null);
      setCountryDial(dial);
      setAccount({
        engName:   p?.eng_name ?? meta.full_name ?? meta.name ?? "",
        korName:   p?.kor_name ?? "",
        email:     p?.email ?? u.email ?? "",
        phone,
        instagram: p?.instagram ?? "",
      });
      setProfile({
        gender:    p?.gender === "Male" || p?.gender === "Female" ? p.gender : "",
        hairColor: p?.hair ?? "",
        eyeColor:  p?.eye ?? "",
      });
      setMeasurements(prev => ({
        birthYear: inRange("birthYear", p?.birth_year, prev.birthYear),
        height:    inRange("height",    p?.height,     prev.height),
        weight:    inRange("weight",    p?.weight,     prev.weight),
        bust:      inRange("bust",      p?.chest,      prev.bust),
        waist:     inRange("waist",     p?.waist,      prev.waist),
        hip:       inRange("hip",       p?.hip,        prev.hip),
        shoeSize:  inRange("shoeSize",  p?.shoe_size,  prev.shoeSize),
      }));
      setLoading(false);
    })();
  }, []);

  const signIn = (provider: "google" | "kakao") => startOAuth(provider, next);

  const goToMeasurements = () => {
    if (!account.engName.trim()) { setError(t.signup.nameRequired); return; }
    setError(null);
    setStep(3);
  };

  const complete = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    const row: Record<string, unknown> = {
      id: user.id,
      eng_name:   account.engName.trim(),
      kor_name:   account.korName.trim() || null,
      email:      account.email.trim() || null,
      tel:        account.phone.trim() ? `${countryDial} ${account.phone.trim()}` : null,
      instagram:  account.instagram.trim() || null,
      gender:     profile.gender || null,
      hair:       profile.hairColor.trim() || null,
      eye:        profile.eyeColor.trim() || null,
      birth_year: measurements.birthYear,
      height:     measurements.height,
      weight:     measurements.weight,
      chest:      measurements.bust,
      waist:      measurements.waist,
      hip:        measurements.hip,
      shoe_size:  measurements.shoeSize,
    };
    // 새 프로필일 때만 기본값을 넣고, 기존 값(공개 여부·주소·영상 등)은 건드리지 않음
    if (!hasProfile) Object.assign(row, { is_public: false, video_urls: [] });
    const { error: dbError } = await supabase.from("profiles").upsert(row);
    setSaving(false);
    if (dbError) {
      console.error("[signup] profile save failed:", dbError);
      setError(t.signup.saveError);
      return;
    }
    if (!hasProfile) track("signup_completed", { ref: getRef() });
    router.push(next);
    router.refresh();
  };

  if (loading) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <Nav />
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />
      <div className="signup-layout">

        {/* 왼쪽 브랜딩 */}
        <div className="signup-side">
          <p style={{ fontSize: "11px", letterSpacing: "0.24em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "20px" }}>
            myfolio
          </p>
          <h1 className="font-display" style={{ fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 400, lineHeight: 1.1, marginBottom: "24px" }}>
            {t.signup.tagline.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </h1>
          <p style={{ fontSize: "15px", color: "var(--muted)", lineHeight: 1.9, maxWidth: "360px" }}>
            {t.signup.taglineSub}
          </p>

          <div className="signup-steps" style={{ marginTop: "60px", display: "flex", flexDirection: "column", borderTop: "1px solid var(--border)" }}>
            {steps.map((s, i) => (
              <div key={i} style={{ padding: "20px 0", borderBottom: "1px solid var(--border)", display: "flex", gap: "20px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", letterSpacing: "0.1em", color: step === i + 1 ? "var(--text)" : "var(--muted)", width: "20px" }}>0{i + 1}</span>
                <span style={{ fontSize: "14px", color: step === i + 1 ? "var(--text)" : "var(--muted)", fontWeight: step === i + 1 ? 500 : 400 }}>{s}</span>
                {step > i + 1 && <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--warm)" }}>✓</span>}
              </div>
            ))}
          </div>

          {!user && (
            <p style={{ marginTop: "40px", fontSize: "13px", color: "var(--muted)" }}>
              {t.signup.alreadyHaveAccount}{" "}
              <Link href={`/login?next=${encodeURIComponent(next)}`} style={{ color: "var(--text)", textDecoration: "underline" }}>{t.signup.loginLink}</Link>
            </p>
          )}
        </div>

        {/* 오른쪽 폼 */}
        <div className="signup-form">

          {/* Step 1: 소셜 계정으로 가입 */}
          {step === 1 && (
            <div>
              <h2 className="font-display" style={{ fontSize: "36px", fontWeight: 400, marginBottom: "8px" }}>{t.signup.steps.account}</h2>
              <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "44px", lineHeight: 1.7 }}>{t.signup.steps.accountSub}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px" }}>
                <button onClick={() => signIn("google")} style={{
                  width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                  border: "1px solid #e0e0e0", background: "#fff", fontSize: "14px", color: "#0A0A0A", cursor: "pointer",
                }}>
                  <svg width="18" height="18" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                    <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                    <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
                    <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                  </svg>
                  {t.login.continueWithGoogle}
                </button>
                <button onClick={() => signIn("kakao")} style={{
                  width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                  border: "none", background: "#FEE500", fontSize: "14px", color: "#000000CC", cursor: "pointer",
                }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path fillRule="evenodd" clipRule="evenodd" d="M9 1.5C4.86 1.5 1.5 4.1 1.5 7.3c0 2.07 1.38 3.89 3.46 4.93l-.88 3.27c-.08.28.23.5.47.34L8.4 13.5c.2.02.4.03.6.03 4.14 0 7.5-2.6 7.5-5.8S13.14 1.5 9 1.5z" fill="#000000"/>
                  </svg>
                  {t.login.continueWithKakao}
                </button>
                <AppleLoginButton next={next} label={t.login.continueWithApple} />
              </div>

              <p style={{ marginTop: "28px", fontSize: "12px", color: "#aaa", lineHeight: 1.7, maxWidth: "400px" }}>
                {t.login.termsNote.split(t.login.terms)[0]}
                <Link href="/terms" style={{ textDecoration: "underline", color: "inherit" }}>{t.login.terms}</Link>
                {t.login.termsNote.split(t.login.terms)[1]?.split(t.login.privacy)[0]}
                <Link href="/privacy" style={{ textDecoration: "underline", color: "inherit" }}>{t.login.privacy}</Link>
                {t.login.termsNote.split(t.login.privacy)[1]}
              </p>
            </div>
          )}

          {/* Step 2: 프로필 */}
          {step === 2 && (
            <div>
              <h2 className="font-display" style={{ fontSize: "36px", fontWeight: 400, marginBottom: "8px" }}>{t.signup.steps.profile}</h2>
              <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "12px" }}>{t.signup.steps.profileSub}</p>
              {user?.email && (
                <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "36px" }}>{t.signup.loggedInAs} {user.email}</p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div className="signup-two-col">
                  <div>
                    <label style={labelStyle}>English Name *</label>
                    <input style={inputStyle} placeholder="Gil-dong Hong" value={account.engName}
                      onChange={e => setAccount(p => ({ ...p, engName: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Korean Name</label>
                    <input style={inputStyle} placeholder="홍길동" value={account.korName}
                      onChange={e => setAccount(p => ({ ...p, korName: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Gender</label>
                  <div style={{ display: "flex" }}>
                    {["Female", "Male"].map(g => (
                      <button key={g} type="button" onClick={() => setProfile(p => ({ ...p, gender: g as "Male" | "Female" }))} style={{
                        flex: 1, padding: "13px", border: "1px solid var(--border)",
                        borderRight: g === "Female" ? "none" : "1px solid var(--border)",
                        background: profile.gender === g ? "var(--text)" : "#fff",
                        color: profile.gender === g ? "#fff" : "var(--muted)",
                        fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                      }}>{g}</button>
                    ))}
                  </div>
                </div>

                <div className="signup-two-col">
                  <div>
                    <label style={labelStyle}>Hair Color</label>
                    <input style={inputStyle} placeholder="e.g. Black, Dark Brown" value={profile.hairColor}
                      onChange={e => setProfile(p => ({ ...p, hairColor: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Eye Color</label>
                    <input style={inputStyle} placeholder="e.g. Dark Brown, Black" value={profile.eyeColor}
                      onChange={e => setProfile(p => ({ ...p, eyeColor: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" placeholder="hello@email.com" value={account.email}
                    onChange={e => setAccount(p => ({ ...p, email: e.target.value }))} />
                </div>

                <div>
                  <label style={labelStyle}>Phone</label>
                  <div style={{ display: "flex" }}>
                    <CountryCodeSelect value={countryDial} onChange={setCountryDial} />
                    <input style={{ ...inputStyle, flex: 1 }} placeholder="010-0000-0000" value={account.phone}
                      onChange={e => setAccount(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Instagram</label>
                  <input style={inputStyle} placeholder="@username" value={account.instagram}
                    onChange={e => setAccount(p => ({ ...p, instagram: e.target.value }))} />
                </div>
              </div>

              {error && <p style={{ marginTop: "20px", fontSize: "13px", color: "#c00" }}>{error}</p>}

              <div style={{ display: "flex", gap: "12px", marginTop: "44px" }}>
                <button onClick={goToMeasurements} style={primaryBtn}>{t.signup.next} →</button>
              </div>
            </div>
          )}

          {/* Step 3: 신체 정보 */}
          {step === 3 && (
            <div>
              <h2 className="font-display" style={{ fontSize: "36px", fontWeight: 400, marginBottom: "8px" }}>{t.signup.steps.measurements}</h2>
              <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "44px" }}>{t.signup.steps.measurementsSub}</p>

              <div className="signup-measure-grid">
                {MEASURE_FIELDS.map(f => (
                  <div key={f.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                    <label style={{ ...labelStyle, textAlign: "center" }}>{f.label}</label>
                    <NumberScroll
                      min={f.min} max={f.max}
                      value={measurements[f.key]}
                      onChange={v => setMeasurements(p => ({ ...p, [f.key]: v }))}
                      unit={f.unit}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "52px", padding: "24px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "16px" }}>{t.signup.summary}</p>
                <div className="signup-two-col" style={{ gap: "8px 32px", fontSize: "13px" }}>
                  {[
                    ["Name", account.engName || "—"],
                    ["Gender", profile.gender || "—"],
                    ["Height", `${measurements.height}cm`],
                    ["Bust / Waist / Hip", `${measurements.bust} / ${measurements.waist} / ${measurements.hip} in`],
                    ["Hair", profile.hairColor || "—"],
                    ["Eyes", profile.eyeColor || "—"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                      <span style={{ color: "var(--muted)" }}>{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error && <p style={{ marginTop: "20px", fontSize: "13px", color: "#c00" }}>{error}</p>}

              <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
                <button onClick={() => setStep(2)} style={secondaryBtn}>← {t.signup.back}</button>
                <button onClick={complete} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
                  {saving ? t.signup.saving : t.signup.complete}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}
