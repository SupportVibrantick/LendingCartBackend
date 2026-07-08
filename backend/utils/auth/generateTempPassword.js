const crypto = require("crypto");

/**
 * Generates a random password that satisfies broker password rules.
 */
function generateTempPassword(length = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const pick = (chars) => chars[crypto.randomInt(chars.length)];

  const required = [pick(upper), pick(lower), pick(digits), pick(special)];
  const all = upper + lower + digits + special;

  while (required.length < length) {
    required.push(pick(all));
  }

  for (let i = required.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [required[i], required[j]] = [required[j], required[i]];
  }

  return required.join("");
}

module.exports = { generateTempPassword };
