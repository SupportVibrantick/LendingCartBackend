import { useLocation, useNavigate } from "react-router-dom";
import { Download, ArrowLeft, ExternalLink, Send } from "lucide-react";

export default function LoiPreview() {
  const location = useLocation();
  const navigate = useNavigate();

  const pdfUrl = location.state?.pdfUrl;

  if (!pdfUrl) {
    return (
      <div className="h-screen flex items-center justify-center text-red-500">
        PDF not found
      </div>
    );
  }

  const handleDownload = async () => {
    try {
      const res = await fetch(pdfUrl);

      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "LOI.pdf";

      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950">
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800"
          >
            <ArrowLeft size={18} />
          </button>

          <h1 className="text-lg font-bold">LOI Preview</h1>
        </div>

        <div className="flex gap-2">
          {/* OPEN */}
          <button
            onClick={() => window.open(pdfUrl, "_blank")}
            className="flex items-center gap-2 px-4 py-2 bg-[#18B6B4] text-white rounded-lg hover:bg-[#139c9a] transition"
          >
            <ExternalLink size={16} />
            Open
          </button>

          {/* DOWNLOAD */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 border border-[#18B6B4] text-[#18B6B4] rounded-lg hover:bg-[#18B6B4] hover:text-white transition"
          >
            <Download size={16} />
            Download
          </button>

          {/* SEND BROKER */}
          <button
            // onClick={handleSendBroker}
            className="flex items-center gap-2 px-4 py-2 bg-[#18B6B4]/10 text-[#18B6B4] border border-[#18B6B4]/30 rounded-lg hover:bg-[#18B6B4] hover:text-white transition"
          >
            <Send size={16} />
            Send Broker
          </button>
        </div>
      </div>

      {/* PDF VIEWER */}
      <div className="flex-1 p-4">
        <iframe
          src={`https://docs.google.com/gview?url=${pdfUrl}&embedded=true`}
          className="w-full h-full"
          title="PDF Viewer"
        />
      </div>
    </div>
  );
}
