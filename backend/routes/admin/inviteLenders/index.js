const inviteLenderRoutes = require("./invite");
const listLenderInvitesRoutes = require("./list");
const resendLenderInviteRoutes = require("./resend");
const cancelLenderInviteRoutes = require("./cancel");
const deleteLenderInviteRoutes = require("./delete");

async function lendersRoutes(fastify) {
  fastify.register(listLenderInvitesRoutes);
  fastify.register(inviteLenderRoutes, {
    prefix: "/invite",
  });
  fastify.register(resendLenderInviteRoutes);
  fastify.register(cancelLenderInviteRoutes);
  fastify.register(deleteLenderInviteRoutes);
}

module.exports = lendersRoutes;
