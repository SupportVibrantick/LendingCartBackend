const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  SOURCE_PORTALS,
  LINK_SOURCE_PORTALS,
  buildPublicApplicationSharePath,
  shouldShowCoBrokerBorrowerInformationTab,
  isPublicApplicationLinkUsable,
  normalizeSourcePortalOption,
  buildLoanApplicationProvenanceFromLink,
  getOrCreatePublicApplicationLink,
  resolvePublicApplicationLinkByToken,
} = require("../services/applications/publicApplicationLink");

describe("Public application link provenance", () => {
  it("Broker / LO show Co-Broker Borrower Information tab; Co-Broker and Legacy hide it", () => {
    assert.equal(shouldShowCoBrokerBorrowerInformationTab("BROKER"), true);
    assert.equal(shouldShowCoBrokerBorrowerInformationTab("LOAN_OFFICER"), true);
    assert.equal(shouldShowCoBrokerBorrowerInformationTab("CO_BROKER"), false);
    assert.equal(shouldShowCoBrokerBorrowerInformationTab("LEGACY"), false);
    assert.equal(shouldShowCoBrokerBorrowerInformationTab(null), false);
  });

  it("normalizes source portal options from route registration", () => {
    assert.equal(normalizeSourcePortalOption("BROKER"), "BROKER");
    assert.equal(normalizeSourcePortalOption("loan_officer"), "LOAN_OFFICER");
    assert.equal(normalizeSourcePortalOption("CO_BROKER"), "CO_BROKER");
    assert.equal(normalizeSourcePortalOption("unknown"), "BROKER");
  });

  it("builds ref-based share path", () => {
    assert.equal(
      buildPublicApplicationSharePath("abc.def_ghi"),
      "/get-loan?ref=abc.def_ghi",
    );
  });

  it("rejects missing, revoked, and expired tokens", () => {
    assert.equal(isPublicApplicationLinkUsable(null).code, "NOT_FOUND");
    assert.equal(
      isPublicApplicationLinkUsable({
        isActive: false,
        revokedAt: null,
        expiresAt: null,
      }).code,
      "REVOKED",
    );
    assert.equal(
      isPublicApplicationLinkUsable({
        isActive: true,
        revokedAt: new Date(),
        expiresAt: null,
      }).code,
      "REVOKED",
    );
    assert.equal(
      isPublicApplicationLinkUsable(
        {
          isActive: true,
          revokedAt: null,
          expiresAt: new Date("2020-01-01T00:00:00.000Z"),
        },
        new Date("2024-01-01T00:00:00.000Z"),
      ).code,
      "EXPIRED",
    );
    assert.equal(
      isPublicApplicationLinkUsable({
        isActive: true,
        revokedAt: null,
        expiresAt: null,
      }).ok,
      true,
    );
  });

  it("builds LO provenance with brokerUserId and CO_BROKER assignment", () => {
    const lo = buildLoanApplicationProvenanceFromLink({
      id: "link-lo",
      sourcePortal: LINK_SOURCE_PORTALS.LOAN_OFFICER,
      createdByUserId: "user-lo",
      loanOfficerId: "user-lo",
      coBrokerId: null,
    });
    assert.equal(lo.publicSourcePortal, "LOAN_OFFICER");
    assert.equal(lo.brokerUserId, "user-lo");
    assert.equal(lo.assignCoBrokerId, null);

    const cob = buildLoanApplicationProvenanceFromLink({
      id: "link-cob",
      sourcePortal: LINK_SOURCE_PORTALS.CO_BROKER,
      createdByUserId: "user-cob",
      loanOfficerId: null,
      coBrokerId: "user-cob",
    });
    assert.equal(cob.publicSourcePortal, "CO_BROKER");
    assert.equal(cob.brokerUserId, null);
    assert.equal(cob.assignCoBrokerId, "user-cob");

    const legacy = buildLoanApplicationProvenanceFromLink(null);
    assert.equal(legacy.publicSourcePortal, SOURCE_PORTALS.LEGACY);
    assert.equal(legacy.publicApplicationLinkId, null);
  });

  it("mints Broker / LO / Co-Broker links with correct portal fields", async () => {
    const created = [];
    const prisma = {
      publicApplicationLink: {
        findFirst: async () => null,
        create: async ({ data }) => {
          created.push(data);
          return data;
        },
      },
    };

    await getOrCreatePublicApplicationLink(prisma, {
      brokerOrganizationId: "org-1",
      createdByUserId: "admin-1",
      sourcePortal: "BROKER",
    });
    await getOrCreatePublicApplicationLink(prisma, {
      brokerOrganizationId: "org-1",
      createdByUserId: "lo-1",
      sourcePortal: "LOAN_OFFICER",
    });
    await getOrCreatePublicApplicationLink(prisma, {
      brokerOrganizationId: "org-1",
      createdByUserId: "cob-1",
      sourcePortal: "CO_BROKER",
    });

    assert.equal(created[0].sourcePortal, "BROKER");
    assert.equal(created[0].loanOfficerId, null);
    assert.equal(created[0].coBrokerId, null);

    assert.equal(created[1].sourcePortal, "LOAN_OFFICER");
    assert.equal(created[1].loanOfficerId, "lo-1");
    assert.equal(created[1].coBrokerId, null);

    assert.equal(created[2].sourcePortal, "CO_BROKER");
    assert.equal(created[2].loanOfficerId, null);
    assert.equal(created[2].coBrokerId, "cob-1");

    assert.ok(created.every((row) => row.brokerOrganizationId === "org-1"));
    assert.ok(created.every((row) => typeof row.token === "string" && row.token.length > 20));
  });

  it("reuses an existing active link instead of minting duplicates", async () => {
    const existing = {
      id: "existing",
      token: "stable-token",
      brokerOrganizationId: "org-1",
      createdByUserId: "admin-1",
      sourcePortal: "BROKER",
    };
    let createCalls = 0;
    const prisma = {
      publicApplicationLink: {
        findFirst: async () => existing,
        create: async () => {
          createCalls += 1;
          return {};
        },
      },
    };

    const link = await getOrCreatePublicApplicationLink(prisma, {
      brokerOrganizationId: "org-1",
      createdByUserId: "admin-1",
      sourcePortal: "BROKER",
    });

    assert.equal(link.token, "stable-token");
    assert.equal(createCalls, 0);
  });

  it("resolves a valid ref and preserves brokerOrganizationId", async () => {
    const prisma = {
      publicApplicationLink: {
        findUnique: async () => ({
          id: "link-1",
          token: "tok",
          brokerOrganizationId: "org-abc",
          sourcePortal: "BROKER",
          createdByUserId: "user-1",
          loanOfficerId: null,
          coBrokerId: null,
          isActive: true,
          revokedAt: null,
          expiresAt: null,
          brokerOrganization: {
            id: "org-abc",
            name: "Demo Broker",
            email: "broker@example.com",
            type: "BROKER",
            status: "ACTIVE",
          },
        }),
      },
    };

    const resolved = await resolvePublicApplicationLinkByToken(prisma, "tok");
    assert.equal(resolved.ok, true);
    assert.equal(resolved.brokerOrganizationId, "org-abc");
    assert.equal(resolved.sourcePortal, "BROKER");
    assert.equal(resolved.showCoBrokerBorrowerInformationTab, true);
  });

  it("rejects invalid and expired refs on resolve", async () => {
    const prismaMissing = {
      publicApplicationLink: {
        findUnique: async () => null,
      },
    };
    const missing = await resolvePublicApplicationLinkByToken(
      prismaMissing,
      "nope",
    );
    assert.equal(missing.ok, false);
    assert.equal(missing.status, 404);

    const prismaExpired = {
      publicApplicationLink: {
        findUnique: async () => ({
          id: "link-2",
          token: "old",
          brokerOrganizationId: "org-abc",
          sourcePortal: "LOAN_OFFICER",
          createdByUserId: "lo-1",
          loanOfficerId: "lo-1",
          coBrokerId: null,
          isActive: true,
          revokedAt: null,
          expiresAt: new Date("2020-01-01T00:00:00.000Z"),
          brokerOrganization: {
            id: "org-abc",
            type: "BROKER",
            status: "ACTIVE",
          },
        }),
      },
    };
    const expired = await resolvePublicApplicationLinkByToken(
      prismaExpired,
      "old",
    );
    assert.equal(expired.ok, false);
    assert.equal(expired.code, "EXPIRED");
    assert.equal(expired.status, 410);
  });
});
