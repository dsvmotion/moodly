# Worker de Moodly (ADR 0027) para Railway. Se construye desde la raíz del
# monorepo: `docker build -f apps/worker/Dockerfile .`
#
# Node de .nvmrc y pnpm de "packageManager" (corepack), como el CI.
FROM node:24.21.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo
# Todo el monorepo (menos lo de .dockerignore): pnpm comprueba el lockfile
# contra todos los package.json aunque solo instale el worker.
COPY . .

# Solo las dependencias de producción del worker y de los paquetes del monorepo
# que usa («...»: @repo/db, @repo/agent-core, @repo/config, @repo/integrations,
# @repo/knowledge y @repo/skills), para la imagen final.
FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter "@repo/worker..."

# Compilación: el worker, sus paquetes del monorepo y TypeScript, que vive en la raíz.
FROM base AS build
RUN pnpm install --frozen-lockfile --filter root --filter "@repo/worker..."
RUN pnpm --filter "@repo/worker..." build

FROM node:24.21.0-bookworm-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /repo/apps/worker/dist ./apps/worker/dist
COPY apps/worker/package.json ./apps/worker/
# Los paquetes del monorepo que usa el worker: lo compilado y sus dependencias.
# - @repo/db: createServiceDb (ADR 0009).
# - @repo/agent-core, @repo/config, @repo/integrations y @repo/skills: el turno del
#   agente, el enrutador de modelos, el calendario y las skills (paso 4d-3).
# - @repo/knowledge: el troceado de las fuentes de conocimiento (paso B20-1).
# Si el worker usa otro paquete del monorepo, va aquí (lo comprueba
# src/dockerfile.test.ts) y en las rutas que despliegan el worker en Railway
# (CLAUDE.md, «Worker en staging»).
COPY --from=prod-deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=build /repo/packages/db/dist ./packages/db/dist
COPY packages/db/package.json ./packages/db/
COPY --from=prod-deps /repo/packages/agent-core/node_modules ./packages/agent-core/node_modules
COPY --from=build /repo/packages/agent-core/dist ./packages/agent-core/dist
COPY packages/agent-core/package.json ./packages/agent-core/
COPY --from=build /repo/packages/config/dist ./packages/config/dist
COPY packages/config/package.json ./packages/config/
COPY --from=prod-deps /repo/packages/integrations/node_modules ./packages/integrations/node_modules
COPY --from=build /repo/packages/integrations/dist ./packages/integrations/dist
COPY packages/integrations/package.json ./packages/integrations/
COPY --from=build /repo/packages/knowledge/dist ./packages/knowledge/dist
COPY packages/knowledge/package.json ./packages/knowledge/
COPY --from=prod-deps /repo/packages/skills/node_modules ./packages/skills/node_modules
COPY --from=build /repo/packages/skills/dist ./packages/skills/dist
COPY packages/skills/package.json ./packages/skills/
# CA de Supabase: el worker verifica el certificado del pooler (sslmode=verify-full).
COPY apps/worker/certs ./apps/worker/certs
WORKDIR /repo/apps/worker
USER node
# Sin shell delante: SIGTERM llega a Node y el worker para limpio (main.ts).
CMD ["node", "dist/main.js"]
