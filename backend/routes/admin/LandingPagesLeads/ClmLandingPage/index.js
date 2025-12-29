const list = require("./list");
const status = require("./status");
const del = require("./delete");
module.exports = async function (fastify) {
  fastify.register(list);
  fastify.register(status);
  fastify.register(del);
};
