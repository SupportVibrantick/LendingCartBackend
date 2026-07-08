// backend/services/auth/authService.js
const prisma = require("../../config/prisma.js");
const { comparePassword } = require("../../utils/auth/password.js");

async function loginUser(email, password) {
  const user = await prisma.userAccount.findUnique({
    where: { email },
    include: {
      roles: { include: { role: true } },
      organization: true,
    },
  });

  if (!user) return null;

  const match = await comparePassword(password, user.passwordHash);
  if (!match) return null;

  return user;
}

module.exports = {
  loginUser,
};
