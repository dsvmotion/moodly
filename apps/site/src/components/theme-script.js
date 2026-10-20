// Módulo neutro (sin "use client"): el layout del servidor necesita la cadena tal cual.
export const THEME_KEY = "moodly-theme";

// Se ejecuta en <head> antes de pintar: evita el destello claro al cargar en oscuro.
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}")||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;
