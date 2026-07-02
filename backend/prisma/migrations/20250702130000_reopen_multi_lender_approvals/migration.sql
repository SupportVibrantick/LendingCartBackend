-- Re-open applications that were globally locked after the first lender approval.
-- Per-lender decisions live on application_lenders; the deal stays in review until funded.
UPDATE "loan_applications"
SET "status" = 'IN_REVIEW'
WHERE "status" = 'LENDER_APPROVED';
