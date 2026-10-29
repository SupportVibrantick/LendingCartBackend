const LOGO_TOO_LARGE =
  "Your logo is too large to upload. Please use a smaller image (under 2 MB) or compress it, then try again.";

const SESSION_OR_PERMISSION =
  "Your session expired or you don’t have permission to update branding. Please sign in again.";

const SERVER_BUSY =
  "We couldn’t save your branding right now. Please try again in a moment.";

const LOAD_FAILED =
  "We couldn’t load your branding settings. Please refresh the page and try again.";

function looksLikePayloadTooLarge(text: string): boolean {
  return /request body is too large|payload too large|entity too large|413/i.test(
    text,
  );
}

/**
 * Map branding API failures to short, actionable toast copy.
 */
export function mapBrandingApiError(options: {
  status: number;
  serverMessage?: string | null;
  bodyText?: string | null;
  action?: "load" | "save";
}): string {
  const action = options.action || "save";
  const fallback =
    action === "load"
      ? LOAD_FAILED
      : "We couldn’t save your branding. Please check your logo and company name, then try again.";

  const serverMessage = String(options.serverMessage || "").trim();
  const bodyText = String(options.bodyText || "").trim();

  if (
    options.status === 413 ||
    looksLikePayloadTooLarge(serverMessage) ||
    looksLikePayloadTooLarge(bodyText)
  ) {
    return LOGO_TOO_LARGE;
  }

  if (options.status === 401 || options.status === 403) {
    return SESSION_OR_PERMISSION;
  }

  if (options.status === 400 || options.status === 422) {
    if (serverMessage && !/internal server error/i.test(serverMessage)) {
      return serverMessage;
    }
    return "Please check your company name and logo, then try again.";
  }

  if (options.status >= 500) {
    if (looksLikePayloadTooLarge(serverMessage)) return LOGO_TOO_LARGE;
    return SERVER_BUSY;
  }

  if (
    serverMessage &&
    !/internal server error|an error occurred/i.test(serverMessage)
  ) {
    return serverMessage;
  }

  return fallback;
}

/**
 * Read a branding API Response once and return parsed JSON + friendly error text.
 */
export async function readBrandingApiResponse(
  res: Response,
  action: "load" | "save" = "save",
): Promise<{
  ok: boolean;
  json: any | null;
  errorMessage: string | null;
}> {
  const contentType = res.headers.get("content-type") || "";
  let json: any | null = null;
  let bodyText = "";

  try {
    if (contentType.includes("application/json")) {
      json = await res.json();
    } else {
      bodyText = await res.text();
    }
  } catch {
    return {
      ok: false,
      json: null,
      errorMessage: mapBrandingApiError({
        status: res.status || 0,
        action,
      }),
    };
  }

  if (res.ok && json?.success !== false) {
    return { ok: true, json, errorMessage: null };
  }

  return {
    ok: false,
    json,
    errorMessage: mapBrandingApiError({
      status: res.status,
      serverMessage: json?.message,
      bodyText,
      action,
    }),
  };
}
