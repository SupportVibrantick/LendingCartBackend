import { useEffect, useMemo, useState } from "react";
import MessageBox from "./MessageBox";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";


/* ------------------ TYPES ------------------ */
type ConnectedLender = {
    lenderId: string;
    lenderName: string;
    lenderEmail: string;
    connectedAt: string;
    profileUrl?: string | null;
};

type LenderProduct = {
    lenderProductId: string;
    loanProductCode: string;
    loanProductName: string;
    minLoanAmount: string;
    maxLoanAmount: string;
    termRange: string;
    regionsSupported: string;
    industriesSupported: string;
    isActive: boolean;
};

function parseJsonArray(value: string | null | undefined): string[] {
    if (!value) return [];
    try {
        const arr = JSON.parse(value);
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

/* ------------------ AUTH HEADERS ------------------ */
function getAuthHeaders() {
    const token = sessionStorage.getItem("broker_token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

/* ------------------ SKELETON ------------------ */
function TableSkeleton() {
    return (
        <div className="p-6 animate-pulse space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 dark:bg-slate-700 rounded" />
            ))}
        </div>
    );
}

/* ------------------ MAIN PAGE ------------------ */
export default function LenderProductsPage() {
    const [lenders, setLenders] = useState<ConnectedLender[]>([]);
    const [selectedLenderId, setSelectedLenderId] = useState<string>("");

    const [products, setProducts] = useState<LenderProduct[]>([]);
    const [loadingLenders, setLoadingLenders] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /* Search + Pagination */
    const [query, setQuery] = useState("");
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    /* ------------------ LOAD CONNECTED LENDERS ------------------ */
    async function fetchConnectedLenders() {
        setLoadingLenders(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/broker/lenders/connected`, {
                headers: getAuthHeaders(),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load lenders");
            }

            setLenders(Array.isArray(json.data) ? json.data : []);
        } catch (err: any) {
            setError(err.message || "Failed to load lenders");
        } finally {
            setLoadingLenders(false);
        }
    }

    /* ------------------ LOAD PRODUCTS ------------------ */
    async function fetchProducts(lenderId: string) {
        if (!lenderId) return;
        setLoadingProducts(true);
        setError(null);
        try {
            const res = await fetch(
                `${API_BASE}/broker/lenders/products/${lenderId}`,
                { headers: getAuthHeaders() }
            );

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load products");
            }

            setProducts(Array.isArray(json.data) ? json.data : []);
        } catch (err: any) {
            setError(err.message || "Failed to load products");
            setProducts([]);
        } finally {
            setLoadingProducts(false);
        }
    }

    useEffect(() => {
        fetchConnectedLenders();
    }, []);

    useEffect(() => {
        if (selectedLenderId) {
            fetchProducts(selectedLenderId);
        } else {
            setProducts([]);
        }
    }, [selectedLenderId]);

    /* ------------------ FILTER ------------------ */
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return products;
        return products.filter(
            (p) =>
                p.loanProductName.toLowerCase().includes(q) ||
                p.loanProductCode.toLowerCase().includes(q)
        );
    }, [products, query]);

    /* ------------------ PAGINATION ------------------ */
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    useEffect(() => {
        setCurrentPage(1);
    }, [query, pageSize]);

    const paginated = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    function gotoPage(p: number) {
        if (p < 1) p = 1;
        if (p > totalPages) p = totalPages;
        setCurrentPage(p);
    }

    /* ------------------ UI ------------------ */
    return (
        <div className="p-4 sm:p-6 text-gray-900 dark:text-gray-100">

            {/* Header */}
            <div className="mb-4">
                <h1 className="text-xl sm:text-2xl font-semibold">Lender Products</h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                    Select a lender to view their loan products
                </p>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">

                <select
                    value={selectedLenderId}
                    onChange={(e) => setSelectedLenderId(e.target.value)}
                    className="px-3 py-2 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-700"
                >
                    <option value="">Select Lender</option>
                    {lenders.map((l) => (
                        <option key={l.lenderId} value={l.lenderId}>
                            {l.lenderName}
                        </option>
                    ))}
                </select>

                <div className="flex gap-2">
                    <input
                        placeholder="Search product..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="px-3 py-2 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-700"
                    />

                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="px-2 py-2 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-700"
                    >
                        <option value={5}>5 / page</option>
                        <option value={10}>10 / page</option>
                        <option value={20}>20 / page</option>
                    </select>
                </div>
            </div>

            {/* Card */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">

                {loadingLenders || loadingProducts ? (
                    <TableSkeleton />
                ) : error ? (
                    <MessageBox
                        type="error"
                        title="Failed to load products"
                        description={error}
                    />
                ) : !selectedLenderId ? (
                    <MessageBox
                        type="info"
                        title="No lender selected"
                        description="Please select a lender from the dropdown to view products."
                    />
                ) : paginated.length === 0 ? (
                    <MessageBox
                        type="empty"
                        title="No products found"
                        description="This lender does not have any products yet."
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-[15px] table-fixed">
                                <thead className="bg-gray-50 dark:bg-slate-800 border-b dark:border-slate-700">
                                    <tr className="text-[13px] font-semibold uppercase text-gray-500 dark:text-slate-400">
                                        <th className="w-[9%] px-2 py-2 text-left">Code</th>
                                        <th className="w-[16%] px-2 py-2 text-left">Name</th>
                                        <th className="w-[8%] px-2 py-2 text-left">Min</th>
                                        <th className="w-[8%] px-2 py-2 text-left">Max</th>
                                        <th className="w-[10%] px-2 py-2 text-left">Tenure</th>
                                        <th className="w-[22%] px-2 py-2 text-left">Regions</th>
                                        <th className="w-[19%] px-2 py-2 text-left">Industries</th>
                                        <th className="w-[8%] px-2 py-2 text-left">Status</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {paginated.map((p) => {
                                        const regions = parseJsonArray(p.regionsSupported);
                                        const industries = parseJsonArray(p.industriesSupported);
     
                                        return (
                                            <tr
                                                key={p.lenderProductId}
                                                className="border-b dark:border-slate-800 align-top leading-tight"
                                            >
                                                <td className="w-[16%] px-3 py-2 font-medium">{p.loanProductCode}</td>
                                                <td className="w-[16%] px-3 py-2">{p.loanProductName}</td>
                                                <td className="w-[16%] px-3 py-2">{p.minLoanAmount}</td>
                                                <td className="w-[16%] px-3 py-2">{p.maxLoanAmount}</td>
                                                <td className="w-[16%] px-3 py-2">{p.termRange}</td>

                                                {/* Regions */}
                                                <td className="w-[16%] px-3 py-2">
                                                    {regions.length === 0 ? (
                                                        <span className="text-xs text-gray-400">—</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1 leading-tight">
                                                            {regions.map((r) => (
                                                                <span
                                                                    key={r}
                                                                    className="text-[12.5px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 whitespace-nowrap"
                                                                >
                                                                    {r}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Industries */}
                                                <td className="w-[16%] px-3 py-2">
                                                    {industries.length === 0 ? (
                                                        <span className="text-xs text-gray-400">—</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1 leading-tight">
                                                            {industries.map((i) => (
                                                                <span
                                                                    key={i}
                                                                    className="px-1.5 py-0.5 rounded text-[12.5px] bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 whitespace-nowrap"
                                                                >
                                                                    {i}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Status */}
                                                <td className="w-[8%] px-2 py-1.5">
                                                    <span
                                                        className={`px-1.5 py-0.5 rounded text-[12px] font-semibold ${p.isActive
                                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                                            : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                                                            }`}
                                                    >
                                                        {p.isActive ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                            </tr>

                                        );
                                    })}
                                </tbody>


                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-between items-center p-4 text-sm">
                            <div>
                                Showing {(currentPage - 1) * pageSize + 1} -{" "}
                                {Math.min(currentPage * pageSize, total)} of {total}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => gotoPage(currentPage - 1)}
                                    className="px-3 py-1 border rounded disabled:opacity-40 dark:border-slate-700"
                                >
                                    Prev
                                </button>
                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => gotoPage(currentPage + 1)}
                                    className="px-3 py-1 border rounded disabled:opacity-40 dark:border-slate-700"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
