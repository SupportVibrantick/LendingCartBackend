module.exports = async function updateField(fastify) {
  fastify.patch("/fields/:fieldId", async (req, reply) => {
    const { fieldId } = req.params;
    const { brokerOrgId, ...raw } = req.body;

    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId is required",
      });
    }

    const existing =
      await fastify.prisma.brokerApplicationProductField.findFirst({
        where: {
          id: fieldId,
          applicationProduct: {
            brokerApplication: {
              brokerOrgId,
            },
          },
        },
        select: { id: true, fieldType: true },
      });

    if (!existing) {
      return reply.code(404).send({
        success: false,
        message: "Field not found for this broker",
      });
    }

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

    const data = {};

    if (raw.fieldKey !== undefined) data.fieldKey = raw.fieldKey;
    if (raw.label !== undefined) data.label = raw.label;
    if (raw.isRequired !== undefined) data.isRequired = Boolean(raw.isRequired);
    if (raw.sortOrder !== undefined) data.sortOrder = raw.sortOrder;

    if (raw.fieldType !== undefined) {
      if (!allowedFieldTypes.includes(raw.fieldType)) {
        return reply.code(400).send({
          success: false,
          message: "Invalid fieldType",
        });
      }
      data.fieldType = raw.fieldType;
    }

    const fieldType = data.fieldType || existing.fieldType;

    const allowedPlaceholderTypes = ["TEXT", "TEXTAREA", "NUMBER", "EMAIL"];
    if (raw.placeholder !== undefined) {
      data.placeholder = allowedPlaceholderTypes.includes(fieldType)
        ? raw.placeholder || null
        : null;
    }

    if (raw.validation !== undefined) {
      data.validation = raw.validation || {};
    }

    if (raw.options !== undefined) {
      if (fieldType === "SELECT") {
        const normalizedOptions =
          typeof raw.options === "string"
            ? raw.options.split(",").map((o) => o.trim()).filter(Boolean)
            : Array.isArray(raw.options)
              ? raw.options
              : null;

        if (!normalizedOptions || normalizedOptions.length === 0) {
          return reply.code(400).send({
            success: false,
            message: "SELECT field requires options",
          });
        }

        data.options = normalizedOptions;
      } else {
        data.options = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({
        success: false,
        message: "No valid fields to update",
      });
    }

    const updated = await fastify.prisma.brokerApplicationProductField.update({
      where: { id: fieldId },
      data,
    });

    reply.send({ success: true, data: updated });
  });
};
