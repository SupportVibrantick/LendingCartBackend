import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { IoIosArrowBack } from "react-icons/io";
import { MdDeleteForever } from "react-icons/md";
import { useNavigate } from "react-router";
import SignatureCanvas from "react-signature-canvas";

interface Borrower {
  name: string;
  entityName: string;
  phone: string;
  email: string;
  employer: string;
  dob: string;
  ssn: string;
  creditScore: string;
  address: string;
  mailingAddress: string;
}

interface CoBorrower extends Borrower {
  id: number;
}

interface FormDataType {
  borrower: Borrower;
  coBorrowers: CoBorrower[];
  loanRequest: {
    purpose: string;
    amount: string;
    interestRate: string;
    currentMarketValue: string;
    purchasePrice: string;
    purchaseDate: string;
  };
  loanTermIncome: {
    loanTerm: string;
    monthlyRent: string;
    grossRevenueActual: string;
    grossRevenueProforma: string;
    noiActual: string;
    noiProforma: string;
    annualTaxes: string;
    floodZone: string;
    insurancePremium: string;
    hoaDues: string;
  };
}

/* ================= HELPERS ================= */
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const LoanApplication = () => {
  const signatureRef = useRef<SignatureCanvas | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [coBorrowers, setCoBorrowers] = useState<number[]>([]);
  const coBorrowerRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [lastAddedId, setLastAddedId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [dynamicSections, setDynamicSections] = useState<any[]>([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(
    null,
  );
  const [dynamicFormData, setDynamicFormData] = useState<Record<string, any>>(
    {},
  );
  const [applicationId, setApplicationId] = useState<string>("");
  const [productsMeta, setProductsMeta] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const baseSteps = ["Borrower Info", "Loan Request", "Loan Term & Income"];

  /* ================= SIGNATURE ACTIONS ================= */

  const saveSignature = () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) return;

    const base64 = signatureRef.current
      .getTrimmedCanvas()
      .toDataURL("image/png");

    setSignature(base64);
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
    setSignature(null);
  };

  const handleUndoSignature = () => {
    const data = signatureRef.current?.toData();
    if (!data || data.length === 0) return;

    data.pop();
    signatureRef.current?.fromData(data);

    if (data.length === 0) {
      setSignature(null);
    } else {
      saveSignature();
    }
  };

  const toTitleCase = (text: string) => {
    return text
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const allSteps = [
    ...baseSteps,
    ...dynamicSections.map((section) => toTitleCase(section.sectionName)),
    ...(selectedProduct ? ["Signature"] : []),
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormDataType>({
    borrower: {
      name: "",
      entityName: "",
      phone: "",
      email: "",
      employer: "",
      dob: "",
      ssn: "",
      creditScore: "",
      address: "",
      mailingAddress: "",
    },
    coBorrowers: [],
    loanRequest: {
      purpose: "",
      amount: "",
      interestRate: "",
      currentMarketValue: "",
      purchasePrice: "",
      purchaseDate: "",
    },
    loanTermIncome: {
      loanTerm: "",
      monthlyRent: "",
      grossRevenueActual: "",
      grossRevenueProforma: "",
      noiActual: "",
      noiProforma: "",
      annualTaxes: "",
      floodZone: "",
      insurancePremium: "",
      hoaDues: "",
    },
  });

  const [loanProducts, setLoanProducts] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const handleAddCoBorrower = () => {
    const newId = Date.now();

    setFormData((prev) => ({
      ...prev,
      coBorrowers: [
        ...prev.coBorrowers,
        {
          id: newId,
          name: "",
          entityName: "",
          phone: "",
          email: "",
          employer: "",
          dob: "",
          ssn: "",
          creditScore: "",
          address: "",
          mailingAddress: "",
        },
      ],
    }));

    setCoBorrowers((prev) => [...prev, newId]);
    setLastAddedId(newId);
  };

  const handleRemoveCoBorrower = (id: number) => {
    setCoBorrowers((prev) => prev.filter((item) => item !== id));

    setFormData((prev) => ({
      ...prev,
      coBorrowers: prev.coBorrowers.filter((b) => b.id !== id),
    }));
  };

  const updateLoanRequest = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      loanRequest: {
        ...prev.loanRequest,
        [field]: value,
      },
    }));
  };

  const updateLoanTermIncome = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      loanTermIncome: {
        ...prev.loanTermIncome,
        [field]: value,
      },
    }));
  };

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p className="text-[14px] font-semibold text-blue-600">{value}</p>
    </div>
  );

  const handleStepClick = (index: number) => {
    goToStep(index);
  };

  const activeProduct = productsMeta.find(
    (p: any) => p.loanProductCode === selectedProduct,
  );

  const handleSubmitApplication = async () => {
    try {
      if (!activeProduct) {
        toast.error("Please select a loan product");
        return;
      }

      if (!signature) {
        toast.error("Please provide your signature");
        return;
      }
      setSubmitting(true);

      const fields: any[] = [];

      /* ================= STATIC BORROWER ================= */

      Object.entries(formData.borrower).forEach(([fieldKey, value]) => {
        if (value !== "" && value !== undefined && value !== null) {
          fields.push({
            fieldKey,
            value,
          });
        }
      });

      /* ================= CO BORROWERS ================= */

      formData.coBorrowers.forEach((borrower, index) => {
        Object.entries(borrower).forEach(([fieldKey, value]) => {
          if (fieldKey === "id") return;
          if (!value) return;

          fields.push({
            fieldKey: `coBorrower_${index + 1}_${fieldKey}`,
            value,
          });
        });
      });

      /* ================= LOAN REQUEST ================= */

      Object.entries(formData.loanRequest).forEach(([fieldKey, value]) => {
        if (value !== "" && value !== undefined && value !== null) {
          fields.push({
            fieldKey,
            value,
          });
        }
      });

      /* ================= LOAN TERM & INCOME ================= */

      Object.entries(formData.loanTermIncome).forEach(([fieldKey, value]) => {
        if (value !== "" && value !== undefined && value !== null) {
          fields.push({
            fieldKey,
            value,
          });
        }
      });

      /* ================= DYNAMIC FIELDS (SAME AS GETLOANPAGE) ================= */

      const allDynamicFields = [
        ...(activeProduct?.unsectionedFields || []),
        ...(activeProduct?.sections || []).flatMap(
          (section: any) => section.fields || [],
        ),
      ];

      Object.entries(dynamicFormData).forEach(([fieldId, value]) => {
        if (value === "" || value === undefined) return;
        if (value instanceof File) return; // skip files for JSON submit

        const fieldMeta = allDynamicFields.find(
          (f: any) => f.fieldId === fieldId,
        );

        fields.push({
          fieldId, // (makes it dynamic)
          fieldKey: fieldMeta?.fieldKey || fieldMeta?.label || fieldId,
          value,
        });
      });

      /* ================= SIGNATURE ================= */

      fields.push({
        fieldKey: "signature",
        value: signature,
      });

      /* ================= FINAL PAYLOAD ================= */

      const payload = {
        applicationId,
        applicationProductId: activeProduct.productId,
        fields,
      };

      console.log("Submitting Payload:", payload);
      const token = sessionStorage.getItem("broker_token");
      const response = await fetch(`${API_BASE}/broker/applications/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(result.message || "Submission failed");
      }

      toast.success("Application Submitted Successfully 🎉");
      navigate("/submit-applications");
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchLoanProducts = async () => {
      try {
        setLoadingProducts(true);

        const response = await fetch(
          `${API_BASE}/api/public/broker/applications/active`,
        );

        const result = await response.json();

        const products = result?.data?.products || [];

        setProductsMeta(products);
        setApplicationId(result?.data?.applicationId || "");
        const productCodes = products.map(
          (product: any) => product.loanProductCode,
        );

        setLoanProducts(productCodes);
      } catch (error) {
        console.error("Error fetching loan products:", error);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchLoanProducts();
  }, []);

  const fetchSectionsByProduct = async (productCode: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/public/broker/applications/active`,
      );

      const result = await response.json();

      const products = result?.data?.products || [];

      const matchedProduct = products.find(
        (p: any) => p.loanProductCode === productCode,
      );

      const sections = matchedProduct?.sections || [];

      const sortedSections = [...sections].sort(
        (a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0),
      );

      setDynamicSections(sortedSections);
    } catch (error) {
      console.error("Error fetching sections:", error);
    }
  };

  useEffect(() => {
    if (!lastAddedId) return;

    const el = coBorrowerRefs.current[lastAddedId];

    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [lastAddedId]);

  const toNumber = (value: string) => {
    const cleaned = value.replace(/,/g, "");
    return parseFloat(cleaned) || 0;
  };

  const calculateAnnualDebtService = (
    loanAmount: number,
    interestRate: number,
    termMonths: number,
  ) => {
    if (!loanAmount || !termMonths) return 0;

    const monthlyRate = interestRate / 100 / 12;

    let emi = 0;

    if (monthlyRate === 0) {
      emi = loanAmount / termMonths;
    } else {
      emi =
        (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1);
    }

    return emi * 12;
  };

  const loanAmount = toNumber(formData.loanRequest.amount);
  const purchasePrice = toNumber(formData.loanRequest.purchasePrice);
  const marketValue = toNumber(formData.loanRequest.currentMarketValue);

  const ltv =
    marketValue > 0 ? ((loanAmount / marketValue) * 100).toFixed(2) : "—";

  const ltc =
    purchasePrice > 0 ? ((loanAmount / purchasePrice) * 100).toFixed(2) : "—";

  const arv =
    marketValue > 0 ? ((loanAmount / marketValue) * 100).toFixed(2) : "—";

  const interestRate = toNumber(formData.loanRequest.interestRate);
  const termMonths = toNumber(formData.loanTermIncome.loanTerm);
  const noiActual = toNumber(formData.loanTermIncome.noiActual);

  const annualDebtService = calculateAnnualDebtService(
    loanAmount,
    interestRate,
    termMonths,
  );

  const dscr =
    annualDebtService > 0 ? (noiActual / annualDebtService).toFixed(2) : "0.00";

  const handleDynamicFieldChange = (fieldId: string, value: any) => {
    setDynamicFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const renderField = (field: any) => {
    const commonClasses =
      "w-full px-4 text-sm py-1 rounded-md border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition";

    switch (field.type) {
      case "TEXT":
        return (
          <input
            type="text"
            placeholder={field.placeholder || ""}
            required={field.required}
            value={dynamicFormData[field.fieldId] || ""}
            onChange={(e) =>
              handleDynamicFieldChange(field.fieldId, e.target.value)
            }
            className={commonClasses}
          />
        );

      case "EMAIL":
        return (
          <input
            type="email"
            placeholder={field.placeholder || ""}
            required={field.required}
            value={dynamicFormData[field.fieldId] || ""}
            onChange={(e) =>
              handleDynamicFieldChange(field.fieldId, e.target.value)
            }
            className={commonClasses}
          />
        );

      case "NUMBER":
        return (
          <input
            type="number"
            placeholder={field.placeholder || ""}
            required={field.required}
            value={dynamicFormData[field.fieldId] || ""}
            onChange={(e) =>
              handleDynamicFieldChange(field.fieldId, e.target.value)
            }
            className={commonClasses}
          />
        );

      case "DATE":
        return (
          <input
            type="date"
            required={field.required}
            value={dynamicFormData[field.fieldId] || ""}
            onChange={(e) =>
              handleDynamicFieldChange(field.fieldId, e.target.value)
            }
            className={commonClasses}
          />
        );

      case "SELECT":
        return (
          <select
            required={field.required}
            value={dynamicFormData[field.fieldId] || ""}
            onChange={(e) =>
              handleDynamicFieldChange(field.fieldId, e.target.value)
            }
            className={commonClasses}
          >
            <option value="">Select</option>
            {field.options?.map((opt: string, i: number) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "RADIO":
        return (
          <div className="flex gap-6 mt-2">
            {field.options?.map((opt: string, i: number) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={field.fieldKey}
                  value={opt}
                  checked={dynamicFormData[field.fieldId] === opt}
                  onChange={() => handleDynamicFieldChange(field.fieldId, opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        );

      case "CHECKBOX_GROUP":
        return (
          <div className="flex gap-6 mt-2">
            {field.options?.map((opt: string, i: number) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={opt}
                  checked={
                    dynamicFormData[field.fieldId]?.includes(opt) || false
                  }
                  onChange={(e) => {
                    const prevValues = dynamicFormData[field.fieldId] || [];
                    if (e.target.checked) {
                      handleDynamicFieldChange(field.fieldId, [
                        ...prevValues,
                        opt,
                      ]);
                    } else {
                      handleDynamicFieldChange(
                        field.fieldId,
                        prevValues.filter((v: string) => v !== opt),
                      );
                    }
                  }}
                />
                {opt}
              </label>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  const goToStep = (stepIndex: number) => {
    setCurrentStep(stepIndex);

    if (stepIndex >= baseSteps.length) {
      setActiveSectionIndex(stepIndex - baseSteps.length);
    } else {
      setActiveSectionIndex(null);
    }
  };

  useEffect(() => {
    if (selectedProduct) {
      fetchSectionsByProduct(selectedProduct);
    }
  }, [selectedProduct]);

  const updateBorrower = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      borrower: {
        ...prev.borrower,
        [field]: value,
      },
    }));
  };

  const updateCoBorrower = (index: number, field: string, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.coBorrowers];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return { ...prev, coBorrowers: updated };
    });
  };

  return (
    <>
      <div className="min-h-screen bg-slate-50 px-6 py-8">
        {/* HEADER */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">New Loan Application</h2>
          <p className="text-sm text-slate-500">
            Complete comprehensive loan application
          </p>
        </div>

        {/* ===== FIXED HEADER SECTION ===== */}
        <div className="w-full sticky top-[70px] z-30 bg-slate-50 pb-4">
          {/* STEPPER */}
          <div className="flex flex-wrap gap-2 mb-4 pt-4">
            {allSteps.map((step, index) => (
              <button
                key={step}
                type="button"
                onClick={() => handleStepClick(index)}
                className={`px-4 py-2 text-xs rounded-full font-medium transition
        ${
          index === currentStep
            ? "bg-blue-600 text-white shadow"
            : index < currentStep
              ? "bg-green-500 text-white hover:bg-green-600"
              : "bg-slate-200 text-slate-500 hover:bg-slate-300"
        }`}
              >
                {step}
              </button>
            ))}
          </div>

          {/* STATS BOX */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-center">
              <Stat
                label="Loan Amount"
                value={`$${loanAmount.toLocaleString()}`}
              />
              <Stat label="LTV %" value={ltv !== "—" ? `${ltv}%` : "—%"} />
              <Stat label="LTC %" value={ltc !== "—" ? `${ltc}%` : "—%"} />
              <Stat label="ARV %" value={arv !== "—" ? `${arv}%` : "—%"} />
              <Stat label="DSCR" value={dscr !== "—" ? dscr : "—"} />
              <Stat label="Net Worth" value="$0" />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="w-full mx-auto">
          {/* ---------------- BORROWER INFORMATION ---------------- */}
          {/* step-0   */}
          {currentStep === 0 && (
            <>
              <div className="border rounded-2xl p-6 bg-white">
                {/* Header Row */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">
                    Borrower Information
                  </h3>

                  <button
                    type="button"
                    onClick={handleAddCoBorrower}
                    className="px-4 py-2 rounded-md border border-slate-300 
               text-sm font-medium hover:bg-slate-100 transition"
                  >
                    + Add Co-Borrower
                  </button>
                </div>

                {/* Primary Borrower */}
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-slate-700">
                    Primary Borrower
                  </h4>

                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-600">
                    Net Worth: $0
                  </span>
                </div>

                {/* Form Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.borrower.name}
                      onChange={(e) => updateBorrower("name", e.target.value)}
                      className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Entity Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.borrower.entityName}
                      onChange={(e) =>
                        updateBorrower("entityName", e.target.value)
                      }
                      className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.borrower.phone}
                      onChange={(e) => updateBorrower("phone", e.target.value)}
                      className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.borrower.email}
                      onChange={(e) => updateBorrower("email", e.target.value)}
                      className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Employer / Self-Employed{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.borrower.employer}
                      onChange={(e) =>
                        updateBorrower("employer", e.target.value)
                      }
                      className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      DOB (mm/dd/yyyy) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.borrower.dob}
                      onChange={(e) => updateBorrower("dob", e.target.value)}
                      className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      SSN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.borrower.ssn}
                      onChange={(e) => updateBorrower("ssn", e.target.value)}
                      className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Credit Score <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.borrower.creditScore}
                      onChange={(e) =>
                        updateBorrower("creditScore", e.target.value)
                      }
                      className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-600">
                      Present Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.borrower.address}
                      onChange={(e) =>
                        updateBorrower("address", e.target.value)
                      }
                      className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-600">
                      Mailing Address (if different)
                    </label>
                    <input
                      type="text"
                      value={formData.borrower.mailingAddress}
                      onChange={(e) =>
                        updateBorrower("mailingAddress", e.target.value)
                      }
                      className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 
                     focus:ring-2 focus:ring-blue-500/20 
                     focus:border-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>
              </div>
              {coBorrowers.map((id, index) => (
                <div
                  key={id}
                  ref={(el) => {
                    coBorrowerRefs.current[id] = el;
                  }}
                  className="border rounded-2xl p-6 bg-white mt-6 mb-6"
                >
                  {/* Header */}
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold">
                      Co-Borrower {index + 1}
                    </h3>

                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-600 font-medium">
                        Net Worth: $0
                      </span>

                      <button
                        onClick={() => handleRemoveCoBorrower(id)}
                        className="text-red-500 hover:text-red-600 text-lg"
                      >
                        <MdDeleteForever />
                      </button>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        value={formData.coBorrowers[index]?.name}
                        onChange={(e) =>
                          updateCoBorrower(index, "name", e.target.value)
                        }
                        className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        Entity Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={formData.coBorrowers[index]?.entityName}
                        onChange={(e) =>
                          updateCoBorrower(index, "entityName", e.target.value)
                        }
                        className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        value={formData.coBorrowers[index]?.phone}
                        onChange={(e) =>
                          updateCoBorrower(index, "phone", e.target.value)
                        }
                        className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.coBorrowers[index]?.email}
                        onChange={(e) =>
                          updateCoBorrower(index, "email", e.target.value)
                        }
                        className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        Employer / Self-Employed{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={formData.coBorrowers[index]?.employer}
                        onChange={(e) =>
                          updateCoBorrower(index, "employer", e.target.value)
                        }
                        className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        DOB (mm/dd/yyyy) <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        value={formData.coBorrowers[index]?.dob}
                        onChange={(e) =>
                          updateCoBorrower(index, "dob", e.target.value)
                        }
                        placeholder="dd-mm-yyyy"
                        className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        SSN <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        value={formData.coBorrowers[index]?.ssn}
                        onChange={(e) =>
                          updateCoBorrower(index, "ssn", e.target.value)
                        }
                        className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        Credit Score <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={formData.coBorrowers[index]?.creditScore}
                        onChange={(e) =>
                          updateCoBorrower(index, "creditScore", e.target.value)
                        }
                        className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 text-sm"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">
                        Present Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={formData.coBorrowers[index]?.address}
                        onChange={(e) =>
                          updateCoBorrower(index, "address", e.target.value)
                        }
                        required
                        className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 text-sm"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">
                        Mailing Address (if different)
                      </label>
                      <input
                        value={formData.coBorrowers[index]?.mailingAddress}
                        onChange={(e) =>
                          updateCoBorrower(
                            index,
                            "mailingAddress",
                            e.target.value,
                          )
                        }
                        className="mt-1 w-full px-4 py-1 rounded-md border border-slate-300 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ================= STEP 1 ================= */}
          {currentStep === 1 && (
            <div className="border rounded-2xl p-6 bg-white">
              <h3 className="text-lg font-semibold mb-6">
                Loan Request Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Product Code  */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    What kind of program are you looking for?{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => {
                      setSelectedProduct(e.target.value);
                      setDynamicSections([]);
                      setActiveSectionIndex(null);
                    }}
                    className="w-full px-4 py-1 rounded-md border border-slate-300 
  bg-white focus:ring-2 focus:ring-blue-500/20 
  focus:border-blue-500 outline-none transition text-sm"
                  >
                    <option value="">Select Program</option>

                    {loadingProducts ? (
                      <option disabled>Loading...</option>
                    ) : (
                      loanProducts.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Purpose */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Purpose of the Loan <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.loanRequest.purpose}
                    onChange={(e) =>
                      updateLoanRequest("purpose", e.target.value)
                    }
                    className="w-full px-4 py-1 rounded-md border border-slate-300 
          bg-white focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm"
                  >
                    <option value="">Select Purpose</option>
                    <option value="purchase">Purchase</option>
                    <option value="refinance">Refinance</option>
                    <option value="purchase_rehab">Purchase & Rehab</option>
                    <option value="cash_out_refinance">
                      Cash Out Refinance
                    </option>
                    <option value="business_acquisition">
                      Business Acquisition
                    </option>
                    <option value="new_construction">New Construction</option>
                    <option value="refinance_rehab">Refinance & Rehab</option>
                  </select>
                </div>

                {/* Loan Amount */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Amount of Loan Request{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.loanRequest.amount}
                    onChange={(e) =>
                      updateLoanRequest("amount", e.target.value)
                    }
                    placeholder="1,000,000"
                    className="w-full px-4 py-1 rounded-md border border-slate-300 
          focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm"
                  />
                </div>

                {/* Interest Rate */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Expected Interest Rate %{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.loanRequest.interestRate}
                    onChange={(e) =>
                      updateLoanRequest("interestRate", e.target.value)
                    }
                    placeholder="8"
                    className="w-full px-4 py-1 rounded-md border border-slate-300 
          focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm"
                  />
                </div>

                {/* Market Value */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Current Market Value (As-Is){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.loanRequest.currentMarketValue}
                    onChange={(e) =>
                      updateLoanRequest("currentMarketValue", e.target.value)
                    }
                    placeholder="1,500,000"
                    className="w-full px-4 py-1 rounded-md border border-slate-300 
          focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm"
                  />
                </div>

                {/* Purchase Price */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Purchase Price $ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.loanRequest.purchasePrice}
                    onChange={(e) =>
                      updateLoanRequest("purchasePrice", e.target.value)
                    }
                    placeholder="1,200,000"
                    className="w-full px-4 py-1 rounded-md border border-slate-300 
          focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm"
                  />
                </div>

                {/* Purchase Date */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Purchase Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.loanRequest.purchaseDate}
                    onChange={(e) =>
                      updateLoanRequest("purchaseDate", e.target.value)
                    }
                    className="w-full px-4 py-1 rounded-md border border-slate-300 
          focus:ring-2 focus:ring-blue-500/20 
          focus:border-blue-500 outline-none transition text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 2 ================= */}
          {currentStep === 2 && (
            <div className="border rounded-2xl p-6 bg-white">
              <h3 className="text-xl font-semibold mb-6">
                Loan Term & Property Income
              </h3>

              {/* Loan Term */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Loan Term Request
                </label>
                <select
                  value={formData.loanTermIncome.loanTerm}
                  onChange={(e) =>
                    updateLoanTermIncome("loanTerm", e.target.value)
                  }
                  className="w-full px-4 py-1 rounded-md border border-slate-300
        bg-white focus:ring-2 focus:ring-blue-500/20
        focus:border-blue-500 outline-none transition text-sm"
                >
                  <option value="">Select Term</option>
                  <option value="12">12 Months</option>
                  <option value="24">24 Months</option>
                  <option value="36">36 Months</option>
                </select>
              </div>

              {/* Property Income Heading */}
              <h4 className="text-md font-semibold text-slate-700 mb-4">
                Property Income
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Monthly Rent */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Monthly Rent / Market Rent
                  </label>
                  <input
                    type="number"
                    value={formData.loanTermIncome.monthlyRent}
                    onChange={(e) =>
                      updateLoanTermIncome("monthlyRent", e.target.value)
                    }
                    className="w-full px-4 py-1 rounded-md border border-slate-300
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm"
                  />
                </div>

                {/* Gross Revenue Actual */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Gross Revenue / Year (Actual)
                  </label>
                  <input
                    type="number"
                    value={formData.loanTermIncome.grossRevenueActual}
                    onChange={(e) =>
                      updateLoanTermIncome("grossRevenueActual", e.target.value)
                    }
                    className="w-full px-4 py-1 rounded-md border border-slate-300
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm"
                  />
                </div>

                {/* Gross Revenue ProForma */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Gross Revenue / Year (ProForma)
                  </label>
                  <input
                    type="number"
                    value={formData.loanTermIncome.grossRevenueProforma}
                    onChange={(e) =>
                      updateLoanTermIncome(
                        "grossRevenueProforma",
                        e.target.value,
                      )
                    }
                    className="w-full px-4 py-1 rounded-md border border-slate-300
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm"
                  />
                </div>

                {/* NOI Actual */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Net Operating Income / Year (Actual)
                  </label>
                  <input
                    type="number"
                    value={formData.loanTermIncome.noiActual}
                    onChange={(e) =>
                      updateLoanTermIncome("noiActual", e.target.value)
                    }
                    className="w-full px-4 py-1 rounded-md border border-slate-300
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm"
                  />
                </div>

                {/* NOI ProForma */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Net Operating Income / Year (ProForma)
                  </label>
                  <input
                    type="number"
                    value={formData.loanTermIncome.noiProforma}
                    onChange={(e) =>
                      updateLoanTermIncome("noiProforma", e.target.value)
                    }
                    className="w-full px-4 py-1 rounded-md border border-slate-300
          focus:ring-2 focus:ring-blue-500/20
          focus:border-blue-500 outline-none transition text-sm"
                  />
                </div>
              </div>
              {/* ---------------- EXPENSES SECTION ---------------- */}
              <div className="mt-8">
                <h4 className="text-md font-semibold text-slate-700 mb-4">
                  Expenses
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Annual Property Taxes */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Annual Property Taxes
                    </label>
                    <input
                      type="number"
                      value={formData.loanTermIncome.annualTaxes}
                      onChange={(e) =>
                        updateLoanTermIncome("annualTaxes", e.target.value)
                      }
                      className="w-full px-4 py-1 rounded-md border border-slate-300
        focus:ring-2 focus:ring-blue-500/20
        focus:border-blue-500 outline-none transition text-sm"
                    />
                  </div>

                  {/* Property in Flood Zone */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Property in Flood Zone
                    </label>

                    <div className="flex items-center gap-6 mt-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value="yes"
                          checked={formData.loanTermIncome.floodZone === "yes"}
                          onChange={(e) =>
                            updateLoanTermIncome("floodZone", e.target.value)
                          }
                        />
                        Yes
                      </label>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value="no"
                          checked={formData.loanTermIncome.floodZone === "no"}
                          onChange={(e) =>
                            updateLoanTermIncome("floodZone", e.target.value)
                          }
                        />
                        No
                      </label>
                    </div>
                  </div>

                  {/* Annual Insurance Premium */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Annual Insurance Premium
                    </label>
                    <input
                      type="number"
                      value={formData.loanTermIncome.insurancePremium}
                      onChange={(e) =>
                        updateLoanTermIncome("insurancePremium", e.target.value)
                      }
                      className="w-full px-4 py-1 rounded-md border border-slate-300
        focus:ring-2 focus:ring-blue-500/20
        focus:border-blue-500 outline-none transition text-sm"
                    />
                  </div>

                  {/* HOA Dues */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      HOA Dues (If Applicable)
                    </label>
                    <input
                      type="number"
                      value={formData.loanTermIncome.hoaDues}
                      onChange={(e) =>
                        updateLoanTermIncome("hoaDues", e.target.value)
                      }
                      className="w-full px-4 py-1 rounded-md border border-slate-300
        focus:ring-2 focus:ring-blue-500/20
        focus:border-blue-500 outline-none transition text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedProduct && currentStep === allSteps.length - 1 && (
            <div className="border rounded-2xl p-6 bg-white mt-6">
              <h3 className="text-lg font-semibold mb-6">Digital Signature</h3>

              <div className="border rounded-xl bg-white p-4">
                <SignatureCanvas
                  ref={signatureRef}
                  penColor="black"
                  onEnd={saveSignature}
                  canvasProps={{
                    className: "w-full h-48 border rounded-md bg-white",
                  }}
                />
              </div>

              <div className="flex gap-3 mt-4 flex-wrap">
                <button
                  type="button"
                  onClick={handleUndoSignature}
                  className="px-4 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-100"
                >
                  Undo
                </button>

                <button
                  type="button"
                  onClick={handleClearSignature}
                  className="px-4 py-2 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {activeSectionIndex !== null &&
            dynamicSections[activeSectionIndex] && (
              <div className="border rounded-2xl p-6 bg-white mt-6">
                <h3 className="text-lg font-semibold mb-6">
                  {toTitleCase(dynamicSections[activeSectionIndex].sectionName)}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {dynamicSections[activeSectionIndex].fields.map(
                    (field: any) => (
                      <div key={field.fieldId}>
                        <label className="block text-sm font-medium text-slate-600 mb-2">
                          {field.label}
                          {field.required && (
                            <span className="text-red-500"> *</span>
                          )}
                        </label>

                        {renderField(field)}
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

          {/* Footer */}
          <div className="flex justify-between pt-6 mt-6 border-t border-slate-200">
            {/* Back Button */}
            <button
              onClick={() => {
                if (currentStep > 0) {
                  goToStep(currentStep - 1);
                }
              }}
              disabled={currentStep === 0}
              className={`px-4 py-2 rounded-md border transition flex items-center justify-center gap-2 text-sm
  ${
    currentStep === 0
      ? "border-slate-200 text-slate-400 cursor-not-allowed"
      : "border-slate-300 text-slate-600 hover:bg-slate-100"
  }`}
            >
              <IoIosArrowBack />
              Back
            </button>

            {/* Save & Next Button */}
            <button
              onClick={() => {
                if (currentStep === allSteps.length - 1) {
                  handleSubmitApplication();
                  return;
                }

                if (
                  currentStep === 2 &&
                  selectedProduct &&
                  dynamicSections.length === 0
                ) {
                  fetchSectionsByProduct(selectedProduct);
                }

                goToStep(currentStep + 1);
              }}
              disabled={submitting}
              className="px-6 py-2 rounded-md bg-blue-600 text-white 
  hover:bg-blue-700 transition shadow-sm text-sm disabled:opacity-50"
            >
              {currentStep === allSteps.length - 1
                ? submitting
                  ? "Submitting..."
                  : "Submit"
                : "Save & Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoanApplication;
