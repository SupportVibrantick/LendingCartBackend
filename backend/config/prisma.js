// backend/config/prisma.js
// CommonJS Prisma client wrapper

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" }, // optional: useful for dev
    { level: "info", emit: "event" },
    { level: "warn", emit: "event" },
    { level: "error", emit: "event" },
  ],
});

// optional: bind logs to console (only dev)
prisma.$on("query", (e) => {
  // console.log(`Prisma Query: ${e.query} ${e.params} (${e.duration}ms)`);
});
prisma.$on("error", (e) => {
  console.error("Prisma error:", e);
});

module.exports = prisma;
