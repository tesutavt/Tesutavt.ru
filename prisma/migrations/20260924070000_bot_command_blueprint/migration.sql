-- CreateEnum
CREATE TYPE "CommandMode" AS ENUM ('text', 'graph');

-- AlterTable
ALTER TABLE "BotCommand" ADD COLUMN "mode" "CommandMode" NOT NULL DEFAULT 'text';
ALTER TABLE "BotCommand" ADD COLUMN "graph" JSONB;
