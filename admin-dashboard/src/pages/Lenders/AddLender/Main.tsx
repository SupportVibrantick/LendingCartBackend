import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StepTwo from "./LoanCriteria/StepTwo";
import StepThree from "./LoanCriteria/StepThree";
import StepFour from "./LoanCriteria/StepFour";
import StepFive from "./LoanCriteria/StepFive";
import EquipmentFinancingStep from "./LoanCriteria/EquipmentFinancingStep";
import {
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getRequiredCriteriaKeysForProduct,
  isMezzanineProduct,
  isNoMinLoanCriteriaProduct,
  isSba504Product,
} from "../../../lib/loanProductCriteriaFields";
import { mapToAdminProductPayload } from "../../../lib/lenderProductAdminPayload";
import { stripNumberFormatting } from "../../../lib/numberInputFormat";

type FormType = {
  lenderId: string;
  loanPrograms: string[];
  organizationName: string;
  organizationEmail: string;
  organizationPhone: string;
  firstName: string;
  lastName: string;
  adminEmail: string;
  password: string;
  brokerId: string;
  propertyTypes: Record<string, string[]>;
  businessTypes: Record<string, string[]>;
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

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("admin_token");
  return token
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    : { "Content-Type": "application/json" };
}

export default function Main() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [hasStep5Errors, setHasStep5Errors] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const selectedProducts = useMemo(
    () => products.filter((p) => form.loanPrograms.includes(p.id)),
    [products, form.loanPrograms],
  );

  const isEquipmentSelected = selectedProducts.some(
    (p) => p.code === "EQUIPMENT_FINANCE",
  );

  const steps = [
    "Create Lender",
    "Loan Programs",
    "Property Types",
    "Business Types",
    ...(isEquipmentSelected ? ["Equipment Types"] : []),
    "Loan Criteria",
  ];

  const loanCriteriaStepIndex = steps.length - 1;
  const isLastStep = step === steps.length - 1;

  const validateStep0 = () => {
    if (!form.organizationName?.trim()) return "Organization name is required";
    if (!form.organizationEmail?.trim())
      return "Organization email is required";
    if (!isValidEmail(form.organizationEmail))
      return "Please enter a valid organization email";
    if (!form.organizationPhone?.trim()) return "Phone number is required";
    if (cleanPhone(form.organizationPhone).length !== 10)
      return "Phone must be 10 digits (USA format)";
    if (!form.firstName?.trim()) return "First name is required";
    if (!form.lastName?.trim()) return "Last name is required";
    if (!form.adminEmail?.trim()) return "Admin email is required";
    if (!isValidEmail(form.adminEmail))
      return "Please enter a valid admin email";
    if (!form.password?.trim()) return "Password is required";
    if (form.password.length < 8)
      return "Password must be at least 8 characters";
    return null;
  };

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    const parts = [];
    if (digits.length > 0) parts.push(digits.slice(0, 3));
    if (digits.length >= 4) parts.push(digits.slice(3, 6));
    if (digits.length >= 7) parts.push(digits.slice(6, 10));
    return parts.join("-");
  };

  const cleanPhone = (value: string) => value.replace(/\D/g, "");

  const validateStep5 = () => {
    for (const product of selectedProducts) {
      const data = form.loanCriteria?.[product.id];

      if (!data) {
        return `Please fill details for ${product.name}`;
      }

      const requiredFields = getRequiredCriteriaKeysForProduct(product.code);

      for (const field of requiredFields) {
        if (!data[field] && data[field] !== 0) {
          return `${product.name}: ${field} is required`;
        }
      }

      if (!data.states || data.states.length === 0) {
        return `${product.name}: Select at least one state`;
      }

      if (isSba504Product(product.code)) {
        const total = Number(stripNumberFormatting(String(data.maxTotalProject ?? "")));
        const debenture = Number(stripNumberFormatting(String(data.maxSba504Debenture ?? "")));
        if (
          data.maxTotalProject &&
          data.maxSba504Debenture &&
          debenture > total
        ) {
          return `${product.name}: SBA 504 debenture cannot exceed total project amount`;
        }
      } else if (
        !isNoMinLoanCriteriaProduct(product.code) &&
        !isMezzanineProduct(product.code)
      ) {
        const minAmount = Number(
          stripNumberFormatting(
            String(data.minFacilitySize ?? data.minProgramSize ?? data.minLoan ?? ""),
          ),
        );
        const maxAmount = Number(
          stripNumberFormatting(
            String(data.maxFacilitySize ?? data.maxProgramSize ?? data.maxLoan ?? ""),
          ),
        );

        if (
          Number.isFinite(minAmount) &&
          Number.isFinite(maxAmount) &&
          minAmount > maxAmount
        ) {
          return `${product.name}: Minimum amount cannot exceed maximum amount`;
        }
      }
    }

    return null;
  };

  const createLender = async (): Promise<string> => {
    const payload: Record<string, string> = {
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
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) {
      if (Array.isArray(json?.errors) && json.errors.length > 0) {
        json.errors.forEach((err: { message?: string }) => {
          toast.error(err.message || "Validation error");
        });
        throw new Error("Validation failed");
      }

      if (json?.field) {
        const fieldLabels: Record<string, string> = {
          organizationEmail: "Organization Email",
          adminEmail: "Admin Email",
          organizationPhone: "Phone Number",
          organizationName: "Organization Name",
        };
        const label = fieldLabels[json.field] || json.field;
        toast.error(`${label}: ${json.message}`);
        throw new Error(json.message);
      }

      throw new Error(json?.message || "Failed to create lender");
    }

    const createdId = json?.data?.organizationId || json?.data?.id;

    if (!createdId) {
      throw new Error("Lender created but ID missing");
    }

    return createdId;
  };

  const handleSubmit = async () => {
    const step5Error = validateStep5();
    if (step5Error) {
      toast.error(step5Error);
      return;
    }

    if (!selectedProducts.length) {
      toast.error("Please select at least one loan program");
      return;
    }

    setSubmitting(true);

    try {
      const lenderOrgId = await createLender();

      const mappedProducts = selectedProducts.map((product) =>
        mapToAdminProductPayload(
          product,
          form,
          form.loanCriteria?.[product.id] || {},
        ),
      );

      const res = await fetch(`${API_BASE}/admin/lender-products/create`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          lenderOrgId,
          products: mappedProducts,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json?.message || "Failed to create lender products");
      }

      toast.success("Lender and loan products created successfully");
      navigate("/all-lenders-Organization");
    } catch (err: any) {
      console.error(err);
      if (err?.message && err.message !== "Validation failed") {
        toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (step === 0) {
      const error = validateStep0();
      if (error) {
        toast.error(error);
        return;
      }
      setStep(1);
      return;
    }

    if (isLastStep) {
      handleSubmit();
      return;
    }

    setStep((prev) => prev + 1);
  };

  useEffect(() => {
    if (!isEquipmentSelected) {
      setForm((p) => ({ ...p, equipmentFinance: [] }));
    }
  }, [isEquipmentSelected]);

  const getStepContent = () => {
    if (step === 0) {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900">
                Create Lender
              </h2>
              <p className="text-sm text-gray-500">
                Enter organization and admin details
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Organization Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Organization Name"
                  required
                  value={form.organizationName}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, organizationName: v }))
                  }
                />
                <InputField
                  label="Organization Email"
                  required
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

            <div className="mb-8">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Admin Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="First Name"
                  required
                  value={form.firstName}
                  onChange={(v) => setForm((p) => ({ ...p, firstName: v }))}
                />
                <InputField
                  label="Last Name"
                  required
                  value={form.lastName}
                  onChange={(v) => setForm((p) => ({ ...p, lastName: v }))}
                />
                <InputField
                  label="Email Address"
                  required
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

            {/* <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Broker (Optional)
              </h3>
              <select
                value={form.brokerId || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, brokerId: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-black focus:border-black outline-none transition"
              >
                <option value="">Select broker</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.email}
                  </option>
                ))}
              </select>
            </div> */}
          </div>
        </div>
      );
    }

    if (step === 1) {
      return (
        <StepTwo
          mode="admin"
          value={form.loanPrograms}
          setValue={(val) =>
            setForm((p) => ({ ...p, loanPrograms: val }))
          }
          onProductsLoad={setProducts}
        />
      );
    }

    const propertyStepIndex = 2;
    const businessStepIndex = 3;
    const equipmentStepIndex = isEquipmentSelected ? 4 : -1;

    if (step === propertyStepIndex) {
      return (
        <StepThree
          value={form.propertyTypes}
          setValue={(val: Record<string, string[]>) =>
            setForm((p) => ({ ...p, propertyTypes: val }))
          }
        />
      );
    }

    if (step === businessStepIndex) {
      return (
        <StepFour
          value={form.businessTypes}
          setValue={(val: Record<string, string[]>) =>
            setForm((p) => ({ ...p, businessTypes: val }))
          }
        />
      );
    }

    if (isEquipmentSelected && step === equipmentStepIndex) {
      return (
        <EquipmentFinancingStep
          value={form.equipmentFinance}
          setValue={(val: string[]) =>
            setForm((p) => ({ ...p, equipmentFinance: val }))
          }
        />
      );
    }

    if (step === loanCriteriaStepIndex) {
      return (
        <StepFive
          authMode="admin"
          products={selectedProducts}
          value={form.loanCriteria}
          setValue={(val: Record<string, any>) =>
            setForm((p) => ({ ...p, loanCriteria: val }))
          }
          setHasErrors={setHasStep5Errors}
        />
      );
    }

    return null;
  };

  const step0Invalid =
    !form.organizationName ||
    !form.organizationEmail ||
    !form.organizationPhone ||
    !form.firstName ||
    !form.lastName ||
    !form.adminEmail ||
    !form.password ||
    form.password.length < 8;

  const step5ValidationMessage =
    step === loanCriteriaStepIndex ? validateStep5() : null;

  const nextDisabled =
    submitting ||
    (step === 0 && step0Invalid) ||
    (step === 1 && form.loanPrograms.length === 0) ||
    (step === loanCriteriaStepIndex && hasStep5Errors) ||
    (isLastStep && step5ValidationMessage !== null);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
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
        </div>

        <div className="max-w-6xl mx-auto px-6">
          <div className="w-full h-[3px] bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black transition-all duration-300"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3 flex-wrap">
          {steps.map((label, i) => {
            const isActive = step === i;
            const isCompleted = step > i;

            return (
              <div key={label} className="flex items-center gap-2">
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
                  <span className="ml-1">{label}</span>
                </div>
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

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">{getStepContent()}</div>
      </div>

      <div className="sticky bottom-0 z-30 bg-white/80 backdrop-blur border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Step <span className="font-semibold text-gray-700">{step + 1}</span>{" "}
            of{" "}
            <span className="font-semibold text-gray-700">{steps.length}</span>
            {isLastStep && step5ValidationMessage && (
              <p className="mt-1 text-red-600">{step5ValidationMessage}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={step === 0 || submitting}
              onClick={() => setStep((p) => p - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-gray-300 bg-white hover:bg-gray-50 transition disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              onClick={handleNext}
              disabled={nextDisabled}
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-black to-gray-800 text-white shadow hover:scale-[1.03] active:scale-[0.98] transition disabled:opacity-40"
            >
              {isLastStep
                ? submitting
                  ? "Submitting..."
                  : "Submit"
                : "Next Step"}
              {!isLastStep && <ChevronRight size={16} />}
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-black focus:border-black outline-none transition"
        />
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
