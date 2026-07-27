const { PrismaClient } = require("@prisma/client");

let prisma;

if (!global.__prisma) {
  global.__prisma = new PrismaClient({
    log: ["error"], // keep this minimal in prod
  });
}

prisma = global.__prisma;

module.exports = prisma;

