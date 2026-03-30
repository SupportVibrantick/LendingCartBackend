import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  password: string;

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
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [createdLenderId, setCreatedLenderId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [hasStep5Errors, setHasStep5Errors] = useState(false);

  const [form, setForm] = useState<FormType>({
    lenderId: "",
    loanPrograms: [],

    organizationName: "",
    organizationEmail: "",
    organizationPhone: "",

    firstName: "",
    lastName: "",
    adminEmail: "",
    password: "",

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

    if (!form.password?.trim()) return "Password is required";

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
    "Create Lender",
    "Loan Programs",
    "Property Types",
    "Business Types",
    ...(isEquipmentSelected ? ["Equipment Types"] : []),
    "Loan Criteria",
  ];

  const fetchBrokers = async () => {
    // setLoadingBrokers(true);

    try {
      const res = await fetch(
        `${API_BASE}/admin/brokers/read`,
        {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("admin_token")}`,
          },
        },
      );

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

  // Step Mapping (IMPORTANT)
  const getStepContent = () => {
    // ✅ STEP 0 (FORM)
    if (step === 0) {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            {/* HEADER */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900">
                Create Lender
              </h2>
              <p className="text-sm text-gray-500">
                Enter organization and admin details
              </p>
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

                <InputField
                  label="Password"
                  required
                  isPassword
                  showPassword={showPassword}
                  togglePassword={() => setShowPassword((p) => !p)}
                  value={form.password}
                  onChange={(v) => setForm((p) => ({ ...p, password: v }))}
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

  const handleCreateLender = async () => {
    const error = validateStep0();

    if (error) {
      toast.error(error);
      return;
    }
    // setFormError(null);

    if (
      !form.organizationName ||
      !form.organizationEmail ||
      !form.adminEmail ||
      !form.password
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    // setSubmitting(true);

    try {
      const payload: any = {
        organizationName: form.organizationName.trim(),
        organizationEmail: form.organizationEmail.trim(),
        organizationPhone: cleanPhone(form.organizationPhone),
        adminFirstName: form.firstName?.trim(),
        adminLastName: form.lastName?.trim(),
        adminEmail: form.adminEmail.trim(),
        adminPassword: form.password,
      };

      if (form.brokerId) {
        payload.brokerOrgId = form.brokerId;
      }

      const res = await fetch(`${API_BASE}/admin/lenders/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("admin_token")}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json?.message || "Failed to create lender");
        return;
      }

      const createdId = json?.data?.organizationId || json?.data?.id;

      if (!createdId) {
        toast.error("Lender created but ID missing");
        return;
      }

      // ✅ save lender id
      setCreatedLenderId(createdId);

      // ✅ move to next step
      setStep(1);

      toast.success("Lender created successfully");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    }
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
        toast.error("Lender not created");
        return;
      }

      const step5Error = validateStep5();
      if (step5Error) {
        toast.error(step5Error);
        return;
      }

      const payload = buildPayload();

      console.log("FINAL PAYLOAD 👉", payload);

      await createLenderProducts(payload);

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
                  handleCreateLender();
                } else if (isLastStep) {
                  handleSubmit();
                } else {
                  setStep((p) => p + 1);
                }
              }}
              disabled={
                (step === 0 &&
                  (!form.organizationName ||
                    !form.organizationEmail ||
                    !form.organizationPhone ||
                    !form.firstName ||
                    !form.lastName ||
                    !form.adminEmail ||
                    !form.password)) ||
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
              {step === 0
                ? "Create Lender"
                : isLastStep
                  ? "Submit"
                  : "Next Step"}

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
