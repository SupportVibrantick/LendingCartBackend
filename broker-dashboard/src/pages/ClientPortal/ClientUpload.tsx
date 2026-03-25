import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { Upload, FileText, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

/* ================= TYPES ================= */

interface DocumentItem {
  id: string;
  name: string;
  status: "PENDING" | "UPLOADED";
  uploadedFiles: string[];
  required: boolean;
}

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://api-lendingcart.vibrantick.org";

export default function ClientUpload() {
  const { token } = useParams<{ token: string }>();

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

  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const [creditScore, setCreditScore] = useState("");
  const [loanProductCode, setLoanProductCode] = useState("");
  const [applicationData, setApplicationData] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<"documents" | "application">(
    "documents",
  );

  useEffect(() => {
    verifyToken();
  }, []);

  const verifyToken = async () => {
    try {
      const brokerToken = sessionStorage.getItem("broker_token");
      const clientToken = sessionStorage.getItem("client_token");

      let headers: any = {};
      let url = `${API_BASE}/client-portal/loan`;

      // CASE 1: Token present (invite flow)
      if (token) {
        url += `?token=${token}`;

        headers = {
          Authorization: `Bearer ${brokerToken}`, // broker auth
        };
      }
      // CASE 2: No token (logged-in user)
      else {
        headers = {
          Authorization: `Bearer ${clientToken}`, // client auth
        };
      }

      const res = await axios.get(url, { headers });
      const data = res.data?.data;

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
      setEmail(data?.borrower?.email || "");
      setCreditScore(data?.borrower?.creditScore || "");

      setStatus(data?.status || "");
      setLoanProductCode(data?.loanDetails?.loanProductCode || "");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading...
      </div>
    );
  }

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

  const totalFiles = Object.values(files).flat().length + uploadedFilesCount;

  const progress =
    totalFiles === 0 ? 0 : Math.round((uploadedFilesCount / totalFiles) * 100);

  const getValue = (key: string) => {
    return (
      applicationData?.fullApplication?.find((item: any) => item.key === key)
        ?.value || "-"
    );
  };

  const handleLogout = () => {
    // remove token
    sessionStorage.removeItem("client_token");

    // redirect to login page
    window.location.href = "/client-portal";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex">
          {/* CLIENT INFO BOX */}
          <div className="bg-white rounded-2xl shadow p-5 mb-6 border">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* STATUS */}
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <span
                  className={`inline-block px-2 py-1 mt-1 text-xs font-semibold rounded-full
        ${
          status === "SUBMITTED"
            ? "bg-green-100 text-green-700"
            : "bg-yellow-100 text-yellow-700"
        }`}
                >
                  {status}
                </span>
              </div>

              {/* NAME */}
              <div>
                <p className="text-xs text-gray-400">Name</p>
                <p className="font-medium text-gray-800 mt-1 text-sm">
                  {clientName}
                </p>
              </div>

              {/* EMAIL */}
              <div>
                <p className="text-xs text-gray-400">Email</p>
                <p className="font-medium text-gray-800 mt-1 break-all text-sm">
                  {email}
                </p>
              </div>

              {/* CREDIT SCORE */}
              <div>
                <p className="text-xs text-gray-400">Credit Score</p>
                <p className="font-semibold text-blue-600 text-sm mt-1">
                  {creditScore || "-"}
                </p>
              </div>

              {/* LOAN PRODUCT */}
              <div>
                <p className="text-xs text-gray-400">Loan Product</p>
                <p className="font-medium text-gray-800 mt-1 text-xs">
                  {loanProductCode}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          {/* LEFT SIDE BUTTONS */}
          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab("documents")}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition
      ${
        activeTab === "documents"
          ? "bg-blue-600 text-white"
          : "bg-white text-gray-600 hover:bg-gray-100"
      }`}
            >
              Upload Documents
            </button>

            <button
              onClick={() => setActiveTab("application")}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition
      ${
        activeTab === "application"
          ? "bg-blue-600 text-white"
          : "bg-white text-gray-600 hover:bg-gray-100"
      }`}
            >
              Loan Application
            </button>
          </div>

          {/* RIGHT SIDE LOGOUT */}
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition whitespace-nowrap"
          >
            Logout
          </button>
        </div>

        {activeTab === "documents" && (
          <>
            {documents.length === 0 ? (
              //  ONLY EMPTY STATE (NO HEADER)
              <div className="bg-white rounded-xl p-10 text-center shadow-sm border-2 border-dashed border-blue-200 flex flex-col items-center justify-center gap-3">
                {/* ICON */}
                <div className="bg-blue-50 p-4 rounded-full">
                  <FileText className="text-blue-500" size={28} />
                </div>

                {/* TEXT */}
                <p className="text-gray-600 text-sm font-medium">
                  No documents available
                </p>

                <p className="text-gray-400 text-xs">
                  There are no documents required for this application
                </p>
              </div>
            ) : (
              <>
                {/* HEADER (ONLY WHEN DOCUMENTS EXIST) */}
                <div className="bg-white rounded-2xl shadow p-6 mb-6 sticky top-4 z-10">
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

        {activeTab === "application" && applicationData && (
          <div className="bg-white rounded-2xl shadow p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-6">Application Details</h2>

            {/* 🔹 PRIMARY BORROWER */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">
                Primary Borrower
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Borrower First Name"
                  value={getValue("borrowerFirstName")}
                />
                <Input label="City" value={getValue("city")} />
                <Input label="State" value={getValue("state")} />
              </div>
            </div>

            {/* 🔹 LOAN DETAILS */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">Loan Details</h3>

              <div className="grid md:grid-cols-2 gap-4">
                <Input label="Company Name" value={getValue("companyName")} />
                <Input label="Email" value={getValue("email")} />
                <Input label="Phone" value={getValue("phone")} />
                <Input label="Credit Score" value={getValue("creditScore")} />
                <Input label="Country" value={getValue("country")} />
                <Input
                  label="Loan Product Code"
                  value={getValue("loanProductCode")}
                />
                <Input
                  label="Amount Requested"
                  value={getValue("amountRequested")}
                />
                <Input label="Interest Rate" value={getValue("interestRate")} />
                <Input label="Loan Term" value={getValue("loanTerm")} />
              </div>
            </div>

            {/* 🔹 FINANCIALS */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">Financials</h3>

              <div className="grid md:grid-cols-2 gap-4">
                <Input label="Total Assets" value={getValue("totalAssets")} />
                <Input
                  label="Total Liabilities"
                  value={getValue("totalLiabilities")}
                />
                <Input label="Net Worth" value={getValue("netWorth")} />
              </div>
            </div>

            {/* 🔹 SIGNATURE */}
            <div className="mt-6">
              <h3 className="font-semibold text-gray-700 mb-3">
                Digital Signature
              </h3>

              {getValue("borrowerSignature") && (
                <div className="border rounded-xl p-4 bg-gray-50">
                  <img
                    src={getValue("borrowerSignature")}
                    alt="Signature"
                    className="h-32 object-contain mx-auto"
                  />
                </div>
              )}
            </div>

            {/* 🔹 FOOTER */}
            <div className="flex justify-between mt-6 text-sm text-gray-500">
              <span>Submitted Date: {applicationData.createdAt}</span>
              <span>Status: {applicationData.status}</span>
            </div>
          </div>
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
