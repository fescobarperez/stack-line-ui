# ── Compilación del estático ──────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /src

# npm ci y no npm install: instala exactamente el lock, sin sorpresas de
# versión entre tu máquina y el servidor.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Servidor ──────────────────────────────────────────────────────────
# Caddy sirve el estático Y hace de proxy de /api hacia el backend, así que
# el navegador ve un solo origen. Eso evita CORS por completo: el front ya
# resuelve las URLs vacías como "mismo origen" (ver src/api/services.js).
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv
EXPOSE 80 443
