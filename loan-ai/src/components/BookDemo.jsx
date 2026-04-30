import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const BookDemoPage = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.fullName || !form.email) {
      toast.error("Please fill required fields");
      return;
    }

    try {
      setLoading(true);
      await new Promise((res) => setTimeout(res, 1200));
      toast.success("Demo booked successfully!");
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-[#0b1020] text-white overflow-hidden">

      {/* GRID BACKGROUND */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      {/* GLOW EFFECT */}
      <div className="absolute -top-25 left-[50%] -translate-x-1/2 w-150 h-150 bg-indigo-500/20 blur-[120px] rounded-full"></div>

      {/* HEADER */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md">
        <h1 className="font-semibold text-lg">Loan AI</h1>

        <button
          onClick={() => navigate("/")}
          className="px-5 py-2 rounded-lg bg-white/10 border border-white/20 
          hover:bg-white/20 transition text-sm"
        >
          ← Home
        </button>
      </div>

      {/* CONTENT */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-12 items-center">

        {/* LEFT */}
        <div>
          <span className="inline-block px-4 py-1 mb-4 text-sm rounded-full bg-white/10 border border-white/20">
            Smart Lending Platform
          </span>

          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Book a Demo <br />
            <span className="text-blue-400">See It In Action</span>
          </h1>

          <p className="mt-5 text-slate-300">
            Discover how Loan AI automates your workflows, matches lenders instantly,
            and boosts your productivity.
          </p>

          <div className="mt-6 space-y-3 text-sm text-slate-400">
            <div>✔ Instant lender matching</div>
            <div>✔ One-click loan processing</div>
            <div>✔ Automated follow-ups</div>
            <div>✔ Real-time analytics</div>
          </div>
        </div>

        {/* FORM */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl">

          <h2 className="text-lg font-semibold mb-4">
            Schedule Your Demo
          </h2>

          <div className="space-y-4">

            {["fullName", "email", "phone", "company"].map((field) => (
              <input
                key={field}
                placeholder={
                  field === "fullName"
                    ? "Full Name *"
                    : field === "email"
                    ? "Email *"
                    : field === "phone"
                    ? "Phone Number"
                    : "Company Name"
                }
                value={(form)[field]}
                onChange={(e) => handleChange(field, e.target.value)}
                className="w-full rounded-xl px-4 py-2 text-sm 
                bg-white/10 border border-white/20 
                text-white placeholder:text-slate-400
                outline-none focus:ring-2 focus:ring-blue-500"
              />
            ))}

            <textarea
              placeholder="Message"
              value={form.message}
              onChange={(e) => handleChange("message", e.target.value)}
              rows={3}
              className="w-full rounded-xl px-4 py-2 text-sm 
              bg-white/10 border border-white/20 
              text-white placeholder:text-slate-400
              outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* BUTTON */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold 
              bg-linear-to-r from-blue-500 to-indigo-500
              hover:from-indigo-500 hover:to-blue-500 
              transition disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Book Demo"}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDemoPage;