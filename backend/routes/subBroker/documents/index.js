const requestDocumentRoute = require("./requestDocuments");
const submissionDocumentsRoute = require("./submissionDocuments");
const getSubmittedlendersRoute = require("./getSubmittedlenders");
const uploadSubmissionDocumentRoute = require("./uploadSubmissionDocument");
const sendToPrincipalBrokerRoute = require("./sendToPrincipalBroker");

async function documentsRoutes(fastify, options) {
  fastify.register(requestDocumentRoute);
  fastify.register(submissionDocumentsRoute);
  fastify.register(getSubmittedlendersRoute);
  fastify.register(uploadSubmissionDocumentRoute);
  fastify.register(sendToPrincipalBrokerRoute);
}

module.exports = documentsRoutes;
