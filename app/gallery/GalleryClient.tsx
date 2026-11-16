"use client";
import { useState } from "react";
import Link from "next/link";
import Nav from "../components/Nav";
import { useT } from "../components/LocaleProvider";
import { profilePath } from "@/lib/slug";

export type GalleryModel = {
  id: string; slug: string | null; engName: string; gender: string | null; birthYear: number | null;
  height: number | null; weight: number | null; chest: number | null; waist: number | null; hip: number | null;
  shoeSize: number | null; hair: string | null; eye: string | null; photo: string | null;
};

const DEFAULTS = {
  birthYear: [1970, new Date().getFullYear() - 10] as [number, number],
  height:    [140, 210] as [number, number],
  weight:    [35, 120]  as [number, number],
  chest:     [26, 50]   as [number, number],
  waist:     [20, 44]   as [number, number],
  hip:       [28, 50]   as [number, number],
  shoeSize:  [210, 310] as [number, number],
};

/** 값이 비어 있는 모델은 해당 필터를 건드리지 않았을 때만 보여줌 */
function inRange(v: number | null, range: [number, number], def: [number, number]) {
  if (v === null || v === 0) return range[0] === def[0] && range[1] === def[1];
  return v >= range[0] && v <= range[1];
}

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

export default function GalleryClient({ models: allModels }: { models: GalleryModel[] }) {
  const t = useT();
  const [filterOpen, setFilterOpen] = useState(false);
  const [gender, setGender] = useState<"All" | "Female" | "Male" | "Non-binary" | "Prefer not to say">("All");
  const [birthYearRange, setBirthYearRange] = useState<[number, number]>(DEFAULTS.birthYear);
  const [heightRange, setHeightRange] = useState<[number, number]>(DEFAULTS.height);
  const [weightRange, setWeightRange] = useState<[number, number]>(DEFAULTS.weight);
  const [chestRange, setChestRange] = useState<[number, number]>(DEFAULTS.chest);
  const [waistRange, setWaistRange] = useState<[number, number]>(DEFAULTS.waist);
  const [hipRange, setHipRange] = useState<[number, number]>(DEFAULTS.hip);
  const [shoeSizeRange, setShoeSizeRange] = useState<[number, number]>(DEFAULTS.shoeSize);
  const [hairFilter, setHairFilter] = useState("");
  const [eyeFilter, setEyeFilter] = useState("");

  const filtered = allModels.filter(m => {
    if (gender !== "All" && m.gender !== gender) return false;
    if (!inRange(m.birthYear, birthYearRange, DEFAULTS.birthYear)) return false;
    if (!inRange(m.height, heightRange, DEFAULTS.height)) return false;
    if (!inRange(m.weight, weightRange, DEFAULTS.weight)) return false;
    if (!inRange(m.chest, chestRange, DEFAULTS.chest)) return false;
    if (!inRange(m.waist, waistRange, DEFAULTS.waist)) return false;
    if (!inRange(m.hip, hipRange, DEFAULTS.hip)) return false;
    if (!inRange(m.shoeSize, shoeSizeRange, DEFAULTS.shoeSize)) return false;
    if (hairFilter && !(m.hair ?? "").toLowerCase().includes(hairFilter.toLowerCase())) return false;
    if (eyeFilter && !(m.eye ?? "").toLowerCase().includes(eyeFilter.toLowerCase())) return false;
    return true;
  });

  const resetAll = () => {
    setGender("All" as const);
    setBirthYearRange(DEFAULTS.birthYear);
    setHeightRange(DEFAULTS.height);
    setWeightRange(DEFAULTS.weight);
    setChestRange(DEFAULTS.chest);
    setWaistRange(DEFAULTS.waist);
    setHipRange(DEFAULTS.hip);
    setShoeSizeRange(DEFAULTS.shoeSize);
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
            <h2 className="font-display" style={{ fontSize: "22px", fontWeight: 500 }}>Filter</h2>
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

          <RangeFilter label="Birth Year" unit="yyyy" value={birthYearRange} onChange={setBirthYearRange} min={DEFAULTS.birthYear[0]} max={DEFAULTS.birthYear[1]} />
          <RangeFilter label="Height" unit="cm" value={heightRange} onChange={setHeightRange} min={DEFAULTS.height[0]} max={DEFAULTS.height[1]} />
          <RangeFilter label="Weight" unit="kg" value={weightRange} onChange={setWeightRange} min={DEFAULTS.weight[0]} max={DEFAULTS.weight[1]} />
          <RangeFilter label="Bust" unit="in" value={chestRange} onChange={setChestRange} min={DEFAULTS.chest[0]} max={DEFAULTS.chest[1]} />
          <RangeFilter label="Waist" unit="in" value={waistRange} onChange={setWaistRange} min={DEFAULTS.waist[0]} max={DEFAULTS.waist[1]} />
          <RangeFilter label="Hip" unit="in" value={hipRange} onChange={setHipRange} min={DEFAULTS.hip[0]} max={DEFAULTS.hip[1]} />
          <RangeFilter label="Shoe Size" unit="mm" value={shoeSizeRange} onChange={setShoeSizeRange} min={DEFAULTS.shoeSize[0]} max={DEFAULTS.shoeSize[1]} />

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
            <h1 className="font-display" style={{ fontSize: "36px", fontWeight: 400 }}>
              Browse Models
            </h1>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button className="gallery-filter-toggle" onClick={() => setFilterOpen(o => !o)}>
                ☰ {filterOpen ? t.gallery.filterOpen : t.gallery.filterClosed}
              </button>
              <span style={{ fontSize: "12px", color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {filtered.length} models
              </span>
            </div>
          </div>

          <div className="gallery-grid">
            {filtered.map(model => (
              <Link key={model.id} href={profilePath(model.slug, model.id)} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ cursor: "pointer" }}>
                  <div style={{ aspectRatio: "3/4", overflow: "hidden", background: "var(--surface)" }}>
                    {model.photo ? (
                      <img src={model.photo} alt={model.engName}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.4s" }}
                        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
                        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--border)", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase" }}>No Photo</div>
                    )}
                  </div>
                  <div style={{ padding: "16px 0 28px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <h3 className="font-display" style={{ fontSize: "20px", fontWeight: 400 }}>
                        {model.engName}
                      </h3>
                      {model.height ? <span style={{ fontSize: "12px", color: "var(--muted)" }}>{model.height}cm</span> : null}
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", letterSpacing: "0.04em" }}>
                      {[model.hair, model.chest && model.waist && model.hip ? `${model.chest}/${model.waist}/${model.hip} in` : null].filter(Boolean).join(" · ") || "\u00a0"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
              <p style={{ fontSize: "40px", marginBottom: "16px", opacity: 0.2 }}>◎</p>
              <p style={{ fontSize: "15px" }}>{t.gallery.noModels}</p>
              <p style={{ fontSize: "13px", marginTop: "8px" }}>{t.gallery.adjustFilters}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
