// Solo para tests: el adaptador de prueba de la capa de canales. Fuera de la
// exportación principal para que ningún código de producción lo use.
export { createFakeAdapter, FAKE_SIGNATURE_HEADER } from "./fake.js";
export type { FakeAdapter } from "./fake.js";
