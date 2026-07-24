export type LoiBrandingValues = {
  brandName: string;
  logoUrl: string;
};

export const EMPTY_LOI_BRANDING: LoiBrandingValues = {
  brandName: "",
  logoUrl: "",
};

export function isLoiBrandingComplete(branding: LoiBrandingValues) {
  return Boolean(branding.brandName.trim() && branding.logoUrl);
}

export function getLoiBrandingValidationMessage(branding: LoiBrandingValues) {
  if (!branding.brandName.trim()) {
    return "Enter your brand name for the term sheet header.";
  }
  if (!branding.logoUrl) {
    return "Upload your company logo for the term sheet header.";
  }
  return "";
}
