"use client";
import { useRef, useEffect } from "react";

interface Props {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
}

export default function NumberScroll({ min, max, value, onChange, unit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 44;
  const visibleCount = 5;

  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const idx = value - min;
    el.scrollTop = idx * itemHeight;
  }, [value, min]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / itemHeight);
    const clamped = Math.max(0, Math.min(numbers.length - 1, idx));
    onChange(numbers[clamped]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      <div style={{ position: "relative", width: "90px" }}>
        <div
          ref={containerRef}
          onScroll={handleScroll}
          style={{
            height: `${itemHeight * visibleCount}px`,
            overflowY: "scroll",
            scrollSnapType: "y mandatory",
            scrollbarWidth: "none",
            position: "relative",
          }}
        >
          <div style={{ height: `${itemHeight * 2}px` }} />
          {numbers.map((n) => (
            <div
              key={n}
              style={{
                height: `${itemHeight}px`,
                scrollSnapAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: n === value ? "20px" : "15px",
                fontWeight: n === value ? 600 : 400,
                color: n === value ? "var(--accent)" : "var(--muted)",
                cursor: "pointer",
                transition: "all 0.15s",
                userSelect: "none",
              }}
              onClick={() => {
                onChange(n);
                containerRef.current!.scrollTo({ top: (n - min) * itemHeight, behavior: "smooth" });
              }}
            >
              {n}
            </div>
          ))}
          <div style={{ height: `${itemHeight * 2}px` }} />
        </div>
        {/* center highlight */}
        <div style={{
          position: "absolute",
          top: `${itemHeight * 2}px`,
          left: 0, right: 0,
          height: `${itemHeight}px`,
          borderTop: "1px solid var(--accent-light)",
          borderBottom: "1px solid var(--accent-light)",
          background: "rgba(124,111,205,0.06)",
          pointerEvents: "none",
          borderRadius: "8px",
        }} />
      </div>
      {unit && <span style={{ fontSize: "12px", color: "var(--muted)" }}>{unit}</span>}
    </div>
  );
}
