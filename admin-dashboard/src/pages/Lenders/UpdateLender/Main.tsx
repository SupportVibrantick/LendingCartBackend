import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StepTwo from "./StepTwo";
import StepThree from "./StepThree";
import StepFour from "./StepFour";
import StepFive from "./StepFive";
import {
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import toast from "react-hot-toast";

type FormType = {
  lenderId: string;
  loanPrograms: string[];

  // NEW FIELDS
  organizationName: string;
  organizationEmail: string;
  organizationPhone: string;

  firstName: string;
  lastName: string;
  adminEmail: string;

  brokerId: string;

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

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  isPassword?: boolean;
  showPassword?: boolean;
  togglePassword?: () => void;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export default function Main() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  // const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [createdLenderId, setCreatedLenderId] = useState<string | null>(null);
  const [hasStep5Errors, setHasStep5Errors] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [lenderProductId, setLenderProductId] = useState<string | null>(null);

  const [form, setForm] = useState<FormType>({
    lenderId: "",
    loanPrograms: [],

    organizationName: "",
    organizationEmail: "",
    organizationPhone: "",

    firstName: "",
    lastName: "",
    adminEmail: "",

    brokerId: "",

    propertyTypes: {},
    businessTypes: {},
    loanCriteria: {},
    equipmentFinance: [],
  });

  const validateStep0 = () => {
    if (!form.organizationName?.trim()) return "Organization name is required";

    if (!form.organizationEmail?.trim())
      return "Organization email is required";

    if (!isValidEmail(form.organizationEmail))
      return "Invalid organization email";

    if (!form.organizationPhone?.trim()) return "Phone number is required";

    if (cleanPhone(form.organizationPhone).length !== 10)
      return "Phone must be 10 digits (USA format)";

    if (!form.firstName?.trim()) return "First name is required";
    if (!form.lastName?.trim()) return "Last name is required";

    if (!form.adminEmail?.trim()) return "Admin email is required";

    if (!isValidEmail(form.adminEmail)) return "Invalid admin email";

    return null;
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);

    const parts = [];
    if (digits.length > 0) parts.push(digits.slice(0, 3));
    if (digits.length >= 4) parts.push(digits.slice(3, 6));
    if (digits.length >= 7) parts.push(digits.slice(6, 10));

    return parts.join("-");
  };

  const cleanPhone = (value: string) => {
    return value.replace(/\D/g, "");
  };

  // Equipment check
  const isEquipmentSelected = products.some(
    (p) => p.code === "EQUIPMENT_FINANCE" && form.loanPrograms.includes(p.id),
  );

  // Dynamic Steps
  const steps = [
    "Update Lender",
    "Loan Programs",
    "Property Types",
    "Business Types",
    ...(isEquipmentSelected ? ["Equipment Types"] : []),
    "Loan Criteria",
  ];

  const fetchBrokers = async () => {
    // setLoadingBrokers(true);

    try {
      const res = await fetch(`${API_BASE}/admin/brokers/read`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("admin_token")}`,
        },
      });

      const json = await res.json();

      if (json?.success) {
        setBrokers(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch brokers", err);
    } 
  };

  useEffect(() => {
    fetchBrokers();
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

  const handleUpdateLender = async () => {
    const error = validateStep0();

    if (error) {
      toast.error(error);
      return;
    }

    if (!createdLenderId) {
      toast.error("Lender ID missing");
      return;
    }

    setUpdating(true);

    try {
      const payload = {
        organizationName: form.organizationName.trim(),
        organizationEmail: form.organizationEmail.trim(),
        organizationPhone: cleanPhone(form.organizationPhone),

        adminFirstName: form.firstName.trim(),
        adminLastName: form.lastName.trim(),
        adminEmail: form.adminEmail.trim(),

        ...(form.brokerId && { brokerOrgId: form.brokerId }),
      };

      const res = await fetch(
        `${API_BASE}/admin/lenders/update/${createdLenderId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("admin_token")}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json();

      if (!res.ok) {
        toast.error(json?.message || "Update failed");
        return;
      }

      setUpdating(false);
      toast.success("Lender updated successfully");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    }
  };

  // Step Mapping (IMPORTANT)
  const getStepContent = () => {
    // ✅ STEP 0 (FORM)
    if (step === 0) {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            {/* HEADER */}
            <div className="mb-8 flex items-start justify-between">
              {/* LEFT */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Update Lender
                </h2>
                <p className="text-sm text-gray-500">
                  Enter organization and admin details
                </p>
              </div>

              {/* RIGHT BUTTON */}
              <button
                onClick={handleUpdateLender}
                disabled={updating}
                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium 
  shadow hover:scale-[1.03] active:scale-[0.97] transition disabled:opacity-50"
              >
                {updating ? "Updating..." : "Update Lender"}
              </button>
            </div>

            {/* ORGANIZATION */}
            <div className="mb-8">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Organization Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Organization Name"
                  required={true}
                  value={form.organizationName}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, organizationName: v }))
                  }
                />

                <InputField
                  label="Organization Email"
                  required={true}
                  value={form.organizationEmail}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, organizationEmail: v }))
                  }
                />

                <div className="col-span-2">
                  <InputField
                    label="Phone Number"
                    required
                    value={form.organizationPhone}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        organizationPhone: formatPhone(v),
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* ADMIN */}
            <div className="mb-8">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Admin Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="First Name"
                  required={true}
                  value={form.firstName}
                  onChange={(v) => setForm((p) => ({ ...p, firstName: v }))}
                />

                <InputField
                  label="Last Name"
                  required={true}
                  value={form.lastName}
                  onChange={(v) => setForm((p) => ({ ...p, lastName: v }))}
                />

                <InputField
                  label="Email Address"
                  required={true}
                  value={form.adminEmail}
                  onChange={(v) => setForm((p) => ({ ...p, adminEmail: v }))}
                />
              </div>
            </div>

            {/* BROKER */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Broker (Optional)
              </h3>

              <div className="relative">
                <select
                  value={form.brokerId || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, brokerId: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
            focus:ring-2 focus:ring-black focus:border-black outline-none
            transition"
                >
                  <option value="">Select broker</option>

                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ✅ STEP 1
    if (step === 1) {
      return (
        <StepTwo
          value={form.loanPrograms}
          setValue={(val: any) => setForm((p) => ({ ...p, loanPrograms: val }))}
        />
      );
    }

    // ✅ STEP 2
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

    // ✅ STEP 3
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

    // ✅ STEP 5 (filtered products already correct)
    const loanCriteriaStepIndex = isEquipmentSelected ? 5 : 4;

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

        // BUSINESS TYPES
        businessTypes: Object.entries(form.businessTypes || {}).map(
          ([name, subTypes]: any) => ({
            name,
            subTypes,
          }),
        ),

        // PROPERTY TYPES
        propertyTypes: Object.entries(form.propertyTypes || {}).map(
          ([type, subTypes]: any) => ({
            type,
            subTypes,
          }),
        ),

        // EQUIPMENT ONLY IF SELECTED
        ...(product.code === "EQUIPMENT_FINANCE" && {
          equipmentTypes: form.equipmentFinance || [],
          otherEquipmentExplanation: "",
        }),

        // LOAN CRITERIA
        minLoanAmount: Number(criteria.minLoan) || 0,
        maxLoanAmount: Number(criteria.maxLoan) || 0,
        minTermMonths: Number(criteria.minTerm) || 0,
        maxTermMonths: Number(criteria.maxTerm) || 0,
        interestRateRange: `${criteria.minRate || 0}-${criteria.maxRate || 0}%`,

        statesSupported: criteria.states || [],

        isActive: true,
      };
    });

    return {
      lenderOrgId: createdLenderId,
      products: mappedProducts,
    };
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
        "maxLtc",
        "fico",
        "minTerm",
        "maxTerm",
        "points",
      ];

      for (const field of requiredFields) {
        if (!data[field] && data[field] !== 0) {
          return `${product.name}: ${field} is required`;
        }
      }

      if (!data.states || data.states.length === 0) {
        return `${product.name}: Select at least one state`;
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    try {
      if (!createdLenderId) {
        toast.error("Lender not found");
        return;
      }

      const step5Error = validateStep5();
      if (step5Error) {
        toast.error(step5Error);
        return;
      }

      const payload = buildPayload();

      console.log("UPDATE PAYLOAD 👉", payload);

      const res = await updateLenderProducts(payload);

      const updated = res?.updatedProduct;

      if (updated) {
        const [minRate, maxRateRaw] =
          updated.interestRateRange?.split("-") || [];

        const maxRate = maxRateRaw?.replace("%", "") || "";

        setForm((prev) => ({
          ...prev,
          loanPrograms: [updated.loanProductId],

          propertyTypes: Object.fromEntries(
            updated.propertyTypes.map((p: any) => [p.type, p.subTypes || []]),
          ),

          businessTypes: Object.fromEntries(
            updated.businessTypes.map((b: any) => [b.name, b.subTypes || []]),
          ),

          loanCriteria: {
            [updated.loanProductId]: {
              minLoan: updated.minLoanAmount || "",
              maxLoan: updated.maxLoanAmount || "",
              minRate: minRate || "",
              maxRate: maxRate || "",
              minTerm: updated.minTermMonths || "",
              maxTerm: updated.maxTermMonths || "",

              // IMPORTANT FIX
              states: Array.isArray(updated.statesSupported)
                ? updated.statesSupported
                : updated.statesSupported?.split(",") || [],
            },
          },
        }));
      }

      toast.success("Updated successfully");

      navigate("/all-lenders-Organization");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update");
    }
  };

  const isLastStep = step === steps.length - 1;

  const selectedProducts = products.filter((p) =>
    form.loanPrograms.includes(p.id),
  );

  const isStep5Valid = () => {
    return validateStep5() === null;
  };

  const fetchLenderById = async () => {
    try {
      if (!id) return;

      const res = await fetch(
        `${API_BASE}/admin/lenders/read?search=6bfbf48d-cf1b-4e8f-a81d-dd041b94e077`,
        {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("admin_token")}`,
          },
        },
      );

      const json = await res.json();

      if (json?.success && json?.data?.results?.length > 0) {
        const lender = json.data.results[0];

        setForm((prev) => ({
          ...prev,
          lenderId: lender.id,

          organizationName: lender.organizationName || "",
          organizationEmail: lender.organizationEmail || "",
          organizationPhone: lender.organizationPhone
            ? formatPhone(lender.organizationPhone)
            : "",

          firstName: lender.adminFirstName || "",
          lastName: lender.adminLastName || "",
          adminEmail: lender.adminEmail || "",

          brokerId: lender.brokerOrgId || "",
        }));

        setCreatedLenderId(lender.id);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load lender");
    }
  };

  useEffect(() => {
    if (id) {
      fetchLenderById();
    }
  }, [id]);

  const fetchLenderProducts = async () => {
    try {
      if (!createdLenderId) return;

      const res = await fetch(
        `${API_BASE}/admin/lender-products/lender/${createdLenderId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("admin_token")}`,
          },
        },
      );

      const json = await res.json();

      if (!json?.success) return;

      const data = json.data || [];

      if (data.length > 0) {
        setLenderProductId(data[0].id);
      }

      // ✅ STEP 1: Loan Programs
      const loanPrograms = data.map((item: any) => item.loanProductId);

      // ✅ STEP 2: Property Types (MERGE + UNIQUE)
      const propertyTypes: any = {};

      data.forEach((item: any) => {
        item.propertyTypes?.forEach((p: any) => {
          if (!propertyTypes[p.type]) {
            propertyTypes[p.type] = [];
          }

          propertyTypes[p.type] = [
            ...new Set([...propertyTypes[p.type], ...(p.subTypes || [])]),
          ];
        });
      });

      // ✅ STEP 3: Business Types (MERGE + UNIQUE)
      const businessTypes: any = {};

      data.forEach((item: any) => {
        item.businessTypes?.forEach((b: any) => {
          if (!businessTypes[b.name]) {
            businessTypes[b.name] = [];
          }

          businessTypes[b.name] = [
            ...new Set([...businessTypes[b.name], ...(b.subTypes || [])]),
          ];
        });
      });

      // ✅ STEP 5: Loan Criteria (FIXED)
      const loanCriteria: any = {};

      data.forEach((item: any) => {
        const [minRate, maxRateRaw] = item.interestRateRange?.split("-") || [];

        const maxRate = maxRateRaw?.replace("%", "") || "";

        loanCriteria[item.loanProductId] = {
          minLoan: item.minLoanAmount || "",
          maxLoan: item.maxLoanAmount || "",
          minRate: minRate || "",
          maxRate: maxRate || "",
          minTerm: item.minTermMonths || "",
          maxTerm: item.maxTermMonths || "",

          // ✅ FIX: already array
          states: Array.isArray(item.statesSupported)
            ? item.statesSupported
            : [],
        };
      });

      // ✅ SET FORM
      setForm((prev) => ({
        ...prev,
        loanPrograms,
        propertyTypes,
        businessTypes,
        loanCriteria,
      }));
    } catch (err) {
      console.error("Failed to fetch lender products", err);
    }
  };

  useEffect(() => {
    if (createdLenderId) {
      fetchLenderProducts();
    }
  }, [createdLenderId]);

  const updateLenderProducts = async (payload: any) => {
    if (!lenderProductId) {
      throw new Error("Lender product ID missing");
    }

    const res = await fetch(
      `${API_BASE}/admin/lender-products/update/${lenderProductId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("admin_token")}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const json = await res.json();

    if (!json.success) {
      throw new Error(json.message || "Update failed");
    }

    return json;
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
              disabled={step === 0 || (!!createdLenderId && step === 1)}
              onClick={() => {
                // if (step === 2) return;
                if (createdLenderId && step === 1) return;

                setStep((p) => p - 1);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-gray-300 bg-white hover:bg-gray-50 transition disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            {/* NEXT */}
            <button
              onClick={() => {
                if (step === 0) {
                  setStep(1);
                } else if (isLastStep) {
                  handleSubmit();
                } else {
                  setStep((p) => p + 1);
                }
              }}
              disabled={
                (step === 0 && !!validateStep0()) ||
                (step === 1 && form.loanPrograms.length === 0) ||
                (step === 2 && Object.keys(form.propertyTypes).length === 0) ||
                (step === 3 && Object.keys(form.businessTypes).length === 0) ||
                // NEW: Step 5 validation
                (isLastStep && (!isStep5Valid() || hasStep5Errors))
              }
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium 
  bg-gradient-to-r from-black to-gray-800 text-white shadow 
  hover:scale-[1.03] active:scale-[0.98] transition disabled:opacity-40"
            >
              {isLastStep ? "Submit" : "Next Step"}

              {step !== 0 && !isLastStep && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const InputField = ({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  isPassword = false,
  showPassword = false,
  togglePassword,
}: InputFieldProps) => {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <input
          type={isPassword ? (showPassword ? "text" : "password") : type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm
          focus:ring-2 focus:ring-black focus:border-black outline-none transition"
        />

        {/* 👁 Eye Toggle */}
        {isPassword && (
          <button
            type="button"
            onClick={togglePassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
};
