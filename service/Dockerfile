# ---- Stage 1: compile TypeScript ----
    FROM node:22-alpine AS build
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN npm ci
    COPY tsconfig.json tsconfig.build.json ./
    COPY src ./src
    RUN npm run build
    RUN mkdir -p dist/db/migrations && cp src/db/migrations/*.sql dist/db/migrations/
    # ---- Stage 2: small runtime image ----
    FROM node:22-alpine AS runtime
    ENV NODE_ENV=production
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN npm ci --omit=dev
    COPY --from=build /app/dist ./dist
    USER node
    EXPOSE 3000
    CMD ["node", "dist/server.js"]