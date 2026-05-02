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
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
