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
# que usa («...»: @repo/db), para la imagen final.
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
# @repo/db (createServiceDb, ADR 0009): lo compilado y sus dependencias.
COPY --from=prod-deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=build /repo/packages/db/dist ./packages/db/dist
COPY packages/db/package.json ./packages/db/
# CA de Supabase: el worker verifica el certificado del pooler (sslmode=verify-full).
COPY apps/worker/certs ./apps/worker/certs
WORKDIR /repo/apps/worker
USER node
# Sin shell delante: SIGTERM llega a Node y el worker para limpio (main.ts).
CMD ["node", "dist/main.js"]
