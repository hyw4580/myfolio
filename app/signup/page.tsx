"use client";
import { useState } from "react";
import Link from "next/link";
import Nav from "../components/Nav";
import NumberScroll from "../components/NumberScroll";
import CountryCodeSelect from "../components/CountryCodeSelect";
import { useT } from "../components/LocaleProvider";

const steps = ["Account", "Profile", "Measurements"];

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [countryDial, setCountryDial] = useState("+82");
  const t = useT();

  const [account, setAccount] = useState({
    name: "", engName: "", email: "", password: "", phone: "", instagram: "",
  });

  const [profile, setProfile] = useState({
    gender: "" as "Male" | "Female" | "",
    hairColor: "", eyeColor: "",
  });

  const [measurements, setMeasurements] = useState({
    birthYear: 2000, height: 170, weight: 55,
    bust: 34, waist: 24, hip: 35, shoeSize: 250,
  });

  const inputStyle = {
    width: "100%", padding: "13px 16px",
    border: "1px solid var(--border)", background: "#fff",
    fontSize: "14px", color: "var(--text)",
    fontFamily: "var(--font-inter)",
  };

  const labelStyle = {
    display: "block", fontSize: "11px", letterSpacing: "0.1em",
    textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: "8px",
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />
      <div style={{ paddingTop: "80px", display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "calc(100vh - 80px)" }}>

        {/* 왼쪽 브랜딩 */}
        <div style={{
          background: "var(--surface)", borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "80px 72px", position: "sticky", top: "80px", height: "calc(100vh - 80px)",
        }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.24em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "20px" }}>
            myfolio
          </p>
          <h1 className="font-display" style={{ fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 400, lineHeight: 1.1, marginBottom: "24px" }}>
            {t.signup.tagline.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </h1>
          <p style={{ fontSize: "15px", color: "var(--muted)", lineHeight: 1.9, maxWidth: "360px" }}>
            {t.signup.taglineSub}
          </p>

          <div style={{ marginTop: "60px", display: "flex", flexDirection: "column", gap: "0", borderTop: "1px solid var(--border)" }}>
            {steps.map((s, i) => (
              <div key={i} style={{
                padding: "20px 0", borderBottom: "1px solid var(--border)",
                display: "flex", gap: "20px", alignItems: "center",
              }}>
                <span style={{
                  fontSize: "11px", letterSpacing: "0.1em", color: step === i + 1 ? "var(--text)" : "var(--muted)",
                  width: "20px",
                }}>0{i + 1}</span>
                <span style={{ fontSize: "14px", color: step === i + 1 ? "var(--text)" : "var(--muted)", fontWeight: step === i + 1 ? 500 : 400 }}>
                  {s}
                </span>
                {step > i + 1 && <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--warm)" }}>✓</span>}
              </div>
            ))}
          </div>

          <p style={{ marginTop: "40px", fontSize: "13px", color: "var(--muted)" }}>
            {t.signup.alreadyHaveAccount}{" "}
            <Link href="#" style={{ color: "var(--text)", textDecoration: "underline" }}>{t.signup.loginLink}</Link>
          </p>
        </div>

        {/* 오른쪽 폼 */}
        <div style={{ padding: "64px 72px", overflowY: "auto" }}>

          {/* Step 1: Account */}
          {step === 1 && (
            <div>
              <h2 className="font-display" style={{ fontSize: "36px", fontWeight: 400, marginBottom: "8px" }}>
                {t.signup.steps.account}
              </h2>
              <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "44px" }}>{t.signup.steps.accountSub}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={labelStyle}>Name</label>
                    <input style={inputStyle} placeholder="홍길동" value={account.name}
                      onChange={e => setAccount(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>English Name</label>
                    <input style={inputStyle} placeholder="Gil-dong Hong" value={account.engName}
                      onChange={e => setAccount(p => ({ ...p, engName: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" placeholder="hello@email.com" value={account.email}
                    onChange={e => setAccount(p => ({ ...p, email: e.target.value }))} />
                </div>

                <div>
                  <label style={labelStyle}>Password</label>
                  <input style={inputStyle} type="password" placeholder={t.signup.passwordPlaceholder} value={account.password}
                    onChange={e => setAccount(p => ({ ...p, password: e.target.value }))} />
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

              <button onClick={() => setStep(2)} style={{
                marginTop: "44px", width: "100%", background: "var(--text)", color: "#fff",
                border: "none", padding: "16px", fontSize: "12px",
                letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
              }}>
                {t.signup.next} →
              </button>
            </div>
          )}

          {/* Step 2: Profile */}
          {step === 2 && (
            <div>
              <h2 className="font-display" style={{ fontSize: "36px", fontWeight: 400, marginBottom: "8px" }}>
                {t.signup.steps.profile}
              </h2>
              <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "44px" }}>{t.signup.steps.profileSub}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                <div>
                  <label style={labelStyle}>Gender</label>
                  <div style={{ display: "flex", gap: "0" }}>
                    {["Female", "Male"].map(g => (
                      <button key={g} type="button" onClick={() => setProfile(p => ({ ...p, gender: g as "Male" | "Female" }))} style={{
                        flex: 1, padding: "13px", border: "1px solid var(--border)",
                        borderRight: g === "Female" ? "none" : "1px solid var(--border)",
                        background: profile.gender === g ? "var(--text)" : "#fff",
                        color: profile.gender === g ? "#fff" : "var(--muted)",
                        fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase",
                        cursor: "pointer",
                      }}>{g}</button>
                    ))}
                  </div>
                </div>

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

              <div style={{ display: "flex", gap: "12px", marginTop: "44px" }}>
                <button onClick={() => setStep(1)} style={{
                  flex: 1, background: "#fff", color: "var(--text)", border: "1px solid var(--border)",
                  padding: "16px", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
                }}>← {t.signup.back}</button>
                <button onClick={() => setStep(3)} style={{
                  flex: 2, background: "var(--text)", color: "#fff", border: "none",
                  padding: "16px", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
                }}>{t.signup.next} →</button>
              </div>
            </div>
          )}

          {/* Step 3: Measurements */}
          {step === 3 && (
            <div>
              <h2 className="font-display" style={{ fontSize: "36px", fontWeight: 400, marginBottom: "8px" }}>
                {t.signup.steps.measurements}
              </h2>
              <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "44px" }}>{t.signup.steps.measurementsSub}</p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "32px 24px" }}>
                {[
                  { key: "birthYear", label: "Birth Year", min: 1970, max: 2008, unit: "" },
                  { key: "height", label: "Height", min: 155, max: 195, unit: "cm" },
                  { key: "weight", label: "Weight", min: 40, max: 90, unit: "kg" },
                  { key: "shoeSize", label: "Shoe Size", min: 220, max: 290, unit: "mm" },
                  { key: "bust", label: "Bust", min: 28, max: 42, unit: "in" },
                  { key: "waist", label: "Waist", min: 20, max: 36, unit: "in" },
                  { key: "hip", label: "Hip", min: 30, max: 46, unit: "in" },
                ].map(f => (
                  <div key={f.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                    <label style={{ ...labelStyle, textAlign: "center" }}>{f.label}</label>
                    <NumberScroll
                      min={f.min} max={f.max}
                      value={measurements[f.key as keyof typeof measurements]}
                      onChange={v => setMeasurements(p => ({ ...p, [f.key]: v }))}
                      unit={f.unit}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "52px", padding: "24px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "16px" }}>{t.signup.summary}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 32px", fontSize: "13px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--muted)" }}>Name</span>
                    <span>{account.engName || "—"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--muted)" }}>Gender</span>
                    <span>{profile.gender || "—"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--muted)" }}>Height</span>
                    <span>{measurements.height}cm</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--muted)" }}>Bust / Waist / Hip</span>
                    <span>{measurements.bust} / {measurements.waist} / {measurements.hip} in</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--muted)" }}>Hair</span>
                    <span>{profile.hairColor || "—"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--muted)" }}>Eyes</span>
                    <span>{profile.eyeColor || "—"}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
                <button onClick={() => setStep(2)} style={{
                  flex: 1, background: "#fff", color: "var(--text)", border: "1px solid var(--border)",
                  padding: "16px", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
                }}>← {t.signup.back}</button>
                <button onClick={() => alert("가입 완료! (Supabase 연결 후 실제 저장됩니다)")} style={{
                  flex: 2, background: "var(--text)", color: "#fff", border: "none",
                  padding: "16px", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
                }}>{t.signup.complete}</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
