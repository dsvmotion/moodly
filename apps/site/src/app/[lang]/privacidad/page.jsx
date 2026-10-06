import LegalPage from "@/components/legal-page";

export const metadata = { title: "Política de privacidad · Moodly AI" };

const SECTIONS = [
  ["Quién es el responsable", ["[Razón social], con NIF [NIF] y domicilio en [dirección], es el responsable de los datos que nos facilitas en moodly.ai. Contacto de privacidad: [privacidad@moodly.ai]. Delegado de protección de datos: [nombre o «no aplica»]."]],
  ["Dos papeles distintos", ["En la web (formularios de demo, contacto y cookies) Moodly actúa como responsable del tratamiento.", "En la plataforma, cuando nuestros agentes atienden a los clientes de tu negocio, tú eres el responsable y Moodly es el encargado del tratamiento. Esa relación se regula en el Contrato de Encargo de Tratamiento (DPA) que firmamos con cada cliente."]],
  ["Qué datos tratamos", [["Datos de contacto que nos envías: nombre, email de trabajo, empresa, teléfono.", "Datos de uso de la web, según tu elección de cookies.", "Si eres cliente: datos de facturación y de los usuarios de tu equipo.", "Como encargado: los mensajes, citas y documentos que tus agentes procesan por tu cuenta."]]],
  ["Para qué y con qué base legal", [["Responder a tu solicitud de demo o contacto (medidas precontractuales).", "Prestar el servicio y facturarlo (ejecución del contrato).", "Enviarte novedades del producto si das tu consentimiento (consentimiento, revocable en cualquier momento).", "Seguridad y prevención del fraude (interés legítimo)."]]],
  ["Inteligencia artificial", ["Usamos las APIs empresariales de proveedores de IA para que los agentes funcionen. Tus datos y los de tus clientes no se usan para entrenar modelos. [Confirmar condiciones de cada proveedor antes de publicar].", "Las acciones sensibles de los agentes (cobros, cambios de citas, envíos de documentos) se pueden configurar para requerir la aprobación de una persona."]],
  ["Con quién los compartimos", ["Solo con proveedores necesarios para prestar el servicio (alojamiento, proveedores de IA, email, pagos), con contrato de encargo y garantías adecuadas. La lista actualizada de subencargados está en [enlace a subencargados]."]],
  ["Dónde están los datos", ["Alojamos los datos en la Unión Europea [por confirmar región y proveedor]. Si algún proveedor trata datos fuera del EEE, lo hace con cláusulas contractuales tipo u otra garantía válida."]],
  ["Cuánto tiempo los guardamos", ["Los datos de contacto, hasta 12 meses tras el último contacto si no llegas a ser cliente. Los de clientes, mientras dure el contrato y después durante los plazos legales. [Revisar plazos]."]],
  ["Tus derechos", ["Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a [privacidad@moodly.ai]. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es)."]],
];

export default function Privacidad() {
  return <LegalPage title="Política de privacidad" updated="[fecha]" intro="Cómo tratamos tus datos personales en moodly.ai y en la plataforma Moodly." sections={SECTIONS} />;
}
