# syntax=docker/dockerfile:1
# Railway uses this Dockerfile instead of Railpack when present, so the runtime image
# always includes `server/dist` + Vite `dist` + server `node_modules` (fixes empty/gated Railpack runtime).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
# Match Railway Railpack when the service root directory is `server/`: cwd is the API package so
# `node dist/index.js` works. Vite output stays at /app/dist; index.ts resolves it via import.meta.url.
WORKDIR /app/server
ENV NODE_ENV=production
# Railway normally overrides at runtime; if PORT were ever missing, healthchecks default to 8080.
ENV PORT=8080
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/package.json ./package.json
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/dist /app/dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
