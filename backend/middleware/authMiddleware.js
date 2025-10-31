// middleware/authMiddleware.js
require("dotenv").config();

const jwt = require("jsonwebtoken");
const jwtSecret = process.env.JWT_SECRET || "SecretKey";

const logger = require("../services/logger/contextLogger");

// Fastify compatible version
const verifyToken = async (request, reply) => {
  const token = request.headers["authorization"]?.split(" ")[1];

  if (!token) {
    logger.commonLogs.error("No token provided", {
      endpoint: request.url,
      method: request.method,
    });
    reply.status(401).send({ message: "No token provided" });
    // Throwing an error after sending a response is generally not needed
    // Fastify will stop the handler chain if you send a response in a preHandler hook
    return; // Explicitly return to avoid further execution if needed
  }

  try {
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, jwtSecret, (err, decodedToken) => {
        if (err) {
          reject(err);
        } else {
          resolve(decodedToken);
        }
      });
    });

    request.user = { id: decoded.id, role: decoded.role }; // Use request.user convention
  } catch (err) {
    logger.commonLogs.error("Invalid or expired token", {
      endpoint: request.url,
      method: request.method,
    });
    reply.status(401).send({ message: "Invalid or expired token" });
    throw err; // Throw to stop the handler chain
  }
};

// Fastify compatible version
const authorizeRoles = (allowedRoles = []) => {
  return async (request, reply) => {
    const userRole = request.user?.role; // Access role from request.user
    if (!userRole || !allowedRoles.includes(userRole)) {
      logger.commonLogs.warn("Access denied due to insufficient role", {
        endpoint: request.url,
        method: request.method,
        role: userRole,
      });

      reply.status(403).send({ message: "Access denied: Unauthorized role" });
      throw new Error("Unauthorized role"); // Throw to stop the handler chain
    }
    // If role is valid, just continue by returning or not throwing
  };
};

module.exports = { verifyToken, authorizeRoles };