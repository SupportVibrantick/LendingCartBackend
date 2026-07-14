-- Allow submissions without Application Builder products
ALTER TABLE "application_submissions"
ALTER COLUMN "applicationProductId" DROP NOT NULL;
