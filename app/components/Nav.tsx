"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function Nav() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser]       = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 스크롤하면 모바일 메뉴 닫기
  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const linkStyle = (active = false): React.CSSProperties => ({
    fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase",
    color: active ? "var(--text)" : "var(--muted)", textDecoration: "none",
  });

  return (
    <>
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "20px 56px", position: "fixed", top: 0, left: 0, right: 0,
        zIndex: 50, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--border)",
      }}
        className="nav-bar"
      >
        <Link href="/" className="font-display" style={{
          fontSize: "20px", fontWeight: 400, fontStyle: "italic",
          letterSpacing: "0.04em", textDecoration: "none", color: "var(--text)",
        }}>
          myfolio
        </Link>

        {/* 데스크탑 메뉴 */}
        <div className="nav-desktop" style={{ display: "flex", gap: "40px", alignItems: "center" }}>
          <Link href="/gallery"  style={linkStyle(pathname === "/gallery")}>Gallery</Link>
          <Link href="/comcard"  style={linkStyle(pathname === "/comcard")}>Comp Card</Link>
          <Link href="/#contact" style={linkStyle()}>Contact</Link>
          {user ? (
            <>
              <Link href="/mypage" style={linkStyle(pathname === "/mypage")}>My Page</Link>
              <button onClick={signOut} style={{ ...linkStyle(), background: "none", border: "none", cursor: "pointer", padding: 0 }}>Logout</button>
            </>
          ) : (
            <Link href="/login" style={linkStyle()}>Login</Link>
          )}
          <Link href="/comcard" style={{
            fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase",
            color: "#fff", textDecoration: "none", background: "var(--text)", padding: "12px 24px",
          }}>Get Started</Link>
        </div>

        {/* 모바일 햄버거 */}
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          style={{ display: "none", background: "none", border: "none", cursor: "pointer", padding: "4px" }}
          aria-label="메뉴"
        >
          <span style={{ display: "block", width: "22px", height: "2px", background: "var(--text)", marginBottom: "5px", transition: "transform 0.2s", transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none" }} />
          <span style={{ display: "block", width: "22px", height: "2px", background: "var(--text)", marginBottom: "5px", opacity: menuOpen ? 0 : 1, transition: "opacity 0.2s" }} />
          <span style={{ display: "block", width: "22px", height: "2px", background: "var(--text)", transition: "transform 0.2s", transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none" }} />
        </button>
      </nav>

      {/* 모바일 드롭다운 메뉴 */}
      {menuOpen && (
        <div className="nav-mobile-menu" style={{
          position: "fixed", top: "61px", left: 0, right: 0, zIndex: 49,
          background: "#fff", borderBottom: "1px solid var(--border)",
          display: "flex", flexDirection: "column", padding: "16px 24px 24px",
          gap: "20px",
        }}>
          <Link href="/gallery"  style={linkStyle(pathname === "/gallery")}  onClick={() => setMenuOpen(false)}>Gallery</Link>
          <Link href="/comcard"  style={linkStyle(pathname === "/comcard")}  onClick={() => setMenuOpen(false)}>Comp Card</Link>
          <Link href="/#contact" style={linkStyle()}                         onClick={() => setMenuOpen(false)}>Contact</Link>
          {user ? (
            <>
              <Link href="/mypage" style={linkStyle(pathname === "/mypage")} onClick={() => setMenuOpen(false)}>My Page</Link>
              <button onClick={() => { setMenuOpen(false); signOut(); }} style={{ ...linkStyle(), background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>Logout</button>
            </>
          ) : (
            <Link href="/login" style={linkStyle()} onClick={() => setMenuOpen(false)}>Login</Link>
          )}
          <Link href="/comcard" style={{
            fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase",
            color: "#fff", textDecoration: "none", background: "var(--text)", padding: "12px 16px", display: "inline-block", alignSelf: "flex-start",
          }} onClick={() => setMenuOpen(false)}>Get Started</Link>
        </div>
      )}
    </>
  );
}
