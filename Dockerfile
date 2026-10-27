# syntax=docker/dockerfile:1
#
# Осознанно один стейдж на полном node_modules (не resource-oптимизированный
# multi-stage с trace'ом) - на VDS с одним инстансом надёжность важнее
# размера образа: prisma CLI нужен внутри контейнера при старте, чтобы
# накатывать миграции (см. CMD), а Next.js standalone-трейсинг его бы не
# захватил (CLI нигде не импортируется из кода приложения).

FROM node:22-alpine AS app
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

# DATABASE_URL на этапе сборки фиктивный - prisma generate работает только
# со schema.prisma и к реальной базе не подключается; next build тоже не
# должен обращаться к базе (все обращения - в request-time route handlers).
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Миграции накатываются при каждом старте контейнера - это делает деплой
# однокомандным (docker compose up) без отдельного ручного шага.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
