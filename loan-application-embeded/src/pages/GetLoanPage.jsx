import React from "react";
// import SignatureCanvas from "react-signature-canvas";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export const LEAD_SOURCES = [
    { value: "google_search", label: "Google Search" },
    { value: "google_ads", label: "Google Ads" },
    { value: "facebook_ads", label: "Facebook / Instagram Ads" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "website", label: "Company Website" },
    { value: "referral", label: "Referral" },
    { value: "broker", label: "Broker / Loan Officer" },
    { value: "email_campaign", label: "Email Campaign" },
    { value: "sms_campaign", label: "SMS Campaign" },
    { value: "cold_call", label: "Cold Call" },
    { value: "partner", label: "Channel Partner" },
    { value: "event", label: "Event / Seminar" },
    { value: "word_of_mouth", label: "Word of Mouth" },
    { value: "other", label: "Other" },
];

export const CREDIT_SCORE_RANGES = [
    { value: "300-579", label: "Poor (300 – 579)" },
    { value: "580-669", label: "Fair (580 – 669)" },
    { value: "670-739", label: "Good (670 – 739)" },
    { value: "740-799", label: "Very Good (740 – 799)" },
    { value: "800-850", label: "Excellent (800 – 850)" },
];

export const PERSONAL_CREDIT_SCORE_OPTIONS = [
    { value: "poor", label: "Poor (300 – 579)" },
    { value: "fair", label: "Fair (580 – 669)" },
    { value: "good", label: "Good (670 – 739)" },
    { value: "very_good", label: "Very Good (740 – 799)" },
    { value: "excellent", label: "Excellent (800 – 850)" },
];

const STATES = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
]

export default function GetLoanPage() {
    const [isBroker, setIsBroker] = useState(null);
    const [hasCoBorrower, setHasCoBorrower] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [products, setProducts] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState("");

    const [agreed, setAgreed] = useState(false);
    const [borrowerSignName, setBorrowerSignName] = useState("");
    // const sigPadRef = React.useRef(null);
    const [staticValues, setStaticValues] = useState({});
    const [dynamicValues, setDynamicValues] = useState({});
    const [applicationId, setApplicationId] = useState("");
    const [loanProductCode, setLoanProductCode] = useState("");

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
                `${API_BASE}/api/public/broker/applications/active`,
            );

            const json = await safeJson(res);
            if (!res.ok || json.success !== true) throw new Error(json.message);

            setProducts(json.data.products || []);
            setApplicationId(json.data.applicationId);
        } catch (err) {
            toast.error(err.message || "Failed to load products");
        } finally {
            setLoadingProducts(false);
        }
    };

    const handleSubmit = async () => {
        try {
            if (!activeProduct) {
                toast.error("Please select a product");
                return;
            }

            if (!agreed) {
                toast.error("Please accept terms and conditions");
                return;
            }

            if (!borrowerSignName) {
                toast.error("Borrower signature name is required");
                return;
            }

            /* ---------- REQUIRED DYNAMIC FIELD VALIDATION ---------- */
            const allDynamicFields = [
                ...(activeProduct?.unsectionedFields || []),
                ...(activeProduct?.sections || []).flatMap(s => s.fields || [])
            ];

            const missing = allDynamicFields.filter(f => {
                if (!f.required) return false;
                const val = dynamicValues[f.fieldId];
                if (f.type === "FILE") return !val;
                return val === undefined || val === "";
            });

            if (missing.length) {
                toast.error(
                    `Please fill required fields: ${missing.map(m => m.label).join(", ")}`
                );
                return;
            }

            /* ---------- STATIC FIELDS (fieldKey) ---------- */
            const staticFieldsPayload = Object.entries(staticValues)
                .filter(([_, value]) => value !== "" && value !== undefined)
                .map(([fieldKey, value]) => ({
                    fieldKey,
                    value,
                }));

            /* ---------- DYNAMIC FIELDS (fieldId) ---------- */
            const dynamicFieldsPayload = Object.entries(dynamicValues)
                .filter(([_, value]) => value !== "" && value !== undefined)
                .map(([fieldId, value]) => ({
                    fieldId,
                    value,
                }));

            if (activeProduct?.loanProductCode) {
                staticFieldsPayload.push({
                    fieldKey: "loanProductCode",
                    value: activeProduct.loanProductCode,
                });
            }

            /* ---------- FINAL PAYLOAD ---------- */
            const payload = {
                applicationId,
                applicationProductId: activeProduct.productId,
                fields: [
                    ...staticFieldsPayload,
                    ...dynamicFieldsPayload,
                    {
                        fieldKey: "borrowerSignatureName",
                        value: borrowerSignName,
                    },
                ],
            };

            console.log("FINAL SUBMIT PAYLOAD:", payload);

            const res = await fetch(
                `${API_BASE}/api/public/broker/applications/submit`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const json = await safeJson(res);

            if (!res.ok || json.success !== true) {
                throw new Error(json.message || "Submission failed");
            }

            toast.success("Application submitted successfully 🎉");
            console.log("Submission ID:", json.data.submissionId);

        } catch (err) {
            toast.error(err.message || "Something went wrong");
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
                                    onChange={() => {
                                        setIsBroker(true)
                                        setStaticValues(p => ({ ...p, isBroker: true }));
                                    }}
                                />
                                <Radio
                                    label="No"
                                    checked={isBroker === false}
                                    onChange={() => {
                                        setIsBroker(false)
                                        setStaticValues(p => ({ ...p, isBroker: false }));
                                    }}
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
                                    <Input label="Email Address" placeholder="Enter Email Address" value={staticValues.email} onChange={(e) => setStaticValues(p => ({ ...p, email: e.target.value }))} type="email" />
                                    <Input label="Phone Number" placeholder="(___) ___-____" value={staticValues.phone} onChange={(e) => setStaticValues(p => ({ ...p, phone: e.target.value }))} type="number" />
                                    <Input label="First Name" placeholder="Enter First Name" value={staticValues.firstName} onChange={(e) => setStaticValues(p => ({ ...p, firstName: e.target.value }))} />
                                    <Input label="Last Name" placeholder="Enter Last Name" value={staticValues.lastName} onChange={(e) => setStaticValues(p => ({ ...p, lastName: e.target.value }))} />
                                    <Input label="Company Name" placeholder="Enter Company Name" value={staticValues.companyName} onChange={(e) => setStaticValues(p => ({ ...p, companyName: e.target.value }))} />
                                    <Input label="City" placeholder="Enter City" value={staticValues.city} onChange={(e) => setStaticValues(p => ({ ...p, city: e.target.value }))} />
                                    <Input label="Loan Amount" placeholder="Enter Loan Amount" value={staticValues.loanAmount} onChange={(e) => setStaticValues(p => ({ ...p, loanAmount: e.target.value }))} type="number" />
                                    <Select
                                        label="State"
                                        value={staticValues.state || ""}
                                        onChange={(e) => setStaticValues(p => ({ ...p, state: e.target.value }))}
                                    >
                                        <option value="">- Select State -</option>
                                        {STATES.map((state, i) => (
                                            <option key={i} value={state}>
                                                {state}
                                            </option>
                                        ))}
                                    </Select>
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

                                    {/* <Select label="Where are you in the process?" /> */}
                                    <Select
                                        label="Lead Source"
                                        value={staticValues.leadSource || ""}
                                        onChange={(e) => setStaticValues(p => ({ ...p, leadSource: e.target.value }))}
                                    >
                                        <option value="">- Select Lead Source -</option>
                                        {LEAD_SOURCES.map((src) => (
                                            <option key={src.value} value={src.value}>
                                                {src.label}
                                            </option>
                                        ))}
                                    </Select>
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
                                    <Input label="First Name" value={staticValues.borrowerFirstName}
                                        onChange={(e) =>
                                            setStaticValues(p => ({ ...p, borrowerFirstName: e.target.value }))
                                        } />
                                    <Input label="Last Name" value={staticValues.borrowerLastName}
                                        onChange={(e) =>
                                            setStaticValues(p => ({ ...p, borrowerLastName: e.target.value }))
                                        } />
                                    <Input label="Borrower Email" value={staticValues.borrowerEmail}
                                        onChange={(e) =>
                                            setStaticValues(p => ({ ...p, borrowerEmail: e.target.value }))
                                        } type="email" />
                                    <Input label="Cell Phone" placeholder="(___) ___-____" value={staticValues.borrowerCellPhone}
                                        onChange={(e) =>
                                            setStaticValues(p => ({ ...p, borrowerCellPhone: e.target.value }))
                                        } type="number" />
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
                                            <Radio label="U.S. Citizen" name="static_citizen" checked={staticValues.citizenship === "us_citizen"} onChange={() =>
                                                setStaticValues(p => ({ ...p, citizenship: "us_citizen" }))
                                            } />
                                            <Radio label="Perm Resident" name="static_citizen" checked={staticValues.citizenship === "permanent_resident"} onChange={() =>
                                                setStaticValues(p => ({ ...p, citizenship: "permanent_resident" }))
                                            } />
                                            <Radio label="Non-Perm Resident" name="static_citizen" checked={staticValues.citizenship === "non_permanent_resident"} onChange={() =>
                                                setStaticValues(p => ({ ...p, citizenship: "non_permanent_resident" }))
                                            } />
                                            <Radio label="Foreign National" name="static_citizen" checked={staticValues.citizenship === "foreign_national"} onChange={() =>
                                                setStaticValues(p => ({ ...p, citizenship: "foreign_national" }))
                                            } />
                                        </div>
                                    </div>

                                    {/* Credit Score */}
                                    <Select
                                        label="Credit Score Range"
                                        value={staticValues.creditScoreRange || ""}
                                        onChange={(e) => setStaticValues(p => ({ ...p, creditScoreRange: e.target.value }))}
                                    >
                                        <option value="">- Select Credit Score Range -</option>
                                        {CREDIT_SCORE_RANGES.map((score) => (
                                            <option key={score.value} value={score.value}>
                                                {score.label}
                                            </option>
                                        ))}
                                    </Select>
                                </div>

                                {
                                    hasCoBorrower && (
                                        <>
                                            <SectionHeader title="Co-Borrower Information" />

                                            <div className="p-6 space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <Input label="First Name" value={staticValues.coBorrowerFirstName}
                                                        onChange={(e) =>
                                                            setStaticValues(p => ({ ...p, coBorrowerFirstName: e.target.value }))
                                                        } />
                                                    <Input label="Last Name" value={staticValues.coBorrowerLastName}
                                                        onChange={(e) =>
                                                            setStaticValues(p => ({ ...p, coBorrowerLastName: e.target.value }))
                                                        } />
                                                    <Input label="Borrower Email" value={staticValues.coBorrowerEmail}
                                                        onChange={(e) =>
                                                            setStaticValues(p => ({ ...p, coBorrowerEmail: e.target.value }))
                                                        } type="email" />
                                                    <Input label="Cell Phone" placeholder="(___) ___-____" value={staticValues.coBorrowerCellPhone}
                                                        onChange={(e) =>
                                                            setStaticValues(p => ({ ...p, coBorrowerCellPhone: e.target.value }))
                                                        } type="number" />
                                                </div>

                                                {/* ================= PERSONAL INFO ================= */}
                                                <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                    Personal Info
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Credit Score */}
                                                    <Select
                                                        label="Credit Score"
                                                        value={staticValues.coBorrowerCreditScore || ""}
                                                        onChange={(e) => setStaticValues(p => ({ ...p, coBorrowerCreditScore: e.target.value }))}
                                                    >
                                                        <option value="">- Select Credit Score -</option>
                                                        {PERSONAL_CREDIT_SCORE_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                </div>
                                            </div>

                                        </>
                                    )
                                }

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
                                                        {renderField(field, dynamicValues, setDynamicValues)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                            </div>
                        </>
                    )}

                    {/* ================= PRODUCT DYNAMIC SECTIONS ================= */}
                    {activeProduct &&
                        activeProduct.sections &&
                        activeProduct.sections.length > 0 && (
                            <div className="p-6 space-y-8">

                                {activeProduct.sections
                                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                                    .map((section) => (
                                        <div key={section.sectionId}>
                                            {/* Section Title */}
                                            <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                                                {section.sectionName}
                                            </div>

                                            {/* Fields Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {section.fields.map((field) => (
                                                    <div key={field.fieldId} className="space-y-1">
                                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                            {field.label}
                                                            {field.required && <span className="text-red-500 ml-1">*</span>}
                                                        </label>

                                                        {renderField(field, dynamicValues, setDynamicValues)}
                                                    </div>
                                                ))}

                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}

                    {/* ================= PRODUCT UNSECTIONED FIELDS ================= */}
                    {activeProduct &&
                        activeProduct.unsectionedFields &&
                        activeProduct.unsectionedFields.length > 0 && (
                            <div className="p-6 space-y-6">
                                <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Additional Information
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {activeProduct.unsectionedFields.map((field) => (
                                        <div key={field.fieldId} className="space-y-1">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {field.label}
                                                {field.required && <span className="text-red-500 ml-1">*</span>}
                                            </label>

                                            {renderField(field, dynamicValues, setDynamicValues)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}


                    {/* ================= TERMS & CONDITIONS ================= */}
                    {isBroker && (<><SectionHeader title="Terms And Conditions" />

                        <div className="p-6 space-y-6">
                            {/* Terms text */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded text-sm text-slate-700 dark:text-slate-200 border">
                                By submitting this application, you acknowledge that everything is true and
                                correct to the best of your knowledge. If pre-approved, you authorize us to
                                pull your credit report. Certain fees, like an appraisal fee may not be
                                refundable in the event your loan does not close with us. Additionally you
                                agree to let us send text messages to your cell phone if provided, you may
                                opt out anytime replying with STOP.
                            </div>

                            {/* Agreement checkbox */}
                            <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={agreed}
                                    onChange={(e) => {
                                        setAgreed(e.target.checked)
                                        setStaticValues(p => ({ ...p, agreedToTerms: e.target.checked }));
                                    }}
                                />
                                By checking this box I agree to the terms and conditions.*
                            </label>

                            {/* Borrower signature name */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                <Input
                                    label="Name of Borrower Signing:"
                                    value={borrowerSignName}
                                    onChange={(e) => setBorrowerSignName(e.target.value)}
                                />

                                <button
                                    type="button"
                                    // onClick={() => sigPadRef.current?.clear()}
                                    className="bg-blue-500 text-white px-4 py-2 rounded w-fit mt-6"
                                >
                                    Reset Signature
                                </button>
                            </div>

                            {/* Signature pad */}
                            <div className="border rounded-lg bg-slate-100 dark:bg-slate-800">
                                {/* <SignatureCanvas
                                    ref={sigPadRef}
                                    penColor="blue"
                                    canvasProps={{
                                        width: 900,
                                        height: 250,
                                        className: "signatureCanvas w-full",
                                    }}
                                /> */}
                            </div>

                            <button
                                type="button"
                                // onClick={() => sigPadRef.current?.undo()}
                                className="text-sm px-3 py-1 bg-slate-300 dark:bg-slate-700 rounded"
                            >
                                Undo last stroke
                            </button>

                            {/* reCAPTCHA placeholder */}
                            <div className="flex justify-center mt-6">
                                <div className="border rounded p-4 flex items-center gap-4 bg-white">
                                    <input type="checkbox" />
                                    <span className="text-sm">I'm not a robot</span>
                                    <span className="text-xs text-slate-400">reCAPTCHA</span>
                                </div>
                            </div>
                        </div>

                        {/* ================= FOOTER ================= */}
                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                            <button
                                onClick={handleSubmit}
                                disabled={!agreed || !borrowerSignName}
                                // disabled={!agreed || !borrowerSignName || sigPadRef.current?.isEmpty()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-semibold text-sm shadow cursor-pointer"
                            >
                                Submit
                            </button>
                        </div></>)}
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

function Input({ label, placeholder = "", value, onChange, type = "text" }) {
    return (
        <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {label}
            </label>
            <input
                type={type}
                value={value || ""}
                onChange={onChange}
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

// const renderField = (field, dynamicValues, setDynamicValues) => {
//     const common =
//         "w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700";

//     const value = dynamicValues[field.fieldId] ?? "";
//     const placeholder = field.placeholder || "";

//     /* ---------- RANGE ---------- */
//     if (field.type === "RANGE") {
//         const min = field.validation?.min ?? 0;
//         const max = field.validation?.max ?? 100;

//         return (
//             <div className="space-y-2">
//                 <input
//                     type="range"
//                     min={min}
//                     max={max}
//                     value={value || min}
//                     onChange={(e) =>
//                         setDynamicValues((p) => ({
//                             ...p,
//                             [field.fieldId]: Number(e.target.value),
//                         }))
//                     }
//                     className="w-full accent-blue-600"
//                 />
//                 <div className="flex justify-between text-xs text-slate-500">
//                     <span>{min}</span>
//                     <span className="font-medium text-slate-700 dark:text-slate-200">
//                         {value || min}
//                     </span>
//                     <span>{max}</span>
//                 </div>
//             </div>
//         );
//     }

//     /* ---------- RADIO ---------- */
//     if (field.type === "RADIO") {
//         return (
//             <div className="space-y-2 bg-slate-50 dark:bg-slate-800 border rounded-lg p-3">
//                 {field.options?.map((opt, i) => (
//                     <label key={i} className="flex items-center gap-2 text-sm">
//                         <input
//                             type="radio"
//                             name={field.fieldId}
//                             checked={value === opt}
//                             onChange={() =>
//                                 setDynamicValues((p) => ({
//                                     ...p,
//                                     [field.fieldId]: opt,
//                                 }))
//                             }
//                         />
//                         {opt}
//                     </label>
//                 ))}
//             </div>
//         );
//     }

//     /* ---------- CHECKBOX GROUP ---------- */
//     if (field.type === "CHECKBOX_GROUP") {
//         const selected = Array.isArray(value) ? value : [];

//         return (
//             <div className="space-y-2 bg-slate-50 dark:bg-slate-800 border rounded-lg p-3">
//                 {field.options?.map((opt, i) => (
//                     <label key={i} className="flex items-center gap-2 text-sm">
//                         <input
//                             type="checkbox"
//                             checked={selected.includes(opt)}
//                             onChange={(e) =>
//                                 setDynamicValues((p) => ({
//                                     ...p,
//                                     [field.fieldId]: e.target.checked
//                                         ? [...selected, opt]
//                                         : selected.filter((x) => x !== opt),
//                                 }))
//                             }
//                         />
//                         {opt}
//                     </label>
//                 ))}
//             </div>
//         );
//     }

//     /* ---------- NUMBER ---------- */
//     if (field.type === "NUMBER") {
//         return (
//             <input
//                 type="number"
//                 value={value}
//                 onChange={(e) =>
//                     setDynamicValues((p) => ({
//                         ...p,
//                         [field.fieldId]: e.target.value,
//                     }))
//                 }
//                 className={common}
//                 placeholder={placeholder}
//             />
//         );
//     }

//     /* ---------- TEXT / EMAIL ---------- */
//     if (field.type === "TEXT" || field.type === "EMAIL") {
//         return (
//             <input
//                 type={field.type === "EMAIL" ? "email" : "text"}
//                 value={value}
//                 onChange={(e) =>
//                     setDynamicValues((p) => ({
//                         ...p,
//                         [field.fieldId]: e.target.value,
//                     }))
//                 }
//                 className={common}
//                 placeholder={placeholder}
//             />
//         );
//     }

//     /* ---------- SELECT ---------- */
//     if (field.type === "SELECT") {
//         return (
//             <select
//                 value={value}
//                 onChange={(e) =>
//                     setDynamicValues((p) => ({
//                         ...p,
//                         [field.fieldId]: e.target.value,
//                     }))
//                 }
//                 className={common}
//             >
//                 <option value="">Select</option>
//                 {field.options?.map((o, i) => (
//                     <option key={i} value={o}>
//                         {o}
//                     </option>
//                 ))}
//             </select>
//         );
//     }

//     return <input className={common} />;
// };


const renderField = (field, dynamicValues, setDynamicValues) => {
    const base =
        "w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700";

    const value = dynamicValues[field.fieldId] ?? "";
    const placeholder = field.placeholder || "";

    /* ---------- TEXT ---------- */
    if (field.type === "TEXT") {
        return (
            <input
                type="text"
                value={value}
                placeholder={placeholder}
                onChange={(e) =>
                    setDynamicValues((p) => ({ ...p, [field.fieldId]: e.target.value }))
                }
                className={base}
            />
        );
    }

    /* ---------- EMAIL ---------- */
    if (field.type === "EMAIL") {
        return (
            <input
                type="email"
                value={value}
                placeholder={placeholder}
                onChange={(e) =>
                    setDynamicValues((p) => ({ ...p, [field.fieldId]: e.target.value }))
                }
                className={base}
            />
        );
    }

    /* ---------- NUMBER ---------- */
    if (field.type === "NUMBER") {
        return (
            <input
                type="number"
                value={value}
                placeholder={placeholder}
                min={field.validation?.min}
                max={field.validation?.max}
                onChange={(e) =>
                    setDynamicValues((p) => ({ ...p, [field.fieldId]: e.target.value }))
                }
                className={base}
            />
        );
    }

    /* ---------- DATE ---------- */
    if (field.type === "DATE") {
        return (
            <input
                type="date"
                value={value}
                onChange={(e) =>
                    setDynamicValues((p) => ({ ...p, [field.fieldId]: e.target.value }))
                }
                className={base}
            />
        );
    }

    /* ---------- TEXTAREA ---------- */
    if (field.type === "TEXTAREA") {
        return (
            <textarea
                rows={3}
                value={value}
                placeholder={placeholder}
                onChange={(e) =>
                    setDynamicValues((p) => ({ ...p, [field.fieldId]: e.target.value }))
                }
                className={base}
            />
        );
    }

    /* ---------- SELECT ---------- */
    if (field.type === "SELECT") {
        return (
            <select
                value={value}
                onChange={(e) =>
                    setDynamicValues((p) => ({ ...p, [field.fieldId]: e.target.value }))
                }
                className={base}
            >
                <option value="">Select</option>
                {field.options?.map((opt, i) => (
                    <option key={i} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
        );
    }

    /* ---------- RADIO ---------- */
    if (field.type === "RADIO") {
        return (
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800 border rounded-lg p-3">
                {field.options?.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm">
                        <input
                            type="radio"
                            name={field.fieldId}
                            checked={value === opt}
                            onChange={() =>
                                setDynamicValues((p) => ({ ...p, [field.fieldId]: opt }))
                            }
                        />
                        {opt}
                    </label>
                ))}
            </div>
        );
    }

    /* ---------- CHECKBOX (single boolean) ---------- */
    if (field.type === "CHECKBOX") {
        return (
            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) =>
                        setDynamicValues((p) => ({
                            ...p,
                            [field.fieldId]: e.target.checked,
                        }))
                    }
                />
                {field.label}
            </label>
        );
    }

    /* ---------- FILE ---------- */
    if (field.type === "FILE") {
        return (
            <input
                type="file"
                onChange={(e) =>
                    setDynamicValues((p) => ({
                        ...p,
                        [field.fieldId]: e.target.files?.[0],
                    }))
                }
                className={base}
            />
        );
    }

    return <input className={base} />;
};
