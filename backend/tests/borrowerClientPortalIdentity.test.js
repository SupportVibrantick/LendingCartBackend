const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  findOrCreateBorrowerClient,
  normalizeClientEmail,
  namesDiffer,
} = require("../services/clientPortal/findOrCreateBorrowerClient");
const {
  ensureClientPortalUserForImpersonation,
} = require("../services/clientPortal/ensureClientPortalUserForImpersonation");

function createMemoryDb() {
  const state = {
    clients: [],
    contacts: [],
    portalUsers: [],
    applications: [],
  };

  const matchesEmail = (value, email) =>
    String(value || "")
      .trim()
      .toLowerCase() === email;

  const api = {
    state,
    async $executeRaw() {
      return 1;
    },
    client: {
      async findFirst({ where, include, orderBy } = {}) {
        let rows = state.clients.filter((client) => {
          if (
            where.primaryBrokerOrgId &&
            client.primaryBrokerOrgId !== where.primaryBrokerOrgId
          ) {
            return false;
          }
          if (where.isDeleted === false && client.isDeleted) return false;
          if (where.contacts?.some) {
            const emailClause = where.contacts.some.OR || [
              { email: where.contacts.some.email },
            ];
            const emails = emailClause
              .map((clause) => clause.email?.equals || clause.email)
              .filter(Boolean)
              .map((v) => String(v).toLowerCase());
            const has = state.contacts.some(
              (contact) =>
                contact.clientId === client.id &&
                emails.some((email) => matchesEmail(contact.email, email)),
            );
            if (!has) return false;
          }
          return true;
        });
        if (orderBy?.createdAt === "asc") {
          rows = rows.sort((a, b) => a.createdAt - b.createdAt);
        }
        const client = rows[0] || null;
        if (!client) return null;
        if (include?.contacts) {
          return {
            ...client,
            contacts: state.contacts.filter((c) => c.clientId === client.id),
          };
        }
        return client;
      },
      async create({ data, include }) {
        const id = data.id;
        const client = {
          id,
          legalName: data.legalName,
          entityType: data.entityType,
          primaryBrokerOrgId: data.primaryBrokerOrgId,
          isDeleted: false,
          createdAt: Date.now() + state.clients.length,
        };
        state.clients.push(client);
        if (data.contacts?.create) {
          const contact = {
            id: `contact-${state.contacts.length + 1}`,
            clientId: id,
            ...data.contacts.create,
          };
          state.contacts.push(contact);
        }
        if (include?.contacts) {
          return {
            ...client,
            contacts: state.contacts.filter((c) => c.clientId === id),
          };
        }
        return client;
      },
      async update({ where, data, include }) {
        const client = state.clients.find((c) => c.id === where.id);
        Object.assign(client, data);
        if (include?.contacts) {
          return {
            ...client,
            contacts: state.contacts.filter((c) => c.clientId === client.id),
          };
        }
        return client;
      },
      async findUnique({ where, include }) {
        const client = state.clients.find((c) => c.id === where.id);
        if (!client) return null;
        if (include?.contacts) {
          return {
            ...client,
            contacts: state.contacts.filter((c) => c.clientId === client.id),
          };
        }
        return client;
      },
    },
    clientContact: {
      async update({ where, data }) {
        const contact = state.contacts.find((c) => c.id === where.id);
        Object.assign(contact, data);
        return contact;
      },
      async findFirst({ where }) {
        return (
          state.contacts.find((c) => c.clientId === where.clientId) || null
        );
      },
    },
    clientPortalUser: {
      async findFirst({ where, include, orderBy } = {}) {
        let rows = state.portalUsers.filter((user) => {
          if (where.clientId && user.clientId !== where.clientId) return false;
          if (where.isDeleted === false && user.isDeleted) return false;
          if (where.isActive === true && !user.isActive) return false;
          if (where.OR) {
            return where.OR.some((clause) => {
              if (clause.clientId) return user.clientId === clause.clientId;
              const email = clause.email?.equals || clause.email;
              return email ? matchesEmail(user.email, String(email).toLowerCase()) : false;
            });
          }
          if (where.email) {
            const email = where.email.equals || where.email;
            return matchesEmail(user.email, String(email).toLowerCase());
          }
          return true;
        });
        if (Array.isArray(orderBy)) {
          // keep insertion order for tests
        }
        const user = rows[0] || null;
        if (!user) return null;
        if (include?.client) {
          const client = state.clients.find((c) => c.id === user.clientId);
          return {
            ...user,
            client: client
              ? {
                  ...client,
                  contacts: state.contacts.filter(
                    (c) => c.clientId === client.id,
                  ),
                }
              : null,
          };
        }
        return { ...user };
      },
      async create({ data }) {
        if (
          state.portalUsers.some((u) => matchesEmail(u.email, data.email))
        ) {
          const err = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        const user = {
          id: `portal-${state.portalUsers.length + 1}`,
          ...data,
          isDeleted: false,
          createdAt: Date.now(),
        };
        state.portalUsers.push(user);
        return { ...user };
      },
      async update({ where, data }) {
        const user = state.portalUsers.find((u) => u.id === where.id);
        Object.assign(user, data);
        return { ...user };
      },
    },
    loanApplication: {
      async create({ data }) {
        const app = {
          id: data.id || `app-${state.applications.length + 1}`,
          ...data,
        };
        state.applications.push(app);
        return app;
      },
      async findMany({ where } = {}) {
        return state.applications.filter((app) => {
          if (where?.clientId && app.clientId !== where.clientId) return false;
          return true;
        });
      },
    },
  };

  return api;
}

describe("normalizeClientEmail", () => {
  it("trims and lowercases", () => {
    assert.equal(normalizeClientEmail("  Test@Example.COM "), "test@example.com");
  });
});

describe("findOrCreateBorrowerClient", () => {
  it("creates a Client for a new email", async () => {
    const db = createMemoryDb();
    const result = await findOrCreateBorrowerClient(db, {
      brokerOrgId: "broker-1",
      email: "new@example.com",
      firstName: "John",
      lastName: "Smith",
    });

    assert.equal(result.reused, false);
    assert.equal(result.client.legalName, "John Smith");
    assert.equal(db.state.clients.length, 1);
    assert.equal(db.state.contacts[0].email, "new@example.com");
  });

  it("reuses an existing Client for the same email", async () => {
    const db = createMemoryDb();
    const first = await findOrCreateBorrowerClient(db, {
      brokerOrgId: "broker-1",
      email: "same@example.com",
      firstName: "John",
      lastName: "Smith",
    });
    const second = await findOrCreateBorrowerClient(db, {
      brokerOrgId: "broker-1",
      email: "SAME@example.com",
      firstName: "John",
      lastName: "Smith",
    });

    assert.equal(second.reused, true);
    assert.equal(second.client.id, first.client.id);
    assert.equal(db.state.clients.length, 1);
  });

  it("does not overwrite identity when names differ", async () => {
    const db = createMemoryDb();
    const first = await findOrCreateBorrowerClient(db, {
      brokerOrgId: "broker-1",
      email: "same@example.com",
      firstName: "John",
      lastName: "Smith",
    });
    const second = await findOrCreateBorrowerClient(db, {
      brokerOrgId: "broker-1",
      email: "same@example.com",
      firstName: "Franz",
      lastName: "Kafka",
      logger: { warn() {} },
    });

    assert.equal(second.reused, true);
    assert.equal(second.nameMismatch, true);
    assert.ok(second.warnings.length > 0);
    assert.equal(second.client.id, first.client.id);
    assert.equal(second.client.legalName, "John Smith");
    assert.equal(db.state.contacts[0].firstName, "John");
    assert.equal(db.state.contacts[0].lastName, "Smith");
  });

  it("allows the same Client to own multiple loan applications", async () => {
    const db = createMemoryDb();
    const { client } = await findOrCreateBorrowerClient(db, {
      brokerOrgId: "broker-1",
      email: "multi@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    });

    await db.loanApplication.create({
      data: { id: "app-1", clientId: client.id, brokerOrgId: "broker-1" },
    });
    await db.loanApplication.create({
      data: { id: "app-2", clientId: client.id, brokerOrgId: "broker-1" },
    });

    const apps = await db.loanApplication.findMany({
      where: { clientId: client.id },
    });
    assert.equal(apps.length, 2);
  });

  it("fills generic identity but still reuses the Client", async () => {
    const db = createMemoryDb();
    const first = await findOrCreateBorrowerClient(db, {
      brokerOrgId: "broker-1",
      email: "generic@example.com",
      firstName: "Applicant",
      lastName: "",
      displayName: "Individual Applicant",
    });
    const second = await findOrCreateBorrowerClient(db, {
      brokerOrgId: "broker-1",
      email: "generic@example.com",
      firstName: "Pat",
      lastName: "Lee",
    });

    assert.equal(second.reused, true);
    assert.equal(second.client.id, first.client.id);
    assert.equal(second.client.legalName, "Pat Lee");
    assert.equal(db.state.contacts[0].firstName, "Pat");
  });
});

describe("ensureClientPortalUserForImpersonation", () => {
  it("reuses existing portal user for same email without reassigning clientId", async () => {
    const db = createMemoryDb();
    db.state.clients.push(
      {
        id: "client-a",
        primaryBrokerOrgId: "broker-1",
        legalName: "John Smith",
        isDeleted: false,
      },
      {
        id: "client-b",
        primaryBrokerOrgId: "broker-1",
        legalName: "Franz Kafka",
        isDeleted: false,
      },
    );
    db.state.contacts.push(
      {
        id: "c1",
        clientId: "client-a",
        email: "shared@example.com",
        firstName: "John",
        lastName: "Smith",
        isPrimary: true,
      },
      {
        id: "c2",
        clientId: "client-b",
        email: "shared@example.com",
        firstName: "Franz",
        lastName: "Kafka",
        isPrimary: true,
      },
    );
    db.state.portalUsers.push({
      id: "portal-1",
      clientId: "client-a",
      email: "shared@example.com",
      passwordHash: "hash",
      isActive: true,
      isDeleted: false,
    });

    const portalUser = await ensureClientPortalUserForImpersonation(db, {
      clientId: "client-b",
      contacts: db.state.contacts.filter((c) => c.clientId === "client-b"),
    });

    assert.equal(portalUser.id, "portal-1");
    assert.equal(portalUser.clientId, "client-a");
    assert.equal(db.state.portalUsers.length, 1);
  });

  it("creates a portal user when email is new", async () => {
    const db = createMemoryDb();
    db.state.clients.push({
      id: "client-new",
      primaryBrokerOrgId: "broker-1",
      legalName: "New Person",
      isDeleted: false,
    });
    db.state.contacts.push({
      id: "c-new",
      clientId: "client-new",
      email: "brandnew@example.com",
      firstName: "New",
      lastName: "Person",
      isPrimary: true,
    });

    const portalUser = await ensureClientPortalUserForImpersonation(db, {
      clientId: "client-new",
      contacts: db.state.contacts,
    });

    assert.equal(portalUser.clientId, "client-new");
    assert.equal(portalUser.email, "brandnew@example.com");
    assert.equal(db.state.portalUsers.length, 1);
  });

  it("handles concurrent create race by reusing the existing email owner", async () => {
    const db = createMemoryDb();
    db.state.clients.push(
      {
        id: "client-a",
        primaryBrokerOrgId: "broker-1",
        legalName: "A",
        isDeleted: false,
      },
      {
        id: "client-b",
        primaryBrokerOrgId: "broker-1",
        legalName: "B",
        isDeleted: false,
      },
    );
    db.state.contacts.push({
      id: "c-b",
      clientId: "client-b",
      email: "race@example.com",
      firstName: "B",
      lastName: "",
      isPrimary: true,
    });

    // First call creates portal for client-b.
    const first = await ensureClientPortalUserForImpersonation(db, {
      clientId: "client-b",
      contacts: db.state.contacts,
    });
    assert.equal(first.clientId, "client-b");

    // Simulate another client with same email trying to create → reuse.
    db.state.contacts.push({
      id: "c-a",
      clientId: "client-a",
      email: "race@example.com",
      firstName: "A",
      lastName: "",
      isPrimary: true,
    });
    const second = await ensureClientPortalUserForImpersonation(db, {
      clientId: "client-a",
      contacts: db.state.contacts.filter((c) => c.clientId === "client-a"),
    });

    assert.equal(second.id, first.id);
    assert.equal(second.clientId, "client-b");
    assert.equal(db.state.portalUsers.length, 1);
  });
});

describe("setPassword identity reuse (logic)", () => {
  it("updates existing portal user password without creating another row", async () => {
    const db = createMemoryDb();
    db.state.clients.push(
      {
        id: "client-a",
        primaryBrokerOrgId: "broker-1",
        legalName: "Owner",
        isDeleted: false,
      },
      {
        id: "client-b",
        primaryBrokerOrgId: "broker-1",
        legalName: "Invite",
        isDeleted: false,
      },
    );
    db.state.contacts.push({
      id: "c-b",
      clientId: "client-b",
      email: "login@example.com",
      firstName: "Invite",
      lastName: "Name",
      isPrimary: true,
    });
    db.state.portalUsers.push({
      id: "portal-owner",
      clientId: "client-a",
      email: "login@example.com",
      passwordHash: "old-hash",
      isActive: true,
      isDeleted: false,
    });

    const contact = await db.clientContact.findFirst({
      where: { clientId: "client-b" },
    });
    const clientEmail = normalizeClientEmail(contact.email);
    const existingUser = await db.clientPortalUser.findFirst({
      where: {
        OR: [
          { clientId: "client-b" },
          { email: clientEmail },
          { email: { equals: clientEmail, mode: "insensitive" } },
        ],
      },
    });

    assert.ok(existingUser);
    assert.equal(existingUser.clientId, "client-a");

    const updated = await db.clientPortalUser.update({
      where: { id: existingUser.id },
      data: {
        email: clientEmail,
        passwordHash: "new-hash",
        isActive: true,
        isDeleted: false,
        deletedAt: null,
      },
    });

    assert.equal(updated.clientId, "client-a");
    assert.equal(updated.passwordHash, "new-hash");
    assert.equal(db.state.portalUsers.length, 1);
  });
});

describe("namesDiffer", () => {
  it("detects real name mismatches and ignores generics", () => {
    assert.equal(namesDiffer("John Smith", "Franz Kafka"), true);
    assert.equal(namesDiffer("John Smith", "john smith"), false);
    assert.equal(namesDiffer("Individual Applicant", "Franz Kafka"), false);
  });
});

describe("resolvePortalClientIds email visibility (contract)", () => {
  it("keeps portal login clientId stable while contacts share email", async () => {
    const db = createMemoryDb();
    db.state.clients.push(
      { id: "client-a", primaryBrokerOrgId: "broker-1", isDeleted: false },
      { id: "client-b", primaryBrokerOrgId: "broker-1", isDeleted: false },
    );
    db.state.contacts.push(
      { clientId: "client-a", email: "vis@example.com" },
      { clientId: "client-b", email: "vis@example.com" },
    );
    db.state.portalUsers.push({
      id: "portal-1",
      clientId: "client-a",
      email: "vis@example.com",
      isDeleted: false,
      isActive: true,
    });

    // Mirrors resolvePortalClientIds contact + portal user expansion.
    const email = "vis@example.com";
    const ids = new Set(["client-a"]);
    for (const contact of db.state.contacts) {
      if (normalizeClientEmail(contact.email) === email) ids.add(contact.clientId);
    }
    for (const user of db.state.portalUsers) {
      if (!user.isDeleted && normalizeClientEmail(user.email) === email) {
        ids.add(user.clientId);
      }
    }

    assert.deepEqual([...ids].sort(), ["client-a", "client-b"]);
    assert.equal(db.state.portalUsers[0].clientId, "client-a");
  });
});
