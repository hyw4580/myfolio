"use client";
import { useState } from "react";
import Link from "next/link";
import Nav from "../components/Nav";

const allModels = [
  { id: "emma-j", engName: "Emma Johnson", gender: "Female", birthYear: 2001, height: 175, weight: 52, chest: 34, waist: 24, hip: 35, shoeSize: 250, hair: "Black", eye: "Dark Brown", photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=800&fit=crop&q=80" },
  { id: "sophia-p", engName: "Sophia Park", gender: "Female", birthYear: 1999, height: 172, weight: 50, chest: 32, waist: 23, hip: 34, shoeSize: 245, hair: "Brown", eye: "Black", photo: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=800&fit=crop&q=80" },
  { id: "mia-k", engName: "Mia Kim", gender: "Female", birthYear: 2003, height: 170, weight: 54, chest: 34, waist: 25, hip: 36, shoeSize: 240, hair: "Blonde", eye: "Brown", photo: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop&q=80" },
  { id: "yuna-l", engName: "Yuna Lee", gender: "Female", birthYear: 2000, height: 173, weight: 51, chest: 33, waist: 23, hip: 35, shoeSize: 245, hair: "Dark Brown", eye: "Black", photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&q=80" },
  { id: "rina-c", engName: "Rina Choi", gender: "Female", birthYear: 1998, height: 176, weight: 53, chest: 34, waist: 24, hip: 35, shoeSize: 250, hair: "Black", eye: "Dark Brown", photo: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&fit=crop&q=80" },
  { id: "luna-h", engName: "Luna Han", gender: "Female", birthYear: 2002, height: 171, weight: 49, chest: 32, waist: 22, hip: 34, shoeSize: 235, hair: "Light Brown", eye: "Brown", photo: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&h=800&fit=crop&q=80" },
  { id: "jimin-k", engName: "Jimin Kim", gender: "Male", birthYear: 1997, height: 183, weight: 72, chest: 38, waist: 31, hip: 37, shoeSize: 275, hair: "Black", eye: "Black", photo: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&h=800&fit=crop&q=80" },
  { id: "taek-p", engName: "Taek Park", gender: "Male", birthYear: 1999, height: 180, weight: 68, chest: 37, waist: 30, hip: 37, shoeSize: 270, hair: "Dark Brown", eye: "Dark Brown", photo: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=600&h=800&fit=crop&q=80" },
  { id: "seo-l", engName: "Seojun Lee", gender: "Male", birthYear: 2001, height: 178, weight: 65, chest: 36, waist: 29, hip: 36, shoeSize: 265, hair: "Black", eye: "Black", photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=800&fit=crop&q=80" },
];

const sectionStyle = {
  marginBottom: "24px",
  paddingBottom: "24px",
  borderBottom: "1px solid var(--border)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px", letterSpacing: "0.14em", color: "var(--muted)",
  textTransform: "uppercase", display: "block", marginBottom: "10px",
};

const numInputStyle: React.CSSProperties = {
  width: "76px", padding: "8px 10px",
  border: "1px solid var(--border)", fontSize: "13px",
  outline: "none", color: "var(--text)", background: "#fff",
};

const textInputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  border: "1px solid var(--border)", fontSize: "13px",
  outline: "none", color: "var(--text)", background: "#fff",
};

function RangeFilter({ label, unit, value, onChange, min, max }: {
  label: string; unit: string;
  value: [number, number]; onChange: (v: [number, number]) => void;
  min: number; max: number;
}) {
  return (
    <div style={sectionStyle}>
      <p style={labelStyle}>{label} <span style={{ opacity: 0.5 }}>({unit})</span></p>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input type="number" min={min} max={max} value={value[0]}
          onChange={e => onChange([Number(e.target.value), value[1]])}
          style={numInputStyle} />
        <span style={{ color: "var(--border)" }}>—</span>
        <input type="number" min={min} max={max} value={value[1]}
          onChange={e => onChange([value[0], Number(e.target.value)])}
          style={numInputStyle} />
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [gender, setGender] = useState<"All" | "Female" | "Male" | "Non-binary" | "Prefer not to say">("All");
  const [birthYearRange, setBirthYearRange] = useState<[number, number]>([1970, 2008]);
  const [heightRange, setHeightRange] = useState<[number, number]>([155, 195]);
  const [weightRange, setWeightRange] = useState<[number, number]>([40, 90]);
  const [chestRange, setChestRange] = useState<[number, number]>([28, 42]);
  const [waistRange, setWaistRange] = useState<[number, number]>([20, 36]);
  const [hipRange, setHipRange] = useState<[number, number]>([30, 46]);
  const [shoeSizeRange, setShoeSizeRange] = useState<[number, number]>([220, 290]);
  const [hairFilter, setHairFilter] = useState("");
  const [eyeFilter, setEyeFilter] = useState("");

  const filtered = allModels.filter(m => {
    if (gender !== "All" && m.gender !== gender) return false;
    if (m.birthYear < birthYearRange[0] || m.birthYear > birthYearRange[1]) return false;
    if (m.height < heightRange[0] || m.height > heightRange[1]) return false;
    if (m.weight < weightRange[0] || m.weight > weightRange[1]) return false;
    if (m.chest < chestRange[0] || m.chest > chestRange[1]) return false;
    if (m.waist < waistRange[0] || m.waist > waistRange[1]) return false;
    if (m.hip < hipRange[0] || m.hip > hipRange[1]) return false;
    if (m.shoeSize < shoeSizeRange[0] || m.shoeSize > shoeSizeRange[1]) return false;
    if (hairFilter && !m.hair.toLowerCase().includes(hairFilter.toLowerCase())) return false;
    if (eyeFilter && !m.eye.toLowerCase().includes(eyeFilter.toLowerCase())) return false;
    return true;
  });

  const resetAll = () => {
    setGender("All" as const);
    setBirthYearRange([1970, 2008]);
    setHeightRange([155, 195]);
    setWeightRange([40, 90]);
    setChestRange([28, 42]);
    setWaistRange([20, 36]);
    setHipRange([30, 46]);
    setShoeSizeRange([220, 290]);
    setHairFilter("");
    setEyeFilter("");
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />
      <div style={{ paddingTop: "80px" }} className="gallery-layout">

        {/* Filter sidebar */}
        <aside className={`gallery-sidebar${filterOpen ? " open" : ""}`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "32px" }}>
            <h2 className="font-display" style={{ fontSize: "22px", fontStyle: "italic", fontWeight: 500 }}>Filter</h2>
            <button onClick={resetAll} style={{
              fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase",
              border: "none", background: "none", color: "var(--muted)", cursor: "pointer", textDecoration: "underline",
            }}>Reset</button>
          </div>

          {/* Gender */}
          <div style={sectionStyle}>
            <p style={labelStyle}>Gender</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {([
                { value: "All",              label: "All" },
                { value: "Female",           label: "Female" },
                { value: "Male",             label: "Male" },
                { value: "Non-binary",       label: "Non-binary" },
                { value: "Prefer not to say",label: "Prefer not to say" },
              ] as const).map(({ value, label }, i) => (
                <button key={value} onClick={() => setGender(value)} style={{
                  padding: "8px 12px", fontSize: "11px", cursor: "pointer", textAlign: "left",
                  border: "1px solid var(--border)",
                  borderTop: i === 0 ? "1px solid var(--border)" : "none",
                  background: gender === value ? "var(--text)" : "#fff",
                  color: gender === value ? "#fff" : "var(--muted)",
                  letterSpacing: "0.08em",
                }}>{label}</button>
              ))}
            </div>
          </div>

          <RangeFilter label="Birth Year" unit="yyyy" value={birthYearRange} onChange={setBirthYearRange} min={1970} max={2008} />
          <RangeFilter label="Height" unit="cm" value={heightRange} onChange={setHeightRange} min={155} max={195} />
          <RangeFilter label="Weight" unit="kg" value={weightRange} onChange={setWeightRange} min={40} max={90} />
          <RangeFilter label="Bust" unit="in" value={chestRange} onChange={setChestRange} min={28} max={42} />
          <RangeFilter label="Waist" unit="in" value={waistRange} onChange={setWaistRange} min={20} max={36} />
          <RangeFilter label="Hip" unit="in" value={hipRange} onChange={setHipRange} min={30} max={46} />
          <RangeFilter label="Shoe Size" unit="mm" value={shoeSizeRange} onChange={setShoeSizeRange} min={220} max={290} />

          {/* Hair Color */}
          <div style={sectionStyle}>
            <p style={labelStyle}>Hair Color</p>
            <input type="text" placeholder="e.g. Black, Brown" value={hairFilter}
              onChange={e => setHairFilter(e.target.value)} style={textInputStyle} />
          </div>

          {/* Eye Color */}
          <div style={{ marginBottom: "8px" }}>
            <p style={labelStyle}>Eye Color</p>
            <input type="text" placeholder="e.g. Black, Brown" value={eyeFilter}
              onChange={e => setEyeFilter(e.target.value)} style={textInputStyle} />
          </div>
        </aside>

        {/* Model grid */}
        <main className="gallery-main">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "36px", flexWrap: "wrap", gap: "12px" }}>
            <h1 className="font-display" style={{ fontSize: "36px", fontStyle: "italic", fontWeight: 400 }}>
              Browse Models
            </h1>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button className="gallery-filter-toggle" onClick={() => setFilterOpen(o => !o)}>
                ☰ {filterOpen ? "필터 닫기" : "필터"}
              </button>
              <span style={{ fontSize: "12px", color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {filtered.length} models
              </span>
            </div>
          </div>

          <div className="gallery-grid">
            {filtered.map(model => (
              <Link key={model.id} href={`/model/${model.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ cursor: "pointer" }}>
                  <div style={{ aspectRatio: "3/4", overflow: "hidden" }}>
                    <img src={model.photo} alt={model.engName}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.4s" }}
                      onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
                      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                    />
                  </div>
                  <div style={{ padding: "16px 0 28px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <h3 className="font-display" style={{ fontSize: "20px", fontStyle: "italic", fontWeight: 400 }}>
                        {model.engName}
                      </h3>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>{model.height}cm</span>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", letterSpacing: "0.04em" }}>
                      {model.hair} · {model.chest}/{model.waist}/{model.hip} in
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
              <p style={{ fontSize: "40px", marginBottom: "16px", opacity: 0.2 }}>◎</p>
              <p style={{ fontSize: "15px" }}>No models found.</p>
              <p style={{ fontSize: "13px", marginTop: "8px" }}>Try adjusting the filters.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
