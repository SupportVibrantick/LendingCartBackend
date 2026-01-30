module.exports = async function updateField(fastify) {
  fastify.patch(
    "/products/:productId/fields/:fieldId",
    async (req, reply) => {
      const { productId, fieldId } = req.params;

      let {
        sectionId,      //explicitly supported
        fieldKey,
        label,
        placeholder,
        fieldType,
        isRequired,
        options,
        validation,
        sortOrder,
      } = req.body;

      /* ===============================
         1. FETCH EXISTING FIELD
      =============================== */
      const existingField =
        await fastify.prisma.brokerApplicationProductField.findFirst({
          where: {
            id: fieldId,
            applicationProductId: productId,
          },
        });

      if (!existingField) {
        return reply.code(404).send({
          success: false,
          message: "Field not found",
        });
      }

      /* ===============================
         2. FIELD TYPE VALIDATION (IF PROVIDED)
      =============================== */
      const allowedFieldTypes = [
        "TEXT", "TEXTAREA", "NUMBER", "EMAIL", "PHONE", "PASSWORD",
        "DATE", "TIME", "DATETIME",

        "SELECT", "MULTI_SELECT", "RADIO", "CHECKBOX", "CHECKBOX_GROUP",

        "BOOLEAN", "TOGGLE",

        "FILE", "FILE_MULTIPLE", "IMAGE", "SIGNATURE",

        "CURRENCY", "PERCENTAGE", "SLIDER", "RANGE",

        "COUNTRY", "STATE", "CITY", "ZIPCODE", "ADDRESS", "GEOLOCATION",

        "SSN", "PAN", "GST", "EIN", "TAN", "IFSC", "BANK_ACCOUNT",

        "AUTOCOMPLETE", "TAGS", "RICH_TEXT", "OTP", "CAPTCHA",
      ];

      if (fieldType && !allowedFieldTypes.includes(fieldType)) {
        return reply.code(400).send({
          success: false,
          message: `Invalid fieldType: ${fieldType}`,
        });
      }

      /* ===============================
         3. VERIFY SECTION (EXPLICIT)
      =============================== */
      if (sectionId !== undefined && sectionId !== null) {
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
         4. PREVENT DUPLICATE FIELD KEY
      =============================== */
      if (fieldKey) {
        fieldKey = fieldKey.trim();

        const duplicate =
          await fastify.prisma.brokerApplicationProductField.findFirst({
            where: {
              applicationProductId: productId,
              fieldKey,
              NOT: { id: fieldId },
            },
            select: { id: true },
          });

        if (duplicate) {
          return reply.code(409).send({
            success: false,
            message: `Field with key '${fieldKey}' already exists`,
          });
        }
      }

      /* ===============================
         5. OPTION-BASED TYPES
      =============================== */
      const optionBasedTypes = [
        "SELECT",
        "MULTI_SELECT",
        "RADIO",
        "CHECKBOX_GROUP",
        "AUTOCOMPLETE",
      ];

      const finalFieldType = fieldType || existingField.fieldType;
      let normalizedOptions = existingField.options;

      if (optionBasedTypes.includes(finalFieldType)) {
        if (options !== undefined) {
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
      } else {
        normalizedOptions = null;
      }

      /* ===============================
         6. PLACEHOLDER SUPPORT
      =============================== */
      const placeholderSupportedTypes = [
        "TEXT", "TEXTAREA", "NUMBER", "EMAIL",
        "PHONE", "PASSWORD", "CURRENCY", "PERCENTAGE",
      ];

      const normalizedPlaceholder =
        placeholderSupportedTypes.includes(finalFieldType)
          ? placeholder ?? existingField.placeholder
          : null;

      /* ===============================
         7. UPDATE FIELD
      =============================== */
      const updatedField =
        await fastify.prisma.brokerApplicationProductField.update({
          where: { id: fieldId },
          data: {
            sectionId:
              sectionId !== undefined
                ? sectionId // ✅ can be UUID or null
                : existingField.sectionId,

            fieldKey: fieldKey ?? existingField.fieldKey,
            label: label ?? existingField.label,
            fieldType: finalFieldType,
            placeholder: normalizedPlaceholder,
            isRequired:
              isRequired !== undefined
                ? Boolean(isRequired)
                : existingField.isRequired,
            options: normalizedOptions,
            validation:
              validation !== undefined
                ? validation
                : existingField.validation,
            sortOrder:
              sortOrder !== undefined
                ? sortOrder
                : existingField.sortOrder,
          },
        });

      return reply.send({
        success: true,
        data: updatedField,
      });
    }
  );
};
