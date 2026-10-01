import { HardDrive, Cloud, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { adminFetch } from "../../lib/adminApi";

type StorageSettingsData = {
  activeProvider: "local" | "s3";
  dbOverride: "local" | "s3" | null;
  envProvider: "local" | "s3";
  s3Configured: boolean;
  s3Bucket: string | null;
  s3Region: string | null;
  s3PublicBaseUrl: string | null;
  secretsFromEnv: boolean;
  canSwitchToS3: boolean;
  updatedAt: string | null;
};

const StorageSettingsCard = () => {
  const [data, setData] = useState<StorageSettingsData | null>(null);
  const [provider, setProvider] = useState<"local" | "s3">("local");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await adminFetch<{ success: boolean; data: StorageSettingsData }>(
        "/admin/system/storage",
      );
      setData(json.data);
      setProvider(json.data.activeProvider);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load storage settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (provider === "s3" && data && !data.canSwitchToS3) {
      toast.error("Configure S3_BUCKET and AWS_REGION on the server first");
      return;
    }

    setSaving(true);
    try {
      const json = await adminFetch<{
        success: boolean;
        message?: string;
        data: { activeProvider: "local" | "s3" };
      }>("/admin/system/storage", {
        method: "PUT",
        body: JSON.stringify({ provider }),
      });
      toast.success(json.message || "Storage settings saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-8 flex items-center justify-center gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading storage settings…
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-11 h-11 rounded-xl bg-[#13538A]/10 flex items-center justify-center">
          <HardDrive className="w-5 h-5 text-[#13538A]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#13538A]">Document Storage</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose where new loan documents are stored. Existing files stay where they were uploaded.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button
          type="button"
          onClick={() => setProvider("local")}
          className={`text-left border rounded-xl p-4 transition ${
            provider === "local"
              ? "border-[#13538A] bg-[#13538A]/5 ring-2 ring-[#13538A]/20"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4 text-[#13538A]" />
            <span className="font-semibold text-sm dark:text-white">Local disk</span>
          </div>
          <p className="text-xs text-gray-500">
            Files saved on the API server under <code className="text-[11px]">uploads/</code>.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setProvider("s3")}
          disabled={!data?.canSwitchToS3 && provider !== "s3"}
          className={`text-left border rounded-xl p-4 transition ${
            provider === "s3"
              ? "border-[#13538A] bg-[#13538A]/5 ring-2 ring-[#13538A]/20"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
          } ${!data?.canSwitchToS3 ? "opacity-70" : ""}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="w-4 h-4 text-[#13538A]" />
            <span className="font-semibold text-sm dark:text-white">Amazon S3</span>
          </div>
          <p className="text-xs text-gray-500">
            New uploads go to your S3 bucket. Served via the API proxy or public CDN URL.
          </p>
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 mb-6 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500">Active provider</span>
          <span className="font-medium dark:text-white uppercase">{data?.activeProvider}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500">Env default</span>
          <span className="font-medium dark:text-white uppercase">{data?.envProvider}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500">Admin override</span>
          <span className="font-medium dark:text-white uppercase">
            {data?.dbOverride || "none"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500">S3 configured</span>
          <span className="flex items-center gap-1 font-medium dark:text-white">
            {data?.s3Configured ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600" /> Yes
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-500" /> No
              </>
            )}
          </span>
        </div>
        {data?.s3Configured && (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500">Bucket</span>
              <span className="font-mono text-xs dark:text-white">{data.s3Bucket}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500">Region</span>
              <span className="font-mono text-xs dark:text-white">{data.s3Region}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500">Public base URL</span>
              <span className="font-mono text-xs dark:text-white truncate max-w-[55%] text-right">
                {data.s3PublicBaseUrl || "— (proxy via /uploads)"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500">Credentials</span>
              <span className="text-xs dark:text-white">
                {data.secretsFromEnv ? "From env keys" : "IAM role / default chain"}
              </span>
            </div>
          </>
        )}
      </div>

      {!data?.s3Configured && (
        <div className="mb-6 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            To enable S3, set <code>S3_BUCKET</code>, <code>AWS_REGION</code>, and credentials
            (<code>AWS_ACCESS_KEY_ID</code> / <code>AWS_SECRET_ACCESS_KEY</code> or an instance IAM
            role) in the backend environment, then restart the API.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => void load()}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || provider === data?.activeProvider}
          className="px-6 py-2 text-sm bg-[#13538A] text-white rounded-lg hover:bg-[#0f436e] transition shadow disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

export default StorageSettingsCard;
