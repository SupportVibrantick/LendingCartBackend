import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "{{LOCAL_URL}}";

export default function CustomerLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const getHeaders = () => {
    const brokerToken = sessionStorage.getItem("broker_token");

    return {
      Authorization: `Bearer ${brokerToken}`,
    };
  };

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

      // store token
      sessionStorage.setItem("client_token", clientToken);

      toast.success("Login successful");

      // redirect (NO token in URL)
      window.location.href = `/client-portal`;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-800 text-center mb-4">
          Client Login
        </h2>

        {/* EMAIL */}
        <div className="mb-4">
          <label className="text-xs text-gray-500">Email</label>
          <input
            type="email"
            placeholder="Enter email"
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          onClick={handleLogin}
          disabled={!email || !password}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50"
        >
          Login
        </button>
      </div>
    </div>
  );
}
