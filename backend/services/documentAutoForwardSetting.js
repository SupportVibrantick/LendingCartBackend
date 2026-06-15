async function getAutoForwardDocumentsToLender(prisma, loanApplicationId) {
  const rows = await prisma.$queryRaw`
    SELECT auto_forward_documents_to_lender AS "autoForwardDocumentsToLender"
    FROM loan_applications
    WHERE id = ${loanApplicationId}::uuid
    LIMIT 1
  `;

  return Boolean(rows[0]?.autoForwardDocumentsToLender);
}

async function setAutoForwardDocumentsToLender(
  prisma,
  loanApplicationId,
  autoForwardDocumentsToLender,
) {
  await prisma.$executeRaw`
    UPDATE loan_applications
    SET auto_forward_documents_to_lender = ${autoForwardDocumentsToLender}
    WHERE id = ${loanApplicationId}::uuid
  `;

  return {
    id: loanApplicationId,
    autoForwardDocumentsToLender,
  };
}

module.exports = {
  getAutoForwardDocumentsToLender,
  setAutoForwardDocumentsToLender,
};
