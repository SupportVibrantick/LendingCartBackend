import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import LoiUnderwritingFormModal from "../../components/loi/LoiUnderwritingFormModal";
import { formatLoanProduct } from "../../lib/loanPipelineUtils";
import type { serializeLoiUnderwritingTerms } from "../../lib/loiUnderwritingTerms";
import {
  getLatestSubmission,
  getNumericFieldValue,
  mapLenderSubmissionFields,
  parseSubmissionFieldValue,
  type SubmissionDetailField,
} from "../../lib/submissionFieldUtils";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("lender_token");
  return token
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    : { "Content-Type": "application/json" };
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getFieldValueFromList(
  fields: SubmissionDetailField[],
  ...keys: string[]
) {
  const field = fields.find(
    (item) => item.fieldKey && keys.includes(item.fieldKey),
  );
  if (!field) return undefined;
  return parseSubmissionFieldValue(field.value);
}

function getBorrowerDisplayName(
  submissionDetail: any,
  fields: SubmissionDetailField[] = [],
) {
  const firstName = normalizeText(
    getFieldValueFromList(
      fields,
      "borrowerFirstName",
      "firstName",
      "first_name",
    ),
  );
  const lastName = normalizeText(
    getFieldValueFromList(
      fields,
      "borrowerLastName",
      "lastName",
      "last_name",
    ),
  );

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;

  const borrowerName = normalizeText(
    getFieldValueFromList(
      fields,
      "borrowerName",
      "applicantName",
      "fullName",
      "name",
    ),
  );
  if (borrowerName) return borrowerName;

  return (
    normalizeText(submissionDetail?.loanApplication?.borrowerName) ||
    normalizeText(submissionDetail?.borrowerName) ||
    "—"
  );
}

type LoiFormMode = "create" | "regenerate" | "revised";

export default function LoiUnderwritingFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const applicationLenderId =
    location.state?.applicationLenderId ||
    searchParams.get("applicationLenderId") ||
    "";

  const mode: LoiFormMode = (() => {
    const fromState = location.state?.mode;
    const fromQuery = searchParams.get("mode");
    const value = fromState || fromQuery || "create";
    if (value === "regenerate" || value === "revised") return value;
    return "create";
  })();

  const revisedVersionNumber =
    Number(location.state?.revisedVersionNumber) ||
    Number(searchParams.get("revisedVersionNumber")) ||
    undefined;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [loanProducts, setLoanProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!applicationLenderId) {
      toast.error("Missing application. Open LOI from Loan Preview.");
      navigate("/loan-pipeline", { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const [detailRes, productsRes] = await Promise.all([
          fetch(`${API_BASE}/lender/loan-pipeline/${applicationLenderId}`, {
            headers: getAuthHeaders(),
          }),
          fetch(`${API_BASE}/lender/loan-products/list?limit=100`, {
            headers: getAuthHeaders(),
          }),
        ]);

        const detailJson = await detailRes.json();
        if (!detailRes.ok || !detailJson.success) {
          throw new Error(detailJson.message || "Failed to load application");
        }

        if (!cancelled) {
          setSubmissionDetail(detailJson.data);
        }

        if (productsRes.ok) {
          const productsJson = await productsRes.json();
          if (!cancelled && productsJson.success) {
            setLoanProducts(productsJson.data || []);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load LOI form");
          navigate("/loan-preview/?tab=loi", {
            replace: true,
            state: { applicationLenderId, initialTab: "loi", isLoi: true },
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applicationLenderId, navigate]);

  const latestSubmission = useMemo(
    () =>
      submissionDetail?.latestSubmission ||
      getLatestSubmission(submissionDetail?.loanApplication?.submissions || []),
    [submissionDetail],
  );

  const submissionFields = useMemo(
    () => mapLenderSubmissionFields(latestSubmission?.fields || []),
    [latestSubmission],
  );

  const loanAmount = useMemo(
    () =>
      getNumericFieldValue(submissionFields, "amountRequested") ||
      Number(submissionDetail?.amountRequested) ||
      0,
    [submissionFields, submissionDetail?.amountRequested],
  );

  const interestRate = useMemo(
    () => getNumericFieldValue(submissionFields, "interestRate"),
    [submissionFields],
  );

  const loanTermMonths = useMemo(
    () => getNumericFieldValue(submissionFields, "loanTerm"),
    [submissionFields],
  );

  const propertyValue = useMemo(
    () =>
      getNumericFieldValue(submissionFields, "currentMarketValue") ||
      getNumericFieldValue(submissionFields, "collateralValue") ||
      getNumericFieldValue(submissionFields, "equipmentValue") ||
      getNumericFieldValue(submissionFields, "propertyValue") ||
      getNumericFieldValue(submissionFields, "purchasePrice") ||
      getNumericFieldValue(submissionFields, "appraisedValue") ||
      getNumericFieldValue(submissionFields, "afterRepairValue") ||
      null,
    [submissionFields],
  );

  const projectCost = useMemo(() => {
    const total =
      getNumericFieldValue(submissionFields, "totalProjectCost") ||
      getNumericFieldValue(submissionFields, "projectCost");
    if (total) return total;
    const purchase =
      getNumericFieldValue(submissionFields, "purchasePrice") || 0;
    const rehab =
      getNumericFieldValue(submissionFields, "rehabCost") ||
      getNumericFieldValue(submissionFields, "rehabBudget") ||
      getNumericFieldValue(submissionFields, "constructionBudget") ||
      0;
    const combined = purchase + rehab;
    return combined > 0 ? combined : null;
  }, [submissionFields]);

  const arv = useMemo(
    () => getNumericFieldValue(submissionFields, "afterRepairValue"),
    [submissionFields],
  );

  const loanProductCode =
    submissionDetail?.loanApplication?.loanProductCode || null;

  const resolvedLoanProductName = useMemo(() => {
    if (submissionDetail?.loanProduct?.name) {
      return submissionDetail.loanProduct.name;
    }
    const matchedProduct = loanProducts.find(
      (product) => product.loanProductCode === loanProductCode,
    );
    if (matchedProduct?.loanProduct?.name || matchedProduct?.name) {
      return matchedProduct.loanProduct?.name || matchedProduct.name;
    }
    return loanProductCode ? formatLoanProduct(loanProductCode) : undefined;
  }, [submissionDetail, loanProducts, loanProductCode]);

  const goBackToLoiTab = () => {
    // Cancel/back without generating must not pretend an LOI exists,
    // or Loan Preview will fetch view-loi and toast "LOI not generated yet".
    const hadExistingLoi =
      Boolean(submissionDetail?.loiUrl) || mode === "regenerate" || mode === "revised";

    navigate("/loan-preview/?tab=loi", {
      state: {
        applicationLenderId,
        initialTab: "loi",
        isLoi: hadExistingLoi,
      },
    });
  };

  const handleSubmit = async (payload: {
    lenderTerms: ReturnType<typeof serializeLoiUnderwritingTerms>;
    branding: { brandName: string; logoUrl: string };
  }) => {
    if (!applicationLenderId) return;

    const isRegenerate = mode === "regenerate";
    const isRevised = mode === "revised";

    try {
      setSubmitting(true);

      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/${applicationLenderId}/generate-loi`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...payload,
            regenerate: isRegenerate || isRevised,
            revised: isRevised,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to generate LOI");
      }

      toast.success(
        isRevised
          ? `Revised LOI (Version ${json.versionNumber || revisedVersionNumber}) created. Review it, then send to the broker when ready.`
          : isRegenerate
            ? "LOI draft updated. Review the updated document, then send it to the broker when ready."
            : "Term sheet generated. Review it below, then send to the broker when ready.",
      );

      navigate("/loan-preview/?tab=loi", {
        replace: true,
        state: {
          applicationLenderId,
          initialTab: "loi",
          isLoi: true,
          refreshLoi: true,
        },
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate LOI");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading LOI form...
      </div>
    );
  }

  if (!submissionDetail) {
    return null;
  }

  return (
    <LoiUnderwritingFormModal
      mode={mode}
      revisedVersionNumber={
        mode === "revised" ? revisedVersionNumber : undefined
      }
      storedTerms={submissionDetail?.loiTermsJson}
      requestedAmount={loanAmount}
      propertyValue={propertyValue}
      projectCost={projectCost}
      arv={arv}
      applicationInterestRate={interestRate}
      applicationLoanTerm={loanTermMonths}
      loanProductCode={loanProductCode}
      applicationContext={{
        borrowerName: getBorrowerDisplayName(
          submissionDetail,
          submissionFields,
        ),
        propertyAddress:
          getFieldValueFromList(
            submissionFields,
            "propertyAddress",
            "property_address",
            "address",
          ) || undefined,
        propertyType:
          getFieldValueFromList(
            submissionFields,
            "propertyType",
            "property_type",
          ) || undefined,
        loanProduct: resolvedLoanProductName || undefined,
        brokerName: submissionDetail?.loanApplication?.brokerUser
          ? `${submissionDetail.loanApplication.brokerUser.firstName || ""} ${submissionDetail.loanApplication.brokerUser.lastName || ""}`.trim() ||
            submissionDetail?.loanApplication?.brokerOrg?.name
          : submissionDetail?.loanApplication?.brokerOrg?.name || undefined,
      }}
      submitting={submitting}
      onClose={goBackToLoiTab}
      onSubmit={handleSubmit}
    />
  );
}
