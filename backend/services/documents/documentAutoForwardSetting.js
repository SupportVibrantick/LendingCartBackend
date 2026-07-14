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

async function getAutoForwardLenderRequestsToClient(prisma, loanApplicationId) {
  const rows = await prisma.$queryRaw`
    SELECT auto_forward_lender_requests_to_client AS "autoForwardLenderRequestsToClient"
    FROM loan_applications
    WHERE id = ${loanApplicationId}::uuid
    LIMIT 1
  `;

  return Boolean(rows[0]?.autoForwardLenderRequestsToClient);
}

async function setAutoForwardLenderRequestsToClient(
  prisma,
  loanApplicationId,
  autoForwardLenderRequestsToClient,
) {
  await prisma.$executeRaw`
    UPDATE loan_applications
    SET auto_forward_lender_requests_to_client = ${autoForwardLenderRequestsToClient}
    WHERE id = ${loanApplicationId}::uuid
  `;

  return {
    id: loanApplicationId,
    autoForwardLenderRequestsToClient,
  };
}

/**
 * When lender creates/updates LENDER_ADDED requirements, stamp sentToClientAt
 * only if auto-forward-to-client is enabled.
 */
async function resolveLenderRequestSentToClientAt(prisma, loanApplicationId) {
  const enabled = await getAutoForwardLenderRequestsToClient(
    prisma,
    loanApplicationId,
  );
  return enabled ? new Date() : null;
}

module.exports = {
  getAutoForwardDocumentsToLender,
  setAutoForwardDocumentsToLender,
  getAutoForwardLenderRequestsToClient,
  setAutoForwardLenderRequestsToClient,
  resolveLenderRequestSentToClientAt,
};
