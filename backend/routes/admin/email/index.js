module.exports = async function (fastify) {
  const emailController = require("../../../modules/email/email.controller");

  fastify.post("/send", emailController.sendEmail);
  fastify.register(require("./outbox"));
};