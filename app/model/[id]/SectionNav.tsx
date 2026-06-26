"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const font = "var(--font-inter), var(--font-korean), sans-serif";

const pill: React.CSSProperties = {
  display: "inline-block", padding: "8px 16px", borderRadius: "999px",
  background: "#111", color: "#fff", fontSize: "11px",
  letterSpacing: "0.1em", textTransform: "uppercase",
  textDecoration: "none", fontWeight: 600, fontFamily: font,
  whiteSpace: "nowrap",
};

export default function SectionNav({ userId, hasGallery, hasSnaps, hasCompCard, hasVideo }: {
  userId: string;
  hasGallery: boolean;
  hasSnaps: boolean;
  hasCompCard: boolean;
  hasVideo: boolean;
}) {
  const [isOwner, setIsOwner] = useState(false);
  const isPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1";

  useEffect(() => {
    if (isPreview) return;
    createClient().auth.getUser().then(({ data }) => {
      if (data.user?.id === userId) setIsOwner(true);
    });
  }, [userId]);

  const show = isOwner && !isPreview;

  const sections = [
    { href: "#gallery",  label: "GALLERY",   visible: show || hasGallery  },
    { href: "#snaps",    label: "SNAPS",      visible: show || hasSnaps    },
    { href: "#compcard", label: "COMP CARD",  visible: show || hasCompCard },
    { href: "#video",    label: "VIDEO",      visible: show || hasVideo    },
  ];

  const visibleSections = sections.filter(s => s.visible);
  if (visibleSections.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", gap: "10px", alignItems: "center" }}>
      {visibleSections.map(s => (
        <a key={s.href} href={s.href} style={pill}>{s.label}</a>
      ))}
    </div>
  );
}
