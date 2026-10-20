"use client";
import { Children, cloneElement, useCallback, useEffect, useRef, useState } from "react";

// Carrusel infinito: 3 tarjetas visibles centradas.
// Se renderizan 3 copias de las tarjetas; al salir de la copia central se
// salta sin animación a la posición equivalente, así la rueda no tiene fin.
const GAP = 24;

export default function AgentCarousel({ children }) {
  const items = Children.toArray(children);
  const n = items.length;
  const [index, setIndex] = useState(n); // primera tarjeta de la copia central
  const [animate, setAnimate] = useState(true);
  const [cardW, setCardW] = useState(384);
  const drag = useRef(null);
  const wheelLock = useRef(false);

  useEffect(() => {
    const fit = () => setCardW(Math.min(384, Math.round(window.innerWidth * 0.78)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const go = useCallback((d) => { setAnimate(true); setIndex((i) => i + d); }, []);

  // Al terminar la animación, si hemos salido de la copia central, saltamos
  // sin animación a la tarjeta equivalente de la copia central.
  useEffect(() => {
    if (index >= n && index < 2 * n) return;
    const id = setTimeout(() => {
      setAnimate(false);
      setIndex((i) => ((i % n) + n) % n + n);
    }, 470);
    return () => clearTimeout(id);
  }, [index, n]);
  useEffect(() => {
    if (!animate) { const id = requestAnimationFrame(() => setAnimate(true)); return () => cancelAnimationFrame(id); }
  }, [animate]);

  const onWheel = (e) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 12 || wheelLock.current) return;
    wheelLock.current = true;
    go(e.deltaX > 0 ? 1 : -1);
    setTimeout(() => { wheelLock.current = false; }, 450);
  };
  const onPointerDown = (e) => { drag.current = e.clientX; };
  const onPointerUp = (e) => {
    if (drag.current == null) return;
    const dx = e.clientX - drag.current; drag.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };

  const track = [...items, ...items, ...items];
  const offset = `calc(50% - ${cardW / 2}px - ${index * (cardW + GAP)}px)`;
  const active = ((index % n) + n) % n;

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Agentes"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}
      style={{ outline: "none" }}
    >
      <div
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { drag.current = null; }}
        style={{
          overflow: "hidden",
          touchAction: "pan-y",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: `${GAP}px`,
            transform: `translateX(${offset})`,
            transition: animate ? "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
            willChange: "transform",
          }}
        >
          {track.map((child, i) => {
            const isCenter = i === index;
            return (
              <div
                key={i}
                aria-hidden={Math.abs(i - index) > 1}
                style={{
                  flex: `0 0 ${cardW}px`,
                  transform: isCenter ? "scale(1)" : "scale(0.94)",
                  opacity: Math.abs(i - index) > 1 ? 0.35 : 1,
                  transition: animate ? "transform 450ms cubic-bezier(0.22, 1, 0.36, 1), opacity 450ms" : "none",
                }}
              >
                {cloneElement(child, { draggable: false, style: { ...child.props.style, flex: "none", width: "100%" } })}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: "28px", display: "flex", justifyContent: "center", alignItems: "center", gap: "16px" }}>
        <button type="button" aria-label="Agente anterior" onClick={() => go(-1)} style={arrow}>‹</button>
        <div style={{ display: "flex", gap: "8px" }} aria-hidden="true">
          {items.map((_, i) => (
            <span key={i} style={{ width: i === active ? "22px" : "8px", height: "8px", borderRadius: "800px", background: i === active ? "#000000" : "#0000002e", transition: "width 300ms" }} />
          ))}
        </div>
        <button type="button" aria-label="Agente siguiente" onClick={() => go(1)} style={arrow}>›</button>
      </div>
    </div>
  );
}

const arrow = { width: "44px", height: "44px", borderRadius: "800px", border: "1px solid #0000001a", background: "#ffffff", color: "#000000", font: "400 20px/20px var(--font-display)", cursor: "pointer" };
