"use client";

type PhotoItem  = { id: number; src: string | null; x: number; y: number; w: number };
type TextBlock  = { id: string; tag: "name" | "korName" | "stats" | "contact"; x: number; y: number; fontSize: number };
type Field      = { label: string; value: string };

type CardData = {
  bgColor?: string;
  txtColor?: string;
  fontWeight?: number;
  statsLayout?: "1단" | "2단";
  enabledFields?: Field[];
  photos?: PhotoItem[];
  textBlocks?: TextBlock[];
};

const CANVAS = {
  portrait:  { w: 480, h: 680 },
  landscape: { w: 680, h: 480 },
};

export default function CompCardCanvas({ canvasType, data, maxWidth = 900 }: {
  canvasType: string;
  data: CardData;
  maxWidth?: number;
}) {
  const cv = CANVAS[canvasType as keyof typeof CANVAS] ?? CANVAS.landscape;
  const scale = maxWidth / cv.w;

  const bgColor    = data.bgColor    ?? "#fff";
  const txtColor   = data.txtColor   ?? "#111";
  const fontWeight = data.fontWeight ?? 400;
  const statsLayout = data.statsLayout ?? "1단";
  const photos     = data.photos     ?? [];
  const textBlocks = data.textBlocks ?? [];
  const fields     = data.enabledFields ?? [];

  const statsFields   = fields.filter(d => !["English Name","Korean Name","Instagram","Email","Phone"].includes(d.label));
  const contactFields = fields.filter(d => ["Instagram","Email","Phone"].includes(d.label));
  const nameField     = fields.find(d => d.label === "English Name");
  const korNameField  = fields.find(d => d.label === "Korean Name");

  const nameBlock    = textBlocks.find(b => b.tag === "name");
  const korNameBlock = textBlocks.find(b => b.tag === "korName");
  const statsBlock   = textBlocks.find(b => b.tag === "stats");
  const contactBlock = textBlocks.find(b => b.tag === "contact");

  return (
    <div style={{ width: cv.w * scale, height: cv.h * scale, overflow: "hidden" }}>
      <div style={{
        position: "relative", width: cv.w, height: cv.h,
        background: bgColor, overflow: "hidden",
        transformOrigin: "top left", transform: `scale(${scale})`,
      }}>
        {/* Photos */}
        {photos.map(item => (
          <div key={item.id} style={{
            position: "absolute", left: item.x, top: item.y,
            width: item.w, height: Math.round(item.w * 1.5),
            overflow: "hidden", background: "#e8e8e8",
          }}>
            {item.src
              ? <img src={item.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              : <div style={{ width: "100%", height: "100%", background: "#e0e0e0" }} />
            }
          </div>
        ))}

        {/* English Name */}
        {nameField && nameBlock && (
          <div style={{ position: "absolute", left: nameBlock.x, top: nameBlock.y, pointerEvents: "none" }}>
            <span className="font-display" style={{ fontSize: nameBlock.fontSize, fontStyle: "italic", fontWeight, color: txtColor, display: "block", lineHeight: 1.1, whiteSpace: "nowrap" }}>
              {nameField.value}
            </span>
          </div>
        )}

        {/* Korean Name */}
        {korNameField && korNameBlock && (
          <div style={{ position: "absolute", left: korNameBlock.x, top: korNameBlock.y, pointerEvents: "none" }}>
            <span style={{ fontSize: korNameBlock.fontSize, fontWeight, color: txtColor, display: "block", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>
              {korNameField.value}
            </span>
          </div>
        )}

        {/* Stats */}
        {statsFields.length > 0 && statsBlock && (
          <div style={{ position: "absolute", left: statsBlock.x, top: statsBlock.y, pointerEvents: "none" }}>
            {statsLayout === "1단" ? (
              <div style={{ display: "flex", gap: "12px", flexWrap: "nowrap" }}>
                {statsFields.map((d, i) => (
                  <span key={i} style={{ display: "inline-flex", flexDirection: "column", gap: "1px" }}>
                    <span style={{ fontSize: Math.max(6, statsBlock.fontSize - 4), letterSpacing: "0.12em", textTransform: "uppercase", color: txtColor, fontWeight, whiteSpace: "nowrap" }}>{d.label}</span>
                    <span style={{ fontSize: statsBlock.fontSize, color: txtColor, fontWeight, whiteSpace: "nowrap" }}>{d.value}</span>
                  </span>
                ))}
              </div>
            ) : (
              (() => {
                const half = Math.ceil(statsFields.length / 2);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {[statsFields.slice(0, half), statsFields.slice(half)].map((row, ri) => (
                      <div key={ri} style={{ display: "flex", gap: "12px" }}>
                        {row.map((d, i) => (
                          <span key={i} style={{ display: "inline-flex", flexDirection: "column", gap: "1px" }}>
                            <span style={{ fontSize: Math.max(6, statsBlock.fontSize - 4), letterSpacing: "0.12em", textTransform: "uppercase", color: txtColor, fontWeight, whiteSpace: "nowrap" }}>{d.label}</span>
                            <span style={{ fontSize: statsBlock.fontSize, color: txtColor, fontWeight, whiteSpace: "nowrap" }}>{d.value}</span>
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* Contact */}
        {contactFields.length > 0 && contactBlock && (
          <div style={{ position: "absolute", left: contactBlock.x, top: contactBlock.y, pointerEvents: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {contactFields.map((d, i) => {
                const lbl = d.label === "Instagram" ? "Instagram" : d.label === "Email" ? "E-mail" : "Tel";
                return (
                  <span key={i} style={{ fontSize: contactBlock.fontSize, color: txtColor, fontWeight, whiteSpace: "nowrap" }}>
                    <span style={{ marginRight: "6px", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: Math.max(6, contactBlock.fontSize - 2) }}>{lbl}</span>
                    {d.value}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
