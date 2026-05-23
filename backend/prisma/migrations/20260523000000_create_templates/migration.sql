CREATE TYPE "TemplateStatus" AS ENUM (
  'DRAFT',
  'UPLOADED',
  'PROCESSING',
  'READY',
  'FAILED',
  'GENERATED'
);

CREATE TABLE "Template" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "originalZipUrl" TEXT,
  "generatedZipUrl" TEXT,
  "previewUrl" TEXT,
  "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "detectedTexts" JSONB,
  "detectedColors" JSONB,
  "replacements" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);
