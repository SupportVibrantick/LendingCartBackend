-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FeeAgreementStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED');

-- CreateEnum
CREATE TYPE "DashboardType" AS ENUM ('BROKER', 'LENDER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "LogCategory" AS ENUM ('SECURITY', 'USER_MANAGEMENT', 'APPLICATION', 'REVIEW', 'SYSTEM', 'LOI');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('CLIENT_BROKER', 'CLIENT_OFFICER', 'BROKER_LENDER', 'SUBBROKER_BROKER', 'BROKER_OFFICER');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'FILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('CLIENT', 'BROKER', 'SUB_BROKER', 'LENDER');

-- CreateEnum
CREATE TYPE "LenderProfileStatus" AS ENUM ('DRAFT', 'INCOMPLETE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'NOT_INTERESTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('ACCOUNTANT', 'APPRAISER', 'ASSIGNOR', 'ATTORNEY', 'AUDITOR', 'BROKER', 'BROKER_PROCESSOR', 'CLOSING_CONTACT', 'CONTRACTOR', 'COUNSELOR', 'CUSTODIAN', 'ESCROW', 'ESCROW_ASSISTANT', 'FINANCIAL_ADVISOR', 'GENERAL_CONTRACTOR', 'HOA', 'INSPECTOR', 'INSURANCE_FLOOD', 'INSURANCE_GENERAL', 'INSURANCE_HOA', 'INSURANCE_PROPERTY', 'INVESTOR', 'LENDER', 'LENDER_ATTORNEY', 'LOAN_PREPARER', 'OTHER_UNSPECIFIED', 'OWNER', 'PARALEGAL', 'PROPERTY_MANAGER', 'PROSPECT', 'RE_AGENT_BUYER', 'RE_AGENT_SELLER', 'REALTOR_BPO', 'SECONDARY_NOTE_BUYER', 'SELLER_ATTORNEY', 'SERVICER', 'TITLE_REP', 'TRUSTEE', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('PLATFORM', 'BROKER', 'LENDER', 'ESCROW_TITLE');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SubscriptionBillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "OrganizationSubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'FAILED', 'VOID');

-- CreateEnum
CREATE TYPE "SubscriptionUsageMetric" AS ENUM ('LOAN_APPLICATIONS', 'ACTIVE_USERS', 'LOAN_OFFICERS', 'LENDER_CONNECTIONS');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'BROKER_ADMIN', 'BROKER_OFFICER', 'SUB_BROKER', 'LENDER_ADMIN', 'LENDER_UNDERWRITER', 'CLIENT_USER');

-- CreateEnum
CREATE TYPE "ClientEntityType" AS ENUM ('COMPANY', 'INDIVIDUAL', 'PARTNERSHIP', 'TRUST');

-- CreateEnum
CREATE TYPE "LoanProductCode" AS ENUM ('SBA_504_REAL_ESTATE_AND_EQUIPMENT', 'SBA_7A_WORKING_CAPITAL', 'SBA_7A_BUSINESS_ACQUISITION', 'SBA_7A_EQUIPMENT_PURCHASE', 'SBA_7A_REAL_ESTATE', 'USDA_BI', 'BRIDGE_LOAN', 'CMBS', 'CONSTRUCTION_LOAN', 'AGENCY_LOAN_MULTIFAMILY', 'RENTAL_PORTFOLIO', 'CRE_PERMANENT_LOAN', 'MEZZANINE_FINANCE', 'PREFERRED_EQUITY', 'PURCHASE_ORDER_FINANCE', 'ACCOUNTS_PAYABLE_FINANCE', 'ASSET_BASED_LENDING', 'INVOICE_FACTORING', 'DSCR_LOAN_1_TO_4_UNITS', 'FIX_AND_FLIP_LOAN_1_TO_4_UNITS', 'BRIDGE_LOAN_1_TO_4_UNITS', 'CONSTRUCTION_LOAN_1_TO_4_UNITS', 'SBA', 'SBA_7A', 'SBA_504', 'SBA_EXPRESS', 'SBA_CAPLINES', 'SBA_MICROLOAN', 'SBA_DISASTER', 'SBA_EXPORT', 'USDA_BUSINESS', 'USDA_RURAL_DEVELOPMENT', 'USDA_FARM_OWNERSHIP', 'USDA_FARM_OPERATING', 'CRE_PURCHASE', 'CRE_REFINANCE', 'CRE_CASH_OUT', 'OWNER_OCCUPIED_CRE', 'INVESTOR_CRE', 'GROUND_UP_CONSTRUCTION', 'CONSTRUCTION_TO_PERM', 'COMMERCIAL_CONSTRUCTION', 'LAND_DEVELOPMENT', 'LAND_ACQUISITION', 'CONVENTIONAL_MORTGAGE', 'FHA_LOAN', 'VA_HOME_LOAN', 'USDA_HOME_LOAN', 'NON_QM', 'JUMBO_LOAN', 'REVERSE_MORTGAGE', 'HELOC', 'HOME_EQUITY', 'DSCR', 'DSCR_RENTAL', 'FIX_AND_FLIP', 'BRIDGE', 'BRIDGE_REALESTATE', 'CONSTRUCTION', 'HARD_MONEY', 'BUSINESS_TERM', 'WORKING_CAPITAL', 'BUSINESS_LINE_OF_CREDIT', 'STARTUP_FINANCING', 'SMALL_BUSINESS_LOAN', 'EQUIPMENT_FINANCE', 'EQUIPMENT_LEASE', 'COMMERCIAL_AUTO', 'FLEET_FINANCE', 'HEAVY_EQUIPMENT', 'ACCOUNTS_RECEIVABLE', 'ACCOUNTS_RECEIVABLE_FINANCE', 'PURCHASE_ORDER', 'INVENTORY_FINANCE', 'TRADE_FINANCE', 'MERCHANT_CASH_ADVANCE', 'REVENUE_BASED_FINANCE', 'PRIVATE_CREDIT', 'VENTURE_DEBT', 'FRANCHISE_FINANCE', 'HOTEL_FINANCE', 'RESTAURANT_FINANCE', 'MEDICAL_PRACTICE', 'DENTAL_PRACTICE', 'LAW_FIRM_FINANCE', 'AGRICULTURE_OPERATING', 'FARM_EQUIPMENT', 'FARM_REAL_ESTATE', 'LIVESTOCK_LOAN', 'PERSONAL_LOAN', 'AUTO_LOAN', 'STUDENT_LOAN', 'STUDENT_LOAN_REFINANCE', 'PAYDAY_LOAN', 'BNPL', 'CUSTOM', 'SBA_504_REAL_ESTATE_EQUIPMENT', 'AGENCY_LOAN', 'MEZZ_FINANCE_PREF_EQUITY');

-- CreateEnum
CREATE TYPE "LoanApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'AUTO_APPROVED', 'AUTO_DECLINED', 'LENDER_SELECTED', 'LENDER_APPROVED', 'LENDER_DECLINED', 'FUNDED', 'WITHDRAWN', 'CLIENT_PENDING', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DocRequirementSource" AS ENUM ('PRODUCT_DEFAULT', 'LENDER_DEFAULT', 'BROKER_ADDED', 'SUB_BROKER_ADDED', 'LENDER_ADDED');

-- CreateEnum
CREATE TYPE "DocRequirementStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SignDocumentStatus" AS ENUM ('AWAITING_BROKER', 'SENT_TO_CLIENT', 'CLIENT_SIGNED', 'FORWARDED_TO_LENDER', 'LENDER_SEEN');

-- CreateEnum
CREATE TYPE "ApplicationLenderStatus" AS ENUM ('SENT', 'IN_REVIEW', 'APPROVED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('IN_REVIEW', 'APPROVED', 'DECLINED', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "ConditionStatus" AS ENUM ('OPEN', 'SATISFIED', 'WAIVED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('CLIENT', 'USER', 'BROKER', 'LENDER');

-- CreateEnum
CREATE TYPE "RuleComparisonOperator" AS ENUM ('GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ', 'IN', 'NOT_IN');

-- CreateEnum
CREATE TYPE "RuleSeverity" AS ENUM ('HARD_FAIL', 'SOFT_FAIL');

-- CreateEnum
CREATE TYPE "AffiliateTargetType" AS ENUM ('BROKER_SIGNUP', 'CLIENT_APPLICATION');

-- CreateEnum
CREATE TYPE "AffiliateCommissionType" AS ENUM ('PERCENTAGE', 'FLAT');

-- CreateEnum
CREATE TYPE "BrokerLenderSource" AS ENUM ('PLATFORM_DEFAULT', 'BROKER_ADDED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'EMAIL', 'PHONE', 'PASSWORD', 'DATE', 'TIME', 'DATETIME', 'SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX', 'CHECKBOX_GROUP', 'BOOLEAN', 'TOGGLE', 'FILE', 'FILE_MULTIPLE', 'IMAGE', 'SIGNATURE', 'CURRENCY', 'PERCENTAGE', 'SLIDER', 'RANGE', 'COUNTRY', 'STATE', 'CITY', 'ZIPCODE', 'ADDRESS', 'GEOLOCATION', 'SSN', 'PAN', 'GST', 'EIN', 'TAN', 'IFSC', 'BANK_ACCOUNT', 'AUTOCOMPLETE', 'TAGS', 'RICH_TEXT', 'OTP', 'CAPTCHA');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PROCESSING', 'SENT', 'FAILED', 'PAUSED', 'STOPPED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignIntervalUnit" AS ENUM ('MINUTES', 'HOURS', 'DAYS');

-- CreateEnum
CREATE TYPE "SubBrokerSubmissionStatus" AS ENUM ('PENDING', 'REVIEWED', 'SKIPPED', 'SENT_TO_LENDER');

-- CreateEnum
CREATE TYPE "SubmissionSourceType" AS ENUM ('BROKER', 'SUB_BROKER');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_accounts" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "profile_image" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" UUID,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_ai_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "brokerOrganizationId" UUID,
    "lastLoginAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "loan_ai_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_user_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "company" TEXT,
    "tollFree" TEXT,
    "tollFreeExt" TEXT,
    "serviceProvider" TEXT,
    "address" TEXT,
    "suite" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "agentType" TEXT,
    "licenseNumber" TEXT,
    "preferredComm" TEXT,
    "website" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "broker_user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_broker_applications" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "subBrokerId" UUID NOT NULL,
    "assignedById" UUID,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_broker_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_profiles" (
    "id" UUID NOT NULL,
    "lenderOrgId" UUID NOT NULL,
    "summary" TEXT,
    "loanTypes" "LoanProductCode"[],
    "minFunding" DECIMAL(20,2),
    "maxFunding" DECIMAL(20,2),
    "statesSupported" TEXT,
    "industries" TEXT,
    "fundingSpeedDays" INTEGER,
    "profileStatus" "LenderProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "isVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lender_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "primaryBrokerOrgId" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "entityType" "ClientEntityType" NOT NULL,
    "taxId" TEXT,
    "industry" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_portal_users" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMPTZ(6),
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "client_portal_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_products" (
    "id" UUID NOT NULL,
    "code" "LoanProductCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "loan_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_products" (
    "id" UUID NOT NULL,
    "lenderOrgId" UUID NOT NULL,
    "loanProductId" UUID,
    "loanProductCode" "LoanProductCode" NOT NULL,
    "businessTypes" JSONB,
    "propertyTypes" JSONB,
    "equipmentTypes" TEXT,
    "otherEquipmentExplanation" TEXT,
    "minLoanAmount" DECIMAL(20,2),
    "maxLoanAmount" DECIMAL(20,2),
    "minTermMonths" INTEGER,
    "maxTermMonths" INTEGER,
    "maxLtvPercent" DECIMAL(5,2),
    "minMezzLtvPercent" DECIMAL(5,2),
    "maxMezzLtvPercent" DECIMAL(5,2),
    "exitFeePercent" DECIMAL(5,2),
    "preferredReturnPercent" DECIMAL(5,2),
    "maxArvPercent" DECIMAL(5,2),
    "maxLtcPercent" DECIMAL(5,2),
    "minCreditScore" INTEGER,
    "minExperience" TEXT,
    "interestRateRange" TEXT,
    "originationPointsPercent" DECIMAL(5,2),
    "extensionAvailable" BOOLEAN DEFAULT false,
    "personalGuaranteeRequired" BOOLEAN DEFAULT false,
    "firstTimeBorrowersAllowed" BOOLEAN DEFAULT false,
    "minDscr" DECIMAL(5,2),
    "minDebtYieldPercent" DECIMAL(5,2),
    "amortizationYears" INTEGER,
    "minUnits" INTEGER,
    "prepaymentStructure" TEXT,
    "minPropertiesInPortfolio" INTEGER,
    "maxPropertiesInPortfolio" INTEGER,
    "interestOnlyAvailable" BOOLEAN DEFAULT false,
    "shortTermRentalsOk" BOOLEAN DEFAULT false,
    "foreignNationalsAllowed" BOOLEAN DEFAULT false,
    "gcRequired" BOOLEAN DEFAULT false,
    "completionGuaranteeRequired" BOOLEAN DEFAULT false,
    "criteriaNotes" TEXT,
    "maxRateSpreadPercent" DECIMAL(5,2),
    "avgTurnaroundDays" INTEGER,
    "preferredLenderPlp" BOOLEAN DEFAULT false,
    "requiredInjectionPercent" DECIMAL(5,2),
    "goodwillFinancingAllowed" BOOLEAN DEFAULT false,
    "sellerFinancingAllowed" BOOLEAN DEFAULT false,
    "minTimeInBusinessMonths" INTEGER,
    "lineOfCreditAvailable" BOOLEAN DEFAULT false,
    "usedEquipmentAllowed" BOOLEAN DEFAULT false,
    "ownerOccupiedRequired" BOOLEAN DEFAULT false,
    "maxTotalProjectAmount" DECIMAL(15,2),
    "maxSba504DebentureAmount" DECIMAL(15,2),
    "jobCreationRequired" BOOLEAN DEFAULT false,
    "maxUsdaGuaranteeAmount" DECIMAL(15,2),
    "usdaGuaranteePercent" DECIMAL(5,2),
    "ruralAreaRequired" BOOLEAN DEFAULT false,
    "advanceRatePercent" DECIMAL(5,2),
    "transactionFeePercent" DECIMAL(5,2),
    "minGrossMarginPercent" DECIMAL(5,2),
    "internationalPosAllowed" BOOLEAN DEFAULT false,
    "saleLeasebackAvailable" BOOLEAN DEFAULT false,
    "discountFeePercent" DECIMAL(5,2),
    "maxInvoiceAgeDays" INTEGER,
    "nonRecourseAvailable" BOOLEAN DEFAULT false,
    "governmentInvoicesOk" BOOLEAN DEFAULT false,
    "earlyPaymentDiscountPercent" DECIMAL(5,2),
    "paymentTermsExtensionDays" INTEGER,
    "dynamicDiscountingAvailable" BOOLEAN DEFAULT false,
    "reverseFactoringAvailable" BOOLEAN DEFAULT false,
    "statesSupported" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lender_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_lender_access" (
    "id" UUID NOT NULL,
    "brokerOrgId" UUID NOT NULL,
    "lenderOrgId" UUID NOT NULL,
    "source" "BrokerLenderSource" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "broker_lender_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_lender_invites" (
    "id" UUID NOT NULL,
    "lenderOrgId" UUID NOT NULL,
    "brokerOrgId" UUID NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "broker_lender_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_rule_sets" (
    "id" UUID NOT NULL,
    "lenderProductId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "eligibility_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_rules" (
    "id" UUID NOT NULL,
    "ruleSetId" UUID NOT NULL,
    "fieldName" TEXT NOT NULL,
    "comparisonOperator" "RuleComparisonOperator" NOT NULL,
    "value" TEXT NOT NULL,
    "severity" "RuleSeverity" NOT NULL,
    "message" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "eligibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdByOrgId" UUID,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_packages" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "priceMonthly" DECIMAL(10,2) NOT NULL,
    "priceYearly" DECIMAL(10,2),
    "description" TEXT,
    "features" TEXT,
    "usageLimits" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscription_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_subscriptions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "billingCycle" "SubscriptionBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "status" "OrganizationSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMPTZ(6) NOT NULL,
    "currentPeriodEnd" TIMESTAMPTZ(6) NOT NULL,
    "trialEndsAt" TIMESTAMPTZ(6),
    "trialEndingReminderSentAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "assignedByAdminId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_usage" (
    "id" UUID NOT NULL,
    "organizationSubscriptionId" UUID NOT NULL,
    "metric" "SubscriptionUsageMetric" NOT NULL,
    "limitValue" INTEGER,
    "usedValue" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscription_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_invoices" (
    "id" UUID NOT NULL,
    "organizationSubscriptionId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" "SubscriptionBillingCycle" NOT NULL,
    "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6) NOT NULL,
    "dueDate" TIMESTAMPTZ(6) NOT NULL,
    "paidAt" TIMESTAMPTZ(6),
    "stripeInvoiceId" TEXT,
    "externalPaymentRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_document_requirements" (
    "id" UUID NOT NULL,
    "loanProductId" UUID,
    "loanProductCode" "LoanProductCode" NOT NULL,
    "documentTypeId" UUID NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "minFiles" INTEGER DEFAULT 1,
    "maxFiles" INTEGER,
    "notes" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_document_requirements" (
    "id" UUID NOT NULL,
    "lenderProductId" UUID NOT NULL,
    "documentTypeId" UUID NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "minFiles" INTEGER DEFAULT 1,
    "maxFiles" INTEGER,
    "notes" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lender_document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_document_requests" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "applicationLenderId" UUID NOT NULL,
    "documentTypeId" UUID NOT NULL,
    "status" "DocRequirementStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lender_document_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_white_label_settings" (
    "id" UUID NOT NULL,
    "brokerOrgId" UUID NOT NULL,
    "platformSubdomain" TEXT,
    "customDomain" TEXT,
    "domainVerified" BOOLEAN NOT NULL DEFAULT false,
    "sslStatus" TEXT,
    "brandName" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "fontFamily" TEXT,
    "footerText" TEXT,
    "supportEmail" TEXT,
    "fullWhiteLabel" BOOLEAN NOT NULL DEFAULT false,
    "showBrokerBrandOnApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "broker_white_label_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_links" (
    "id" UUID NOT NULL,
    "brokerOrgId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "targetType" "AffiliateTargetType" NOT NULL,
    "commissionType" "AffiliateCommissionType" NOT NULL,
    "commissionValue" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" UUID NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "brokerOrgId" UUID NOT NULL,
    "brokerUserId" UUID,
    "clientId" UUID NOT NULL,
    "loanProductCode" "LoanProductCode" NOT NULL,
    "status" "LoanApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "amountRequested" DECIMAL(20,2),
    "termMonthsRequested" INTEGER,
    "purpose" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "submittedAt" TIMESTAMPTZ(6),
    "auto_forward_documents_to_lender" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_applications" (
    "id" UUID NOT NULL,
    "brokerOrgId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdFromTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "broker_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_application_products" (
    "id" UUID NOT NULL,
    "brokerApplicationId" UUID NOT NULL,
    "loanProductCode" "LoanProductCode" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "broker_application_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_application_product_fields" (
    "id" UUID NOT NULL,
    "applicationProductId" UUID NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT,
    "fieldType" "FieldType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sectionId" UUID,
    "options" JSONB,
    "validation" JSONB,
    "sortOrder" INTEGER,

    CONSTRAINT "broker_application_product_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_application_sections" (
    "id" UUID NOT NULL,
    "applicationProductId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "broker_application_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_application_fields" (
    "id" UUID NOT NULL,
    "loanProductCode" "LoanProductCode" NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "FieldType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "validation" JSONB,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_application_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_financials" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "annualRevenue" DECIMAL(20,2),
    "netIncome" DECIMAL(20,2),
    "ebitda" DECIMAL(20,2),
    "totalDebt" DECIMAL(20,2),
    "dscr" DECIMAL(10,4),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "application_financials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_collaterals" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "collateralType" TEXT NOT NULL,
    "description" TEXT,
    "valueEstimated" DECIMAL(20,2),
    "lienPosition" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "application_collaterals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_document_requirements" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "documentTypeId" UUID NOT NULL,
    "source" "DocRequirementSource" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" "DocRequirementStatus" NOT NULL DEFAULT 'PENDING',
    "lastRequestedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "isSentToBroker" BOOLEAN NOT NULL DEFAULT false,
    "sentToBrokerAt" TIMESTAMP(3),
    "requires_client_signature" BOOLEAN NOT NULL DEFAULT false,
    "sign_document_title" TEXT,
    "template_file_name" TEXT,
    "template_file_url" TEXT,
    "template_mime_type" TEXT,
    "sign_status" "SignDocumentStatus",
    "sent_to_client_at" TIMESTAMPTZ(6),
    "client_signed_at" TIMESTAMPTZ(6),
    "lender_seen_at" TIMESTAMPTZ(6),
    "request_application_lender_id" UUID,

    CONSTRAINT "application_document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_document_uploads" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "documentRequirementId" UUID,
    "uploadedByUserId" UUID,
    "uploadedByClientUserId" UUID,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileMimeType" TEXT,
    "isSubmittedToLender" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMPTZ(6),
    "is_signed_output" BOOLEAN NOT NULL DEFAULT false,
    "client_signature_data" TEXT,
    "uploadedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_document_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_document_submissions" (
    "id" UUID NOT NULL,
    "documentUploadId" UUID NOT NULL,
    "applicationLenderId" UUID NOT NULL,
    "submittedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_document_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_rule_evaluations" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "ruleSetId" UUID,
    "result" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_rule_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_rule_results" (
    "id" UUID NOT NULL,
    "ruleEvaluationId" UUID NOT NULL,
    "ruleId" UUID,
    "passed" BOOLEAN NOT NULL,
    "message" TEXT,
    "fieldValue" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_rule_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_status_history" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "fromStatus" "LoanApplicationStatus" NOT NULL,
    "toStatus" "LoanApplicationStatus" NOT NULL,
    "changedByUserId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_lenders" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "lenderOrgId" UUID NOT NULL,
    "lenderProductId" UUID,
    "status" "ApplicationLenderStatus" NOT NULL DEFAULT 'SENT',
    "sentByUserId" UUID,
    "sentAt" TIMESTAMPTZ(6),
    "lastUpdatedAt" TIMESTAMPTZ(6),
    "loiUrl" TEXT,

    CONSTRAINT "application_lenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_reviews" (
    "id" UUID NOT NULL,
    "applicationLenderId" UUID NOT NULL,
    "reviewedByUserId" UUID,
    "reviewStatus" "ReviewStatus" NOT NULL,
    "approvedAmount" DECIMAL(20,2),
    "interestRate" DECIMAL(8,4),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lender_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_conditions" (
    "id" UUID NOT NULL,
    "lenderReviewId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ConditionStatus" NOT NULL DEFAULT 'OPEN',
    "satisfiedAt" TIMESTAMPTZ(6),

    CONSTRAINT "lender_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_title_companies" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "defaultInstructions" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "escrow_title_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_instructions" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "escrowCompanyId" UUID NOT NULL,
    "instructionsText" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "escrow_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "recipientType" "RecipientType" NOT NULL,
    "notificationTemplateId" UUID NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "category" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientUserId" UUID,
    "recipientOrgId" UUID,
    "recipientClientId" UUID,
    "subject" TEXT,
    "body" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_agreements" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "brokerOrgId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "clientName" TEXT,
    "clientEntityName" TEXT,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "clientAddress" TEXT,
    "brokerName" TEXT,
    "brokerCompany" TEXT,
    "brokerEmail" TEXT,
    "brokerPhone" TEXT,
    "brokerAddress" TEXT,
    "brokerState" TEXT,
    "brokerCounty" TEXT,
    "brokerLogoUrl" TEXT,
    "brokerBrandName" TEXT,
    "subjectAddress" TEXT,
    "brokerPoints" DECIMAL(5,2),
    "upfrontFee" DECIMAL(10,2),
    "exclusivityMonths" INTEGER,
    "agreementHtml" TEXT,
    "clientSignature" TEXT,
    "signedAt" TIMESTAMPTZ(6),
    "status" "FeeAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "actorOrgId" UUID,
    "dashboard" "DashboardType" NOT NULL,
    "category" "LogCategory" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValueJson" TEXT,
    "newValueJson" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_lending_mastery_leads" (
    "id" UUID NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'commerciallendingmastery',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "campaign" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commercial_lending_mastery_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clm_landing_page_leads" (
    "id" UUID NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'clmlandingpage',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "campaign" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clm_landing_page_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_manual_leads" (
    "id" UUID NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'Admin',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "campaign" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_manual_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "application_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_template_products" (
    "id" UUID NOT NULL,
    "applicationTemplateId" UUID NOT NULL,
    "loanProductCode" "LoanProductCode" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "application_template_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_template_product_fields" (
    "id" UUID NOT NULL,
    "applicationTemplateProductId" UUID NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT,
    "fieldType" "FieldType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "validation" JSONB,
    "sortOrder" INTEGER,
    "sectionId" UUID,

    CONSTRAINT "application_template_product_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_template_sections" (
    "id" UUID NOT NULL,
    "applicationTemplateProductId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "application_template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_submissions" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "applicationProductId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_submission_fields" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "fieldId" UUID,
    "fieldKey" TEXT,
    "value" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_submission_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "brokerOrgId" UUID NOT NULL,
    "createdById" UUID,
    "contactType" "ContactType" NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "companyName" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "tollFree" TEXT,
    "cellNumber" TEXT,
    "faxNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "stateOfFormation" TEXT,
    "entityType" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMPTZ(6),
    "sentAt" TIMESTAMPTZ(6),
    "intervalValue" INTEGER,
    "intervalUnit" "CampaignIntervalUnit",
    "lastSentAt" TIMESTAMPTZ(6),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMPTZ(6),

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientUploadToken" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientUploadToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_loi_templates" (
    "id" UUID NOT NULL,
    "lenderOrgId" UUID NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lender_loi_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "applicationLenderId" UUID,
    "type" "ConversationType" NOT NULL,
    "chatCategory" TEXT,
    "createdByUserId" UUID,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderType" "ParticipantRole" NOT NULL,
    "senderUserId" UUID,
    "senderClientUserId" UUID,
    "senderName" TEXT,
    "type" "MessageType" NOT NULL,
    "text" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "participantType" "ParticipantRole" NOT NULL,
    "participantId" UUID,
    "participantEmail" TEXT,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubBrokerSubmission" (
    "id" UUID NOT NULL,
    "loanApplicationId" UUID NOT NULL,
    "documentUploadId" UUID NOT NULL,
    "submittedBySubBrokerId" UUID NOT NULL,
    "principalBrokerId" UUID NOT NULL,
    "status" "SubBrokerSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "skipReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "sentToLenderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubBrokerSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_email_key" ON "user_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "loan_ai_users_email_key" ON "loan_ai_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "loan_ai_users_brokerOrganizationId_key" ON "loan_ai_users"("brokerOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "broker_user_profiles_userId_key" ON "broker_user_profiles"("userId");

-- CreateIndex
CREATE INDEX "sub_broker_applications_loanApplicationId_idx" ON "sub_broker_applications"("loanApplicationId");

-- CreateIndex
CREATE INDEX "sub_broker_applications_subBrokerId_idx" ON "sub_broker_applications"("subBrokerId");

-- CreateIndex
CREATE UNIQUE INDEX "sub_broker_applications_loanApplicationId_subBrokerId_key" ON "sub_broker_applications"("loanApplicationId", "subBrokerId");

-- CreateIndex
CREATE UNIQUE INDEX "lender_profiles_lenderOrgId_key" ON "lender_profiles"("lenderOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_users_email_key" ON "client_portal_users"("email");

-- CreateIndex
CREATE INDEX "lender_products_lenderOrgId_idx" ON "lender_products"("lenderOrgId");

-- CreateIndex
CREATE INDEX "lender_products_loanProductCode_idx" ON "lender_products"("loanProductCode");

-- CreateIndex
CREATE INDEX "lender_products_loanProductId_idx" ON "lender_products"("loanProductId");

-- CreateIndex
CREATE UNIQUE INDEX "lender_products_lenderOrgId_loanProductCode_key" ON "lender_products"("lenderOrgId", "loanProductCode");

-- CreateIndex
CREATE INDEX "broker_lender_access_brokerOrgId_idx" ON "broker_lender_access"("brokerOrgId");

-- CreateIndex
CREATE INDEX "broker_lender_access_lenderOrgId_idx" ON "broker_lender_access"("lenderOrgId");

-- CreateIndex
CREATE INDEX "broker_lender_invites_lenderOrgId_idx" ON "broker_lender_invites"("lenderOrgId");

-- CreateIndex
CREATE INDEX "broker_lender_invites_brokerOrgId_idx" ON "broker_lender_invites"("brokerOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "broker_lender_invites_lenderOrgId_brokerOrgId_key" ON "broker_lender_invites"("lenderOrgId", "brokerOrgId");

-- CreateIndex
CREATE INDEX "eligibility_rule_sets_lenderProductId_idx" ON "eligibility_rule_sets"("lenderProductId");

-- CreateIndex
CREATE INDEX "eligibility_rules_ruleSetId_idx" ON "eligibility_rules"("ruleSetId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_packages_code_key" ON "subscription_packages"("code");

-- CreateIndex
CREATE INDEX "organization_subscriptions_organizationId_idx" ON "organization_subscriptions"("organizationId");

-- CreateIndex
CREATE INDEX "organization_subscriptions_packageId_idx" ON "organization_subscriptions"("packageId");

-- CreateIndex
CREATE INDEX "organization_subscriptions_status_idx" ON "organization_subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscription_usage_organizationSubscriptionId_idx" ON "subscription_usage"("organizationSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_usage_organizationSubscriptionId_metric_period_key" ON "subscription_usage"("organizationSubscriptionId", "metric", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_invoices_invoiceNumber_key" ON "subscription_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "subscription_invoices_organizationId_idx" ON "subscription_invoices"("organizationId");

-- CreateIndex
CREATE INDEX "subscription_invoices_organizationSubscriptionId_idx" ON "subscription_invoices"("organizationSubscriptionId");

-- CreateIndex
CREATE INDEX "subscription_invoices_status_idx" ON "subscription_invoices"("status");

-- CreateIndex
CREATE INDEX "product_document_requirements_documentTypeId_idx" ON "product_document_requirements"("documentTypeId");

-- CreateIndex
CREATE INDEX "product_document_requirements_loanProductCode_idx" ON "product_document_requirements"("loanProductCode");

-- CreateIndex
CREATE INDEX "product_document_requirements_loanProductId_idx" ON "product_document_requirements"("loanProductId");

-- CreateIndex
CREATE INDEX "lender_document_requirements_lenderProductId_idx" ON "lender_document_requirements"("lenderProductId");

-- CreateIndex
CREATE INDEX "lender_document_requirements_documentTypeId_idx" ON "lender_document_requirements"("documentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "lender_document_requirements_lenderProductId_documentTypeId_key" ON "lender_document_requirements"("lenderProductId", "documentTypeId");

-- CreateIndex
CREATE INDEX "lender_document_requests_loanApplicationId_idx" ON "lender_document_requests"("loanApplicationId");

-- CreateIndex
CREATE INDEX "lender_document_requests_applicationLenderId_idx" ON "lender_document_requests"("applicationLenderId");

-- CreateIndex
CREATE INDEX "lender_document_requests_documentTypeId_idx" ON "lender_document_requests"("documentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "lender_document_requests_applicationLenderId_documentTypeId_key" ON "lender_document_requests"("applicationLenderId", "documentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "broker_white_label_settings_brokerOrgId_key" ON "broker_white_label_settings"("brokerOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "broker_white_label_settings_platformSubdomain_key" ON "broker_white_label_settings"("platformSubdomain");

-- CreateIndex
CREATE UNIQUE INDEX "broker_white_label_settings_customDomain_key" ON "broker_white_label_settings"("customDomain");

-- CreateIndex
CREATE INDEX "broker_white_label_settings_brokerOrgId_idx" ON "broker_white_label_settings"("brokerOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_links_code_key" ON "affiliate_links"("code");

-- CreateIndex
CREATE INDEX "affiliate_links_brokerOrgId_idx" ON "affiliate_links"("brokerOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_applicationNumber_key" ON "loan_applications"("applicationNumber");

-- CreateIndex
CREATE INDEX "loan_applications_brokerOrgId_idx" ON "loan_applications"("brokerOrgId");

-- CreateIndex
CREATE INDEX "loan_applications_clientId_idx" ON "loan_applications"("clientId");

-- CreateIndex
CREATE INDEX "loan_applications_loanProductCode_idx" ON "loan_applications"("loanProductCode");

-- CreateIndex
CREATE UNIQUE INDEX "broker_applications_code_key" ON "broker_applications"("code");

-- CreateIndex
CREATE INDEX "broker_applications_brokerOrgId_idx" ON "broker_applications"("brokerOrgId");

-- CreateIndex
CREATE INDEX "broker_application_products_loanProductCode_idx" ON "broker_application_products"("loanProductCode");

-- CreateIndex
CREATE UNIQUE INDEX "broker_application_products_brokerApplicationId_loanProduct_key" ON "broker_application_products"("brokerApplicationId", "loanProductCode");

-- CreateIndex
CREATE INDEX "broker_application_product_fields_applicationProductId_idx" ON "broker_application_product_fields"("applicationProductId");

-- CreateIndex
CREATE INDEX "broker_application_sections_applicationProductId_idx" ON "broker_application_sections"("applicationProductId");

-- CreateIndex
CREATE UNIQUE INDEX "broker_application_sections_applicationProductId_name_key" ON "broker_application_sections"("applicationProductId", "name");

-- CreateIndex
CREATE INDEX "loan_application_fields_loanProductCode_idx" ON "loan_application_fields"("loanProductCode");

-- CreateIndex
CREATE UNIQUE INDEX "application_financials_loanApplicationId_key" ON "application_financials"("loanApplicationId");

-- CreateIndex
CREATE INDEX "application_financials_loanApplicationId_idx" ON "application_financials"("loanApplicationId");

-- CreateIndex
CREATE INDEX "application_collaterals_loanApplicationId_idx" ON "application_collaterals"("loanApplicationId");

-- CreateIndex
CREATE INDEX "application_document_requirements_loanApplicationId_idx" ON "application_document_requirements"("loanApplicationId");

-- CreateIndex
CREATE INDEX "application_document_requirements_documentTypeId_idx" ON "application_document_requirements"("documentTypeId");

-- CreateIndex
CREATE INDEX "application_document_uploads_loanApplicationId_idx" ON "application_document_uploads"("loanApplicationId");

-- CreateIndex
CREATE INDEX "application_document_uploads_documentRequirementId_idx" ON "application_document_uploads"("documentRequirementId");

-- CreateIndex
CREATE INDEX "application_document_submissions_documentUploadId_idx" ON "application_document_submissions"("documentUploadId");

-- CreateIndex
CREATE INDEX "application_document_submissions_applicationLenderId_idx" ON "application_document_submissions"("applicationLenderId");

-- CreateIndex
CREATE UNIQUE INDEX "application_document_submissions_documentUploadId_applicati_key" ON "application_document_submissions"("documentUploadId", "applicationLenderId");

-- CreateIndex
CREATE INDEX "application_rule_evaluations_loanApplicationId_idx" ON "application_rule_evaluations"("loanApplicationId");

-- CreateIndex
CREATE INDEX "application_rule_evaluations_submissionId_idx" ON "application_rule_evaluations"("submissionId");

-- CreateIndex
CREATE INDEX "application_rule_evaluations_ruleSetId_idx" ON "application_rule_evaluations"("ruleSetId");

-- CreateIndex
CREATE INDEX "application_rule_results_ruleEvaluationId_idx" ON "application_rule_results"("ruleEvaluationId");

-- CreateIndex
CREATE INDEX "application_rule_results_ruleId_idx" ON "application_rule_results"("ruleId");

-- CreateIndex
CREATE INDEX "application_status_history_loanApplicationId_idx" ON "application_status_history"("loanApplicationId");

-- CreateIndex
CREATE INDEX "application_status_history_changedByUserId_idx" ON "application_status_history"("changedByUserId");

-- CreateIndex
CREATE INDEX "application_lenders_loanApplicationId_idx" ON "application_lenders"("loanApplicationId");

-- CreateIndex
CREATE INDEX "application_lenders_lenderOrgId_idx" ON "application_lenders"("lenderOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "application_lenders_loanApplicationId_lenderProductId_key" ON "application_lenders"("loanApplicationId", "lenderProductId");

-- CreateIndex
CREATE INDEX "lender_reviews_applicationLenderId_idx" ON "lender_reviews"("applicationLenderId");

-- CreateIndex
CREATE INDEX "lender_reviews_reviewedByUserId_idx" ON "lender_reviews"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "lender_conditions_lenderReviewId_idx" ON "lender_conditions"("lenderReviewId");

-- CreateIndex
CREATE INDEX "escrow_title_companies_organizationId_idx" ON "escrow_title_companies"("organizationId");

-- CreateIndex
CREATE INDEX "escrow_instructions_loanApplicationId_idx" ON "escrow_instructions"("loanApplicationId");

-- CreateIndex
CREATE INDEX "escrow_instructions_escrowCompanyId_idx" ON "escrow_instructions"("escrowCompanyId");

-- CreateIndex
CREATE INDEX "notification_rules_notificationTemplateId_idx" ON "notification_rules"("notificationTemplateId");

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_idx" ON "notifications"("recipientUserId");

-- CreateIndex
CREATE INDEX "notifications_recipientOrgId_idx" ON "notifications"("recipientOrgId");

-- CreateIndex
CREATE INDEX "notifications_recipientClientId_idx" ON "notifications"("recipientClientId");

-- CreateIndex
CREATE INDEX "notifications_eventType_idx" ON "notifications"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "fee_agreements_loanApplicationId_key" ON "fee_agreements"("loanApplicationId");

-- CreateIndex
CREATE INDEX "fee_agreements_loanApplicationId_idx" ON "fee_agreements"("loanApplicationId");

-- CreateIndex
CREATE INDEX "fee_agreements_brokerOrgId_idx" ON "fee_agreements"("brokerOrgId");

-- CreateIndex
CREATE INDEX "fee_agreements_clientId_idx" ON "fee_agreements"("clientId");

-- CreateIndex
CREATE INDEX "audit_logs_actorOrgId_idx" ON "audit_logs"("actorOrgId");

-- CreateIndex
CREATE INDEX "audit_logs_dashboard_idx" ON "audit_logs"("dashboard");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "commercial_lending_mastery_leads_email_idx" ON "commercial_lending_mastery_leads"("email");

-- CreateIndex
CREATE INDEX "commercial_lending_mastery_leads_source_idx" ON "commercial_lending_mastery_leads"("source");

-- CreateIndex
CREATE INDEX "commercial_lending_mastery_leads_status_idx" ON "commercial_lending_mastery_leads"("status");

-- CreateIndex
CREATE INDEX "clm_landing_page_leads_email_idx" ON "clm_landing_page_leads"("email");

-- CreateIndex
CREATE INDEX "clm_landing_page_leads_source_idx" ON "clm_landing_page_leads"("source");

-- CreateIndex
CREATE INDEX "clm_landing_page_leads_status_idx" ON "clm_landing_page_leads"("status");

-- CreateIndex
CREATE INDEX "admin_manual_leads_email_idx" ON "admin_manual_leads"("email");

-- CreateIndex
CREATE INDEX "admin_manual_leads_source_idx" ON "admin_manual_leads"("source");

-- CreateIndex
CREATE INDEX "admin_manual_leads_status_idx" ON "admin_manual_leads"("status");

-- CreateIndex
CREATE UNIQUE INDEX "application_templates_code_key" ON "application_templates"("code");

-- CreateIndex
CREATE INDEX "application_template_products_loanProductCode_idx" ON "application_template_products"("loanProductCode");

-- CreateIndex
CREATE UNIQUE INDEX "application_template_products_applicationTemplateId_loanPro_key" ON "application_template_products"("applicationTemplateId", "loanProductCode");

-- CreateIndex
CREATE INDEX "application_template_product_fields_applicationTemplateProd_idx" ON "application_template_product_fields"("applicationTemplateProductId", "sectionId");

-- CreateIndex
CREATE INDEX "application_template_sections_applicationTemplateProductId_idx" ON "application_template_sections"("applicationTemplateProductId");

-- CreateIndex
CREATE UNIQUE INDEX "application_template_sections_applicationTemplateProductId__key" ON "application_template_sections"("applicationTemplateProductId", "name");

-- CreateIndex
CREATE INDEX "application_submissions_applicationId_idx" ON "application_submissions"("applicationId");

-- CreateIndex
CREATE INDEX "application_submissions_applicationProductId_idx" ON "application_submissions"("applicationProductId");

-- CreateIndex
CREATE INDEX "application_submission_fields_submissionId_idx" ON "application_submission_fields"("submissionId");

-- CreateIndex
CREATE INDEX "application_submission_fields_fieldId_idx" ON "application_submission_fields"("fieldId");

-- CreateIndex
CREATE INDEX "contacts_brokerOrgId_idx" ON "contacts"("brokerOrgId");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "campaigns_orgId_idx" ON "campaigns"("orgId");

-- CreateIndex
CREATE INDEX "campaigns_isRecurring_status_idx" ON "campaigns"("isRecurring", "status");

-- CreateIndex
CREATE INDEX "campaigns_lastSentAt_idx" ON "campaigns"("lastSentAt");

-- CreateIndex
CREATE INDEX "campaign_recipients_campaignId_idx" ON "campaign_recipients"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_recipients_contactId_idx" ON "campaign_recipients"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_campaignId_contactId_key" ON "campaign_recipients"("campaignId", "contactId");

-- CreateIndex
CREATE INDEX "email_logs_campaignId_idx" ON "email_logs"("campaignId");

-- CreateIndex
CREATE INDEX "email_logs_contactId_idx" ON "email_logs"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientUploadToken_token_key" ON "ClientUploadToken"("token");

-- CreateIndex
CREATE INDEX "ClientUploadToken_token_idx" ON "ClientUploadToken"("token");

-- CreateIndex
CREATE INDEX "ClientUploadToken_loanApplicationId_idx" ON "ClientUploadToken"("loanApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientUploadToken_loanApplicationId_key" ON "ClientUploadToken"("loanApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "lender_loi_templates_lenderOrgId_key" ON "lender_loi_templates"("lenderOrgId");

-- CreateIndex
CREATE INDEX "Conversation_loanApplicationId_idx" ON "Conversation"("loanApplicationId");

-- CreateIndex
CREATE INDEX "Conversation_applicationLenderId_idx" ON "Conversation"("applicationLenderId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_applicationLenderId_key" ON "Conversation"("applicationLenderId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permissionId_key" ON "user_permissions"("userId", "permissionId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_participantEmail_idx" ON "ConversationParticipant"("participantEmail");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_participantId_key" ON "ConversationParticipant"("conversationId", "participantId");

-- AddForeignKey
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_ai_users" ADD CONSTRAINT "loan_ai_users_brokerOrganizationId_fkey" FOREIGN KEY ("brokerOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_user_profiles" ADD CONSTRAINT "broker_user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_broker_applications" ADD CONSTRAINT "sub_broker_applications_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_broker_applications" ADD CONSTRAINT "sub_broker_applications_subBrokerId_fkey" FOREIGN KEY ("subBrokerId") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_broker_applications" ADD CONSTRAINT "sub_broker_applications_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_profiles" ADD CONSTRAINT "lender_profiles_lenderOrgId_fkey" FOREIGN KEY ("lenderOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_primaryBrokerOrgId_fkey" FOREIGN KEY ("primaryBrokerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_users" ADD CONSTRAINT "client_portal_users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_products" ADD CONSTRAINT "lender_products_lenderOrgId_fkey" FOREIGN KEY ("lenderOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_products" ADD CONSTRAINT "lender_products_loanProductId_fkey" FOREIGN KEY ("loanProductId") REFERENCES "loan_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_lender_access" ADD CONSTRAINT "broker_lender_access_brokerOrgId_fkey" FOREIGN KEY ("brokerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_lender_access" ADD CONSTRAINT "broker_lender_access_lenderOrgId_fkey" FOREIGN KEY ("lenderOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_lender_invites" ADD CONSTRAINT "broker_lender_invites_lenderOrgId_fkey" FOREIGN KEY ("lenderOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_lender_invites" ADD CONSTRAINT "broker_lender_invites_brokerOrgId_fkey" FOREIGN KEY ("brokerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_rule_sets" ADD CONSTRAINT "eligibility_rule_sets_lenderProductId_fkey" FOREIGN KEY ("lenderProductId") REFERENCES "lender_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "eligibility_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "subscription_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_organizationSubscriptionId_fkey" FOREIGN KEY ("organizationSubscriptionId") REFERENCES "organization_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_organizationSubscriptionId_fkey" FOREIGN KEY ("organizationSubscriptionId") REFERENCES "organization_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_document_requirements" ADD CONSTRAINT "product_document_requirements_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_document_requirements" ADD CONSTRAINT "product_document_requirements_loanProductId_fkey" FOREIGN KEY ("loanProductId") REFERENCES "loan_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_document_requirements" ADD CONSTRAINT "lender_document_requirements_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_document_requirements" ADD CONSTRAINT "lender_document_requirements_lenderProductId_fkey" FOREIGN KEY ("lenderProductId") REFERENCES "lender_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_document_requests" ADD CONSTRAINT "lender_document_requests_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_document_requests" ADD CONSTRAINT "lender_document_requests_applicationLenderId_fkey" FOREIGN KEY ("applicationLenderId") REFERENCES "application_lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_document_requests" ADD CONSTRAINT "lender_document_requests_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_white_label_settings" ADD CONSTRAINT "broker_white_label_settings_brokerOrgId_fkey" FOREIGN KEY ("brokerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_brokerOrgId_fkey" FOREIGN KEY ("brokerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_brokerOrgId_fkey" FOREIGN KEY ("brokerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_brokerUserId_fkey" FOREIGN KEY ("brokerUserId") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_applications" ADD CONSTRAINT "broker_applications_brokerOrgId_fkey" FOREIGN KEY ("brokerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_application_products" ADD CONSTRAINT "broker_application_products_brokerApplicationId_fkey" FOREIGN KEY ("brokerApplicationId") REFERENCES "broker_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_application_product_fields" ADD CONSTRAINT "broker_application_product_fields_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "broker_application_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_application_product_fields" ADD CONSTRAINT "broker_application_product_fields_applicationProductId_fkey" FOREIGN KEY ("applicationProductId") REFERENCES "broker_application_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_application_sections" ADD CONSTRAINT "broker_application_sections_applicationProductId_fkey" FOREIGN KEY ("applicationProductId") REFERENCES "broker_application_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_financials" ADD CONSTRAINT "application_financials_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_collaterals" ADD CONSTRAINT "application_collaterals_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_document_requirements" ADD CONSTRAINT "application_document_requirements_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_document_requirements" ADD CONSTRAINT "application_document_requirements_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_document_requirements" ADD CONSTRAINT "application_document_requirements_request_application_lend_fkey" FOREIGN KEY ("request_application_lender_id") REFERENCES "application_lenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_document_uploads" ADD CONSTRAINT "application_document_uploads_documentRequirementId_fkey" FOREIGN KEY ("documentRequirementId") REFERENCES "application_document_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_document_uploads" ADD CONSTRAINT "application_document_uploads_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_document_uploads" ADD CONSTRAINT "application_document_uploads_uploadedByClientUserId_fkey" FOREIGN KEY ("uploadedByClientUserId") REFERENCES "client_portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_document_uploads" ADD CONSTRAINT "application_document_uploads_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_document_submissions" ADD CONSTRAINT "application_document_submissions_documentUploadId_fkey" FOREIGN KEY ("documentUploadId") REFERENCES "application_document_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_document_submissions" ADD CONSTRAINT "application_document_submissions_applicationLenderId_fkey" FOREIGN KEY ("applicationLenderId") REFERENCES "application_lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_rule_evaluations" ADD CONSTRAINT "application_rule_evaluations_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_rule_evaluations" ADD CONSTRAINT "application_rule_evaluations_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "application_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_rule_evaluations" ADD CONSTRAINT "application_rule_evaluations_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "eligibility_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_rule_results" ADD CONSTRAINT "application_rule_results_ruleEvaluationId_fkey" FOREIGN KEY ("ruleEvaluationId") REFERENCES "application_rule_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_rule_results" ADD CONSTRAINT "application_rule_results_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "eligibility_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_lenders" ADD CONSTRAINT "application_lenders_lenderOrgId_fkey" FOREIGN KEY ("lenderOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_lenders" ADD CONSTRAINT "application_lenders_lenderProductId_fkey" FOREIGN KEY ("lenderProductId") REFERENCES "lender_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_lenders" ADD CONSTRAINT "application_lenders_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_lenders" ADD CONSTRAINT "application_lenders_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_reviews" ADD CONSTRAINT "lender_reviews_applicationLenderId_fkey" FOREIGN KEY ("applicationLenderId") REFERENCES "application_lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_reviews" ADD CONSTRAINT "lender_reviews_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_conditions" ADD CONSTRAINT "lender_conditions_lenderReviewId_fkey" FOREIGN KEY ("lenderReviewId") REFERENCES "lender_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_title_companies" ADD CONSTRAINT "escrow_title_companies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_instructions" ADD CONSTRAINT "escrow_instructions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_instructions" ADD CONSTRAINT "escrow_instructions_escrowCompanyId_fkey" FOREIGN KEY ("escrowCompanyId") REFERENCES "escrow_title_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_instructions" ADD CONSTRAINT "escrow_instructions_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_notificationTemplateId_fkey" FOREIGN KEY ("notificationTemplateId") REFERENCES "notification_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_agreements" ADD CONSTRAINT "fee_agreements_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_agreements" ADD CONSTRAINT "fee_agreements_brokerOrgId_fkey" FOREIGN KEY ("brokerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_agreements" ADD CONSTRAINT "fee_agreements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorOrgId_fkey" FOREIGN KEY ("actorOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_templates" ADD CONSTRAINT "application_templates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_template_products" ADD CONSTRAINT "application_template_products_applicationTemplateId_fkey" FOREIGN KEY ("applicationTemplateId") REFERENCES "application_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_template_product_fields" ADD CONSTRAINT "application_template_product_fields_applicationTemplatePro_fkey" FOREIGN KEY ("applicationTemplateProductId") REFERENCES "application_template_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_template_product_fields" ADD CONSTRAINT "application_template_product_fields_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "application_template_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_template_sections" ADD CONSTRAINT "application_template_sections_applicationTemplateProductId_fkey" FOREIGN KEY ("applicationTemplateProductId") REFERENCES "application_template_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_submissions" ADD CONSTRAINT "application_submissions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_submission_fields" ADD CONSTRAINT "application_submission_fields_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "application_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_submission_fields" ADD CONSTRAINT "application_submission_fields_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "broker_application_product_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_brokerOrgId_fkey" FOREIGN KEY ("brokerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientUploadToken" ADD CONSTRAINT "ClientUploadToken_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientUploadToken" ADD CONSTRAINT "ClientUploadToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_loi_templates" ADD CONSTRAINT "lender_loi_templates_lenderOrgId_fkey" FOREIGN KEY ("lenderOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubBrokerSubmission" ADD CONSTRAINT "SubBrokerSubmission_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubBrokerSubmission" ADD CONSTRAINT "SubBrokerSubmission_documentUploadId_fkey" FOREIGN KEY ("documentUploadId") REFERENCES "application_document_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubBrokerSubmission" ADD CONSTRAINT "SubBrokerSubmission_submittedBySubBrokerId_fkey" FOREIGN KEY ("submittedBySubBrokerId") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubBrokerSubmission" ADD CONSTRAINT "SubBrokerSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
