import LegalPage from "@/components/legal-page";

export const metadata = { title: "Aviso legal · Moodly AI" };

const SECTIONS = [
  ["Titular del sitio web", [["Titular: [razón social]", "NIF: [NIF]", "Domicilio: [dirección completa]", "Email: [hola@moodly.ai]", "Datos registrales: [Registro Mercantil, tomo, folio, hoja]"]]],
  ["Uso del sitio", ["El acceso a moodly.ai es gratuito y atribuye la condición de usuario. El usuario se compromete a hacer un uso adecuado de los contenidos y a no emplearlos para actividades ilícitas."]],
  ["Propiedad intelectual", ["Los contenidos, el diseño y el software de este sitio son propiedad de [razón social] o de sus licenciantes. Las marcas y logotipos de terceros pertenecen a sus titulares y se muestran solo para indicar compatibilidad."]],
  ["Responsabilidad", ["Las cifras de sector que mostramos citan su fuente y tienen carácter orientativo. No garantizamos resultados concretos en cada negocio."]],
  ["Ley aplicable", ["Este aviso se rige por la ley española, en particular la Ley 34/2002 de servicios de la sociedad de la información (LSSI)."]],
];

export default function AvisoLegal() {
  return <LegalPage title="Aviso legal" updated="[fecha]" intro="Información sobre el titular de moodly.ai y las condiciones de uso de la web." sections={SECTIONS} />;
}
