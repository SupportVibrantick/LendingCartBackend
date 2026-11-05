import { useEffect, useRef, useState } from "react";
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
  Repeat,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import RichEditor from "./Editor";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { getPortalAuthHeaders } from "../../lib/portalAuth";

const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#13538A] text-sm font-semibold text-white transition hover:bg-[#0E426E] disabled:opacity-60";
const FOCUS =
  "focus:outline-none focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/20";
const FOCUS_WITHIN =
  "focus-within:border-[#13538A] focus-within:ring-2 focus-within:ring-[#13538A]/20";

type Contact = {
  email: string;
};

type StatTone = "navy" | "green" | "red";

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

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const colorMap: Record<
    StatTone,
    { text: string; bg: string; icon: React.ReactNode }
  > = {
    navy: {
      text: "text-[#13538A]",
      bg: "bg-[#13538A]/10",
      icon: <Send size={16} />,
    },
    green: {
      text: "text-emerald-600",
      bg: "bg-emerald-100",
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
        name: "",
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
      const headers = getPortalAuthHeaders();
      if (!headers.Authorization) return;

      setLoadingList(true);

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/broker/campaign/list?page=${page}&limit=6&search=${debouncedSearch}`,
        { headers },
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
        const headers = getPortalAuthHeaders();

        if (!headers.Authorization) return;

        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/broker/contacts/list?page=1&limit=50`,
          { headers },
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
    }, 500);

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

      const headers = getPortalAuthHeaders(true);
      if (!headers.Authorization) return toast.error("Session expired");

      setLoading(true);

      let payload: any = {
        contacts: contacts.map((c) => ({
          email: c.email,
          name: c.name.trim(),
        })),
        subject: subject.trim(),
        message: message.trim(),
      };

      if (repeat) {
        payload = {
          ...payload,
          isRecurring: true,
          intervalValue: interval,
          intervalUnit: unit.toUpperCase(),
        };
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/broker/campaign/send`,
        {
          method: "POST",
          headers,
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

  const handleStopCampaign = async (id: string) => {
    const result = await Swal.fire({
      title: "Stop Campaign?",
      text: "This recurring campaign will be stopped permanently.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, Stop it",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      const headers = getPortalAuthHeaders();
      if (!headers.Authorization) return toast.error("Session expired");

      setStoppingId(id);

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/broker/campaign/${id}/stop`,
        {
          method: "PATCH",
          headers,
        },
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Failed");

      await Swal.fire({
        title: "Stopped!",
        text: "Campaign has been stopped successfully.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });

      setStoppingId(null);
      fetchCampaigns();
    } catch (err) {
      setStoppingId(null);
      console.error(err);

      Swal.fire({
        title: "Error",
        text: "Failed to stop campaign",
        icon: "error",
      });
    }
  };

  const sentTotal = campaigns.reduce((a, c) => a + (c.sent || 0), 0);
  const failedTotal = campaigns.reduce((a, c) => a + (c.failed || 0), 0);
  const recurringTotal = campaigns.filter((c) => c.isRecurring).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          Email Marketing
        </h1>
        <p className="max-w-xl text-sm text-slate-500 dark:text-slate-400">
          Create campaigns, reach your contacts, and track delivery from one
          place.
        </p>
      </div>

      <div className="inline-flex w-full gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 sm:w-fit">
        {(
          [
            { key: "create", label: "Create Campaign", icon: Layout },
            { key: "result", label: "Campaign History", icon: BarChart3 },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition sm:flex-none ${
              activeTab === key
                ? "bg-[#13538A] text-white shadow-sm"
                : "text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "create" ? (
        <div className="space-y-5">
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Mail size={16} className="text-[#13538A]" />
                Recipients
              </h3>
              <span className="rounded-full bg-[#13538A]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#0E426E]">
                {contacts.length} added
              </span>
            </div>

            <div ref={dropdownRef} className="relative">
              <div
                className={`flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 transition dark:border-slate-700 dark:bg-slate-800/50 ${FOCUS_WITHIN}`}
              >
                {contacts.map((c) => (
                  <div
                    key={c.email}
                    className="flex items-center gap-2 rounded-lg border border-[#13538A]/20 bg-white px-2 py-1 dark:bg-slate-900"
                  >
                    <input
                      value={c.name}
                      onChange={(e) => updateName(c.email, e.target.value)}
                      placeholder="Name"
                      className="w-[90px] text-xs outline-none dark:bg-transparent"
                    />
                    <span className="text-xs font-medium text-[#13538A]">
                      {c.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeContact(c.email)}
                      className="rounded p-0.5 text-slate-400 hover:bg-[#13538A]/10 hover:text-[#13538A]"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

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
                    if (["Enter", "Tab", ","].includes(e.key)) {
                      e.preventDefault();
                      addContact();
                    }

                    if (e.key === "Backspace" && !input && contacts.length) {
                      setContacts((prev) => prev.slice(0, -1));
                    }
                  }}
                  className="min-w-[200px] flex-1 bg-transparent py-1 text-sm outline-none"
                  placeholder="Enter or select email..."
                />
              </div>

              {showDropdown && filteredSuggestions.length > 0 && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute z-20 mt-2 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  {filteredSuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => addContact(item)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-[#13538A]/8"
                    >
                      <Mail size={14} className="text-[#13538A]" />
                      <span className="text-slate-700 dark:text-slate-200">
                        {item}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Add a name for each recipient. Use {"{{name}}"} in the subject or
              body to personalize.
            </p>
          </section>

          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Subject line
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={`w-full rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-900 ${FOCUS}`}
                placeholder="e.g. Exclusive Offer for {{name}}!"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Email body
              </label>
              <RichEditor value={message} onChange={setMessage} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg p-2 ${
                    repeat
                      ? "bg-[#13538A]/10 text-[#13538A]"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                  }`}
                >
                  <Calendar size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Recurring campaign
                  </p>
                  <p className="text-xs text-slate-500">
                    Automatically resend this message
                  </p>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={() => setRepeat(!repeat)}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#13538A] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:bg-slate-700" />
              </label>
            </div>

            {repeat && (
              <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Schedule repeat
                  </p>
                  <span className="rounded-full bg-[#13538A]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#0E426E]">
                    Auto send enabled
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#13538A]/20 bg-[#13538A]/5 px-4 py-3">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Every
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                    className={`w-16 rounded-xl border border-slate-200 bg-white py-1.5 text-center text-sm font-medium dark:border-slate-700 dark:bg-slate-900 ${FOCUS}`}
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className={`cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium dark:border-slate-700 dark:bg-slate-900 ${FOCUS}`}
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                  <span className="text-xs text-slate-500">
                    Next run in {interval} {unit}
                  </span>
                </div>
              </div>
            )}
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSendCampaign}
              disabled={loading}
              className={`${PRIMARY_BTN} min-w-[200px] px-5 py-2.5`}
            >
              <Send size={16} />
              {loading ? "Sending..." : "Launch Campaign"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Campaigns",
                val: campaigns.length,
                tone: "navy" as const,
                icon: <Send size={16} />,
              },
              {
                label: "Sent",
                val: sentTotal,
                tone: "green" as const,
                icon: <CheckCircle2 size={16} />,
              },
              {
                label: "Failed",
                val: failedTotal,
                tone: "red" as const,
                icon: <XCircle size={16} />,
              },
              {
                label: "Recurring",
                val: recurringTotal,
                tone: "navy" as const,
                icon: <Repeat size={16} />,
              },
            ].map((stat) => {
              const styles = colorMap[stat.tone];
              return (
                <div
                  key={stat.label}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {stat.label}
                    </p>
                    <p className={`mt-1 text-lg font-semibold ${styles.text}`}>
                      {stat.val}
                    </p>
                  </div>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${styles.bg} ${styles.text}`}
                  >
                    {stat.icon}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  All campaigns
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {campaigns.length} on this page
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search campaign..."
                  className={`w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-900 ${FOCUS}`}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-5 py-3 text-left">Campaign</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Performance</th>
                    <th className="px-5 py-3 text-left">Created</th>
                    <th className="px-5 py-3 text-left">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loadingList ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-5 py-4">
                          <div className="mb-2 h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                          <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                        </td>
                        <td className="px-5 py-4">
                          <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
                        </td>
                        <td className="px-5 py-4">
                          <div className="mb-2 h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
                          <div className="h-2 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
                        </td>
                        <td className="px-5 py-4">
                          <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                        </td>
                        <td className="px-5 py-4">
                          <div className="h-6 w-16 rounded-lg bg-slate-200 dark:bg-slate-700" />
                        </td>
                      </tr>
                    ))
                  ) : campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10">
                            <Inbox className="h-7 w-7 text-[#13538A]" />
                          </div>
                          <h3 className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                            No campaigns yet
                          </h3>
                          <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-slate-400">
                            Start your first campaign to engage your audience
                            and track performance here.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab("create")}
                            className={`${PRIMARY_BTN} mt-5 px-4 py-2 text-xs`}
                          >
                            Create Campaign
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((c) => (
                      <tr
                        key={c.id}
                        className="border-t border-slate-100 transition hover:bg-[#13538A]/5 dark:border-slate-800"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            {c.name}
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs text-slate-400">
                            {c.subject}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          {c.status === "SENT" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <CheckCircle2 size={14} />
                              Delivered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300">
                              <XCircle size={14} />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-slate-500">
                              <span>Sent</span>
                              <span className="font-semibold text-emerald-600">
                                {c.sent}
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500">
                              <span>Failed</span>
                              <span className="font-semibold text-red-500">
                                {c.failed}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className="h-full bg-emerald-500"
                                style={{
                                  width: `${
                                    c.total ? (c.sent / c.total) * 100 : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          <div className="flex flex-col">
                            <span>
                              {new Date(c.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-slate-400">
                              {new Date(c.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {c.isRecurring ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#13538A]/20 bg-[#13538A]/8 px-2.5 py-1 text-[11px] font-semibold text-[#0E426E] dark:text-sky-200">
                                <Repeat size={13} />
                                Every {c.intervalValue} {c.intervalUnit}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStopCampaign(c.id)}
                                disabled={stoppingId === c.id}
                                className="rounded-lg bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:bg-red-500/10 dark:text-red-300"
                              >
                                {stoppingId === c.id ? "Stopping..." : "Stop"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-800">
              <p className="text-xs text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {page}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {totalPages || 1}
                </span>{" "}
                pages
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <div className="rounded-lg bg-[#13538A]/10 px-3 py-1.5 text-xs font-semibold text-[#13538A]">
                  {page}
                </div>
                <button
                  type="button"
                  disabled={page === totalPages || totalPages === 0}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
