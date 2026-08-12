const {
  loanAiCheckoutSchema,
} = require("../../../../schemas/public/loanAi/auth.schema");
const {
  canProcessGhlPayments,
  createSubscriptionCheckout,
  getGhlPriceDetails,
  resolveGhlPriceId,
  getGhlProductId,
} = require("../../../../services/ghl/ghl.payment.service");
const {
  rejectTrustedClientPriceFields,
  assertSafeRedirectUrl,
  toPublicCheckoutPayload,
} = require("../../../../services/ghl/ghlCheckoutSecurity");
const {
  CHECKOUT_ERROR_CODES,
  checkoutError,
  toCheckoutErrorResponse,
} = require("../../../../services/ghl/ghlCheckoutErrors");
const {
  checkRateLimit,
  getClientIp,
} = require("../../../../utils/security/rateLimit");
const {
  logCheckoutInitiated,
  logCheckoutCreated,
  logCheckoutReused,
  logCheckoutFailed,
  logPaymentStatusChanged,
} = require("../../../../services/ghl/ghlPaymentLogger");

const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

function packageAmount(pkg, billingCycle) {
  if (billingCycle === "YEARLY") {
    if (pkg.priceYearly == null) {
      return null;
    }
    return Number(pkg.priceYearly);
  }
  return Number(pkg.priceMonthly);
}

function assertGhlPriceActive(priceDetails) {
  if (!priceDetails) {
    throw checkoutError(CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE, 502);
  }
  if (priceDetails.raw?.deleted === true || priceDetails.deleted === true) {
    throw checkoutError(CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE, 400);
  }
  if (
    priceDetails.raw?.active === false ||
    priceDetails.active === false ||
    priceDetails.raw?.isActive === false
  ) {
    throw checkoutError(CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE, 400);
  }
  return true;
}

function sendCheckoutError(reply, err) {
  const { statusCode, body } = toCheckoutErrorResponse(err);
  return reply.status(statusCode).send(body);
}

async function loanAiCheckoutRoutes(fastify) {
  fastify.post(
    "/",
    {
      preHandler: [fastify.verifyLoanAi],
      schema: {
        tags: ["Public -> Loan AI Subscriptions"],
        summary: "Start GHL subscription checkout and return checkout URL",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!canProcessGhlPayments()) {
          throw checkoutError(CHECKOUT_ERROR_CODES.PAYMENTS_UNAVAILABLE, 503);
        }

        rejectTrustedClientPriceFields(req.body || {});

        const user = req.loanAiUser;
        const ip = getClientIp(req);

        const userLimit = checkRateLimit(`loan-ai-checkout:user:${user.id}`, {
          windowMs: DUPLICATE_WINDOW_MS,
          max: 5,
        });
        if (!userLimit.allowed) {
          return reply.status(429).send({
            success: false,
            code: CHECKOUT_ERROR_CODES.RATE_LIMITED,
            message: checkoutError(CHECKOUT_ERROR_CODES.RATE_LIMITED).message,
            retryAfterSec: userLimit.retryAfterSec,
          });
        }

        const ipLimit = checkRateLimit(`loan-ai-checkout:ip:${ip}`, {
          windowMs: DUPLICATE_WINDOW_MS,
          max: 20,
        });
        if (!ipLimit.allowed) {
          return reply.status(429).send({
            success: false,
            code: CHECKOUT_ERROR_CODES.RATE_LIMITED,
            message: checkoutError(CHECKOUT_ERROR_CODES.RATE_LIMITED).message,
            retryAfterSec: ipLimit.retryAfterSec,
          });
        }

        const parsed = loanAiCheckoutSchema.safeParse(req.body || {});
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          const path = issue?.path?.[0];
          if (path === "billingCycle" || path === "billingPeriod") {
            throw checkoutError(
              CHECKOUT_ERROR_CODES.INVALID_BILLING_PERIOD,
              400,
            );
          }
          if (path === "packageId") {
            throw checkoutError(CHECKOUT_ERROR_CODES.INVALID_PACKAGE, 400);
          }
          throw checkoutError(CHECKOUT_ERROR_CODES.VALIDATION_FAILED, 400);
        }

        let successUrl;
        let cancelUrl;
        try {
          successUrl = assertSafeRedirectUrl(
            parsed.data.successUrl,
            "successUrl",
          );
          cancelUrl = assertSafeRedirectUrl(parsed.data.cancelUrl, "cancelUrl");
        } catch (err) {
          throw checkoutError(CHECKOUT_ERROR_CODES.VALIDATION_FAILED, 400);
        }

        const { packageId, billingCycle, phone } = parsed.data;

        if (user.brokerOrganizationId) {
          const latestSub = await prisma.organizationSubscription.findFirst({
            where: { organizationId: user.brokerOrganizationId },
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true },
          });

          if (
            latestSub &&
            ["TRIAL", "ACTIVE", "PAST_DUE"].includes(latestSub.status)
          ) {
            throw checkoutError(CHECKOUT_ERROR_CODES.SUBSCRIPTION_ACTIVE, 409);
          }
          // CANCELLED / EXPIRED: allow renew checkout
        }

        const pkg = await prisma.subscriptionPackage.findFirst({
          where: { id: packageId, isActive: true },
        });

        if (!pkg) {
          throw checkoutError(CHECKOUT_ERROR_CODES.INVALID_PACKAGE, 404);
        }

        const amount = packageAmount(pkg, billingCycle);
        if (amount == null || Number.isNaN(amount)) {
          throw checkoutError(
            CHECKOUT_ERROR_CODES.INVALID_BILLING_PERIOD,
            400,
          );
        }

        const existingOpen = await prisma.loanAiGhlCheckout.findFirst({
          where: {
            loanAiUserId: user.id,
            packageId: pkg.id,
            billingCycle,
            status: "CHECKOUT_CREATED",
            paymentStatus: "PENDING",
            checkoutUrl: { not: null },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
          },
          orderBy: { createdAt: "desc" },
        });

        if (existingOpen?.checkoutUrl) {
          logCheckoutReused({
            checkoutId: existingOpen.id,
            loanAiUserId: user.id,
            packageId: pkg.id,
            packageCode: pkg.code,
            billingPeriod: billingCycle,
            ghlContactId: existingOpen.ghlContactId,
            ghlPriceId: existingOpen.ghlPriceId,
            paymentStatus: existingOpen.paymentStatus,
            status: existingOpen.status,
            reused: true,
          });
          return reply.send({
            success: true,
            checkoutUrl: existingOpen.checkoutUrl,
            reused: true,
            data: toPublicCheckoutPayload(existingOpen, pkg),
          });
        }

        let resolved;
        try {
          resolved = resolveGhlPriceId(pkg.code, billingCycle);
        } catch (err) {
          return sendCheckoutError(reply, err);
        }

        const productId = getGhlProductId();
        let priceDetails;
        try {
          priceDetails = await getGhlPriceDetails(resolved.priceId, productId);
          assertGhlPriceActive(priceDetails);
        } catch (err) {
          logCheckoutFailed({
            loanAiUserId: user.id,
            packageId: pkg.id,
            packageCode: pkg.code,
            billingPeriod: billingCycle,
            ghlPriceId: resolved.priceId,
            code: err.code,
            message: err.message,
            reason: "ghl_price_verification_failed",
          });
          return sendCheckoutError(
            reply,
            err.code
              ? err
              : checkoutError(CHECKOUT_ERROR_CODES.GHL_API_FAILED, 502),
          );
        }

        logCheckoutInitiated({
          loanAiUserId: user.id,
          packageId: pkg.id,
          packageCode: pkg.code,
          billingPeriod: billingCycle,
          ghlPriceId: resolved.priceId,
          ghlProductId: productId,
          amount,
          currency: priceDetails.currency || "USD",
        });

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const checkout = await prisma.loanAiGhlCheckout.create({
          data: {
            loanAiUserId: user.id,
            packageId: pkg.id,
            billingCycle,
            status: "PENDING",
            paymentStatus: "PENDING",
            amount,
            currency: priceDetails.currency || "USD",
            ghlProductId: productId,
            ghlPriceId: resolved.priceId,
            successUrl: successUrl || null,
            cancelUrl: cancelUrl || null,
            expiresAt,
            metadata: {
              packageCode: pkg.code,
              packageName: pkg.name,
              ghlPriceName: priceDetails.name || null,
              ghlPriceType: priceDetails.type || null,
              clientIp: ip,
            },
          },
        });

        try {
          const session = await createSubscriptionCheckout({
            email: user.email,
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            phone: phone || undefined,
            packageCode: pkg.code,
            billingCycle,
            amount,
            currency: priceDetails.currency || "USD",
            planName: pkg.name,
            successUrl,
            cancelUrl,
            metadata: {
              lendingCartCheckoutId: checkout.id,
              loanAiUserId: user.id,
              packageId: pkg.id,
            },
          });

          const updated = await prisma.loanAiGhlCheckout.update({
            where: { id: checkout.id },
            data: {
              status: "CHECKOUT_CREATED",
              paymentStatus: "PENDING",
              ghlContactId: session.ghlContactId || null,
              ghlInvoiceId: session.invoiceId || null,
              ghlProductId: session.productId || productId,
              ghlPriceId: resolved.priceId,
              checkoutUrl: session.checkoutUrl,
              lastError: null,
            },
          });

          logCheckoutCreated({
            checkoutId: updated.id,
            loanAiUserId: user.id,
            packageId: pkg.id,
            packageCode: pkg.code,
            billingPeriod: billingCycle,
            ghlContactId: updated.ghlContactId,
            ghlPriceId: updated.ghlPriceId,
            ghlProductId: updated.ghlProductId,
            ghlInvoiceId: updated.ghlInvoiceId,
            paymentStatus: updated.paymentStatus,
            status: updated.status,
            amount: updated.amount,
            currency: updated.currency,
          });

          return reply.send({
            success: true,
            checkoutUrl: updated.checkoutUrl,
            data: toPublicCheckoutPayload(updated, pkg),
          });
        } catch (err) {
          await prisma.loanAiGhlCheckout.update({
            where: { id: checkout.id },
            data: {
              status: "FAILED",
              paymentStatus: "FAILED",
              lastError: String(err.message || "GHL checkout failed").slice(
                0,
                1000,
              ),
            },
          });
          logCheckoutFailed({
            checkoutId: checkout.id,
            loanAiUserId: user.id,
            packageId: pkg.id,
            packageCode: pkg.code,
            billingPeriod: billingCycle,
            ghlPriceId: resolved.priceId,
            paymentStatus: "FAILED",
            status: "FAILED",
            code: err.code,
            message: err.message,
          });
          logPaymentStatusChanged({
            checkoutId: checkout.id,
            loanAiUserId: user.id,
            packageId: pkg.id,
            billingPeriod: billingCycle,
            ghlPriceId: resolved.priceId,
            previousStatus: "PENDING",
            paymentStatus: "FAILED",
            status: "FAILED",
            reason: err.code || "checkout_create_failed",
          });
          throw err;
        }
      } catch (error) {
        if (
          error?.statusCode === 401 ||
          /authentication required|unauthorized/i.test(
            String(error?.message || ""),
          )
        ) {
          return sendCheckoutError(
            reply,
            checkoutError(CHECKOUT_ERROR_CODES.UNAUTHORIZED, 401),
          );
        }

        if (!error?.code) {
          logCheckoutFailed({
            message: error.message,
            code: error.code,
          });
        }

        return sendCheckoutError(reply, error);
      }
    },
  );
}

module.exports = loanAiCheckoutRoutes;
