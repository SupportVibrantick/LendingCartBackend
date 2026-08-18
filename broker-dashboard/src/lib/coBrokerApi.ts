import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

// function getAuthHeaders(): Record<string, string> {
//   const token = sessionStorage.getItem("broker_token");
//   return token ? { Authorization: `Bearer ${token}` } : {};
// }

export type LoanTypeOption = {
  value: string;
  text: string;
};

export type CoBrokerLoanOfficerOption = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  profileImage?: string | null;
};

export async function fetchCoBrokerLoanTypes(): Promise<LoanTypeOption[]> {
  const res = await fetch(`${API_BASE}/common/loan-products/loan-product-code`);
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load loan types");
  }

  return (json.data || []).map((product: { code: string; name: string }) => ({
    value: product.code,
    text: product.name || product.code.replace(/_/g, " "),
  }));
}

export async function fetchCoBrokerLoanOfficers(): Promise<CoBrokerLoanOfficerOption[]> {

  const token = sessionStorage.getItem("loan_officer_token");

  if (!token) {
    toast.error("Unauthorized!");
    return [];
  }
  const res = await fetch(`${API_BASE}/broker/sub-broker/loan-officers`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load loan officers");
  }

  return json.data || [];
}
