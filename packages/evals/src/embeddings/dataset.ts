// El set de la eval de embeddings del conocimiento (ADR 0048): 24 fragmentos de
// un centro de estética inventado (en español y uno bilingüe) y 40 preguntas de
// clientes, en español y en inglés, coloquiales y con faltas, cada una con el
// fragmento (o los fragmentos) que la contesta.

export interface EmbeddingEvalChunk {
  id: string;
  text: string;
}

export interface EmbeddingEvalQuery {
  q: string;
  /** Los fragmentos que la contestan: cuenta el primero que aparezca. */
  gold: readonly string[];
}

export const EMBEDDING_EVAL_CHUNKS: readonly EmbeddingEvalChunk[] = [
  { id: "horario", text: "Horario del centro: de lunes a viernes de 9:00 a 20:00 y los sábados de 10:00 a 14:00. Domingos y festivos cerrado." },
  { id: "direccion", text: "Estamos en la calle Velázquez 42, Madrid, a dos minutos del metro Velázquez (línea 4). Hay parking público en la calle Goya." },
  { id: "laser-precio", text: "Depilación láser diodo: axilas 39 €, ingles 49 €, piernas completas 129 €, cuerpo completo 299 € por sesión. Bonos de 6 sesiones con un 20 % de descuento." },
  { id: "laser-sesiones", text: "Un tratamiento de depilación láser suele necesitar entre 6 y 8 sesiones, separadas de 4 a 6 semanas según la zona." },
  { id: "laser-preparacion", text: "Antes de la sesión de láser hay que rasurar la zona 24 horas antes, no tomar el sol en las dos semanas previas y no usar cremas el mismo día." },
  { id: "laser-contraindicaciones", text: "El láser no se aplica durante el embarazo ni la lactancia, sobre tatuajes, con la piel bronceada o si tomas medicamentos fotosensibilizantes. Ante la duda, consúltalo antes." },
  { id: "facial-higiene", text: "Higiene facial profunda: 60 minutos, 55 €. Incluye limpieza, extracción, peeling suave, mascarilla e hidratación." },
  { id: "facial-hidrafacial", text: "Hydrafacial: 75 €, 45 minutos. Limpia, exfolia e hidrata en una sola sesión, sin tiempo de recuperación." },
  { id: "masaje", text: "Masaje relajante de 50 minutos por 45 € y masaje descontracturante de 50 minutos por 55 €." },
  { id: "manicura", text: "Manicura semipermanente 25 €, retirada incluida si la hiciste con nosotros. Pedicura completa 35 €." },
  { id: "pago", text: "Aceptamos tarjeta, efectivo y Bizum. No aceptamos pagos con cheque." },
  { id: "cancelacion", text: "Puedes cancelar o cambiar tu cita gratis hasta 24 horas antes. Si cancelas con menos de 24 horas o no vienes, se cobra el 50 % del tratamiento." },
  { id: "senal", text: "Para tratamientos de más de 100 € pedimos una señal de 20 € al reservar, que se descuenta del precio final." },
  { id: "retraso", text: "Si llegas más de 15 minutos tarde, puede que tengamos que acortar el tratamiento o cambiar la cita para no retrasar a otros clientes." },
  { id: "regalo", text: "Vendemos tarjetas regalo desde 30 €, válidas durante un año para cualquier tratamiento del centro." },
  { id: "primera-visita", text: "En la primera visita de láser hacemos una valoración gratuita de la piel y una prueba en una zona pequeña." },
  { id: "menores", text: "Los menores de 16 años necesitan venir con su padre, madre o tutor y una autorización firmada." },
  { id: "accesibilidad", text: "El centro está en planta baja, sin escalones, y tiene un baño adaptado para sillas de ruedas." },
  { id: "wifi-espera", text: "En la sala de espera hay wifi gratuito y agua. Puedes venir acompañado." },
  { id: "productos", text: "Vendemos cosmética profesional de las marcas que usamos en cabina; pregunta en recepción por la crema adecuada para tu piel." },
  { id: "facturas", text: "Si necesitas factura a nombre de una empresa, pídela al pagar con el nombre fiscal y el CIF." },
  { id: "idiomas", text: "Atendemos en castellano e inglés. We also speak English." },
  { id: "covid-higiene", text: "Desinfectamos la cabina y el material entre cliente y cliente y usamos material desechable siempre que es posible." },
  { id: "resultados-laser", text: "Los resultados del láser se notan desde la segunda o tercera sesión; el vello que vuelve a salir es más fino y claro." },
];

export const EMBEDDING_EVAL_QUERIES: readonly EmbeddingEvalQuery[] = [
  { q: "¿A qué hora abrís el sábado?", gold: ["horario"] },
  { q: "abris los domingos?", gold: ["horario"] },
  { q: "What are your opening hours?", gold: ["horario"] },
  { q: "¿Dónde estáis?", gold: ["direccion"] },
  { q: "hay sitio para aparcar cerca", gold: ["direccion"] },
  { q: "How do I get there by metro?", gold: ["direccion"] },
  { q: "¿Cuánto cuesta el láser de piernas?", gold: ["laser-precio"] },
  { q: "precio depilacion axilas", gold: ["laser-precio"] },
  { q: "How much is full body laser hair removal?", gold: ["laser-precio"] },
  { q: "tenéis bonos o descuentos para el láser?", gold: ["laser-precio"] },
  { q: "¿Cuántas sesiones necesito para quitarme el vello?", gold: ["laser-sesiones"] },
  { q: "cada cuanto tiempo hay que ir al laser", gold: ["laser-sesiones"] },
  { q: "¿Tengo que afeitarme antes de ir?", gold: ["laser-preparacion"] },
  { q: "puedo ir a la playa antes del laser", gold: ["laser-preparacion", "laser-contraindicaciones"] },
  { q: "Estoy embarazada, ¿puedo hacerme el láser?", gold: ["laser-contraindicaciones"] },
  { q: "I have a tattoo on my leg, is laser ok?", gold: ["laser-contraindicaciones"] },
  { q: "¿Qué incluye la limpieza facial?", gold: ["facial-higiene"] },
  { q: "cuanto dura el hydrafacial y cuanto vale", gold: ["facial-hidrafacial"] },
  { q: "I want something for my face with no downtime", gold: ["facial-hidrafacial"] },
  { q: "¿Hacéis masajes para la espalda cargada?", gold: ["masaje"] },
  { q: "precio de las uñas semipermanentes", gold: ["manicura"] },
  { q: "¿Se puede pagar con Bizum?", gold: ["pago"] },
  { q: "Do you take credit cards?", gold: ["pago"] },
  { q: "¿Qué pasa si no puedo ir a mi cita?", gold: ["cancelacion"] },
  { q: "me cobrais si cancelo el mismo dia", gold: ["cancelacion"] },
  { q: "What's your cancellation policy?", gold: ["cancelacion"] },
  { q: "¿Hay que pagar algo por adelantado al reservar?", gold: ["senal"] },
  { q: "voy a llegar tarde, pasa algo?", gold: ["retraso"] },
  { q: "Quiero regalarle un tratamiento a mi madre", gold: ["regalo"] },
  { q: "Do you sell gift vouchers?", gold: ["regalo"] },
  { q: "¿La primera sesión de láser es gratis?", gold: ["primera-visita"] },
  { q: "mi hija tiene 15 años, puede venir sola?", gold: ["menores"] },
  { q: "Is the clinic wheelchair accessible?", gold: ["accesibilidad"] },
  { q: "¿Puedo traer a mi pareja mientras espero?", gold: ["wifi-espera"] },
  { q: "¿Me podéis hacer factura con el CIF de mi empresa?", gold: ["facturas"] },
  { q: "Do you speak English?", gold: ["idiomas"] },
  { q: "¿Cuándo se empiezan a ver resultados del láser?", gold: ["resultados-laser"] },
  { q: "es higienico, limpiais el material?", gold: ["covid-higiene"] },
  { q: "vendéis cremas?", gold: ["productos"] },
  { q: "depilasion laser pierna enteras cuanto", gold: ["laser-precio"] },
];
