-- CreateTable
CREATE TABLE "loan_ai_book_demo_leads" (
    "id" UUID NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'loan-ai-book-demo',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "loan_ai_book_demo_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loan_ai_book_demo_leads_email_idx" ON "loan_ai_book_demo_leads"("email");

-- CreateIndex
CREATE INDEX "loan_ai_book_demo_leads_source_idx" ON "loan_ai_book_demo_leads"("source");

-- CreateIndex
CREATE INDEX "loan_ai_book_demo_leads_status_idx" ON "loan_ai_book_demo_leads"("status");
