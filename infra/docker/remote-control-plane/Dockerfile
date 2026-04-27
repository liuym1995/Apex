FROM node:22-slim

WORKDIR /app

COPY package*.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-config/package.json ./packages/shared-config/
COPY packages/shared-observability/package.json ./packages/shared-observability/
COPY packages/shared-auth/package.json ./packages/shared-auth/
COPY packages/shared-state/package.json ./packages/shared-state/
COPY packages/shared-runtime/package.json ./packages/shared-runtime/
COPY apps/remote-control-plane/package.json ./apps/remote-control-plane/

COPY tsconfig.base.json ./
COPY packages/shared-types/ ./packages/shared-types/
COPY packages/shared-config/ ./packages/shared-config/
COPY packages/shared-observability/ ./packages/shared-observability/
COPY packages/shared-auth/ ./packages/shared-auth/
COPY packages/shared-state/ ./packages/shared-state/
COPY packages/shared-runtime/ ./packages/shared-runtime/
COPY apps/remote-control-plane/ ./apps/remote-control-plane/

RUN npm install --omit=dev --workspace=@apex/remote-control-plane

EXPOSE 3020

ENV NODE_ENV=production
ENV PORT=3020
ENV HOST=0.0.0.0

CMD ["node", "apps/remote-control-plane/dist/index.js"]
