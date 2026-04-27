module.exports = async function (fastify, opts) {
  const emailController = require("../../../modules/email/email.controller");

  fastify.post("/send", emailController.sendEmail);
};