const { Prisma } = require("@prisma/client");
const {
  createLenderLoanProductSchema,
} = require("../../../schemas/lender/loanProduct/create.schema");
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
async function createLenderLoanProductRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "Create lender loan product configurations (Admin-level)",
        body: { type: "object" },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // 🔐 AUTH CHECK
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

        // 🧪 VALIDATION
        const parsed = createLenderLoanProductSchema.safeParse(
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

        const isNewFormat = Array.isArray(data.products);

        if (!isNewFormat && !data.loanProductCodes) {
          return reply.status(400).send({
            success: false,
            message:
              "Either 'products' or 'loanProductCodes' must be provided.",
          });
        }

        // 🔄 NORMALIZATION
        let normalizedProducts = [];

        if (isNewFormat) {
          normalizedProducts = data.products;
        } else {
          normalizedProducts = data.loanProductCodes.map((code) => ({
            loanProductCode: code,

            businessTypes: data.businessTypes,
            propertyTypes: data.propertyTypes,

            minLoanAmount: data.minLoanAmount,
            maxLoanAmount: data.maxLoanAmount,
            minTermMonths: data.minTermMonths,
            maxTermMonths: data.maxTermMonths,
            maxLtvPercent: data.maxLtvPercent,
maxArvPercent: data.maxArvPercent,
maxLtcPercent: data.maxLtcPercent,
            minCreditScore: data.minCreditScore,
            minExperience: data.minExperience,
            interestRateRange: data.interestRateRange,
            statesSupported: data.statesSupported,
            equipmentTypes: data.equipmentTypes,
            otherEquipmentExplanation: data.otherEquipmentExplanation,
            isActive: data.isActive,
          }));
        }

        if (!normalizedProducts.length) {
          return reply.status(400).send({
            success: false,
            message: "No products provided.",
          });
        }

        // 🏦 VALIDATE MASTER PRODUCTS
        const codes = normalizedProducts.map(
          (p) => p.loanProductCode
        );

        const loanProducts = await prisma.loanProduct.findMany({
          where: {
            code: { in: codes },
            isActive: true,
          },
        });

        if (loanProducts.length !== codes.length) {
          return reply.status(404).send({
            success: false,
            message:
              "One or more loan products not found or inactive.",
          });
        }

        // 🔁 CHECK EXISTING
        const existing = await prisma.lenderProduct.findMany({
          where: {
            lenderOrgId,
            loanProductCode: { in: codes },
          },
          select: { loanProductCode: true },
        });

        const existingCodes = new Set(
          existing.map((e) => e.loanProductCode)
        );

        // 📦 PREPARE PAYLOAD
        const createPayload = normalizedProducts
          .filter(
            (item) => !existingCodes.has(item.loanProductCode)
          )
          .map((item) => {
            const product = loanProducts.find(
              (p) => p.code === item.loanProductCode
            );

            if (!product) {
              throw new Error(
                `Invalid loan product code: ${item.loanProductCode}`
              );
            }

            const isEquipmentFinance =
              item.loanProductCode === "EQUIPMENT_FINANCE";

            return {
              lenderOrgId,
              loanProductId: product.id,
              loanProductCode: product.code,

              // ✅ TYPE → SUBTYPE STRUCTURE
              businessTypes: item.businessTypes ?? null,
              propertyTypes: item.propertyTypes ?? null,

              // 💰 FINANCIAL
              minLoanAmount:
                !isNoMinLoanCriteriaProduct(item.loanProductCode) &&
                item.minLoanAmount
                  ? new Prisma.Decimal(item.minLoanAmount)
                  : null,

              maxLoanAmount:
                !isSba504Product(item.loanProductCode) && item.maxLoanAmount
                  ? new Prisma.Decimal(item.maxLoanAmount)
                  : null,

              minTermMonths: item.minTermMonths ?? null,
              maxTermMonths: item.maxTermMonths ?? null,

              maxLtvPercent:
                !isMezzanineProduct(item.loanProductCode) &&
                !isPreferredEquityProduct(item.loanProductCode) &&
                !isNoPropertyMetricsProduct(item.loanProductCode) &&
                item.maxLtvPercent
                  ? new Prisma.Decimal(item.maxLtvPercent)
                  : null,

              minMezzLtvPercent:
                item.minMezzLtvPercent !== undefined &&
                item.minMezzLtvPercent !== null &&
                item.minMezzLtvPercent !== ""
                  ? new Prisma.Decimal(item.minMezzLtvPercent)
                  : null,
              maxMezzLtvPercent:
                isMezzanineProduct(item.loanProductCode) &&
                item.maxMezzLtvPercent
                  ? new Prisma.Decimal(item.maxMezzLtvPercent)
                  : null,
              exitFeePercent:
                (isMezzanineProduct(item.loanProductCode) ||
                  isPreferredEquityProduct(item.loanProductCode)) &&
                item.exitFeePercent
                  ? new Prisma.Decimal(item.exitFeePercent)
                  : null,
              preferredReturnPercent:
                isPreferredEquityProduct(item.loanProductCode) &&
                item.preferredReturnPercent
                  ? new Prisma.Decimal(item.preferredReturnPercent)
                  : null,
              maxRateSpreadPercent:
                isSba7aRateSpreadProduct(item.loanProductCode) &&
                item.maxRateSpreadPercent
                  ? new Prisma.Decimal(item.maxRateSpreadPercent)
                  : null,
              minRateSpreadPercent:
                isSba7aRateSpreadProduct(item.loanProductCode) &&
                item.minRateSpreadPercent
                  ? new Prisma.Decimal(item.minRateSpreadPercent)
                  : null,
              sbaGuaranteePercent:
                isSba7aMaxLoanOnlyProduct(item.loanProductCode) &&
                item.sbaGuaranteePercent
                  ? new Prisma.Decimal(item.sbaGuaranteePercent)
                  : null,
              avgTurnaroundDays:
                isSba7aGeneralProduct(item.loanProductCode) ||
                isSba504Product(item.loanProductCode)
                  ? item.avgTurnaroundDays ?? null
                  : null,
              preferredLenderPlp: isSba7aGeneralProduct(item.loanProductCode)
                ? item.preferredLenderPlp ?? false
                : false,
              requiredInjectionPercent:
                (isSba7aBusinessAcquisitionProduct(item.loanProductCode) ||
                  isSba504Product(item.loanProductCode)) &&
                item.requiredInjectionPercent
                  ? new Prisma.Decimal(item.requiredInjectionPercent)
                  : null,
              goodwillFinancingAllowed: isSba7aBusinessAcquisitionProduct(
                item.loanProductCode,
              )
                ? item.goodwillFinancingAllowed ?? false
                : false,
              sellerFinancingAllowed: isSba7aBusinessAcquisitionProduct(
                item.loanProductCode,
              )
                ? item.sellerFinancingAllowed ?? false
                : false,
              minLiquidityRequirement:
                isSba7aBusinessAcquisitionProduct(item.loanProductCode) &&
                item.minLiquidityRequirement?.trim()
                  ? item.minLiquidityRequirement.trim()
                  : null,
              minTimeInBusinessMonths:
                isSba7aWorkingCapitalProduct(item.loanProductCode) ||
                isSba7aEquipmentPurchaseProduct(item.loanProductCode) ||
                isSba504Product(item.loanProductCode)
                  ? item.minTimeInBusinessMonths ?? null
                  : null,
              minAnnualRevenue:
                isSba7aWorkingCapitalProduct(item.loanProductCode) &&
                item.minAnnualRevenue
                  ? new Prisma.Decimal(item.minAnnualRevenue)
                  : null,
              maxFinancingPercent:
                isSba7aWorkingCapitalProduct(item.loanProductCode) &&
                item.maxFinancingPercent
                  ? new Prisma.Decimal(item.maxFinancingPercent)
                  : null,
              useOfFunds:
                (isSba7aWorkingCapitalProduct(item.loanProductCode) ||
                  isSba504Product(item.loanProductCode)) &&
                item.useOfFunds?.trim()
                  ? item.useOfFunds.trim()
                  : null,
              collateralRequirements:
                (isSba7aWorkingCapitalProduct(item.loanProductCode) ||
                  isSba504Product(item.loanProductCode)) &&
                item.collateralRequirements?.trim()
                  ? item.collateralRequirements.trim()
                  : null,
              startupAllowed:
                isSba7aWorkingCapitalProduct(item.loanProductCode) ||
                isSba7aEquipmentPurchaseProduct(item.loanProductCode) ||
                isSba504Product(item.loanProductCode)
                  ? item.startupAllowed ?? false
                  : false,
              rateStructure:
                isSba504Product(item.loanProductCode) &&
                item.rateStructure?.trim()
                  ? item.rateStructure.trim()
                  : null,
              refinanceAllowed: isSba504Product(item.loanProductCode)
                ? item.refinanceAllowed ?? false
                : false,
              workingCapitalEligible: isSba504Product(item.loanProductCode)
                ? item.workingCapitalEligible ?? false
                : false,
              lifeInsuranceMayBeRequired: isSba504Product(item.loanProductCode)
                ? item.lifeInsuranceMayBeRequired ?? false
                : false,
              lineOfCreditAvailable: isSba7aWorkingCapitalProduct(
                item.loanProductCode,
              )
                ? item.lineOfCreditAvailable ?? false
                : false,
              usedEquipmentAllowed:
                isSba7aEquipmentPurchaseProduct(item.loanProductCode) ||
                isEquipmentFinanceProduct(item.loanProductCode)
                  ? item.usedEquipmentAllowed ?? false
                  : false,
              saleLeasebackAvailable: isEquipmentFinanceProduct(
                item.loanProductCode,
              )
                ? item.saleLeasebackAvailable ?? false
                : false,
              advanceRatePercent:
                (isPurchaseOrderFinanceProduct(item.loanProductCode) ||
                  isArFactoringProduct(item.loanProductCode)) &&
                item.advanceRatePercent
                  ? new Prisma.Decimal(item.advanceRatePercent)
                  : null,
              transactionFeePercent:
                isPurchaseOrderFinanceProduct(item.loanProductCode) &&
                item.transactionFeePercent
                  ? new Prisma.Decimal(item.transactionFeePercent)
                  : null,
              minGrossMarginPercent:
                isPurchaseOrderFinanceProduct(item.loanProductCode) &&
                item.minGrossMarginPercent
                  ? new Prisma.Decimal(item.minGrossMarginPercent)
                  : null,
              internationalPosAllowed: isPurchaseOrderFinanceProduct(
                item.loanProductCode,
              )
                ? item.internationalPosAllowed ?? false
                : false,
              discountFeePercent:
                isArFactoringProduct(item.loanProductCode) &&
                item.discountFeePercent
                  ? new Prisma.Decimal(item.discountFeePercent)
                  : null,
              maxInvoiceAgeDays: isArFactoringProduct(item.loanProductCode)
                ? item.maxInvoiceAgeDays ?? null
                : null,
              nonRecourseAvailable: isArFactoringProduct(item.loanProductCode)
                ? item.nonRecourseAvailable ?? false
                : false,
              governmentInvoicesOk: isArFactoringProduct(item.loanProductCode)
                ? item.governmentInvoicesOk ?? false
                : false,
              earlyPaymentDiscountPercent:
                isApSupplyChainProduct(item.loanProductCode) &&
                item.earlyPaymentDiscountPercent
                  ? new Prisma.Decimal(item.earlyPaymentDiscountPercent)
                  : null,
              paymentTermsExtensionDays: isApSupplyChainProduct(
                item.loanProductCode,
              )
                ? item.paymentTermsExtensionDays ?? null
                : null,
              dynamicDiscountingAvailable: isApSupplyChainProduct(
                item.loanProductCode,
              )
                ? item.dynamicDiscountingAvailable ?? false
                : false,
              reverseFactoringAvailable: isApSupplyChainProduct(
                item.loanProductCode,
              )
                ? item.reverseFactoringAvailable ?? false
                : false,
              ownerOccupiedRequired:
                isSba7aRealEstateProduct(item.loanProductCode) ||
                isSba504Product(item.loanProductCode)
                  ? item.ownerOccupiedRequired ?? false
                  : false,
              ownerOccupancyRequirement:
                (isSba7aRealEstateProduct(item.loanProductCode) ||
                  isSba504Product(item.loanProductCode)) &&
                item.ownerOccupancyRequirement?.trim()
                  ? item.ownerOccupancyRequirement.trim()
                  : null,
              environmentalReportRequired:
                isSba7aRealEstateProduct(item.loanProductCode) ||
                isSba504Product(item.loanProductCode)
                  ? item.environmentalReportRequired ?? false
                  : false,
              appraisalRequired:
                isSba7aRealEstateProduct(item.loanProductCode) ||
                isSba504Product(item.loanProductCode)
                  ? item.appraisalRequired ?? false
                  : false,
              maxTotalProjectAmount:
                isSba504Product(item.loanProductCode) &&
                item.maxTotalProjectAmount
                  ? new Prisma.Decimal(item.maxTotalProjectAmount)
                  : null,
              maxSba504DebentureAmount:
                isSba504Product(item.loanProductCode) &&
                item.maxSba504DebentureAmount
                  ? new Prisma.Decimal(item.maxSba504DebentureAmount)
                  : null,
              jobCreationRequired: isSba504Product(item.loanProductCode)
                ? item.jobCreationRequired ?? false
                : false,
              maxUsdaGuaranteeAmount:
                isUsdaBiProduct(item.loanProductCode) &&
                item.maxUsdaGuaranteeAmount
                  ? new Prisma.Decimal(item.maxUsdaGuaranteeAmount)
                  : null,
              usdaGuaranteePercent:
                isUsdaBiProduct(item.loanProductCode) &&
                item.usdaGuaranteePercent
                  ? new Prisma.Decimal(item.usdaGuaranteePercent)
                  : null,
              ruralAreaRequired: isUsdaBiProduct(item.loanProductCode)
                ? item.ruralAreaRequired ?? false
                : false,

              maxArvPercent:
                !isBridgeLoanProduct(item.loanProductCode) &&
                !isDscrRentalProduct(item.loanProductCode) &&
                !isRentalPortfolioProduct(item.loanProductCode) &&
                !isConstructionLoanProduct(item.loanProductCode) &&
                !isCrePermanentProduct(item.loanProductCode) &&
                !isCmbsProduct(item.loanProductCode) &&
                !isAgencyMultifamilyProduct(item.loanProductCode) &&
                !isMezzanineProduct(item.loanProductCode) &&
                !isPreferredEquityProduct(item.loanProductCode) &&
                !isNoPropertyMetricsProduct(item.loanProductCode) &&
                item.maxArvPercent
                  ? new Prisma.Decimal(item.maxArvPercent)
                  : null,

              maxLtcPercent:
                supportsLtcPercent(item.loanProductCode) &&
                !isMezzanineProduct(item.loanProductCode) &&
                !isPreferredEquityProduct(item.loanProductCode) &&
                !isNoPropertyMetricsProduct(item.loanProductCode) &&
                item.maxLtcPercent
                  ? new Prisma.Decimal(item.maxLtcPercent)
                  : null,

              minCreditScore:
                isPurchaseOrderFinanceProduct(item.loanProductCode) ||
                isArFactoringProduct(item.loanProductCode) ||
                isApSupplyChainProduct(item.loanProductCode) ||
                isCmbsProduct(item.loanProductCode) ||
                isAgencyMultifamilyProduct(item.loanProductCode) ||
                isMezzanineProduct(item.loanProductCode) ||
                isPreferredEquityProduct(item.loanProductCode)
                  ? null
                  : item.minCreditScore ?? null,

              minExperience:
                item.minExperience !== undefined &&
                item.minExperience !== null &&
                String(item.minExperience).trim() !== ""
                  ? String(item.minExperience)
                  : null,

              interestRateRange:
                isPreferredEquityProduct(item.loanProductCode) ||
                isNoMinLoanCriteriaProduct(item.loanProductCode) ||
                isPurchaseOrderFinanceProduct(item.loanProductCode) ||
                isArFactoringProduct(item.loanProductCode) ||
                isApSupplyChainProduct(item.loanProductCode)
                  ? null
                  : item.interestRateRange ?? null,

              originationPointsPercent:
                !isRentalPortfolioProduct(item.loanProductCode) &&
                !isCmbsProduct(item.loanProductCode) &&
                !isAgencyMultifamilyProduct(item.loanProductCode) &&
                !isNoPropertyMetricsProduct(item.loanProductCode) &&
                item.originationPointsPercent
                  ? new Prisma.Decimal(item.originationPointsPercent)
                  : null,
              extensionAvailable: isBridgeLoanProduct(item.loanProductCode)
                ? item.extensionAvailable ?? false
                : false,
              personalGuaranteeRequired:
                isBridgeLoanProduct(item.loanProductCode) ||
                isSba7aMaxLoanOnlyProduct(item.loanProductCode) ||
                isSba504Product(item.loanProductCode)
                  ? item.personalGuaranteeRequired ?? false
                  : false,
              firstTimeBorrowersAllowed: isFixAndFlipProduct(
                item.loanProductCode,
              )
                ? item.firstTimeBorrowersAllowed ?? false
                : false,
              minDscr:
                (isDscrRentalProduct(item.loanProductCode) ||
                  isRentalPortfolioProduct(item.loanProductCode) ||
                  isCrePermanentProduct(item.loanProductCode) ||
                  isCmbsProduct(item.loanProductCode) ||
                  isAgencyMultifamilyProduct(item.loanProductCode) ||
                  isSba7aMaxLoanOnlyProduct(item.loanProductCode) ||
                  isSba504Product(item.loanProductCode)) &&
                item.minDscr
                  ? new Prisma.Decimal(item.minDscr)
                  : null,
              minDebtYieldPercent:
                (isCrePermanentProduct(item.loanProductCode) ||
                  isCmbsProduct(item.loanProductCode)) &&
                item.minDebtYieldPercent
                  ? new Prisma.Decimal(item.minDebtYieldPercent)
                  : null,
              amortizationYears:
                isCrePermanentProduct(item.loanProductCode) ||
                isCmbsProduct(item.loanProductCode) ||
                isAgencyMultifamilyProduct(item.loanProductCode)
                  ? item.amortizationYears ?? null
                  : null,
              minUnits: isAgencyMultifamilyProduct(item.loanProductCode)
                ? item.minUnits ?? null
                : null,
              prepaymentStructure:
                isCmbsProduct(item.loanProductCode) ||
                isSba7aWorkingCapitalProduct(item.loanProductCode) ||
                isSba7aEquipmentPurchaseProduct(item.loanProductCode) ||
                isSba7aRealEstateProduct(item.loanProductCode) ||
                isSba504Product(item.loanProductCode)
                  ? item.prepaymentStructure ?? null
                  : null,
              minPropertiesInPortfolio: isRentalPortfolioProduct(
                item.loanProductCode,
              )
                ? item.minPropertiesInPortfolio ?? null
                : null,
              maxPropertiesInPortfolio: isRentalPortfolioProduct(
                item.loanProductCode,
              )
                ? item.maxPropertiesInPortfolio ?? null
                : null,
              interestOnlyAvailable: isDscrRentalProduct(item.loanProductCode)
                ? item.interestOnlyAvailable ?? false
                : false,
              shortTermRentalsOk: isDscrRentalProduct(item.loanProductCode)
                ? item.shortTermRentalsOk ?? false
                : false,
              foreignNationalsAllowed: isDscrRentalProduct(
                item.loanProductCode,
              )
                ? item.foreignNationalsAllowed ?? false
                : false,
              gcRequired: isConstructionLoanProduct(item.loanProductCode)
                ? item.gcRequired ?? false
                : false,
              completionGuaranteeRequired: isConstructionLoanProduct(
                item.loanProductCode,
              )
                ? item.completionGuaranteeRequired ?? false
                : false,
              criteriaNotes: item.criteriaNotes ?? null,

              // ⚠️ CSV (as per DB)
              statesSupported:
                item.statesSupported?.join(",") ?? null,

              // ✅ flat array stored as CSV
              equipmentTypes: isEquipmentFinance
                ? item.equipmentTypes?.join(",") ?? null
                : null,

              otherEquipmentExplanation: isEquipmentFinance
                ? item.otherEquipmentExplanation ?? null
                : null,

              isActive: item.isActive ?? true,
            };
          });

        if (!createPayload.length) {
          return reply.status(409).send({
            success: false,
            message:
              "All loan products already configured.",
          });
        }

        // 💥 TRANSACTION
        const created = await prisma.$transaction(
          createPayload.map((d) =>
            prisma.lenderProduct.create({ data: d })
          )
        );

        return reply.status(201).send({
          success: true,
          message: "Loan products configured successfully",
          createdCount: created.length,
          skippedLoanProductCodes: [...existingCodes],
          data: created,
        });
      } catch (error) {
        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message:
            error.message ||
            "Server error while configuring loan product",
        });
      }
    }
  );
}

module.exports = createLenderLoanProductRoutes;
