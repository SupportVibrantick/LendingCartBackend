import { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "{{LOCAL_URL}}";

export default function ClientAuth() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
//   const [clientId, setClientId] = useState("");
  const [password, setPassword] = useState("");

  /* ================= HEADERS ================= */
  const getHeaders = () => {
    const brokerToken = sessionStorage.getItem("broker_token");

    return {
      Authorization: `Bearer ${brokerToken}`,
    };
  };

  /* ================= CHECK USER ================= */
  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/broker/client/check-user/${token}`,
        {
          headers: getHeaders(),
        },
      );

      const data = res.data?.data;

      if (!data?.tokenValid) {
        toast.error("Invalid or expired link");
        return;
      }

      setEmail(data.email);
    //   setClientId(data.clientId);
      setIsLogin(data.userExists); // true = login, false = set password
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  /* ================= LOGIN ================= */
  const handleLogin = async () => {
    try {
      const res = await axios.post(
        `${API_BASE}/broker/client/auth/login`,
        {
          email,
          password,
        },
        {
          headers: getHeaders(),
        },
      );

      const clientToken = res.data?.token;

      // store client token
      sessionStorage.setItem("client_token", clientToken);

      toast.success("Login successful");

      // redirect to client portal
      window.location.href = `/client-portal/${token}`;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Login failed");
    }
  };

  /* ================= SET PASSWORD ================= */
  const handleSetPassword = async () => {
    try {
      await axios.post(
        `${API_BASE}/broker/client/auth/set-password`,
        {
          token,
          password,
        },
        {
          headers: getHeaders(),
        },
      );

      toast.success("Password set successfully");

      // IMPORTANT: switch to login
      setPassword("");
      setIsLogin(true);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-6">
        {/* TITLE */}
        <h2 className="text-xl font-semibold text-gray-800 text-center mb-2">
          {isLogin ? "Welcome Back 👋" : "Create Your Password"}
        </h2>

        {/* EMAIL */}
        <div className="mb-4">
          <label className="text-xs text-gray-500">Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-gray-100 cursor-not-allowed"
          />
        </div>

        {/* PASSWORD */}
        <div className="mb-4">
          <label className="text-xs text-gray-500">Password</label>
          <input
            type="password"
            placeholder="Enter password"
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* BUTTON */}
        <button
          onClick={isLogin ? handleLogin : handleSetPassword}
          disabled={!password}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50"
        >
          {isLogin ? "Login" : "Set Password"}
        </button>

        {/* FOOTER TEXT */}
        {!isLogin && (
          <p className="text-xs text-center text-gray-400 mt-4">
            After setting password, you will login
          </p>
        )}
      </div>
    </div>
  );
}
