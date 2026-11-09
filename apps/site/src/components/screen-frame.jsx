// Marcos para capturas: ventana de navegador (escritorio) y teléfono (móvil).
export function BrowserFrame({ src, alt, priority = false }) {
  return (
    <div style={{ borderRadius: "12px", overflow: "hidden", background: "#ffffff", boxShadow: "0 24px 64px #0000001f, 0 2px 6px #00000014", border: "1px solid #0000000f" }}>
      <div aria-hidden="true" style={{ height: "32px", display: "flex", alignItems: "center", gap: "6px", padding: "0 14px", background: "#f4f4f5", borderBottom: "1px solid #0000000f" }}>
        <span style={{ width: "10px", height: "10px", borderRadius: "800px", background: "#d9d9de" }} />
        <span style={{ width: "10px", height: "10px", borderRadius: "800px", background: "#d9d9de" }} />
        <span style={{ width: "10px", height: "10px", borderRadius: "800px", background: "#d9d9de" }} />
        <span style={{ marginLeft: "12px", flex: 1, maxWidth: "320px", height: "18px", borderRadius: "800px", background: "#ffffff", fontSize: "11px", lineHeight: "18px", color: "#6b6b70", paddingLeft: "10px" }}>app.moodlycrm.com</span>
      </div>
      <img src={src} alt={alt} width="1440" height="900" loading={priority ? "eager" : "lazy"} style={{ display: "block", width: "100%", height: "auto" }} />
    </div>
  );
}

export function PhoneFrame({ src, alt }) {
  return (
    <div style={{ borderRadius: "36px", overflow: "hidden", border: "7px solid #000000", boxShadow: "0 20px 48px #00000026", background: "#000000", maxWidth: "260px", margin: "0 auto" }}>
      <img src={src} alt={alt} width="390" height="844" loading="lazy" style={{ display: "block", width: "100%", height: "auto" }} />
    </div>
  );
}
