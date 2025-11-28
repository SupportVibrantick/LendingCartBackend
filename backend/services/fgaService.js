// backend/services/fgaService.js
const { OpenFgaClient } = require("@openfga/sdk");
const openfgaConfig = require("../config/openfga.js");

// create a client: if your config/openfga.js exports client, require it
// assume config/openfga.js exports { fgaClient } or client info
const fgaClient = openfgaConfig.fgaClient || openfgaConfig;

async function assignRoleToUser(userId, roleName) {
  // write tuple: object role:<roleName> relation member -> user:<userId>
  // SDK method names vary by versions — adapt if needed
  const tuple = {
    tuple_key: {
      user: `user:${userId}`,
      relation: "member",
      object: `role:${roleName}`
    }
  };

  // some SDKs use write(), some use writeTuples or something similar
  // try fgaClient.write or fgaClient.writeTuples depending on your SDK
  if (typeof fgaClient.write === "function") {
    await fgaClient.write({
      writes: [
        {
          tuple_key: tuple.tuple_key
        }
      ]
    });
  } else if (typeof fgaClient.writeTuples === "function") {
    await fgaClient.writeTuples([tuple.tuple_key]);
  } else if (typeof fgaClient.add === "function") {
    // fallback: sdk-specific
    await fgaClient.add([tuple.tuple_key]);
  } else {
    throw new Error("OpenFGA client does not have a recognized write API method");
  }

  return true;
}

async function getUserRolesFromFGA(userId) {
  // Many SDKs expose `read` or `listRelations` — adapt if needed.
  // Try listRelations first; if not available, try read or query tuples.
  if (typeof fgaClient.listRelations === "function") {
    const response = await fgaClient.listRelations({
      user: `user:${userId}`
    });
    return response.relations || [];
  }

  if (typeof fgaClient.read === "function") {
    // SDK-specific; attempt to read tuples for this user
    const response = await fgaClient.read({ /* sdk-specific params */ });
    // transform to role names if possible — this may need adjustment
    const tuples = response.tuples || [];
    return tuples.filter(t => t.object && t.object.startsWith("role:")).map(t => t.object.split(":")[1]);
  }

  // fallback: return empty
  return [];
}

async function checkPermission(userId, object, relation) {
  if (typeof fgaClient.check === "function") {
    const res = await fgaClient.check({
      user: `user:${userId}`,
      relation,
      object
    });
    return !!res?.allowed;
  }

  throw new Error("OpenFGA client does not support check() in this SDK version");
}

module.exports = {
  assignRoleToUser,
  getUserRolesFromFGA,
  checkPermission,
  fgaClient
};
