import { useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import SignFormFieldBuilder from "../../components/documents/SignFormFieldBuilder";
import { LENDER_API_BASE, getLenderAuthHeaders } from "../../lib/lenderApi";

export default function SignFormMapperPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const applicationLenderId = params.get("applicationLenderId") || "";
  const requirementId = params.get("requirementId") || "";
  const documentName = params.get("documentName") || "Sign document";

  const returnTo = useMemo(() => {
    const fromQuery = params.get("returnTo");
    if (fromQuery) return fromQuery;
    return "/loan-preview/?tab=signDocuments";
  }, [params]);

  const goBack = () => {
    navigate(returnTo, { state: location.state, replace: true });
  };

  if (!applicationLenderId || !requirementId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            Missing form context
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Open this page from Upload Signable Forms → Map fillable fields.
          </p>
          <button
            type="button"
            onClick={() => navigate("/loan-pipeline")}
            className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Back to pipeline
          </button>
        </div>
      </div>
    );
  }

  return (
    <SignFormFieldBuilder
      apiBase={LENDER_API_BASE}
      getAuthHeaders={() => getLenderAuthHeaders()}
      applicationLenderId={applicationLenderId}
      requirementId={requirementId}
      documentName={documentName}
      onBack={goBack}
      onPublished={goBack}
    />
  );
}
