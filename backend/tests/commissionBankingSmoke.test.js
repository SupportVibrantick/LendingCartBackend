/**
 * Live smoke test for commission banking APIs + funding source rules.
 * Run: node tests/commissionBankingSmoke.test.js
 */

require("dotenv").config();
const assert = require("assert");

const API = process.env.SMOKE_API_BASE || `http://127.0.0.1:${process.env.PORT || 4000}`;

const {
  BROKER_EMAIL,
  BROKER_PASSWORD,
  LOAN_OFFICER_PASSWORD,
  SUB_BROKER_PASSWORD,
} = require("../prisma/seedConfig");

const {
  buildFundingPaymentIntentParams,
  assertOrgBankProfile,
} = require("../services/stripe/commissionOrgFunding.service");
const {
  formatOwnBanking,
  upsertOwnBanking,
} = require("../services/broker/selfBankingProfile.service");
const {
  upsertOrganizationBanking,
  formatOrgBanking,
  getOrganizationBanking,
} = require("../services/broker/organizationBanking.service");

const prisma = require("../config/prisma");

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok ${name}`))
    .catch((error) => {
      console.error(`fail ${name}`);
      throw error;
    });
}

async function jsonFetch(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

const sampleBanking = {
  accountType: "BUSINESS",
  partyName: "Lending Mastery Test Firm",
  partyAddress: "100 Market Street",
  partyTel: "4155550100",
  partyEmail: "banking-test@example.com",
  bankName: "Chase Test Bank",
  bankTel: "4155550199",
  accountName: "Lending Mastery Operating",
  accountNumber: "000123456789",
  abaRoutingNumber: "110000000",
};

async function main() {
  await test("module: funding debit uses firm bank payment intent metadata", () => {
    const built = buildFundingPaymentIntentParams({
      payout: { id: "smoke-payout", amount: 250 },
      customerId: "cus_smoke",
      paymentMethodId: "pm_smoke",
      requestIp: "8.8.8.8",
    });
    assert.strictEqual(built.params.amount, 25000);
    assert.strictEqual(built.params.metadata.purpose, "commission_ach_funding");
    assert.strictEqual(built.params.metadata.account_number, undefined);
  });

  await test("module: org banking assert requires authorization", () => {
    assert.throws(
      () => assertOrgBankProfile(null),
      /firm bank account/i,
    );
    assert.throws(
      () =>
        assertOrgBankProfile({
          ...sampleBanking,
          achDebitAuthorizedAt: null,
        }),
      /Authorize ACH debit/i,
    );
  });

  let brokerOrgId = null;
  let loUserId = null;
  let coBrokerUserId = null;

  await test("db: find broker / LO / co-broker users", async () => {
    const broker = await prisma.userAccount.findFirst({
      where: { email: BROKER_EMAIL, isDeleted: false },
      select: { id: true, organizationId: true, email: true },
    });
    assert.ok(broker?.organizationId, `Broker not found: ${BROKER_EMAIL}`);
    brokerOrgId = broker.organizationId;

    const lo = await prisma.userAccount.findFirst({
      where: {
        isDeleted: false,
        roles: { some: { role: { name: "BROKER_OFFICER" } } },
        organizationId: brokerOrgId,
      },
      select: { id: true, email: true },
      orderBy: { createdAt: "asc" },
    });
    assert.ok(lo?.id, "No loan officer found in broker org");
    loUserId = lo.id;

    const cob = await prisma.userAccount.findFirst({
      where: {
        isDeleted: false,
        roles: { some: { role: { name: "SUB_BROKER" } } },
        organizationId: brokerOrgId,
      },
      select: { id: true, email: true },
      orderBy: { createdAt: "asc" },
    });
    assert.ok(cob?.id, "No co-broker found in broker org");
    coBrokerUserId = cob.id;
    console.log(`  brokerOrg=${brokerOrgId} lo=${lo.email} cob=${cob.email}`);
  });

  await test("db: upsert firm banking (principal broker funding source)", async () => {
    const profile = await upsertOrganizationBanking(prisma, {
      organizationId: brokerOrgId,
      banking: sampleBanking,
      authorizedByUserId: null,
      authorizeAchDebit: true,
    });
    assert.ok(profile.id);
    assert.ok(profile.achDebitAuthorizedAt);
    assert.strictEqual(profile.accountNumber, "000123456789");
    assertOrgBankProfile(profile);
    const formatted = formatOrgBanking(profile);
    assert.strictEqual(formatted.accountLast4, "6789");
  });

  await test("db: LO can add/update own banking", async () => {
    const saved = await upsertOwnBanking(prisma, loUserId, {
      ...sampleBanking,
      accountType: "PERSONAL",
      partyName: "Loan Officer Test",
      accountName: "LO Checking",
      accountNumber: "000987654321",
    });
    const formatted = formatOwnBanking(saved);
    assert.strictEqual(formatted.accountLast4, "4321");
    assert.strictEqual(saved.userId, loUserId);
  });

  await test("db: co-broker can add/update own banking", async () => {
    const saved = await upsertOwnBanking(prisma, coBrokerUserId, {
      ...sampleBanking,
      accountType: "PERSONAL",
      partyName: "Co Broker Test",
      accountName: "CoBroker Checking",
      accountNumber: "000555666777",
    });
    assert.strictEqual(formatOwnBanking(saved).accountLast4, "6777");
  });

  await test("api: broker login + firm banking GET/PUT", async () => {
    const login = await jsonFetch("/broker/auth/login", {
      method: "POST",
      body: { email: BROKER_EMAIL, password: BROKER_PASSWORD },
    });
    assert.ok(
      login.res.ok && (login.json.token || login.json.data?.token || login.json.accessToken),
      `Broker login failed: ${login.res.status} ${JSON.stringify(login.json).slice(0, 300)}`,
    );
    const token =
      login.json.token ||
      login.json.data?.token ||
      login.json.accessToken;

    const getBefore = await jsonFetch("/broker/commissions/banking", { token });
    assert.ok(getBefore.res.ok, `GET banking failed: ${getBefore.res.status}`);
    assert.ok(getBefore.json.success !== false);

    const put = await jsonFetch("/broker/commissions/banking", {
      method: "PUT",
      token,
      body: {
        ...sampleBanking,
        accountNumber: "000123456780",
        authorizeAchDebit: true,
      },
    });
    assert.ok(
      put.res.ok && put.json.success,
      `PUT banking failed: ${put.res.status} ${put.json.message || ""}`,
    );
    assert.strictEqual(put.json.data?.banking?.accountLast4, "6780");

    const getAfter = await jsonFetch("/broker/commissions/banking", { token });
    assert.strictEqual(getAfter.json.data?.banking?.accountLast4, "6780");
    assert.strictEqual(getAfter.json.data?.achTransfersEnabled, true);
  });

  await test("api: loan officer banking GET/PUT", async () => {
    const lo = await prisma.userAccount.findUnique({
      where: { id: loUserId },
      select: { email: true },
    });
    const login = await jsonFetch("/loanofficer/auth/login", {
      method: "POST",
      body: { email: lo.email, password: LOAN_OFFICER_PASSWORD },
    });
    assert.ok(
      login.res.ok,
      `LO login failed: ${login.res.status} ${JSON.stringify(login.json).slice(0, 300)}`,
    );
    const token =
      login.json.token ||
      login.json.data?.token ||
      login.json.accessToken;
    assert.ok(token, "LO token missing");

    const put = await jsonFetch("/loanofficer/auth/banking", {
      method: "PUT",
      token,
      body: {
        ...sampleBanking,
        accountType: "PERSONAL",
        partyName: "Sarah Smoke Test",
        accountName: "Sarah Checking",
        accountNumber: "000111222333",
      },
    });
    assert.ok(
      put.res.ok && (put.json.ok || put.json.success),
      `LO PUT banking failed: ${put.res.status} ${put.json.message || ""}`,
    );
    assert.strictEqual(put.json.data?.banking?.accountLast4, "2333");

    const get = await jsonFetch("/loanofficer/auth/banking", { token });
    assert.ok(get.res.ok);
    assert.strictEqual(get.json.data?.banking?.accountLast4, "2333");
  });

  await test("api: co-broker banking GET/PUT", async () => {
    const cob = await prisma.userAccount.findUnique({
      where: { id: coBrokerUserId },
      select: { email: true },
    });
    const login = await jsonFetch("/subbroker/auth/login", {
      method: "POST",
      body: { email: cob.email, password: SUB_BROKER_PASSWORD },
    });
    assert.ok(
      login.res.ok,
      `Co-broker login failed: ${login.res.status} ${JSON.stringify(login.json).slice(0, 300)}`,
    );
    const token =
      login.json.token ||
      login.json.data?.token ||
      login.json.accessToken;
    assert.ok(token, "Co-broker token missing");

    const put = await jsonFetch("/subbroker/auth/banking", {
      method: "PUT",
      token,
      body: {
        ...sampleBanking,
        accountType: "PERSONAL",
        partyName: "Alex Smoke Test",
        accountName: "Alex Checking",
        accountNumber: "000444555666",
      },
    });
    assert.ok(
      put.res.ok && (put.json.ok || put.json.success),
      `Co-broker PUT banking failed: ${put.res.status} ${put.json.message || ""}`,
    );
    assert.strictEqual(put.json.data?.banking?.accountLast4, "5666");
  });

  await test("db: funding source is org bank (not platform), recipients have own banks", async () => {
    const orgBank = await getOrganizationBanking(prisma, brokerOrgId);
    const loBank = await prisma.userBankingProfile.findUnique({
      where: { userId: loUserId },
    });
    const cobBank = await prisma.userBankingProfile.findUnique({
      where: { userId: coBrokerUserId },
    });
    assert.ok(orgBank?.accountNumber, "Firm bank missing");
    assert.ok(loBank?.accountNumber, "LO bank missing");
    assert.ok(cobBank?.accountNumber, "Co-broker bank missing");
    assert.notStrictEqual(orgBank.accountNumber, loBank.accountNumber);
    assert.notStrictEqual(orgBank.accountNumber, cobBank.accountNumber);
    assert.ok(orgBank.achDebitAuthorizedAt, "Firm ACH debit not authorized");
  });

  console.log("\nAll commission banking smoke checks passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch (_) {
      // ignore
    }
  });
