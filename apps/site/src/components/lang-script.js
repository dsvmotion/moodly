// Módulo neutro (sin "use client"): el layout del servidor necesita la cadena tal cual.
export const PLAT_LANG_KEY = "moodly-plataforma-lang";
export const PLAT_LANGS = { es: "Español", en: "English", fr: "Français", de: "Deutsch" };

// Se ejecuta en <head> antes de pintar. Si el idioma no es español, pone <html lang>
// y oculta la página hasta que se aplique la traducción (sin destello en español).
// Si la traducción tarda más de 1,5 s, la muestra igualmente.
export const LANG_SCRIPT = `(function(){try{var l=localStorage.getItem("${PLAT_LANG_KEY}")||"es";if(l!=="es"&&/^(en|fr|de)$/.test(l)){var h=document.documentElement;h.lang=l;h.setAttribute("data-i18n-pending","");setTimeout(function(){h.removeAttribute("data-i18n-pending")},1500);}}catch(e){}})();`;
