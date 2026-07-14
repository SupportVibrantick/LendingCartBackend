import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import { EyeCloseIcon, EyeIcon } from "../../icons";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type InviteData = {
  companyName: string;
  fullName: string;
  email: string;
  phone?: string | null;
  status: string;
  expiresAt: string;
};

function splitName(fullName = "") {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export default function AcceptInvite() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [form, setForm] = useState({
    organizationName: "",
    organizationEmail: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    password: "",
  });

  useEffect(() => {
    if (!token) {
      setError("Invitation token is missing");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${API_BASE}/public/lender-invites/${encodeURIComponent(token)}`,
        );
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok || !json.success) {
          setError(json.message || "Invalid invitation");
          setErrorCode(json.code || null);
          setInvite(json.data || null);
          return;
        }

        const data = json.data as InviteData;
        const names = splitName(data.fullName);
        setInvite(data);
        setForm({
          organizationName: data.companyName || "",
          organizationEmail: data.email || "",
          adminFirstName: names.firstName,
          adminLastName: names.lastName,
          adminEmail: data.email || "",
          password: "",
        });
      } catch {
        if (!cancelled) {
          setError("Failed to load invitation");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !invite) return;

    try {
      setSaving(true);
      const res = await fetch(`${API_BASE}/lender/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: form.organizationName,
          organizationEmail: form.organizationEmail,
          organizationPhone: invite.phone || undefined,
          adminFirstName: form.adminFirstName,
          adminLastName: form.adminLastName,
          adminEmail: form.adminEmail,
          password: form.password,
          inviteToken: token,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to register");
        return;
      }

      toast.success("Account created successfully. Please sign in.");
      navigate("/signin");
    } catch {
      toast.error("Failed to register");
    } finally {
      setSaving(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    try {
      setDeclining(true);
      const res = await fetch(
        `${API_BASE}/public/lender-invites/${encodeURIComponent(token)}/decline`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to decline invitation");
        return;
      }
      toast.success("Invitation declined");
      setError("You declined this invitation");
      setErrorCode("DECLINED");
      setInvite(null);
    } catch {
      toast.error("Failed to decline invitation");
    } finally {
      setDeclining(false);
    }
  };

  return (
    <>
      <PageMeta title="Accept Invitation | LendingCart" description="" />
      <AuthLayout>
        <div className="flex flex-col flex-1 w-full overflow-y-auto lg:w-1/2 no-scrollbar">
          <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto px-4">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
                Accept Invitation
              </h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Create your lender account to join LendingCart.
              </p>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Validating invitation...</p>
            ) : error || !invite ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <p className="font-medium">{error || "Invitation unavailable"}</p>
                {errorCode && (
                  <p className="mt-1 text-xs uppercase tracking-wide opacity-70">
                    {errorCode}
                  </p>
                )}
                <Link
                  to="/signin"
                  className="mt-4 inline-block text-sm font-semibold text-brand-500"
                >
                  Go to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <Label>
                    Company Name<span className="text-error-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={form.organizationName}
                    onChange={(e) =>
                      setForm({ ...form, organizationName: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>
                    Company Email<span className="text-error-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={form.organizationEmail}
                    onChange={(e) =>
                      setForm({ ...form, organizationEmail: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <Label>
                      First Name<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={form.adminFirstName}
                      onChange={(e) =>
                        setForm({ ...form, adminFirstName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      type="text"
                      value={form.adminLastName}
                      onChange={(e) =>
                        setForm({ ...form, adminLastName: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>
                    Admin Email<span className="text-error-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={form.adminEmail}
                    disabled
                    className="cursor-not-allowed bg-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Locked to the invited email address
                  </p>
                </div>

                <div>
                  <Label>
                    Password<span className="text-error-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    {saving ? "Creating account..." : "Create Account"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDecline}
                    disabled={declining || saving}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
                  >
                    {declining ? "Declining..." : "Decline Invitation"}
                  </button>
                </div>

                <p className="text-sm text-center text-gray-500">
                  Already registered?{" "}
                  <Link to="/signin" className="text-brand-500 font-medium">
                    Sign in
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </AuthLayout>
    </>
  );
}
