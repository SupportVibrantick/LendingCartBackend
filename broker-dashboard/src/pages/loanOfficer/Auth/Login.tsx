import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  Mail,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import GridShape from "../../../components/common/GridShape";
import ThemeTogglerTwo from "../../../components/common/ThemeTogglerTwo";
import {
  LO_API_BASE,
  LO_TOKEN_KEY,
  LO_USER_KEY,
  clearLoanOfficerSession,
  isLoanOfficerTokenExpired,
  verifyLoanOfficerSession,
} from "../../../lib/loanOfficerApi";
import { setSessionPermissions } from "../../../lib/brokerPermissions";
import { ensureChatSocket } from "../../../lib/chatSocketManager";
import { getOrgIdsFromToken } from "../../../lib/chatSocket";

const FEATURES = [
  { icon: FileText, text: "Create and manage assigned applications" },
  { icon: Users, text: "Work with borrowers and co-brokers" },
  { icon: MessageSquare, text: "Chat and share updates in one place" },
  { icon: ShieldCheck, text: "Secure portal access for your team" },
];

function inputWrap(hasError: boolean) {
  return `flex items-center gap-3 rounded-xl border px-4 py-3.5 transition focus-within:ring-2 focus-within:ring-[#13538A]/30 ${
    hasError
      ? "border-red-300 bg-red-50 dark:border-red-500/50 dark:bg-red-950/20"
      : "border-gray-200 bg-gray-50 focus-within:border-[#13538A] focus-within:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus-within:border-cyan-500 dark:focus-within:bg-gray-900"
  }`;
}

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email))
      newErrors.email = "Please enter a valid email";
    if (!password.trim()) newErrors.password = "Password is required";
    else if (password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrors({});
    if (!validate()) return;

    try {
      setLoading(true);
      clearLoanOfficerSession();

      const res = await fetch(`${LO_API_BASE}/loanofficer/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.errors && Array.isArray(json.errors)) {
          const fieldErrors: Record<string, string> = {};
          json.errors.forEach((err: { field: string; message: string }) => {
            fieldErrors[err.field] = err.message;
          });
          setErrors(fieldErrors);
        }
        toast.error(json.message || "Login failed");
        return;
      }

      sessionStorage.setItem(LO_TOKEN_KEY, json.token);
      sessionStorage.setItem(LO_USER_KEY, JSON.stringify(json.user));
      if (json.roles) sessionStorage.setItem("roles", JSON.stringify(json.roles));
      if (json.permissions) setSessionPermissions(json.permissions);

      const orgIds = getOrgIdsFromToken(json.token);
      ensureChatSocket(json.token, {
        getBrokerOrgId: () =>
          json.user?.organizationId || orgIds.brokerOrgId,
      });

      const verified = await verifyLoanOfficerSession(json.token);
      if (!verified) {
        clearLoanOfficerSession();
        toast.error("Login succeeded but session could not be verified");
        return;
      }

      toast.success("Login successful");
      navigate("/loan-officer/dashboard");
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem(LO_TOKEN_KEY);
    if (token && !isLoanOfficerTokenExpired(token)) {
      navigate("/loan-officer/dashboard");
    } else if (token) {
      clearLoanOfficerSession();
    }
  }, [navigate]);

  return (
    <div className="relative h-dvh overflow-hidden bg-white dark:bg-gray-950">
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        {/* Brand panel — fixed */}
        <div className="relative hidden h-full min-h-0 overflow-hidden bg-[#0b1f3a] lg:flex lg:w-[48%] xl:w-[52%]">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#0b1f3a_0%,#13538A_45%,#1a6aad_100%)]" />
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-[100px]" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-blue-500/20 blur-[80px]" />
          <GridShape />

          <div className="relative z-10 flex h-full w-full flex-col justify-center px-12 xl:px-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="mb-8 flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-full ring-4 ring-white/20 shadow-xl shadow-black/20">
                  <img
                    src="/loanAutomation.jpeg"
                    alt="Loan Automation"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">Loan Automation</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-blue-200/70">
                    Officer Portal
                  </p>
                </div>
              </div>

              <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100 backdrop-blur-sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Loan Officer Portal
              </span>

              <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
                Manage your{" "}
                <span className="bg-gradient-to-r from-cyan-200 to-white bg-clip-text text-transparent">
                  assigned deals
                </span>
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-blue-100/80">
                Create applications, manage clients, upload documents, and
                communicate with borrowers through your broker team.
              </p>

              <ul className="mt-10 space-y-3.5">
                {FEATURES.map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="flex items-center gap-3 text-sm text-blue-50/90"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-cyan-200">
                      <Icon className="h-4 w-4" />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>

        {/* Form panel — scrolls if needed */}
        <div className="auth-form-scrollbar relative flex h-full min-h-0 w-full justify-center overflow-y-auto overscroll-contain lg:flex-1">
          <div className="my-auto w-full max-w-md px-5 py-10 sm:px-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                <img
                  src="/loanAutomation.jpeg"
                  alt="Loan Automation"
                  className="h-12 w-12 rounded-full ring-2 ring-[#13538A]/20"
                />
                <div>
                  <p className="text-lg font-bold text-[#13538A] dark:text-cyan-400">
                    Loan Automation
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                    Officer Portal
                  </p>
                </div>
              </div>

              <span className="mb-4 inline-flex rounded-full border border-[#13538A]/20 bg-[#13538A]/5 px-3 py-1 text-xs font-semibold text-[#13538A] dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300">
                Loan Officer Portal
              </span>

              <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                Welcome back
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Sign in to access your assigned pipeline and clients.
              </p>

              <form
                onSubmit={handleSubmit}
                className="mt-8 space-y-5"
                noValidate
              >
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email address
                  </label>
                  <div className={inputWrap(Boolean(errors.email))}>
                    <Mail
                      size={18}
                      className={
                        errors.email ? "text-red-400" : "text-gray-400"
                      }
                    />
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrors((p) => ({ ...p, email: undefined }));
                      }}
                      className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white dark:placeholder:text-gray-500"
                    />
                  </div>
                  {errors.email ? (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {errors.email}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                  <div className={inputWrap(Boolean(errors.password))}>
                    <LockKeyhole
                      size={18}
                      className={
                        errors.password ? "text-red-400" : "text-gray-400"
                      }
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((p) => ({ ...p, password: undefined }));
                      }}
                      className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white dark:placeholder:text-gray-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {errors.password}
                    </p>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <Link
                    to="/reset-password?portal=loan-officer"
                    className="text-sm font-medium text-[#13538A] transition hover:underline dark:text-cyan-400"
                  >
                    Forgot password?
                  </Link>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#183b57] to-[#36536c] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#183b57]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight
                        size={18}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
        <ThemeTogglerTwo />
      </div>
    </div>
  );
}
