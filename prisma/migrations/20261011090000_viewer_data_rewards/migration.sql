-- CreateEnum
CREATE TYPE "ViewerFieldType" AS ENUM ('text', 'number', 'date');

-- CreateTable
CREATE TABLE "ViewerField" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "ViewerFieldType" NOT NULL DEFAULT 'text',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxLength" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewerField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewerTwitchId" TEXT NOT NULL,
    "viewerLogin" TEXT NOT NULL,
    "viewerName" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewerData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotSecret" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "twitchRewardId" TEXT,
    "title" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 100,
    "prompt" TEXT NOT NULL DEFAULT '',
    "backgroundColor" TEXT NOT NULL DEFAULT '#9147FF',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isUserInputRequired" BOOLEAN NOT NULL DEFAULT false,
    "skipQueue" BOOLEAN NOT NULL DEFAULT false,
    "maxPerStream" INTEGER,
    "maxPerUserPerStream" INTEGER,
    "globalCooldownSeconds" INTEGER,
    "graph" JSONB,
    "lastSyncError" TEXT,
    "lastRedeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ViewerField_userId_key_key" ON "ViewerField"("userId", "key");
CREATE UNIQUE INDEX "ViewerData_userId_viewerTwitchId_key_key" ON "ViewerData"("userId", "viewerTwitchId", "key");
CREATE INDEX "ViewerData_userId_viewerLogin_idx" ON "ViewerData"("userId", "viewerLogin");
CREATE UNIQUE INDEX "BotSecret_userId_name_key" ON "BotSecret"("userId", "name");
CREATE UNIQUE INDEX "ChannelReward_twitchRewardId_key" ON "ChannelReward"("twitchRewardId");
CREATE INDEX "ChannelReward_userId_idx" ON "ChannelReward"("userId");

-- AddForeignKey
ALTER TABLE "ViewerField" ADD CONSTRAINT "ViewerField_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ViewerData" ADD CONSTRAINT "ViewerData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotSecret" ADD CONSTRAINT "BotSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelReward" ADD CONSTRAINT "ChannelReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
