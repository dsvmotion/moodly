import LegalPage from "@/components/legal-page";

export const metadata = { title: "Términos del servicio · Moodly AI" };

const SECTIONS = [
  ["Objeto", ["Estos términos regulan el uso de la plataforma Moodly AI, que ofrece agentes de IA configurables para negocios. Al contratar el servicio, el cliente los acepta junto con la oferta comercial y el Contrato de Encargo de Tratamiento (DPA)."]],
  ["El servicio", [["Implantación: configuración de agentes, integraciones y formación, con precio cerrado según la oferta.", "Suscripción mensual: acceso a la plataforma y consumo de IA incluido, según el plan contratado.", "Soporte según el plan contratado."]]],
  ["Precio y pago", ["La implantación se factura según la oferta aceptada. La suscripción se factura por mes adelantado. Los precios no incluyen IVA. Si el consumo supera el incluido en el plan, avisaremos antes de aplicar ningún cargo adicional. [Revisar condiciones de impago]."]],
  ["Duración y baja", ["La suscripción es mensual y se renueva automáticamente. Puedes darte de baja con [30] días de preaviso. Al terminar, podrás exportar tus datos durante [30] días antes de su eliminación."]],
  ["Uso aceptable", ["El cliente no usará los agentes para enviar comunicaciones no solicitadas, suplantar identidades, tomar decisiones con efectos jurídicos sin revisión humana ni para actividades ilícitas. El cliente es responsable de la información que da a sus agentes y de las acciones que aprueba."]],
  ["Inteligencia artificial", ["Los agentes pueden equivocarse. Moodly ofrece reglas, límites y aprobaciones para que el cliente controle qué hace cada agente sin supervisión. Los agentes se identifican como asistentes automáticos cuando la normativa lo exige."]],
  ["Disponibilidad", ["Nos comprometemos a una disponibilidad de [99,5 %] mensual, salvo mantenimientos avisados. [Definir SLA y compensaciones por plan]."]],
  ["Responsabilidad", ["[Limitación de responsabilidad a revisar con asesoría legal]."]],
  ["Ley aplicable", ["Estos términos se rigen por la ley española. [Fuero aplicable]."]],
];

export default function Terminos() {
  return <LegalPage title="Términos del servicio" updated="[fecha]" intro="Las condiciones de uso de la plataforma Moodly AI para empresas." sections={SECTIONS} />;
}
