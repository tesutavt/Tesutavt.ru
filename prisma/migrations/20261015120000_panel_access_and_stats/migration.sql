-- CreateTable
CREATE TABLE "PanelAccess" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "editorTwitchId" TEXT NOT NULL,
    "editorLogin" TEXT NOT NULL,
    "editorDisplayName" TEXT NOT NULL,
    "editorAvatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PanelAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelStatDaily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "followers" INTEGER,
    "subscribers" INTEGER,
    "peakViewers" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelStatDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PanelAccess_editorTwitchId_idx" ON "PanelAccess"("editorTwitchId");

-- CreateIndex
CREATE UNIQUE INDEX "PanelAccess_ownerId_editorTwitchId_key" ON "PanelAccess"("ownerId", "editorTwitchId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelStatDaily_userId_date_key" ON "ChannelStatDaily"("userId", "date");

-- AddForeignKey
ALTER TABLE "PanelAccess" ADD CONSTRAINT "PanelAccess_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelStatDaily" ADD CONSTRAINT "ChannelStatDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

