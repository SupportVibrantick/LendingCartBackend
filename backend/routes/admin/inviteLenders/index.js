const inviteLenderRoutes = require("./invite");
const listLenderInvitesRoutes = require("./list");
const resendLenderInviteRoutes = require("./resend");
const cancelLenderInviteRoutes = require("./cancel");
const deleteLenderInviteRoutes = require("./delete");
const bulkValidateLenderInvitesRoutes = require("./bulkValidate");
const bulkInviteLenderRoutes = require("./bulkInvite");
const {
  bulkTemplateCsvRoutes,
  exportInvitesCsvRoutes,
} = require("./csv");

async function lendersRoutes(fastify) {
  fastify.register(listLenderInvitesRoutes);
  fastify.register(bulkTemplateCsvRoutes);
  fastify.register(exportInvitesCsvRoutes);
  fastify.register(bulkValidateLenderInvitesRoutes);
  fastify.register(bulkInviteLenderRoutes);
  fastify.register(inviteLenderRoutes, {
    prefix: "/invite",
  });
  fastify.register(resendLenderInviteRoutes);
  fastify.register(cancelLenderInviteRoutes);
  fastify.register(deleteLenderInviteRoutes);
}

module.exports = lendersRoutes;
