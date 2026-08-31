const { z } = require("zod");

function resolveLoanProductCodeEnum() {
  const { LoanProductCode, $Enums } = require("@prisma/client");
  const enumObject = LoanProductCode || $Enums?.LoanProductCode;

  if (!enumObject || typeof enumObject !== "object") {
    throw new Error(
      "LoanProductCode is missing from @prisma/client. Run `npx prisma generate` in backend/.",
    );
  }

  return enumObject;
}

/** Deferred so Prisma client is fully generated before nativeEnum runs. */
const loanProductCodeSchema = z.lazy(() =>
  z.nativeEnum(resolveLoanProductCodeEnum()),
);

module.exports = {
  loanProductCodeSchema,
  resolveLoanProductCodeEnum,
};
