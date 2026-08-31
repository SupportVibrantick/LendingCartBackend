const bcrypt = require("bcrypt");
const { findLenderAdminUser } = require("../../utils/lender/findLenderAdminUser");
const { generateTemporaryPassword } = require("../../utils/lender/lenderTeamRoles");
const {
  sendLenderTeamCredentialsEmail,
} = require("../emails/lenderTeamCredentialsEmail");

class TransferLenderPortalError extends Error {
  constructor(message, statusCode = 400, extra = {}) {
    super(message);
    this.name = "TransferLenderPortalError";
    this.statusCode = statusCode;
    this.extra = extra;
  }
}

function publicContact(user) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    email: user.email,
    phone: user.phone || null,
    status: user.status,
  };
}

function uniqueRoleIds(roles = []) {
  return [...new Set(roles.map((entry) => entry.roleId || entry.role?.id).filter(Boolean))];
}

async function transferLenderPortal(
  prisma,
  { lenderOrgId, firstName, lastName, email, phone, actor = {} },
  { sendInvitation = sendLenderTeamCredentialsEmail } = {},
) {
  const lenderOrg = await prisma.organization.findFirst({
    where: {
      id: lenderOrgId,
      type: "LENDER",
      isDeleted: { not: true },
    },
    select: { id: true, name: true, type: true, status: true },
  });

  if (!lenderOrg) {
    throw new TransferLenderPortalError("Lender organization not found.", 404);
  }

  const oldContact = await findLenderAdminUser(prisma, lenderOrgId);
  if (!oldContact) {
    throw new TransferLenderPortalError(
      "This lender has no primary portal contact to transfer.",
      400,
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (normalizedEmail === String(oldContact.email || "").trim().toLowerCase()) {
    throw new TransferLenderPortalError(
      "The new contact email must be different from the current portal contact.",
      400,
    );
  }

  const existingUser = await prisma.userAccount.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: "insensitive" },
    },
    include: {
      organization: { select: { id: true, type: true, name: true } },
      roles: { include: { role: true } },
    },
  });

  if (existingUser) {
    const existingOrgId = existingUser.organizationId || existingUser.organization?.id;
    const existingOrgType = existingUser.organization?.type;

    if (existingOrgId && existingOrgId !== lenderOrgId) {
      if (existingOrgType === "LENDER") {
        throw new TransferLenderPortalError(
          "This email already belongs to another lender. Transfer was not completed.",
          409,
          { field: "email" },
        );
      }

      throw new TransferLenderPortalError(
        "This email is already registered with another organization. Transfer was not completed.",
        409,
        { field: "email" },
      );
    }
  }

  const oldRoles = await prisma.userRole.findMany({
    where: { userId: oldContact.id },
    select: { roleId: true, role: { select: { id: true, name: true } } },
  });
  const oldPermissions = await prisma.userPermission.findMany({
    where: { userId: oldContact.id },
    select: { permissionId: true, isAllowed: true },
  });

  const lenderAdminRole = await prisma.role.findFirst({
    where: { name: "LENDER_ADMIN" },
    select: { id: true, name: true },
  });
  if (!lenderAdminRole) {
    throw new TransferLenderPortalError("LENDER_ADMIN role is not configured.", 500);
  }

  const roleIdsToAssign = uniqueRoleIds([
    ...oldRoles,
    { roleId: lenderAdminRole.id },
  ]);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const actorUserId = actor.userId || actor.id || null;
  const actorOrgId = actor.organizationId || actor.orgId || null;

  const result = await prisma.$transaction(async (tx) => {
    let newContact;
    let reusedExistingUser = false;

    if (existingUser) {
      reusedExistingUser = true;
      newContact = await tx.userAccount.update({
        where: { id: existingUser.id },
        data: {
          email: normalizedEmail,
          firstName,
          lastName,
          phone,
          passwordHash,
          organizationId: lenderOrgId,
          status: "ACTIVE",
          isDeleted: false,
          deletedAt: null,
          emailVerifiedAt: existingUser.emailVerifiedAt || new Date(),
          createdById: actorUserId,
          createdAt: oldContact.createdAt,
        },
      });
    } else {
      newContact = await tx.userAccount.create({
        data: {
          email: normalizedEmail,
          firstName,
          lastName,
          phone,
          passwordHash,
          organizationId: lenderOrgId,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          createdById: actorUserId,
          createdAt: oldContact.createdAt,
        },
      });
    }

    await tx.userRole.deleteMany({ where: { userId: newContact.id } });
    if (roleIdsToAssign.length) {
      await tx.userRole.createMany({
        data: roleIdsToAssign.map((roleId) => ({
          userId: newContact.id,
          roleId,
        })),
      });
    }

    await tx.userPermission.deleteMany({ where: { userId: newContact.id } });
    if (oldPermissions.length) {
      await tx.userPermission.createMany({
        data: oldPermissions.map((entry) => ({
          userId: newContact.id,
          permissionId: entry.permissionId,
          isAllowed: entry.isAllowed !== false,
        })),
      });
    }

    const oldUserStillHasOtherOrg = Boolean(
      oldContact.organizationId && oldContact.organizationId !== lenderOrgId,
    );

    await tx.userRole.deleteMany({ where: { userId: oldContact.id } });
    await tx.userPermission.deleteMany({ where: { userId: oldContact.id } });

    if (!oldUserStillHasOtherOrg) {
      await tx.userAccount.update({
        where: { id: oldContact.id },
        data: {
          status: "DISABLED",
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId,
        actorOrgId,
        dashboard: "PLATFORM",
        category: "USER_MANAGEMENT",
        entityType: "Organization",
        entityId: lenderOrgId,
        action: "TRANSFER_LENDER_PORTAL",
        oldValueJson: JSON.stringify({
          lenderOrgId,
          contact: publicContact(oldContact),
        }),
        newValueJson: JSON.stringify({
          lenderOrgId,
          contact: publicContact(newContact),
          reusedExistingUser,
          adminUserId: actorUserId,
        }),
      },
    });

    await sendInvitation({
      firstName: newContact.firstName,
      email: newContact.email,
      password: temporaryPassword,
      organizationName: lenderOrg.name,
      roleName: "LENDER_ADMIN",
      invitationKey: `transfer-portal:${lenderOrgId}:${newContact.id}:${Date.now()}`,
      prisma: tx,
    });

    return {
      reusedExistingUser,
      newContact,
    };
  });

  return {
    lenderOrgId,
    lenderName: lenderOrg.name,
    reusedExistingUser: result.reusedExistingUser,
    oldContact: publicContact(oldContact),
    newContact: publicContact(result.newContact),
  };
}

module.exports = {
  transferLenderPortal,
  TransferLenderPortalError,
};
