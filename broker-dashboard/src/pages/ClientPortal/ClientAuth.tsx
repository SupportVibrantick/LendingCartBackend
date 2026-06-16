import { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://api-lendingcart.vibrantick.org";

const LOAN_AUTOMATION_LOGO = "/loanAutomation.jpeg";

export default function ClientAuth() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [isLogin, setIsLogin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  //   const [clientId, setClientId] = useState("");
  const [password, setPassword] = useState("");

  /* ================= CHECK USER ================= */
  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const clientToken = sessionStorage.getItem("client_token");

      if (!token) {
        // redirect
        if (clientToken) {
          window.location.href = "/client-portal";
          return;
        }

        setIsLogin(true);
        setEmail("");
        return;
      }

      let url = `${API_BASE}/client-portal/check-user?token=${token}`;

      const res = await axios.get(url);
      const data = res.data?.data;

      if (!data?.tokenValid) {
        toast.error("Invalid or expired link");
        return;
      }

      setEmail(data.email);

      setIsLogin(data.userExists);
    } catch (err) {
      console.log("Something went wrong");
    } finally {
      setLoading(false);
    }
  };
  /* ================= LOGIN ================= */
  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE}/client-portal/auth/login`, {
        email,
        password,
      });

      const clientToken = res.data?.data?.token;
      if (!clientToken) {
        toast.error("Token not received");
        return;
      }

      sessionStorage.setItem("client_token", clientToken);

      toast.success("Login successful");

      window.location.href = `/client-portal`;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Login failed");
    }
  };

  /* ================= SET PASSWORD ================= */
  const handleSetPassword = async () => {
    try {
      // const brokerToken = sessionStorage.getItem("broker_token");

      // const headers = {
      //   Authorization: `Bearer ${brokerToken}`,
      // };

      // SET PASSWORD (with token)
      await axios.post(
        `${API_BASE}/client-portal/auth/set-password`,
        {
          token,
          password,
        },
        // { headers },
      );

      toast.success("Password set successfully");

      // AUTO LOGIN (with token)
      const loginRes = await axios.post(
        `${API_BASE}/client-portal/auth/login`,
        {
          email,
          password,
        },
        // { headers },
      );

      const clientToken = loginRes.data?.data?.token;

      sessionStorage.setItem("client_token", clientToken);

      // REDIRECT
      window.location.href = `/client-portal/${token}`;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed");
    }
  };

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  /* ================= UI ================= */
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        !token || isLogin === true ? handleLogin() : handleSetPassword();
      }}
    >
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 h-16 w-16 overflow-hidden rounded-2xl border border-slate-200">
              <img
                src={LOAN_AUTOMATION_LOGO}
                alt="Loan Automation"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="text-base font-bold text-slate-900">Loan Automation</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
              Client Portal
            </p>
          </div>

          {/* TITLE */}
          <h2 className="text-xl font-semibold text-gray-800 text-center mb-2">
            {!token || isLogin === true
              ? "Welcome Back 👋"
              : "Create Your Password"}
          </h2>

          {/* EMAIL */}
          <div className="mb-4">
            <label className="text-xs text-gray-500">Email</label>
            <input
              type="email"
              value={email}
              disabled={!!token}
              placeholder="Enter email"
              className={`w-full mt-1 px-3 py-2 border rounded-lg text-sm ${
                token ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* PASSWORD */}
          <div className="mb-4 relative">
            <label className="text-xs text-gray-500">Password</label>

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              className="w-full mt-1 px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {/* 👁 Eye Button */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[38px] text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* BUTTON */}
          <button
            // onClick={
            //   !token || isLogin === true ? handleLogin : handleSetPassword
            // }
            disabled={!password}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50"
          >
            {!token || isLogin === true ? "Login" : "Set Password"}
          </button>

          {/* FOOTER TEXT */}
          {token && isLogin === false && (
            <p className="text-xs text-center text-gray-400 mt-4">
              After setting password, you will login
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
