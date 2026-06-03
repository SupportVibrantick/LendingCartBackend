import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { Upload, FileText, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import SignatureCanvas from "react-signature-canvas";
import FeeAgreement from "./FeeAgreement";
import { useRef } from "react";
import {
  FiUploadCloud,
  FiFileText,
  FiMessageCircle,
  FiLogOut,
  FiCreditCard,
  FiDollarSign,
  FiTag,
  FiUser,
  FiX,
  FiSearch,
  FiEye,
} from "react-icons/fi";
import Chat from "./Chat";

/* ================= TYPES ================= */
const SigCanvas = SignatureCanvas as unknown as React.FC<any>;

interface DocumentItem {
  id: string;
  name: string;
  status: "PENDING" | "UPLOADED";
  uploadedFiles: string[];
  required: boolean;
}

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://api-lendingcart.vibrantick.org";

const getStatusStyles = (status: string) => {
  switch (status) {
    case "SUBMITTED":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";

    case "IN_REVIEW":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";

    case "PENDING":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";

    case "REJECTED":
    case "LENDER_DECLINED":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";

    case "APPROVED":
      return "bg-green-50 text-green-700 ring-1 ring-green-200";

    default:
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
  }
};

const getStatusDot = (status: string) => {
  switch (status) {
    case "SUBMITTED":
      return "bg-emerald-500";

    case "IN_REVIEW":
      return "bg-blue-500";

    case "PENDING":
      return "bg-amber-500";

    case "REJECTED":
    case "LENDER_DECLINED":
      return "bg-red-500";

    case "APPROVED":
      return "bg-green-500";

    default:
      return "bg-gray-400";
  }
};

export default function ClientUpload() {
  const { token } = useParams<{ token: string }>();
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [signature, setSignature] = useState<string>("");
  const [submittingSign, setSubmittingSign] = useState(false);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [loading, setLoading] = useState(true);
  const [invalidToken, setInvalidToken] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});
  const [uploadedFilesCount, setUploadedFilesCount] = useState(0);
  const [applicationNumber, setApplicationNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [applicationDetailsLoading, setApplicationDetailsLoading] =
    useState(false);

  // const [status, setStatus] = useState("");
  // const [email, setEmail] = useState("");
  // const [creditScore, setCreditScore] = useState("");
  // const [loanProductCode, setLoanProductCode] = useState("");
  const [applicationData, setApplicationData] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(9);

  const [activeTab, setActiveTab] = useState<
    "documents" | "application" | "chat" | "applications" | "feeAgreement"
  >("applications");
  const [isSignedFromAPI, setIsSignedFromAPI] = useState(false);

  const PRODUCT_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "FIX & FLIP",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR / Rental",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "CONSTRUCTION",
  BRIDGE_LOAN_1_TO_4_UNITS: "BRIDGE LOAN",
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504",
  USDA_BI: "USDA B&I",
  AGENCY_LOAN_MULTIFAMILY: "AGENCY MULTIFAMILY",
  CRE_PERMANENT_LOAN: "CRE PERMANENT",
  RENTAL_PORTFOLIO: "RENTAL PORTFOLIO",
  PURCHASE_ORDER_FINANCE: "PURCHASE ORDER FINANCE",
  ACCOUNTS_PAYABLE_FINANCE: "AP SUPPLY CHAIN",
  ACCOUNTS_RECEIVABLE: "ACCOUNTS RECEIVABLE",
  INVOICE_FACTORING: "AR FACTORING",
};

  const getClientPortalAuthConfig = () => {
    const brokerToken = sessionStorage.getItem("broker_token");
    const clientToken = sessionStorage.getItem("client_token");

    const headers: Record<string, string> = {};

    if (token && brokerToken) {
      headers.Authorization = `Bearer ${brokerToken}`;
    } else if (clientToken) {
      headers.Authorization = `Bearer ${clientToken}`;
    }

    return { headers };
  };

  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      let url = `${API_BASE}/client-portal/loan`;

      if (token) {
        url += `?token=${token}`;
      }

      const res = await axios.get(url, getClientPortalAuthConfig());
      const data = res.data?.data;

      const signatureFromAPI = data?.fullApplication?.find(
        (item: any) => item.key === "borrowerSignature",
      )?.value;

if (signatureFromAPI) {
  setSignature(signatureFromAPI);
  setIsSignedFromAPI(true);
} else {
  setSignature("");
  setIsSignedFromAPI(false);
}

      const docs = (data?.documents || []).map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        status: doc.status,
        uploadedFiles: doc.uploadedFiles || [],
        required: doc.required,
      }));
      setApplicationId(data?.loanApplicationId || "");
      setDocuments(docs);
      setApplicationNumber(data?.applicationNumber || "");
      setClientName(data?.borrower?.name || "");
      // setEmail(data?.borrower?.email || "");
      // setCreditScore(data?.borrower?.creditScore || "");

      // setStatus(data?.status || "");
      // setLoanProductCode(data?.loanDetails?.loanProductCode || "");
      setApplicationData(data);

      const uploadedMap: Record<string, boolean> = {};
      docs.forEach((doc: DocumentItem) => {
        if (doc.uploadedFiles?.length > 0) {
          uploadedMap[doc.id] = true;
        }
      });

      setUploaded(uploadedMap);
    } catch (err) {
      console.error(err);
      setInvalidToken(true);
    } finally {
      setLoading(false);
    }
  };

  if (invalidToken) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white p-8 rounded-xl shadow text-center">
          <h2 className="text-red-600 font-semibold">
            Invalid or Expired Link
          </h2>
        </div>
      </div>
    );
  }

  const handleClearSignature = () => {
    sigRef.current?.clear();
    setSignature("");
  };

  const handleUndoSignature = () => {
    if (!sigRef.current) return;

    const strokes = sigRef.current.toData();
    if (!strokes || strokes.length === 0) return;

    strokes.pop();
    sigRef.current.clear();

    if (strokes.length > 0) {
      sigRef.current.fromData(strokes);
      const dataUrl = sigRef.current.getCanvas().toDataURL("image/png");
      setSignature(dataUrl);
    } else {
      setSignature("");
    }
  };

  const handleSubmitSignature = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Please provide your signature first");
      return;
    }

    try {
      setSubmittingSign(true);

      const capturedSignature = sigRef.current
        .getCanvas()
        .toDataURL("image/png");

        console.log("Submitting Application ID:", applicationId);
console.log("Selected Application ID:", selectedApplication?.id);
console.log("Selected Status:", selectedApplication?.status);

      let submitUrl = `${API_BASE}/client-portal/e-sign/submit`;
      if (token) {
        submitUrl += `?token=${token}`;
      }

      await axios.post(
        submitUrl,
        {
          loanApplicationId: applicationId,
          signature: capturedSignature,
        },
        getClientPortalAuthConfig(),
      );

      setSignature(capturedSignature);
      // setStatus("SUBMITTED");
      await verifyToken();
      toast.success("Signature submitted successfully");
      sigRef.current?.clear();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Signature failed");
    } finally {
      setSubmittingSign(false);
    }
  };

  const MAX_FILES = 4;

  const handleFileChange = (id: string, newFiles: FileList | null) => {
    if (!newFiles) return;

    const selectedFiles = Array.from(newFiles);
    const existingFiles = files[id] || [];

    // total after adding
    const totalFiles = [...existingFiles, ...selectedFiles];

    if (totalFiles.length > MAX_FILES) {
      toast.error(`You can upload maximum ${MAX_FILES} files only`);

      // only allow remaining slots
      const allowedFiles = selectedFiles.slice(
        0,
        MAX_FILES - existingFiles.length,
      );

      setFiles((prev) => ({
        ...prev,
        [id]: [...existingFiles, ...allowedFiles],
      }));
    } else {
      setFiles((prev) => ({
        ...prev,
        [id]: totalFiles,
      }));
    }
  };

  // const removeFile = (id: string, index: number) => {
  //   setFiles((prev) => {
  //     const updated = [...(prev[id] || [])];
  //     updated.splice(index, 1);

  //     return {
  //       ...prev,
  //       [id]: updated.length > 0 ? updated : [],
  //     };
  //   });
  // };

  const uploadFile = async (id: string) => {
    const fileList = files[id];
    if (!fileList || fileList.length === 0) return;

    setUploading((prev) => ({ ...prev, [id]: true }));

    try {
      const clientToken = sessionStorage.getItem("client_token");

      for (const file of fileList) {
        const formData = new FormData();

        formData.append("loanApplicationId", applicationId);
        formData.append("documentRequirementId", id);
        formData.append("file", file);

        const res = await axios.post(
          `${API_BASE}/client-portal/upload`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${clientToken}`,
              "Content-Type": "multipart/form-data",
            },
          },
        );

        console.log("UPLOAD SUCCESS:", res.data);

        // increment count
        setUploadedFilesCount((prev) => prev + 1);
      }

      //  mark uploaded
      setUploaded((prev) => ({ ...prev, [id]: true }));

      // clear selected files
      setFiles((prev) => ({ ...prev, [id]: [] }));

      toast.success("Document uploaded successfully");
    } catch (err: any) {
      console.error("UPLOAD ERROR:", err?.response || err);

      toast.error(
        err?.response?.data?.message || "Upload failed. Please try again.",
      );
    } finally {
      setUploading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const fetchApplications = async (pageNumber = 1) => {
    try {
      setApplicationsLoading(true);

      let url = `${API_BASE}/client-portal/applications?page=${pageNumber}&limit=${limit}`;

      if (debouncedSearch) {
        url += `&search=${debouncedSearch}`;
      }

      if (token) url += `&token=${token}`;

      const res = await axios.get(url, getClientPortalAuthConfig());

      verifyToken();
      setApplications(res.data?.data || []);
      setPage(res.data?.meta?.page || 1);
      setTotalPages(res.data?.meta?.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setApplicationsLoading(false);
    }
  };

  const fetchApplicationDetails = async (id: string) => {
    try {
      setApplicationDetailsLoading(true);

      let url = `${API_BASE}/client-portal/applications/${id}`;
      if (token) url += `?token=${token}`;

      const res = await axios.get(url, getClientPortalAuthConfig());

      const data = res.data?.data;

      setApplicationId(data.id);
      setSignature("");
setIsSignedFromAPI(false);

const borrowerSignature =
  data?.borrowerSignature ||
  data?.submissions
    ?.flatMap((s: any) => s.fields || [])
    ?.find((f: any) => f.fieldKey === "borrowerSignature")
    ?.value;

if (borrowerSignature) {
  setSignature(borrowerSignature);
  setIsSignedFromAPI(true);
}
      setSelectedApplication(data);

      // IMPORTANT: convert API fields → your UI format
const submissionFields =
  data?.submissions?.[0]?.fields?.map((f: any) => ({
    key: f.fieldKey,
    value: f.value,
  })) || [];

const extraFields = [
  { key: "borrowerName", value: data.borrowerName },
  { key: "borrowerEmail", value: data.borrowerEmail },
  { key: "borrowerPhone", value: data.borrowerPhone },

  { key: "borrowerFirstName", value: data.borrowerFirstName },
  { key: "borrowerLastName", value: data.borrowerLastName },

  { key: "borrowerCity", value: data.borrowerCity },
  { key: "borrowerState", value: data.borrowerState },
  { key: "borrowerCountry", value: data.borrowerCountry },

  { key: "propertyAddress", value: data.propertyAddress },

  { key: "companyName", value: data.companyName },

  { key: "email", value: data.borrowerEmail },
  { key: "phone", value: data.borrowerPhone },

  { key: "loanProductCode", value: data.loanProductCode },
  { key: "amountRequested", value: data.amountRequested },

  { key: "interestRate", value: data.interestRate },
  { key: "loanTerm", value: data.loanTerm },

  { key: "creditScore", value: data.creditScore },
  { key: "ltvPercentage", value: data.ltvPercentage },
  { key: "ltcPercentage", value: data.ltcPercentage },
  { key: "arvPercentage", value: data.arvPercentage },
  { key: "dscr", value: data.dscr },

  { key: "totalAssets", value: data.totalAssets },
  { key: "totalLiabilities", value: data.totalLiabilities },
  { key: "netWorth", value: data.netWorth },

  { key: "borrowerSignature", value: data.borrowerSignature },
];

const fields = [...submissionFields, ...extraFields];

setApplicationData({
  ...data,
  borrower: {
    name: data.borrowerName,
    email: data.borrowerEmail,
    phone: data.borrowerPhone,
  },
  fullApplication: fields,
});

      setActiveTab("application"); // reuse existing UI
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch application details");
    } finally {
      setApplicationDetailsLoading(false);
    }
  };

  const formatCurrency = (val: any) => {
    if (!val) return "-";
    return `$${Number(val).toLocaleString()}`;
  };

  const formatPercent = (val: any) => {
    if (!val && val !== 0) return "-";
    return `${Number(val).toFixed(2)}%`;
  };

  const totalFiles = Object.values(files).flat().length + uploadedFilesCount;

  const progress =
    totalFiles === 0 ? 0 : Math.round((uploadedFilesCount / totalFiles) * 100);

  const getValue = (key: string) => {
    return (
      applicationData?.fullApplication?.find((item: any) => item.key === key)
        ?.value || "-"
    );
  };

  const handleEndSignature = () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;

    const dataUrl = sigRef.current.getCanvas().toDataURL("image/png");
    setSignature(dataUrl);
  };

  const handleLogout = () => {
    // remove token
    sessionStorage.removeItem("client_token");

    // redirect to login page
    window.location.href = "/client-portal";
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (activeTab === "applications") {
      fetchApplications(page);
    }
  }, [activeTab, page, debouncedSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-6">
      <div className="max-w-8xl mx-auto">
        {/* TOP SUMMARY CARD - TABS SE UPAR */}
        {activeTab === "applications" && applicationData && (
          <div className="relative mb-8 overflow-hidden p-1">
            {/* Decorative Background Element */}
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-500/5 blur-3xl" />

            <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 p-6">
              {/* Name Column */}
              <div className="group">
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.6)]" />
                  Borrower Name
                </p>
                <p className="mt-2 text-md font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {applicationData?.borrower?.name || "Anonymous User"}
                </p>
              </div>

              {/* Email Column */}
              <div className="group">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Primary Contact
                </p>
                <div className="mt-2 flex items-center gap-1">
                  <span className="flex h-8 w-8 items-center justify-center">
                    <svg
                      className="h-4 w-4 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </span>
                  <p className="text-sm font-semibold text-slate-600 break-all leading-tight">
                    {applicationData?.borrower?.email || "-"}
                  </p>
                </div>
              </div>

              <div className="hidden lg:block lg:col-span-3" />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-6 border-b pb-2">
          {/* LEFT SIDE ACTIONS */}
          <div className="flex items-center gap-6">
            {/* APPLICATIONS */}
            <button
              onClick={() => setActiveTab("applications")}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all
      ${
        activeTab === "applications"
          ? "text-white bg-gradient-to-r from-blue-500 to-teal-500 shadow-md"
          : "text-gray-500 hover:text-blue-600"
      }`}
            >
              <FiFileText size={16} />
              Applications
              {activeTab === "applications" && (
                <span className="absolute -bottom-2 left-2 right-2 h-[2px] bg-blue-500 rounded-full" />
              )}
            </button>
          </div>

          {/* RIGHT SIDE */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm  font-medium text-red-600 transition"
          >
            <FiLogOut size={16} />
            Logout
          </button>
        </div>

        {activeTab === "documents" && (
          <>
            {documents.length === 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  {/* Back Button */}
                  <button
                    onClick={() => setActiveTab("application")}
                    className="flex text-xs items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                  >
                    ← Back
                  </button>
                </div>
                <div
                  className="relative h-[60vh] overflow-hidden rounded-2xl
  bg-gradient-to-br from-blue-50 via-white to-cyan-50 
  p-10 text-center flex flex-col items-center justify-center gap-4"
                >
                  {/* GLOW EFFECT */}
                  <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-200 opacity-20 blur-3xl rounded-full" />
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-cyan-200 opacity-20 blur-3xl rounded-full" />

                  {/* ICON */}
                  <div className="relative">
                    <div
                      className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 
      flex items-center justify-center shadow-lg"
                    >
                      <FileText className="text-white" size={30} />
                    </div>
                  </div>

                  {/* TITLE */}
                  <p className="text-base font-semibold text-gray-700">
                    No Documents Required
                  </p>

                  {/* DESCRIPTION */}
                  <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                    This application currently doesn’t require any documents.
                    You’re all set for now — we’ll notify you if anything is
                    needed.
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* HEADER (ONLY WHEN DOCUMENTS EXIST) */}
                <div className="bg-white rounded-2xl shadow p-6 mb-6 sticky top-4 z-10">
                  {/* TOP ROW WITH BACK BUTTON */}
                  <div className="flex items-center justify-between mb-4">
                    {/* Back Button */}
                    <button
                      onClick={() => setActiveTab("application")}
                      className="flex text-xs items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                    >
                      ← Back
                    </button>
                  </div>

                  {/* HEADER */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-semibold text-gray-800">
                        Upload Documents
                      </h1>
                      <p className="text-sm text-gray-500 mt-1">{clientName}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-gray-400">Application No.</p>
                      <p className="text-sm font-medium text-gray-700">
                        {applicationNumber}
                      </p>
                    </div>
                  </div>

                  {/* PROGRESS */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {uploadedFilesCount} / {totalFiles} Files Uploaded
                      </span>
                      <span>{progress}%</span>
                    </div>

                    <div className="w-full bg-gray-200 h-2 rounded-full">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* GRID */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      {/* TOP */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <FileText className="text-blue-600" size={20} />

                          {uploaded[doc.id] && (
                            <CheckCircle className="text-green-600" size={20} />
                          )}
                        </div>

                        <p className="text-sm font-medium text-gray-800 line-clamp-2">
                          {doc.name}
                        </p>

                        <p
                          className={`text-xs mt-1 font-medium ${
                            uploaded[doc.id]
                              ? "text-green-600"
                              : "text-yellow-600"
                          }`}
                        >
                          {uploaded[doc.id] ? "Uploaded" : "Pending"}
                        </p>
                      </div>

                      {/* ACTIONS */}
                      <div className="mt-4">
                        {uploaded[doc.id] ? (
                          <div className="text-xs text-green-600 font-medium">
                            ✔ Completed
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <input
                              type="file"
                              multiple
                              disabled={(files[doc.id]?.length || 0) >= 4}
                              id={`file-${doc.id}`}
                              className="hidden"
                              onChange={(e) =>
                                handleFileChange(doc.id, e.target.files)
                              }
                            />

                            <div className="flex gap-2">
                              <label
                                htmlFor={`file-${doc.id}`}
                                className={`flex-1 text-center text-xs px-3 py-2 border rounded-lg cursor-pointer 
                ${
                  (files[doc.id]?.length || 0) >= 4
                    ? "bg-gray-200 cursor-not-allowed text-slate-500"
                    : "hover:bg-gray-100"
                }`}
                              >
                                Choose File
                              </label>

                              <button
                                onClick={() => uploadFile(doc.id)}
                                disabled={
                                  !(files[doc.id]?.length > 0) ||
                                  uploading[doc.id]
                                }
                                className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                              >
                                <Upload size={14} />
                                {uploading[doc.id] ? "Uploading..." : "Upload"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "applications" && (
          <div className="min-h-[88vh] bg-white rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
              <h2 className="text-xl font-semibold text-gray-800">
                Loan Applications
              </h2>

              {/* SEARCH BOX */}
              <div className="relative w-full md:w-72">
                {/* ICON */}
                <FiSearch
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />

                <input
                  type="text"
                  placeholder="Search applications..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border bg-white 
      focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
      outline-none transition"
                />

                {/* CLEAR BUTTON */}
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <FiX size={16} />
                  </button>
                )}
              </div>
            </div>

            {applicationsLoading ? (
              <p className="text-gray-500">Loading...</p>
            ) : applications.length === 0 ? (
              <div
                className="relative overflow-hidden rounded-2xl border border-purple-100 
  bg-gradient-to-br from-purple-50 via-white to-pink-50 
  p-12 text-center shadow-sm flex flex-col items-center justify-center gap-4"
              >
                {/* GLOW */}
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-purple-200 opacity-20 blur-3xl rounded-full" />
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-pink-200 opacity-20 blur-3xl rounded-full" />

                {/* ICON */}
                <div className="relative">
                  <div
                    className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-green-500 
      flex items-center justify-center shadow-lg"
                  >
                    <FiFileText className="text-white" size={28} />
                  </div>
                </div>

                {/* TITLE */}
                <p className="text-base font-semibold text-gray-700">
                  No Applications Found
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {applications.map((app) => {
                  const progress =
                    app.documentProgress.total === 0
                      ? 0
                      : Math.min(
                          100,
                          Math.round(
                            (app.documentProgress.uploaded /
                              app.documentProgress.total) *
                              100,
                          ),
                        );

                  return (
                    <div
                      key={app.id}
                      onClick={() => fetchApplicationDetails(app.id)}
                      className="group relative border border-slate-100 rounded-xl p-4
             shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer 
             overflow-hidden bg-white"
                    >
                      {/*  MINIMAL HOVER OVERLAY */}
                      <div
                        className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 
               transition-all duration-300 flex items-center justify-center z-20 backdrop-blur-[1px]"
                      >
                        <div
                          className="text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 
                 px-4 py-2 rounded-lg bg-slate-800/80 border border-white/10 
                 backdrop-blur-md shadow-2xl transform translate-y-2 
                 group-hover:translate-y-0 transition-all duration-300"
                        >
                          <FiEye size={14} />
                          View Details
                        </div>
                      </div>

                      {/* CONTENT */}
                      <div className="relative z-10 group-hover:opacity-20 transition duration-300">
                        {/* HEADER */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.05em] text-slate-400 font-bold mb-0.5">
                              Application ID
                            </p>
                            <p className="text-[12px] font-bold text-slate-800 font-mono">
                              {app.applicationNumber}
                            </p>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-tight ${getStatusStyles(
                              app.status,
                            )}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${getStatusDot(app.status)}`}
                            />
                            {app.status.replace("_", " ")}
                          </span>
                        </div>

                        {/* PRODUCT INFO */}
                        <div className="mb-3">
                          <p className="text-[11px] font-semibold text-slate-600 truncate">
                            {app.loanProduct?.replace(/_/g, " ")}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(app.createdAt).toLocaleDateString(
                              undefined,
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </p>
                        </div>

                        {/* AMOUNT & PROGRESS BAR */}
                        <div className="pt-3 border-t border-slate-50">
                          <div className="flex justify-between items-end mb-1.5">
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">
                                Amount
                              </p>
                              <p className="text-[13px] font-black text-slate-900">
                                {app.amountRequested || "—"}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-bold ${progress === 100 ? "text-emerald-600" : "text-slate-500"}`}
                            >
                              {progress}%
                            </span>
                          </div>

                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                progress === 100
                                  ? "bg-emerald-500"
                                  : "bg-slate-800"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          <p className="text-[9px] text-slate-400 mt-1.5 font-medium">
                            Documents:{" "}
                            <span className="text-slate-600">
                              {app.documentProgress.uploaded}/
                              {app.documentProgress.total}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                {/* LEFT */}
                <p className="text-xs text-gray-500">
                  Page {page} of {totalPages}
                </p>

                {/* RIGHT BUTTONS */}
                <div className="flex items-center gap-2">
                  {/* PREVIOUS */}
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border bg-white text-gray-600 
        hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>

                  {/* PAGE NUMBERS */}
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i + 1)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition
          ${
            page === i + 1
              ? "bg-blue-600 text-white shadow"
              : "bg-white border text-gray-600 hover:bg-gray-50"
          }`}
                    >
                      {i + 1}
                    </button>
                  ))}

                  {/* NEXT */}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg border bg-white text-gray-600 
        hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "application" &&
          (applicationDetailsLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-500">
              Loading application details...
            </div>
          ) : applicationData ? (
            <div className="bg-white rounded-2xl p-6">
              {activeTab === "application" && applicationData && (
                <div className="bg-white rounded-2xl p-6">
                  <div className="mb-6">
                    {/* BACK BUTTON */}
                    <button
                      onClick={() => {
                        setSelectedApplication(null);
                        setActiveTab("applications");
                        verifyToken();
                      }}
                      className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 mb-3"
                    >
                      ← Back to Submitted Applications
                    </button>

                    {/* TITLE */}
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h1 className="text-xl font-semibold text-gray-800">
                          Loan Application Preview
                        </h1>
                        <p className="text-xs text-gray-400">
                          {selectedApplication?.applicationNumber}
                        </p>
                      </div>

                      {/* DOCUMENTS */}
                      <button
                        onClick={() => setActiveTab("documents")}
                        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all
      hover:text-blue-500`}
                      >
                        <FiUploadCloud size={16} />
                        Upload Documents
                        <span className="absolute -bottom-2 left-2 right-2 h-[2px] bg-blue-500 rounded-full" />
                      </button>

                      {/* Fee Agreement */}
                      <button
                        onClick={() => setActiveTab("feeAgreement")}
                        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all
      hover:text-blue-500`}
                      >
                        <FiFileText size={16} />
                        Fee Agreement
                        <span className="absolute -bottom-2 left-2 right-2 h-[2px] bg-blue-500 rounded-full" />
                      </button>

                      <div className="flex items-center gap-3">
                        {/* Chat Button */}
                        <button
                          type="button"
                          onClick={() => setActiveTab("chat")}
                          className="group relative inline-flex items-center gap-2 rounded-xl 
  bg-gradient-to-r from-emerald-500 to-green-600 
  px-3 py-1.5 text-xs font-semibold text-white 
  shadow-md transition-all duration-200 
  hover:shadow-lg hover:scale-[1.03] active:scale-95"
                        >
                          {/* glow */}
                          <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition" />

                          {/* icon */}
                          <span className="flex items-center justify-center">
                            <FiMessageCircle size={14} />
                          </span>

                          {/* text */}
                          <span>Chat</span>

                          {/* subtle pulse */}
                          <span className="ml-1 flex h-2 w-2">
                            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-white/70" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                          </span>
                        </button>

                        {/* STATUS */}
                        <span
                          className={`rounded-full text-xs px-4 py-1.5 font-semibold ${getStatusStyles(
                            selectedApplication?.status,
                          )}`}
                        >
                          {selectedApplication?.status}
                        </span>
                      </div>
                    </div>

                    {/* CARDS CONTAINER */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* CLIENT CARD */}
                      <div className="group relative overflow-hidden rounded-2xl p-4 bg-blue-100 border border-slate-100 transition-all duration-300">
                        <div className="relative flex items-center gap-3">
                          {/* Icon with Soft Background */}
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-400 text-blue-50 flex items-center justify-center transition-all duration-300">
                            <FiUser size={16} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] text-blue-600 uppercase tracking-[0.05em] font-bold mb-0.5">
                              Client Name
                            </p>
                            <p className="text-[13px] font-semibold text-blue-800 truncate">
                             {getValue("borrowerName") || "Applicant"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* PRODUCT CARD */}
                      <div className="group relative overflow-hidden rounded-2xl p-4 bg-purple-100 border border-slate-100 transition-all duration-300">
                        <div className="relative flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-purple-500 text-purple-50 flex items-center justify-center transition-all duration-300">
                            <FiTag size={16} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] text-purple-600 uppercase tracking-[0.05em] font-bold mb-0.5">
                              Product
                            </p>
                            <p className="text-[13px] font-semibold text-purple-700 truncate">
                              {PRODUCT_LABELS[getValue("loanProductCode")] ??
  getValue("loanProductCode")
    ?.replace(/_/g, " ")
    .toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* AMOUNT CARD */}
                      <div className="group relative overflow-hidden rounded-2xl p-4 bg-green-100 border border-slate-100  transition-all duration-300">
                        <div className="relative flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-green-500 text-green-50 flex items-center justify-center transition-all duration-300">
                            <FiDollarSign size={16} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] text-green-600 uppercase tracking-[0.05em] font-bold mb-0.5">
                              Loan Amount Requested
                            </p>
                            <p className="text-[13px] font-bold text-green-600">
                              {formatCurrency(getValue("amountRequested"))}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* CREDIT SCORE CARD */}
                      <div className="group relative overflow-hidden rounded-2xl p-4 bg-[#FEFCE9] border border-slate-100 transition-all duration-300">
                        <div className="relative flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-[#F7A400] text-white flex items-center justify-center transition-all duration-300">
                            <FiCreditCard size={16} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] text-orange-600 uppercase tracking-[0.05em] font-bold mb-0.5">
                              Credit Score
                            </p>
                            <div className="flex items-baseline gap-1">
                              <p className="text-[13px] font-bold text-orange-800">
                                {getValue("creditScore") || "—"}
                              </p>
                              <span className="text-[9px] font-medium text-orange-800">
                                PTS
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border rounded-2xl p-6 mb-6 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-center">
                      {/* LOAN AMOUNT */}
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">
                          Loan Amount
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-1">
                          {formatCurrency(getValue("amountRequested"))}
                        </p>
                      </div>

                      {/* LTV */}
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">
                          LTV %
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-1">
                          {formatPercent(getValue("ltvPercentage"))}
                        </p>
                      </div>

                      {/* LTC */}
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">
                          LTC %
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-1">
                          {formatPercent(getValue("ltcPercentage"))}
                        </p>
                      </div>

                      {/* ARV */}
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">
                          ARV %
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-1">
                          {formatPercent(getValue("arvPercentage"))}
                        </p>
                      </div>

                      {/* DSCR */}
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">
                          DSCR
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-1">
                          {getValue("dscr") || "-"}
                        </p>
                      </div>

                      {/* NET WORTH */}
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">
                          Net Worth
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-1">
                          {formatCurrency(getValue("netWorth"))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* PRIMARY BORROWER */}
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-3">
                      Primary Borrower
                    </h3>

                    <div className="grid md:grid-cols-2 gap-4">
                    <Input
  label="Borrower Name"
  value={`${getValue("borrowerFirstName")} ${getValue("borrowerLastName")}`}
/>
                     <Input
  label="City"
  value={getValue("borrowerCity")}
/>
                    <Input
  label="State"
  value={getValue("borrowerState")}
/>
                    </div>
                  </div>

                  {/* LOAN DETAILS */}
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-3">
                      Loan Details
                    </h3>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Input
                        label="Company Name"
                        value={getValue("companyName")}
                      />
                      <Input label="Email" value={getValue("email")} />
                      <Input label="Phone" value={getValue("phone")} />
                      <Input
                        label="Credit Score"
                        value={getValue("creditScore")}
                      />
<Input
  label="Country"
  value={getValue("borrowerCountry")}
/>
                      <Input
                        label="Loan Product Code"
                          value={
    PRODUCT_LABELS[getValue("loanProductCode")] ||
    getValue("loanProductCode")
  }
                      />
                      <Input
                        label="Loan Amount Requested"
                        value={getValue("amountRequested")}
                      />
                      <Input
                        label="Interest Rate"
                        value={getValue("interestRate")}
                      />
                      <Input label="Loan Term" value={getValue("loanTerm")} />
                    </div>
                  </div>

                  <div className="mt-8">
  <h3 className="text-lg font-semibold mb-4">
    Personal Information
  </h3>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Input label="Date of Birth" value={getValue("dob")} />
    <Input label="SSN" value={getValue("ssn")} />
    <Input label="Employer" value={getValue("employer")} />

    <Input label="Address" value={getValue("address")} />
    <Input
      label="Mailing Address"
      value={getValue("mailingAddress")}
    />
  </div>
</div>

<div className="mt-8">
  <h3 className="text-lg font-semibold mb-4">
    Property Information
  </h3>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Input label="Purpose" value={getValue("purpose")} />

    <Input
      label="Property Type"
      value={getValue("propertyType")}
    />

    <Input
      label="Sub Property Type"
      value={getValue("subPropertyType")}
    />

    <Input
      label="Recourse"
      value={getValue("recourse")}
    />

    <Input
      label="Property Address"
      value={getValue("propertyAddress")}
    />

    <Input
      label="Property City"
      value={getValue("propertyCity")}
    />

    <Input
      label="Property State"
      value={getValue("propertyState")}
    />

    <Input
      label="Property Zip"
      value={getValue("propertyZip")}
    />

    <Input
      label="Property Country"
      value={getValue("propertyCountry")}
    />
  </div>
</div>

<div className="mt-8">
  <h3 className="text-lg font-semibold mb-4">
    Entity Information
  </h3>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Input
      label="Entity Legal Name"
      value={getValue("entityLegalName")}
    />

    <Input
      label="Entity Type"
      value={getValue("entityType")}
    />

    <Input label="DBA" value={getValue("dba")} />

    <Input
      label="Formation Date"
      value={getValue("formationDate")}
    />

    <Input
      label="Years In Business"
      value={getValue("yearsInBusiness")}
    />
  </div>
</div>

<div className="mt-8">
  <h3 className="text-lg font-semibold mb-4">
    Financial Information
  </h3>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Input
      label="Current Market Value"
      value={formatCurrency(
        getValue("currentMarketValue")
      )}
    />

    <Input
      label="After Repair Value"
      value={formatCurrency(
        getValue("afterRepairValue")
      )}
    />

    <Input
      label="Purchase Price"
      value={formatCurrency(
        getValue("purchasePrice")
      )}
    />

    <Input
      label="Purchase Date"
      value={getValue("purchaseDate")}
    />

    <Input
      label="Monthly Rent"
      value={getValue("monthlyRent")}
    />

    <Input
      label="Gross Revenue Actual"
      value={getValue("grossRevenueActual")}
    />

    <Input
      label="Gross Revenue Proforma"
      value={getValue("grossRevenueProforma")}
    />

    <Input
      label="NOI Actual"
      value={getValue("noiActual")}
    />

    <Input
      label="NOI Proforma"
      value={getValue("noiProforma")}
    />

    <Input
      label="Annual Taxes"
      value={getValue("annualTaxes")}
    />

    <Input
      label="Insurance Premium"
      value={getValue("insurancePremium")}
    />

    <Input
      label="HOA Dues"
      value={getValue("hoaDues")}
    />

    <Input
      label="Monthly Rental Income"
      value={getValue("monthlyRentalIncome")}
    />

    <Input
      label="DSCR Ratio"
      value={getValue("dscrRatio")}
    />

                          <Input
                        label="Total Assets"
                        value={getValue("totalAssets")}
                      />
                      <Input
                        label="Total Liabilities"
                        value={getValue("totalLiabilities")}
                      />
                      <Input label="Net Worth" value={getValue("netWorth")} />
  </div>
</div>

                  {/* SIGNATURE */}
                  <div className="mt-6">
                    <h3 className="font-semibold text-gray-700 mb-3">
                      Digital Signature
                    </h3>

                    {isSignedFromAPI ? (
                      <div className="bg-gray-50 border rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-400 mb-2">
                          ✔ Signed by client
                        </p>

                        <img
                          src={signature}
                          className="h-28 mx-auto object-contain"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="bg-gradient-to-br from-white to-gray-50 border rounded-xl p-4 shadow-sm">
                          <SigCanvas
                            ref={sigRef}
                            penColor="black"
                            onEnd={handleEndSignature}
                            canvasProps={{
                              width: 900,
                              height: 220,
                              className:
                                "w-full max-w-full border-2 border-dashed border-gray-300 rounded-lg bg-white",
                            }}
                          />

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="text-xs text-gray-400">Sign above</p>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleUndoSignature}
                                disabled={!signature}
                                className={`rounded-md px-3 py-1 text-xs transition ${
                                  !signature
                                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                Undo Last Stroke
                              </button>

                              <button
                                type="button"
                                onClick={handleClearSignature}
                                disabled={!signature}
                                className={`rounded-md px-3 py-1 text-xs transition ${
                                  !signature
                                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                    : "bg-gray-200 text-slate-700 hover:bg-gray-300"
                                }`}
                              >
                                Reset Signature
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Submit */}
                        <button
                          onClick={handleSubmitSignature}
                          disabled={!signature || submittingSign}
                          className={`mt-4 w-full rounded-lg py-2 font-medium transition ${
                            !signature || submittingSign
                              ? "cursor-not-allowed bg-slate-200 text-slate-500 shadow-none"
                              : "bg-emerald-600 text-white shadow-[0_12px_24px_rgba(5,150,105,0.22)] hover:bg-emerald-700"
                          }`}
                        >
                          {submittingSign
                            ? "Submitting..."
                            : "Submit Signature"}
                        </button>
                      </>
                    )}
                  </div>

                  {/* FOOTER */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-6">
                    {/* Date */}
                    <span className="text-sm text-gray-500">
                      Submitted Date: {applicationData.createdAt}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-full shadow-sm
                      ${getStatusStyles(applicationData.status)}`}
                    >
                      {/* Dot indicator */}
                      <span
                        className={`h-2 w-2 rounded-full
                        ${
                          applicationData.status === "SUBMITTED"
                            ? "bg-emerald-500"
                            : applicationData.status === "PENDING"
                              ? "bg-amber-500"
                              : applicationData.status === "REJECTED"
                                ? "bg-red-500"
                                : "bg-gray-400"
                        }`}
                      />

                      {applicationData.status}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : null)}

        {activeTab === "feeAgreement" && (
          <FeeAgreement
            applicationId={
              selectedApplication?.id ||
              selectedApplication?.loanApplicationId ||
              applicationId
            }
            getAuthHeaders={() => getClientPortalAuthConfig().headers}
            onBack={() => setActiveTab("application")}
          />
        )}

        {activeTab === "chat" && (
          <Chat
            applicationId={
              selectedApplication?.id ||
              selectedApplication?.loanApplicationId ||
              applicationId
            }
            onBack={() => setActiveTab("application")}
          />
        )}
      </div>
    </div>
  );
}

const Input = ({ label, value }: { label: string; value: any }) => (
  <div>
    <p className="text-xs text-gray-400 mb-1">{label}</p>
    <div className="bg-gray-100 px-3 py-2 rounded-md text-sm text-gray-800">
      {value || "-"}
    </div>
  </div>
);
