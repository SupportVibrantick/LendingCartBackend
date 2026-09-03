// backend/config/prisma.js
// CommonJS Prisma client wrapper

const { PrismaClient } = require("@prisma/client");

// Use a singleton pattern to prevent connection pool exhaustion
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production"
    ? ["error"]
    : [
        { level: "query", emit: "event" },
        { level: "info", emit: "event" },
        { level: "warn", emit: "event" },
        { level: "error", emit: "event" },
      ],
});

// optional: bind logs to console (only dev)
if (process.env.NODE_ENV !== "production") {
  prisma.$on("query", (e) => {
    // console.log(`Prisma Query: ${e.query} ${e.params} (${e.duration}ms)`);
  });
}

prisma.$on("error", (e) => {
  console.error("Prisma error:", e);
});

module.exports = prisma;
