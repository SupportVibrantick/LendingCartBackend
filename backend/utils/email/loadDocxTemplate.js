const fs = require("fs");
const path = require("path");

/**
 * Load DOCX template from backend/templates
 * @param {string} templateName - example: "lender/loi/loi-template"
 * @returns {Buffer}
 */

function loadDocxTemplate(templateName) {
  const templatePath = path.join(
    process.cwd(),
    "templates",
    `${templateName}.docx`
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`DOCX template not found: ${templatePath}`);
  }

  return fs.readFileSync(templatePath);
}

module.exports = { loadDocxTemplate };