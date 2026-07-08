const { randomUUID } = require("crypto");
const {
  LENDER_TEAM_ASSIGNABLE_ROLES,
} = require("../../utils/lender/lenderTeamRoles");

const LENDER_TEAM_ROLE_ENUMS = ["LENDER_ANALYST", "LENDER_VIEWER"];

async function ensureLenderTeamRoleEnums(prisma) {
  for (const roleName of LENDER_TEAM_ROLE_ENUMS) {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TYPE "RoleName" ADD VALUE '${roleName}';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }
}

async function findRoleRecord(prisma, roleName) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT id::text AS id, name::text AS name
      FROM roles
      WHERE name::text = $1
      LIMIT 1
    `,
    roleName,
  );

  return rows?.[0] || null;
}

async function createRoleRecord(prisma, roleName) {
  const roleId = randomUUID();
  const rows = await prisma.$queryRawUnsafe(
    `
      INSERT INTO roles (id, name, description)
      VALUES ($1::uuid, $2::"RoleName", $3)
      RETURNING id::text AS id, name::text AS name
    `,
    roleId,
    roleName,
    roleName.replaceAll("_", " "),
  );

  return rows?.[0] || null;
}

async function ensureLenderTeamRole(prisma, roleName) {
  if (!LENDER_TEAM_ASSIGNABLE_ROLES.includes(roleName)) {
    const error = new Error("Invalid lender team role");
    error.code = "INVALID_ROLE";
    throw error;
  }

  await ensureLenderTeamRoleEnums(prisma);

  const existingRole = await findRoleRecord(prisma, roleName);
  if (existingRole) {
    return existingRole;
  }

  const createdRole = await createRoleRecord(prisma, roleName);
  if (!createdRole) {
    const error = new Error("Failed to configure lender team role");
    error.code = "ROLE_SETUP_FAILED";
    throw error;
  }

  return createdRole;
}

module.exports = {
  ensureLenderTeamRole,
};
