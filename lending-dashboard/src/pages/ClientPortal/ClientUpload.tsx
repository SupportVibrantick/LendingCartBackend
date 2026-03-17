import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { Upload, FileText, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

/* ================= TYPES ================= */

interface DocumentItem {
  requirementId: string;
  documentTypeId: string;
  documentName: string;
  status: "PENDING" | "UPLOADED";
  uploadedFiles: string[];
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

  useEffect(() => {
    verifyToken();
  }, []);

  const verifyToken = async () => {
    try {
      const res = await axios.get(`${API_BASE}/client-portal/verify/${token}`);
      const data = res.data?.data;

      const docs = data?.documents || [];

      setDocuments(docs);

      setApplicationNumber(data?.applicationNumber || "");
      setClientName(data?.client?.name || "");

      const uploadedMap: Record<string, boolean> = {};
      docs.forEach((doc: DocumentItem) => {
        if (doc.uploadedFiles?.length > 0) {
          uploadedMap[doc.requirementId] = true;
        }
      });

      setUploaded(uploadedMap);
    } catch (err) {
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

  const removeFile = (id: string, index: number) => {
    setFiles((prev) => {
      const updated = [...(prev[id] || [])];
      updated.splice(index, 1);

      return {
        ...prev,
        [id]: updated.length > 0 ? updated : [],
      };
    });
  };

  const uploadFile = async (id: string) => {
    const fileList = files[id];
    if (!fileList || fileList.length === 0) return;

    setUploading((prev) => ({ ...prev, [id]: true }));

    try {
      for (const file of fileList) {
        const formData = new FormData();

        // IMPORTANT: only this field required
        formData.append("documentRequirementId", id);
        formData.append("file", file);

        const res = await axios.post(
          `${API_BASE}/client-portal/${token}/upload`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );

        setUploadedFilesCount((prev) => prev + 1);

        console.log("UPLOAD SUCCESS:", res.data);
      }

      setUploaded((prev) => ({ ...prev, [id]: true }));
      setFiles((prev) => ({ ...prev, [id]: [] }));
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow p-6 mb-6 sticky top-4 z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* LEFT */}
            <div>
              <h1 className="text-xl font-semibold text-gray-800">
                Upload Documents
              </h1>

              <p className="text-sm text-gray-500 mt-1">{clientName}</p>
            </div>

            {/* RIGHT */}
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
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* GRID (LESS SCROLL) */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.requirementId}
              className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              {/* TOP */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <FileText className="text-blue-600" size={20} />

                  {uploaded[doc.requirementId] && (
                    <CheckCircle className="text-green-600" size={20} />
                  )}
                </div>

                <p className="text-sm font-medium text-gray-800 line-clamp-2">
                  {doc.documentName}
                </p>

                <p
                  className={`text-xs mt-1 ${
                    uploaded[doc.requirementId]
                      ? "text-green-600"
                      : "text-yellow-600"
                  }`}
                >
                  {uploaded[doc.requirementId] ? "Uploaded" : "Pending"}
                </p>
              </div>

              {/* ACTIONS */}
              <div className="mt-4">
                {uploaded[doc.requirementId] ? (
                  <div className="text-xs text-green-600 font-medium">
                    ✔ Completed
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* FILE INPUT */}
                    <input
                      type="file"
                      multiple
                      disabled={(files[doc.requirementId]?.length || 0) >= 4}
                      id={`file-${doc.requirementId}`}
                      className="hidden"
                      onChange={(e) =>
                        handleFileChange(doc.requirementId, e.target.files)
                      }
                    />

                    {/* BUTTON ROW */}
                    <div className="flex gap-2">
                      {/* CHOOSE BUTTON */}
                      <label
                        htmlFor={`file-${doc.requirementId}`}
                        className={`flex-1 text-center text-xs px-3 py-2 border rounded-lg cursor-pointer 
    ${
      (files[doc.requirementId]?.length || 0) >= 4
        ? "bg-gray-200 cursor-not-allowed text-slate-500"
        : "hover:bg-gray-100"
    }`}
                      >
                        Choose File
                      </label>

                      {/* UPLOAD BUTTON */}
                      <button
                        onClick={() => uploadFile(doc.requirementId)}
                        disabled={
                          !(files[doc.requirementId]?.length > 0) ||
                          uploading[doc.requirementId]
                        }
                        className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Upload size={14} />
                        {uploading[doc.requirementId]
                          ? "Uploading..."
                          : "Upload"}
                      </button>
                    </div>

                    {files[doc.requirementId]?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {files[doc.requirementId].map((file, index) => {
                          const isImage = file.type.startsWith("image/");

                          return (
                            <div
                              key={index}
                              className="relative w-16 h-16 border rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center"
                            >
                              {/* IMAGE PREVIEW */}
                              {isImage ? (
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt="preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="text-[10px] text-center px-1">
                                  📄 {file.name.slice(0, 10)}
                                </div>
                              )}

                              {/* REMOVE BUTTON */}
                              <button
                                onClick={() =>
                                  removeFile(doc.requirementId, index)
                                }
                                className="absolute top-0 right-0 bg-black/70 text-white text-[10px] px-1 rounded-bl hover:text-red-500"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
