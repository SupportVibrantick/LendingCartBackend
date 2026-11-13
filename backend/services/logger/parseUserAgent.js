/**
 * Lightweight user-agent parser (no extra dependency).
 * @param {string|null|undefined} ua
 */
function parseUserAgent(ua) {
  const raw = String(ua || "").trim();
  if (!raw) {
    return {
      browser: "Unknown",
      os: "Unknown",
      device: "Unknown",
      userAgent: null,
    };
  }

  let browser = "Unknown";
  if (/edg\//i.test(raw)) browser = "Edge";
  else if (/chrome\//i.test(raw) && !/edg\//i.test(raw)) browser = "Chrome";
  else if (/firefox\//i.test(raw)) browser = "Firefox";
  else if (/safari\//i.test(raw) && !/chrome\//i.test(raw)) browser = "Safari";
  else if (/msie|trident/i.test(raw)) browser = "IE";

  let os = "Unknown";
  if (/windows nt/i.test(raw)) os = "Windows";
  else if (/android/i.test(raw)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(raw)) os = "iOS";
  else if (/mac os x/i.test(raw)) os = "macOS";
  else if (/linux/i.test(raw)) os = "Linux";

  let device = "Desktop";
  if (/ipad|tablet/i.test(raw)) device = "Tablet";
  else if (/mobi|iphone|android(?!.*tablet)/i.test(raw)) device = "Mobile";

  return {
    browser,
    os,
    device,
    userAgent: raw.slice(0, 500),
  };
}

module.exports = { parseUserAgent };
