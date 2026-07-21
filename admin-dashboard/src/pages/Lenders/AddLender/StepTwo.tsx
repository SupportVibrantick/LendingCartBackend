import { useEffect, useMemo, useState } from "react";
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

function getAuthHeaders(): Record<string, string> {
  try {
    const token = sessionStorage.getItem("admin_token");
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

const StepTwo = ({ value, setValue }: any) => {
  const safeValue = Array.isArray(value) ? value : [];
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const filteredProducts = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (!query) {
      return products;
    }

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.code.toLowerCase().includes(query) ||
        String(product.description || "")
          .toLowerCase()
          .includes(query),
    );
  }, [products, searchInput]);

  const toggle = (id: string) => {
    const current = Array.isArray(value) ? value : [];

    const next = current.includes(id)
      ? current.filter((i: string) => i !== id)
      : [...current, id];

    setValue(next);
  };

  const handleSelectAll = () => {
    const nextIds = [
      ...new Set([
        ...safeValue,
        ...filteredProducts.map((product) => product.id),
      ]),
    ];
    setValue(nextIds);
  };

  const handleClearAll = () => {
    setValue([]);
  };

  const fetchLoanProducts = async () => {
    try {
      setLoadingList(true);

      const res = await fetch(`${API_BASE}/admin/loan-products/list`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        console.error("Failed to load loan products:", res.status);
        return;
      }

      const json = await res.json();
      if (!json.success) {
        console.error("Failed to load loan products:", json.message);
        return;
      }

      const items = (json.data || []) as any[];
      const mapped: LoanProduct[] = items.map((p) => ({
        id: String(p.id),
        code: p.code,
        name: p.name ?? p.code ?? "",
        description: p.description ?? "",
        isActive: Boolean(p.isActive),
        createdAt: p.createdAt ?? undefined,
      }));

      setProducts(mapped);
    } catch (err) {
      console.error("Failed to load loan products", err);
      toast.error("Failed to load loan products");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchLoanProducts();
  }, []);

  return (
    <div className="border border-gray-200 rounded-2xl p-6 shadow-sm bg-white">
      {safeValue.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {products
            .filter((p) => safeValue.includes(p.id))
            .slice(0, 5)
            .map((p) => (
              <span
                key={p.id}
                className="text-xs bg-gray-100 px-2 py-1 rounded-full"
              >
                {p.name}
              </span>
            ))}

          {safeValue.length > 5 && (
            <span className="text-xs text-gray-500">
              +{safeValue.length - 5} more
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Loan Programs Offered
            {safeValue.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2.5 py-0.5 rounded-full font-medium">
                {safeValue.length} selected
              </span>
            )}
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Select which loan programs this lender offers.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-4 text-sm">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-blue-600 font-medium hover:underline disabled:text-gray-300"
              disabled={
                filteredProducts.length === 0 ||
                filteredProducts.every((p) => safeValue.includes(p.id)) ||
                loadingList
              }
            >
              Select All
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="text-red-500 font-medium hover:underline disabled:text-gray-300"
              disabled={!safeValue.length || loadingList}
            >
              Clear All
            </button>
          </div>

          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, code..."
            className="w-full sm:w-64 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {loadingList ? (
        <div className="py-10 text-center text-sm text-gray-500">
          Loading products...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          {searchInput.trim()
            ? `No loan products found for "${searchInput.trim()}".`
            : "No loan products found."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2">
          {filteredProducts.map((item) => {
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
                  checked={isChecked}
                  onChange={() => toggle(item.id)}
                  className="cursor-pointer"
                />

                <span
                  className={`w-2.5 h-2.5 rounded-full ${getColor(
                    item.name,
                  )} shadow-sm ring-2 ring-white`}
                />

                <span className="flex-1 text-xs">{item.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StepTwo;
