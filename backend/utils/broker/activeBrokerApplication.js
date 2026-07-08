const ACTIVE_APPLICATION_INCLUDE = {
  products: {
    where: { isActive: true },
    include: {
      sections: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          sortOrder: true,
        },
      },
      fields: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          fieldKey: true,
          label: true,
          fieldType: true,
          placeholder: true,
          isRequired: true,
          options: true,
          validation: true,
          sortOrder: true,
          sectionId: true,
        },
      },
    },
  },
  broker: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

async function fetchActiveBrokerApplication(prisma, brokerOrgId) {
  return prisma.brokerApplication.findFirst({
    where: {
      brokerOrgId,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
    include: ACTIVE_APPLICATION_INCLUDE,
  });
}

function formatActiveApplicationResponse(application) {
  if (!application) {
    return null;
  }

  return {
    applicationId: application.id,
    applicationName: application.name,
    brokerOrgId: application.brokerOrgId,
    brokerName: application.broker?.name || null,
    brokerEmail: application.broker?.email || null,
    products: application.products.map((product) => {
      const sections = product.sections.map((section) => ({
        sectionId: section.id,
        sectionName: section.name,
        description: section.description,
        sortOrder: section.sortOrder,
        fields: product.fields
          .filter((field) => field.sectionId === section.id)
          .map((field) => ({
            fieldId: field.id,
            fieldKey: field.fieldKey,
            label: field.label,
            type: field.fieldType,
            placeholder: field.placeholder,
            required: field.isRequired,
            options: field.options,
            validation: field.validation,
            sortOrder: field.sortOrder,
          })),
      }));

      const unsectionedFields = product.fields
        .filter((field) => field.sectionId === null)
        .map((field) => ({
          fieldId: field.id,
          fieldKey: field.fieldKey,
          label: field.label,
          type: field.fieldType,
          placeholder: field.placeholder,
          required: field.isRequired,
          options: field.options,
          validation: field.validation,
          sortOrder: field.sortOrder,
        }));

      return {
        productId: product.id,
        loanProductCode: product.loanProductCode,
        sections,
        unsectionedFields,
      };
    }),
  };
}

module.exports = {
  fetchActiveBrokerApplication,
  formatActiveApplicationResponse,
};
