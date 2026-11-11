// La capa de canales (ADR 0052): el mensaje normalizado, el contrato de cada
// adaptador, los estados de entrega y las plantillas.
export * from "./message.js";
export * from "./delivery.js";
export * from "./templates.js";
export * from "./adapter.js";
export * from "./outbound.js";
export * from "./signature.js";
export { createFakeAdapter, fakeSignature, FAKE_SIGNATURE_HEADER } from "./fake.js";
export type { FakeAdapter } from "./fake.js";
