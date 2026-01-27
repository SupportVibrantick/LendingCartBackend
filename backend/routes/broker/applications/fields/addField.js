module.exports = async function addField(fastify) {
  fastify.post("/products/:productId/fields", async (req, reply) => {
    const { productId } = req.params;

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
       1. HARD VALIDATIONS
    =============================== */

    if (!fieldKey || !label || !fieldType) {
      return reply.code(400).send({
        success: false,
        message: "fieldKey, label and fieldType are required",
      });
    }

    /* ===============================
       2. FIELD TYPE VALIDATION
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
       3. NORMALIZE OPTIONS (SELECT)
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
       4. PLACEHOLDER RULE
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
       5. SAVE FIELD
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
