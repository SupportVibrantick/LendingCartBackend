const { LOAN_PRODUCTS } = require("../../prisma/loanProductCatalog.js");

const LOAN_PRODUCT_NAME_BY_CODE = Object.fromEntries(
  LOAN_PRODUCTS.map((product) => [product.code, product.name]),
);

function humanizeLoanProductCode(code) {
  if (!code) return "";
  return String(code)
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function resolveLoanProductName({
  lenderProduct = null,
  loanProductCode = "",
} = {}) {
  const code =
    lenderProduct?.loanProductCode ||
    lenderProduct?.loanProduct?.code ||
    loanProductCode ||
    "";

  return (
    lenderProduct?.loanProduct?.name ||
    LOAN_PRODUCT_NAME_BY_CODE[code] ||
    humanizeLoanProductCode(code) ||
    code
  );
}

module.exports = {
  resolveLoanProductName,
  humanizeLoanProductCode,
};
