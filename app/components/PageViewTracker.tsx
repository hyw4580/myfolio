"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { rememberRef, track } from "@/lib/analytics";

/** 화면 이동마다 page_view 기록 (주소의 쿼리는 보내지 않음) */
export default function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    const ref = new URLSearchParams(location.search).get("ref");
    rememberRef(ref);
    track("page_view", { ref });
  }, [pathname]);
  return null;
}
