"use client";
import { useState, useRef, useEffect } from "react";

const countries = [
  { code: "KR", name: "대한민국", dial: "+82", flag: "🇰🇷" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "JP", name: "日本", dial: "+81", flag: "🇯🇵" },
  { code: "CN", name: "中国", dial: "+86", flag: "🇨🇳" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Deutschland", dial: "+49", flag: "🇩🇪" },
  { code: "IT", name: "Italia", dial: "+39", flag: "🇮🇹" },
  { code: "ES", name: "España", dial: "+34", flag: "🇪🇸" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "BR", name: "Brasil", dial: "+55", flag: "🇧🇷" },
  { code: "MX", name: "México", dial: "+52", flag: "🇲🇽" },
  { code: "RU", name: "Россия", dial: "+7", flag: "🇷🇺" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "TH", name: "ไทย", dial: "+66", flag: "🇹🇭" },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { code: "HK", name: "Hong Kong", dial: "+852", flag: "🇭🇰" },
  { code: "TW", name: "台灣", dial: "+886", flag: "🇹🇼" },
  { code: "VN", name: "Việt Nam", dial: "+84", flag: "🇻🇳" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { code: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { code: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { code: "NL", name: "Nederland", dial: "+31", flag: "🇳🇱" },
  { code: "SE", name: "Sverige", dial: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norge", dial: "+47", flag: "🇳🇴" },
  { code: "DK", name: "Danmark", dial: "+45", flag: "🇩🇰" },
  { code: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { code: "PL", name: "Polska", dial: "+48", flag: "🇵🇱" },
  { code: "TR", name: "Türkiye", dial: "+90", flag: "🇹🇷" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "AE", name: "UAE", dial: "+971", flag: "🇦🇪" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { code: "CL", name: "Chile", dial: "+56", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", dial: "+57", flag: "🇨🇴" },
  { code: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
  { code: "UA", name: "Україна", dial: "+380", flag: "🇺🇦" },
];

interface Props {
  value: string;
  onChange: (dial: string) => void;
}

export default function CountryCodeSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = countries.find(c => c.dial === value) ?? countries[0];

  const filtered = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "12px 14px", border: "1px solid var(--border)",
          borderRight: "none", background: "var(--surface)",
          cursor: "pointer", fontSize: "14px", whiteSpace: "nowrap",
          height: "100%",
        }}
      >
        <span>{selected.flag}</span>
        <span style={{ color: "var(--text)" }}>{selected.dial}</span>
        <span style={{ fontSize: "10px", color: "var(--muted)", marginLeft: "2px" }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 100,
          background: "#fff", border: "1px solid var(--border)",
          width: "260px", maxHeight: "320px", overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "#fff" }}>
            <input
              type="text"
              placeholder="국가 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{
                width: "100%", padding: "8px 12px", border: "1px solid var(--border)",
                fontSize: "13px", outline: "none", background: "var(--surface)",
              }}
            />
          </div>
          {filtered.map(c => (
            <button
              key={c.code}
              type="button"
              onClick={() => { onChange(c.dial); setOpen(false); setSearch(""); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 14px", border: "none", background: c.dial === value ? "var(--surface)" : "#fff",
                cursor: "pointer", fontSize: "13px", textAlign: "left",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: "18px" }}>{c.flag}</span>
              <span style={{ flex: 1, color: "var(--text)" }}>{c.name}</span>
              <span style={{ color: "var(--muted)" }}>{c.dial}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
