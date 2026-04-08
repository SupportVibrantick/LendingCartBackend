import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useParams } from "react-router";
import { FiMail, FiLock } from "react-icons/fi";
import { motion } from "framer-motion";

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://api-lendingcart.vibrantick.org";

export default function CustomerLogin() {
  const { token } = useParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE}/broker/client/auth/login`, {
        email,
        password,
      });

      const clientToken = res.data?.token;
      sessionStorage.setItem("client_token", clientToken);

      toast.success("Login successful");

      window.location.href = token
        ? `/client-portal/${token}`
        : `/client-portal`;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-cyan-100 p-4">
      {/* CARD */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md backdrop-blur-xl bg-white/70 border border-white/40 shadow-2xl rounded-3xl p-8"
      >
        {/* TITLE */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Welcome Back 👋</h2>
          <p className="text-sm text-slate-500 mt-1">
            Login to access your client portal
          </p>
        </div>

        {/* EMAIL */}
        <div className="mb-4">
          <label className="text-xs text-slate-500">Email</label>

          <div className="mt-1 flex items-center gap-2 rounded-xl border bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
            <FiMail className="text-slate-400" />
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full bg-transparent outline-none text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* PASSWORD */}
        <div className="mb-5">
          <label className="text-xs text-slate-500">Password</label>

          <div className="mt-1 flex items-center gap-2 rounded-xl border bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
            <FiLock className="text-slate-400" />
            <input
              type="password"
              placeholder="Enter your password"
              className="w-full bg-transparent outline-none text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {/* BUTTON */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleLogin}
          disabled={!email || !password}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-2.5 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50"
        >
          Login
        </motion.button>

        {/* FOOTER */}
        <p className="text-center text-xs text-slate-400 mt-5">
          Secure login powered by LendingCart 🔒
        </p>
      </motion.div>
    </div>
  );
}
