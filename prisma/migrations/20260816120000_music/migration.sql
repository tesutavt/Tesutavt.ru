-- CreateEnum
CREATE TYPE "MusicSource" AS ENUM ('yandex', 'youtube');

-- CreateEnum
CREATE TYPE "MusicTrackStatus" AS ENUM ('queued', 'playing', 'played');

-- CreateTable
CREATE TABLE "YandexAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "uid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YandexAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YandexAccount_userId_key" ON "YandexAccount"("userId");

-- AddForeignKey
ALTER TABLE "YandexAccount" ADD CONSTRAINT "YandexAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "MusicSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "maxQueueLength" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MusicSettings_userId_key" ON "MusicSettings"("userId");

-- AddForeignKey
ALTER TABLE "MusicSettings" ADD CONSTRAINT "MusicSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "MusicTrack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "MusicSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "cover" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "streamUrl" TEXT,
    "requestedBy" TEXT NOT NULL,
    "requestSource" TEXT NOT NULL DEFAULT 'chat',
    "status" "MusicTrackStatus" NOT NULL DEFAULT 'queued',
    "position" INTEGER NOT NULL DEFAULT 0,
    "currentTimeSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusicTrack_userId_status_position_idx" ON "MusicTrack"("userId", "status", "position");

-- AddForeignKey
ALTER TABLE "MusicTrack" ADD CONSTRAINT "MusicTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
