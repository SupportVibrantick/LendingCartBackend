import { JSX, useEffect, useRef, useState } from "react";
import {
  Mail,
  Send,
  BarChart3,
  Calendar,
  Layout,
  X,
  CheckCircle2,
  XCircle,
  Inbox,
} from "lucide-react";
import RichEditor from "./Editor";
import toast from "react-hot-toast";

type Contact = {
  email: string;
};

type Color = "blue" | "green" | "red";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  createdAt: string;
  sentAt: string;
  total: number;
  sent: number;
  failed: number;
  isRecurring: boolean;
  intervalValue: number | null;
  intervalUnit: string | null;
};

type ContactInput = {
  email: string;
  name: string;
};

export default function CreateCampaignPage() {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [contacts, setContacts] = useState<ContactInput[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(
    "Hello {{name}},\n\nThis is a test campaign...",
  );
  const [repeat, setRepeat] = useState(false);
  const [interval, setInterval] = useState(1);
  const [unit, setUnit] = useState("minutes");
  const [activeTab, setActiveTab] = useState("create");

  const [loading, setLoading] = useState(false);
  const [setCampaignResult] = useState<any>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const colorMap: Record<
    Color,
    { text: string; bg: string; icon: JSX.Element }
  > = {
    blue: {
      text: "text-blue-600",
      bg: "bg-blue-100",
      icon: <Send size={16} />,
    },
    green: {
      text: "text-green-600",
      bg: "bg-green-100",
      icon: <CheckCircle2 size={16} />,
    },
    red: {
      text: "text-red-600",
      bg: "bg-red-100",
      icon: <XCircle size={16} />,
    },
  };

  const addContact = (value?: string) => {
    const email = (value || input).trim();

    if (!email || !isValidEmail(email)) return;

    if (contacts.some((c) => c.email === email)) return;

    setContacts((prev) => [
      ...prev,
      {
        email,
        name: "", // 👈 user fill karega
      },
    ]);

    setInput("");
    setShowDropdown(false);
  };

  const removeContact = (email: string) => {
    setContacts((prev) => prev.filter((c) => c.email !== email));
  };

  const updateName = (email: string, name: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.email === email ? { ...c, name } : c)),
    );
  };

  const fetchCampaigns = async () => {
    try {
      const token = sessionStorage.getItem("broker_token");
      if (!token) return;

      setLoadingList(true);

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/broker/campaign/list?page=${page}&limit=6&search=${debouncedSearch}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json();

      if (!res.ok) throw new Error("Failed");

      if (data?.success) {
        setCampaigns(data.data);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      toast.error("Failed to load campaigns");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (activeTab === "result") {
      fetchCampaigns();
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const token = sessionStorage.getItem("broker_token");

        if (!token) return;

        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/broker/contacts/list?page=1&limit=50`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();

        if (data?.success) {
          const emailList: string[] = data.data
            .map((item: Contact) => item.email)
            .filter((email: string): email is string => Boolean(email));

          setSuggestions(emailList);
        }
      } catch (err) {
        console.error("Error fetching emails", err);
      }
    };

    fetchEmails();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [search]);

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const filteredSuggestions = suggestions
    .filter((s) => !contacts.some((c) => c.email === s))
    .filter((s) =>
      input ? s.toLowerCase().includes(input.toLowerCase()) : true,
    );

  useEffect(() => {
    if (activeTab === "result") {
      fetchCampaigns();
    }
  }, [activeTab, page, debouncedSearch]);

  const handleSendCampaign = async () => {
    try {
      // ✅ Validation
      if (!subject.trim()) return toast.error("Subject is required");

      if (!message || !message.trim()) {
        return toast.error("Message body cannot be empty");
      }

      if (!contacts.length) {
        return toast.error("Please add at least one recipient");
      }

      if (contacts.some((c) => !c.name.trim())) {
        return toast.error("Please enter name for all recipients");
      }

      const token = sessionStorage.getItem("broker_token");
      if (!token) return toast.error("Session expired");

      setLoading(true);

      // ✅ FINAL PAYLOAD (ONLY THIS)
      let payload: any = {
        contacts: contacts.map((c) => ({
          email: c.email,
          name: c.name.trim(),
        })),
        subject: subject.trim(),
        message: message.trim(),
      };

      // ✅ Recurring support
      if (repeat) {
        payload = {
          ...payload,
          isRecurring: true,
          intervalValue: interval,
          intervalUnit: unit.toUpperCase(),
        };
      }

      console.log("Payload being sent:", payload);

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/broker/campaign/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Failed");

      toast.success(
        repeat
          ? "Recurring campaign scheduled successfully"
          : "Campaign sent successfully",
      );

      // RESET FIELDS HERE
      setCampaignResult(data.data);
      setActiveTab("result");
      setContacts([]);
      setSubject("");
      setMessage("Hello {{name}},\n\nThis is a test campaign...");
      setInput("");
      setRepeat(false);
      setInterval(1);
      setUnit("minutes");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex">
      {/* --- Main Content Area --- */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center mb-8">
            <div className="relative flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl">
              {/* Sliding Background */}
              <div
                className={`absolute top-1 bottom-1 w-1/2 rounded-xl bg-white dark:bg-slate-700 transition-all duration-300 ${
                  activeTab === "create" ? "left-1" : "left-[50%]"
                }`}
              />

              {/* Create Campaign */}
              <button
                onClick={() => setActiveTab("create")}
                className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === "create"
                    ? "text-[#2C92D5]"
                    : "text-gray-500 dark:text-gray-300"
                }`}
              >
                <Layout size={16} />
                Create Campaign
              </button>

              {/* Campaign Insights */}
              <button
                onClick={() => setActiveTab("result")}
                className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === "result"
                    ? "text-[#2C92D5]"
                    : "text-gray-500 dark:text-gray-300"
                }`}
              >
                <BarChart3 size={16} />
                Campaign History
              </button>
            </div>
          </div>

          {activeTab === "create" ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header className="flex items-start justify-between mb-6">
                {/* LEFT */}
                <div className="flex items-start gap-3">
                  {/* ICON */}
                  <div className="h-12 w-12 rounded-xl bg-[#2C92D5]/10 flex items-center justify-center shrink-0">
                    <Send className="text-[#2C92D5]" size={18} />
                  </div>

                  {/* TEXT */}
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
                      New Campaign
                    </h1>

                    <p className="text-gray-500 text-xs mt-1">
                      Configure your recipients and message details
                    </p>
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 gap-6">
                {/* Recipients Section */}
                <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Mail size={18} className="text-[#2C92D5]" /> Recipients
                    </h3>
                    {/* <button className="text-xs font-medium text-[#2C92D5] hover:text-blue-700 flex items-center gap-1">
                      <Upload size={14} /> Import CSV
                    </button> */}
                  </div>

                  <div ref={dropdownRef} className="relative">
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                      {/* SELECTED EMAILS */}
                      {contacts.map((c) => (
                        <div
                          key={c.email}
                          className="flex items-center gap-2 bg-white border border-blue-100 px-2 py-1 rounded-lg"
                        >
                          {/* NAME INPUT */}
                          <input
                            value={c.name}
                            onChange={(e) =>
                              updateName(c.email, e.target.value)
                            }
                            placeholder="Name"
                            className="text-xs outline-none w-[90px]"
                          />

                          {/* EMAIL */}
                          <span className="text-xs text-[#2C92D5]">
                            {c.email}
                          </span>

                          {/* REMOVE */}
                          <button
                            onClick={() => removeContact(c.email)}
                            className="hover:bg-blue-50 p-0.5 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}

                      {/* INPUT */}
                      <input
                        autoComplete="off"
                        value={input}
                        onFocus={() => setShowDropdown(true)}
                        onPaste={(e) => {
                          e.preventDefault();
                          const paste = e.clipboardData.getData("text");

                          const pastedEmails = paste.split(/[\s,;]+/);
                          const validEmails = pastedEmails.filter(isValidEmail);

                          setContacts((prev) => [
                            ...prev,
                            ...validEmails
                              .filter(
                                (email) => !prev.some((c) => c.email === email),
                              )
                              .map((email) => ({ email, name: "" })),
                          ]);
                        }}
                        onChange={(e) => {
                          setInput(e.target.value);
                          setShowDropdown(true);
                        }}
                        onKeyDown={(e) => {
                          // ✅ Add contact
                          if (["Enter", "Tab", ","].includes(e.key)) {
                            e.preventDefault();
                            addContact(); // 🔥 FIXED
                          }

                          // ✅ Remove last contact
                          if (
                            e.key === "Backspace" &&
                            !input &&
                            contacts.length
                          ) {
                            setContacts((prev) => prev.slice(0, -1));
                          }
                        }}
                        className="bg-transparent outline-none flex-1 min-w-[200px] text-sm py-1"
                        placeholder="Enter or select email..."
                      />
                    </div>

                    {/* DROPDOWN */}
                    {showDropdown && filteredSuggestions.length > 0 && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-auto"
                      >
                        {filteredSuggestions.map((item) => (
                          <div
                            key={item}
                            onClick={() => addContact(item)}
                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-blue-50 cursor-pointer transition"
                          >
                            <Mail size={14} className="text-gray-400" />
                            <span className="text-gray-700">{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* Content Section */}
                <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Subject Line
                    </label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
                      placeholder="e.g. Exclusive Offer for {{name}}!"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-gray-700">
                        Email Body
                      </label>
                    </div>

                    <RichEditor value={message} onChange={setMessage} />
                  </div>
                </section>

                {/* Scheduling Section */}
                <section className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg transition ${repeat ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"}`}
                      >
                        <Calendar size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">
                          Recurring Campaign
                        </p>
                        <p className="text-xs text-gray-500">
                          Automatically resend this message
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={repeat}
                        onChange={() => setRepeat(!repeat)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {repeat && (
                    <div className="mt-6 pt-6 border-t border-gray-100 animate-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-700">
                          Schedule Repeat
                        </p>

                        <span className="text-xs text-gray-400">
                          Auto send enabled
                        </span>
                      </div>

                      {/* Scheduler Box */}
                      <div className="mt-4 flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl px-4 py-3 w-fit">
                        <span className="text-sm text-gray-600">Every</span>

                        {/* Interval */}
                        <input
                          type="number"
                          value={interval}
                          onChange={(e) => setInterval(Number(e.target.value))}
                          className="w-16 text-center bg-white border border-gray-200 rounded-xl py-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                        />

                        {/* Unit */}
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>

                        {/* Preview */}
                        <span className="text-xs text-gray-500 ml-2">
                          (Next run in {interval} {unit})
                        </span>
                      </div>
                    </div>
                  )}
                </section>

                <div className="sticky bottom-0 left-0 w-full bg-slate-50/80 backdrop-blur border-t border-gray-100 px-6 py-4 flex justify-end">
                  <button
                    onClick={handleSendCampaign}
                    disabled={loading}
                    className="group relative w-fit min-w-[220px] overflow-hidden rounded-xl bg-[#2C92D5] px-6 py-3 text-white font-medium flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.97] disabled:opacity-50"
                  >
                    <Send size={16} />
                    <span className="tracking-wide text-sm">
                      {loading ? "Sending..." : "Launch Campaign"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* HEADER */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Campaign History
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Track performance of all campaigns
                  </p>
                </div>
              </div>

              {/* STATS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Campaigns",
                    val: campaigns.length,
                    color: "blue",
                  },
                  {
                    label: "Sent",
                    val: campaigns.reduce((a, c) => a + (c.sent || 0), 0),
                    color: "green",
                  },
                  {
                    label: "Failed",
                    val: campaigns.reduce((a, c) => a + (c.failed || 0), 0),
                    color: "red",
                  },
                  {
                    label: "Recurring",
                    val: campaigns.filter((c) => c.isRecurring).length,
                    color: "blue",
                  },
                ].map((stat) => {
                  const styles = colorMap[stat.color as Color];

                  return (
                    <div
                      key={stat.label}
                      className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs text-gray-400">{stat.label}</p>
                        <p className={`text-lg font-semibold ${styles.text}`}>
                          {stat.val}
                        </p>
                      </div>

                      <div
                        className={`h-8 w-8 flex items-center justify-center rounded-lg ${styles.bg} ${styles.text}`}
                      >
                        {styles.icon}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TABLE */}
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                {/* TABLE HEADER */}
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    All Campaigns
                  </h3>

                  <span className="text-xs text-gray-400">
                    {campaigns.length} total
                  </span>

                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1); // reset page on search
                    }}
                    placeholder="Search campaign..."
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none"
                  />
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-6 py-3 text-left">Campaign</th>
                        <th className="px-6 py-3 text-left">Status</th>
                        <th className="px-6 py-3 text-left">Stats</th>
                        <th className="px-6 py-3 text-left">Type</th>
                        <th className="px-6 py-3 text-left">Created</th>
                      </tr>
                    </thead>

                    <tbody>
                      {/* 🔄 LOADING STATE */}
                      {loadingList && (
                        <tr>
                          <td colSpan={5} className="py-10">
                            <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
                              <div className="w-8 h-8 border-2 border-gray-300 border-t-[#2C92D5] rounded-full animate-spin" />
                              <p className="text-xs">Loading campaigns...</p>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* ❌ EMPTY STATE */}
                      {!loadingList && campaigns.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-16">
                            <div className="flex flex-col items-center justify-center text-center">
                              {/* ICON BOX */}
                              <div className="w-14 h-14 rounded-2xl bg-[#2C92D5]/10 flex items-center justify-center shadow-sm">
                                <Inbox className="w-6 h-6 text-[#2C92D5]" />
                              </div>

                              {/* TEXT */}
                              <h3 className="mt-4 text-sm font-semibold text-gray-700">
                                No campaigns yet
                              </h3>

                              <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
                                You haven’t created any campaigns. Start by
                                launching your first one.
                              </p>

                              {/* CTA BUTTON */}
                              <button
                                onClick={() => setActiveTab("create")}
                                className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-[#2C92D5] text-white hover:bg-blue-600 transition"
                              >
                                + Create Campaign
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* ✅ DATA */}
                      {!loadingList &&
                        campaigns.map((c) => (
                          <tr
                            key={c.id}
                            className="border-t hover:bg-gray-50 transition"
                          >
                            <td className="px-6 py-4">
                              <p className="font-medium text-gray-900">
                                {c.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {c.subject}
                              </p>
                            </td>

                            <td className="px-6 py-4">
                              {c.status === "SENT" ? (
                                <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                                  <CheckCircle2 size={14} />
                                  Sent
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                                  <XCircle size={14} />
                                  Failed
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-xs text-gray-600">
                              <p>Total: {c.total}</p>
                              <p>Sent: {c.sent}</p>
                              <p>Failed: {c.failed}</p>
                            </td>

                            <td className="px-6 py-4 text-xs">
                              {c.isRecurring ? (
                                <span className="text-blue-600 font-medium">
                                  🔁 Every {c.intervalValue} {c.intervalUnit}
                                </span>
                              ) : (
                                <span className="text-gray-400">One-time</span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-xs text-gray-500">
                              {new Date(c.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50/60">
                    {/* LEFT: Info */}
                    <p className="text-xs text-gray-500">
                      Showing{" "}
                      <span className="font-semibold text-gray-700">
                        {page}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-gray-700">
                        {totalPages}
                      </span>{" "}
                      pages
                    </p>

                    {/* RIGHT: Controls */}
                    <div className="flex items-center gap-2">
                      {/* Prev */}
                      <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ← Prev
                      </button>

                      {/* Page Indicator */}
                      <div className="px-3 py-1.5 text-xs font-semibold bg-[#2C92D5]/10 text-[#2C92D5] rounded-lg">
                        {page}
                      </div>

                      {/* Next */}
                      <button
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
