import type { Business } from "./world.js";

// Los sectores de las conversaciones de prueba (decisión de producto,
// 2026-11-09): además del centro de estética (AURORA, en world.ts),
// restauración, talleres, salud e inmobiliarias. Negocios inventados, con las
// skills que existen hoy: una reserva es un servicio con un recurso (una mesa,
// un elevador, un box, un comercial). Lo que esas skills no cubren (el estado
// de un coche, un lead de venta) tiene que ir a una persona sin inventarse
// nada.

const id = (prefix: string, n: number) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// --- Hostelería y restauración ------------------------------------------------

export const MESA_2 = id("a1", 1);
export const MESA_4 = id("a1", 2);
export const MESA_6 = id("a1", 3);

export const CASA_LOLA: Business = {
  key: "restaurante",
  name: "Casa Lola",
  locationName: "Lavapiés",
  services: [
    { id: MESA_2, name: "Mesa para 2", durationMinutes: 90 },
    { id: MESA_4, name: "Mesa para 4", durationMinutes: 120 },
    { id: MESA_6, name: "Mesa para 6", durationMinutes: 120 },
  ],
  resources: [
    { id: id("a3", 1), name: "Mesa 1 (terraza)", serviceIds: [MESA_2] },
    { id: id("a3", 2), name: "Mesa 2", serviceIds: [MESA_2] },
    { id: id("a3", 3), name: "Mesa 3", serviceIds: [MESA_4] },
    { id: id("a3", 4), name: "Mesa 4", serviceIds: [MESA_4] },
    { id: id("a3", 5), name: "Mesa 5 (salón)", serviceIds: [MESA_6] },
  ],
  // De 13:00 a 24:00 en Madrid (horario de verano).
  openHour: 11,
  closeHour: 22,
  knowledge: [
    {
      id: "r-alergenos",
      type: "catalog",
      title: "Carta y alérgenos",
      content:
        "La paella mixta lleva marisco (gambas y mejillones) y pescado. El gazpacho no lleva gluten. La tarta de queso lleva lactosa y gluten. Tenemos pan sin gluten bajo petición.",
      tags: ["alérgica", "alérgico", "alergia", "alérgenos", "marisco", "gluten", "celíaco", "celiaca", "lactosa", "paella", "gazpacho", "tarta", "carta", "allergy", "allergic", "shellfish"],
    },
    {
      id: "r-grupos",
      type: "policy",
      title: "Grupos",
      content: "Para grupos de más de 6 personas, la reserva la gestiona el encargado: menú de grupo cerrado a 35 € por persona.",
      tags: ["grupo", "grupos", "personas", "empresa", "cena", "comida", "celebración", "cumpleaños", "menú", "group"],
    },
  ],
};

// --- Automoción y talleres ----------------------------------------------------

export const ACEITE = id("b1", 1);
export const DIAGNOSIS = id("b1", 2);
export const PRE_ITV = id("b1", 3);

export const TALLERES_RUIZ: Business = {
  key: "taller",
  name: "Talleres Ruiz",
  locationName: "Usera",
  services: [
    { id: ACEITE, name: "Cambio de aceite y filtro", durationMinutes: 60 },
    { id: DIAGNOSIS, name: "Diagnosis electrónica", durationMinutes: 60 },
    { id: PRE_ITV, name: "Revisión pre-ITV", durationMinutes: 90 },
  ],
  resources: [
    { id: id("b3", 1), name: "Elevador 1", serviceIds: [ACEITE, DIAGNOSIS, PRE_ITV] },
    { id: id("b3", 2), name: "Elevador 2", serviceIds: [ACEITE, PRE_ITV] },
  ],
  knowledge: [
    {
      id: "t-precios",
      type: "pricing",
      title: "Precios del taller",
      content: "Cambio de aceite y filtro: desde 79 € según el motor. Diagnosis electrónica: 45 €. Revisión pre-ITV: 35 €.",
      tags: ["precio", "precios", "cuesta", "cuánto", "aceite", "filtro", "diagnosis", "itv", "presupuesto", "price"],
    },
  ],
};

// --- Salud y bienestar --------------------------------------------------------

export const VALORACION = id("c1", 1);
export const SESION_FISIO = id("c1", 2);

export const FISIO_RETIRO: Business = {
  key: "salud",
  name: "Fisio Retiro",
  locationName: "Retiro",
  services: [
    { id: VALORACION, name: "Valoración inicial", durationMinutes: 60 },
    { id: SESION_FISIO, name: "Sesión de fisioterapia", durationMinutes: 45 },
  ],
  resources: [
    { id: id("c3", 1), name: "Box 1", serviceIds: [VALORACION, SESION_FISIO] },
    { id: id("c3", 2), name: "Box 2", serviceIds: [SESION_FISIO] },
  ],
  knowledge: [
    {
      id: "s-precios",
      type: "pricing",
      title: "Tarifas",
      content: "Valoración inicial: 55 €. Sesión de fisioterapia: 45 €. Bono de 5 sesiones: 200 €.",
      tags: ["precio", "precios", "cuesta", "cuánto", "tarifa", "valoración", "sesión", "bono", "price"],
    },
    {
      id: "s-cancelacion",
      type: "policy",
      title: "Cancelaciones",
      content: "Si no puedes venir, avísanos con 24 horas de antelación. Con menos de 24 horas, la sesión se cobra.",
      tags: ["cancelar", "cancelación", "anular", "avisar", "cobráis", "cancel"],
    },
  ],
};

// --- Viviendas e inmuebles ----------------------------------------------------

export const VISITA_ALONSO_CANO = id("d1", 1);
export const VISITA_RIOS_ROSAS = id("d1", 2);

export const INMOBILIARIA_SOL: Business = {
  key: "inmobiliaria",
  name: "Inmobiliaria Sol",
  locationName: "Chamberí",
  services: [
    { id: VISITA_ALONSO_CANO, name: "Visita: piso en Alonso Cano 24 (3 hab.)", durationMinutes: 30 },
    { id: VISITA_RIOS_ROSAS, name: "Visita: ático en Ríos Rosas 8 (2 hab.)", durationMinutes: 30 },
  ],
  resources: [
    { id: id("d3", 1), name: "Marta (comercial)", serviceIds: [VISITA_ALONSO_CANO, VISITA_RIOS_ROSAS] },
    { id: id("d3", 2), name: "Javier (comercial)", serviceIds: [VISITA_RIOS_ROSAS] },
  ],
  knowledge: [
    {
      id: "i-alonso-cano",
      type: "catalog",
      title: "Piso en Alonso Cano 24",
      content: "Alquiler. 3 habitaciones, 95 m², segundo sin ascensor, calefacción central. 1.250 € al mes, con un mes de fianza.",
      tags: ["alonso", "cano", "piso", "alquiler", "precio", "cuesta", "cuánto", "habitaciones", "ascensor", "garaje", "fianza", "mascotas"],
    },
    {
      id: "i-rios-rosas",
      type: "catalog",
      title: "Ático en Ríos Rosas 8",
      content: "Alquiler. Ático de 2 habitaciones, 70 m², terraza de 20 m², con ascensor. Admite mascotas. 1.600 € al mes, con dos meses de fianza.",
      tags: ["ríos", "rosas", "ático", "atico", "alquiler", "precio", "cuesta", "cuánto", "habitaciones", "terraza", "mascotas", "perro", "gato", "fianza"],
    },
  ],
};

// --- Peluquería, con los precios en Ajustes (OA04) -----------------------------

export const CORTE = id("f1", 1);
export const PEINADO = id("f1", 2);
export const MECHAS = id("f1", 3);

/**
 * Los precios de este negocio están en Ajustes (services.price_cents), no en
 * su conocimiento: el agente los ve en la lista de lo que se puede reservar.
 * Las mechas no tienen precio publicado (el negocio lo da según el pelo).
 * No es un sector más (SECTOR_BUSINESSES): sus casos solo prueban los precios.
 */
export const PELUQUERIA_BRISA: Business = {
  key: "peluqueria",
  name: "Peluquería Brisa",
  locationName: "Malasaña",
  services: [
    { id: CORTE, name: "Corte de pelo", durationMinutes: 30, price: { cents: 1850, currency: "EUR" } },
    { id: PEINADO, name: "Peinado", durationMinutes: 45, price: { cents: 2200, currency: "EUR" } },
    { id: MECHAS, name: "Mechas", durationMinutes: 120, price: null },
  ],
  resources: [
    { id: id("f3", 1), name: "Sillón 1", serviceIds: [CORTE, PEINADO, MECHAS] },
    { id: id("f3", 2), name: "Sillón 2", serviceIds: [CORTE, PEINADO] },
  ],
  knowledge: [
    {
      id: "p-pago",
      type: "faq",
      title: "Formas de pago",
      content: "Aceptamos efectivo, tarjeta y Bizum.",
      tags: ["pago", "pagar", "tarjeta", "bizum", "efectivo", "pay", "card"],
    },
  ],
};

export const SECTOR_BUSINESSES = [CASA_LOLA, TALLERES_RUIZ, FISIO_RETIRO, INMOBILIARIA_SOL] as const;
