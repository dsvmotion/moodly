// Rutas en español anteriores al ADR 0041 → las de ahora. Los marcadores y los
// enlaces de invitación ya compartidos siguen funcionando: la query (?token=…)
// pasa tal cual. Temporales (307) por prudencia: un navegador no las guarda para
// siempre si algún día hay que corregir una.

interface Redirect {
  source: string;
  destination: string;
  permanent: false;
}

/** Secciones de Ajustes cuyo tramo cambia; las demás (general, roles, plan) se llaman igual. */
export const LEGACY_SETTINGS_SLUGS: Readonly<Record<string, string>> = {
  perfil: "profile",
  preferencias: "preferences",
  privacidad: "privacy",
  equipo: "team",
  sedes: "locations",
  facturacion: "billing",
  modelos: "models",
  integraciones: "integrations",
  seguridad: "security",
  auditoria: "audit",
};

export const LEGACY_SECTIONS: Readonly<Record<string, string>> = {
  actividad: "activity",
  agentes: "agents",
  aprobaciones: "approvals",
  clientes: "contacts",
  conocimiento: "knowledge",
  conversaciones: "inbox",
  informes: "analytics",
  invitacion: "invitation",
  memoria: "memory",
  objetivos: "goals",
  tareas: "tasks",
};

/** Para `redirects()` de next.config.ts. Next.js usa la primera que encaja: las concretas, antes. */
export function legacyRedirects(): Redirect[] {
  return [
    ...Object.entries(LEGACY_SETTINGS_SLUGS).map(([es, en]) => ({
      source: `/app/ajustes/${es}`,
      destination: `/app/settings/${en}`,
      permanent: false as const,
    })),
    { source: "/app/ajustes/:path*", destination: "/app/settings/:path*", permanent: false },
    ...Object.entries(LEGACY_SECTIONS).map(([es, en]) => ({
      source: `/app/${es}/:path*`,
      destination: `/app/${en}/:path*`,
      permanent: false as const,
    })),
  ];
}
