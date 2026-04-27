import { useState, useRef, useEffect } from "react";
import { Mail, User } from "lucide-react";
import toast from "react-hot-toast";

const EmailMarketing = () => {
  const [toInput] = useState("");
  const [email, setEmail] = useState("");
  const [recipients] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [sending, setSending] = useState(false);

  const suggestions = [
    "test@gmail.com",
    "client@company.com",
    "sales@demo.com",
    "hello@startup.io",
    "info@business.com",
  ];

  const handleSend = async () => {
    if (!email) {
      toast.error("Please enter email");
      return;
    }

    const adminToken = sessionStorage.getItem("admin_token");

    if (!adminToken) {
      toast.error("Unauthorized");
      return;
    }

    try {
      setSending(true);

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/admin/email/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            to: email,
            name,
            subject,
            message,
          }),
        },
      );

      const json = await res.json();

      const isSuccess =
        res.ok &&
        json?.success &&
        json?.data?.success &&
        json?.data?.ghlResponse?.status?.includes("Success");

      if (!isSuccess) {
        throw new Error(json?.message || "Failed to send email");
      }

      toast.success("Email sent successfully 🚀");

      // reset
      setEmail("");
      setName("");
      setSubject("");
      setMessage("");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  // close dropdown outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredSuggestions = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(toInput.toLowerCase()) &&
      !recipients.includes(s),
  );

  return (
    <div className="bg-slate-100 dark:bg-[#0b1120] p-6">
      <div className="max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Email Marketing
          </h1>
          <p className="text-sm text-slate-500">
            Send email to your clients with ease
          </p>
        </div>

        {/* MAIN CARD */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          {/* RECIPIENTS */}
          <div ref={dropdownRef} className="relative">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Recipient
            </label>

            {/* INPUT */}
            <div className="mt-2 relative">
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Type or select email..."
                className="w-full px-4 py-2 rounded-xl border 
      bg-slate-50 dark:bg-slate-800
      focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
              />

              {/* Clear button */}
              {email && (
                <button
                  onClick={() => setEmail("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                >
                  ✕
                </button>
              )}
            </div>

            {/* DROPDOWN */}
            {showDropdown &&
              filteredSuggestions.filter((s) => s !== email).length > 0 && (
                <div className="absolute z-20 mt-2 w-full bg-white dark:bg-slate-900 border rounded-xl shadow-lg overflow-hidden">
                  {filteredSuggestions
                    .filter((s) => s !== email)
                    .map((s) => (
                      <div
                        key={s}
                        onClick={() => {
                          setEmail(s);
                          setShowDropdown(false);
                        }}
                        className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800 transition"
                      >
                        {s}
                      </div>
                    ))}
                </div>
              )}
          </div>

          {/* NAME + SUBJECT */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Your Name
              </label>
              <div className="relative mt-2">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-xl border bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  placeholder="Enter your name"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Subject
              </label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-xl border bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  placeholder="Email subject"
                />
              </div>
            </div>
          </div>

          {/* MESSAGE */}
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full mt-2 px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
              placeholder="Write your message..."
            />
          </div>

          {/* BUTTON */}
          <button
            onClick={handleSend}
            disabled={sending}
            className="text-sm w-full flex items-center justify-center gap-2 
  bg-[#13538A] hover:bg-[#0f4775]
  disabled:opacity-60 disabled:cursor-not-allowed
  text-white py-3 rounded-xl font-semibold
  shadow-md hover:shadow-lg transition active:scale-95"
          >
            {sending ? "Sending..." : "Send Email"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailMarketing;
