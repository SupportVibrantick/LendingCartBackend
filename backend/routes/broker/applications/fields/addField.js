module.exports = async function addField(fastify) {
  fastify.post("/products/:productId/fields", async (req, reply) => {
    const { productId } = req.params;

    const {
      sectionId,
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
       (EXPLICIT & SAFE)
    =============================== */
    const allowedFieldTypes = [
      // BASIC
      "TEXT",
      "TEXTAREA",
      "NUMBER",
      "EMAIL",
      "PHONE",
      "PASSWORD",
      "DATE",
      "TIME",
      "DATETIME",

      // SELECTION
      "SELECT",
      "MULTI_SELECT",
      "RADIO",
      "CHECKBOX",
      "CHECKBOX_GROUP",

      // BOOLEAN
      "BOOLEAN",
      "TOGGLE",

      // FILE / MEDIA
      "FILE",
      "FILE_MULTIPLE",
      "IMAGE",
      "SIGNATURE",

      // NUMERIC SPECIAL
      "CURRENCY",
      "PERCENTAGE",
      "SLIDER",
      "RANGE",

      // LOCATION
      "COUNTRY",
      "STATE",
      "CITY",
      "ZIPCODE",
      "ADDRESS",
      "GEOLOCATION",

      // BUSINESS / FINANCE
      "SSN",
      "PAN",
      "GST",
      "EIN",
      "TAN",
      "IFSC",
      "BANK_ACCOUNT",

      // ADVANCED
      "AUTOCOMPLETE",
      "TAGS",
      "RICH_TEXT",
      "OTP",
      "CAPTCHA",
    ];

    if (!allowedFieldTypes.includes(fieldType)) {
      return reply.code(400).send({
        success: false,
        message: `Invalid fieldType: ${fieldType}`,
      });
    }

    /* ===============================
       3. VERIFY SECTION (IF PROVIDED)
    =============================== */
    if (sectionId) {
      const section =
        await fastify.prisma.brokerApplicationSection.findFirst({
          where: {
            id: sectionId,
            applicationProductId: productId,
            isActive: true,
          },
          select: { id: true },
        });

      if (!section) {
        return reply.code(404).send({
          success: false,
          message: "Section not found for this product",
        });
      }
    }

    /* ===============================
       4. OPTION-BASED TYPES
    =============================== */
    const optionBasedTypes = [
      "SELECT",
      "MULTI_SELECT",
      "RADIO",
      "CHECKBOX_GROUP",
      "AUTOCOMPLETE",
    ];

    let normalizedOptions = null;

    if (optionBasedTypes.includes(fieldType)) {
      if (!options) {
        return reply.code(400).send({
          success: false,
          message: `${fieldType} field requires options`,
        });
      }

      normalizedOptions =
        Array.isArray(options)
          ? options
          : typeof options === "string"
          ? options.split(",").map(o => o.trim()).filter(Boolean)
          : null;

      if (!normalizedOptions || normalizedOptions.length === 0) {
        return reply.code(400).send({
          success: false,
          message: "Invalid options",
        });
      }
    }

    /* ===============================
       5. PLACEHOLDER SUPPORT
    =============================== */
    const placeholderSupportedTypes = [
      "TEXT",
      "TEXTAREA",
      "NUMBER",
      "EMAIL",
      "PHONE",
      "PASSWORD",
      "CURRENCY",
      "PERCENTAGE",
    ];

    const normalizedPlaceholder =
      placeholderSupportedTypes.includes(fieldType)
        ? placeholder || null
        : null;

    /* ===============================
       6. SAVE FIELD
    =============================== */
    const field =
      await fastify.prisma.brokerApplicationProductField.create({
        data: {
          applicationProductId: productId,
          sectionId: sectionId || null,
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

    return reply.code(201).send({
      success: true,
      data: field,
    });
  });
};
