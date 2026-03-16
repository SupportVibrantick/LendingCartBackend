import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { Upload, FileText, CheckCircle } from "lucide-react";

interface DocumentType {
  name: string;
}

interface Requirement {
  id: string;
  documentType: DocumentType;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export default function ClientUpload() {
  const { token } = useParams<{ token: string }>();

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [invalidToken, setInvalidToken] = useState<boolean>(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    verifyToken();
  }, []);

  /* ================= VERIFY TOKEN ================= */

  const verifyToken = async () => {
    try {
      const res = await axios.get(`${API_BASE}/client-portal/verify/${token}`);

      console.log("VERIFY RESPONSE:", res.data);

      const docs = res.data?.data?.requirements || res.data?.requirements || [];

      setRequirements(docs);
    } catch (err) {
      console.error("Invalid token:", err);
      setInvalidToken(true);
    } finally {
      setLoading(false);
    }
  };

  /* ================= FILE CHANGE ================= */

  const handleFileChange = (docId: string, file: File | null) => {
    setFiles((prev) => ({
      ...prev,
      [docId]: file,
    }));
  };

  /* ================= UPLOAD FILE ================= */

  const uploadFile = async (docId: string) => {
    if (!files[docId]) return;

    setUploading((prev) => ({
      ...prev,
      [docId]: true,
    }));

    try {
      const formData = new FormData();

      formData.append("token", token || "");
      formData.append("documentRequirementId", docId);
      formData.append("file", files[docId] as Blob);

      await axios.post(`${API_BASE}/client-portal/upload`, formData);

      setUploaded((prev) => ({
        ...prev,
        [docId]: true,
      }));
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading((prev) => ({
        ...prev,
        [docId]: false,
      }));
    }
  };

  /* ================= LOADING SCREEN ================= */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading upload portal...
      </div>
    );
  }

  /* ================= INVALID TOKEN ================= */

  if (invalidToken) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow text-center">
          <h2 className="text-xl font-semibold text-red-600">
            Invalid or Expired Link
          </h2>
          <p className="text-gray-500 mt-2">
            This upload link is no longer valid.
          </p>
        </div>
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-gray-800">
            Upload Required Documents
          </h1>

          <p className="text-gray-500 mt-2">
            Please upload the requested documents to continue your application.
          </p>
        </div>

        {/* EMPTY STATE */}
        {requirements.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            No documents required for upload.
          </div>
        )}

        {/* DOCUMENT LIST */}
        <div className="space-y-5">
          {requirements.map((doc) => (
            <div
              key={doc.id}
              className="bg-white border rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm"
            >
              {/* LEFT */}
              <div className="flex items-center gap-3">
                <FileText className="text-blue-600" size={22} />

                <div>
                  <p className="font-medium text-gray-800">
                    {doc.documentType?.name || "Document"}
                  </p>

                  {files[doc.id] && (
                    <p className="text-xs text-gray-500">
                      {files[doc.id]?.name}
                    </p>
                  )}
                </div>
              </div>

              {/* RIGHT */}

              <div className="flex items-center gap-3">
                {uploaded[doc.id] ? (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle size={18} />
                    Uploaded
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      onChange={(e) =>
                        handleFileChange(
                          doc.id,
                          e.target.files ? e.target.files[0] : null,
                        )
                      }
                      className="text-sm"
                    />

                    <button
                      onClick={() => uploadFile(doc.id)}
                      disabled={uploading[doc.id]}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
                    >
                      <Upload size={16} />

                      {uploading[doc.id] ? "Uploading..." : "Upload"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
