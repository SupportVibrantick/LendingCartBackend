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
  Users,
  RefreshCw,
} from "lucide-react";
import RichEditor from "./Editor";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import PageMeta from "../../components/common/PageMeta";
import StatPill from "../../components/common/StatPill";
import { getPortalAuthHeaders } from "../../lib/portalAuth";

type Contact = {
  email: string;
};

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

type ActiveTab = "create" | "result";

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
  const [activeTab, setActiveTab] = useState<ActiveTab>("create");

  const [loading, setLoading] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [campaignTotal, setCampaignTotal] = useState(0);

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
        `${import.meta.env.VITE_API_BASE}/broker/campaign/list?page=${page}&limit=10&search=${debouncedSearch}`,
        { headers },
      );

      const data = await res.json();

      if (!res.ok) throw new Error("Failed");

      if (data?.success) {
        setCampaigns(data.data);
        setTotalPages(data.pagination.totalPages || 1);
        setCampaignTotal(data.pagination.total ?? data.data?.length ?? 0);
      }
    } catch {
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

      let payload: Record<string, unknown> = {
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
  const namedCount = contacts.filter((c) => c.name.trim()).length;

  return (
    <>
      <PageMeta
        title="Email Marketing | Broker Dashboard"
        description="Create campaigns, reach contacts, and track delivery"
      />

      <div className="w-full min-w-0 space-y-4 pb-4 text-text-primary dark:text-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">Email Marketing</h1>
            <p className="ds-page-subtitle">
              Create campaigns, reach your contacts, and track delivery from one
              place.
            </p>
          </div>
          {activeTab === "create" ? (
            <button
              type="button"
              onClick={handleSendCampaign}
              disabled={loading}
              className="ds-btn-primary shrink-0 disabled:opacity-60"
            >
              <Send size={16} />
              {loading ? "Sending…" : "Launch campaign"}
            </button>
          ) : null}
        </div>

        <div className="inline-flex w-full gap-1 rounded-xl border border-border bg-white p-1 dark:border-slate-700 dark:bg-slate-950 sm:w-auto">
          {(
            [
              { key: "create" as const, label: "Create campaign", icon: Layout },
              {
                key: "result" as const,
                label: "Campaign history",
                icon: BarChart3,
              },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition sm:flex-none ${
                activeTab === key
                  ? "bg-[#4C78F5] text-white"
                  : "text-text-secondary hover:bg-surface hover:text-[#4C78F5] dark:text-slate-300 dark:hover:bg-slate-900"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "create" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <StatPill
                icon={<Users size={14} />}
                label="Recipients"
                value={contacts.length}
                color="blue"
              />
              <StatPill
                icon={<CheckCircle2 size={14} />}
                label="Named"
                value={namedCount}
                color="emerald"
              />
              <StatPill
                icon={<Repeat size={14} />}
                label="Schedule"
                value={repeat ? "On" : "Off"}
                color={repeat ? "amber" : "slate"}
              />
            </div>

            <section className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5 dark:border-slate-800">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                    <Mail size={15} />
                  </span>
                  Recipients
                </h3>
                <span className="rounded-full bg-[#4C78F5]/10 px-2.5 py-1 text-[11px] font-semibold text-[#4C78F5]">
                  {contacts.length} added
                </span>
              </div>

              <div className="space-y-3 px-4 py-4 sm:px-5">
                <div ref={dropdownRef} className="relative">
                  <div className="flex min-h-11 flex-wrap gap-2 rounded-xl border border-border bg-white p-2.5 transition focus-within:border-[#4C78F5]/50 focus-within:ring-2 focus-within:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950">
                    {contacts.map((c) => (
                      <div
                        key={c.email}
                        className="flex items-center gap-1.5 rounded-lg border border-[#4C78F5]/20 bg-[#4C78F5]/5 px-2 py-1"
                      >
                        <input
                          value={c.name}
                          onChange={(e) => updateName(c.email, e.target.value)}
                          placeholder="Name"
                          className="w-[88px] bg-transparent text-xs font-medium text-text-primary outline-none placeholder:text-text-secondary/70"
                        />
                        <span className="max-w-[160px] truncate text-xs font-medium text-[#4C78F5]">
                          {c.email}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeContact(c.email)}
                          className="rounded p-0.5 text-text-secondary transition hover:bg-white hover:text-[#4C78F5]"
                          aria-label={`Remove ${c.email}`}
                        >
                          <X size={13} />
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

                        if (
                          e.key === "Backspace" &&
                          !input &&
                          contacts.length
                        ) {
                          setContacts((prev) => prev.slice(0, -1));
                        }
                      }}
                      className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-text-secondary/70"
                      placeholder="Enter or select email…"
                    />
                  </div>

                  {showDropdown && filteredSuggestions.length > 0 && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute z-20 mt-2 max-h-52 w-full overflow-auto rounded-xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900"
                    >
                      {filteredSuggestions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => addContact(item)}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-[#4C78F5]/8"
                        >
                          <Mail size={14} className="text-[#4C78F5]" />
                          <span className="text-text-primary">{item}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-text-secondary">
                  Add a name for each recipient. Use{" "}
                  <code className="rounded bg-surface px-1 py-0.5 text-[11px] font-medium text-[#4C78F5]">
                    {"{{name}}"}
                  </code>{" "}
                  in the subject or body to personalize.
                </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-border px-4 py-3.5 sm:px-5 dark:border-slate-800">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                    <Layout size={15} />
                  </span>
                  Email content
                </h3>
              </div>

              <div className="space-y-4 px-4 py-4 sm:px-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.06em] text-text-secondary">
                    Subject line
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="ds-input"
                    placeholder="e.g. Exclusive Offer for {{name}}!"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.06em] text-text-secondary">
                    Email body
                  </label>
                  <RichEditor value={message} onChange={setMessage} />
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      repeat
                        ? "bg-[#4C78F5]/10 text-[#4C78F5]"
                        : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                    }`}
                  >
                    <Calendar size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      Recurring campaign
                    </p>
                    <p className="text-xs text-text-secondary">
                      Automatically resend this message on a schedule
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
                  <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#4C78F5] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:bg-slate-700" />
                </label>
              </div>

              {repeat ? (
                <div className="border-t border-border px-4 py-4 sm:px-5 dark:border-slate-800">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text-primary">
                      Schedule repeat
                    </p>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                      Auto send enabled
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#4C78F5]/20 bg-[#4C78F5]/[0.04] px-3.5 py-3">
                    <span className="text-sm text-text-secondary">Every</span>
                    <input
                      type="number"
                      min={1}
                      value={interval}
                      onChange={(e) => setInterval(Number(e.target.value))}
                      className="h-9 w-16 rounded-xl border border-border bg-white text-center text-sm font-semibold outline-none focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="h-9 rounded-xl border border-border bg-white px-3 text-sm font-medium outline-none focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                    <span className="text-xs text-text-secondary">
                      Next run in {interval} {unit}
                    </span>
                  </div>
                </div>
              ) : null}
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSendCampaign}
                disabled={loading}
                className="ds-btn-primary min-w-[200px] disabled:opacity-60"
              >
                <Send size={16} />
                {loading ? "Sending…" : "Launch campaign"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <StatPill
                icon={<Send size={14} />}
                label="Campaigns"
                value={campaignTotal}
                color="blue"
                loading={loadingList && campaignTotal === 0}
              />
              <StatPill
                icon={<CheckCircle2 size={14} />}
                label="Sent (page)"
                value={sentTotal}
                color="emerald"
                loading={loadingList && campaigns.length === 0}
              />
              <StatPill
                icon={<XCircle size={14} />}
                label="Failed (page)"
                value={failedTotal}
                color="rose"
                loading={loadingList && campaigns.length === 0}
              />
              <StatPill
                icon={<Repeat size={14} />}
                label="Recurring"
                value={recurringTotal}
                color="amber"
                loading={loadingList && campaigns.length === 0}
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="group relative w-full sm:max-w-sm">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary transition-colors group-focus-within:text-[#4C78F5]" />
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search campaigns…"
                    className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-9 pl-10 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setPage(1);
                      }}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-text-secondary hover:bg-surface"
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => void fetchCampaigns()}
                  disabled={loadingList}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-medium text-text-secondary transition hover:bg-surface disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="ds-table min-w-[880px] w-full">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Status</th>
                      <th>Performance</th>
                      <th className="hidden sm:table-cell">Created</th>
                      <th className="!text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingList ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center">
                          <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                            <RefreshCw className="h-4 w-4 animate-spin text-[#4C78F5]" />
                            Loading campaigns…
                          </div>
                        </td>
                      </tr>
                    ) : campaigns.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="!px-5 !py-14 text-center"
                        >
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
                            <Inbox className="h-5 w-5" />
                          </div>
                          <p className="text-sm font-semibold text-text-primary">
                            No campaigns yet
                          </p>
                          <p className="mx-auto mt-1.5 max-w-sm text-xs text-text-secondary">
                            Start your first campaign to engage your audience
                            and track performance here.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab("create")}
                            className="ds-btn-primary mt-4 h-9 px-4 text-xs"
                          >
                            <Layout size={14} />
                            Create campaign
                          </button>
                        </td>
                      </tr>
                    ) : (
                      campaigns.map((c) => {
                        const successRate = c.total
                          ? Math.round((c.sent / c.total) * 100)
                          : 0;

                        return (
                          <tr key={c.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4C78F5] text-white">
                                  <Mail className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="ds-table-title">{c.name}</p>
                                  <p className="ds-table-meta">{c.subject}</p>
                                </div>
                              </div>
                            </td>

                            <td>
                              {c.status === "SENT" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Delivered
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                                  <XCircle className="h-3.5 w-3.5" />
                                  Failed
                                </span>
                              )}
                            </td>

                            <td>
                              <div className="min-w-[140px] space-y-1.5">
                                <div className="flex items-center justify-between gap-3 text-[11px]">
                                  <span className="font-medium text-text-secondary">
                                    {c.sent}/{c.total} sent
                                  </span>
                                  <span className="font-semibold tabular-nums text-emerald-600">
                                    {successRate}%
                                  </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                  <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{ width: `${successRate}%` }}
                                  />
                                </div>
                                {c.failed > 0 ? (
                                  <p className="text-[11px] font-medium text-rose-600">
                                    {c.failed} failed
                                  </p>
                                ) : null}
                              </div>
                            </td>

                            <td className="hidden ds-table-muted whitespace-nowrap sm:table-cell">
                              <div className="flex flex-col">
                                <span>
                                  {new Date(c.createdAt).toLocaleDateString()}
                                </span>
                                <span className="text-[11px] text-text-secondary/80">
                                  {new Date(c.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                            </td>

                            <td className="text-right">
                              {c.isRecurring ? (
                                <div className="inline-flex flex-wrap items-center justify-end gap-2">
                                  <span className="inline-flex items-center gap-1 rounded-full border border-[#4C78F5]/20 bg-[#4C78F5]/8 px-2.5 py-1 text-[11px] font-semibold text-[#4C78F5]">
                                    <Repeat size={12} />
                                    Every {c.intervalValue} {c.intervalUnit}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleStopCampaign(c.id)}
                                    disabled={stoppingId === c.id}
                                    className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:bg-slate-950 dark:text-rose-300"
                                  >
                                    {stoppingId === c.id
                                      ? "Stopping…"
                                      : "Stop"}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[12px] font-medium italic text-text-secondary/70">
                                  One-time
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {!loadingList && campaigns.length > 0 ? (
                <div className="flex flex-col gap-3 border-t border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <p className="text-[13px] text-text-secondary">
                    Page{" "}
                    <span className="font-semibold text-text-primary">
                      {page}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-text-primary">
                      {totalPages || 1}
                    </span>
                    {campaignTotal > 0 ? (
                      <>
                        {" "}
                        ·{" "}
                        <span className="font-semibold text-text-primary">
                          {campaignTotal}
                        </span>{" "}
                        total
                      </>
                    ) : null}
                  </p>

                  {totalPages > 1 ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={page <= 1 || loadingList}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-surface disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-[#4C78F5] px-2.5 text-sm font-semibold text-white">
                        {page}
                      </span>
                      <button
                        type="button"
                        disabled={
                          page >= totalPages || loadingList || totalPages < 1
                        }
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-surface disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
