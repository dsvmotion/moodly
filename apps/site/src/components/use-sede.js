"use client";
import { createContext, useContext, useEffect, useState } from "react";

// Estado compartido de la sede activa del panel (prototipo).
// Modela lo que en el backend será el `location_id` del alcance: cada sede tiene
// sus propios datos y «Todas las sedes» es la vista agregada de la organización.
// La navegación del prototipo es por enlaces normales (recarga completa), así que
// la selección se guarda en localStorage para sobrevivir entre páginas. Es una
// comodidad por visitante: nunca datos reales ni estado de servidor.

export const SEDES = ["Sede Centro", "Sede Norte", "Todas las sedes"];
export const SEDE_ALL = "Todas las sedes";
const STORAGE_KEY = "moodly.sede";

const SedeContext = createContext(null);

export function SedeProvider({ children }) {
  const [sede, setSedeRaw] = useState(SEDES[0]);
  // Lee la preferencia tras el montaje para no romper la hidratación.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SEDES.includes(saved)) setSedeRaw(saved);
    } catch {}
  }, []);
  const setSede = (next) => {
    setSedeRaw(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };
  return <SedeContext.Provider value={{ sede, setSede }}>{children}</SedeContext.Provider>;
}

export function useSede() {
  return useContext(SedeContext) ?? { sede: SEDES[0], setSede: () => {} };
}
