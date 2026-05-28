import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StepTwo from "./StepTwo";
import StepThree from "./StepThree";
import StepFour from "./StepFour";
import StepFive from "./StepFive";
import EquipmentFinancingStep from "./EquipmentFinancingStep";
import { ChevronRight, ChevronLeft, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

type FormType = {
  lenderId: string;
  loanPrograms: string[];
  propertyTypes: any;
  businessTypes: Record<string, any>;
  loanCriteria: Record<string, any>;
  equipmentFinance: string[];
};

type Product = {
  id: string;
  name: string;
  code: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function Main() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [lenders, setLenders] = useState<any[]>([]);
  const [loadingLenders, setLoadingLenders] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [hasStep5Errors, setHasStep5Errors] = useState(false);

  const [form, setForm] = useState<FormType>({
    lenderId: "",
    loanPrograms: [],
    propertyTypes: {},
    businessTypes: {},
    loanCriteria: {},
    equipmentFinance: [],
  });

  // Equipment check
  const isEquipmentSelected = products.some(
    (p) => p.code === "EQUIPMENT_FINANCE" && form.loanPrograms.includes(p.id),
  );

  // Dynamic Steps
  const steps = [
    "Select Lender",
    "Loan Programs",
    "Property Types",
    "Business Types",
    ...(isEquipmentSelected ? ["Equipment Types"] : []),
    "Loan Criteria",
  ];

  const fetchLenders = async (searchValue?: string) => {
    setLoadingLenders(true);

    try {
      const url = searchValue
        ? `${API_BASE}/admin/lenders/read?search=${encodeURIComponent(searchValue)}`
        : `${API_BASE}/admin/lenders/read`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("admin_token")}`,
        },
      });

      const json = await res.json();

      const list = json?.data?.results || [];

      const normalized = list.map((o: any) => ({
        id: o.id,
        name: o.organizationName,
        email: o.organizationEmail,
      }));

      setLenders(normalized);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load lenders");
    } finally {
      setLoadingLenders(false);
    }
  };

  useEffect(() => {
    fetchLenders();
  }, []);

  // Fetch Products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/loan-products/list`, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("admin_token")}`,
          },
        });

        const json = await res.json();
        if (json?.success) {
          setProducts(json.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  // Step Mapping (IMPORTANT)
  const getStepContent = () => {
    if (step === 0) {
      const filtered = lenders.filter((l) =>
        l.name.toLowerCase().includes(search.toLowerCase()),
      );

      // PAGINATION LOGIC
      const totalPages = Math.ceil(filtered.length / pageSize);

      const paginatedData = filtered.slice(
        (page - 1) * pageSize,
        page * pageSize,
      );

      const selectedLender = lenders.find((l) => l.id === form.lenderId);

      return (
        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-semibold">Select Lender</h2>
              <p className="text-sm text-gray-500">
                Choose a lender to assign loan products
              </p>
            </div>

            {/* SEARCH */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lender..."
              className="border rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* SELECTED CARD */}
          {selectedLender && (
            <div className="mb-6 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-semibold">
                  {selectedLender.name.charAt(0)}
                </div>

                <div>
                  <p className="text-sm font-semibold text-blue-700">
                    {selectedLender.name}
                  </p>
                  <p className="text-xs text-blue-500">
                    {selectedLender.email}
                  </p>
                </div>
              </div>

              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                Selected
              </span>
            </div>
          )}

          {/* GRID */}
          {filtered.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {paginatedData.map((lender) => {
                  const selected = form.lenderId === lender.id;

                  return (
                    <div
                      key={lender.id}
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          lenderId: lender.id,
                        }))
                      }
                      className={`relative cursor-pointer rounded-lg border px-3 py-2.5 transition-all
            ${
              selected
                ? "border-blue-500 bg-blue-50 shadow scale-[1.02]"
                : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
            }`}
                    >
                      {selected && (
                        <div className="absolute top-1 right-2 text-blue-600 text-[10px] font-bold">
                          ✓
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-white flex items-center justify-center text-[10px] font-semibold">
                          {lender.name.charAt(0)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {lender.name}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {lender.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ✅ PAGINATION UI */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-xs text-gray-500">
                    Page {page} of {totalPages}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 1}
                      className="px-2 py-1 border rounded text-xs disabled:opacity-40"
                    >
                      Prev
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (p) => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`px-2 py-1 text-xs rounded ${
                            page === p ? "bg-black text-white" : "border"
                          }`}
                        >
                          {p}
                        </button>
                      ),
                    )}

                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page === totalPages}
                      className="px-2 py-1 border rounded text-xs disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              {/* ICON */}
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4 shadow-sm">
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* TITLE */}
              <p className="text-sm font-semibold text-gray-700">
                No lenders found
              </p>

              {/* DESCRIPTION */}
              <p className="text-xs text-gray-500 mt-1 max-w-xs">
                We couldn’t find any lenders matching your search. Try adjusting
                your keywords.
              </p>

              {/* ACTION */}
              {/* <button
                onClick={() => setSearch("")}
                className="mt-4 text-xs font-medium text-blue-600 hover:underline"
              >
                Clear search
              </button> */}
            </div>
          )}

          {/* LOADING */}
          {loadingLenders && (
            <div className="text-center text-sm text-gray-400 mt-4">
              Loading lenders...
            </div>
          )}
        </div>
      );
    }

    if (step === 1) {
      return (
        <StepTwo
          value={form.loanPrograms}
          setValue={(val: any) => setForm((p) => ({ ...p, loanPrograms: val }))}
        />
      );
    }

    if (step === 2) {
      return (
        <StepThree
          value={form.propertyTypes}
          setValue={(val: any) =>
            setForm((p) => ({ ...p, propertyTypes: val }))
          }
        />
      );
    }

    if (step === 3) {
      return (
        <StepFour
          value={form.businessTypes}
          setValue={(val: any) =>
            setForm((p) => ({ ...p, businessTypes: val }))
          }
        />
      );
    }

    if (isEquipmentSelected && step === 4) {
      return (
        <EquipmentFinancingStep
          value={form.equipmentFinance}
          setValue={(val: any) =>
            setForm((p) => ({
              ...p,
              equipmentFinance: val,
            }))
          }
        />
      );
    }

    const loanCriteriaStepIndex = steps.length - 1;

    if (step === loanCriteriaStepIndex) {
      return (
        <StepFive
          products={selectedProducts}
          value={form.loanCriteria}
          setValue={(val: any) => setForm((p) => ({ ...p, loanCriteria: val }))}
          setHasErrors={setHasStep5Errors}
        />
      );
    }

    return null;
  };

  const buildPayload = () => {
    const selectedProducts = products.filter((p) =>
      form.loanPrograms.includes(p.id),
    );

    const mappedProducts = selectedProducts.map((product) => {
      const criteria = form.loanCriteria?.[product.id] || {};

      return {
        loanProductCode: product.code,

        businessTypes: Object.entries(form.businessTypes || {}).map(
          ([name, subTypes]: any) => ({
            name,
            subTypes,
          }),
        ),

        propertyTypes: Object.entries(form.propertyTypes || {}).map(
          ([type, subTypes]: any) => ({
            type,
            subTypes,
          }),
        ),

        ...(product.code === "EQUIPMENT_FINANCE" && {
          equipmentTypes: form.equipmentFinance || [],
          otherEquipmentExplanation: "",
        }),

        // ✅ FIX: STRING (backend expects string)
        minLoanAmount: String(criteria.minLoan || 0),
        maxLoanAmount: String(criteria.maxLoan || 0),

        minTermMonths: Number(criteria.minTerm) || 0,
        maxTermMonths: Number(criteria.maxTerm) || 0,

        // ✅ ADD MISSING FIELDS
        maxLtvPercent: Number(criteria.maxLtv) || 0,

        maxArvPercent:
          criteria.maxArv !== undefined && criteria.maxArv !== ""
            ? Number(criteria.maxArv)
            : null,

        maxLtcPercent:
          criteria.maxLtc !== undefined && criteria.maxLtc !== ""
            ? Number(criteria.maxLtc)
            : null,

        minCreditScore: Number(criteria.fico) || 0,

        // ✅ IMPORTANT FIX
        minExperience: String(criteria.experience || 0),

        interestRateRange: `${criteria.minRate || 0}-${criteria.maxRate || 0}%`,

        // ✅ CORRECT (array)
        statesSupported: criteria.states || [],

        isActive: true,
      };
    });

    return {
      lenderOrgId: form.lenderId,
      products: mappedProducts,
    };
  };

  const createLenderProducts = async (payload: any) => {
    const res = await fetch(`${API_BASE}/admin/lender-products/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionStorage.getItem("admin_token")}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!json.success) {
      throw new Error(json.message || "Failed");
    }

    return json;
  };

  const validateStep5 = () => {
    for (const product of selectedProducts) {
      const data = form.loanCriteria?.[product.id];

      if (!data) {
        return `Please fill details for ${product.name}`;
      }

      const requiredFields = [
        "minLoan",
        "maxLoan",
        "minRate",
        "maxRate",
        "maxLtv",
        "fico",
        "experience",
        "minTerm",
        "maxTerm",
      ];

      for (const field of requiredFields) {
        if (!data[field] && data[field] !== 0) {
          return `${product.name}: ${field} is required`;
        }
      }

if (!data.maxArv) {
  return `${product.name}: maxArv is required`;
}

      if (
        ["MEZZ_FINANCE", "FIX_AND_FLIP", "CONSTRUCTION_LOAN"].includes(
          product.code,
        ) &&
        !data.maxLtc
      ) {
        return `${product.name}: maxLtc is required`;
      }

      if (!data.states || data.states.length === 0) {
        return `${product.name}: Select at least one state`;
      }

      if (!data.documents || data.documents.length === 0) {
        return `${product.name}: Select at least one required document`;
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    try {
      if (!form.lenderId) {
        toast.error("Please select lender");
        return;
      }

      const step5Error = validateStep5();
      if (step5Error) {
        toast.error(step5Error);
        return;
      }

      const payload = buildPayload();

      console.log("FINAL PAYLOAD 👉", payload);

      const response = await createLenderProducts(payload);

      const createdProducts = response?.data || [];

      for (const createdProduct of createdProducts) {
        const matchingProduct = selectedProducts.find(
          (p) => p.code === createdProduct.loanProductCode,
        );

        if (!matchingProduct) continue;

        const criteria = form.loanCriteria?.[matchingProduct.id] || {};

        const selectedDocuments = criteria.documents || [];

        for (const doc of selectedDocuments) {
          const createPayload = {
            lenderProductId: createdProduct.id,
            documentTypeId: doc.id,
          };

          const docRes = await fetch(
            `${API_BASE}/lender/document-config/create`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionStorage.getItem(
                  "admin_token",
                )}`,
              },
              body: JSON.stringify(createPayload),
            },
          );

          const docJson = await docRes.json().catch(() => ({}));

          if (!docRes.ok) {
            console.error("Failed to create document config", docJson);
          }
        }
      }

      toast.success("Saved successfully");

      navigate("/all-lenders-Organization");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save");
    }
  };

  const isLastStep = step === steps.length - 1;

  const selectedProducts = products.filter((p) =>
    form.loanPrograms.includes(p.id),
  );

  const isStep5Valid = () => {
    return validateStep5() === null;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* HEADER */}
      <div className="sticky top-0 z-30">
        {/* TOP BAR */}
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          {/* LEFT */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/all-lenders-Organization")}
              className="flex items-center justify-center w-9 h-9 rounded-full border hover:bg-gray-100 transition"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <h1 className="text-lg font-semibold leading-tight">
                {steps[step]}
              </h1>
              <p className="text-xs text-gray-500">
                Step {step + 1} of {steps.length}
              </p>
            </div>
          </div>

          {/* RIGHT */}
          {/* <button
            onClick={handleSubmit}
            className="bg-gradient-to-r from-black to-gray-800 text-white px-5 py-2 rounded-lg text-sm font-medium shadow hover:scale-[1.03] active:scale-[0.97] transition"
          >
            Save Profile
          </button> */}
        </div>

        {/* PROGRESS BAR */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="w-full h-[3px] bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black transition-all duration-300"
              style={{
                width: `${((step + 1) / steps.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* STEPPER */}
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3 flex-wrap">
          {steps.map((s, i) => {
            const isActive = step === i;
            const isCompleted = step > i;

            return (
              <div key={i} className="flex items-center gap-2">
                {/* STEP CHIP */}
                <div
                  className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200
            ${
              isActive
                ? "bg-black text-white shadow"
                : isCompleted
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-400"
            }`}
                >
                  {isCompleted ? "✓" : i + 1}
                  <span className="ml-1">{s}</span>
                </div>

                {/* CONNECTOR */}
                {i < steps.length - 1 && (
                  <div
                    className={`w-6 h-[2px] transition-all ${
                      step > i ? "bg-green-400" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">{getStepContent()}</div>
      </div>

      {/* FOOTER */}
      <div className="sticky bottom-0 z-30 bg-white/80 backdrop-blur border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* LEFT - STEP INFO */}
          <div className="text-xs text-gray-500">
            Step <span className="font-semibold text-gray-700">{step + 1}</span>{" "}
            of{" "}
            <span className="font-semibold text-gray-700">{steps.length}</span>
          </div>

          {/* RIGHT - ACTIONS */}
          <div className="flex items-center gap-3">
            {/* PREVIOUS */}
            <button
              disabled={step === 0}
              onClick={() => setStep((p) => p - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-gray-300 bg-white hover:bg-gray-50 transition disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            {/* NEXT */}
            <button
              onClick={isLastStep ? handleSubmit : () => setStep((p) => p + 1)}
              disabled={
                (!isLastStep &&
                  ((step === 0 && !form.lenderId) ||
                    (step === 1 && form.loanPrograms.length === 0))) ||
                (isLastStep && !isStep5Valid()) ||
                (step === steps.length - 1 && hasStep5Errors)
              }
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-black to-gray-800 text-white shadow hover:scale-[1.03] active:scale-[0.98] transition disabled:opacity-40"
            >
              {isLastStep ? "Submit" : "Next Step"}
              {!isLastStep && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
