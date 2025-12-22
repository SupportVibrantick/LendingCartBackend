// backend/routes/lender/eligibility/index.js

const createRuleSetRoutes = require("./createRuleSet");
const listRuleSetsRoutes = require("./listRuleSets");

const createRuleRoutes = require("./createRule");
const listRulesRoutes = require("./listRules");
const updateRuleRoutes = require("./updateRule");
const updateRuleSetRoutes = require("./updateRuleSet");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderEligibilityRoutes(fastify) {
  // -------------------------
  // Rule Sets (containers)
  // -------------------------
  fastify.register(createRuleSetRoutes, { prefix: "/rule-sets" });
  fastify.register(listRuleSetsRoutes, { prefix: "/rule-sets" });

  // // -------------------------
  // // Individual Rules
  // // -------------------------
  fastify.register(createRuleRoutes, { prefix: "/rules" });
  fastify.register(listRulesRoutes, { prefix: "/rules" });
  fastify.register(updateRuleRoutes, { prefix: "/rules" });
  fastify.register(updateRuleSetRoutes,{prefix:"/rules-set"});
}

module.exports = lenderEligibilityRoutes;
