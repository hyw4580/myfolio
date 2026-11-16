import ContactButtons from "./ContactButtons";
import ShareButtons from "../../components/ShareButtons";
import { TrackLink, TrackView } from "../../components/Track";

/** 포트폴리오 첫 화면: 모델의 디지털 명함 */
export default function BusinessCard({ id, engName, korName, career, photo, tagline, chips, details, instagram, kakaoLink, tel, sharePath }: {
  id: string; engName: string | null; korName: string | null; career: string | null;
  photo: string | null; tagline: string; chips: string[]; details: string[];
  instagram: string | null; kakaoLink: string | null; tel: string | null; sharePath: string;
}) {
  return (
    <section className="bc-outer">
      <TrackView kind="profile" />
      <div className="bc-card">
        <div className="bc-photo">
          {photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photo} alt={engName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px", color: "#c9c4bd", fontFamily: "var(--font-cormorant), serif" }}>
                {(engName ?? "M").slice(0, 1).toUpperCase()}
              </div>}
        </div>

        <div className="bc-info">
          <div>
            <p style={{ fontSize: "10px", letterSpacing: "0.24em", color: "#aaa", textTransform: "uppercase", marginBottom: "10px" }}>Model</p>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1.02, fontFamily: "var(--font-cormorant), serif" }}>
              {engName ?? "—"}
            </h1>
            {korName && <p style={{ fontSize: "14px", color: "#888", marginTop: "6px", letterSpacing: "0.04em" }}>{korName}</p>}
            {tagline && <p style={{ fontSize: "13px", color: "#444", marginTop: "14px", lineHeight: 1.6 }}>{tagline}</p>}
          </div>

          {chips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {chips.map(c => (
                <span key={c} style={{ fontSize: "12px", padding: "6px 11px", border: "1px solid #e4e4e4", borderRadius: "999px", color: "#222", letterSpacing: "0.03em" }}>{c}</span>
              ))}
            </div>
          )}
          {details.length > 0 && (
            <p style={{ fontSize: "11px", color: "#999", lineHeight: 1.8, letterSpacing: "0.04em" }}>
              {details.join(" · ")}
            </p>
          )}

          <ContactButtons
            userId={id}
            instagram={instagram}
            kakaoLink={kakaoLink}
            tel={tel}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <TrackLink event="vcard_downloaded" href={`/model/${id}/vcard`} style={{ display: "block", textAlign: "center", padding: "12px", background: "#fff", color: "#111", border: "1px solid #111", textDecoration: "none", fontSize: "12px", letterSpacing: "0.08em" }}>
              ＋ 연락처 저장
            </TrackLink>
            <ShareButtons path={sharePath} title={`${engName ?? "모델"} · myfolio`} text="모델 디지털 명함을 확인해 보세요" />
          </div>
        </div>
      </div>

      {career && (
        <div className="bc-career">
          <p style={{ fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#bbb", marginBottom: "12px" }}>Career</p>
          <p style={{ fontSize: "13px", lineHeight: 2, color: "#444", whiteSpace: "pre-line" }}>{career}</p>
        </div>
      )}
    </section>
  );
}
