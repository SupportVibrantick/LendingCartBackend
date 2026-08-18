const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  transferLenderPortal,
  TransferLenderPortalError,
} = require("../services/lenders/transferLenderPortal");

function createMemoryPrisma() {
  const state = {
    organizations: [],
    users: [],
    roles: [{ id: "role-lender-admin", name: "LENDER_ADMIN" }],
    userRoles: [],
    userPermissions: [],
    auditLogs: [],
    invitations: [],
  };

  const matchesInsensitive = (value, expected) =>
    String(value || "").trim().toLowerCase() ===
    String(expected || "").trim().toLowerCase();

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function findUser(id) {
    return state.users.find((user) => user.id === id) || null;
  }

  const api = {
    state,
    organization: {
      async findFirst({ where, select } = {}) {
        const org = state.organizations.find((item) => {
          if (where.id && item.id !== where.id) return false;
          if (where.type && item.type !== where.type) return false;
          if (where.isDeleted?.not === true && item.isDeleted) return false;
          return true;
        });
        if (!org) return null;
        if (!select) return clone(org);
        const picked = {};
        for (const key of Object.keys(select)) {
          if (select[key]) picked[key] = org[key];
        }
        return picked;
      },
    },
    userAccount: {
      async findFirst({ where, include } = {}) {
        const user = state.users.find((item) => {
          if (where.email?.equals) {
            return matchesInsensitive(item.email, where.email.equals);
          }
          if (where.email) return matchesInsensitive(item.email, where.email);
          return false;
        });
        if (!user) return null;
        const result = clone(user);
        if (include?.organization) {
          result.organization =
            state.organizations.find((org) => org.id === user.organizationId) ||
            null;
        }
        if (include?.roles) {
          result.roles = state.userRoles
            .filter((entry) => entry.userId === user.id)
            .map((entry) => ({
              ...entry,
              role: state.roles.find((role) => role.id === entry.roleId),
            }));
        }
        return result;
      },
      async create({ data }) {
        const user = {
          id: data.id || `user-${state.users.length + 1}`,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || null,
          passwordHash: data.passwordHash,
          organizationId: data.organizationId,
          status: data.status || "ACTIVE",
          isDeleted: false,
          deletedAt: null,
          emailVerifiedAt: data.emailVerifiedAt || null,
          createdById: data.createdById || null,
          createdAt: data.createdAt || new Date("2026-01-01T00:00:00.000Z"),
        };
        state.users.push(user);
        return clone(user);
      },
      async update({ where, data }) {
        const user = findUser(where.id);
        if (!user) throw new Error("User not found");
        Object.assign(user, data);
        return clone(user);
      },
    },
    userRole: {
      async findFirst({ where, include, orderBy } = {}) {
        let rows = state.userRoles.filter((entry) => {
          const user = findUser(entry.userId);
          const role = state.roles.find((item) => item.id === entry.roleId);
          if (where.role?.name && role?.name !== where.role.name) return false;
          if (where.user?.organizationId && user?.organizationId !== where.user.organizationId) {
            return false;
          }
          if (where.user?.isDeleted?.not === true && user?.isDeleted) return false;
          if (where.user?.status?.in && !where.user.status.in.includes(user?.status)) {
            return false;
          }
          if (where.user?.status && !where.user.status.in && user?.status !== where.user.status) {
            return false;
          }
          return true;
        });

        if (orderBy?.user?.createdAt === "asc") {
          rows = rows.sort(
            (a, b) =>
              new Date(findUser(a.userId).createdAt) -
              new Date(findUser(b.userId).createdAt),
          );
        }

        const row = rows[0];
        if (!row) return null;
        const result = clone(row);
        if (include?.user) result.user = clone(findUser(row.userId));
        return result;
      },
      async findMany({ where, select } = {}) {
        const rows = state.userRoles.filter((entry) => {
          if (where.userId && entry.userId !== where.userId) return false;
          return true;
        });
        return rows.map((entry) => {
          const role = state.roles.find((item) => item.id === entry.roleId);
          if (!select) return { ...clone(entry), role };
          return {
            roleId: entry.roleId,
            role: select.role ? { id: role.id, name: role.name } : undefined,
          };
        });
      },
      async deleteMany({ where }) {
        const before = state.userRoles.length;
        state.userRoles = state.userRoles.filter((entry) => entry.userId !== where.userId);
        return { count: before - state.userRoles.length };
      },
      async createMany({ data }) {
        for (const entry of data) {
          state.userRoles.push({
            id: `ur-${state.userRoles.length + 1}`,
            userId: entry.userId,
            roleId: entry.roleId,
          });
        }
        return { count: data.length };
      },
    },
    userPermission: {
      async findMany({ where }) {
        return state.userPermissions
          .filter((entry) => entry.userId === where.userId)
          .map((entry) => clone(entry));
      },
      async deleteMany({ where }) {
        const before = state.userPermissions.length;
        state.userPermissions = state.userPermissions.filter(
          (entry) => entry.userId !== where.userId,
        );
        return { count: before - state.userPermissions.length };
      },
      async createMany({ data }) {
        for (const entry of data) {
          state.userPermissions.push({
            id: `up-${state.userPermissions.length + 1}`,
            userId: entry.userId,
            permissionId: entry.permissionId,
            isAllowed: entry.isAllowed !== false,
          });
        }
        return { count: data.length };
      },
    },
    role: {
      async findFirst({ where, select } = {}) {
        const role = state.roles.find((item) => item.name === where.name);
        if (!role) return null;
        if (!select) return clone(role);
        return { id: role.id, name: role.name };
      },
    },
    auditLog: {
      async create({ data }) {
        const row = { id: `audit-${state.auditLogs.length + 1}`, ...data };
        state.auditLogs.push(row);
        return clone(row);
      },
    },
    async $transaction(fn) {
      const snapshot = JSON.parse(JSON.stringify({
        organizations: state.organizations,
        users: state.users,
        roles: state.roles,
        userRoles: state.userRoles,
        userPermissions: state.userPermissions,
        auditLogs: state.auditLogs,
      }));
      try {
        return await fn(api);
      } catch (error) {
        state.organizations = snapshot.organizations;
        state.users = snapshot.users;
        state.roles = snapshot.roles;
        state.userRoles = snapshot.userRoles;
        state.userPermissions = snapshot.userPermissions;
        state.auditLogs = snapshot.auditLogs;
        throw error;
      }
    },
  };

  return api;
}

function seedLender(prisma, { extraUsers = [] } = {}) {
  const lender = {
    id: "lender-1",
    name: "Acme Capital",
    type: "LENDER",
    status: "ACTIVE",
    isDeleted: false,
  };
  prisma.state.organizations.push(lender);

  const oldContact = {
    id: "old-admin",
    email: "old@acme.com",
    firstName: "Old",
    lastName: "Admin",
    phone: "+15551234567",
    passwordHash: "hash-old",
    organizationId: "lender-1",
    status: "ACTIVE",
    isDeleted: false,
    deletedAt: null,
    emailVerifiedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  prisma.state.users.push(oldContact);
  prisma.state.userRoles.push({
    id: "ur-old",
    userId: "old-admin",
    roleId: "role-lender-admin",
  });
  prisma.state.userPermissions.push({
    id: "up-old",
    userId: "old-admin",
    permissionId: "perm-review",
    isAllowed: true,
  });

  for (const user of extraUsers) {
    prisma.state.users.push(user.account);
    if (user.roleId) {
      prisma.state.userRoles.push({
        id: `ur-${user.account.id}`,
        userId: user.account.id,
        roleId: user.roleId,
      });
    }
    if (user.organization) {
      prisma.state.organizations.push(user.organization);
    }
  }

  return { lender, oldContact };
}

const NEW_CONTACT = {
  firstName: "New",
  lastName: "Contact",
  email: "new@acme.com",
  phone: "+15557654321",
};

describe("transferLenderPortal", () => {
  let prisma;
  let invitations;

  beforeEach(() => {
    prisma = createMemoryPrisma();
    invitations = [];
  });

  async function runTransfer(overrides = {}) {
    return transferLenderPortal(
      prisma,
      {
        lenderOrgId: "lender-1",
        ...NEW_CONTACT,
        actor: { userId: "platform-admin-1", organizationId: "platform-org" },
        ...overrides,
      },
      {
        sendInvitation: async (payload) => {
          invitations.push(payload);
          return { id: "email-1" };
        },
      },
    );
  }

  it("creates the new contact, keeps lender id, and deactivates old portal access", async () => {
    seedLender(prisma);

    const result = await runTransfer();

    assert.equal(result.lenderOrgId, "lender-1");
    assert.equal(result.oldContact.email, "old@acme.com");
    assert.equal(result.newContact.email, "new@acme.com");
    assert.equal(result.reusedExistingUser, false);

    const oldUser = prisma.state.users.find((user) => user.id === "old-admin");
    assert.equal(oldUser.status, "DISABLED");
    assert.equal(oldUser.isDeleted, false);
    assert.equal(oldUser.organizationId, "lender-1");
    assert.equal(
      prisma.state.userRoles.some((entry) => entry.userId === "old-admin"),
      false,
    );

    const newUser = prisma.state.users.find((user) => user.email === "new@acme.com");
    assert.equal(newUser.organizationId, "lender-1");
    assert.equal(newUser.status, "ACTIVE");
    assert.ok(
      prisma.state.userRoles.some(
        (entry) =>
          entry.userId === newUser.id && entry.roleId === "role-lender-admin",
      ),
    );
    assert.ok(
      prisma.state.userPermissions.some(
        (entry) =>
          entry.userId === newUser.id && entry.permissionId === "perm-review",
      ),
    );

    assert.equal(invitations.length, 1);
    assert.equal(invitations[0].email, "new@acme.com");
    assert.equal(invitations[0].roleName, "LENDER_ADMIN");
    assert.ok(invitations[0].password);

    assert.equal(prisma.state.auditLogs.length, 1);
    assert.equal(prisma.state.auditLogs[0].action, "TRANSFER_LENDER_PORTAL");
    assert.equal(prisma.state.auditLogs[0].entityId, "lender-1");
    assert.equal(prisma.state.auditLogs[0].actorUserId, "platform-admin-1");
  });

  it("rejects when the new email already belongs to another lender", async () => {
    seedLender(prisma, {
      extraUsers: [
        {
          organization: {
            id: "lender-2",
            name: "Other Lender",
            type: "LENDER",
            status: "ACTIVE",
            isDeleted: false,
          },
          account: {
            id: "other-admin",
            email: "new@acme.com",
            firstName: "Other",
            lastName: "Admin",
            organizationId: "lender-2",
            status: "ACTIVE",
            isDeleted: false,
            createdAt: new Date("2026-02-01"),
          },
        },
      ],
    });

    await assert.rejects(
      () => runTransfer(),
      (error) => {
        assert.equal(error instanceof TransferLenderPortalError, true);
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /another lender/i);
        return true;
      },
    );

    const oldUser = prisma.state.users.find((user) => user.id === "old-admin");
    assert.equal(oldUser.status, "ACTIVE");
    assert.equal(invitations.length, 0);
    assert.equal(prisma.state.auditLogs.length, 0);
  });

  it("reuses an existing user already on this lender instead of creating a duplicate", async () => {
    seedLender(prisma, {
      extraUsers: [
        {
          roleId: "role-lender-admin",
          account: {
            id: "existing-team",
            email: "new@acme.com",
            firstName: "Existing",
            lastName: "Viewer",
            organizationId: "lender-1",
            status: "ACTIVE",
            isDeleted: false,
            emailVerifiedAt: new Date("2026-03-01"),
            createdAt: new Date("2026-03-01T00:00:00.000Z"),
          },
        },
      ],
    });

    const result = await runTransfer();

    assert.equal(result.reusedExistingUser, true);
    assert.equal(result.newContact.id, "existing-team");
    assert.equal(
      prisma.state.users.filter((user) => user.email === "new@acme.com").length,
      1,
    );

    const promoted = prisma.state.users.find((user) => user.id === "existing-team");
    assert.equal(promoted.firstName, "New");
    assert.equal(promoted.status, "ACTIVE");
    assert.equal(promoted.organizationId, "lender-1");
  });

  it("rejects when the email belongs to a non-lender organization", async () => {
    seedLender(prisma, {
      extraUsers: [
        {
          organization: {
            id: "broker-1",
            name: "Broker Co",
            type: "BROKER",
            status: "ACTIVE",
            isDeleted: false,
          },
          account: {
            id: "broker-user",
            email: "new@acme.com",
            firstName: "Broker",
            lastName: "User",
            organizationId: "broker-1",
            status: "ACTIVE",
            isDeleted: false,
            createdAt: new Date("2026-02-01"),
          },
        },
      ],
    });

    await assert.rejects(
      () => runTransfer(),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /another organization/i);
        return true;
      },
    );
  });

  it("does not delete the old user or their historical identity", async () => {
    seedLender(prisma);
    await runTransfer();

    const oldUser = prisma.state.users.find((user) => user.id === "old-admin");
    assert.ok(oldUser);
    assert.equal(oldUser.isDeleted, false);
    assert.equal(oldUser.email, "old@acme.com");
    assert.equal(oldUser.organizationId, "lender-1");
    assert.equal(oldUser.status, "DISABLED");
  });

  it("rolls back the transfer if sending the invitation fails", async () => {
    seedLender(prisma);

    await assert.rejects(
      () =>
        transferLenderPortal(
          prisma,
          {
            lenderOrgId: "lender-1",
            ...NEW_CONTACT,
            actor: { userId: "platform-admin-1" },
          },
          {
            sendInvitation: async () => {
              throw new Error("SMTP down");
            },
          },
        ),
      /SMTP down/,
    );

    const oldUser = prisma.state.users.find((user) => user.id === "old-admin");
    assert.equal(oldUser.status, "ACTIVE");
    assert.ok(
      prisma.state.userRoles.some((entry) => entry.userId === "old-admin"),
    );
    assert.equal(
      prisma.state.users.some((user) => user.email === "new@acme.com"),
      false,
    );
    assert.equal(prisma.state.auditLogs.length, 0);
  });

  it("rejects transferring to the current contact email", async () => {
    seedLender(prisma);
    await assert.rejects(
      () => runTransfer({ email: "old@acme.com" }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /different from the current/i);
        return true;
      },
    );
  });

  it("returns 404 when the lender does not exist", async () => {
    await assert.rejects(
      () => runTransfer(),
      (error) => {
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });
});
