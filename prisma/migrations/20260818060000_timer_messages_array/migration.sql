-- AlterTable
ALTER TABLE "BotTimer" ADD COLUMN "messages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "BotTimer" ADD COLUMN "minMessages" INTEGER NOT NULL DEFAULT 0;

-- Переносим старые одиночные сообщения в новый массив
UPDATE "BotTimer" SET "messages" = ARRAY["message"] WHERE "message" IS NOT NULL AND "message" <> '';

-- DropColumn
ALTER TABLE "BotTimer" DROP COLUMN "message";
