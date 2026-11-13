// Las integraciones de plataforma que se pueden conectar (O-02, ADR 0053). Una
// entrada por sistema: el proveedor (integrations.provider) y su clave en la
// plataforma de conectores (en Nango, el «integration id» de cada entorno). La
// web solo acepta proveedores de esta lista; el webhook solo activa filas cuya
// clave coincide con la de su proveedor.

export type PlatformCategory = "calendar";

export interface PlatformIntegration {
  /** integrations.provider. */
  provider: string;
  /** La clave de la integración en la plataforma. */
  integrationKey: string;
  category: PlatformCategory;
}

export const PLATFORM_INTEGRATIONS: readonly PlatformIntegration[] = Object.freeze([
  Object.freeze({ provider: "google-calendar", integrationKey: "google-calendar", category: "calendar" }),
]);

/** La entrada de un proveedor, o undefined si no está en el catálogo (p. ej. lo que manda un cliente). */
export function platformIntegration(provider: unknown): PlatformIntegration | undefined {
  return typeof provider === "string" ? PLATFORM_INTEGRATIONS.find((entry) => entry.provider === provider) : undefined;
}

/** La entrada de una clave de la plataforma (lo que trae el webhook), o undefined. */
export function platformIntegrationByKey(integrationKey: unknown): PlatformIntegration | undefined {
  return typeof integrationKey === "string"
    ? PLATFORM_INTEGRATIONS.find((entry) => entry.integrationKey === integrationKey)
    : undefined;
}
