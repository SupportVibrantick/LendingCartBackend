import React from "react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

// type ProductItem = {
//   id: string;
//   brokerApplicationId: string;
//   loanProductCode: string;
//   isActive: boolean;
// };

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

// function getAuthHeaders() {
//       const token = sessionStorage.getItem("broker_token");
//     return {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//     };
// }

export default function GetLoanPage() {
    const [isBroker, setIsBroker] = useState(null);
    const [hasCoBorrower, setHasCoBorrower] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [products, setProducts] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState("");

    const activeProduct = products.find(
        (p) => p.productId === selectedProductId
    );

    async function safeJson(res) {
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            console.error("RAW RESPONSE:", text);
            throw new Error("Server returned invalid response.");
        }
    }

    const loadProducts = async () => {
        try {
            setLoadingProducts(true);
            setProducts([]);
            setSelectedProductId("");

            const res = await fetch(
                `${API_BASE}/public/broker/applications/active`,
                // { headers: getAuthHeaders() }
            );

            const json = await safeJson(res);
            if (!res.ok || json.success !== true) throw new Error(json.message);

            setProducts(json.data.products || []);
        } catch (err) {
            toast.error(err.message || "Failed to load products");
        } finally {
            setLoadingProducts(false);
        }
    };

    useEffect(() => {
        loadProducts();
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
            <div className="max-w-5xl mx-auto px-4">
                {/* Heading */}
                <h1 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-6">
                    This is our quick app to help us determine eligibility, available loan
                    options & structure various loan terms for you.
                </h1>

                {/* ================= CARD ================= */}
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-slate-200 dark:border-slate-800">
                    {/* ================= BROKER SECTION ================= */}
                    <SectionHeader title="Loan Officer / Broker" />

                    <div className="p-6 space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg flex items-center justify-between border border-slate-200 dark:border-slate-700">
                            <span className="font-medium text-sm text-slate-800 dark:text-slate-200">
                                Are you a Mortgage Broker OR working WITH ONE?
                            </span>

                            <div className="flex items-center gap-6">
                                <Radio
                                    label="Yes"
                                    checked={isBroker === true}
                                    onChange={() => setIsBroker(true)}
                                />
                                <Radio
                                    label="No"
                                    checked={isBroker === false}
                                    onChange={() => setIsBroker(false)}
                                />
                            </div>
                        </div>

                        {isBroker === false && (
                            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 text-sm">
                                Please ask your Mortgage Broker to submit this application for
                                you.
                            </div>
                        )}

                        {isBroker === true && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Email Address" />
                                    <Input label="Phone Number" placeholder="(___) ___-____" />
                                    <Input label="First Name" />
                                    <Input label="Last Name" />
                                    <Input label="Company Name" />
                                    <Input label="NMLS ID" />
                                </div>

                                <div className="h-px bg-slate-200 dark:bg-slate-700" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Select
                                        label="What kind of program are you looking for?"
                                        value={selectedProductId}
                                        onChange={(e) => setSelectedProductId(e.target.value)}
                                    >
                                        {!loadingProducts ? (
                                            <option value="">- Select -</option>
                                        ) : (
                                            <option value="">- Loading... -</option>
                                        )}

                                        {!loadingProducts &&
                                            products?.map((p) => (
                                                <option key={p.productId} value={p.productId}>
                                                    {p.loanProductCode}
                                                </option>
                                            ))}
                                    </Select>

                                    <Select label="Where are you in the process?" />
                                    <Select label="Lead Source" />
                                </div>
                            </>
                        )}
                    </div>

                    {/* ================= BORROWER INFO ================= */}
                    {isBroker && (
                        <>
                            <SectionHeader title="Borrower Info" />

                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="First Name" />
                                    <Input label="Last Name" />
                                    <Input label="Borrower Email" />
                                    <Input label="Cell Phone" placeholder="(___) ___-____" />
                                </div>

                                {/* Co Borrower Toggle */}
                                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Is there a Co-borrower?
                                    </span>
                                    <button
                                        onClick={() => setHasCoBorrower((p) => !p)}
                                        className={`w-12 h-6 rounded-full relative transition ${hasCoBorrower ? "bg-blue-600" : "bg-slate-300"
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${hasCoBorrower ? "right-0.5" : "left-0.5"
                                                }`}
                                        />
                                    </button>
                                </div>

                                {/* ================= PERSONAL INFO ================= */}
                                <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Personal Info
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Citizenship */}
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                                            Citizenship
                                        </label>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <Radio label="U.S. Citizen" name="citizen" />
                                            <Radio label="Perm Resident" name="citizen" />
                                            <Radio label="Non-Perm Resident" name="citizen" />
                                            <Radio label="Foreign National" name="citizen" />
                                        </div>
                                    </div>

                                    {/* Credit Score */}
                                    <Select label="Credit Score Range" />
                                </div>

                                {/* ================= PRODUCT DYNAMIC FIELDS ================= */}
                                {activeProduct &&
                                    activeProduct.fields &&
                                    activeProduct.fields.length > 0 && (
                                        <div className="mt-6">
                                            <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                                                Additional Information
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {activeProduct.fields.map((field) => (
                                                    <div key={field.fieldId} className="space-y-1">
                                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                            {field.label}
                                                            {field.required && (
                                                                <span className="text-red-500 ml-1">*</span>
                                                            )}
                                                        </label>
                                                        {renderField(field)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                            </div>
                        </>
                    )}

                    {/* ================= FOOTER ================= */}
                    <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                        <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold text-sm shadow">
                            Continue Application
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ================= COMPONENTS ================= */

function SectionHeader({ title }) {
    return (
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm flex items-center justify-between text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900">
            <span>{title}</span>
            <span className="text-blue-600 dark:text-blue-400">ⓘ</span>
        </div>
    );
}

function Input({ label, placeholder = "" }) {
    return (
        <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {label}
            </label>
            <input
                placeholder={placeholder}
                className="text-sm mt-1 w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );
}

function Select({ label, value, onChange, children }) {
    return (
        <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {label}
            </label>
            <select
                value={value}
                onChange={onChange}
                className="mt-1 w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {children}
            </select>
        </div>
    );
}

function Radio({ label, checked, onChange, name = "radio" }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
            <input type="radio" name={name} checked={checked} onChange={onChange} />
            {label}
        </label>
    );
}

const renderField = (field) => {
    const common =
        "w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700";

    const placeholder = field.placeholder || "";

    switch (field.type) {
        case "NUMBER":
            return (
                <input
                    type="number"
                    className={common}
                    required={field.required}
                    min={field.validation?.min}
                    max={field.validation?.max}
                    placeholder={placeholder}
                />
            );

        case "TEXT":
        case "EMAIL":
            return (
                <input
                    type="text"
                    className={common}
                    required={field.required}
                    placeholder={placeholder}
                />
            );

        case "FILE":
            return <input type="file" className={common} required={field.required} />;

        case "TEXTAREA":
            return (
                <textarea
                    className={common}
                    rows={4}
                    required={field.required}
                    placeholder={placeholder}
                />
            );

        case "SELECT":
            return (
                <select className={common} required={field.required}>
                    <option value="">{placeholder || "Select"}</option>
                    {field.options?.map((o, i) => (
                        <option key={i} value={o}>
                            {o}
                        </option>
                    ))}
                </select>
            );

        default:
            return <input type="text" className={common} placeholder={placeholder} />;
    }
};
