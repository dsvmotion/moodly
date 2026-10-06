import LegalPage from "@/components/legal-page";

export const metadata = { title: "Política de cookies · Moodly AI" };

const SECTIONS = [
  ["Qué son las cookies", ["Pequeños archivos que la web guarda en tu navegador para funcionar y, si lo aceptas, para medir su uso."]],
  ["Cookies que usamos", [["Técnicas (siempre activas): sesión de la plataforma, preferencias de idioma y tu elección de cookies.", "Analíticas (solo con tu consentimiento): [herramienta, p. ej. analítica sin cookies o Google Analytics], para saber qué páginas se visitan.", "Publicitarias: no usamos. [Confirmar]."]]],
  ["Cómo gestionarlas", ["Puedes aceptar, rechazar o configurar las cookies no necesarias en el aviso que aparece al entrar y cambiar tu elección cuando quieras desde [enlace «Configurar cookies»]. Rechazarlas no afecta al funcionamiento de la web."]],
  ["Cookies de terceros", ["[Lista de terceros, finalidad y duración de cada cookie, a completar cuando se elijan las herramientas]."]],
];

export default function Cookies() {
  return <LegalPage title="Política de cookies" updated="[fecha]" intro="Qué cookies usa moodly.ai y cómo puedes gestionarlas." sections={SECTIONS} />;
}
