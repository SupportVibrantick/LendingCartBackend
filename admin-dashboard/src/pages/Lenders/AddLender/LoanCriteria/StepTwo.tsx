import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { filterLenderCatalogProducts } from "../../../../lib/canonicalLoanProducts";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const ITEMS_PER_PAGE = 24;
const SEARCH_DEBOUNCE_MS = 400;

type LoanProduct = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
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
};

const StepTwo = ({
  value,
  setValue,
  mode = "admin",
  onProductsLoad,
  lockedIds = [],
  alreadyAddedIds = [],
  description,
}: StepTwoProps) => {
  const safeValue = Array.isArray(value) ? value : [];
  const lockedSet = new Set(lockedIds);
  const alreadyAddedSet = new Set(alreadyAddedIds);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [productNameById, setProductNameById] = useState<
    Record<string, string>
  >({});
  const [allKnownProducts, setAllKnownProducts] = useState<LoanProduct[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const filterProductsBySearch = useCallback(
    (source: LoanProduct[], searchQuery: string) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return source;

      return source.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.code.toLowerCase().includes(query) ||
          String(product.description || "")
            .toLowerCase()
            .includes(query),
      );
    },
    [],
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

  const fetchAllLoanProductsForAdmin = useCallback(
    async (searchQuery: string): Promise<LoanProduct[]> => {
      const allProducts: LoanProduct[] = [];
      let page = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const params = new URLSearchParams({
          page: String(page),
          limit: "100",
        });
        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }

        const res = await fetch(
          `${API_BASE}/admin/loan-products/list?${params.toString()}`,
          {
            method: "GET",
            headers: getAuthHeaders("admin_token"),
          },
        );

        if (!res.ok) {
          throw new Error("Failed to load loan products");
        }

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.message || "Failed to load loan products");
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

        allProducts.push(...filterLenderCatalogProducts(mapped));
        hasNextPage = Boolean(json.pagination?.hasNextPage);
        page += 1;
      }

      return allProducts;
    },
    [],
  );

  const handleSelectAll = async () => {
    try {
      setSelectingAll(true);

      const allProducts =
        mode === "lender"
          ? filterProductsBySearch(allKnownProducts, debouncedSearch)
          : await fetchAllLoanProductsForAdmin(debouncedSearch);

      mergeKnownProducts(allProducts);

      const selectableIds = allProducts
        .filter((product) => !alreadyAddedSet.has(product.id))
        .map((product) => product.id);

      setValue([
        ...new Set([...lockedIds, ...safeValue, ...selectableIds]),
      ]);
    } catch (err) {
      console.error("Failed to select all loan products", err);
      toast.error("Failed to select all loan products");
    } finally {
      setSelectingAll(false);
    }
  };

  const mergeKnownProducts = useCallback(
    (incoming: LoanProduct[]) => {
      setAllKnownProducts((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        incoming.forEach((p) => byId.set(p.id, p));
        const merged = Array.from(byId.values());
        onProductsLoad?.(merged);
        return merged;
      });

      setProductNameById((prev) => {
        const next = { ...prev };
        incoming.forEach((p) => {
          next[p.id] = p.name;
        });
        return next;
      });
    },
    [onProductsLoad],
  );

  const applyClientPagination = useCallback(
    (source: LoanProduct[], pageNo: number, searchQuery: string) => {
      const filtered = filterProductsBySearch(source, searchQuery);

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
      const safePage = Math.min(Math.max(1, pageNo), totalPages);
      const start = (safePage - 1) * ITEMS_PER_PAGE;
      const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

      setProducts(pageItems);
      setPagination({
        page: safePage,
        limit: ITEMS_PER_PAGE,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1,
      });

      if (safePage !== pageNo) {
        setCurrentPage(safePage);
      }
    },
    [filterProductsBySearch],
  );

  const fetchLoanProducts = useCallback(
    async (pageNo = currentPage, searchQuery = debouncedSearch) => {
      try {
        setLoadingList(true);
        const isLenderMode = mode === "lender";

        if (isLenderMode) {
          const res = await fetch(
            `${API_BASE}/common/loan-products/loan-product-code`,
            {
              method: "GET",
              headers: getAuthHeaders("lender_token"),
            },
          );

          if (!res.ok) {
            console.error("Failed to load loan products:", res.status);
            return;
          }

          const json = await res.json();
          const items = (json.data || json || []) as any[];
          const mapped: LoanProduct[] = items.map((p) => ({
            id: String(p.id),
            code: p.code,
            name: p.name ?? p.code ?? "",
            description: p.description ?? "",
            isActive: Boolean(p.isActive ?? true),
            createdAt: p.createdAt ?? undefined,
          }));

          const finalProducts = filterLenderCatalogProducts(mapped);
          mergeKnownProducts(finalProducts);
          applyClientPagination(finalProducts, pageNo, searchQuery);
          return;
        }

        const params = new URLSearchParams({
          page: String(pageNo),
          limit: String(ITEMS_PER_PAGE),
        });
        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }

        const res = await fetch(
          `${API_BASE}/admin/loan-products/list?${params.toString()}`,
          {
            method: "GET",
            headers: getAuthHeaders("admin_token"),
          },
        );

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

        const finalProducts = filterLenderCatalogProducts(mapped);
        setProducts(finalProducts);
        mergeKnownProducts(finalProducts);

        const meta = json.pagination || {};
        const total = Number(meta.total) || finalProducts.length;
        const limit = Number(meta.limit) || ITEMS_PER_PAGE;
        const page = Number(meta.page) || pageNo;
        const totalPages = Math.max(
          1,
          Number(meta.totalPages) || Math.ceil(total / limit) || 1,
        );

        setPagination({
          page,
          limit,
          total,
          totalPages,
          hasNextPage: Boolean(meta.hasNextPage ?? page < totalPages),
          hasPreviousPage: Boolean(meta.hasPreviousPage ?? page > 1),
        });

        if (page !== pageNo) {
          setCurrentPage(page);
        }
      } catch (err) {
        console.error("Failed to load loan products", err);
        toast.error("Failed to load loan products");
      } finally {
        setLoadingList(false);
      }
    },
    [
      applyClientPagination,
      currentPage,
      debouncedSearch,
      mergeKnownProducts,
      mode,
    ],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchLoanProducts(currentPage, debouncedSearch);
  }, [currentPage, debouncedSearch, fetchLoanProducts, mode]);

  const showingFrom =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1;
  const showingTo = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  const selectedCount = safeValue.filter(
    (id) => !alreadyAddedSet.has(id),
  ).length;

  const selectedChips = safeValue
    .filter((id) => !alreadyAddedSet.has(id))
    .map((id) => ({
      id,
      name:
        productNameById[id] ||
        allKnownProducts.find((p) => p.id === id)?.name ||
        id,
    }));

  const selectableTotal = Math.max(0, pagination.total - alreadyAddedIds.length);
  const allSelectableSelected =
    selectableTotal > 0 && selectedCount >= selectableTotal;

  return (
    <div className="border border-gray-200 rounded-2xl p-6 shadow-sm bg-white">
      {selectedChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedChips.slice(0, 5).map((p) => (
            <span
              key={p.id}
              className="text-xs bg-gray-100 px-2 py-1 rounded-full"
            >
              {p.name}
            </span>
          ))}

          {selectedChips.length > 5 && (
            <span className="text-xs text-gray-500">
              +{selectedChips.length - 5} more
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2 flex-wrap">
            Loan Programs Offered
            {selectedCount > 0 && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2.5 py-0.5 rounded-full font-medium">
                {selectedCount} selected
              </span>
            )}
            {alreadyAddedIds.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium">
                {alreadyAddedIds.length} already assigned
              </span>
            )}
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            {description ||
              (alreadyAddedIds.length > 0
                ? "Already assigned programs are disabled. Select new programs to add."
                : lockedIds.length > 0
                  ? "Existing programs stay selected. You can add more programs, but cannot remove current ones."
                  : "Select which loan programs you want to add.")}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-4 text-sm">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-blue-600 font-medium hover:underline disabled:text-gray-300"
              disabled={
                selectableTotal === 0 ||
                allSelectableSelected ||
                loadingList ||
                selectingAll
              }
            >
              {selectingAll ? "Selecting..." : "Select All"}
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="text-red-500 font-medium hover:underline disabled:text-gray-300"
              disabled={!value?.length || value.length === lockedIds.length}
            >
              Clear
            </button>
          </div>

          <input
            type="search"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by name, code..."
            className="w-full sm:w-64 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {loadingList ? (
        <div className="py-10 text-center text-sm text-gray-500">
          Loading products...
        </div>
      ) : products.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          {debouncedSearch
            ? `No loan products found for "${debouncedSearch}".`
            : "No loan products found."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {products.map((item) => {
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
                    Already Assigned
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
      )}

      {pagination.total > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-5">
          <p className="text-sm text-gray-500">
            Showing {showingFrom}-{showingTo} of {pagination.total}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={!pagination.hasPreviousPage || loadingList}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Prev
            </button>

            {Array.from({ length: pagination.totalPages }).map((_, i) => {
              const page = i + 1;

              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  disabled={loadingList}
                  className={`px-3 py-1.5 text-sm rounded-md border ${
                    currentPage === page
                      ? "bg-[#13538A] text-white border-[#13538A]"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() =>
                setCurrentPage((p) => Math.min(p + 1, pagination.totalPages))
              }
              disabled={!pagination.hasNextPage || loadingList}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepTwo;
