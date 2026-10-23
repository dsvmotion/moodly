// @ts-check
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// Revisión de seguridad 3.2 (MANUAL §4.4): fuera de packages/db y apps/web
// nadie crea un cliente de Supabase. El worker y los paquetes del backend
// acceden con createServiceDb().forOrganization(orgId) de @repo/db/service,
// que añade organization_id a toda consulta. Lo comprueba también
// packages/db/src/service-boundary.test.ts.
const supabaseOnlyInDb = {
  group: ["@supabase/*"],
  message: "Usa createServiceDb().forOrganization(orgId) de @repo/db/service.",
};

// ADR 0027 («Aislamiento del motor»): solo apps/worker importa DBOS; el resto
// usa la interfaz de packages/agent-core. Lo comprueba también
// apps/worker/src/dbos-boundary.test.ts.
const dbosOnlyInWorker = { group: ["@dbos-inc/*"], message: "Solo apps/worker importa DBOS (ADR 0027)." };

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "**/playwright-report/**",
      "**/test-results/**",
      "packages/db/src/database.types.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // Fronteras de importación. En flat config, dos bloques con
  // no-restricted-imports sobre el mismo archivo no se suman (gana el último),
  // así que cada bloque lleva todas las reglas de sus archivos.
  {
    files: ["apps/worker/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [supabaseOnlyInDb] }] },
  },
  {
    files: ["packages/*/**/*.{ts,tsx}"],
    ignores: ["packages/db/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [supabaseOnlyInDb, dbosOnlyInWorker] }] },
  },
  {
    files: ["packages/db/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [dbosOnlyInWorker] }] },
  },
  // apps/web nunca usa la clave secreta (AGENTS.md): ni siquiera puede importar
  // el cliente de plataforma.
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "@repo/db/service", message: "apps/web no usa la clave secreta de Supabase (AGENTS.md)." }],
          patterns: [dbosOnlyInWorker],
        },
      ],
    },
  },
  // React (apps/web y packages/ui): reglas de hooks y navegador.
  {
    files: ["apps/web/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    ...reactHooks.configs.flat.recommended,
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
);
