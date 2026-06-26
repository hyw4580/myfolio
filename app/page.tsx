import Nav from "./components/Nav";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: models } = await supabase
    .from("profiles")
    .select("id, eng_name, kor_name, height, hair, chest, waist, hip, photo_url")
    .eq("is_public", true)
    .not("eng_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);

  const displayModels = (models && models.length > 0) ? models : null;
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)" }}>
      <Nav />

      {/* Hero */}
      <section style={{
        position: "relative", minHeight: "100vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "120px 24px 100px",
        borderBottom: "1px solid var(--border)",
      }}>
        {/* Background video */}
        <video
          autoPlay muted loop playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        {/* Dark overlay */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.52)", zIndex: 1 }} />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.24em", color: "rgba(255,255,255,0.55)", textTransform: "uppercase", marginBottom: "32px" }}>
            Model Digital Portfolio
          </p>
          <h1 className="font-display" style={{
            fontSize: "clamp(64px, 10vw, 120px)", fontWeight: 300, fontStyle: "italic",
            lineHeight: 1.0, letterSpacing: "-0.02em", marginBottom: "36px", maxWidth: "900px", color: "#fff",
          }}>
            모델의 첫인상을<br />완성하다
          </h1>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.65)", lineHeight: 1.9, maxWidth: "380px", marginBottom: "56px", letterSpacing: "0.01em" }}>
            컴카드부터 개인 포트폴리오 페이지까지,<br />myfolio 하나로 나를 세상에 보여주세요.
          </p>
          <div style={{ display: "flex", gap: "0", alignItems: "center", justifyContent: "center" }}>
            <Link href="/comcard" style={{
              background: "#fff", color: "#0A0A0A", padding: "16px 44px",
              textDecoration: "none", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase",
            }}>
              시작하기
            </Link>
            <Link href="/gallery" style={{
              color: "rgba(255,255,255,0.8)", padding: "16px 32px",
              textDecoration: "none", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase",
              border: "1px solid rgba(255,255,255,0.3)", borderLeft: "none",
            }}>
              갤러리 보기
            </Link>
          </div>
        </div>
      </section>

      {/* Gallery Preview */}
      <section id="gallery" className="home-section-pad">
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "56px", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <p style={{ fontSize: "11px", letterSpacing: "0.24em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "12px" }}>Gallery</p>
              <h2 className="font-display" style={{ fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 300, fontStyle: "italic", lineHeight: 1.1 }}>
                Models on myfolio
              </h2>
            </div>
            <Link href="/gallery" style={{
              fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase",
              color: "var(--muted)", textDecoration: "none", borderBottom: "1px solid var(--border)", paddingBottom: "2px",
            }}>
              View All
            </Link>
          </div>

          {displayModels ? (
            <div className="home-gallery-grid">
              {displayModels.map((model) => {
                const sizes = [model.chest, model.waist, model.hip].filter(Boolean).join(" / ");
                return (
                  <Link key={model.id} href={`/model/${model.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ cursor: "pointer" }}>
                      <div style={{ aspectRatio: "2/3", overflow: "hidden", background: "var(--surface)" }}>
                        {model.photo_url
                          ? <img src={model.photo_url} alt={model.eng_name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: "11px", letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase" }}>No Photo</span>
                            </div>
                        }
                      </div>
                      <div style={{ padding: "16px 0 24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <h3 className="font-display" style={{ fontSize: "18px", fontStyle: "italic", fontWeight: 400 }}>
                            {model.eng_name}
                          </h3>
                          {model.height && <span style={{ fontSize: "12px", color: "var(--muted)" }}>{model.height}cm</span>}
                        </div>
                        {(model.hair || sizes) && (
                          <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", letterSpacing: "0.04em" }}>
                            {[model.hair, sizes].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
              <p style={{ fontSize: "14px", marginBottom: "8px" }}>아직 등록된 모델이 없어요</p>
              <p style={{ fontSize: "12px" }}>마이페이지에서 갤러리 공개를 켜면 여기에 표시돼요</p>
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="home-section-pad" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "72px" }}>
            <p style={{ fontSize: "11px", letterSpacing: "0.24em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "12px" }}>Features</p>
            <h2 className="font-display" style={{ fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 300, fontStyle: "italic", lineHeight: 1.1 }}>
              Everything you need, in one place
            </h2>
          </div>

          <div className="home-features-grid">
            {[
              {
                num: "01", title: "Comp Card", link: "/comcard",
                desc: "원하는 템플릿을 선택하고 정보와 사진을 입력하면 나만의 컴카드가 완성됩니다. PDF 또는 이미지로 즉시 다운로드.",
              },
              {
                num: "02", title: "Portfolio", link: "/model/emma-j",
                desc: "가입하면 나만의 고유 링크가 생성됩니다. 컴카드, 스냅, 영상을 한 페이지에서 클라이언트에게 보여주세요.",
              },
              {
                num: "03", title: "Browse", link: "/gallery",
                desc: "키, 사이즈, 헤어색상 등 원하는 조건으로 등록된 모델을 검색하고 바로 연락할 수 있습니다.",
              },
            ].map((f, i) => (
              <Link key={i} href={f.link} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  padding: "48px 44px", borderRight: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)", height: "100%",
                }}>
                  <span style={{ fontSize: "11px", letterSpacing: "0.2em", color: "var(--muted)", display: "block", marginBottom: "32px" }}>{f.num}</span>
                  <h3 className="font-display" style={{ fontSize: "28px", fontWeight: 400, fontStyle: "italic", marginBottom: "20px", lineHeight: 1.2 }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.9 }}>{f.desc}</p>
                  <p style={{ fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: "36px", color: "var(--text)" }}>Explore →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Become a Model */}
      <section className="home-section-pad">
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div className="home-cta-grid">
          <div className="home-cta-img" style={{ height: "560px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "64px", color: "var(--border)" }}>◈</span>
          </div>
          <div>
            <p style={{ fontSize: "11px", letterSpacing: "0.24em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "20px" }}>
              Become a Model
            </p>
            <h2 className="font-display" style={{ fontSize: "clamp(40px, 4vw, 60px)", fontWeight: 300, fontStyle: "italic", lineHeight: 1.1, marginBottom: "28px" }}>
              지금 바로<br />나를 알려보세요
            </h2>
            <p style={{ fontSize: "15px", color: "var(--muted)", lineHeight: 1.9, marginBottom: "44px" }}>
              컴카드를 직접 만들고, 나만의 포트폴리오 링크를 공유하세요. 클라이언트들이 당신을 찾을 수 있도록 갤러리에 등록할 수도 있어요.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0", marginBottom: "48px", borderTop: "1px solid var(--border)" }}>
              {[
                "정보와 사진을 입력해 컴카드를 만드세요",
                "나만의 링크로 포트폴리오를 공유하세요",
                "공개 설정 후 갤러리에 노출되어 섭외를 받으세요",
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: "24px", alignItems: "center", padding: "20px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)", letterSpacing: "0.1em", minWidth: "20px" }}>0{i + 1}</span>
                  <p style={{ fontSize: "14px", color: "var(--text)", lineHeight: 1.6 }}>{step}</p>
                </div>
              ))}
            </div>
            <Link href="/comcard" style={{
              display: "inline-block", background: "var(--text)", color: "#fff",
              padding: "16px 44px", textDecoration: "none",
              fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase",
            }}>
              무료로 시작하기
            </Link>
          </div>
        </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="home-section-pad" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.24em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "20px" }}>Contact</p>
          <h2 className="font-display" style={{ fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 300, fontStyle: "italic", marginBottom: "20px", lineHeight: 1.1 }}>
            궁금한 점이 있으신가요?
          </h2>
          <p style={{ fontSize: "15px", color: "var(--muted)", lineHeight: 1.8, marginBottom: "52px" }}>
            서비스 이용, 파트너십, 기타 문의사항은 아래로 연락해주세요.
          </p>
          <div style={{ display: "flex", gap: "0", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="mailto:hello@myfolio.com" style={{
              padding: "16px 36px", textDecoration: "none", color: "var(--text)",
              fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase",
              border: "1px solid var(--border)", background: "#fff",
            }}>
              hello@myfolio.com
            </a>
            <a href="#" style={{
              padding: "16px 36px", textDecoration: "none", color: "var(--text)",
              fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase",
              border: "1px solid var(--border)", background: "#fff",
            }}>
              Instagram
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="font-display" style={{ fontSize: "18px", fontWeight: 400, fontStyle: "italic" }}>myfolio</span>
        <div className="home-footer-links">
          <a href="#" style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", textDecoration: "none" }}>이용약관</a>
          <a href="#" style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", textDecoration: "none" }}>개인정보처리방침</a>
          <a href="#contact" style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", textDecoration: "none" }}>문의</a>
        </div>
        <p style={{ fontSize: "11px", color: "var(--muted)", letterSpacing: "0.08em" }}>© 2025 myfolio</p>
      </footer>
    </div>
  );
}
