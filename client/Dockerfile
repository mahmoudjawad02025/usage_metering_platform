# ---- Stage 1: build the Flutter web app ----
FROM ghcr.io/cirruslabs/flutter:stable AS flutter_build
USER root
WORKDIR /demo
COPY demo/pubspec.yaml demo/pubspec.lock ./
RUN flutter pub get
COPY demo/ ./
RUN flutter build web --release

# ---- Stage 2: static UI behind nginx ----
FROM nginxinc/nginx-unprivileged:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=flutter_build /demo/build/web /usr/share/nginx/html
EXPOSE 8080
