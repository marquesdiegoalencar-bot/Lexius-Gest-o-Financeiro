FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY schema.sql ./
COPY migrations ./migrations/
COPY scripts/migrate.js scripts/seed-dev.js scripts/create-usuario.js scripts/delete-contas-teste.js ./scripts/
COPY scripts/docker-api-entrypoint.sh ./scripts/docker-api-entrypoint.sh
RUN chmod +x ./scripts/docker-api-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./scripts/docker-api-entrypoint.sh"]