/**
 * Resolve a catalog loan product for application submit (no Application Builder).
 * Accepts loanProductCode (preferred) or legacy applicationProductId.
 */
async function resolveSubmitLoanProduct(prisma, {
  loanProductCode,
  applicationProductId,
  brokerOrgId,
}) {
  const codeFromBody =
    typeof loanProductCode === "string" ? loanProductCode.trim() : "";

  if (codeFromBody) {
    const catalogProduct = await prisma.loanProduct.findFirst({
      where: {
        code: codeFromBody,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });

    if (!catalogProduct) {
      return {
        error: {
          status: 404,
          message: "Invalid or inactive loan product",
        },
      };
    }

    return {
      loanProductCode: catalogProduct.code,
      applicationProductId: null,
      catalogProduct,
    };
  }

  // Legacy Application Builder path
  if (applicationProductId) {
    const brokerProduct = await prisma.brokerApplicationProduct.findFirst({
      where: {
        id: applicationProductId,
        isActive: true,
        brokerApplication: {
          isActive: true,
          ...(brokerOrgId ? { brokerOrgId } : {}),
        },
      },
      select: {
        id: true,
        loanProductCode: true,
        brokerApplication: {
          select: { id: true, brokerOrgId: true },
        },
      },
    });

    if (!brokerProduct) {
      return {
        error: {
          status: 404,
          message: "Invalid or unauthorized application product",
        },
      };
    }

    return {
      loanProductCode: brokerProduct.loanProductCode,
      applicationProductId: brokerProduct.id,
      brokerApplicationId: brokerProduct.brokerApplication.id,
      brokerOrgId: brokerProduct.brokerApplication.brokerOrgId,
      catalogProduct: null,
    };
  }

  return {
    error: {
      status: 400,
      message: "loanProductCode is required",
    },
  };
}

module.exports = {
  resolveSubmitLoanProduct,
};
