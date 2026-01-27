module.exports = async function addField(fastify) {
  fastify.post("/products/:productId/fields", async (req, reply) => {
    const { productId } = req.params;
    const { brokerOrgId } = req.body;

    const {
      fieldKey,
      label,
      placeholder,
      fieldType,
      isRequired = false,
      options,
      validation,
      sortOrder,
    } = req.body;

    /* ===============================
       0. ADMIN CONTEXT VALIDATION
    =============================== */

    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId is required",
      });
    }

    /* ===============================
       1. HARD VALIDATIONS
    =============================== */

    if (!fieldKey || !label || !fieldType) {
      return reply.code(400).send({
        success: false,
        message: "fieldKey, label and fieldType are required",
      });
    }

    /* ===============================
       2. VERIFY OWNERSHIP (ADMIN SAFETY)
    =============================== */

    const product = await fastify.prisma.brokerApplicationProduct.findFirst({
      where: {
        id: productId,
        brokerApplication: {
  brokerOrgId,
},
      },
      select: { id: true },
    });

    if (!product) {
      return reply.code(404).send({
        success: false,
        message: "Product not found for this broker",
      });
    }

    /* ===============================
       3. FIELD TYPE VALIDATION
    =============================== */

    const allowedFieldTypes = [
      "TEXT",
      "TEXTAREA",
      "NUMBER",
      "EMAIL",
      "DATE",
      "SELECT",
      "FILE",
      "BOOLEAN",
    ];

    if (!allowedFieldTypes.includes(fieldType)) {
      return reply.code(400).send({
        success: false,
        message: "Invalid fieldType",
      });
    }

    /* ===============================
       4. NORMALIZE OPTIONS (SELECT)
    =============================== */

    let normalizedOptions = null;

    if (fieldType === "SELECT") {
      if (!options) {
        return reply.code(400).send({
          success: false,
          message: "SELECT field requires options",
        });
      }

      normalizedOptions =
        typeof options === "string"
          ? options.split(",").map(o => o.trim()).filter(Boolean)
          : Array.isArray(options)
          ? options
          : null;

      if (!normalizedOptions || normalizedOptions.length === 0) {
        return reply.code(400).send({
          success: false,
          message: "Invalid dropdown options",
        });
      }
    }

    /* ===============================
       5. PLACEHOLDER RULE
    =============================== */

    const allowedPlaceholderTypes = [
      "TEXT",
      "TEXTAREA",
      "NUMBER",
      "EMAIL",
    ];

    const normalizedPlaceholder = allowedPlaceholderTypes.includes(fieldType)
      ? placeholder || null
      : null;

    /* ===============================
       6. SAVE FIELD
    =============================== */

    const field = await fastify.prisma.brokerApplicationProductField.create({
      data: {
        applicationProductId: productId,
        fieldKey,
        label,
        fieldType,
        placeholder: normalizedPlaceholder,
        isRequired: Boolean(isRequired),
        options: normalizedOptions,
        validation: validation || {},
        sortOrder: sortOrder ?? null,
      },
    });

    reply.send({
      success: true,
      data: field,
    });
  });
};
