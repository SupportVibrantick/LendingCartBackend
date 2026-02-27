import React from "react";
import SignatureCanvas from "react-signature-canvas";
import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import ReCAPTCHA from "react-google-recaptcha";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const US_PHONE_REGEX =
  /^(?:\+1\s?)?(?:\(?([2-9][0-9]{2})\)?[\s.-]?)([2-9][0-9]{2})[\s.-]?([0-9]{4})$/;

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
  { value: "300–579", label: "Poor (300 – 579)" },
  { value: "580–669", label: "Fair (580 – 669)" },
  { value: "670–739", label: "Good (670 – 739)" },
  { value: "740–799", label: "Very Good (740 – 799)" },
  { value: "800–850", label: "Excellent (800 – 850)" },
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
];

const getInitialStaticValues = () => ({
  isBroker: null,

  // borrower fields
  borrowerFirstName: "",
  borrowerLastName: "",
  borrowerEmail: "",
  borrowerPhone: "",
  borrowerLoanAmount: "",
  borrowerState: "",
  borrowerCity: "",

  // broker fields
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  brokerLoanAmount: "",
  brokerState: "",
  brokerCity: "",

  // shared
  creditScoreRange: "",
});

export default function GetLoanPage() {
  const sigPadRef = useRef(null);
  const coBorrowerRefs = useRef({});
  const [isBroker, setIsBroker] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");

  const [agreed, setAgreed] = useState(false);
  const [borrowerSignName, setBorrowerSignName] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [staticValues, setStaticValues] = useState({});
  const [dynamicValues, setDynamicValues] = useState({});
  const [applicationId, setApplicationId] = useState("");
  const [signatureHistory, setSignatureHistory] = useState([]);
  const [errors, setErrors] = useState({});
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [coBorrowers, setCoBorrowers] = useState([]);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const activeProduct = products.find((p) => p.productId === selectedProductId);

  const resetForm = () => {
    setStaticValues({});
    setDynamicValues({});
    setErrors({});
    setBorrowerSignName("");
    setSignatureData("");
    setCoBorrowers([]);
    setAgreed(false);
    setRecaptchaToken(null);

    // signature canvas clear
    if (sigPadRef.current) {
      sigPadRef.current.clear();
    }
  };

  async function safeJson(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error("RAW RESPONSE:", text);
      throw new Error("Server returned invalid response.");
    }
  }

  const toNumber = (val) => {
    if (!val) return 0;
    return parseFloat(String(val).replace(/,/g, "")) || 0;
  };

  const calculateAnnualDebtService = (loanAmount, interestRate, termMonths) => {
    if (!loanAmount || !termMonths) return 0;

    const monthlyRate = interestRate / 100 / 12;

    if (monthlyRate === 0) {
      return (loanAmount / termMonths) * 12;
    }

    const emi =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);

    return emi * 12;
  };

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
      const newErrors = {};

      /* ================= BASIC CHECKS ================= */
      if (isBroker === null) {
        toast.error("Please select Yes or No");
        return;
      }

      if (!activeProduct) {
        toast.error("Please select a product");
        return;
      }

      if (!borrowerSignName) {
        newErrors.borrowerSignatureName = "Borrower signature name is required";
      }

      if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
        newErrors.signature = "Signature is required";
      }

      if (!agreed) {
        newErrors.agreedToTerms = "Please accept terms and conditions";
      }

      if (!recaptchaToken) {
        toast.error("Please verify reCAPTCHA");
        return;
      }

      /* ================= STATIC VALIDATION ================= */

      const REQUIRED_BROKER_FIELDS = [
        "firstName",
        "lastName",
        "email",
        "phone",
        "companyName",
        "brokerCity",
        "brokerLoanAmount",
        "brokerState",
        "minTermMonths",
        "maxTermMonths",
        "creditScoreRange",
      ];

      const REQUIRED_BORROWER_FIELDS = [
        "borrowerFirstName",
        "borrowerLastName",
        "borrowerEmail",
        "borrowerCellPhone",
        "citizenship",
        "creditScoreRange",
        "borrowerCity",
        "borrowerLoanAmount",
        "borrowerState",
        "minTermMonths",
        "maxTermMonths",
      ];

      if (coBorrowers.length > 0) {
        coBorrowers.forEach((b, index) => {
          if (!b.firstName)
            newErrors[`coBorrower_${index}_firstName`] =
              "This field is required";

          if (!b.lastName)
            newErrors[`coBorrower_${index}_lastName`] =
              "This field is required";

          if (!b.email)
            newErrors[`coBorrower_${index}_email`] = "This field is required";

          if (b.email && !EMAIL_REGEX.test(b.email))
            newErrors[`coBorrower_${index}_email`] = "Invalid email";

          if (!b.cellPhone) {
            newErrors[`coBorrower_${index}_cellPhone`] =
              "This field is required";
          } else if (!US_PHONE_REGEX.test(b.cellPhone)) {
            newErrors[`coBorrower_${index}_cellPhone`] =
              "Enter a valid US phone number";
          }

          if (!b.creditScore)
            newErrors[`coBorrower_${index}_creditScore`] =
              "This field is required";

          if (!b.currentMarketValue)
            newErrors[`coBorrower_${index}_currentMarketValue`] =
              "This field is required";

          if (!b.purchasePrice)
            newErrors[`coBorrower_${index}_purchasePrice`] =
              "This field is required";

          if (!b.interestRate)
            newErrors[`coBorrower_${index}_interestRate`] =
              "This field is required";

          if (!b.noiActual)
            newErrors[`coBorrower_${index}_noiActual`] =
              "This field is required";

          if (!b.totalAssets)
            newErrors[`coBorrower_${index}_totalAssets`] =
              "This field is required";

          if (!b.totalLiabilities)
            newErrors[`coBorrower_${index}_totalLiabilities`] =
              "This field is required";
        });
      }

      if (isBroker) {
        REQUIRED_BROKER_FIELDS.forEach((key) => {
          if (!staticValues[key]) {
            newErrors[key] = "This field is required";
          }
        });
      } else {
        REQUIRED_BORROWER_FIELDS.forEach((key) => {
          if (!staticValues[key]) {
            newErrors[key] = "This field is required";
          }
        });
      }

      if (!staticValues.currentMarketValue)
        newErrors.currentMarketValue = "This field is required";

      if (!staticValues.purchasePrice)
        newErrors.purchasePrice = "This field is required";

      if (!staticValues.interestRate)
        newErrors.interestRate = "This field is required";

      if (!staticValues.noiActual)
        newErrors.noiActual = "This field is required";

      if (!staticValues.totalAssets)
        newErrors.totalAssets = "This field is required";

      if (!staticValues.totalLiabilities)
        newErrors.totalLiabilities = "This field is required";

      /* ================= EMAIL VALIDATION ================= */

      if (staticValues.email && !EMAIL_REGEX.test(staticValues.email)) {
        newErrors.email = "Please enter a valid email address";
      }

      if (
        staticValues.borrowerEmail &&
        !EMAIL_REGEX.test(staticValues.borrowerEmail)
      ) {
        newErrors.borrowerEmail = "Please enter a valid email address";
      }

      if (
        staticValues.borrowerCellPhone &&
        !US_PHONE_REGEX.test(staticValues.borrowerCellPhone)
      ) {
        newErrors.borrowerCellPhone = "Enter a valid US phone number";
      }

      if (staticValues.phone && !US_PHONE_REGEX.test(staticValues.phone)) {
        newErrors.phone = "Enter a valid US phone number";
      }

      if (
        staticValues.minTermMonths &&
        staticValues.maxTermMonths &&
        Number(staticValues.minTermMonths) > Number(staticValues.maxTermMonths)
      ) {
        newErrors.maxTermMonths =
          "Maximum term must be greater than minimum term";
      }

      /* ================= DYNAMIC VALIDATION ================= */

      const getAllDynamicFields = () => {
        return [
          ...(activeProduct?.fields || []),
          ...(activeProduct?.unsectionedFields || []),
          ...(activeProduct?.sections || []).flatMap((s) => s.fields || []),
        ];
      };

      const allDynamicFields = getAllDynamicFields();

      allDynamicFields.forEach((field) => {
        const value = dynamicValues[field.fieldId];

        if (!field.required) return;

        if (field.type === "FILE") return;

        if (
          field.required &&
          (value === undefined ||
            value === null ||
            value === "" ||
            (Array.isArray(value) && value.length === 0))
        ) {
          newErrors[field.fieldId] = `${field.label} is required`;
        }

        if (field.type === "EMAIL" && value && !EMAIL_REGEX.test(value)) {
          newErrors[field.fieldId] = "Please enter a valid email address";
        }
      });

      /* ================= STOP IF ERRORS ================= */
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        toast.error("Please fill all required fields");
        return;
      }

      setErrors({});

      const normalizedStaticValues = { ...staticValues };

      // Remove ALL raw role-specific fields first
      delete normalizedStaticValues.brokerLoanAmount;
      delete normalizedStaticValues.brokerState;
      delete normalizedStaticValues.brokerCity;

      delete normalizedStaticValues.borrowerLoanAmount;
      delete normalizedStaticValues.borrowerState;
      delete normalizedStaticValues.borrowerCity;

      if (isBroker === true) {
        normalizedStaticValues.amountRequested = staticValues.brokerLoanAmount;
        normalizedStaticValues.state = staticValues.brokerState;
        normalizedStaticValues.city = staticValues.brokerCity;
      } else {
        normalizedStaticValues.amountRequested =
          staticValues.borrowerLoanAmount;
        normalizedStaticValues.state = staticValues.borrowerState;
        normalizedStaticValues.city = staticValues.borrowerCity;

        normalizedStaticValues.email = staticValues.borrowerEmail;
        normalizedStaticValues.firstName = staticValues.borrowerFirstName;
        normalizedStaticValues.lastName = staticValues.borrowerLastName;
      }

      /* ================= CALCULATED STATS (STATIC) ================= */

      const loanAmount = toNumber(
        isBroker
          ? staticValues.brokerLoanAmount
          : staticValues.borrowerLoanAmount,
      );

      const marketValue = toNumber(staticValues.currentMarketValue);
      const purchasePrice = toNumber(staticValues.purchasePrice);
      const interestRate = toNumber(staticValues.interestRate);
      const termMonths = toNumber(staticValues.maxTermMonths);
      const noiActual = toNumber(staticValues.noiActual);

      const borrowerAssets = toNumber(staticValues.totalAssets);
      const borrowerLiabilities = toNumber(staticValues.totalLiabilities);

      const netWorth = borrowerAssets - borrowerLiabilities;

      const ltv =
        marketValue > 0 ? ((loanAmount / marketValue) * 100).toFixed(2) : 0;

      const ltc =
        purchasePrice > 0 ? ((loanAmount / purchasePrice) * 100).toFixed(2) : 0;

      const arv =
        marketValue > 0 ? ((loanAmount / marketValue) * 100).toFixed(2) : 0;

      const annualDebtService = calculateAnnualDebtService(
        loanAmount,
        interestRate,
        termMonths,
      );

      const dscr =
        annualDebtService > 0 ? (noiActual / annualDebtService).toFixed(2) : 0;

      /* ================= BUILD JSON PAYLOAD ================= */

      const fields = [];

      // static fields
      Object.entries(normalizedStaticValues).forEach(([fieldKey, value]) => {
        if (value !== "" && value !== undefined) {
          fields.push({ fieldKey, value });
        }
      });

      coBorrowers.forEach((borrower, index) => {
        Object.entries(borrower).forEach(([key, value]) => {
          if (key === "id") return;
          if (value === "" || value === undefined) return;

          fields.push({
            fieldKey: `coBorrower_${index + 1}_${key}`,
            value,
          });
        });
      });

      // borrower signature name
      fields.push({
        fieldKey: "borrowerSignatureName",
        value: borrowerSignName,
      });

      // signature (base64 string)
      if (signatureData) {
        fields.push({
          fieldKey: "borrowerSignature",
          value: signatureData,
        });
      }

      // loan product code
      if (activeProduct?.loanProductCode) {
        fields.push({
          fieldKey: "loanProductCode",
          value: activeProduct.loanProductCode,
        });
      }

      /* ================= ADD CALCULATED FIELDS ================= */

      fields.push({ fieldKey: "ltvPercentage", value: Number(ltv) });
      fields.push({ fieldKey: "ltcPercentage", value: Number(ltc) });
      fields.push({ fieldKey: "arvPercentage", value: Number(arv) });
      fields.push({ fieldKey: "dscr", value: Number(dscr) });
      fields.push({ fieldKey: "totalAssets", value: borrowerAssets });
      fields.push({ fieldKey: "totalLiabilities", value: borrowerLiabilities });
      fields.push({ fieldKey: "netWorth", value: netWorth });

      // dynamic fields (NO FILES)
      Object.entries(dynamicValues).forEach(([fieldId, value]) => {
        if (value === "" || value === undefined) return;
        if (value instanceof File) return;

        const fieldMeta = [
          ...(activeProduct?.unsectionedFields || []),
          ...(activeProduct?.sections || []).flatMap((s) => s.fields || []),
        ].find((f) => f.fieldId === fieldId);

        fields.push({
          fieldId,
          fieldKey: fieldMeta?.fieldKey || fieldMeta?.label || fieldId,
          value,
        });
      });

      const payload = {
        applicationId,
        applicationProductId: activeProduct.productId,
        captchaToken: recaptchaToken,
        fields,
      };

      console.log("FINAL JSON PAYLOAD:", payload);

      /* ================= API CALL ================= */

      const res = await fetch(
        `${API_BASE}/api/public/broker/applications/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const json = await safeJson(res);

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Submission failed");
      }

      toast.success("Application submitted successfully 🎉");
      console.log("Submission ID:", json.data.submissionId);
      resetForm();
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    }
  };

  const handleAddCoBorrower = () => {
    const newId = Date.now();

    setCoBorrowers((prev) => [
      ...prev,
      {
        id: newId,
        firstName: "",
        lastName: "",
        email: "",
        cellPhone: "",
        creditScore: "",

        // Financial Details
        currentMarketValue: "",
        purchasePrice: "",
        interestRate: "",
        noiActual: "",
        totalAssets: "",
        totalLiabilities: "",
      },
    ]);

    // Scroll after render
    setTimeout(() => {
      coBorrowerRefs.current[newId]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  };

  const handleRemoveCoBorrower = (id) => {
    setCoBorrowers((prev) => {
      const updated = prev.filter((b) => b.id !== id);

      // Clear coBorrower related errors
      setErrors((prevErrors) => {
        const cleanedErrors = { ...prevErrors };

        Object.keys(cleanedErrors).forEach((key) => {
          if (key.startsWith("coBorrower_")) {
            delete cleanedErrors[key];
          }
        });

        return cleanedErrors;
      });

      return updated;
    });
  };

  const updateCoBorrower = (id, field, value) => {
    setCoBorrowers((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    );
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
      <div className="max-w-5xl mx-auto px-4">
        {/* Heading */}
        <h1 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-6">
          This is our quick app to help us determine eligibility, available loan
          options & structure various loan terms for you.
        </h1>

        {/* ================= CARD ================= */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-slate-200 dark:border-slate-800">
          {/* ================= BROKER SECTION ================= */}
          <SectionHeader title="Loan Officer / Broker" />

          <div className="p-6 space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg flex items-center justify-between border border-slate-200 dark:border-slate-700">
              <span className="font-medium text-xs text-slate-800 dark:text-slate-200">
                Are you a Mortgage Broker OR working WITH ONE?
              </span>

              <div className="flex items-center gap-6">
                <Radio
                  label="Yes"
                  checked={isBroker === true}
                  onChange={() => {
                    setIsBroker(true);
                    setErrors({});

                    // RESET EVERYTHING
                    setStaticValues({
                      ...getInitialStaticValues(),
                      isBroker: true,
                    });

                    // CLEAR ALL CO BORROWERS
                    setCoBorrowers([]);
                  }}
                />

                <Radio
                  label="No"
                  checked={isBroker === false}
                  onChange={() => {
                    setIsBroker(false);
                    setErrors({});

                    // RESET EVERYTHING
                    setStaticValues({
                      ...getInitialStaticValues(),
                      isBroker: false,
                    });

                    // CLEAR ALL CO BORROWERS
                    setCoBorrowers([]);
                  }}
                />
              </div>
            </div>

            {isBroker === false && (
              <>
                <SectionHeader title="Borrower Info" />

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="First Name"
                      value={staticValues.borrowerFirstName}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          borrowerFirstName: e.target.value,
                        }))
                      }
                      error={errors.borrowerFirstName}
                    />
                    <Input
                      label="Last Name"
                      value={staticValues.borrowerLastName}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          borrowerLastName: e.target.value,
                        }))
                      }
                      error={errors.borrowerLastName}
                    />
                    <Input
                      label="Borrower Email"
                      value={staticValues.borrowerEmail}
                      onChange={(e) => {
                        setStaticValues((p) => ({
                          ...p,
                          borrowerEmail: e.target.value,
                        }));
                        setErrors((err) => ({
                          ...err,
                          borrowerEmail: undefined,
                        }));
                      }}
                      type="email"
                      error={errors.borrowerEmail}
                    />
                    <Input
                      label="Cell Phone"
                      placeholder="(___) ___-____"
                      value={staticValues.borrowerCellPhone}
                      onChange={(e) => {
                        const value = e.target.value;

                        setStaticValues((p) => ({
                          ...p,
                          borrowerCellPhone: value,
                        }));

                        if (!value || US_PHONE_REGEX.test(value)) {
                          setErrors((prev) => ({
                            ...prev,
                            borrowerCellPhone: undefined,
                          }));
                        }
                      }}
                      type="tel"
                      error={errors.borrowerCellPhone}
                    />
                  </div>

                  {/* Co Borrower Toggle */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">Co-Borrowers</span>

                    <button
                      type="button"
                      onClick={handleAddCoBorrower}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded cursor-pointer"
                    >
                      + Add Co-Borrower
                    </button>
                  </div>

                  {/* ================= PERSONAL INFO ================= */}
                  <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Personal Info
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Citizenship */}
                    <div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-2">
                        Citizenship <span className="text-red-500">*</span>
                      </label>

                      <div
                        className={`grid grid-cols-2 gap-3 text-xs rounded-lg p-3 border
      ${
        errors.citizenship
          ? "border-red-500 bg-red-50 dark:bg-red-900/10"
          : "border-slate-200 dark:border-slate-700"
      }
    `}
                      >
                        <Radio
                          label="U.S. Citizen"
                          name="static_citizen"
                          checked={staticValues.citizenship === "us_citizen"}
                          onChange={() => {
                            setStaticValues((p) => ({
                              ...p,
                              citizenship: "us_citizen",
                            }));
                            setErrors((e) => ({
                              ...e,
                              citizenship: undefined,
                            }));
                          }}
                        />

                        <Radio
                          label="Perm Resident"
                          name="static_citizen"
                          checked={
                            staticValues.citizenship === "permanent_resident"
                          }
                          onChange={() => {
                            setStaticValues((p) => ({
                              ...p,
                              citizenship: "permanent_resident",
                            }));
                            setErrors((e) => ({
                              ...e,
                              citizenship: undefined,
                            }));
                          }}
                        />

                        <Radio
                          label="Non-Perm Resident"
                          name="static_citizen"
                          checked={
                            staticValues.citizenship ===
                            "non_permanent_resident"
                          }
                          onChange={() => {
                            setStaticValues((p) => ({
                              ...p,
                              citizenship: "non_permanent_resident",
                            }));
                            setErrors((e) => ({
                              ...e,
                              citizenship: undefined,
                            }));
                          }}
                        />

                        <Radio
                          label="Foreign National"
                          name="static_citizen"
                          checked={
                            staticValues.citizenship === "foreign_national"
                          }
                          onChange={() => {
                            setStaticValues((p) => ({
                              ...p,
                              citizenship: "foreign_national",
                            }));
                            setErrors((e) => ({
                              ...e,
                              citizenship: undefined,
                            }));
                          }}
                        />
                      </div>

                      {errors.citizenship && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.citizenship}
                        </p>
                      )}
                    </div>

                    {/* Credit Score */}
                    <Select
                      label="Credit Score Range"
                      value={staticValues.creditScoreRange || ""}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          creditScoreRange: e.target.value,
                        }))
                      }
                      error={errors.creditScoreRange}
                    >
                      <option value="">- Select Credit Score Range -</option>
                      {CREDIT_SCORE_RANGES.map((score) => (
                        <option key={score.value} value={score.value}>
                          {score.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {coBorrowers.map((borrower, index) => (
                    <div
                      key={borrower.id}
                      ref={(el) => {
                        if (el) coBorrowerRefs.current[borrower.id] = el;
                      }}
                      className="border border-blue-200 rounded-xl p-6 bg-slate-50 space-y-4 mt-4"
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-xs">
                          Co-Borrower {index + 1}
                        </h3>

                        <button
                          type="button"
                          onClick={() => handleRemoveCoBorrower(borrower.id)}
                          className="text-red-500 hover:text-red-600 text-xs cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          label="First Name"
                          value={borrower.firstName}
                          onChange={(e) =>
                            updateCoBorrower(
                              borrower.id,
                              "firstName",
                              e.target.value,
                            )
                          }
                          error={errors[`coBorrower_${index}_firstName`]}
                        />

                        <Input
                          label="Last Name"
                          value={borrower.lastName}
                          onChange={(e) =>
                            updateCoBorrower(
                              borrower.id,
                              "lastName",
                              e.target.value,
                            )
                          }
                          error={errors[`coBorrower_${index}_lastName`]}
                        />

                        <Input
                          label="Email"
                          type="email"
                          value={borrower.email}
                          onChange={(e) =>
                            updateCoBorrower(
                              borrower.id,
                              "email",
                              e.target.value,
                            )
                          }
                          error={errors[`coBorrower_${index}_email`]}
                        />

                        <Input
                          label="Cell Phone"
                          value={borrower.cellPhone}
                          onChange={(e) =>
                            updateCoBorrower(
                              borrower.id,
                              "cellPhone",
                              e.target.value,
                            )
                          }
                          error={errors[`coBorrower_${index}_cellPhone`]}
                        />

                        <Select
                          label="Credit Score"
                          value={borrower.creditScore}
                          onChange={(e) =>
                            updateCoBorrower(
                              borrower.id,
                              "creditScore",
                              e.target.value,
                            )
                          }
                          error={errors[`coBorrower_${index}_creditScore`]}
                        >
                          <option value="">Select</option>
                          {PERSONAL_CREDIT_SCORE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>

                        <div className="col-span-2 mt-4">
                          <div className="bg-slate-100 px-3 py-2 rounded text-xs font-semibold text-slate-700">
                            Financial Details
                          </div>
                        </div>

                        <Input
                          label="Current Market Value"
                          type="number"
                          value={borrower.currentMarketValue}
                          onChange={(e) =>
                            updateCoBorrower(
                              borrower.id,
                              "currentMarketValue",
                              e.target.value,
                            )
                          }
                          error={
                            errors[`coBorrower_${index}_currentMarketValue`]
                          }
                        />

                        <Input
                          label="Purchase Price"
                          type="number"
                          value={borrower.purchasePrice}
                          onChange={(e) =>
                            updateCoBorrower(
                              borrower.id,
                              "purchasePrice",
                              e.target.value,
                            )
                          }
                          error={errors[`coBorrower_${index}_purchasePrice`]}
                        />

                        <Input
                          label="Interest Rate (%)"
                          type="number"
                          value={borrower.interestRate}
                          onChange={(e) =>
                            updateCoBorrower(
                              borrower.id,
                              "interestRate",
                              e.target.value,
                            )
                          }
                          error={errors[`coBorrower_${index}_interestRate`]}
                        />

                        <Input
                          label="NOI (Annual Net Operating Income)"
                          type="number"
                          value={borrower.noiActual}
                          onChange={(e) =>
                            updateCoBorrower(
                              borrower.id,
                              "noiActual",
                              e.target.value,
                            )
                          }
                          error={errors[`coBorrower_${index}_noiActual`]}
                        />

                        <Input
                          label="Total Assets"
                          type="number"
                          value={borrower.totalAssets}
                          onChange={(e) =>
                            updateCoBorrower(
                              borrower.id,
                              "totalAssets",
                              e.target.value,
                            )
                          }
                          error={errors[`coBorrower_${index}_totalAssets`]}
                        />

                        <Input
                          label="Total Liabilities"
                          type="number"
                          value={borrower.totalLiabilities}
                          onChange={(e) =>
                            updateCoBorrower(
                              borrower.id,
                              "totalLiabilities",
                              e.target.value,
                            )
                          }
                          error={errors[`coBorrower_${index}_totalLiabilities`]}
                        />
                      </div>
                    </div>
                  ))}
                  {/* ================= PRODUCT DYNAMIC FIELDS ================= */}
                  {isBroker === false &&
                    activeProduct &&
                    activeProduct.fields &&
                    activeProduct.fields.length > 0 && (
                      <div className="mt-6">
                        <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 mb-4">
                          Additional Information
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {activeProduct.fields.map((field) => (
                            <div key={field.fieldId} className="space-y-1">
                              <label className="text-xs text-slate-700 dark:text-slate-300">
                                {field.label}
                                {field.required && (
                                  <span className="text-red-500 ml-1">*</span>
                                )}
                              </label>
                              {renderField(
                                field,
                                dynamicValues,
                                setDynamicValues,
                              )}
                              {errors[field.fieldId] && (
                                <p className="mt-1 text-xs text-red-500">
                                  {errors[field.fieldId]}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          leadSource: e.target.value,
                        }))
                      }
                    >
                      <option value="">- Select Lead Source -</option>
                      {LEAD_SOURCES.map((src) => (
                        <option key={src.value} value={src.value}>
                          {src.label}
                        </option>
                      ))}
                    </Select>

                    <Input
                      label="Minimum Loan Term (Months)"
                      placeholder="e.g. 12"
                      type="number"
                      value={staticValues.minTermMonths}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          minTermMonths: e.target.value,
                        }))
                      }
                      error={errors.minTermMonths}
                    />

                    <Input
                      label="Maximum Loan Term (Months)"
                      placeholder="e.g. 60"
                      type="number"
                      value={staticValues.maxTermMonths}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          maxTermMonths: e.target.value,
                        }))
                      }
                      error={errors.maxTermMonths}
                    />
                  </div>

                  <div className="h-px bg-slate-200 dark:bg-slate-700" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Loan Amount"
                      placeholder="Enter Loan Amount"
                      value={staticValues.borrowerLoanAmount}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          borrowerLoanAmount: e.target.value,
                        }))
                      }
                      type="number"
                      error={errors.borrowerLoanAmount}
                    />
                    <Input
                      label="City"
                      placeholder="Enter City"
                      value={staticValues.borrowerCity}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          borrowerCity: e.target.value,
                        }))
                      }
                      error={errors.borrowerCity}
                    />
                    <Select
                      label="State"
                      value={staticValues.borrowerState || ""}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          borrowerState: e.target.value,
                        }))
                      }
                      error={errors.borrowerState}
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

                  <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Financial Details (For Qualification)
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Current Market Value"
                      type="number"
                      value={staticValues.currentMarketValue}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          currentMarketValue: e.target.value,
                        }))
                      }
                      error={errors.currentMarketValue}
                    />

                    <Input
                      label="Purchase Price"
                      type="number"
                      value={staticValues.purchasePrice}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          purchasePrice: e.target.value,
                        }))
                      }
                      error={errors.purchasePrice}
                    />

                    <Input
                      label="Interest Rate (%)"
                      type="number"
                      value={staticValues.interestRate}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          interestRate: e.target.value,
                        }))
                      }
                      error={errors.interestRate}
                    />

                    <Input
                      label="NOI (Annual Net Operating Income)"
                      type="number"
                      value={staticValues.noiActual}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          noiActual: e.target.value,
                        }))
                      }
                      error={errors.noiActual}
                    />

                    <Input
                      label="Total Assets"
                      type="number"
                      value={staticValues.totalAssets}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          totalAssets: e.target.value,
                        }))
                      }
                      error={errors.totalAssets}
                    />

                    <Input
                      label="Total Liabilities"
                      type="number"
                      value={staticValues.totalLiabilities}
                      onChange={(e) =>
                        setStaticValues((p) => ({
                          ...p,
                          totalLiabilities: e.target.value,
                        }))
                      }
                      error={errors.totalLiabilities}
                    />
                  </div>
                </div>

                {/* ================= PRODUCT DYNAMIC SECTIONS ================= */}
                {isBroker === false &&
                  activeProduct &&
                  activeProduct.sections &&
                  activeProduct.sections.length > 0 && (
                    <div className="p-6 space-y-8">
                      {activeProduct.sections
                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                        .map((section) => (
                          <div key={section.sectionId}>
                            {/* Section Title */}
                            <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 mb-4">
                              {section.sectionName}
                            </div>

                            {/* Fields Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {section.fields.map((field) => (
                                <div key={field.fieldId} className="space-y-1">
                                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                    {field.label}
                                    {field.required && (
                                      <span className="text-red-500 ml-1">
                                        *
                                      </span>
                                    )}
                                  </label>

                                  {renderField(
                                    field,
                                    dynamicValues,
                                    setDynamicValues,
                                  )}
                                  {errors[field.fieldId] && (
                                    <p className="mt-1 text-xs text-red-500">
                                      {errors[field.fieldId]}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                {/* ================= PRODUCT UNSECTIONED FIELDS ================= */}
                {isBroker === false &&
                  activeProduct &&
                  activeProduct.unsectionedFields &&
                  activeProduct.unsectionedFields.length > 0 && (
                    <div className="p-6 space-y-6">
                      <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Additional Information
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeProduct.unsectionedFields.map((field) => (
                          <div key={field.fieldId} className="space-y-1">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {field.label}
                              {field.required && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                            </label>

                            {renderField(
                              field,
                              dynamicValues,
                              setDynamicValues,
                            )}
                            {errors[field.fieldId] && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors[field.fieldId]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}

            {isBroker === true && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Email Address"
                    placeholder="Enter Email Address"
                    value={staticValues.email}
                    onChange={(e) => {
                      setStaticValues((p) => ({ ...p, email: e.target.value }));
                      setErrors((err) => ({ ...err, email: undefined }));
                    }}
                    type="email"
                    error={errors.email}
                  />
                  <Input
                    label="Phone Number"
                    placeholder="(___) ___-____"
                    value={staticValues.phone}
                    onChange={(e) => {
                      const value = e.target.value;

                      setStaticValues((p) => ({
                        ...p,
                        phone: value,
                      }));

                      if (!value || US_PHONE_REGEX.test(value)) {
                        setErrors((prev) => ({
                          ...prev,
                          phone: undefined,
                        }));
                      }
                    }}
                    type="tel"
                    error={errors.phone}
                  />
                  <Input
                    label="First Name"
                    placeholder="Enter First Name"
                    value={staticValues.firstName}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        firstName: e.target.value,
                      }))
                    }
                    error={errors.firstName}
                  />
                  <Input
                    label="Last Name"
                    placeholder="Enter Last Name"
                    value={staticValues.lastName}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        lastName: e.target.value,
                      }))
                    }
                    error={errors.lastName}
                  />
                  <Input
                    label="Company Name"
                    placeholder="Enter Company Name"
                    value={staticValues.companyName}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        companyName: e.target.value,
                      }))
                    }
                    error={errors.companyName}
                  />
                  <Input
                    label="City"
                    placeholder="Enter City"
                    value={staticValues.brokerCity}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        brokerCity: e.target.value,
                      }))
                    }
                    error={errors.brokerCity}
                  />
                  <Input
                    label="Loan Amount"
                    placeholder="Enter Loan Amount"
                    value={staticValues.brokerLoanAmount}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        brokerLoanAmount: e.target.value,
                      }))
                    }
                    type="number"
                    error={errors.brokerLoanAmount}
                  />
                  <Select
                    label="State"
                    value={staticValues.brokerState || ""}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        brokerState: e.target.value,
                      }))
                    }
                    error={errors.brokerState}
                  >
                    <option value="">- Select State -</option>
                    {STATES.map((state, i) => (
                      <option key={i} value={state}>
                        {state}
                      </option>
                    ))}
                  </Select>

                  <Input
                    label="Minimum Loan Term (Months)"
                    placeholder="e.g. 12"
                    type="number"
                    value={staticValues.minTermMonths}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        minTermMonths: e.target.value,
                      }))
                    }
                    error={errors.minTermMonths}
                  />

                  <Input
                    label="Maximum Loan Term (Months)"
                    placeholder="e.g. 60"
                    type="number"
                    value={staticValues.maxTermMonths}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        maxTermMonths: e.target.value,
                      }))
                    }
                    error={errors.maxTermMonths}
                  />
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
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        leadSource: e.target.value,
                      }))
                    }
                  >
                    <option value="">- Select Lead Source -</option>
                    {LEAD_SOURCES.map((src) => (
                      <option key={src.value} value={src.value}>
                        {src.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="h-px bg-slate-200 dark:bg-slate-700" />

                <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Financial Details (For Qualification)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Current Market Value"
                    type="number"
                    value={staticValues.currentMarketValue}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        currentMarketValue: e.target.value,
                      }))
                    }
                    error={errors.currentMarketValue}
                  />

                  <Input
                    label="Purchase Price"
                    type="number"
                    value={staticValues.purchasePrice}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        purchasePrice: e.target.value,
                      }))
                    }
                    error={errors.purchasePrice}
                  />

                  <Input
                    label="Interest Rate (%)"
                    type="number"
                    value={staticValues.interestRate}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        interestRate: e.target.value,
                      }))
                    }
                    error={errors.interestRate}
                  />

                  <Input
                    label="NOI (Annual Net Operating Income)"
                    type="number"
                    value={staticValues.noiActual}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        noiActual: e.target.value,
                      }))
                    }
                    error={errors.noiActual}
                  />

                  <Input
                    label="Total Assets"
                    type="number"
                    value={staticValues.totalAssets}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        totalAssets: e.target.value,
                      }))
                    }
                    error={errors.totalAssets}
                  />

                  <Input
                    label="Total Liabilities"
                    type="number"
                    value={staticValues.totalLiabilities}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        totalLiabilities: e.target.value,
                      }))
                    }
                    error={errors.totalLiabilities}
                  />
                </div>

                {/* ================= PRODUCT DYNAMIC FIELDS ================= */}
                {isBroker === true &&
                  activeProduct &&
                  activeProduct.fields &&
                  activeProduct.fields.length > 0 && (
                    <div className="mt-6">
                      <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 mb-4">
                        Additional Information
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeProduct.fields.map((field) => (
                          <div key={field.fieldId} className="space-y-1">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {field.label}
                              {field.required && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                            </label>
                            {renderField(
                              field,
                              dynamicValues,
                              setDynamicValues,
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>

          {/* ================= BORROWER INFO ================= */}
          {isBroker && (
            <>
              <SectionHeader title="Borrower Info" />

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={staticValues.borrowerFirstName}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        borrowerFirstName: e.target.value,
                      }))
                    }
                    error={errors.borrowerFirstName}
                  />
                  <Input
                    label="Last Name"
                    value={staticValues.borrowerLastName}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        borrowerLastName: e.target.value,
                      }))
                    }
                    error={errors.borrowerLastName}
                  />
                  <Input
                    label="Borrower Email"
                    value={staticValues.borrowerEmail}
                    onChange={(e) => {
                      setStaticValues((p) => ({
                        ...p,
                        borrowerEmail: e.target.value,
                      }));
                      setErrors((err) => ({
                        ...err,
                        borrowerEmail: undefined,
                      }));
                    }}
                    type="email"
                    error={errors.borrowerEmail}
                  />
                  <Input
                    label="Cell Phone"
                    placeholder="(___) ___-____"
                    value={staticValues.borrowerCellPhone}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        borrowerCellPhone: e.target.value,
                      }))
                    }
                    type="tel"
                    error={errors.borrowerCellPhone}
                  />
                </div>

                {/* Co Borrower Toggle */}
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium">Co-Borrowers</span>

                  <button
                    type="button"
                    onClick={handleAddCoBorrower}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded cursor-pointer"
                  >
                    + Add Co-Borrower
                  </button>
                </div>

                {/* ================= PERSONAL INFO ================= */}
                <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Personal Info
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Citizenship */}
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-2">
                      Citizenship <span className="text-red-500">*</span>
                    </label>

                    <div
                      className={`grid grid-cols-2 gap-3 text-xs rounded-lg p-3 border
      ${
        errors.citizenship
          ? "border-red-500 bg-red-50 dark:bg-red-900/10"
          : "border-slate-200 dark:border-slate-700"
      }
    `}
                    >
                      <Radio
                        label="U.S. Citizen"
                        name="static_citizen"
                        checked={staticValues.citizenship === "us_citizen"}
                        onChange={() => {
                          setStaticValues((p) => ({
                            ...p,
                            citizenship: "us_citizen",
                          }));
                          setErrors((e) => ({ ...e, citizenship: undefined }));
                        }}
                      />

                      <Radio
                        label="Perm Resident"
                        name="static_citizen"
                        checked={
                          staticValues.citizenship === "permanent_resident"
                        }
                        onChange={() => {
                          setStaticValues((p) => ({
                            ...p,
                            citizenship: "permanent_resident",
                          }));
                          setErrors((e) => ({ ...e, citizenship: undefined }));
                        }}
                      />

                      <Radio
                        label="Non-Perm Resident"
                        name="static_citizen"
                        checked={
                          staticValues.citizenship === "non_permanent_resident"
                        }
                        onChange={() => {
                          setStaticValues((p) => ({
                            ...p,
                            citizenship: "non_permanent_resident",
                          }));
                          setErrors((e) => ({ ...e, citizenship: undefined }));
                        }}
                      />

                      <Radio
                        label="Foreign National"
                        name="static_citizen"
                        checked={
                          staticValues.citizenship === "foreign_national"
                        }
                        onChange={() => {
                          setStaticValues((p) => ({
                            ...p,
                            citizenship: "foreign_national",
                          }));
                          setErrors((e) => ({ ...e, citizenship: undefined }));
                        }}
                      />
                    </div>

                    {errors.citizenship && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.citizenship}
                      </p>
                    )}
                  </div>

                  {/* Credit Score */}
                  <Select
                    label="Credit Score Range"
                    value={staticValues.creditScoreRange || ""}
                    onChange={(e) =>
                      setStaticValues((p) => ({
                        ...p,
                        creditScoreRange: e.target.value,
                      }))
                    }
                    error={errors.creditScoreRange}
                  >
                    <option value="">- Select Credit Score Range -</option>
                    {CREDIT_SCORE_RANGES.map((score) => (
                      <option key={score.value} value={score.value}>
                        {score.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {coBorrowers.map((borrower, index) => (
                  <div
                    key={borrower.id}
                    ref={(el) => {
                      if (el) coBorrowerRefs.current[borrower.id] = el;
                    }}
                    className="border border-blue-200 rounded-xl p-6 bg-slate-50 space-y-4 mt-4"
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-xs">
                        Co-Borrower {index + 1}
                      </h3>

                      <button
                        type="button"
                        onClick={() => handleRemoveCoBorrower(borrower.id)}
                        className="text-red-500 hover:text-red-600 text-xs cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="First Name"
                        value={borrower.firstName}
                        onChange={(e) =>
                          updateCoBorrower(
                            borrower.id,
                            "firstName",
                            e.target.value,
                          )
                        }
                        error={errors[`coBorrower_${index}_firstName`]}
                      />

                      <Input
                        label="Last Name"
                        value={borrower.lastName}
                        onChange={(e) =>
                          updateCoBorrower(
                            borrower.id,
                            "lastName",
                            e.target.value,
                          )
                        }
                        error={errors[`coBorrower_${index}_lastName`]}
                      />

                      <Input
                        label="Email"
                        type="email"
                        value={borrower.email}
                        onChange={(e) =>
                          updateCoBorrower(borrower.id, "email", e.target.value)
                        }
                        error={errors[`coBorrower_${index}_email`]}
                      />

                      <Input
                        label="Cell Phone"
                        type="tel"
                        value={borrower.cellPhone}
                        onChange={(e) => {
                          const value = e.target.value;

                          updateCoBorrower(borrower.id, "cellPhone", value);

                          if (!value || US_PHONE_REGEX.test(value)) {
                            setErrors((prev) => ({
                              ...prev,
                              [`coBorrower_${index}_cellPhone`]: undefined,
                            }));
                          }
                        }}
                        error={errors[`coBorrower_${index}_cellPhone`]}
                      />

                      <Select
                        label="Credit Score"
                        value={borrower.creditScore}
                        onChange={(e) =>
                          updateCoBorrower(
                            borrower.id,
                            "creditScore",
                            e.target.value,
                          )
                        }
                        error={errors[`coBorrower_${index}_creditScore`]}
                      >
                        <option value="">Select</option>
                        {PERSONAL_CREDIT_SCORE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>

                      <div className="col-span-2 mt-4">
                        <div className="bg-slate-100 px-3 py-2 rounded text-xs font-semibold text-slate-700">
                          Financial Details
                        </div>
                      </div>

                      <Input
                        label="Current Market Value"
                        type="number"
                        value={borrower.currentMarketValue}
                        onChange={(e) =>
                          updateCoBorrower(
                            borrower.id,
                            "currentMarketValue",
                            e.target.value,
                          )
                        }
                        error={errors[`coBorrower_${index}_currentMarketValue`]}
                      />

                      <Input
                        label="Purchase Price"
                        type="number"
                        value={borrower.purchasePrice}
                        onChange={(e) =>
                          updateCoBorrower(
                            borrower.id,
                            "purchasePrice",
                            e.target.value,
                          )
                        }
                        error={errors[`coBorrower_${index}_purchasePrice`]}
                      />

                      <Input
                        label="Interest Rate (%)"
                        type="number"
                        value={borrower.interestRate}
                        onChange={(e) =>
                          updateCoBorrower(
                            borrower.id,
                            "interestRate",
                            e.target.value,
                          )
                        }
                        error={errors[`coBorrower_${index}_interestRate`]}
                      />

                      <Input
                        label="NOI (Annual Net Operating Income)"
                        type="number"
                        value={borrower.noiActual}
                        onChange={(e) =>
                          updateCoBorrower(
                            borrower.id,
                            "noiActual",
                            e.target.value,
                          )
                        }
                        error={errors[`coBorrower_${index}_noiActual`]}
                      />

                      <Input
                        label="Total Assets"
                        type="number"
                        value={borrower.totalAssets}
                        onChange={(e) =>
                          updateCoBorrower(
                            borrower.id,
                            "totalAssets",
                            e.target.value,
                          )
                        }
                        error={errors[`coBorrower_${index}_totalAssets`]}
                      />

                      <Input
                        label="Total Liabilities"
                        type="number"
                        value={borrower.totalLiabilities}
                        onChange={(e) =>
                          updateCoBorrower(
                            borrower.id,
                            "totalLiabilities",
                            e.target.value,
                          )
                        }
                        error={errors[`coBorrower_${index}_totalLiabilities`]}
                      />
                    </div>
                  </div>
                ))}

                {/* ================= PRODUCT DYNAMIC FIELDS ================= */}
                {isBroker === true &&
                  activeProduct &&
                  activeProduct.fields &&
                  activeProduct.fields.length > 0 && (
                    <div className="mt-6">
                      <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 mb-4">
                        Additional Information
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeProduct.fields.map((field) => (
                          <div key={field.fieldId} className="space-y-1">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {field.label}
                              {field.required && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                            </label>
                            {renderField(
                              field,
                              dynamicValues,
                              setDynamicValues,
                            )}
                            {errors[field.fieldId] && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors[field.fieldId]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </>
          )}

          {/* ================= PRODUCT DYNAMIC SECTIONS ================= */}
          {isBroker === true &&
            activeProduct &&
            activeProduct.sections &&
            activeProduct.sections.length > 0 && (
              <div className="p-6 space-y-8">
                {activeProduct.sections
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map((section) => (
                    <div key={section.sectionId}>
                      {/* Section Title */}
                      <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 mb-4">
                        {section.sectionName}
                      </div>

                      {/* Fields Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {section.fields.map((field) => (
                          <div key={field.fieldId} className="space-y-1">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {field.label}
                              {field.required && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                            </label>

                            {renderField(
                              field,
                              dynamicValues,
                              setDynamicValues,
                            )}
                            {errors[field.fieldId] && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors[field.fieldId]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}

          {/* ================= PRODUCT UNSECTIONED FIELDS ================= */}
          {isBroker === true &&
            activeProduct &&
            activeProduct.unsectionedFields &&
            activeProduct.unsectionedFields.length > 0 && (
              <div className="p-6 space-y-6">
                <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Additional Information
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeProduct.unsectionedFields.map((field) => (
                    <div key={field.fieldId} className="space-y-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {field.label}
                        {field.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>

                      {renderField(field, dynamicValues, setDynamicValues)}
                      {errors[field.fieldId] && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors[field.fieldId]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* ================= TERMS & CONDITIONS ================= */}
          {isBroker !== null && (
            <>
              <SectionHeader title="Terms And Conditions" />

              <div className="p-6 space-y-6">
                {/* Terms text */}
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded text-xs text-blue-900 font-semibold dark:text-blue-200 border">
                  By submitting this application, you acknowledge that
                  everything is true and correct to the best of your knowledge.
                  If pre-approved, you authorize us to pull your credit report.
                  Certain fees, like an appraisal fee may not be refundable in
                  the event your loan does not close with us. Additionally you
                  agree to let us send text messages to your cell phone if
                  provided, you may opt out anytime replying with STOP.
                </div>

                {/* Agreement checkbox */}
                <label className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={agreed}
                    className="text-xs"
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      setStaticValues((p) => ({
                        ...p,
                        agreedToTerms: e.target.checked,
                      }));
                    }}
                    error={errors.borrowerFirstName}
                  />
                  By checking this box I agree to the terms and conditions.*
                </label>
                {errors.agreedToTerms && (
                  <p className="text-xs text-red-500">{errors.agreedToTerms}</p>
                )}

                {/* Borrower signature name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <Input
                    label="Name of Borrower Signing:"
                    value={borrowerSignName}
                    onChange={(e) => setBorrowerSignName(e.target.value)}
                    error={errors.borrowerSignatureName}
                  />
                </div>

                {/* ================= SIGNATURE ================= */}
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Borrower Signature <span className="text-red-500">*</span>
                  </label>

                  <div className="border rounded-lg bg-slate-100 dark:bg-slate-800">
                    <SignatureCanvas
                      ref={sigPadRef}
                      penColor="blue"
                      canvasProps={{
                        width: 900,
                        height: 250,
                        className: "signatureCanvas w-full",
                      }}
                      onEnd={() => {
                        const canvas = sigPadRef.current.getCanvas();
                        const dataUrl = canvas.toDataURL("image/png");

                        setSignatureData(dataUrl);
                        setSignatureHistory((prev) => [...prev, dataUrl]);
                        setErrors((e) => ({ ...e, signature: undefined }));
                      }}
                    />
                  </div>

                  <div className="flex gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        sigPadRef.current?.clear();
                        setSignatureHistory([]);
                        setSignatureData("");
                      }}
                      className="text-xs px-3 py-1 bg-slate-300 dark:bg-slate-700 rounded cursor-pointer"
                    >
                      Reset Signature
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSignatureHistory((prev) => {
                          if (!sigPadRef.current) return prev;

                          if (prev.length <= 1) {
                            sigPadRef.current.clear();
                            setSignatureData("");
                            return [];
                          }

                          const newHistory = prev.slice(0, -1);
                          const last = newHistory[newHistory.length - 1];

                          setSignatureData(last);

                          const img = new Image();
                          img.src = last;

                          img.onload = () => {
                            const canvas = sigPadRef.current.getCanvas();
                            const ctx = canvas.getContext("2d");
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0);
                          };

                          return newHistory;
                        });
                      }}
                      className="text-xs px-3 py-1 bg-slate-300 dark:bg-slate-700 rounded cursor-pointer"
                    >
                      Undo last stroke
                    </button>
                  </div>

                  {errors.signature && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.signature}
                    </p>
                  )}
                </div>

                {/* reCAPTCHA placeholder */}
                <div className="flex justify-center mt-6">
                  <div className="flex justify-center mt-6">
                    <ReCAPTCHA
                      sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                      onChange={(token) => setRecaptchaToken(token)}
                      onExpired={() => setRecaptchaToken(null)}
                    />
                  </div>
                </div>
              </div>

              {/* ================= FOOTER ================= */}
              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={
                    !borrowerSignName ||
                    !agreed ||
                    isBroker === null ||
                    !recaptchaToken ||
                    !signatureData
                  }
                  // disabled={!agreed || !borrowerSignName || sigPadRef.current?.isEmpty()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-semibold text-xs shadow cursor-pointer"
                >
                  Submit
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= COMPONENTS ================= */

function SectionHeader({ title }) {
  return (
    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-semibold text-xs flex items-center justify-between text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900">
      <span>{title}</span>
      <span className="text-blue-600 dark:text-blue-400">ⓘ</span>
    </div>
  );
}

function Input({
  label,
  placeholder = "",
  value,
  onChange,
  type = "text",
  error,
}) {
  const handleChange = (e) => {
    const val = e.target.value;

    // Negative block for number inputs
    if (type === "number" && val !== "" && Number(val) < 0) {
      return;
    }

    onChange(e);
  };

  return (
    <div>
      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {/* <span className="text-red-500">*</span> */}
      <input
        type={type}
        value={value || ""}
        onChange={handleChange}
        placeholder={placeholder}
        min={type === "number" ? 0 : undefined}
        onWheel={(e) => e.target.blur()}
        className="text-xs mt-1 w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Select({ label, value, onChange, children, error = "" }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        className="mt-1 w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Radio({ label, checked, onChange, name = "radio" }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

const renderField = (field, dynamicValues, setDynamicValues) => {
  const base =
    "w-full rounded-lg border px-3 py-2 text-xs bg-white text-slate-900 border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700";

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
        onChange={(e) => {
          setDynamicValues((p) => ({ ...p, [field.fieldId]: e.target.value }));
        }}
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
        min={field.validation?.min ?? 0}
        max={field.validation?.max}
        onWheel={(e) => e.target.blur()}
        onChange={(e) => {
          const val = e.target.value;

          // Negative block
          if (val !== "" && Number(val) < 0) return;

          setDynamicValues((p) => ({
            ...p,
            [field.fieldId]: val,
          }));
        }}
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
          <label key={i} className="flex items-center gap-2 text-xs">
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
      <label className="flex items-center gap-2 text-xs">
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
        onChange={(e) => {
          setDynamicValues((p) => ({
            ...p,
            [field.fieldId]: e.target.files?.[0],
          }));
          setErrors((err) => ({ ...err, [field.fieldId]: undefined }));
        }}
        className={base}
      />
    );
  }

  return <input className={base} />;
};
