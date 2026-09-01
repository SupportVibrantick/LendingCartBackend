/**
 * Lender visibility for sign-document requirements:
 * - Forms this lender originally requested (requestApplicationLenderId)
 * - Forms the broker forwarded to this lender (submission on signed upload)
 */
function buildLenderSignDocumentVisibilityFilter(applicationLenderId) {
  return {
    OR: [
      { requestApplicationLenderId: applicationLenderId },
      {
        signStatus: { in: ["FORWARDED_TO_LENDER", "LENDER_SEEN"] },
        uploads: {
          some: {
            isSignedOutput: true,
            documentSubmissions: {
              some: { applicationLenderId },
            },
          },
        },
      },
    ],
  };
}

function appendSignDocumentSearchClause(searchTerm) {
  if (!searchTerm) return null;

  return {
    OR: [
      { signDocumentTitle: { contains: searchTerm, mode: "insensitive" } },
      { templateFileName: { contains: searchTerm, mode: "insensitive" } },
      {
        documentType: {
          name: { contains: searchTerm, mode: "insensitive" },
        },
      },
    ],
  };
}

function buildLenderSignDocumentWhere(
  applicationLender,
  applicationLenderId,
  searchTerm = "",
) {
  const and = [buildLenderSignDocumentVisibilityFilter(applicationLenderId)];
  const searchClause = appendSignDocumentSearchClause(searchTerm);
  if (searchClause) {
    and.push(searchClause);
  }

  return {
    loanApplicationId: applicationLender.loanApplicationId,
    requiresClientSignature: true,
    AND: and,
  };
}

function buildLenderSignDocumentRequirementWhere({
  loanApplicationId,
  applicationLenderId,
  requirementId,
  signStatus,
}) {
  const and = [buildLenderSignDocumentVisibilityFilter(applicationLenderId)];

  const where = {
    id: requirementId,
    loanApplicationId,
    requiresClientSignature: true,
    AND: and,
  };

  if (signStatus) {
    where.signStatus = signStatus;
  }

  return where;
}

module.exports = {
  buildLenderSignDocumentVisibilityFilter,
  appendSignDocumentSearchClause,
  buildLenderSignDocumentWhere,
  buildLenderSignDocumentRequirementWhere,
};
