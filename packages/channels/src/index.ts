// La capa de canales (ADR 0052): el mensaje normalizado, el contrato de cada
// adaptador, los estados de entrega y las plantillas. El adaptador de prueba
// va aparte, en @repo/channels/testing: no entra en el código de producción.
export * from "./message.js";
export * from "./delivery.js";
export * from "./templates.js";
export * from "./adapter.js";
export * from "./outbound.js";
export * from "./signature.js";
