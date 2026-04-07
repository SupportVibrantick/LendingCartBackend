import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { Upload, FileText, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import SignatureCanvas from "react-signature-canvas";
import { useRef } from "react";
import {
  FiUploadCloud,
  FiFileText,
  FiMessageCircle,
  FiLogOut,
  FiMail,
  FiTrendingUp,
} from "react-icons/fi";

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

  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const [creditScore, setCreditScore] = useState("");
  const [loanProductCode, setLoanProductCode] = useState("");
  const [applicationData, setApplicationData] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<
    "documents" | "application" | "chat"
  >("documents");
  const [isSignedFromAPI, setIsSignedFromAPI] = useState(false);

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

  const handleClearSignature = () => {
    sigRef.current?.clear();
    setSignature(""); // disable submit again
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
      setStatus("SUBMITTED");
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

  const renderChat = () => {
    const dummyChats = [
      {
        id: 1,
        name: "Support",
        lastMessage: "Upload documents please",
        time: "2 min ago",
        unread: 1,
      },
      {
        id: 1,
        name: "Help",
        lastMessage: "Upload documents please",
        time: "21min ago",
        unread: 1,
      },
    ];

    const dummyMessages = [
      { id: 1, text: "Hello 👋", sender: "other", time: "10:00 AM" },
      {
        id: 2,
        text: "Please upload documents",
        sender: "other",
        time: "10:01 AM",
      },
      { id: 3, text: "Uploading now", sender: "me", time: "10:02 AM" },
    ];

    return (
      <div className="h-[80vh] flex rounded-2xl overflow-hidden border shadow-xl">
        {/* LEFT SIDEBAR */}
        <div className="w-[30%] bg-white border-r flex flex-col">
          <div className="p-4 border-b font-semibold">Chats</div>

          <div className="flex-1 overflow-y-auto">
            {dummyChats.map((chat) => (
              <div
                key={chat.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 cursor-pointer"
              >
                <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                  {chat.name.charAt(0)}
                </div>

                <div className="flex-1">
                  <p className="text-sm font-semibold">{chat.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {chat.lastMessage}
                  </p>
                </div>

                {chat.unread > 0 && (
                  <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                    {chat.unread}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT CHAT */}
        <div className="w-[70%] flex flex-col bg-[#efeae2] relative">
          {/* PATTERN BG */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none
          bg-[radial-gradient(circle_at_1px_1px,#d1d5db_1px,transparent_0)]
          bg-[size:20px_20px]"
          />

          {/* HEADER */}
          <div className="p-4 border-b bg-white flex items-center gap-3 z-10">
            <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center">
              S
            </div>
            <div>
              <p className="font-semibold">Support</p>
              <p className="text-xs text-gray-500">Online</p>
            </div>
          </div>

          {/* MESSAGES */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 z-10">
            {dummyMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === "me" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-2xl text-sm shadow ${
                    msg.sender === "me"
                      ? "bg-green-500 text-white rounded-br-none"
                      : "bg-white rounded-bl-none"
                  }`}
                >
                  {msg.text}
                  <p className="text-[10px] mt-1 text-right opacity-70">
                    {msg.time}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* INPUT */}
          <div className="p-3 bg-white border-t flex gap-2 z-10">
            <input
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 rounded-full border text-sm outline-none"
            />
            <button className="bg-green-500 text-white px-4 rounded-full">
              Send
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-6">
      <div className="max-w-8xl mx-auto">
        <div className="mb-6">
          <div
            className="relative overflow-hidden rounded-2xl border border-white/40 
                bg-gradient-to-br from-white via-blue-50/60 to-emerald-50/60
                backdrop-blur-xl p-5 
                transition-all duration-300"
          >
            {/* Gradient Glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-200 opacity-20 blur-3xl rounded-full" />
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-200 opacity-20 blur-3xl rounded-full" />
            </div>

            <div className="relative grid grid-cols-2 md:grid-cols-5 gap-5">
              {/* STATUS */}
              <div className="flex flex-col">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Status
                </p>

                <span
                  className={`inline-flex items-center gap-2 w-fit px-3 py-1.5 mt-2 text-xs font-semibold rounded-full transition
          ${
            status === "SUBMITTED"
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : status === "PENDING"
                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                : status === "REJECTED"
                  ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                  : "bg-gray-100 text-gray-700 ring-1 ring-gray-200"
          }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full
            ${
              status === "SUBMITTED"
                ? "bg-emerald-500"
                : status === "PENDING"
                  ? "bg-amber-500"
                  : status === "REJECTED"
                    ? "bg-red-500"
                    : "bg-gray-400"
            }`}
                  />
                  {status || "N/A"}
                </span>
              </div>

              {/* NAME */}
              <div className="flex flex-col">
                <p className="text-xs text-gray-400">Client</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                    {clientName?.charAt(0) || "C"}
                  </div>
                  <p className="font-medium text-gray-800 text-sm">
                    {clientName}
                  </p>
                </div>
              </div>

              {/* EMAIL */}
              <div className="flex flex-col">
                <p className="text-xs text-gray-400">Email</p>
                <div className="flex items-center gap-2 mt-1">
                  <FiMail className="text-gray-400" size={14} />
                  <p className="font-medium text-gray-800 text-sm break-all">
                    {email}
                  </p>
                </div>
              </div>

              {/* CREDIT SCORE */}
              <div className="flex flex-col">
                <p className="text-xs text-gray-400">Credit Score</p>
                <div className="flex items-center gap-2 mt-1">
                  <FiTrendingUp className="text-blue-500" size={14} />
                  <p className="font-semibold text-blue-600 text-sm">
                    {creditScore || "-"}
                  </p>
                </div>
              </div>

              {/* LOAN PRODUCT */}
              <div className="flex flex-col">
                <p className="text-xs text-gray-400">Loan Product</p>
                <div className="flex items-center gap-2 mt-1">
                  <FiFileText className="text-gray-400" size={14} />
                  <p className="font-medium text-gray-800 text-xs">
                    {loanProductCode}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          {/* LEFT SIDE BUTTONS */}
          <div className="flex gap-3 flex-wrap">
            {/* Upload Documents */}
            <button
              onClick={() => setActiveTab("documents")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200
      ${
        activeTab === "documents"
          ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md scale-[1.02]"
          : "bg-white text-gray-600 border hover:bg-blue-50 hover:text-blue-600"
      }`}
            >
              <FiUploadCloud size={16} />
              Upload Documents
            </button>

            {/* Loan Application */}
            <button
              onClick={() => setActiveTab("application")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200
      ${
        activeTab === "application"
          ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md scale-[1.02]"
          : "bg-white text-gray-600 border hover:bg-indigo-50 hover:text-indigo-600"
      }`}
            >
              <FiFileText size={16} />
              Loan Application
            </button>

            {/* Chat */}
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200
      ${
        activeTab === "chat"
          ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md scale-[1.02]"
          : "bg-white text-gray-600 border hover:bg-green-50 hover:text-green-600"
      }`}
            >
              <FiMessageCircle size={16} />
              Chat
            </button>
          </div>

          {/* RIGHT SIDE LOGOUT */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold 
               border border-red-200 text-red-600 bg-white
               hover:bg-red-50 hover:shadow-md transition-all duration-200"
          >
            <FiLogOut size={16} />
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
                    <SignatureCanvas
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
                    {submittingSign ? "Submitting..." : "Submit Signature"}
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
    ${
      applicationData.status === "SUBMITTED"
        ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
        : applicationData.status === "PENDING"
          ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
          : applicationData.status === "REJECTED"
            ? "bg-red-100 text-red-700 ring-1 ring-red-200"
            : "bg-gray-100 text-gray-700 ring-1 ring-gray-200"
    }`}
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

        {activeTab === "chat" && renderChat()}
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
