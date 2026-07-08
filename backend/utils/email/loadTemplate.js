const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const { getEmailBranding } = require("../email/emailBranding");

let partialsRegistered = false;

const registerPartials = () => {
  if (partialsRegistered) return;

  const partialsDir = path.join(__dirname, "../templates/partials");
  if (!fs.existsSync(partialsDir)) {
    partialsRegistered = true;
    return;
  }

  fs.readdirSync(partialsDir).forEach((file) => {
    if (!file.endsWith(".html")) return;
    const partialName = path.basename(file, ".html");
    const partialPath = path.join(partialsDir, file);
    Handlebars.registerPartial(
      partialName,
      fs.readFileSync(partialPath, "utf8"),
    );
  });

  partialsRegistered = true;
};

Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("neq", (a, b) => a !== b);
Handlebars.registerHelper("and", (a, b) => a && b);
Handlebars.registerHelper("or", (a, b) => a || b);
Handlebars.registerHelper("not", (a) => !a);
Handlebars.registerHelper("default", (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return value;
});

const templateCache = new Map();

const loadTemplate = (templateName, data = {}) => {
  registerPartials();

  const templatePath = path.join(
    __dirname,
    "../templates",
    `${templateName}.html`,
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templateName}`);
  }

  if (!templateCache.has(templateName)) {
    const templateContent = fs.readFileSync(templatePath, "utf8");
    templateCache.set(templateName, Handlebars.compile(templateContent));
  }

  const template = templateCache.get(templateName);
  const branding = getEmailBranding();

  return template({
    ...branding,
    ...data,
  });
};

module.exports = { loadTemplate };
