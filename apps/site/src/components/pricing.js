// Modelo de precios de la web pública (MANUAL §15.1 y §15.2, decidido por producto
// el 2026-11-03 y el 2026-11-08): alta autoservicio con tarjeta y una prueba de
// 7 días con 5 € de crédito de IA; después, la organización elige cómo seguir
// (bajo demanda, paquete de créditos o plan mensual). Enterprise e implantaciones
// a medida, con presupuesto cerrado y contrato. Los importes de los planes siguen
// abiertos: aquí solo va lo decidido. Cambiar aquí actualiza la home, /precios y
// /sectores a la vez.

export const PRICING = {
  trialDays: 7,
  trialCreditEur: 5,
  // Avisos antes de acabarse el crédito (§15.1 punto 4).
  warnAtPercent: 80,
};

export const eur = (n, decimals = 0) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " €";
