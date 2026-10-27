-- CreateEnum
CREATE TYPE "CommandUserLevel" AS ENUM ('everyone', 'subscriber', 'vip', 'moderator', 'broadcaster');

-- CreateTable
CREATE TABLE "BotAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botTwitchId" TEXT NOT NULL,
    "botLogin" TEXT NOT NULL,
    "botDisplayName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotCommand" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "standardKey" TEXT,
    "response" TEXT,
    "userLevel" "CommandUserLevel" NOT NULL DEFAULT 'everyone',
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 5,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotTimer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 600,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotTimer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotAccount_userId_key" ON "BotAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BotCommand_userId_trigger_key" ON "BotCommand"("userId", "trigger");

-- AddForeignKey
ALTER TABLE "BotAccount" ADD CONSTRAINT "BotAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotCommand" ADD CONSTRAINT "BotCommand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotTimer" ADD CONSTRAINT "BotTimer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
