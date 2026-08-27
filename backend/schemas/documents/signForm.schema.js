const { z } = require("zod");
const { getSignFormLimits } = require("../../services/documents/signForm/limits");

/** PDF-point rectangle. Origin is bottom-left (pdf-lib). */
const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const fieldOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  rect: rectSchema.optional(),
});

const fieldTypeSchema = z.enum([
  "text",
  "number",
  "currency",
  "date",
  "email",
  "phone",
  "checkbox",
  "radio",
  "dropdown",
  "signature",
  "initial",
  "textarea",
]);

const fillRoleSchema = z.enum(["client", "broker", "either", "readonly"]);

const signFormFieldSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
    message: "Field key must be alphanumeric with underscores",
  }),
  label: z.string().min(1),
  type: fieldTypeSchema,
  page: z.number().int().positive(),
  rect: rectSchema,
  required: z.boolean().default(false),
  placeholder: z.string().optional().nullable(),
  defaultValue: z.any().optional().nullable(),
  options: z.array(fieldOptionSchema).optional().nullable(),
  fillRole: fillRoleSchema.default("either"),
  validation: z
    .object({
      minLength: z.number().int().nonnegative().optional(),
      maxLength: z.number().int().positive().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional()
    .nullable(),
  group: z
    .object({
      id: z.string().min(1),
      label: z.string().optional(),
      exclusive: z.boolean().optional(),
    })
    .optional()
    .nullable(),
  meta: z
    .object({
      confidence: z.number().min(0).max(1).optional(),
      source: z
        .enum([
          "manual",
          "acroform",
          "azure_layout",
          "pdf_text",
          "tesseract",
          "free_ocr",
          "llm",
          "llm_refined",
        ])
        .optional(),
      detectedLabel: z.string().optional().nullable(),
      locked: z.boolean().optional(),
      llmRefined: z.boolean().optional(),
      replacedSource: z.string().optional().nullable(),
      tableId: z.string().optional(),
      rowIndex: z.number().int().nonnegative().optional(),
      columnKey: z.string().optional(),
    })
    .passthrough()
    .optional()
    .nullable(),
});

const pageManifestItemSchema = z.object({
  page: z.number().int().positive(),
  widthPt: z.number().positive(),
  heightPt: z.number().positive(),
  imageUrl: z.string().optional().nullable(),
  rotation: z.number().int().optional().default(0),
});

const detectionReportSchema = z
  .object({
    ranAt: z.string().optional(),
    fieldCount: z.number().int().nonnegative().optional(),
    replaceExisting: z.boolean().optional(),
    providers: z
      .array(
        z.object({
          provider: z.string(),
          skipped: z.boolean().optional(),
          note: z.string().nullable().optional(),
          fieldCount: z.number().int().nonnegative().optional(),
          error: z.string().nullable().optional(),
        }),
      )
      .optional(),
    capabilities: z
      .object({
        azureConfigured: z.boolean().optional(),
        llmConfigured: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough()
  .optional()
  .nullable();

const tableColumnSchema = z.object({
  key: z.string().min(1).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().min(1),
  type: fieldTypeSchema.optional().default("text"),
});

const tableSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  page: z.number().int().positive(),
  columns: z.array(tableColumnSchema).min(1).max(12),
  rows: z.number().int().min(1).max(20),
  originRect: rectSchema,
  cellWidth: z.number().positive().optional(),
  cellHeight: z.number().positive().optional(),
});

const signFormSchemaJsonSchema = z
  .object({
    schemaVersion: z.literal(1),
    pages: z.array(pageManifestItemSchema).min(1),
    fields: z.array(signFormFieldSchema),
    conditionals: z
      .array(
        z.object({
          when: z.object({
            field: z.string().min(1),
            equals: z.any(),
          }),
          show: z.array(z.string()).optional(),
          require: z.array(z.string()).optional(),
        }),
      )
      .optional()
      .default([]),
    tables: z.array(tableSchema).optional().default([]),
    detection: detectionReportSchema,
  })
  .superRefine((schema, ctx) => {
    const limits = getSignFormLimits();
    if (schema.pages.length > limits.maxPages) {
      ctx.addIssue({
        code: "custom",
        message: `Forms can have at most ${limits.maxPages} pages`,
        path: ["pages"],
      });
    }
    if (schema.fields.length > limits.maxFields) {
      ctx.addIssue({
        code: "custom",
        message: `Forms can have at most ${limits.maxFields} fields`,
        path: ["fields"],
      });
    }
    if ((schema.conditionals || []).length > limits.maxConditionals) {
      ctx.addIssue({
        code: "custom",
        message: `Forms can have at most ${limits.maxConditionals} conditionals`,
        path: ["conditionals"],
      });
    }
    if ((schema.tables || []).length > limits.maxTables) {
      ctx.addIssue({
        code: "custom",
        message: `Forms can have at most ${limits.maxTables} tables`,
        path: ["tables"],
      });
    }
  });

const saveSignFormDraftSchema = z.object({
  schema: signFormSchemaJsonSchema,
  pageManifest: z.array(pageManifestItemSchema).optional(),
});

const analyzeSignFormSchema = z.object({
  replaceExisting: z.boolean().optional().default(false),
  useAzure: z.boolean().optional().default(true),
  useLlm: z.boolean().optional().default(true),
  useFreeOcr: z.boolean().optional().default(true),
});

const submitSignFormSchema = z.object({
  loanApplicationId: z.string().uuid().optional(),
  values: z.record(z.string(), z.any()),
  complete: z.boolean().optional().default(true),
});

const saveSignFormValuesSchema = z.object({
  values: z.record(z.string(), z.any()),
  complete: z.boolean().optional().default(false),
  loanApplicationId: z.string().uuid().optional(),
});

const saveAsTemplateSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(500).optional().nullable(),
});

const updateLibraryTemplateSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(["PUBLISHED", "ARCHIVED"]).optional(),
});

const applyLibraryTemplateSchema = z.object({
  templateId: z.string().uuid(),
  documentName: z.string().min(1).max(160).optional(),
});

module.exports = {
  rectSchema,
  fieldOptionSchema,
  fieldTypeSchema,
  fillRoleSchema,
  signFormFieldSchema,
  pageManifestItemSchema,
  detectionReportSchema,
  tableColumnSchema,
  tableSchema,
  signFormSchemaJsonSchema,
  saveSignFormDraftSchema,
  analyzeSignFormSchema,
  submitSignFormSchema,
  saveSignFormValuesSchema,
  saveAsTemplateSchema,
  updateLibraryTemplateSchema,
  applyLibraryTemplateSchema,
};
