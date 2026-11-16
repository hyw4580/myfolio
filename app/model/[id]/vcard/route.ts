import { getPublicProfile } from "@/lib/public-profile";

/** vCard 값 이스케이프 (\ , ; 줄바꿈) */
const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

/**
 * "연락처 저장": 휴대폰 연락처에 바로 추가되는 vCard 파일.
 * 모델이 공개한 정보(전화·인스타·공개 설정한 이메일)만 담는다.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const p = await getPublicProfile(param); // 공개 설정한 항목만 (이메일은 공개했을 때만)
  if (!p) return new Response("Not found", { status: 404 });

  const origin = new URL(request.url).origin;
  const pageUrl = `${origin}${p.slug ? `/${p.slug}` : `/model/${p.id}`}`;
  const name = p.eng_name || p.kor_name || "Model";
  const display = p.kor_name && p.eng_name ? `${p.eng_name} (${p.kor_name})` : name;
  const note = [
    p.height ? `${p.height}cm` : "",
    p.chest && p.waist && p.hip ? `${p.chest}-${p.waist}-${p.hip}` : "",
    p.shoe_size ? `Shoe ${p.shoe_size}mm` : "",
  ].filter(Boolean).join(" · ");
  const ig = p.instagram ? p.instagram.replace(/^@/, "") : "";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:;${esc(name)};;;`,
    `FN:${esc(display)}`,
    "TITLE:Model",
    p.tel ? `TEL;TYPE=CELL:${esc(p.tel)}` : "",
    p.email ? `EMAIL;TYPE=INTERNET:${esc(p.email)}` : "",
    `URL:${esc(pageUrl)}`,
    ig ? `X-SOCIALPROFILE;TYPE=instagram:${esc(`https://instagram.com/${ig}`)}` : "",
    note ? `NOTE:${esc(`${note} — myfolio`)}` : "NOTE:myfolio",
    "END:VCARD",
  ].filter(Boolean).join("\r\n");

  const file = `${(p.eng_name || "model").replace(/[^A-Za-z0-9_-]+/g, "_")}.vcf`;
  return new Response(lines + "\r\n", {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "no-store",
    },
  });
}
