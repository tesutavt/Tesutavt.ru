-- CreateEnum
CREATE TYPE "ElementKind" AS ENUM ('preset', 'custom');

-- AlterTable: add canvas fields to Widget (old content columns dropped later, after backfill)
ALTER TABLE "Widget"
  ADD COLUMN "canvasWidth" INTEGER NOT NULL DEFAULT 1920,
  ADD COLUMN "canvasHeight" INTEGER NOT NULL DEFAULT 1080;

-- CreateTable
CREATE TABLE "WidgetElement" (
    "id" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ElementKind" NOT NULL DEFAULT 'custom',
    "presetId" TEXT,
    "x" INTEGER NOT NULL DEFAULT 40,
    "y" INTEGER NOT NULL DEFAULT 40,
    "width" INTEGER NOT NULL DEFAULT 400,
    "height" INTEGER NOT NULL DEFAULT 300,
    "zIndex" INTEGER NOT NULL DEFAULT 0,
    "html" TEXT NOT NULL DEFAULT '',
    "css" TEXT NOT NULL DEFAULT '',
    "js" TEXT NOT NULL DEFAULT '',
    "fieldsSchema" JSONB NOT NULL DEFAULT '[]',
    "fieldValues" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetElement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WidgetElement_widgetId_idx" ON "WidgetElement"("widgetId");

-- AddForeignKey
ALTER TABLE "WidgetElement" ADD CONSTRAINT "WidgetElement_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "Widget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: fold each existing Widget (single html/css/js blob) into one WidgetElement,
-- so widgets created before the canvas rework aren't lost.
INSERT INTO "WidgetElement" (
  "id", "widgetId", "name", "kind", "x", "y", "width", "height", "zIndex",
  "html", "css", "js", "fieldsSchema", "fieldValues", "createdAt", "updatedAt"
)
SELECT
  left(md5(random()::text || clock_timestamp()::text || "id"), 25),
  "id",
  "name",
  "kind"::text::"ElementKind",
  40,
  40,
  "width",
  "height",
  0,
  "html",
  "css",
  "js",
  "fieldsSchema",
  "fieldValues",
  now(),
  now()
FROM "Widget";

-- AlterTable: drop old single-blob columns now that they're backfilled into WidgetElement
ALTER TABLE "Widget"
  DROP COLUMN "css",
  DROP COLUMN "fieldValues",
  DROP COLUMN "fieldsSchema",
  DROP COLUMN "height",
  DROP COLUMN "html",
  DROP COLUMN "js",
  DROP COLUMN "kind",
  DROP COLUMN "width";

-- DropEnum
DROP TYPE "WidgetKind";
