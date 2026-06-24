/** Shared JWT secret — sign and verify must use the same value. */
module.exports = process.env.JWT_SECRET || "SecretKey";
