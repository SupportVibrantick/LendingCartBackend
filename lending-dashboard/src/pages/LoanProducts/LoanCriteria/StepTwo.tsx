import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { filterLenderCatalogProducts } from "../../../lib/lenderLoanProducts";

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
  lockedIds?: string[];
  alreadyAddedIds?: string[];
  description?: string;
  restrictToProductIds?: string[];
  singleProductMode?: boolean;
  prefetchedProducts?: LoanProduct[];
};

const StepTwo = ({
  value,
  setValue,
  mode = "admin",
  onProductsLoad,
  lockedIds = [],
  alreadyAddedIds = [],
  description,
  restrictToProductIds,
  singleProductMode = false,
  prefetchedProducts,
}: StepTwoProps) => {
  const safeValue = Array.isArray(value) ? value : [];
  const lockedSet = new Set(lockedIds);
  const alreadyAddedSet = new Set(alreadyAddedIds);
  const [products, setProducts] = useState<LoanProduct[]>([]);

  const restrictSet = new Set(restrictToProductIds || []);
  const visibleProducts =
    restrictToProductIds?.length
      ? products.filter((product) => restrictSet.has(product.id))
      : products;

  const selectableProducts = visibleProducts.filter(
    (product) => !alreadyAddedSet.has(product.id),
  );

  const toggle = (id: string) => {
    if (alreadyAddedSet.has(id)) return;

    const current = Array.isArray(value) ? value : [];

    if (lockedSet.has(id) && current.includes(id)) {
      return;
    }

    const next = current.includes(id)
      ? current.filter((i: string) => i !== id)
      : [...current, id];

    setValue(next);
  };

  const handleClear = () => {
    if (lockedIds.length > 0) {
      setValue([...lockedIds]);
      return;
    }
    setValue([]);
  };

  const handleSelectAll = () => {
    const nextIds = [
      ...new Set([...lockedIds, ...selectableProducts.map((p) => p.id)]),
    ];
    setValue(nextIds);
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

      const finalProducts = isLenderMode
        ? filterLenderCatalogProducts(mapped)
        : mapped;

      setProducts(finalProducts);
      onProductsLoad?.(finalProducts);
    } catch (err) {
      console.error("Failed to load loan products", err);
      toast.error("Failed to load loan products");
    }
  };

  useEffect(() => {
    if (prefetchedProducts?.length) {
      setProducts(prefetchedProducts);
      onProductsLoad?.(prefetchedProducts);
      return;
    }

    fetchLoanProducts();
  }, [mode, prefetchedProducts]);

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
            {description ||
              (singleProductMode
                ? "You are updating this loan program only."
                : alreadyAddedIds.length > 0
                  ? "Already added programs are disabled. Select new programs to add."
                  : lockedIds.length > 0
                    ? "Existing programs stay selected. You can add more programs, but cannot remove current ones."
                    : "Select which loan programs you want to add.")}
          </p>
        </div>

        {!singleProductMode && (
          <div className="flex items-center gap-4 text-sm mt-1">
            <button
              onClick={handleSelectAll}
              className="text-blue-600 font-medium hover:underline disabled:text-gray-300"
              disabled={
                selectableProducts.length === 0 ||
                selectableProducts.every((p) => safeValue.includes(p.id))
              }
            >
              Select All
            </button>

            <button
              onClick={handleClear}
              className="text-red-500 font-medium hover:underline disabled:text-gray-300"
              disabled={!value?.length || value.length === lockedIds.length}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2">
        {visibleProducts.map((item) => {
          const isAlreadyAdded = alreadyAddedSet.has(item.id);
          const isChecked = safeValue.includes(item.id) && !isAlreadyAdded;
          const isLocked = lockedSet.has(item.id) && isChecked;

          return (
            <label
              key={item.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 border
  ${
    isAlreadyAdded
      ? "cursor-not-allowed border-amber-200 bg-amber-50/70 opacity-80"
      : isLocked
        ? "cursor-not-allowed border-emerald-200 bg-emerald-50/80"
        : "cursor-pointer"
  }
  ${
    isChecked
      ? isLocked
        ? "shadow-sm"
        : "border-blue-500 bg-blue-50 shadow-sm scale-[1.01]"
      : isAlreadyAdded
        ? ""
        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
  }`}
            >
              <input
                type="checkbox"
                checked={isChecked || isAlreadyAdded}
                disabled={isLocked || isAlreadyAdded}
                onChange={() => toggle(item.id)}
                className={`${
                  isLocked || isAlreadyAdded
                    ? "cursor-not-allowed opacity-70"
                    : "cursor-pointer"
                }`}
              />

              <span
                className={`w-2.5 h-2.5 rounded-full ${getColor(
                  item.name,
                )} shadow-sm ring-2 ring-white`}
              />

              <span className="flex-1 text-xs">{item.name}</span>

              {isAlreadyAdded ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                  Already Added
                </span>
              ) : isLocked ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                  Active
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default StepTwo;
