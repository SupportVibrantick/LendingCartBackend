// backend/services/auth/fgaService.js
const { fgaClient } = require("../../config/openfga");

/**
 * Assign role to a user inside OpenFGA
 * @param {string} userId 
 * @param {string} roleName (PLATFORM_ADMIN, BROKER_ADMIN etc)
 */
async function assignRoleToUser(userId, roleName) {
  if (!userId || !roleName) {
    throw new Error("assignRoleToUser called without userId or roleName");
  }

  return fgaClient.write({
    writes: [
      {
        user: `user:${userId}`,
        relation: "member",
        object: `role:${roleName}`,
      },
    ],
  });
}

/**
 * Check permission for a user on an object
 */
async function checkPermission(userId, object, relation) {
  const result = await fgaClient.check({
    tuple_key: {
      user: `user:${userId}`,
      relation,
      object,
    },
  });
  return result.allowed === true;
}

/**
 * Fetch FGA roles of a user
 */
async function getUserRolesFromFGA(userId) {
  const res = await fgaClient.listObjects({
    type: "role",
    relation: "member",
    user: `user:${userId}`,
  });

  return res.objects; // ["role:PLATFORM_ADMIN", "role:BROKER_ADMIN"]
}

module.exports = { assignRoleToUser, checkPermission, getUserRolesFromFGA };
