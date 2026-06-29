import Nav from "./components/Nav";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getT } from "@/lib/i18n";

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

  const locale = await getLocale();
  const t = getT(locale);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)" }}>
      <Nav />

      {/* Hero */}
      <section style={{
        position: "relative", minHeight: "100vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "160px 24px 80px",
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
            fontSize: "clamp(24px, 4.5vw, 62px)", fontWeight: 400,
            lineHeight: 1.1, letterSpacing: "-0.01em", marginBottom: "36px", maxWidth: "900px", color: "#fff",
          }}>
            {t.home.hero.title.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </h1>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.65)", lineHeight: 1.9, maxWidth: "380px", marginBottom: "56px", letterSpacing: "0.01em" }}>
            {t.home.hero.subtitle.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </p>
          <div style={{ display: "flex", gap: "0", alignItems: "center", justifyContent: "center" }}>
            <Link href="/comcard" style={{
              background: "#fff", color: "#0A0A0A", padding: "16px 44px",
              textDecoration: "none", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase",
            }}>
              {t.home.hero.getStarted}
            </Link>
            <Link href="/gallery" style={{
              color: "rgba(255,255,255,0.8)", padding: "16px 32px",
              textDecoration: "none", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase",
              border: "1px solid rgba(255,255,255,0.3)", borderLeft: "none",
            }}>
              {t.home.hero.viewGallery}
            </Link>
          </div>
        </div>
      </section>

      {/* Gallery Preview — 공개 모델 있을 때만 표시 */}
      {displayModels && displayModels.length > 0 && <section id="gallery" className="home-section-pad">
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "56px", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <p style={{ fontSize: "11px", letterSpacing: "0.24em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "12px" }}>Gallery</p>
              <h2 className="font-display" style={{ fontSize: "clamp(24px, 2.8vw, 42px)", fontWeight: 400, lineHeight: 1.1 }}>
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
            <div className="home-gallery-grid" style={{ marginBottom: 0 }}>
              {displayModels.map((model) => {
                const sizes = [model.chest, model.waist, model.hip].filter(Boolean).join(" / ");
                return (
                  <Link key={model.id} href={`/model/${model.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ cursor: "pointer" }}>
                      <div style={{ aspectRatio: "3/4", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)" }}>
                        {model.photo_url
                          ? <img src={model.photo_url} alt={model.eng_name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          : <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                              <span style={{ fontSize: "24px", color: "var(--border)" }}>◈</span>
                              <span style={{ fontSize: "10px", letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase" }}>No Photo</span>
                            </div>
                        }
                      </div>
                      <div style={{ padding: "16px 0 24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <h3 className="font-display" style={{ fontSize: "18px", fontWeight: 400 }}>
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
          ) : null}
        </div>
      </section>}


      {/* Features */}
      <section id="features" className="home-section-pad" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "72px" }} className="home-features-title-gap">
            <p style={{ fontSize: "11px", letterSpacing: "0.24em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "12px" }}>Features</p>
            <h2 className="font-display" style={{ fontSize: "clamp(24px, 2.8vw, 42px)", fontWeight: 400, lineHeight: 1.1 }}>
              Everything you need, in one place
            </h2>
          </div>

          <div className="home-features-grid">
            {[
              {
                num: "01", title: "Comp Card", link: "/comcard",
                desc: t.home.features.compCardDesc,
              },
              {
                num: "02", title: "Portfolio", link: "/model/emma-j",
                desc: t.home.features.portfolioDesc,
              },
              {
                num: "03", title: "Browse", link: "/gallery",
                desc: t.home.features.browseDesc,
              },
            ].map((f, i) => (
              <Link key={i} href={f.link} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  padding: "48px 44px", borderRight: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)", height: "100%",
                }}>
                  <span style={{ fontSize: "11px", letterSpacing: "0.2em", color: "var(--muted)", display: "block", marginBottom: "32px" }}>{f.num}</span>
                  <h3 className="font-display" style={{ fontSize: "28px", fontWeight: 400, marginBottom: "20px", lineHeight: 1.2 }}>
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
          <div className="home-cta-img" style={{ aspectRatio: "3/4", overflow: "hidden" }}>
            <img src="/model.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
          <div>
            <p style={{ fontSize: "11px", letterSpacing: "0.24em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "20px" }}>
              Become a Model
            </p>
            <h2 className="font-display" style={{ fontSize: "clamp(24px, 2.8vw, 42px)", fontWeight: 400, lineHeight: 1.1, marginBottom: "28px" }}>
              {t.home.becomeModel.title.split('\n').map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))}
            </h2>
            <p style={{ fontSize: "15px", color: "var(--muted)", lineHeight: 1.9, marginBottom: "44px" }}>
              {t.home.becomeModel.subtitle}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0", marginBottom: "48px", borderTop: "1px solid var(--border)" }}>
              {[
                t.home.becomeModel.step1,
                t.home.becomeModel.step2,
                t.home.becomeModel.step3,
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
              {t.home.becomeModel.startFree}
            </Link>
          </div>
        </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="home-section-pad" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.24em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "20px" }}>Contact</p>
          <h2 className="font-display" style={{ fontSize: "clamp(24px, 2.8vw, 42px)", fontWeight: 400, marginBottom: "20px", lineHeight: 1.1 }}>
            {t.home.contact.title}
          </h2>
          <p style={{ fontSize: "15px", color: "var(--muted)", lineHeight: 1.8, marginBottom: "52px" }}>
            {t.home.contact.subtitle}
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
        <span className="font-display" style={{ fontSize: "18px", fontWeight: 400 }}>myfolio</span>
        <div className="home-footer-links">
          <a href="#" style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", textDecoration: "none" }}>{t.home.footer.terms}</a>
          <a href="#" style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", textDecoration: "none" }}>{t.home.footer.privacy}</a>
          <a href="#contact" style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", textDecoration: "none" }}>{t.home.footer.contact}</a>
        </div>
        <p style={{ fontSize: "11px", color: "var(--muted)", letterSpacing: "0.08em" }}>© 2025 myfolio</p>
      </footer>
    </div>
  );
}
