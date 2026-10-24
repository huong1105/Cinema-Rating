FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS builder
COPY package*.json ./
COPY prisma ./prisma/
# Prisma CLI is currently a devDependency and is needed for migrate deploy.
# Keep the locked dependencies so startup never downloads a different CLI.
RUN npm ci
RUN ./node_modules/.bin/prisma generate

FROM base
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY src ./src
COPY docs ./docs
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node src/server.js"]
