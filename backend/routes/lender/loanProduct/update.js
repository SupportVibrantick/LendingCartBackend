const { Prisma } = require("@prisma/client");

const {
  updateLenderLoanProductSchema,
} = require("../../../schemas/lender/loanProduct/update.schema");
const {
  isBridgeLoanProduct,
  isFixAndFlipProduct,
  isDscrRentalProduct,
  isRentalPortfolioProduct,
  isConstructionLoanProduct,
  isCrePermanentProduct,
  isCmbsProduct,
  isAgencyMultifamilyProduct,
  isMezzanineProduct,
  isPreferredEquityProduct,
  isSba7aGeneralProduct,
  isSba7aBusinessAcquisitionProduct,
  isSba7aWorkingCapitalProduct,
  isSba7aEquipmentPurchaseProduct,
  isSba7aRealEstateProduct,
  isSba504Product,
  isUsdaBiProduct,
  isPurchaseOrderFinanceProduct,
  isEquipmentFinanceProduct,
  isArFactoringProduct,
  isApSupplyChainProduct,
  isSba7aMaxLoanOnlyProduct,
  isNoMinLoanCriteriaProduct,
  isSba7aNoLtvProduct,
  isNoLtvCriteriaProduct,
  isNoPropertyMetricsProduct,
  isNoTermCriteriaProduct,
  isSba7aRateSpreadProduct,
  supportsLtcPercent,
} = require("../../../utils/lender/lenderProductCriteria");
const { stripNullValues } = require("../../../utils/common/stripNullValues");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateLenderLoanProductRoutes(fastify) {
  fastify.put(
    "/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "Update lender loan product (Same as create logic)",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: { type: "object" },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // 🔐 AUTH
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { id } = req.params;

        // 🧪 VALIDATION
        const parsed = updateLenderLoanProductSchema.safeParse(
          stripNullValues(req.body),
        );

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        // 🔍 CHECK OWNERSHIP
        const existing = await prisma.lenderProduct.findFirst({
          where: { id, lenderOrgId },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            message: "Loan product configuration not found",
          });
        }

        // 🧠 BUILD UPDATE DATA (SAME AS CREATE)
        const updateData = {};

        // helper functions
        const setDecimal = (field, value) => {
          if (value !== undefined) {
            updateData[field] =
              value === null ? null : new Prisma.Decimal(value);
          }
        };

        const setValue = (field, value) => {
          if (value !== undefined) {
            updateData[field] = value;
          }
        };

        // 💰 FINANCIAL
        setDecimal("minLoanAmount", data.minLoanAmount);
        setDecimal("maxLoanAmount", data.maxLoanAmount);
        if (isNoMinLoanCriteriaProduct(existing.loanProductCode)) {
          updateData.minLoanAmount = null;
        }
        if (isSba504Product(existing.loanProductCode)) {
          updateData.maxLoanAmount = null;
        }

        // ✅ LTV
        if (
          !isMezzanineProduct(existing.loanProductCode) &&
          !isPreferredEquityProduct(existing.loanProductCode) &&
          !isNoPropertyMetricsProduct(existing.loanProductCode)
        ) {
          setDecimal("maxLtvPercent", data.maxLtvPercent);
        }
        if (isMezzanineProduct(existing.loanProductCode)) {
          setDecimal("minMezzLtvPercent", data.minMezzLtvPercent);
          setDecimal("maxMezzLtvPercent", data.maxMezzLtvPercent);
          setDecimal("exitFeePercent", data.exitFeePercent);
        }
        if (isPreferredEquityProduct(existing.loanProductCode)) {
          setDecimal("preferredReturnPercent", data.preferredReturnPercent);
          setDecimal("exitFeePercent", data.exitFeePercent);
        }
        if (isSba7aRateSpreadProduct(existing.loanProductCode)) {
          setDecimal("maxRateSpreadPercent", data.maxRateSpreadPercent);
          setDecimal("minRateSpreadPercent", data.minRateSpreadPercent);
          setDecimal("sbaGuaranteePercent", data.sbaGuaranteePercent);
        }
        if (isSba7aGeneralProduct(existing.loanProductCode)) {
          setValue("avgTurnaroundDays", data.avgTurnaroundDays);
          setValue("preferredLenderPlp", data.preferredLenderPlp);
        }
        if (isSba7aBusinessAcquisitionProduct(existing.loanProductCode)) {
          setDecimal("requiredInjectionPercent", data.requiredInjectionPercent);
          setValue("goodwillFinancingAllowed", data.goodwillFinancingAllowed);
          setValue("sellerFinancingAllowed", data.sellerFinancingAllowed);
          setValue("minLiquidityRequirement", data.minLiquidityRequirement);
        }
        if (isSba7aWorkingCapitalProduct(existing.loanProductCode)) {
          setValue("minTimeInBusinessMonths", data.minTimeInBusinessMonths);
          setDecimal("minAnnualRevenue", data.minAnnualRevenue);
          setDecimal("maxFinancingPercent", data.maxFinancingPercent);
          setValue("useOfFunds", data.useOfFunds);
          setValue("collateralRequirements", data.collateralRequirements);
          setValue("startupAllowed", data.startupAllowed);
          setValue("lineOfCreditAvailable", data.lineOfCreditAvailable);
          setValue("prepaymentStructure", data.prepaymentStructure);
        }
        if (isSba7aEquipmentPurchaseProduct(existing.loanProductCode)) {
          setValue("usedEquipmentAllowed", data.usedEquipmentAllowed);
          setValue("minTimeInBusinessMonths", data.minTimeInBusinessMonths);
          setValue("startupAllowed", data.startupAllowed);
          setValue("prepaymentStructure", data.prepaymentStructure);
        }
        if (isSba7aRealEstateProduct(existing.loanProductCode)) {
          setValue("ownerOccupiedRequired", data.ownerOccupiedRequired);
          setValue("ownerOccupancyRequirement", data.ownerOccupancyRequirement);
          setValue("environmentalReportRequired", data.environmentalReportRequired);
          setValue("appraisalRequired", data.appraisalRequired);
          setValue("prepaymentStructure", data.prepaymentStructure);
        }
        if (isSba504Product(existing.loanProductCode)) {
          setDecimal("maxTotalProjectAmount", data.maxTotalProjectAmount);
          setDecimal("maxSba504DebentureAmount", data.maxSba504DebentureAmount);
          setDecimal("requiredInjectionPercent", data.requiredInjectionPercent);
          setValue("minTimeInBusinessMonths", data.minTimeInBusinessMonths);
          setValue("ownerOccupiedRequired", data.ownerOccupiedRequired);
          setValue("ownerOccupancyRequirement", data.ownerOccupancyRequirement);
          setValue("environmentalReportRequired", data.environmentalReportRequired);
          setValue("appraisalRequired", data.appraisalRequired);
          setValue("jobCreationRequired", data.jobCreationRequired);
          setValue("avgTurnaroundDays", data.avgTurnaroundDays);
          setValue("prepaymentStructure", data.prepaymentStructure);
          setValue("useOfFunds", data.useOfFunds);
          setValue("collateralRequirements", data.collateralRequirements);
          setValue("startupAllowed", data.startupAllowed);
          setValue("rateStructure", data.rateStructure);
          setValue("refinanceAllowed", data.refinanceAllowed);
          setValue("workingCapitalEligible", data.workingCapitalEligible);
          setValue("lifeInsuranceMayBeRequired", data.lifeInsuranceMayBeRequired);
          setValue("interestRateRange", data.interestRateRange);
        }
        if (isUsdaBiProduct(existing.loanProductCode)) {
          setDecimal("maxUsdaGuaranteeAmount", data.maxUsdaGuaranteeAmount);
          setDecimal("usdaGuaranteePercent", data.usdaGuaranteePercent);
          setValue("ruralAreaRequired", data.ruralAreaRequired);
        }
        if (isPurchaseOrderFinanceProduct(existing.loanProductCode)) {
          setDecimal("advanceRatePercent", data.advanceRatePercent);
          setDecimal("transactionFeePercent", data.transactionFeePercent);
          setDecimal("minGrossMarginPercent", data.minGrossMarginPercent);
          setValue("internationalPosAllowed", data.internationalPosAllowed);
        }
        if (isArFactoringProduct(existing.loanProductCode)) {
          setDecimal("advanceRatePercent", data.advanceRatePercent);
          setDecimal("discountFeePercent", data.discountFeePercent);
          setValue("maxInvoiceAgeDays", data.maxInvoiceAgeDays);
          setValue("nonRecourseAvailable", data.nonRecourseAvailable);
          setValue("governmentInvoicesOk", data.governmentInvoicesOk);
        }
        if (isApSupplyChainProduct(existing.loanProductCode)) {
          setDecimal(
            "earlyPaymentDiscountPercent",
            data.earlyPaymentDiscountPercent,
          );
          setValue("paymentTermsExtensionDays", data.paymentTermsExtensionDays);
          setValue(
            "dynamicDiscountingAvailable",
            data.dynamicDiscountingAvailable,
          );
          setValue("reverseFactoringAvailable", data.reverseFactoringAvailable);
        }
        if (isEquipmentFinanceProduct(existing.loanProductCode)) {
          setValue("usedEquipmentAllowed", data.usedEquipmentAllowed);
          setValue("saleLeasebackAvailable", data.saleLeasebackAvailable);
        }

        // ✅ ARV
        if (
          !isBridgeLoanProduct(existing.loanProductCode) &&
          !isDscrRentalProduct(existing.loanProductCode) &&
          !isRentalPortfolioProduct(existing.loanProductCode) &&
          !isConstructionLoanProduct(existing.loanProductCode) &&
          !isCrePermanentProduct(existing.loanProductCode) &&
          !isCmbsProduct(existing.loanProductCode) &&
          !isAgencyMultifamilyProduct(existing.loanProductCode) &&
          !isMezzanineProduct(existing.loanProductCode) &&
          !isPreferredEquityProduct(existing.loanProductCode) &&
          !isNoPropertyMetricsProduct(existing.loanProductCode)
        ) {
          setDecimal("maxArvPercent", data.maxArvPercent);
        }

        // ✅ LTC
        if (
          supportsLtcPercent(existing.loanProductCode) &&
          !isMezzanineProduct(existing.loanProductCode) &&
          !isPreferredEquityProduct(existing.loanProductCode) &&
          !isNoPropertyMetricsProduct(existing.loanProductCode)
        ) {
          setDecimal("maxLtcPercent", data.maxLtcPercent);
        }

        // 🔢 NUMERIC
        setValue("minTermMonths", data.minTermMonths);
        setValue("maxTermMonths", data.maxTermMonths);
        if (
          !isPurchaseOrderFinanceProduct(existing.loanProductCode) &&
          !isArFactoringProduct(existing.loanProductCode) &&
          !isApSupplyChainProduct(existing.loanProductCode) &&
          !isCmbsProduct(existing.loanProductCode) &&
          !isAgencyMultifamilyProduct(existing.loanProductCode) &&
          !isMezzanineProduct(existing.loanProductCode) &&
          !isPreferredEquityProduct(existing.loanProductCode)
        ) {
          setValue("minCreditScore", data.minCreditScore);
        }

        // ✅ SAME AS CREATE (STRING)
        if (
          data.minExperience !== undefined &&
          !isBridgeLoanProduct(existing.loanProductCode) &&
          !isFixAndFlipProduct(existing.loanProductCode) &&
          !isDscrRentalProduct(existing.loanProductCode) &&
          !isRentalPortfolioProduct(existing.loanProductCode) &&
          !isConstructionLoanProduct(existing.loanProductCode) &&
          !isCrePermanentProduct(existing.loanProductCode) &&
          !isCmbsProduct(existing.loanProductCode) &&
          !isAgencyMultifamilyProduct(existing.loanProductCode) &&
          !isMezzanineProduct(existing.loanProductCode) &&
          !isPreferredEquityProduct(existing.loanProductCode) &&
          !isNoPropertyMetricsProduct(existing.loanProductCode)
        ) {
          updateData.minExperience =
            data.minExperience !== null ? String(data.minExperience) : null;
        }

        if (!isNoPropertyMetricsProduct(existing.loanProductCode)) {
          setDecimal("originationPointsPercent", data.originationPointsPercent);
        }
        if (isBridgeLoanProduct(existing.loanProductCode)) {
          setValue("extensionAvailable", data.extensionAvailable);
        }
        if (
          isBridgeLoanProduct(existing.loanProductCode) ||
          isSba7aMaxLoanOnlyProduct(existing.loanProductCode) ||
          isSba504Product(existing.loanProductCode)
        ) {
          setValue("personalGuaranteeRequired", data.personalGuaranteeRequired);
        }
        if (isFixAndFlipProduct(existing.loanProductCode)) {
          setValue("firstTimeBorrowersAllowed", data.firstTimeBorrowersAllowed);
        }
        if (
          isDscrRentalProduct(existing.loanProductCode) ||
          isRentalPortfolioProduct(existing.loanProductCode) ||
          isCrePermanentProduct(existing.loanProductCode) ||
          isCmbsProduct(existing.loanProductCode) ||
          isAgencyMultifamilyProduct(existing.loanProductCode) ||
          isSba7aMaxLoanOnlyProduct(existing.loanProductCode) ||
          isSba504Product(existing.loanProductCode)
        ) {
          setDecimal("minDscr", data.minDscr);
        }
        if (isDscrRentalProduct(existing.loanProductCode)) {
          setValue("interestOnlyAvailable", data.interestOnlyAvailable);
          setValue("shortTermRentalsOk", data.shortTermRentalsOk);
          setValue("foreignNationalsAllowed", data.foreignNationalsAllowed);
        }
        if (isRentalPortfolioProduct(existing.loanProductCode)) {
          setValue("minPropertiesInPortfolio", data.minPropertiesInPortfolio);
          setValue("maxPropertiesInPortfolio", data.maxPropertiesInPortfolio);
        }
        if (isCrePermanentProduct(existing.loanProductCode)) {
          setDecimal("minDebtYieldPercent", data.minDebtYieldPercent);
          setValue("amortizationYears", data.amortizationYears);
        }
        if (isCmbsProduct(existing.loanProductCode)) {
          setDecimal("minDebtYieldPercent", data.minDebtYieldPercent);
          setValue("amortizationYears", data.amortizationYears);
          setValue("prepaymentStructure", data.prepaymentStructure);
        }
        if (isAgencyMultifamilyProduct(existing.loanProductCode)) {
          setValue("amortizationYears", data.amortizationYears);
          setValue("minUnits", data.minUnits);
        }
        if (isConstructionLoanProduct(existing.loanProductCode)) {
          setValue("gcRequired", data.gcRequired);
          setValue("completionGuaranteeRequired", data.completionGuaranteeRequired);
        }
        setValue("criteriaNotes", data.criteriaNotes);

        // 📝 STRING
        if (
          !isPreferredEquityProduct(existing.loanProductCode) &&
          !isNoMinLoanCriteriaProduct(existing.loanProductCode) &&
          !isPurchaseOrderFinanceProduct(existing.loanProductCode) &&
          !isArFactoringProduct(existing.loanProductCode) &&
          !isApSupplyChainProduct(existing.loanProductCode)
        ) {
          setValue("interestRateRange", data.interestRateRange);
        }

        // ✅ JSON (NO stringify)
        setValue("businessTypes", data.businessTypes);
        setValue("propertyTypes", data.propertyTypes);

        // ⚠️ CSV (same as create)
        if (data.statesSupported !== undefined) {
          updateData.statesSupported = data.statesSupported?.join(",") ?? null;
        }

        // ✅ EQUIPMENT (ONLY ARRAY, ONLY FOR EQUIPMENT_FINANCE)
        const isEquipmentFinance =
          existing.loanProductCode === "EQUIPMENT_FINANCE";

        if (isEquipmentFinance) {
          if (data.equipmentTypes !== undefined) {
            updateData.equipmentTypes = data.equipmentTypes?.join(",") ?? null;
          }
          setValue("otherEquipmentExplanation", data.otherEquipmentExplanation);
        }

        // 🔘 BOOLEAN
        setValue("isActive", data.isActive);

        // 🚫 NOTHING TO UPDATE
        if (Object.keys(updateData).length === 0) {
          return reply.status(400).send({
            success: false,
            message: "No fields provided for update",
          });
        }

        // 💾 UPDATE
        const updated = await prisma.lenderProduct.update({
          where: { id },
          data: updateData,
        });

        return reply.send({
          success: true,
          message: "Loan product updated successfully",
          data: updated,
        });
      } catch (error) {
        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message: error.message || "Server error while updating loan product",
        });
      }
    },
  );
}

module.exports = updateLenderLoanProductRoutes;
