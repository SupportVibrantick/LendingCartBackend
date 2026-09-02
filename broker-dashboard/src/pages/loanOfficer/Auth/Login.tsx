import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { LO_API_BASE, LO_TOKEN_KEY, LO_USER_KEY, clearLoanOfficerSession, isLoanOfficerTokenExpired, verifyLoanOfficerSession } from "../../../lib/loanOfficerApi";
import { setSessionPermissions } from "../../../lib/brokerPermissions";
import { ensureChatSocket } from "../../../lib/chatSocketManager";
import { getOrgIdsFromToken } from "../../../lib/chatSocket";

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

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
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-cyan-50">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-[350px] w-[350px] rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[350px] w-[350px] rounded-full bg-blue-200/40 blur-3xl" />
      </div>

      <div className="relative hidden flex-1 items-center justify-center lg:flex">
        <div className="max-w-xl px-10">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="mb-8 flex items-center gap-3">
              <img
                src="/loanAutomation.jpeg"
                alt="Loan Automation"
                className="h-12 w-12 rounded-full ring-2 ring-[#13538A]/15"
              />
              <div>
                <p className="text-base font-bold text-[#13538A]">Loan Automation</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                  Officer Portal
                </p>
              </div>
            </div>
            <p className="mb-5 inline-flex rounded-full border border-cyan-200 bg-cyan-100 px-4 py-2 text-sm font-medium text-cyan-700">
              Loan Officer Portal
            </p>
            <h1 className="text-5xl font-black leading-tight text-slate-900">
              Manage Your
              <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
                {" "}
                Assigned Deals
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Create applications, manage clients, upload documents, and communicate with borrowers and lenders through your broker.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="w-full max-w-md">
          <div className="rounded-[14px] border border-white bg-white/80 p-8 backdrop-blur-2xl">
            <div className="mb-8 flex justify-center">
              <div className="flex items-center gap-3">
                <img
                  src="/loanAutomation.jpeg"
                  alt="Loan Automation"
                  className="h-14 w-14 rounded-full ring-2 ring-[#13538A]/15"
                />
                <div className="text-left">
                  <p className="text-lg font-bold text-[#13538A]">Loan Automation</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                    Officer Portal
                  </p>
                </div>
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-black text-slate-900">Welcome Back</h2>
              <p className="mt-2 text-sm text-slate-500">Login to access your Loan Officer Portal</p>
            </div>
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Email Address</label>
                <div className={`flex items-center gap-3 rounded-2xl border px-4 py-4 transition ${errors.email ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 focus-within:border-cyan-400 focus-within:bg-white"}`}>
                  <Mail size={18} className={errors.email ? "text-red-400" : "text-slate-400"} />
                  <input type="email" placeholder="Enter your email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }} className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none" />
                </div>
                {errors.email && <p className="mt-2 text-xs font-medium text-red-500">{errors.email}</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                <div className={`flex items-center gap-3 rounded-2xl border px-4 py-4 transition ${errors.password ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 focus-within:border-cyan-400 focus-within:bg-white"}`}>
                  <LockKeyhole size={18} className={errors.password ? "text-red-400" : "text-slate-400"} />
                  <input type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }} className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 transition hover:text-slate-700">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="mt-2 text-xs font-medium text-red-500">{errors.password}</p>}
              </div>
              <div className="flex justify-end">
                <Link
                  to="/reset-password?portal=loan-officer"
                  className="text-sm font-medium text-cyan-600 transition hover:text-cyan-500"
                >
                  Forgot password?
                </Link>
              </div>
              <motion.button whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.01 }} type="submit" disabled={loading} className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-4 text-sm font-semibold text-white transition-all hover:shadow-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-70">
                {loading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Logging In...
                  </>
                ) : (
                  <>Login To Portal<ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" /></>
                )}
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
