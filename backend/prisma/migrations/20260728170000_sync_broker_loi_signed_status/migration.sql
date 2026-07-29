-- Sync broker_loi_versions status from existing client sign workflow records

UPDATE "broker_loi_versions" bv
SET
  "status" = CASE
    WHEN adr."signStatus" IN ('FORWARDED_TO_LENDER', 'LENDER_SEEN') THEN 'FORWARDED_TO_LENDER'
    WHEN adr."signStatus" = 'CLIENT_SIGNED' THEN 'CLIENT_SIGNED'
    WHEN adr."signStatus" = 'SENT_TO_CLIENT' THEN 'SENT_TO_CLIENT'
    ELSE bv."status"
  END,
  "sent_to_client_at" = COALESCE(bv."sent_to_client_at", adr."sentToClientAt"),
  "client_signed_at" = COALESCE(bv."client_signed_at", adr."clientSignedAt"),
  "document_requirement_id" = COALESCE(bv."document_requirement_id", adr."id")
FROM "loan_applications" la
JOIN "application_document_requirements" adr
  ON adr."loanApplicationId" = la."id"
JOIN "document_types" dt
  ON dt."id" = adr."documentTypeId"
WHERE bv."loan_application_id" = la."id"
  AND bv."id" = la."current_broker_loi_version_id"
  AND dt."code" = 'BROKER_LOI_TERM_SHEET'
  AND adr."requiresClientSignature" = true
  AND adr."signStatus" IN (
    'SENT_TO_CLIENT',
    'CLIENT_SIGNED',
    'FORWARDED_TO_LENDER',
    'LENDER_SEEN'
  );

UPDATE "broker_loi_versions" bv
SET "signed_pdf_url" = signed."fileUrl"
FROM (
  SELECT DISTINCT ON (adu."documentRequirementId")
    adu."documentRequirementId",
    adu."fileUrl"
  FROM "application_document_uploads" adu
  WHERE adu."isSignedOutput" = true
  ORDER BY adu."documentRequirementId", adu."uploadedAt" DESC
) signed
WHERE bv."document_requirement_id" = signed."documentRequirementId"
  AND bv."signed_pdf_url" IS NULL
  AND signed."fileUrl" IS NOT NULL;
