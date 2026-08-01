FROM node:22-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package*.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN npm install

FROM base AS build
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build -w @plazainterinos/core \
 && npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build -w @tuplaza/api

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/core/package.json ./packages/core/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
