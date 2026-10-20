# ---- Stage 1: build the Flutter web app ----
    FROM ghcr.io/cirruslabs/flutter:stable AS flutter_build
    USER root
    WORKDIR /demo
    COPY demo/pubspec.yaml demo/pubspec.lock ./
    RUN flutter pub get
    COPY demo/ ./
    RUN flutter build web --release
    # ---- Stage 2: compile the demo server ----
    FROM node:22-alpine AS server_build
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN npm ci
    COPY tsconfig.json tsconfig.build.json ./
    COPY src ./src
    RUN npm run build
    # ---- Stage 3: runtime ----
    FROM node:22-alpine AS runtime
    ENV NODE_ENV=production
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN npm ci --omit=dev
    COPY --from=server_build /app/dist ./dist
    COPY --from=flutter_build /demo/build/web ./public
    RUN mkdir -p /data && chown node:node /data
    ENV PUBLIC_DIR=/app/public
    ENV STATE_FILE=/data/demo_state.json
    USER node
    EXPOSE 8080
    CMD ["node", "dist/server.js"]