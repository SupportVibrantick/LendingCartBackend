import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CO_BROKER_API_BASE,
  CO_BROKER_PORTAL_LABEL,
  CO_BROKER_TOKEN_KEY,
  CO_BROKER_USER_KEY,
  DEFAULT_CO_BROKER_LOGO,
  resolveCoBrokerLogoUrl,
  storeCoBrokerBranding,
} from "../../../lib/coBrokerPortal";

const API_BASE = CO_BROKER_API_BASE;

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // ERRORS
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  // VALIDATION
  const validate = () => {
    const newErrors: {
      email?: string;
      password?: string;
    } = {};

    // EMAIL
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    // PASSWORD
    if (!password.trim()) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // SUBMIT
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    // CLEAR OLD ERRORS
    setErrors({});

    // FRONTEND VALIDATION
    if (!validate()) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/subbroker/auth/login`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email,
          password,
        }),
      });

      const json = await res.json();

      // API ERROR
      if (!res.ok || !json.success) {
        // ZOD FIELD ERRORS
        if (json.errors && Array.isArray(json.errors)) {
          const fieldErrors: Record<string, string> = {};

          json.errors.forEach((err: any) => {
            fieldErrors[err.field] = err.message;
          });

          setErrors(fieldErrors);
        }

        toast.error(json.message || "Login failed");

        return;
      }

      // SAVE TOKEN
      sessionStorage.setItem(CO_BROKER_TOKEN_KEY, json.token);
      sessionStorage.setItem(CO_BROKER_USER_KEY, JSON.stringify(json.user));

      if (json.branding) {
        storeCoBrokerBranding(json.branding);
      }

      toast.success("Login successful");

      // REDIRECT
      navigate("/sub-broker/loan-pipeline");
    } catch (err: any) {
      console.error(err);

      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);

    if (token) {
      navigate("/sub-broker/loan-pipeline");
    }
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-cyan-50">
      {/* BACKGROUND BLURS */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-[350px] w-[350px] rounded-full bg-cyan-200/40 blur-3xl" />

        <div className="absolute bottom-0 right-0 h-[350px] w-[350px] rounded-full bg-blue-200/40 blur-3xl" />
      </div>

      {/* LEFT SECTION */}
      <div className="relative hidden flex-1 items-center justify-center lg:flex">
        <div className="max-w-xl px-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <p className="mb-5 inline-flex rounded-full border border-cyan-200 bg-cyan-100 px-4 py-2 text-sm font-medium text-cyan-700">
              Affiliate Style Loan Portal
            </p>

            <h1 className="text-5xl font-black leading-tight text-slate-900">
              Manage Assigned
              <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
                {" "}
                Loan Applications
              </span>
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              Access your assigned loan pipeline, manage documents, communicate
              with brokers, and review loan offers from one centralized portal.
            </p>
          </motion.div>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="w-full max-w-md"
        >
          {/* CARD */}
          <div className="rounded-[14px] border border-white bg-white/80 p-8  backdrop-blur-2xl">
            {/* LOGO */}
            <div className="mb-8 flex justify-center">
              <img
                src={resolveCoBrokerLogoUrl(DEFAULT_CO_BROKER_LOGO)}
                alt="Portal logo"
                className="h-16 w-16 rounded-2xl object-cover ring-2 ring-cyan-100"
              />
            </div>

            {/* TITLE */}
            <div className="text-center">
              <h2 className="text-3xl font-black text-slate-900">
                Welcome Back
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Login to access your {CO_BROKER_PORTAL_LABEL}
              </p>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {/* EMAIL */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email Address
                </label>

                <div
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-4 transition ${
                    errors.email
                      ? "border-red-400 bg-red-50"
                      : "border-slate-200 bg-slate-50 focus-within:border-cyan-400 focus-within:bg-white"
                  }`}
                >
                  <Mail
                    size={18}
                    className={errors.email ? "text-red-400" : "text-slate-400"}
                  />

                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);

                      setErrors((prev) => ({
                        ...prev,
                        email: "",
                      }));
                    }}
                    className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>

                {/* ERROR */}
                {errors.email && (
                  <p className="mt-2 text-xs font-medium text-red-500">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* PASSWORD */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Password
                </label>

                <div
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-4 transition ${
                    errors.password
                      ? "border-red-400 bg-red-50"
                      : "border-slate-200 bg-slate-50 focus-within:border-cyan-400 focus-within:bg-white"
                  }`}
                >
                  <LockKeyhole
                    size={18}
                    className={
                      errors.password ? "text-red-400" : "text-slate-400"
                    }
                  />

                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);

                      setErrors((prev) => ({
                        ...prev,
                        password: "",
                      }));
                    }}
                    className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 transition hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* ERROR */}
                {errors.password && (
                  <p className="mt-2 text-xs font-medium text-red-500">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* OPTIONS */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" className="rounded border-slate-300" />
                  Remember me
                </label>

                <Link
                  to="/reset-password?portal=sub-broker"
                  className="text-sm font-medium text-cyan-600 transition hover:text-cyan-500"
                >
                  Forgot Password?
                </Link>
              </div>

              {/* BUTTON */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.01 }}
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-4 text-sm font-semibold text-white transition-all hover:shadow-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Logging In...
                  </>
                ) : (
                  <>
                    Login To Portal
                    <ArrowRight
                      size={18}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </>
                )}
              </motion.button>
            </form>

            {/* FOOTER */}
            <p className="mt-8 text-center text-xs leading-6 text-slate-500">
              Secure affiliate-style access for assigned loan applications and
              broker communication.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
