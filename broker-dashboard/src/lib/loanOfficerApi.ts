export const LO_API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
export const LO_TOKEN_KEY = "loan_officer_token";
export const LO_USER_KEY = "loan_officer_user";

export const getLoanOfficerToken = () => sessionStorage.getItem(LO_TOKEN_KEY);

export const loAuthHeaders = (json = true) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getLoanOfficerToken()}`,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
};
