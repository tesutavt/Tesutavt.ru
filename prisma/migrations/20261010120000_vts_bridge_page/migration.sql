-- AlterTable
ALTER TABLE "VtsConnection" ADD COLUMN "bridgeToken" TEXT;
ALTER TABLE "VtsConnection" ADD COLUMN "bridgeStatus" TEXT;
ALTER TABLE "VtsConnection" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- Заполняем токен для уже существующих подключений
UPDATE "VtsConnection" SET "bridgeToken" = md5(random()::text || clock_timestamp()::text || "id") WHERE "bridgeToken" IS NULL;
ALTER TABLE "VtsConnection" ALTER COLUMN "bridgeToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "VtsConnection_bridgeToken_key" ON "VtsConnection"("bridgeToken");
