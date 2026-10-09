import PageShell, { h2, muted, pillBtn, section, wrap } from "@/components/page-shell";
import LangLink from "@/components/lang-link";
import { PhoneFrame } from "@/components/screen-frame";
import PhoneDemo from "@/components/phone-demo";
import { COPY } from "./copy";

const SHOTS = ["m-inicio", "m-aprobaciones", "m-chats", "m-conversacion", "m-agenda", "m-agentes"];
const pick = async (params) => COPY[(await params).lang] || COPY.es;

export async function generateMetadata({ params }) {
  return { title: (await pick(params)).meta };
}

export default async function AppMovil({ params }) {
  const c = await pick(params);
  return (
    <PageShell
      eyebrow={c.eyebrow}
      title={c.title}
      intro={c.intro}
      actions={<><LangLink href="/#demo" style={pillBtn(true)}>{c.demo}</LangLink><LangLink href="/producto" style={pillBtn(false)}>{c.platform}</LangLink></>}
    >
      <section style={{ ...section, paddingTop: "clamp(28px, 4vw, 56px)" }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "center" }}>
          <PhoneDemo />
        </div>
      </section>
      <section style={{ ...section, paddingTop: "clamp(40px, 6vw, 72px)" }}>
        <div className="phone-grid" style={{ ...wrap, display: "grid", gap: "56px 40px" }}>
          {c.screens.map(([title, text], i) => (
            <figure key={SHOTS[i]} style={{ margin: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
              <PhoneFrame src={`/shots/v2/${SHOTS[i]}.png`} alt={`${c.alt}: ${title}`} />
              <figcaption style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "18px", lineHeight: "24px" }}>{title}</span>
                <span style={{ fontSize: "14px", lineHeight: "21px", ...muted }}>{text}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section style={section}>
        <div style={{ ...wrap, display: "flex", gap: "24px", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #0000001a", paddingTop: "32px" }}>
          <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: "6px" }}><h2 style={h2}>{c.stores}</h2><span style={{ fontSize: "14px", ...muted }}>{c.storesNote}</span></div>
          <LangLink href="/producto" style={pillBtn(false)}>{c.back}</LangLink>
        </div>
      </section>
    </PageShell>
  );
}
