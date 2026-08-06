import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import toast from "react-hot-toast";
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Handshake,
  Layers,
  Plus,
  RefreshCcw,
  Search,
  SearchX,
  Send,
  SlidersHorizontal,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import AddBrokerLenderModal from "./AddBrokerLenderModal";
import {
  acceptIncomingInvite,
  fetchBrokerLenderSubmissions,
  fetchConnectedLenders,
  fetchDiscoverLenders,
  fetchIncomingInvites,
  fetchSentInvites,
  formatCompactMoney,
  formatDateTime,
  formatFundingTime,
  formatLoanAmountRange,
  formatLoanTypeLabel,
  formatStatesSummary,
  formatSubmissionStatus,
  getLenderDisplayName,
  inviteLender,
  parseStatesList,
  rejectIncomingInvite,
  resendBrokerLenderInvite,
  submissionStatusTone,
  type BrokerLenderSubmission,
  type ConnectedLender,
  type DiscoverLender,
  type DiscoverLenderFilters,
  type IncomingLenderInvite,
  type LenderInvite,
} from "../../lib/lenderMarketplaceApi";
import { hasPermission } from "../../lib/brokerPermissions";
import { isLoanOfficerPortalPath } from "../../lib/portalAuth";
import {
  LenderDiscoverProfileModal,
  LenderLogo,
  LenderProductsModal,
  SendApplicationModal,
} from "./ConnectedLenderModals";

type MainTab = "discover" | "network" | "submissions";
type NetworkFilter = "connected" | "sent" | "received";

const BRAND = "#2C92D5";
const DISCOVER_DEBOUNCE_MS = 400;

type DiscoverFilters = {
  loanProduct: string;
  state: string;
  fundingMax: string;
  minAmount: string;
  maxAmount: string;
  industry: string;
  eligible: boolean;
};

const EMPTY_DISCOVER_FILTERS: DiscoverFilters = {
  loanProduct: "",
  state: "",
  fundingMax: "",
  minAmount: "",
  maxAmount: "",
  industry: "",
  eligible: false,
};

const LOAN_PRODUCT_FILTER_OPTIONS = [
  { value: "", label: "Any product" },
  { value: "FIX_AND_FLIP_LOAN_1_TO_4_UNITS", label: "Fix And Flip 1-4 Units" },
  { value: "DSCR_LOAN_1_TO_4_UNITS", label: "DSCR 1-4 Units" },
  { value: "BRIDGE_LOAN", label: "Bridge Loan" },
  { value: "CONSTRUCTION_LOAN", label: "Construction Loan" },
  { value: "SBA_7A_WORKING_CAPITAL", label: "SBA 7(a) Working Capital" },
  { value: "CRE_PERMANENT_LOAN", label: "CRE Permanent Loan" },
  { value: "CMBS", label: "CMBS" },
  { value: "WORKING_CAPITAL", label: "Working Capital" },
];

const US_STATE_OPTIONS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
].map((code) => ({ value: code, label: code }));

const FUNDING_TIME_OPTIONS = [
  { value: "", label: "Any funding time" },
  { value: "7", label: "Up to 7 business days" },
  { value: "14", label: "Up to 14 business days" },
  { value: "30", label: "Up to 30 business days" },
];

const INDUSTRY_FILTER_OPTIONS = [
  { value: "", label: "Any industry" },
  { value: "Real Estate", label: "Real Estate" },
  { value: "Hospitality", label: "Hospitality" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Retail", label: "Retail" },
  { value: "Manufacturing", label: "Manufacturing" },
  { value: "Construction", label: "Construction" },
];

function countActiveFilters(filters: DiscoverFilters) {
  let count = 0;
  if (filters.loanProduct) count += 1;
  if (filters.state) count += 1;
  if (filters.fundingMax) count += 1;
  if (filters.minAmount) count += 1;
  if (filters.maxAmount) count += 1;
  if (filters.industry) count += 1;
  if (filters.eligible) count += 1;
  return count;
}

function toApiFilters(filters: DiscoverFilters): DiscoverLenderFilters {
  return {
    ...(filters.loanProduct ? { loanProduct: filters.loanProduct } : {}),
    ...(filters.state ? { state: filters.state } : {}),
    ...(filters.fundingMax ? { fundingMax: filters.fundingMax } : {}),
    ...(filters.minAmount ? { minAmount: filters.minAmount } : {}),
    ...(filters.maxAmount ? { maxAmount: filters.maxAmount } : {}),
    ...(filters.industry ? { industry: filters.industry } : {}),
    ...(filters.eligible ? { eligible: true } : {}),
  };
}

export default function LenderMarketplace() {
  const isLoanOfficerPortal = isLoanOfficerPortalPath();
  const canAddOwnLender =
    !isLoanOfficerPortal || hasPermission("ADD_OWN_LENDER", "loanOfficer");
  const canConnectLenders =
    !isLoanOfficerPortal || hasPermission("CONNECT_LENDERS", "loanOfficer");
  const canSendApplications =
    !isLoanOfficerPortal || hasPermission("SEND_APPLICATIONS", "loanOfficer");

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "network" ||
    searchParams.get("tab") === "submissions"
      ? (searchParams.get("tab") as MainTab)
      : "discover";
  const initialQuery = searchParams.get("q") || "";
  const filterParam = searchParams.get("filter");
  const initialNetworkFilter: NetworkFilter =
    filterParam === "sent" || filterParam === "received"
      ? filterParam
      : "connected";

  const [mainTab, setMainTab] = useState<MainTab>(initialTab);
  const [networkFilter, setNetworkFilter] =
    useState<NetworkFilter>(initialNetworkFilter);

  /* ---- Discover state ---- */
  const [discoverQ, setDiscoverQ] = useState(initialQuery);
  const [debouncedDiscoverQ, setDebouncedDiscoverQ] = useState(initialQuery);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverLimit] = useState(9);
  const [discoverLenders, setDiscoverLenders] = useState<DiscoverLender[]>([]);
  const [discoverTotal, setDiscoverTotal] = useState(0);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverFilters, setDiscoverFilters] = useState<DiscoverFilters>(
    EMPTY_DISCOVER_FILTERS,
  );
  const [draftFilters, setDraftFilters] = useState<DiscoverFilters>(
    EMPTY_DISCOVER_FILTERS,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [profileLender, setProfileLender] = useState<DiscoverLender | null>(
    null,
  );

  /* ---- Network state ---- */
  const [connected, setConnected] = useState<ConnectedLender[]>([]);
  const [sentInvites, setSentInvites] = useState<LenderInvite[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<IncomingLenderInvite[]>([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [networkSearch, setNetworkSearch] = useState("");
  const [productsLender, setProductsLender] = useState<ConnectedLender | null>(
    null,
  );
  const [sendApplicationLenders, setSendApplicationLenders] = useState<
    ConnectedLender[] | null
  >(null);
  const [selectedConnectedIds, setSelectedConnectedIds] = useState<Set<string>>(
    new Set(),
  );

  /* ---- Submissions state ---- */
  const [submissions, setSubmissions] = useState<BrokerLenderSubmission[]>([]);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionsLimit] = useState(10);
  const [submissionsSearch, setSubmissionsSearch] = useState("");
  const [debouncedSubmissionsSearch, setDebouncedSubmissionsSearch] =
    useState("");
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [addLenderOpen, setAddLenderOpen] = useState(false);

  const pendingSent = useMemo(
    () => sentInvites.filter((i) => i.inviteStatus === "PENDING").length,
    [sentInvites],
  );

  const stats = useMemo(
    () => ({
      connected: connected.length,
      pending: pendingSent,
      incoming: incomingInvites.length,
    }),
    [connected.length, pendingSent, incomingInvites.length],
  );

  /* ---- URL sync ---- */
  useEffect(() => {
    const params: Record<string, string> = { tab: mainTab };
    if (mainTab === "discover" && debouncedDiscoverQ.trim()) {
      params.q = debouncedDiscoverQ.trim();
    }
    if (mainTab === "network" && networkFilter !== "connected") {
      params.filter = networkFilter;
    }
    setSearchParams(params, { replace: true });
  }, [mainTab, debouncedDiscoverQ, networkFilter]);

  /* ---- Debounced discover search ---- */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDiscoverQ(discoverQ);
      setDiscoverPage(1);
    }, DISCOVER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [discoverQ]);

  /* ---- Fetch discover ---- */
  const loadDiscover = useCallback(async () => {
    setDiscoverLoading(true);
    try {
      const { data, meta } = await fetchDiscoverLenders({
        q: debouncedDiscoverQ.trim(),
        page: discoverPage,
        limit: discoverLimit,
        filters: toApiFilters(discoverFilters),
      });
      setDiscoverLenders(data);
      setDiscoverTotal(meta.total ?? 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load lenders");
    } finally {
      setDiscoverLoading(false);
    }
  }, [debouncedDiscoverQ, discoverPage, discoverLimit, discoverFilters]);

  useEffect(() => {
    if (mainTab === "discover") loadDiscover();
  }, [mainTab, loadDiscover]);

  /* ---- Fetch network ---- */
  const loadNetwork = useCallback(async () => {
    setNetworkLoading(true);
    try {
      const [connectedData, sentData, incomingData] = await Promise.all([
        fetchConnectedLenders(),
        fetchSentInvites(),
        fetchIncomingInvites(),
      ]);
      setConnected(connectedData);
      setSentInvites(sentData.data);
      setIncomingInvites(incomingData);
    } catch (err: any) {
      toast.error(err.message || "Failed to load network");
    } finally {
      setNetworkLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === "network") loadNetwork();
  }, [mainTab, loadNetwork]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSubmissionsSearch(submissionsSearch);
      setSubmissionsPage(1);
    }, DISCOVER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [submissionsSearch]);

  const loadSubmissions = useCallback(async () => {
    setSubmissionsLoading(true);
    try {
      const { data, pagination } = await fetchBrokerLenderSubmissions({
        page: submissionsPage,
        limit: submissionsLimit,
        search: debouncedSubmissionsSearch,
      });
      setSubmissions(data);
      setSubmissionsTotal(pagination.total ?? 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load submissions");
    } finally {
      setSubmissionsLoading(false);
    }
  }, [submissionsPage, submissionsLimit, debouncedSubmissionsSearch]);

  useEffect(() => {
    if (mainTab === "submissions") loadSubmissions();
  }, [mainTab, loadSubmissions]);

  async function handleResendSubmission(inviteId: string) {
    setResendingId(inviteId);
    try {
      await resendBrokerLenderInvite(inviteId);
      toast.success("Invitation resent");
      await loadSubmissions();
    } catch (err: any) {
      toast.error(err.message || "Failed to resend invitation");
    } finally {
      setResendingId(null);
    }
  }

  async function handleConnect(lenderId: string) {
    if (connectingId) return;
    if (!canConnectLenders) {
      toast.error("You don't have permission to connect with lenders");
      return;
    }
    setConnectingId(lenderId);
    try {
      await inviteLender(lenderId);
      toast.success("Connection request sent");
      setDiscoverLenders((prev) => prev.filter((l) => l.id !== lenderId));
      setDiscoverTotal((t) => Math.max(0, t - 1));
      if (profileLender?.id === lenderId) setProfileLender(null);
    } catch (err: any) {
      toast.error(err.message || "Connection request failed");
    } finally {
      setConnectingId(null);
    }
  }

  function openFiltersDrawer() {
    setDraftFilters(discoverFilters);
    setFiltersOpen(true);
  }

  function applyDiscoverFilters() {
    setDiscoverFilters(draftFilters);
    setDiscoverPage(1);
    setFiltersOpen(false);
  }

  function clearDiscoverFilters() {
    setDraftFilters(EMPTY_DISCOVER_FILTERS);
    setDiscoverFilters(EMPTY_DISCOVER_FILTERS);
    setDiscoverPage(1);
  }

  const activeFilterCount = countActiveFilters(discoverFilters);

  async function handleAcceptIncoming(inviteId: string) {
    setActionId(inviteId);
    try {
      await acceptIncomingInvite(inviteId);
      toast.success("Lender connected");
      await loadNetwork();
    } catch (err: any) {
      toast.error(err.message || "Failed to accept");
    } finally {
      setActionId(null);
    }
  }

  async function handleRejectIncoming(inviteId: string) {
    setActionId(inviteId);
    try {
      await rejectIncomingInvite(inviteId);
      toast.success("Invite declined");
      setIncomingInvites((prev) => prev.filter((i) => i.inviteId !== inviteId));
    } catch (err: any) {
      toast.error(err.message || "Failed to reject");
    } finally {
      setActionId(null);
    }
  }

  const discoverPages = Math.max(1, Math.ceil(discoverTotal / discoverLimit));

  const filteredConnected = useMemo(() => {
    const q = networkSearch.trim().toLowerCase();
    if (!q) return connected;
    return connected.filter(
      (l) =>
        l.lenderName.toLowerCase().includes(q) ||
        l.lenderEmail.toLowerCase().includes(q),
    );
  }, [connected, networkSearch]);

  const filteredSent = useMemo(() => {
    const q = networkSearch.trim().toLowerCase();
    if (!q) return sentInvites;
    return sentInvites.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q),
    );
  }, [sentInvites, networkSearch]);

  const filteredIncoming = useMemo(() => {
    const q = networkSearch.trim().toLowerCase();
    if (!q) return incomingInvites;
    return incomingInvites.filter(
      (i) =>
        i.lenderName.toLowerCase().includes(q) ||
        i.lenderEmail.toLowerCase().includes(q),
    );
  }, [incomingInvites, networkSearch]);

  const allFilteredConnectedSelected =
    filteredConnected.length > 0 &&
    filteredConnected.every((l) => selectedConnectedIds.has(l.lenderId));

  function toggleConnectedSelection(lenderId: string) {
    setSelectedConnectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lenderId)) next.delete(lenderId);
      else next.add(lenderId);
      return next;
    });
  }

  function toggleSelectAllConnected() {
    if (allFilteredConnectedSelected) {
      setSelectedConnectedIds((prev) => {
        const next = new Set(prev);
        filteredConnected.forEach((l) => next.delete(l.lenderId));
        return next;
      });
      return;
    }
    setSelectedConnectedIds((prev) => {
      const next = new Set(prev);
      filteredConnected.forEach((l) => next.add(l.lenderId));
      return next;
    });
  }

  function openSendApplication(lenders: ConnectedLender[]) {
    if (!lenders.length) return;
    if (!canSendApplications) {
      toast.error("You don't have permission to send applications to lenders");
      return;
    }
    setSendApplicationLenders(lenders);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
              Network
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Lender{" "}
              <span style={{ color: BRAND }}>Marketplace</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Discover verified lenders, manage your connections, and grow your
              funding network — all in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <StatPill
              icon={<Users size={16} />}
              label="Connected"
              value={stats.connected}
              color="emerald"
            />
            <StatPill
              icon={<Clock size={16} />}
              label="Pending"
              value={stats.pending}
              color="amber"
            />
            {stats.incoming > 0 && (
              <StatPill
                icon={<Send size={16} />}
                label="Requests"
                value={stats.incoming}
                color="blue"
                pulse
              />
            )}
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit shadow-sm">
          {(
            [
              { key: "discover" as const, label: "Discover", icon: Search },
              { key: "network" as const, label: "My Network", icon: Handshake },
              {
                key: "submissions" as const,
                label: "My Submissions",
                icon: UserPlus,
              },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMainTab(key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mainTab === key
                  ? "text-white shadow-md"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
              style={mainTab === key ? { backgroundColor: BRAND } : undefined}
            >
              <Icon size={16} />
              {label}
              {key === "network" && stats.incoming > 0 && mainTab !== "network" && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                  {stats.incoming}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Discover tab */}
        {mainTab === "discover" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={discoverQ}
                  onChange={(e) => setDiscoverQ(e.target.value)}
                  placeholder="Search lenders by name, state, or product..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <button
                type="button"
                onClick={openFiltersDrawer}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <SlidersHorizontal size={16} />
                Filters
                {activeFilterCount > 0 && (
                  <span
                    className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: BRAND }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {canAddOwnLender && (
                <button
                  type="button"
                  onClick={() => setAddLenderOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shrink-0 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: BRAND }}
                >
                  <Plus size={16} />
                  Add Your Own Lender
                </button>
              )}
              {discoverLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-500 px-2 shrink-0">
                  <RefreshCcw size={16} className="animate-spin" />
                  Searching...
                </div>
              )}
            </div>

            {!discoverLoading && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Showing{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {discoverTotal}
                  </span>{" "}
                  Verified Lending Partner{discoverTotal !== 1 ? "s" : ""}
                  {debouncedDiscoverQ.trim()
                    ? ` matching "${debouncedDiscoverQ.trim()}"`
                    : ""}
                </p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearDiscoverFilters}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {discoverLoading ? (
              <LenderCardSkeletonGrid />
            ) : discoverLenders.length === 0 ? (
              <EmptyState
                icon={
                  debouncedDiscoverQ.trim() ? (
                    <SearchX size={40} className="text-orange-500" />
                  ) : (
                    <Building2 size={40} style={{ color: BRAND }} />
                  )
                }
                title={
                  debouncedDiscoverQ.trim() || activeFilterCount > 0
                    ? "No lenders found"
                    : "No lenders available yet"
                }
                subtitle={
                  debouncedDiscoverQ.trim() || activeFilterCount > 0
                    ? "Try adjusting your search or filters."
                    : "Verified lenders will appear here once they complete their profiles."
                }
                action={
                  debouncedDiscoverQ.trim() || activeFilterCount > 0 ? (
                    <div className="flex flex-wrap justify-center gap-3">
                      {debouncedDiscoverQ.trim() && (
                        <button
                          onClick={() => setDiscoverQ("")}
                          className="text-sm font-semibold hover:underline"
                          style={{ color: BRAND }}
                        >
                          Clear search
                        </button>
                      )}
                      {activeFilterCount > 0 && (
                        <button
                          onClick={clearDiscoverFilters}
                          className="text-sm font-semibold hover:underline"
                          style={{ color: BRAND }}
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {discoverLenders.map((l) => (
                    <DiscoverLenderCard
                      key={l.id}
                      lender={l}
                      connecting={connectingId === l.id}
                      onConnect={() => handleConnect(l.id)}
                      onViewProfile={() => setProfileLender(l)}
                      showConnect={canConnectLenders}
                    />
                  ))}
                </div>

                <DiscoverPagination
                  page={discoverPage}
                  totalPages={discoverPages}
                  total={discoverTotal}
                  limit={discoverLimit}
                  onPageChange={setDiscoverPage}
                />
              </>
            )}
          </div>
        )}

        {/* Network tab */}
        {mainTab === "network" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "connected" as const, label: "Connected", count: stats.connected },
                    { key: "sent" as const, label: "Pending", count: pendingSent },
                    { key: "received" as const, label: "Received", count: stats.incoming },
                  ] as const
                ).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setNetworkFilter(key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                      networkFilter === key
                        ? "border-transparent text-white shadow-sm"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:border-slate-300"
                    }`}
                    style={
                      networkFilter === key
                        ? { backgroundColor: BRAND }
                        : undefined
                    }
                  >
                    {label}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        networkFilter === key
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={networkSearch}
                  onChange={(e) => setNetworkSearch(e.target.value)}
                  placeholder="Filter..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <button
                onClick={loadNetwork}
                disabled={networkLoading}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCcw
                  size={18}
                  className={networkLoading ? "animate-spin text-slate-400" : "text-slate-500"}
                />
              </button>
            </div>

            {networkFilter === "connected" && selectedConnectedIds.size > 0 && (
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/10 px-4 py-3">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {selectedConnectedIds.size} lender
                  {selectedConnectedIds.size === 1 ? "" : "s"} selected
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedConnectedIds(new Set())}
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800"
                  >
                    Clear
                  </button>
                  {canSendApplications && (
                    <button
                      type="button"
                      onClick={() =>
                        openSendApplication(
                          connected.filter((l) =>
                            selectedConnectedIds.has(l.lenderId),
                          ),
                        )
                      }
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90"
                      style={{ backgroundColor: BRAND }}
                    >
                      <Send size={14} />
                      Send Application
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              {networkLoading ? (
                <TableSkeleton rows={5} cols={4} />
              ) : networkFilter === "connected" ? (
                <NetworkTable
                  empty={
                    filteredConnected.length === 0
                      ? {
                          title: "No connected lenders",
                          subtitle:
                            "Discover lenders and send connection requests to build your network.",
                        }
                      : undefined
                  }
                  headerPrefix={
                    networkFilter === "connected" && canSendApplications ? (
                      <input
                        type="checkbox"
                        checked={allFilteredConnectedSelected}
                        onChange={toggleSelectAllConnected}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        aria-label="Select all lenders"
                      />
                    ) : undefined
                  }
                  headers={
                    networkFilter === "connected" && canSendApplications
                      ? ["", "Lender", "Email", "Status", "Connected", "Actions"]
                      : ["Lender", "Email", "Status", "Connected", "Actions"]
                  }
                  selectedIds={canSendApplications ? selectedConnectedIds : undefined}
                  rows={filteredConnected.map((l) => ({
                    id: l.lenderId,
                    cells: [
                      ...(canSendApplications
                        ? [
                            <input
                              type="checkbox"
                              checked={selectedConnectedIds.has(l.lenderId)}
                              onChange={() => toggleConnectedSelection(l.lenderId)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              aria-label={`Select ${l.lenderName}`}
                            />,
                          ]
                        : []),
                      <span className="font-medium text-slate-900 dark:text-white">
                        {l.lenderName}
                      </span>,
                      <span className="text-slate-500">{l.lenderEmail}</span>,
                      <StatusBadge status="CONNECTED" />,
                      <span className="text-slate-500 text-xs">
                        {formatDateTime(l.connectedAt)}
                      </span>,
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setProductsLender(l)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Layers size={12} />
                          Products
                        </button>
                        {canSendApplications && (
                          <button
                            type="button"
                            onClick={() => openSendApplication([l])}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90"
                            style={{ backgroundColor: BRAND }}
                          >
                            <Send size={12} />
                            Send Application
                          </button>
                        )}
                      </div>,
                    ],
                  }))}
                />
              ) : networkFilter === "sent" ? (
                <NetworkTable
                  empty={
                    filteredSent.length === 0
                      ? {
                          title: "No pending requests",
                          subtitle:
                            "Go to Discover to find and connect with lenders.",
                        }
                      : undefined
                  }
                  headers={["Lender", "Email", "Status", "Sent"]}
                  rows={filteredSent.map((i) => ({
                    id: i.inviteId,
                    cells: [
                      <span className="font-medium">{i.name}</span>,
                      <span className="text-slate-500">{i.email}</span>,
                      <StatusBadge status={i.inviteStatus} />,
                      <span className="text-slate-500 text-xs">
                        {formatDateTime(i.invitedAt)}
                      </span>,
                    ],
                  }))}
                />
              ) : (
                <NetworkTable
                  empty={
                    filteredIncoming.length === 0
                      ? {
                          title: "No incoming requests",
                          subtitle:
                            "When lenders invite you to connect, they'll appear here.",
                        }
                      : undefined
                  }
                  headers={["Lender", "Email", "Actions", "Received"]}
                  rows={filteredIncoming.map((i) => ({
                    id: i.inviteId,
                    cells: [
                      <span className="font-medium">{i.lenderName}</span>,
                      <span className="text-slate-500">{i.lenderEmail}</span>,
                      canConnectLenders ? (
                        <div className="flex items-center gap-2">
                          <button
                            disabled={actionId === i.inviteId}
                            onClick={() => handleAcceptIncoming(i.inviteId)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {actionId === i.inviteId ? (
                              <RefreshCcw size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            Accept
                          </button>
                          <button
                            disabled={actionId === i.inviteId}
                            onClick={() => handleRejectIncoming(i.inviteId)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                          >
                            <X size={12} />
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      ),
                      <span className="text-slate-500 text-xs">
                        {formatDateTime(i.invitedAt)}
                      </span>,
                    ],
                  }))}
                />
              )}
            </div>
          </div>
        )}

        {mainTab === "submissions" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={submissionsSearch}
                  onChange={(e) => setSubmissionsSearch(e.target.value)}
                  placeholder="Search by company, contact, or email..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              {canAddOwnLender && (
                <button
                  type="button"
                  onClick={() => setAddLenderOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shrink-0 hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  <Plus size={16} />
                  Add Lender
                </button>
              )}
              <button
                onClick={loadSubmissions}
                disabled={submissionsLoading}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 shrink-0"
                title="Refresh"
              >
                <RefreshCcw
                  size={18}
                  className={
                    submissionsLoading ? "animate-spin text-slate-400" : "text-slate-500"
                  }
                />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              {submissionsLoading ? (
                <TableSkeleton rows={5} cols={5} />
              ) : submissions.length === 0 ? (
                <EmptyState
                  icon={<UserPlus size={28} className="text-slate-400" />}
                  title="No lender submissions yet"
                  subtitle="Add your own lender to invite them to complete their profile on LendingCart."
                  action={
                    canAddOwnLender ? (
                      <button
                        type="button"
                        onClick={() => setAddLenderOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                        style={{ backgroundColor: BRAND }}
                      >
                        <Plus size={16} />
                        Add Your Own Lender
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <NetworkTable
                  headers={[
                    "Company",
                    "Contact",
                    "Email",
                    "Status",
                    "Last Sent",
                    "Actions",
                  ]}
                  rows={submissions.map((s) => {
                    const canResend =
                      s.submissionStatus === "INVITE_SENT" ||
                      s.submissionStatus === "EXPIRED";
                    const canConnect =
                      s.submissionStatus === "PROFILE_COMPLETE" &&
                      s.lenderOrgId;

                    return {
                      id: s.id,
                      cells: [
                        <span className="font-medium text-slate-900 dark:text-white">
                          {s.companyName}
                        </span>,
                        <span className="text-slate-600 dark:text-slate-300">
                          {s.contactPerson}
                        </span>,
                        <span className="text-slate-500">{s.businessEmail}</span>,
                        <SubmissionStatusBadge status={s.submissionStatus} />,
                        <span className="text-slate-500 text-xs">
                          {s.lastSentAt ? formatDateTime(s.lastSentAt) : "—"}
                        </span>,
                        <div className="flex flex-wrap items-center gap-2">
                          {canAddOwnLender && canResend && (
                            <button
                              type="button"
                              disabled={resendingId === s.id}
                              onClick={() => handleResendSubmission(s.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                            >
                              {resendingId === s.id ? (
                                <RefreshCcw size={12} className="animate-spin" />
                              ) : (
                                <Send size={12} />
                              )}
                              Resend Invite
                            </button>
                          )}
                          {canConnectLenders && canConnect && s.lenderOrgId && (
                            <button
                              type="button"
                              onClick={async () => {
                                setConnectingId(s.lenderOrgId);
                                try {
                                  await inviteLender(s.lenderOrgId!);
                                  toast.success("Connection request sent");
                                } catch (err: any) {
                                  toast.error(err.message || "Failed to connect");
                                } finally {
                                  setConnectingId(null);
                                }
                              }}
                              disabled={connectingId === s.lenderOrgId}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                              style={{ backgroundColor: BRAND }}
                            >
                              <Handshake size={12} />
                              Connect
                            </button>
                          )}
                        </div>,
                      ],
                    };
                  })}
                />
              )}
            </div>

            {!submissionsLoading && submissionsTotal > submissionsLimit && (
              <DiscoverPagination
                page={submissionsPage}
                totalPages={Math.max(
                  1,
                  Math.ceil(submissionsTotal / submissionsLimit),
                )}
                total={submissionsTotal}
                limit={submissionsLimit}
                onPageChange={setSubmissionsPage}
              />
            )}
          </div>
        )}
      </div>

      <AddBrokerLenderModal
        open={addLenderOpen}
        onClose={() => setAddLenderOpen(false)}
        onSubmitted={() => {
          setMainTab("submissions");
          loadSubmissions();
        }}
      />

      {productsLender && (
        <LenderProductsModal
          lender={productsLender}
          onClose={() => setProductsLender(null)}
        />
      )}
      {sendApplicationLenders && (
        <SendApplicationModal
          lenders={sendApplicationLenders}
          onClose={() => setSendApplicationLenders(null)}
          onSent={() => {
            setSelectedConnectedIds(new Set());
            setSendApplicationLenders(null);
          }}
        />
      )}
      {profileLender && (
        <LenderDiscoverProfileModal
          lender={profileLender}
          onClose={() => setProfileLender(null)}
          onInvite={() => handleConnect(profileLender.id)}
          inviting={connectingId === profileLender.id}
          showInvite={canConnectLenders}
        />
      )}

      {filtersOpen && (
        <DiscoverFiltersDrawer
          draft={draftFilters}
          onChange={setDraftFilters}
          onClose={() => setFiltersOpen(false)}
          onApply={applyDiscoverFilters}
          onClear={() => {
            setDraftFilters(EMPTY_DISCOVER_FILTERS);
          }}
        />
      )}
    </div>
  );
}

/* ================= Sub-components ================= */

function StatPill({
  icon,
  label,
  value,
  color,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "emerald" | "amber" | "blue";
  pulse?: boolean;
}) {
  const colors = {
    emerald: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20",
    amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20",
    blue: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20",
  };

  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border ${colors[color]} ${pulse ? "ring-2 ring-blue-400/30" : ""}`}
    >
      {icon}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
          {label}
        </p>
        <p className="text-lg font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

function DiscoverStarRating({ count = 5 }: { count?: number }) {
  return (
    <span className="inline-flex gap-0.5 text-amber-400 text-base leading-none">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < count ? "" : "opacity-30"}>
          ★
        </span>
      ))}
    </span>
  );
}

function DiscoverLenderCard({
  lender,
  connecting,
  onConnect,
  onViewProfile,
  showConnect = true,
}: {
  lender: DiscoverLender;
  connecting: boolean;
  onConnect: () => void;
  onViewProfile: () => void;
  showConnect?: boolean;
}) {
  const states = parseStatesList(lender.statesSupported);
  const statesSummary = formatStatesSummary(states);
  const loanTypes = lender.loanTypes.map(formatLoanTypeLabel).slice(0, 4);
  const displayName = getLenderDisplayName(lender.name, lender.brandName);
  const fundingTime = formatFundingTime(lender.fundingSpeedDays);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className="p-5 pb-4">
        <div className="flex items-start gap-4">
          <LenderLogo
            brandLogoUrl={lender.brandLogoUrl}
            profileImage={lender.profileImage}
            name={displayName}
            alt={`${displayName} logo`}
            className="h-16 w-16"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {displayName}
                </h3>
                <div className="mt-1.5">
                  <DiscoverStarRating count={lender.isEligible ? 5 : 4} />
                </div>
              </div>
              {lender.isEligible && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/20">
                  Eligible ✓
                </span>
              )}
            </div>
          </div>
        </div>

        {loanTypes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {loanTypes.map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <InfoStat
            label="States"
            tooltip={statesSummary.tooltip || undefined}
          >
            {statesSummary.display}
          </InfoStat>

          <div className="grid grid-cols-2 gap-3">
            <InfoStat label="Funding Time" tooltip={fundingTime}>
              {fundingTime}
            </InfoStat>
            <LoanAmountStat
              min={lender.minFunding}
              max={lender.maxFunding}
            />
          </div>
        </div>
      </div>

      <div
        className={`mt-auto grid gap-2 p-4 pt-0 ${
          showConnect ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        <button
          type="button"
          onClick={onViewProfile}
          className="py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          View Profile
        </button>
        {showConnect && (
          <button
            type="button"
            onClick={onConnect}
            disabled={connecting}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            {connecting ? (
              <RefreshCcw size={14} className="animate-spin" />
            ) : (
              <Handshake size={14} />
            )}
            {connecting ? "Connecting..." : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}

function InfoStat({
  label,
  value,
  tooltip,
  highlight,
  children,
}: {
  label: string;
  value?: string;
  tooltip?: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  const content = children ?? value ?? "—";

  return (
    <div
      className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800 min-w-0"
      title={tooltip}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div
        className={`mt-1 text-sm font-semibold leading-snug break-words ${
          highlight
            ? "text-slate-900 dark:text-white"
            : "text-slate-800 dark:text-slate-100"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

function LoanAmountStat({
  min,
  max,
}: {
  min: string;
  max: string;
}) {
  const minStr = formatCompactMoney(min);
  const maxStr = formatCompactMoney(max);
  const hasBoth = minStr !== "—" && maxStr !== "—";
  const tooltip = formatLoanAmountRange(min, max);

  return (
    <div
      className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800 min-w-0"
      title={tooltip}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Loan Amount
      </p>
      {hasBoth ? (
        <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white leading-snug whitespace-nowrap">
          {minStr} – {maxStr}
        </p>
      ) : (
        <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">
          {tooltip}
        </p>
      )}
    </div>
  );
}

function DiscoverPagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const pages: number[] = [];
  const windowSize = 5;
  let startPage = Math.max(1, page - Math.floor(windowSize / 2));
  const endPage = Math.min(totalPages, startPage + windowSize - 1);
  startPage = Math.max(1, endPage - windowSize + 1);
  for (let p = startPage; p <= endPage; p += 1) pages.push(p);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
      <p className="text-sm text-slate-500">
        Showing{" "}
        <span className="font-semibold text-slate-800 dark:text-white">
          {start}–{end}
        </span>{" "}
        of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <ChevronLeft size={18} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`min-w-[2.25rem] h-9 px-2 rounded-lg text-sm font-semibold transition-colors ${
              p === page
                ? "text-white"
                : "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            style={p === page ? { backgroundColor: BRAND } : undefined}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "CONNECTED" | "PENDING" | "ACCEPTED" | "REJECTED";
}) {
  const styles = {
    CONNECTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  };

  const labels = {
    CONNECTED: "Connected ✓",
    PENDING: "Pending",
    ACCEPTED: "Accepted",
    REJECTED: "Rejected",
  };

  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function SubmissionStatusBadge({ status }: { status: string }) {
  const tone = submissionStatusTone(status);
  const styles: Record<string, string> = {
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
    slate:
      "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300",
  };

  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${styles[tone]}`}
    >
      {formatSubmissionStatus(status)}
    </span>
  );
}

function NetworkTable({
  headers,
  rows,
  empty,
  headerPrefix,
  selectedIds,
}: {
  headers: string[];
  rows: { id: string; cells: React.ReactNode[] }[];
  empty?: { title: string; subtitle: string };
  headerPrefix?: React.ReactNode;
  selectedIds?: Set<string>;
}) {
  if (empty) {
    return (
      <div className="py-16 px-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <CheckCircle2 size={28} className="text-slate-400" />
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
          {empty.title}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          {empty.subtitle}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
            {headers.map((h, index) => (
              <th
                key={`${h}-${index}`}
                className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                {index === 0 && headerPrefix ? headerPrefix : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                selectedIds?.has(row.id)
                  ? "bg-blue-50/40 dark:bg-blue-500/5"
                  : ""
              }`}
            >
              {row.cells.map((cell, i) => (
                <td key={i} className="px-5 py-4 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-20 flex flex-col items-center text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md">
        {subtitle}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function LenderCardSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="h-52 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
        />
      ))}
    </div>
  );
}

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="p-5 space-y-4 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-4 flex-1 rounded bg-slate-200 dark:bg-slate-700"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function DiscoverFiltersDrawer({
  draft,
  onChange,
  onClose,
  onApply,
  onClear,
}: {
  draft: DiscoverFilters;
  onChange: (next: DiscoverFilters) => void;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
}) {
  function update<K extends keyof DiscoverFilters>(key: K, value: DiscoverFilters[K]) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <div className="fixed inset-0 z-[1100] flex justify-end">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Filters
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Narrow lenders by product, location, and criteria
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <FilterField label="Loan Product">
            <select
              value={draft.loanProduct}
              onChange={(e) => update("loanProduct", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30"
            >
              {LOAN_PRODUCT_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || "any"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="State">
            <select
              value={draft.state}
              onChange={(e) => update("state", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30"
            >
              <option value="">Any state</option>
              {US_STATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Funding Time">
            <select
              value={draft.fundingMax}
              onChange={(e) => update("fundingMax", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30"
            >
              {FUNDING_TIME_OPTIONS.map((opt) => (
                <option key={opt.value || "any"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Loan Amount">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={0}
                value={draft.minAmount}
                onChange={(e) => update("minAmount", e.target.value)}
                placeholder="Min ($)"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              />
              <input
                type="number"
                min={0}
                value={draft.maxAmount}
                onChange={(e) => update("maxAmount", e.target.value)}
                placeholder="Max ($)"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              />
            </div>
          </FilterField>

          <FilterField label="Industry">
            <select
              value={draft.industry}
              onChange={(e) => update("industry", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30"
            >
              {INDUSTRY_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || "any"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Eligibility">
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <input
                type="checkbox"
                checked={draft.eligible}
                onChange={(e) => update("eligible", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Eligible lenders only
                </p>
                <p className="text-xs text-slate-500">
                  Show lenders with completed profiles
                </p>
              </div>
            </label>
          </FilterField>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 flex gap-3">
          <button
            type="button"
            onClick={onClear}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}
