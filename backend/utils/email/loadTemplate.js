const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { URL } = require("url");
const Handlebars = require("handlebars");
const { getEmailBranding } = require("../email/emailBranding");

const DEFAULT_LOGO_PATH = path.join(
  __dirname,
  "../../public/images/ACOM_LOGO.jpeg",
);
const DEFAULT_LOGO_CID = "lendingcart-logo@lendingcart";

const downloadImageBuffer = (url, timeoutMs = 5000) =>
  new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.get(
      url,
      { timeout: timeoutMs, headers: { "User-Agent": "LendingCart-Email/1.0" } },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          // Follow one redirect
          resolve(downloadImageBuffer(res.headers.location, timeoutMs));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("Logo download timeout"));
    });
    req.on("error", reject);
  });

let partialsRegistered = false;

const registerPartials = () => {
  if (partialsRegistered) return;

  const partialsDir = path.join(__dirname, "../../templates/partials");
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

const isUnreachableUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(url.trim());
};

const logoExists = () => {
  try {
    return fs.existsSync(DEFAULT_LOGO_PATH);
  } catch (err) {
    return false;
  }
};

const isAbsoluteHttpUrl = (url) =>
  typeof url === "string" && /^https?:\/\//i.test(url.trim());

const DATA_URI_RE =
  /^data:((?:image\/[a-zA-Z0-9.+-]+)?)(?:;charset=[a-zA-Z0-9-]+)?;base64,(.+)$/i;

const parseDataUri = (value) => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(DATA_URI_RE);
  if (!match) return null;
  const mime = (match[1] || "image/png").toLowerCase();
  const base64 = match[2];
  try {
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) return null;
    return { mime, buffer };
  } catch (err) {
    return null;
  }
};

const extFromMime = (mime) => {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpeg";
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  return "png";
};

const makeBrokerLogoAttachment = (buffer, mime) => {
  const cid = `broker-logo-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@lendingcart`;
  const ext = extFromMime(mime);
  return {
    logoUrl: `cid:${cid}`,
    logoAttachment: {
      filename: `broker-logo.${ext}`,
      content: buffer,
      cid,
      contentType: mime,
      contentDisposition: "inline",
    },
  };
};

/**
 * Resolve a usable inline logo + attachment for the email.
 * Returns { logoUrl, logoAttachment }.
 * - If brokerLogoUrl is a base64 data URI (image/...;base64,...),
 *   it is decoded and embedded as a per-render CID attachment.
 * - Else if brokerLogoUrl is an absolute HTTP(S) URL, it is
 *   downloaded and embedded as a per-render CID attachment.
 * - Otherwise the platform default local file is embedded via the
 *   shared DEFAULT_LOGO_CID.
 * - On any failure with the broker URL, falls back to the default.
 */
async function resolveLogoForEmail({ brokerLogoUrl } = {}) {
  // 1. Broker logo supplied as an inline data URI (base64)
  if (brokerLogoUrl) {
    const parsed = parseDataUri(brokerLogoUrl);
    if (parsed) {
      return makeBrokerLogoAttachment(parsed.buffer, parsed.mime);
    }
  }

  // 2. Broker logo supplied as a remote HTTP(S) URL
  if (brokerLogoUrl && isAbsoluteHttpUrl(brokerLogoUrl)) {
    try {
      const buffer = await downloadImageBuffer(brokerLogoUrl);
      const m =
        (brokerLogoUrl.match(/\.(png|jpe?g|gif|webp)(\?|$)/i) || [, "png"])[1]
          .toLowerCase();
      const mime =
        m === "jpg" || m === "jpeg"
          ? "image/jpeg"
          : m === "gif"
            ? "image/gif"
            : m === "webp"
              ? "image/webp"
              : "image/png";
      return makeBrokerLogoAttachment(buffer, mime);
    } catch (err) {
      // fall through to default
    }
  }

  // 3. Platform default
  if (!logoExists()) {
    return { logoUrl: "", logoAttachment: null };
  }

  return {
    logoUrl: `cid:${DEFAULT_LOGO_CID}`,
    logoAttachment: {
      filename: path.basename(DEFAULT_LOGO_PATH),
      path: DEFAULT_LOGO_PATH,
      cid: DEFAULT_LOGO_CID,
      contentType: "image/jpeg",
      contentDisposition: "inline",
    },
  };
}

/**
 * Look up the broker's white-label logo URL (if any) and resolve
 * a renderable inline logo for the email. Safe to call without
 * brokerOrgId — returns the platform default.
 */
async function resolveBrokerLogoForEmail(prisma, brokerOrgId) {
  if (prisma && brokerOrgId) {
    try {
      const settings = await prisma.brokerWhiteLabelSetting.findFirst({
        where: { brokerOrgId },
        select: { logoUrl: true },
      });
      if (settings?.logoUrl) {
        return resolveLogoForEmail({ brokerLogoUrl: settings.logoUrl });
      }
    } catch (err) {
      // fall through to default
    }
  }
  return resolveLogoForEmail({});
}

const renderWithLogo = (template, merged, resolved) => {
  if (resolved.logoUrl) {
    merged.logoUrl = resolved.logoUrl;
  }
  if (resolved.logoAttachment) {
    merged.logoAttachment = resolved.logoAttachment;
  }
  return template(merged);
};

const renderWithLogoAsync = (template, merged, resolved) => {
  if (resolved.logoUrl) {
    merged.logoUrl = resolved.logoUrl;
  }
  if (resolved.logoAttachment) {
    merged.logoAttachment = resolved.logoAttachment;
  }
  const html = template(merged);
  return { html, logoAttachment: resolved.logoAttachment || null };
};

const loadTemplate = (templateName, data = {}) => {
  registerPartials();

  const templatePath = path.join(
    __dirname,
    "../../templates",
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
  const merged = { ...branding, ...data };

  // Sync path: caller-supplied logoUrl or platform default CID only.
  // For per-broker white-label logos use loadTemplateAsync.
  if (!merged.logoUrl && logoExists()) {
    return renderWithLogo(template, merged, {
      logoUrl: `cid:${DEFAULT_LOGO_CID}`,
      logoAttachment: {
        filename: path.basename(DEFAULT_LOGO_PATH),
        path: DEFAULT_LOGO_PATH,
        cid: DEFAULT_LOGO_CID,
        contentType: "image/jpeg",
        contentDisposition: "inline",
      },
    });
  }

  if (merged.logoUrl && isUnreachableUrl(merged.logoUrl) && logoExists()) {
    return renderWithLogo(template, merged, {
      logoUrl: `cid:${DEFAULT_LOGO_CID}`,
      logoAttachment: {
        filename: path.basename(DEFAULT_LOGO_PATH),
        path: DEFAULT_LOGO_PATH,
        cid: DEFAULT_LOGO_CID,
        contentType: "image/jpeg",
        contentDisposition: "inline",
      },
    });
  }

  return template(merged);
};

/**
 * Async version of loadTemplate that resolves the broker's
 * white-label logo (downloading it if remote) before rendering.
 * Use this when the email is sent on behalf of a specific broker.
 *
 * Returns { html, logoAttachment } so the caller can attach the
 * logo alongside the email.
 */
const loadTemplateAsync = async (templateName, data = {}) => {
  registerPartials();

  const templatePath = path.join(
    __dirname,
    "../../templates",
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
  const merged = { ...branding, ...data };

  const resolved = await resolveBrokerLogoForEmail(
    merged.prisma,
    merged.brokerOrgId,
  );

  delete merged.prisma;
  delete merged.brokerOrgId;

  return renderWithLogoAsync(template, merged, resolved);
};

module.exports = {
  loadTemplate,
  loadTemplateAsync,
  resolveLogoForEmail,
  resolveBrokerLogoForEmail,
  DEFAULT_LOGO_PATH,
  DEFAULT_LOGO_CID,
};
