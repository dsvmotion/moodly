import PageShell, { h2, muted, pillBtn, section, wrap } from "@/components/page-shell";
import LangLink from "@/components/lang-link";
import { PhoneFrame } from "@/components/screen-frame";
import PhoneDemo from "@/components/phone-demo";
import { COPY } from "./copy";
import { AvailabilityBadge } from "@/components/availability";

const SHOTS = ["m-inicio", "m-aprobaciones", "m-chats", "m-conversacion", "m-agenda", "m-agentes"];
// Unidad de docs/scope.yaml de cada pantalla y de la app (N-01; regla de V1 del 2026-11-11):
// la etiqueta sale del registro, nunca puesta a mano. Mismo índice que `screens` en los cuatro
// idiomas (si no, falla la compilación).
const SCREEN_UNITS = ["OA11", "OA02", "OA01", "OA01", "OA03", "OA05"];
const PWA_UNIT = "OA17";
const NATIVE_UNIT = "OA35";
for (const [lang, c] of Object.entries(COPY)) {
  if (c.screens.length !== SCREEN_UNITS.length) throw new Error(`app-movil: ${lang}.screens tiene ${c.screens.length} y SCREEN_UNITS ${SCREEN_UNITS.length}`);
}
const pick = async (params) => COPY[(await params).lang] || COPY.es;
const langOf = async (params) => ((await params).lang in COPY ? (await params).lang : "es");

export async function generateMetadata({ params }) {
  return { title: (await pick(params)).meta };
}

export default async function AppMovil({ params }) {
  const c = await pick(params);
  const lang = await langOf(params);
  return (
    <PageShell
      eyebrow={c.eyebrow}
      title={c.title}
      intro={c.intro}
      actions={<><LangLink href="/#demo" style={pillBtn(true)}>{c.demo}</LangLink><LangLink href="/producto" style={pillBtn(false)}>{c.platform}</LangLink></>}
    >
      <section style={{ ...section, paddingTop: "clamp(28px, 4vw, 56px)" }}>
        <div style={{ ...wrap, display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "10px", fontSize: "15px", lineHeight: "22px" }}>{c.pwa}<span><AvailabilityBadge id={PWA_UNIT} lang={lang} /></span></span>
          <PhoneDemo />
        </div>
      </section>
      <section style={{ ...section, paddingTop: "clamp(40px, 6vw, 72px)" }}>
        <p style={{ ...wrap, margin: "0 auto 32px", textAlign: "center", fontSize: "14px", lineHeight: "21px", ...muted }}>{c.proto}</p>
        <div className="phone-grid" style={{ ...wrap, display: "grid", gap: "56px 40px" }}>
          {c.screens.map(([title, text], i) => (
            <figure key={SHOTS[i]} style={{ margin: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
              <PhoneFrame src={`/shots/v2/${SHOTS[i]}.png`} alt={`${c.alt}: ${title}`} />
              <figcaption style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "18px", lineHeight: "24px" }}>{title}</span>
                <span><AvailabilityBadge id={SCREEN_UNITS[i]} lang={lang} /></span>
                <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{text}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section style={section}>
        <div style={{ ...wrap, display: "flex", gap: "24px", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #0000001a", paddingTop: "32px" }}>
          <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "6px" }}><h2 style={h2}>{c.stores}</h2><AvailabilityBadge id={NATIVE_UNIT} lang={lang} /><span style={{ fontSize: "14px", ...muted }}>{c.storesNote}</span></div>
          <LangLink href="/producto" style={pillBtn(false)}>{c.back}</LangLink>
        </div>
      </section>
    </PageShell>
  );
}
