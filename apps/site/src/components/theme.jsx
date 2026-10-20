"use client";
import { useEffect, useState } from "react";

// Tema de la plataforma: «light» | «dark» | «system» (por defecto, el del sistema).
// La preferencia vive en localStorage; <html data-theme> lleva el tema RESUELTO
// (light/dark), que es lo que usan los tokens de globals.css.
import { THEME_KEY } from "./theme-script";
export { THEME_KEY };
const EVT = "moodly-theme-change";


function resolve(pref) {
  if (pref === "dark" || pref === "light") return pref;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function apply(pref) { document.documentElement.dataset.theme = resolve(pref); }
function read() { try { return localStorage.getItem(THEME_KEY) || "system"; } catch { return "system"; } }

export function useTheme() {
  const [pref, setPrefState] = useState("system");
  useEffect(() => {
    setPrefState(read());
    const on = () => setPrefState(read());
    window.addEventListener(EVT, on); window.addEventListener("storage", on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); };
  }, []);
  const setPref = (p) => { try { localStorage.setItem(THEME_KEY, p); } catch {} apply(p); setPrefState(p); window.dispatchEvent(new Event(EVT)); };
  return [pref, setPref];
}

// Mantiene <html data-theme> al día: preferencia guardada y cambios del sistema.
export function ThemeSync() {
  useEffect(() => {
    apply(read());
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSys = () => { if (read() === "system") apply("system"); };
    mq?.addEventListener?.("change", onSys);
    return () => mq?.removeEventListener?.("change", onSys);
  }, []);
  return null;
}
