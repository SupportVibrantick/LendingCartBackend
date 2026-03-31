import { ArrowLeft, FileText, CheckCircle, User, Folder } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= HELPERS ================= */
const parseValue = (val: string): any => {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
};

const getFieldValue = (fields: any[], key: string) => {
  const field = fields.find((f) => f.fieldKey === key || f.fieldId === key);
  return field ? parseValue(field.value) : undefined;
};

const LoanPreview = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  /* ================= FETCH ================= */
  const fetchSubmissionDetails = async (id: string) => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/api/public/broker/applications/submissions/${id}`,
      );

      const json = await res.json();

      if (!json.success) throw new Error("Failed to fetch");

      setSubmissionDetail(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (submissionId) {
      fetchSubmissionDetails(submissionId);
    }
  }, [submissionId]);

  /* ================= HELPERS ================= */
  const getValue = (key: string) =>
    getFieldValue(submissionDetail?.fields || [], key);

  const Metric = ({ label, value }: any) => (
    <div>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  );

  const Field = ({ label, value }: any) => (
    <div>
      <p className="text-gray-400">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );

  /* ================= UI ================= */
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-gray-600 mb-2"
          >
            <ArrowLeft size={16} /> Back to My Applications
          </button>

          <h1 className="text-2xl font-semibold">Loan Application Preview</h1>
          <p className="text-sm text-gray-500">
            {submissionDetail?.applicationNumber || "—"}
          </p>
        </div>

        <div className="flex gap-3">
          <span className="px-3 py-1 text-xs bg-gray-200 rounded-full">
            {submissionDetail?.status || "Draft"}
          </span>
          <button className="border px-4 py-2 rounded-lg text-sm">
            Edit Application
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-20">Loading...</div>
      ) : (
        <>
          {/* Top Gradient Metrics */}
          <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl p-6 mb-6">
            <div className="grid grid-cols-5 gap-4 text-center">
              <Metric
                label="LTV"
                value={`${getValue("ltvPercentage") || "—"}%`}
              />
              <Metric
                label="LTC"
                value={`${getValue("ltcPercentage") || "—"}%`}
              />
              <Metric
                label="ARV %"
                value={`${getValue("arvPercentage") || "—"}%`}
              />
              <Metric label="DSCR Ratio" value={getValue("dscr") || "—"} />
              <Metric
                label="Net Worth"
                value={`$${getValue("netWorth") || "—"}`}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b pb-2 text-sm">
            <button className="font-medium text-black border-b-2 border-blue-600 pb-1">
              Loan Details
            </button>
            <button className="text-gray-500 flex items-center gap-1">
              <FileText size={14} /> Matched Lenders
            </button>
            <button className="text-gray-500 flex items-center gap-1">
              <CheckCircle size={14} /> Approvals
            </button>
            <button className="text-gray-500 flex items-center gap-1">
              <User size={14} /> Client Portal
            </button>
            <button className="text-gray-500 flex items-center gap-1">
              <Folder size={14} /> Documents
            </button>
          </div>

          {/* Loan Request Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              💲 Loan Request
            </h2>

            <div className="grid grid-cols-2 gap-6 text-sm">
              {/* LEFT */}
              <div className="space-y-4">
                <Field
                  label="LOAN AMOUNT"
                  value={`$${getValue("amountRequested") || "—"}`}
                />
                <Field label="LOAN TERM" value={getValue("loanTerm")} />
                <Field label="LOAN TYPES" value={getValue("loanProductCode")} />
                <Field
                  label="BUSINESS TYPES"
                  value={getValue("businessType")}
                />
              </div>

              {/* RIGHT */}
              <div className="space-y-4">
                <Field label="LOAN PURPOSE" value={getValue("purpose")} />
                <Field
                  label="EXPECTED INTEREST RATE"
                  value={getValue("interestRate")}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LoanPreview;
