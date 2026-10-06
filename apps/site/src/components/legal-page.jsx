import PageShell, { muted, wrap } from "./page-shell";

// Plantilla de los textos legales. Los [corchetes] son datos por completar.
// Todo el texto es un borrador: revisar con asesoría legal antes de publicar.
export default function LegalPage({ title, updated, intro, sections }) {
  return (
    <PageShell eyebrow={`Última actualización: ${updated}`} title={title} intro={intro} center={false}>
      <section style={{ padding: "clamp(40px, 6vw, 72px) clamp(16px, 4vw, 40px) 0" }}>
        <div style={{ ...wrap, display: "flex", gap: "56px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <nav aria-label="Índice" className="sticky-wide" style={{ flex: "0 1 240px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: "20px" }}>
            <span style={{ fontSize: "13px", ...muted }}>En esta página</span>
            {sections.map(([h], i) => (<a key={h} href={`#s${i + 1}`} style={muted}>{i + 1}. {h}</a>))}
          </nav>
          <article style={{ flex: "1 1 560px", minWidth: 0, maxWidth: "760px", display: "flex", flexDirection: "column", gap: "40px" }}>
            <p role="note" style={{ margin: 0, padding: "14px 18px", borderRadius: "12px", background: "#fff3e8", color: "#8e4e00", fontSize: "14px", lineHeight: "21px" }}>Borrador. Los datos entre [corchetes] están pendientes y el texto debe revisarlo una asesoría legal antes de publicarse.</p>
            {sections.map(([h, paras], i) => (
              <div key={h} id={`s${i + 1}`} style={{ display: "flex", flexDirection: "column", gap: "12px", scrollMarginTop: "80px" }}>
                <h2 style={{ margin: 0, fontSize: "22px", lineHeight: "28px", fontWeight: 500, letterSpacing: "-0.4px" }}>{i + 1}. {h}</h2>
                {paras.map((p, j) => Array.isArray(p)
                  ? (<ul key={j} style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "16px", lineHeight: "25px", ...muted }}>{p.map((li) => <li key={li}>{li}</li>)}</ul>)
                  : (<p key={j} style={{ margin: 0, fontSize: "16px", lineHeight: "25px", ...muted }}>{p}</p>))}
              </div>
            ))}
          </article>
        </div>
      </section>
    </PageShell>
  );
}
