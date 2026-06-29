import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type LoanProduct = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
};

const getColor = (name: string) => {
  const colors = [
    "bg-orange-500",
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-yellow-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-red-500",
    "bg-cyan-500",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

function getAuthHeaders(
  tokenStorageKey = "admin_token",
): Record<string, string> {
  try {
    const token = sessionStorage.getItem(tokenStorageKey);
    if (token) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }
  } catch {
    /* ignore */
  }
  return { "Content-Type": "application/json" };
}

type StepTwoProps = {
  value: string[];
  setValue: (value: string[]) => void;
  mode?: "admin" | "lender";
  onProductsLoad?: (products: LoanProduct[]) => void;
};

const StepTwo = ({
  value,
  setValue,
  mode = "admin",
  onProductsLoad,
}: StepTwoProps) => {
  const safeValue = Array.isArray(value) ? value : [];
  const [products, setProducts] = useState<LoanProduct[]>([]);

  const toggle = (id: string) => {
    const current = Array.isArray(value) ? value : [];

    const next = current.includes(id)
      ? current.filter((i: string) => i !== id)
      : [...current, id];

    setValue(next);
  };

  const fetchLoanProducts = async () => {
    try {
      const isLenderMode = mode === "lender";
      const endpoint = isLenderMode
        ? `${API_BASE}/common/loan-products/loan-product-code`
        : `${API_BASE}/admin/loan-products/list`;

      const res = await fetch(endpoint, {
        method: "GET",
        headers: getAuthHeaders(isLenderMode ? "lender_token" : "admin_token"),
      });

      if (!res.ok) {
        console.error("Failed to load loan products:", res.status);
        return;
      }

      const json = await res.json();
      if (!isLenderMode && !json.success) {
        console.error("Failed to load loan products:", json.message);
        return;
      }

      const items = (
        isLenderMode ? json.data || json : json.data || []
      ) as any[];

      const mapped: LoanProduct[] = items.map((p) => ({
        id: String(p.id),
        code: p.code,
        name: p.name ?? p.code ?? "",
        description: p.description ?? "",
        isActive: Boolean(p.isActive),
        createdAt: p.createdAt ?? undefined,
      }));

      setProducts(mapped);
      onProductsLoad?.(mapped);
    } catch (err) {
      console.error("Failed to load loan products", err);
      toast.error("Failed to load loan products");
    }
  };

  useEffect(() => {
    fetchLoanProducts();
  }, [mode]);

  return (
    <div className="border border-gray-200 rounded-2xl p-6 shadow-sm bg-white">
      {value?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {products
            .filter((p) => value.includes(p.id))
            .slice(0, 5)
            .map((p) => (
              <span
                key={p.id}
                className="text-xs bg-gray-100 px-2 py-1 rounded-full"
              >
                {p.name}
              </span>
            ))}

          {value.length > 5 && (
            <span className="text-xs text-gray-500">
              +{value.length - 5} more
            </span>
          )}
        </div>
      )}

      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Loan Programs Offered
            {value?.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2.5 py-0.5 rounded-full font-medium">
                {value.length} selected
              </span>
            )}
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Select which loan programs you want to add.
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm mt-1">
          <button
            onClick={() => setValue(products.map((p) => p.id))}
            className="text-blue-600 font-medium hover:underline disabled:text-gray-300"
            disabled={value?.length === products.length}
          >
            Select All
          </button>

          <button
            onClick={() => setValue([])}
            className="text-red-500 font-medium hover:underline disabled:text-gray-300"
            disabled={!value?.length}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2">
        {products.map((item) => {
          const isChecked = safeValue.includes(item.id);

          return (
            <label
              key={item.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-all duration-200 border
  ${
    isChecked
      ? "border-blue-500 bg-blue-50 shadow-sm scale-[1.01]"
      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
  }`}
            >
              <input
                type="checkbox"
                checked={safeValue.includes(item.id)}
                onChange={() => toggle(item.id)}
                className="cursor-pointer"
              />

              <span
                className={`w-2.5 h-2.5 rounded-full ${getColor(
                  item.name,
                )} shadow-sm ring-2 ring-white`}
              />

              <span className="text-xs">{item.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default StepTwo;
