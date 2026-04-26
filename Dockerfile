ARG NODE_IMAGE=node:22-bookworm-slim
ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM ${NODE_IMAGE} AS deps
ARG NPM_REGISTRY
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm config set registry "$NPM_REGISTRY" && npm install

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN npx prisma generate
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
RUN mkdir -p /app/storage/generated
EXPOSE 3000
CMD ["npm", "run", "start"]
