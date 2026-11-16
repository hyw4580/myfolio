"use client";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

/** 서버 화면(공유 카드·명함)에서 "봤다"를 기록 */
export function TrackView({ kind }: { kind: "card" | "profile" }) {
  useEffect(() => { track("public_view", { kind }); }, [kind]);
  return null;
}

/** 누르면 기록하는 링크 (연락처 저장 등) */
export function TrackLink({ event, href, style, children }: { event: "vcard_downloaded"; href: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return <a href={href} style={style} onClick={() => track(event, {})}>{children}</a>;
}
