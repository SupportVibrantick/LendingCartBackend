function formatValidationIssue(issue) {
  const field = issue.path
    .join(".")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());

  const isString = issue.origin === "string";

  switch (issue.code) {
    case "too_big":
      return `${field} must be ${issue.inclusive ? "no more than" : "less than"} ${issue.maximum}${isString ? " characters" : ""}.`;

    case "too_small":
      return `${field} must be ${issue.inclusive ? "at least" : "more than"} ${issue.minimum}${isString ? " characters" : ""}.`;

    case "invalid_type":
      return `Please enter a valid ${field.toLowerCase()}.`;

    case "invalid_format":
      if (issue.format === "email") {
        return "Please enter a valid email address.";
      }

      if (issue.format === "regex" && issue.path[0] === "ssn") {
        return "SSN must be in the format XXX-XX-XXXX.";
      }

      if (issue.format === "date") {
        return "Please enter a valid date.";
      }

      return issue.message || `${field} is not in the correct format.`;

    case "invalid_value":
      return `Please select a valid ${field.toLowerCase()}.`;

    case "invalid_union": {
      const subMessages = issue.errors
        .flat()
        .map((e) => e.message)
        .filter((msg, i, arr) => arr.indexOf(msg) === i);

      return subMessages.length
        ? subMessages.join(" or ")
        : issue.message || `Please enter a valid ${field.toLowerCase()}.`;
    }

    default:
      return (
        issue.message || `Please correct the ${field.toLowerCase()} field.`
      );
  }
}

module.exports = {
  formatValidationIssue,
};
