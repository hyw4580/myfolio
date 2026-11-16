import { redirect } from "next/navigation";
import { publicReadClient, sanitizeProfile } from "@/lib/public-profile";
import { FEATURES } from "@/lib/features";
import GalleryClient, { type GalleryModel } from "./GalleryClient";

// 공개 설정한 실제 모델 프로필을 불러와 필터 화면에 넘김
export default async function GalleryPage() {
  if (!FEATURES.gallery) redirect("/"); // 갤러리는 아직 숨김
  const db = await publicReadClient(); // 공개 항목만 넘기도록 서버가 대신 조회
  const { data: raw } = await db
    .from("profiles")
    .select("*")
    .eq("is_public", true)
    .not("eng_name", "is", null)
    .order("created_at", { ascending: false });

  const models: GalleryModel[] = (raw ?? []).map(sanitizeProfile)
    .filter(p => (p.eng_name ?? "").trim() !== "")
    .map(p => ({
      id: p.id, slug: p.slug, engName: p.eng_name ?? "", gender: p.gender, birthYear: p.birth_year,
      height: p.height, weight: p.weight, chest: p.chest, waist: p.waist, hip: p.hip,
      shoeSize: p.shoe_size, hair: p.hair, eye: p.eye, photo: p.photo_url,
    }));

  return <GalleryClient models={models} />;
}
