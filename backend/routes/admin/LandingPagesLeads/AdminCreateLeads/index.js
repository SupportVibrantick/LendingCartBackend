const create = require("./create");
const list = require("./list");
const update = require("./update");
const remove = require("./delete");
const syncGhl = require("./syncGhl");

module.exports = async function (fastify) {
  fastify.register(create);
  fastify.register(list);
  fastify.register(update);
  fastify.register(remove);
  fastify.register(syncGhl);
};
