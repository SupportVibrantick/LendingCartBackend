const { getJwtSecret } = require("../../config/env");

/** Shared JWT secret — sign and verify must use the same value. */
module.exports = getJwtSecret();
