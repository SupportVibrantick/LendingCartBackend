const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");

// Register required helpers
Handlebars.registerHelper("eq", function (a, b) {
  return a === b;
}); 

Handlebars.registerHelper("neq", function (a, b) {
  return a !== b;
});

Handlebars.registerHelper("and", function (a, b) {
  return a && b;
});

Handlebars.registerHelper("or", function (a, b) {
  return a || b;
});

Handlebars.registerHelper("not", function (a) {
  return !a;
});

// Load and compile email template
const loadTemplate = (templateName, data) => {
  const templatePath = path.join(
    __dirname,
    "../templates",
    `${templateName}.html`
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found at: ${templatePath}`);
  }

  const templateContent = fs.readFileSync(templatePath, "utf8");

  // Compile AFTER registering helpers
  const template = Handlebars.compile(templateContent);

  return template(data);
};

module.exports = { loadTemplate };