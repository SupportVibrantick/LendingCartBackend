const create = require("./create");
const list = require("./list");
module.exports = async function (fastify) {
  fastify.register(create);
  fastify.register(list);
};
