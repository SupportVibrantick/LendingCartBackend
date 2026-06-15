import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getActiveBrokerId,
  setActiveBrokerId,
} from "../../lib/brokerDetailNavigation";
import { Link, Navigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  Activity,
  ArrowLeft,
  Building2,
  Briefcase,
  ContactRound,
  Eye,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  User,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import PageMeta from "../../components/common/PageMeta";
import ViewBrokerContactModal from "./ViewBrokerContactModal";
import ViewBrokerClientModal from "./ViewBrokerClientModal";
import ClientAppsModal from "./ClientAppsModal";
import ApplicationDetailModal from "../../components/applications/ApplicationDetailModal";
import ViewBrokerLoanOfficerModal from "./ViewBrokerLoanOfficerModal";
import BrokerLoanOfficerModal from "./BrokerLoanOfficerModal";
import BrokerSubBrokerModal from "./BrokerSubBrokerModal";
import LoanOfficerActivityModal from "./LoanOfficerActivityModal";
import LoanOfficerDealsModal from "./LoanOfficerDealsModal";
import SubBrokerAppsModal from "./SubBrokerAppsModal";
import ViewBrokerSubBrokerModal from "./ViewBrokerSubBrokerModal";
import ViewBrokerLenderModal from "./ViewBrokerLenderModal";
import AssignBrokerLenderModal from "./AssignBrokerLenderModal";
import EditBrokerModal, { type Broker as EditBroker } from "./EditBrokerModal";
import {
  CONTACT_ENTITY_TYPES,
  CONTACT_US_STATES,
  formatContactPhone,
  formatContactPhoneValue,
  formatContactZipCode,
  INITIAL_BROKER_CONTACT_FORM,
  isContactPhoneField,
  validateBrokerContactForm,
  type BrokerContactFormErrors,
} from "../../lib/brokerContactForm";
import {
  BROKER_CONTACT_TYPES,
  createBrokerContact,
  deleteBrokerContact,
  deleteBrokerLoanOfficer,
  deleteBrokerSubBroker,
  deleteBrokerClient,
  fetchBrokerApplications,
  fetchBrokerClients,
  fetchBrokerContacts,
  fetchBrokerDetail,
  resolveBrokerOrganizationName,
  resolveBrokerPrimaryAdmin,
  resolveBrokerWhiteLabel,
  fetchBrokerLenders,
  fetchBrokerLoanOfficers,
  fetchBrokerSubBrokers,
  fetchBrokerSubscription,
  removeBrokerLender,
  updateBrokerContact,
  updateBrokerClientStatus,
  updateBrokerLenderStatus,
  updateBrokerLoanOfficerStatus,
  updateBrokerSubBrokerStatus,
  updateBrokerOrganization,
  changeBrokerOrganizationStatus,
  type BrokerApplicationRow,
  type BrokerClientRow,
  type BrokerContact,
  type BrokerContactInput,
  type BrokerDetail,
  type BrokerLenderAccessRow,
  type BrokerTeamMember,
} from "../../lib/brokerDetailApi";
import type { SubscriberDetail } from "../../lib/subscriptionApi";
import { formatPrice } from "../../lib/subscriptionApi";

type TabKey =
  | "overview"
  | "contacts"
  | "loan-officers"
  | "sub-brokers"
  | "clients"
  | "lenders"
  | "applications"
  | "subscription";

const initialContactForm = INITIAL_BROKER_CONTACT_FORM;

function contactInputClass(hasError?: boolean) {
  return `w-full rounded-lg border px-3 py-2 text-xs outline-none dark:bg-slate-900 ${
    hasError
      ? "border-red-400 focus:border-red-500 dark:border-red-500"
      : "border-slate-200 focus:border-[#13538A] dark:border-slate-700"
  }`;
}

function ContactFormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-500">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {error ? <p className="mt-1 text-[10px] font-medium text-red-600">{error}</p> : null}
    </label>
  );
}

function formatContactType(value?: string | null) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <Building2 size={13} /> },
  { key: "contacts", label: "Contacts", icon: <ContactRound size={13} /> },
  { key: "loan-officers", label: "Loan Officers", icon: <Briefcase size={13} /> },
  { key: "sub-brokers", label: "Sub Brokers", icon: <UsersRound size={13} /> },
  { key: "clients", label: "Clients", icon: <Users size={13} /> },
  { key: "lenders", label: "Lenders", icon: <Link2 size={13} /> },
  { key: "applications", label: "Applications", icon: <FileText size={13} /> },
  { key: "subscription", label: "Subscription", icon: <Wallet size={13} /> },
];

function statusBadge(status?: string) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border";
  switch (status) {
    case "ACTIVE":
      return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
    case "DISABLED":
    case "INACTIVE":
      return `${base} bg-amber-50 text-amber-700 border-amber-200`;
    case "SUSPENDED":
      return `${base} bg-red-50 text-red-700 border-red-200`;
    default:
      return `${base} bg-slate-100 text-slate-600 border-slate-200`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLenderSource(value?: string | null) {
  if (!value) return "—";
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatLastLogin(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatActivityRelative(value?: string | null) {
  if (!value) return "No activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function personName(first?: string | null, last?: string | null, email?: string) {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || email || "—";
}

function clientName(row: BrokerClientRow) {
  return row.displayName || row.legalName || row.primaryContact?.email || "—";
}

function formatProductCode(code?: string | null) {
  if (!code) return "—";
  return code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function DetailCell({
  label,
  value,
  icon,
}: {
  label: string;
  value?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/40">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-800 dark:text-slate-100 break-words">
        {icon}
        <span>{value ?? "—"}</span>
      </div>
    </div>
  );
}

function OverviewSection({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="h-1 bg-gradient-to-r from-[#13538A] via-[#18B6B4] to-emerald-400 opacity-80" />
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-[11px] font-medium text-slate-800 dark:text-slate-100 sm:text-right max-w-xl break-words">
        {value ?? "—"}
      </span>
    </div>
  );
}

function OverviewSubsection({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="col-span-full flex items-center gap-2 pt-1 first:pt-0">
      <div className={`h-4 w-1 rounded-full ${accent}`} />
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</h3>
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-14 text-center text-xs text-slate-500">
      {message}
    </div>
  );
}

export default function BrokerDetailPage() {
  const location = useLocation();
  const brokerId = useMemo(() => {
    const fromState = (location.state as { brokerId?: string } | null)?.brokerId;
    if (fromState) {
      setActiveBrokerId(fromState);
      return fromState;
    }
    return getActiveBrokerId();
  }, [location.state]);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [broker, setBroker] = useState<BrokerDetail | null>(null);
  const [loanOfficers, setLoanOfficers] = useState<BrokerTeamMember[]>([]);
  const [subBrokers, setSubBrokers] = useState<BrokerTeamMember[]>([]);
  const [clients, setClients] = useState<BrokerClientRow[]>([]);
  const [applications, setApplications] = useState<BrokerApplicationRow[]>([]);
  const [appSearch, setAppSearch] = useState("");
  const [debouncedAppSearch, setDebouncedAppSearch] = useState("");
  const [appPage, setAppPage] = useState(1);
  const [appLimit] = useState(10);
  const [appTotal, setAppTotal] = useState(0);
  const [appTotalPages, setAppTotalPages] = useState(1);
  const [appTotalAmount, setAppTotalAmount] = useState(0);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [subscription, setSubscription] = useState<SubscriberDetail | null>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [contacts, setContacts] = useState<BrokerContact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [debouncedContactSearch, setDebouncedContactSearch] = useState("");
  const [contactPage, setContactPage] = useState(1);
  const [contactLimit] = useState(10);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactTotalPages, setContactTotalPages] = useState(1);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactModalMode, setContactModalMode] = useState<"create" | "edit">("create");
  const [contactForm, setContactForm] = useState<BrokerContactInput>(initialContactForm);
  const [contactFormErrors, setContactFormErrors] = useState<BrokerContactFormErrors>({});
  const [contactFormError, setContactFormError] = useState("");
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [editingBroker, setEditingBroker] = useState<EditBroker | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [viewContact, setViewContact] = useState<BrokerContact | null>(null);
  const [activeContactMenuId, setActiveContactMenuId] = useState<string | null>(null);
  const [contactMenuPos, setContactMenuPos] = useState({ top: 0, left: 0 });
  const contactMenuRef = useRef<HTMLDivElement | null>(null);

  const [loSearch, setLoSearch] = useState("");
  const [debouncedLoSearch, setDebouncedLoSearch] = useState("");
  const [loPage, setLoPage] = useState(1);
  const [loLimit] = useState(10);
  const [loTotal, setLoTotal] = useState(0);
  const [loTotalPages, setLoTotalPages] = useState(1);
  const [loLoading, setLoLoading] = useState(false);
  const [loModalOpen, setLoModalOpen] = useState(false);
  const [loModalMode, setLoModalMode] = useState<"create" | "edit">("create");
  const [editingLoId, setEditingLoId] = useState<string | null>(null);
  const [viewLoanOfficer, setViewLoanOfficer] = useState<BrokerTeamMember | null>(null);
  const [dealsOfficer, setDealsOfficer] = useState<BrokerTeamMember | null>(null);
  const [loActivityOpen, setLoActivityOpen] = useState(false);
  const [loActivityOfficer, setLoActivityOfficer] = useState<BrokerTeamMember | null>(null);
  const [activeLoMenuId, setActiveLoMenuId] = useState<string | null>(null);
  const [loMenuPos, setLoMenuPos] = useState({ top: 0, left: 0 });
  const loMenuRef = useRef<HTMLDivElement | null>(null);

  const [sbSearch, setSbSearch] = useState("");
  const [debouncedSbSearch, setDebouncedSbSearch] = useState("");
  const [sbPage, setSbPage] = useState(1);
  const [sbLimit] = useState(10);
  const [sbTotal, setSbTotal] = useState(0);
  const [sbTotalPages, setSbTotalPages] = useState(1);
  const [sbLoading, setSbLoading] = useState(false);
  const [sbModalOpen, setSbModalOpen] = useState(false);
  const [sbModalMode, setSbModalMode] = useState<"create" | "edit">("create");
  const [editingSbId, setEditingSbId] = useState<string | null>(null);
  const [viewSubBroker, setViewSubBroker] = useState<BrokerTeamMember | null>(null);
  const [appsSubBroker, setAppsSubBroker] = useState<BrokerTeamMember | null>(null);
  const [activeSbMenuId, setActiveSbMenuId] = useState<string | null>(null);
  const [sbMenuPos, setSbMenuPos] = useState({ top: 0, left: 0 });
  const sbMenuRef = useRef<HTMLDivElement | null>(null);

  const [clientSearch, setClientSearch] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [clientPage, setClientPage] = useState(1);
  const [clientLimit] = useState(10);
  const [clientTotal, setClientTotal] = useState(0);
  const [clientTotalPages, setClientTotalPages] = useState(1);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [viewClient, setViewClient] = useState<BrokerClientRow | null>(null);
  const [appsClient, setAppsClient] = useState<BrokerClientRow | null>(null);
  const [viewApplicationId, setViewApplicationId] = useState<string | null>(null);
  const [activeClientMenuId, setActiveClientMenuId] = useState<string | null>(null);
  const [clientMenuPos, setClientMenuPos] = useState({ top: 0, left: 0 });
  const clientMenuRef = useRef<HTMLDivElement | null>(null);

  const [lenderSearch, setLenderSearch] = useState("");
  const [debouncedLenderSearch, setDebouncedLenderSearch] = useState("");
  const [lenderPage, setLenderPage] = useState(1);
  const [lenderLimit] = useState(10);
  const [lenderTotal, setLenderTotal] = useState(0);
  const [lenderTotalPages, setLenderTotalPages] = useState(1);
  const [lendersLoading, setLendersLoading] = useState(false);
  const [lenders, setLenders] = useState<BrokerLenderAccessRow[]>([]);
  const [viewLender, setViewLender] = useState<BrokerLenderAccessRow | null>(null);
  const [assignLenderOpen, setAssignLenderOpen] = useState(false);
  const [activeLenderMenuId, setActiveLenderMenuId] = useState<string | null>(null);
  const [lenderMenuPos, setLenderMenuPos] = useState({ top: 0, left: 0 });
  const lenderMenuRef = useRef<HTMLDivElement | null>(null);

  const activeMenuLoanOfficer = useMemo(
    () => loanOfficers.find((row) => row.id === activeLoMenuId) || null,
    [activeLoMenuId, loanOfficers],
  );

  const closeLoMenu = useCallback(() => {
    setActiveLoMenuId(null);
  }, []);

  const activeMenuSubBroker = useMemo(
    () => subBrokers.find((row) => row.id === activeSbMenuId) || null,
    [activeSbMenuId, subBrokers],
  );

  const closeSbMenu = useCallback(() => {
    setActiveSbMenuId(null);
  }, []);

  const activeMenuClient = useMemo(
    () => clients.find((row) => row.id === activeClientMenuId) || null,
    [activeClientMenuId, clients],
  );

  const closeClientMenu = useCallback(() => {
    setActiveClientMenuId(null);
  }, []);

  const activeMenuLender = useMemo(
    () => lenders.find((row) => row.id === activeLenderMenuId) || null,
    [activeLenderMenuId, lenders],
  );

  const closeLenderMenu = useCallback(() => {
    setActiveLenderMenuId(null);
  }, []);

  useEffect(() => {
    if (!activeLenderMenuId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        lenderMenuRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-lender-menu-trigger]"))
      ) {
        return;
      }
      closeLenderMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLenderMenu();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeLenderMenuId, closeLenderMenu]);

  useEffect(() => {
    if (!activeClientMenuId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        clientMenuRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-client-menu-trigger]"))
      ) {
        return;
      }
      closeClientMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeClientMenu();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeClientMenuId, closeClientMenu]);

  useEffect(() => {
    if (!activeSbMenuId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        sbMenuRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-sb-menu-trigger]"))
      ) {
        return;
      }
      closeSbMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSbMenu();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeSbMenuId, closeSbMenu]);

  useEffect(() => {
    if (!activeLoMenuId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        loMenuRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-lo-menu-trigger]"))
      ) {
        return;
      }
      closeLoMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLoMenu();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeLoMenuId, closeLoMenu]);

  const closeContactMenu = useCallback(() => {
    setActiveContactMenuId(null);
  }, []);

  const activeMenuContact = useMemo(
    () => contacts.find((contact) => contact.id === activeContactMenuId) || null,
    [activeContactMenuId, contacts],
  );

  useEffect(() => {
    if (!activeContactMenuId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        contactMenuRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-contact-menu-trigger]"))
      ) {
        return;
      }
      closeContactMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeContactMenu();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeContactMenuId, closeContactMenu]);

  const loadContacts = useCallback(
    async (page = 1, search = "") => {
      if (!brokerId) return;

      setContactsLoading(true);
      try {
        const json = await fetchBrokerContacts(brokerId, page, search, contactLimit);
        setContacts(json.data || []);
        setContactTotal(json.meta?.total ?? json.data?.length ?? 0);
        setContactTotalPages(json.meta?.totalPages ?? 1);
        setContactPage(json.meta?.page ?? page);
      } catch (err: any) {
        toast.error(err.message || "Failed to load contacts");
      } finally {
        setContactsLoading(false);
      }
    },
    [brokerId, contactLimit],
  );

  const loadLoanOfficers = useCallback(
    async (page = 1, search = "") => {
      if (!brokerId) return;

      setLoLoading(true);
      try {
        const json = await fetchBrokerLoanOfficers(brokerId, page, search, loLimit);
        setLoanOfficers(json.data || []);
        setLoTotal(json.meta?.total ?? json.data?.length ?? 0);
        setLoTotalPages(json.meta?.totalPages ?? 1);
        setLoPage(json.meta?.page ?? page);
      } catch (err: any) {
        toast.error(err.message || "Failed to load loan officers");
      } finally {
        setLoLoading(false);
      }
    },
    [brokerId, loLimit],
  );

  const loadSubBrokers = useCallback(
    async (page = 1, search = "") => {
      if (!brokerId) return;

      setSbLoading(true);
      try {
        const json = await fetchBrokerSubBrokers(brokerId, page, search, sbLimit);
        setSubBrokers(json.data || []);
        setSbTotal(json.meta?.total ?? json.data?.length ?? 0);
        setSbTotalPages(json.meta?.totalPages ?? 1);
        setSbPage(json.meta?.page ?? page);
      } catch (err: any) {
        toast.error(err.message || "Failed to load sub-brokers");
      } finally {
        setSbLoading(false);
      }
    },
    [brokerId, sbLimit],
  );

  const loadClients = useCallback(
    async (page = 1, search = "") => {
      if (!brokerId) return;

      setClientsLoading(true);
      try {
        const json = await fetchBrokerClients(brokerId, page, search, clientLimit);
        setClients(json.data || []);
        setClientTotal(json.meta?.total ?? json.data?.length ?? 0);
        setClientTotalPages(json.meta?.totalPages ?? 1);
        setClientPage(json.meta?.page ?? page);
      } catch (err: any) {
        toast.error(err.message || "Failed to load clients");
      } finally {
        setClientsLoading(false);
      }
    },
    [brokerId, clientLimit],
  );

  const loadLenders = useCallback(
    async (page = 1, search = "") => {
      if (!brokerId) return;

      setLendersLoading(true);
      try {
        const json = await fetchBrokerLenders(brokerId, page, search, lenderLimit);
        setLenders(json.data || []);
        setLenderTotal(json.meta?.total ?? json.data?.length ?? 0);
        setLenderTotalPages(json.meta?.totalPages ?? 1);
        setLenderPage(json.meta?.page ?? page);
      } catch (err: any) {
        toast.error(err.message || "Failed to load lenders");
      } finally {
        setLendersLoading(false);
      }
    },
    [brokerId, lenderLimit],
  );

  const loadApplications = useCallback(
    async (page = 1, search = "") => {
      if (!brokerId) return;

      setApplicationsLoading(true);
      try {
        const json = await fetchBrokerApplications(brokerId, {
          page,
          limit: appLimit,
          search,
        });
        setApplications(json.data || []);
        setAppTotal(json.meta?.total ?? json.total ?? json.data?.length ?? 0);
        setAppTotalPages(json.meta?.totalPages ?? 1);
        setAppPage(json.meta?.page ?? page);
        setAppTotalAmount(json.summary?.totalAmount ?? 0);
      } catch (err: any) {
        toast.error(err.message || "Failed to load applications");
      } finally {
        setApplicationsLoading(false);
      }
    },
    [brokerId, appLimit],
  );

  const loadCore = useCallback(async () => {
    if (!brokerId) return;
    const json = await fetchBrokerDetail(brokerId);
    setBroker(json.data);
  }, [brokerId]);

  const loadTabData = useCallback(
    async (tab: TabKey) => {
      if (!brokerId) return;

      setTabLoading(true);
      try {
        if (tab === "subscription") {
          const json = await fetchBrokerSubscription(brokerId);
          setSubscription(json.success ? (json.data ?? null) : null);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load tab data");
      } finally {
        setTabLoading(false);
      }
    },
    [brokerId],
  );

  const loadAll = useCallback(async () => {
    if (!brokerId) return;
    try {
      setRefreshing(true);
      await loadCore();
      await Promise.all([
        loadContacts(1, ""),
        loadLoanOfficers(1, ""),
        loadSubBrokers(1, ""),
        loadClients(1, ""),
        loadLenders(1, ""),
        loadApplications(1, ""),
        loadTabData("subscription"),
      ]);
    } catch (err: any) {
      toast.error(err.message || "Failed to load broker details");
      setBroker(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [brokerId, loadCore, loadContacts, loadLoanOfficers, loadSubBrokers, loadClients, loadLenders, loadApplications, loadTabData]);

  useEffect(() => {
    setLoading(true);
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (loading) return;
    if (["overview", "lenders", "contacts", "loan-officers", "sub-brokers", "clients", "applications"].includes(activeTab)) return;
    loadTabData(activeTab);
  }, [activeTab, loadTabData, loading]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedContactSearch(contactSearch.trim());
      setContactPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [contactSearch]);

  useEffect(() => {
    if (loading || activeTab !== "contacts" || !brokerId) return;
    loadContacts(contactPage, debouncedContactSearch);
  }, [activeTab, loading, brokerId, contactPage, debouncedContactSearch, loadContacts]);

  useEffect(() => {
    if (loading || activeTab !== "loan-officers" || !brokerId) return;
    loadLoanOfficers(loPage, debouncedLoSearch);
  }, [activeTab, loading, brokerId, loPage, debouncedLoSearch, loadLoanOfficers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSbSearch(sbSearch.trim());
      setSbPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [sbSearch]);

  useEffect(() => {
    if (loading || activeTab !== "sub-brokers" || !brokerId) return;
    loadSubBrokers(sbPage, debouncedSbSearch);
  }, [activeTab, loading, brokerId, sbPage, debouncedSbSearch, loadSubBrokers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedClientSearch(clientSearch.trim());
      setClientPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [clientSearch]);

  useEffect(() => {
    if (loading || activeTab !== "clients" || !brokerId) return;
    loadClients(clientPage, debouncedClientSearch);
  }, [activeTab, loading, brokerId, clientPage, debouncedClientSearch, loadClients]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedLenderSearch(lenderSearch.trim());
      setLenderPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [lenderSearch]);

  useEffect(() => {
    if (loading || activeTab !== "lenders" || !brokerId) return;
    loadLenders(lenderPage, debouncedLenderSearch);
  }, [activeTab, loading, brokerId, lenderPage, debouncedLenderSearch, loadLenders]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedAppSearch(appSearch.trim());
      setAppPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [appSearch]);

  useEffect(() => {
    if (loading || activeTab !== "applications" || !brokerId) return;
    loadApplications(appPage, debouncedAppSearch);
  }, [activeTab, loading, brokerId, appPage, debouncedAppSearch, loadApplications]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedLoSearch(loSearch.trim());
      setLoPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loSearch]);

  const overviewStats = useMemo(
    () => [
      { label: "Contacts", value: contactTotal, tab: "contacts" as TabKey, icon: <ContactRound size={14} /> },
      { label: "Loan officers", value: loTotal, tab: "loan-officers" as TabKey, icon: <Briefcase size={14} /> },
      { label: "Sub brokers", value: sbTotal, tab: "sub-brokers" as TabKey, icon: <UsersRound size={14} /> },
      { label: "Clients", value: clientTotal, tab: "clients" as TabKey, icon: <Users size={14} /> },
      {
        label: "Lenders",
        value: lenderTotal,
        tab: "lenders" as TabKey,
        icon: <Link2 size={14} />,
      },
      { label: "Applications", value: appTotal, tab: "applications" as TabKey, icon: <FileText size={14} /> },
    ],
    [appTotal, clientTotal, contactTotal, lenderTotal, loTotal, sbTotal],
  );

  const updateContactField = <K extends keyof BrokerContactInput>(key: K, value: BrokerContactInput[K]) => {
    let nextValue = value;

    if (typeof value === "string") {
      if (isContactPhoneField(key)) {
        nextValue = formatContactPhone(value) as BrokerContactInput[K];
      } else if (key === "zipCode") {
        nextValue = formatContactZipCode(value) as BrokerContactInput[K];
      }
    }

    setContactForm((prev) => ({ ...prev, [key]: nextValue }));
    setContactFormErrors((prev) => ({ ...prev, [key]: undefined }));
    setContactFormError("");
  };

  const openCreateContactModal = () => {
    setContactModalMode("create");
    setEditingContactId(null);
    setContactForm(initialContactForm);
    setContactFormErrors({});
    setContactFormError("");
    setContactModalOpen(true);
  };

  const openEditContactModal = (contact: BrokerContact) => {
    setContactModalMode("edit");
    setEditingContactId(contact.id);
    setContactForm({
      contactType: (contact.contactType as BrokerContactInput["contactType"]) || "LENDER",
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      email: contact.email || "",
      companyName: contact.companyName || "",
      website: contact.website || "",
      phone: formatContactPhoneValue(contact.phone),
      tollFree: formatContactPhoneValue(contact.tollFree),
      cellNumber: formatContactPhoneValue(contact.cellNumber),
      faxNumber: formatContactPhoneValue(contact.faxNumber),
      address: contact.address || "",
      city: contact.city || "",
      state: contact.state || "",
      zipCode: contact.zipCode || "",
      stateOfFormation: contact.stateOfFormation || "",
      entityType: contact.entityType || "",
      description: contact.description || "",
    });
    setContactFormErrors({});
    setContactFormError("");
    setContactModalOpen(true);
  };

  const closeContactModal = () => {
    setContactModalOpen(false);
    setEditingContactId(null);
    setContactForm(initialContactForm);
    setContactFormErrors({});
    setContactFormError("");
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brokerId) return;

    const validationErrors = validateBrokerContactForm(contactForm);
    if (Object.keys(validationErrors).length > 0) {
      setContactFormErrors(validationErrors);
      setContactFormError("Please fix the highlighted fields.");
      return;
    }

    try {
      setContactSaving(true);
      setContactFormError("");

      const payload: BrokerContactInput = {
        contactType: contactForm.contactType,
        firstName: contactForm.firstName?.trim() || "",
        lastName: contactForm.lastName?.trim() || "",
        email: contactForm.email?.trim() || "",
        companyName: contactForm.companyName?.trim() || "",
        website: contactForm.website?.trim() || "",
        phone: contactForm.phone?.trim() || "",
        tollFree: contactForm.tollFree?.trim() || "",
        cellNumber: contactForm.cellNumber?.trim() || "",
        faxNumber: contactForm.faxNumber?.trim() || "",
        address: contactForm.address?.trim() || "",
        city: contactForm.city?.trim() || "",
        state: contactForm.state?.trim() || "",
        zipCode: contactForm.zipCode?.trim() || "",
        stateOfFormation: contactForm.stateOfFormation?.trim() || "",
        entityType: contactForm.entityType?.trim() || "",
        description: contactForm.description?.trim() || "",
      };

      if (contactModalMode === "create") {
        await createBrokerContact(brokerId, payload);
        toast.success("Contact created");
      } else if (editingContactId) {
        await updateBrokerContact(brokerId, editingContactId, payload);
        toast.success("Contact updated");
      }

      closeContactModal();
      await loadContacts(contactPage, debouncedContactSearch);
    } catch (err: any) {
      setContactFormError(err.message || "Failed to save contact");
    } finally {
      setContactSaving(false);
    }
  };

  const handleDeleteContact = async (contact: BrokerContact) => {
    if (!brokerId) return;

    const result = await Swal.fire({
      title: "Delete contact?",
      text: `${personName(contact.firstName, contact.lastName, contact.email || contact.companyName || undefined)} will be removed from this broker.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Delete",
    });

    if (!result.isConfirmed) return;

    try {
      await deleteBrokerContact(brokerId, contact.id);
      toast.success("Contact deleted");
      await loadContacts(contactPage, debouncedContactSearch);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete contact");
    }
  };

  const openCreateLoModal = () => {
    setLoModalMode("create");
    setEditingLoId(null);
    setLoModalOpen(true);
  };

  const openEditLoModal = (officer: BrokerTeamMember) => {
    setLoModalMode("edit");
    setEditingLoId(officer.id);
    setLoModalOpen(true);
  };

  const closeLoModal = () => {
    setLoModalOpen(false);
    setEditingLoId(null);
  };

  const openLoActivity = (officer?: BrokerTeamMember | null) => {
    setLoActivityOfficer(officer ?? null);
    setLoActivityOpen(true);
  };

  const closeLoActivity = () => {
    setLoActivityOpen(false);
    setLoActivityOfficer(null);
  };

  const handleToggleLoStatus = async (officer: BrokerTeamMember) => {
    const active = officer.status === "ACTIVE";
    const next = active ? "DISABLED" : "ACTIVE";

    const result = await Swal.fire({
      title: active ? "Disable loan officer?" : "Activate loan officer?",
      text: `${personName(officer.firstName, officer.lastName, officer.email)} will be marked as ${next}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
    });
    if (!result.isConfirmed) return;

    try {
      await updateBrokerLoanOfficerStatus(officer.id, next);
      toast.success(`Loan officer is now ${next}`);
      await loadLoanOfficers(loPage, debouncedLoSearch);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleDeleteLoanOfficer = async (officer: BrokerTeamMember) => {
    const result = await Swal.fire({
      title: "Delete loan officer?",
      text: `${personName(officer.firstName, officer.lastName, officer.email)} will be removed from this broker.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;

    try {
      await deleteBrokerLoanOfficer(officer.id);
      toast.success("Loan officer deleted");
      await loadLoanOfficers(loPage, debouncedLoSearch);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete loan officer");
    }
  };

  const openCreateSbModal = () => {
    setSbModalMode("create");
    setEditingSbId(null);
    setSbModalOpen(true);
  };

  const openEditSbModal = (subBroker: BrokerTeamMember) => {
    setSbModalMode("edit");
    setEditingSbId(subBroker.id);
    setSbModalOpen(true);
  };

  const closeSbModal = () => {
    setSbModalOpen(false);
    setEditingSbId(null);
  };

  const handleToggleSbStatus = async (subBroker: BrokerTeamMember) => {
    if (!brokerId) return;
    const active = subBroker.status === "ACTIVE";
    const next = active ? "DISABLED" : "ACTIVE";

    const result = await Swal.fire({
      title: active ? "Disable sub-broker?" : "Activate sub-broker?",
      text: `${personName(subBroker.firstName, subBroker.lastName, subBroker.email)} will be marked as ${next}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
    });
    if (!result.isConfirmed) return;

    try {
      await updateBrokerSubBrokerStatus(brokerId, subBroker.id, next);
      toast.success(`Sub-broker is now ${next}`);
      await loadSubBrokers(sbPage, debouncedSbSearch);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleDeleteSubBroker = async (subBroker: BrokerTeamMember) => {
    if (!brokerId) return;

    const result = await Swal.fire({
      title: "Delete sub-broker?",
      text: `${personName(subBroker.firstName, subBroker.lastName, subBroker.email)} will be removed from this broker.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;

    try {
      await deleteBrokerSubBroker(brokerId, subBroker.id);
      toast.success("Sub-broker deleted");
      await loadSubBrokers(sbPage, debouncedSbSearch);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete sub-broker");
    }
  };

  const handleToggleClientStatus = async (client: BrokerClientRow) => {
    const active = client.isActive === true;
    const next = !active;

    const result = await Swal.fire({
      title: active ? "Suspend client?" : "Activate client?",
      text: `${clientName(client)} will be marked as ${next ? "active" : "inactive"}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
    });
    if (!result.isConfirmed) return;

    try {
      await updateBrokerClientStatus(client.id, next);
      toast.success(next ? "Client activated" : "Client suspended");
      await loadClients(clientPage, debouncedClientSearch);
    } catch (err: any) {
      toast.error(err.message || "Failed to update client status");
    }
  };

  const handleDeleteClient = async (client: BrokerClientRow) => {
    const result = await Swal.fire({
      title: "Remove client?",
      text: `${clientName(client)} will be soft-deleted from the platform.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;

    try {
      await deleteBrokerClient(client.id);
      toast.success("Client removed");
      await loadClients(clientPage, debouncedClientSearch);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete client");
    }
  };

  const handleToggleLenderStatus = async (access: BrokerLenderAccessRow) => {
    if (!brokerId) return;

    const active = access.isActive === true;
    const next = !active;

    const result = await Swal.fire({
      title: active ? "Disconnect lender?" : "Reconnect lender?",
      text: `${access.lender?.name || "This lender"} will be marked as ${next ? "connected" : "disconnected"}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
    });
    if (!result.isConfirmed) return;

    try {
      await updateBrokerLenderStatus(brokerId, access.id, next);
      toast.success(next ? "Lender connected" : "Lender disconnected");
      await loadLenders(lenderPage, debouncedLenderSearch);
      await loadCore();
    } catch (err: any) {
      toast.error(err.message || "Failed to update lender connection");
    }
  };

  const handleRemoveLender = async (access: BrokerLenderAccessRow) => {
    if (!brokerId) return;

    const result = await Swal.fire({
      title: "Remove lender?",
      text: `${access.lender?.name || "This lender"} will be removed from this broker.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Remove",
    });
    if (!result.isConfirmed) return;

    try {
      await removeBrokerLender(brokerId, access.id);
      toast.success("Lender removed");
      await loadLenders(lenderPage, debouncedLenderSearch);
      await loadCore();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove lender");
    }
  };

  const openEditBroker = () => {
    if (!broker) return;
    const admin = resolveBrokerPrimaryAdmin(broker);
    setEditingBroker({
      id: broker.id,
      name: resolveBrokerOrganizationName(broker),
      email: broker.email || "",
      phone: broker.phone || "",
      status: broker.status,
      adminId: admin?.id,
      adminFirstName: admin?.firstName || "",
      adminLastName: admin?.lastName || "",
      adminEmail: admin?.email || "",
      adminStatus: admin?.status || "",
      createdAt: broker.createdAt,
    });
  };

  const handleEditBrokerSave = async (updated: EditBroker) => {
    if (!brokerId) return;

    try {
      await updateBrokerOrganization(brokerId, {
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        status: updated.status,
        admin: {
          id: updated.adminId,
          firstName: updated.adminFirstName,
          lastName: updated.adminLastName,
          email: updated.adminEmail,
          password: updated.adminPassword?.trim() || undefined,
          status: updated.adminStatus,
        },
      });
      toast.success("Broker updated");
      setEditingBroker(null);
      await loadCore();
    } catch (err: any) {
      toast.error(err.message || "Failed to update broker");
    }
  };

  const handleChangeBrokerStatus = async () => {
    if (!brokerId || !broker) return;

    const cur = (broker.status || "INACTIVE").toUpperCase();
    const next = cur === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    const result = await Swal.fire({
      title: "Change status?",
      text: `Mark this broker as ${next}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, change it",
    });
    if (!result.isConfirmed) return;

    try {
      setStatusUpdating(true);
      await changeBrokerOrganizationStatus(
        brokerId,
        next as "ACTIVE" | "INACTIVE" | "SUSPENDED",
      );
      toast.success(`Broker is now ${next}`);
      await loadCore();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  if (!brokerId) {
    return <Navigate to="/all-brokers-database" replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading broker details...
      </div>
    );
  }

  if (!broker) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-slate-500 mb-4">Broker not found</p>
        <Link to="/all-brokers-database" className="text-[#13538A] font-semibold">
          Back to brokers
        </Link>
      </div>
    );
  }

  const primaryAdmin = resolveBrokerPrimaryAdmin(broker);

  const renderOverview = () => {
    const activeSubscription = subscription?.subscription;
    const whiteLabel = resolveBrokerWhiteLabel(broker);
    const affiliateLinks = broker.affiliateLinks || [];
    const subscriptionPrice =
      activeSubscription?.billingCycle === "YEARLY"
        ? activeSubscription.package.priceYearly
        : activeSubscription?.package.priceMonthly;

    return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {overviewStats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => setActiveTab(stat.tab)}
            className="rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-[#13538A]/40 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40 dark:hover:bg-slate-800/50"
          >
            <div className="mb-2 flex items-center justify-between text-slate-400">
              {stat.icon}
              <span className="text-lg font-bold leading-none text-[#13538A] dark:text-indigo-400">
                {stat.value}
              </span>
            </div>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{stat.label}</p>
          </button>
        ))}
      </div>

      <OverviewSection
        title="Broker Details"
        icon={<Building2 size={14} className="text-[#13538A]" />}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openEditBroker}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button
              type="button"
              onClick={handleChangeBrokerStatus}
              disabled={statusUpdating}
              className="inline-flex items-center gap-1 rounded-lg bg-[#13538A] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0f426d] disabled:opacity-60"
            >
              {statusUpdating ? "Updating..." : "Change status"}
            </button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={statusBadge(broker.status)}>{broker.status}</span>
          <span className="text-[10px] text-slate-400">
            Updated {formatDate(broker.updatedAt)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewSubsection label="Organization" accent="bg-[#13538A]" />
          <DetailCell label="Organization name" value={resolveBrokerOrganizationName(broker)} />
          <DetailCell
            label="Organization email"
            value={broker.email}
            icon={<Mail size={12} className="shrink-0 text-slate-400" />}
          />
          <DetailCell
            label="Organization phone"
            value={broker.phone ? formatContactPhoneValue(broker.phone) : undefined}
            icon={<Phone size={12} className="shrink-0 text-slate-400" />}
          />
          <DetailCell label="Organization status" value={broker.status} />
          <DetailCell label="Created" value={formatDate(broker.createdAt)} />
          <DetailCell label="Last updated" value={formatDate(broker.updatedAt)} />

          <OverviewSubsection label="Primary Administrator" accent="bg-emerald-500" />
          <DetailCell
            label="Admin name"
            value={personName(primaryAdmin?.firstName, primaryAdmin?.lastName, primaryAdmin?.email)}
            icon={<User size={12} className="shrink-0 text-slate-400" />}
          />
          <DetailCell
            label="Admin email"
            value={primaryAdmin?.email}
            icon={<Mail size={12} className="shrink-0 text-slate-400" />}
          />
          <DetailCell
            label="Admin phone"
            value={
              primaryAdmin?.phone ? formatContactPhoneValue(primaryAdmin.phone) : undefined
            }
            icon={<Phone size={12} className="shrink-0 text-slate-400" />}
          />
          <DetailCell label="Admin status" value={primaryAdmin?.status} />
          <DetailCell label="Member since" value={formatDate(primaryAdmin?.createdAt)} />

          <OverviewSubsection label="Platform Summary" accent="bg-amber-500" />
          <DetailCell label="Team members" value={broker.counts?.admins ?? broker.admins?.length ?? 0} />
          <DetailCell label="Contacts" value={contactTotal} />
          <DetailCell label="Loan officers" value={loTotal} />
          <DetailCell label="Sub brokers" value={sbTotal} />
          <DetailCell label="Clients" value={clientTotal} />
          <DetailCell label="Connected lenders" value={broker.counts?.lenderAccess ?? lenderTotal} />
          <DetailCell label="Applications" value={appTotal} />
          <DetailCell
            label="Application volume"
            value={
              appTotalAmount > 0
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  }).format(appTotalAmount)
                : "—"
            }
          />
          <DetailCell label="Affiliate links" value={broker.counts?.affiliateLinks ?? affiliateLinks.length} />

          <OverviewSubsection label="Subscription" accent="bg-violet-500" />
          <DetailCell label="Current plan" value={activeSubscription?.package?.name} />
          <DetailCell label="Plan code" value={activeSubscription?.package?.code} />
          <DetailCell label="Subscription status" value={activeSubscription?.status} />
          <DetailCell label="Billing cycle" value={activeSubscription?.billingCycle} />
          <DetailCell
            label="Plan price"
            value={
              subscriptionPrice != null
                ? `${formatPrice(subscriptionPrice)} / ${
                    activeSubscription?.billingCycle === "YEARLY" ? "year" : "month"
                  }`
                : undefined
            }
            icon={<Wallet size={12} className="shrink-0 text-slate-400" />}
          />
          <DetailCell
            label="Current period starts"
            value={formatDate(activeSubscription?.currentPeriodStart)}
          />
          <DetailCell
            label="Current period ends"
            value={formatDate(activeSubscription?.currentPeriodEnd)}
          />
          <DetailCell
            label="Trial ends"
            value={
              activeSubscription?.trialEndsAt
                ? formatDate(activeSubscription.trialEndsAt)
                : "—"
            }
          />
          <DetailCell
            label="Cancel at period end"
            value={
              activeSubscription
                ? activeSubscription.cancelAtPeriodEnd
                  ? "Yes"
                  : "No"
                : undefined
            }
          />
        </div>
      </OverviewSection>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <OverviewSection
          title="White Label"
          icon={<Building2 size={14} className="text-[#13538A]" />}
        >
          {!whiteLabel ? (
            <p className="text-xs text-slate-500">White-label branding is not configured.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <DetailCell label="Brand name" value={whiteLabel.brandName} />
              <DetailCell label="Platform subdomain" value={whiteLabel.platformSubdomain} />
              <DetailCell label="Custom domain" value={whiteLabel.customDomain} />
              <DetailCell
                label="Domain verified"
                value={whiteLabel.domainVerified ? "Yes" : "No"}
              />
              <DetailCell label="SSL status" value={whiteLabel.sslStatus} />
              <DetailCell label="Primary color" value={whiteLabel.primaryColor} />
              <DetailCell label="Secondary color" value={whiteLabel.secondaryColor} />
              <DetailCell label="Support email" value={whiteLabel.supportEmail} />
              <DetailCell
                label="Full white label"
                value={whiteLabel.fullWhiteLabel ? "Enabled" : "Disabled"}
              />
              <DetailCell
                label="Show brand on approval"
                value={whiteLabel.showBrokerBrandOnApproval ? "Yes" : "No"}
              />
            </div>
          )}
        </OverviewSection>

        <OverviewSection
          title="Affiliate Links"
          icon={<ExternalLink size={14} className="text-[#13538A]" />}
        >
          {affiliateLinks.length === 0 ? (
            <p className="text-xs text-slate-500">No affiliate links created for this broker.</p>
          ) : (
            <div className="space-y-2">
              {affiliateLinks.map((link: any) => (
                <div
                  key={link.id}
                  className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                      {link.code}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {link.targetType?.replace(/_/g, " ") || "—"}
                    </p>
                  </div>
                  <span className={statusBadge(link.isActive ? "ACTIVE" : "INACTIVE")}>
                    {link.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </OverviewSection>
      </div>
    </div>
    );
  };

  const renderContacts = () => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Manage broker organization contacts
        </p>
        <button
          type="button"
          onClick={openCreateContactModal}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#13538A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0f426d]"
        >
          <Plus size={13} />
          Add Contact
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder="Search name, email, company..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <p className="text-[10px] text-slate-400">
          {contactTotal} contact{contactTotal === 1 ? "" : "s"}
          {debouncedContactSearch ? ` matching "${debouncedContactSearch}"` : ""}
        </p>
      </div>

      {contactsLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 py-16 text-xs text-slate-500 dark:border-slate-800">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading contacts...
        </div>
      ) : !contacts.length ? (
        <EmptyTab
          message={
            debouncedContactSearch
              ? `No contacts found for "${debouncedContactSearch}".`
              : "No contacts yet. Add a broker organization contact."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {["Name", "Company", "Email", "Phone", "Type", "Location", "Added", "Actions"].map((header) => (
                    <th key={header} className="px-3 py-2.5 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                      {personName(contact.firstName, contact.lastName, contact.email || undefined)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {contact.companyName || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {contact.email || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {contact.phone || contact.cellNumber || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {formatContactType(contact.contactType)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {[contact.city, contact.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {formatDate(contact.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        data-contact-menu-trigger
                        data-id={contact.id}
                        title="More actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setContactMenuPos({
                            top: rect.bottom + 4,
                            left: rect.right - 168,
                          });
                          setActiveContactMenuId(
                            activeContactMenuId === contact.id ? null : contact.id,
                          );
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {contactTotalPages > 1 && (
            <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <p className="text-[10px] text-slate-500">
                Page {contactPage} of {contactTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={contactPage <= 1 || contactsLoading}
                  onClick={() => setContactPage((p) => Math.max(p - 1, 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700"
                >
                  <ChevronLeft size={13} />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={contactPage >= contactTotalPages || contactsLoading}
                  onClick={() => setContactPage((p) => Math.min(p + 1, contactTotalPages))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700"
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderLoanOfficers = () => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">Manage loan officers for this broker organization.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openLoActivity()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#13538A]/30 bg-[#13538A]/5 px-3 py-1.5 text-[11px] font-semibold text-[#13538A] transition hover:bg-[#13538A]/10"
          >
            <Activity size={13} />
            LO Activity
          </button>
          <button
            type="button"
            onClick={openCreateLoModal}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#13538A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0f426d]"
          >
            <Plus size={13} />
            Add Loan Officer
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={loSearch}
            onChange={(e) => setLoSearch(e.target.value)}
            placeholder="Search name or email..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <p className="text-[10px] text-slate-400">
          {loTotal} loan officer{loTotal === 1 ? "" : "s"}
          {debouncedLoSearch ? ` matching "${debouncedLoSearch}"` : ""}
        </p>
      </div>

      {loLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 py-16 text-xs text-slate-500 dark:border-slate-800">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading loan officers...
        </div>
      ) : !loanOfficers.length ? (
        <EmptyTab
          message={
            debouncedLoSearch
              ? `No loan officers found for "${debouncedLoSearch}".`
              : "No loan officers yet. Add a loan officer for this broker."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {["Name", "Email", "Phone"].map((header) => (
                    <th key={header} className="px-3 py-2.5 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                  <th
                    className="px-3 py-2.5 whitespace-nowrap"
                    title="Click a deal count to view applications"
                  >
                    <span className="inline-flex items-center gap-1 text-[#13538A]">
                      Deals
                      <ExternalLink size={10} className="opacity-80" />
                    </span>
                  </th>
                  <th
                    className="px-3 py-2.5 whitespace-nowrap"
                    title="Click to view loan officer activity"
                  >
                    <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-400">
                      Activity
                      <ExternalLink size={10} className="opacity-80" />
                    </span>
                  </th>
                  {["Status", "Last login", "Actions"].map((header) => (
                    <th key={header} className="px-3 py-2.5 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loanOfficers.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                      {personName(row.firstName, row.lastName, row.email)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{row.email || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{row.phone || "—"}</td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setDealsOfficer(row)}
                        title="View assigned applications"
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition hover:shadow-sm ${
                          (row.assignedDeals ?? 0) > 0
                            ? "border-[#13538A]/30 bg-[#13538A]/8 text-[#13538A] hover:border-[#13538A]/50 hover:bg-[#13538A]/12"
                            : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                        }`}
                      >
                        <Briefcase size={11} className="shrink-0 opacity-80" />
                        {row.assignedDeals ?? 0}
                        <ExternalLink size={10} className="shrink-0 opacity-70" />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => openLoActivity(row)}
                        title="View loan officer activity"
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition hover:shadow-sm ${
                          row.lastActivityAt
                            ? "border-violet-300/50 bg-violet-50 text-violet-700 hover:border-violet-400/60 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/60"
                            : "border-slate-200 bg-slate-50 text-slate-500 hover:border-violet-300/40 hover:bg-violet-50/60 hover:text-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-violet-950/30"
                        }`}
                      >
                        <Activity size={11} className="shrink-0 opacity-80" />
                        {formatActivityRelative(row.lastActivityAt)}
                        <ExternalLink size={10} className="shrink-0 opacity-70" />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={statusBadge(row.status)}>{row.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {formatLastLogin(row.lastLoginAt)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        data-lo-menu-trigger
                        title="More actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setLoMenuPos({ top: rect.bottom + 4, left: rect.right - 168 });
                          setActiveLoMenuId(activeLoMenuId === row.id ? null : row.id);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loTotalPages > 1 && (
            <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <p className="text-[10px] text-slate-500">
                Page {loPage} of {loTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loPage <= 1 || loLoading}
                  onClick={() => setLoPage((p) => Math.max(p - 1, 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700"
                >
                  <ChevronLeft size={13} />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={loPage >= loTotalPages || loLoading}
                  onClick={() => setLoPage((p) => Math.min(p + 1, loTotalPages))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700"
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderSubBrokers = () => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">Manage sub-brokers for this broker organization.</p>
        <button
          type="button"
          onClick={openCreateSbModal}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#13538A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0f426d]"
        >
          <Plus size={13} />
          Add Sub-Broker
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={sbSearch}
            onChange={(e) => setSbSearch(e.target.value)}
            placeholder="Search name or email..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <p className="text-[10px] text-slate-400">
          {sbTotal} sub-broker{sbTotal === 1 ? "" : "s"}
          {debouncedSbSearch ? ` matching "${debouncedSbSearch}"` : ""}
        </p>
      </div>

      {sbLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 py-16 text-xs text-slate-500 dark:border-slate-800">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading sub-brokers...
        </div>
      ) : !subBrokers.length ? (
        <EmptyTab
          message={
            debouncedSbSearch
              ? `No sub-brokers found for "${debouncedSbSearch}".`
              : "No sub-brokers yet. Add a sub-broker for this broker."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {["Name", "Email", "Phone"].map((header) => (
                    <th key={header} className="px-3 py-2.5 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                  <th
                    className="px-3 py-2.5 whitespace-nowrap"
                    title="Click a count to view assigned applications"
                  >
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      Assigned apps
                      <ExternalLink size={10} className="opacity-80" />
                    </span>
                  </th>
                  {["Status", "Joined", "Actions"].map((header) => (
                    <th key={header} className="px-3 py-2.5 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {subBrokers.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                      {personName(row.firstName, row.lastName, row.email)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{row.email || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{row.phone || "—"}</td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setAppsSubBroker(row)}
                        title="View assigned applications"
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition hover:shadow-sm ${
                          (row.assignedApplications ?? 0) > 0
                            ? "border-emerald-300/50 bg-emerald-50 text-emerald-700 hover:border-emerald-400/60 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                            : "border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-300/40 hover:bg-emerald-50/60 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-emerald-950/30"
                        }`}
                      >
                        <FileText size={11} className="shrink-0 opacity-80" />
                        {row.assignedApplications ?? 0}
                        <ExternalLink size={10} className="shrink-0 opacity-70" />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={statusBadge(row.status)}>{row.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        data-sb-menu-trigger
                        title="More actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setSbMenuPos({ top: rect.bottom + 4, left: rect.right - 168 });
                          setActiveSbMenuId(activeSbMenuId === row.id ? null : row.id);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sbTotalPages > 1 && (
            <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <p className="text-[10px] text-slate-500">
                Page {sbPage} of {sbTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={sbPage <= 1 || sbLoading}
                  onClick={() => setSbPage((p) => Math.max(p - 1, 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700"
                >
                  <ChevronLeft size={13} />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={sbPage >= sbTotalPages || sbLoading}
                  onClick={() => setSbPage((p) => Math.min(p + 1, sbTotalPages))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700"
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderClients = () => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          View and manage clients for this broker organization.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Search name or email..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <p className="text-[10px] text-slate-400">
          {clientTotal} client{clientTotal === 1 ? "" : "s"}
          {debouncedClientSearch ? ` matching "${debouncedClientSearch}"` : ""}
        </p>
      </div>

      {clientsLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 py-16 text-xs text-slate-500 dark:border-slate-800">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading clients...
        </div>
      ) : !clients.length ? (
        <EmptyTab
          message={
            debouncedClientSearch
              ? `No clients found for "${debouncedClientSearch}".`
              : "No clients yet for this broker."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {["Client", "Entity", "Contact"].map((header) => (
                    <th key={header} className="px-3 py-2.5 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                  <th
                    className="px-3 py-2.5 whitespace-nowrap"
                    title="Click a count to view applications"
                  >
                    <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-400">
                      Apps
                      <ExternalLink size={10} className="opacity-80" />
                    </span>
                  </th>
                  {["Status", "Created", "Actions"].map((header) => (
                    <th key={header} className="px-3 py-2.5 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {clients.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                      {clientName(row)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {row.entityLabel || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {row.primaryContact?.email || row.primaryContact?.phone || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setAppsClient(row)}
                        title="View client applications"
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition hover:shadow-sm ${
                          (row.applicationsCount ?? 0) > 0
                            ? "border-cyan-300/50 bg-cyan-50 text-cyan-700 hover:border-cyan-400/60 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-950/60"
                            : "border-slate-200 bg-slate-50 text-slate-500 hover:border-cyan-300/40 hover:bg-cyan-50/60 hover:text-cyan-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-cyan-950/30"
                        }`}
                      >
                        <FileText size={11} className="shrink-0 opacity-80" />
                        {row.applicationsCount ?? 0}
                        <ExternalLink size={10} className="shrink-0 opacity-70" />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={statusBadge(row.isActive ? "ACTIVE" : "INACTIVE")}>
                        {row.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        data-client-menu-trigger
                        title="More actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setClientMenuPos({ top: rect.bottom + 4, left: rect.right - 168 });
                          setActiveClientMenuId(activeClientMenuId === row.id ? null : row.id);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {clientTotalPages > 1 && (
            <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <p className="text-[10px] text-slate-500">
                Page {clientPage} of {clientTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={clientPage <= 1 || clientsLoading}
                  onClick={() => setClientPage((p) => Math.max(p - 1, 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700"
                >
                  <ChevronLeft size={13} />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={clientPage >= clientTotalPages || clientsLoading}
                  onClick={() => setClientPage((p) => Math.min(p + 1, clientTotalPages))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700"
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderLenders = () => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Manage lenders connected to this broker organization.
        </p>
        <button
          type="button"
          onClick={() => setAssignLenderOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#13538A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0f426d]"
        >
          <Plus size={13} />
          Assign Lender
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={lenderSearch}
            onChange={(e) => setLenderSearch(e.target.value)}
            placeholder="Search lender name or email..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <p className="text-[10px] text-slate-400">
          {lenderTotal} lender{lenderTotal === 1 ? "" : "s"}
          {debouncedLenderSearch ? ` matching "${debouncedLenderSearch}"` : ""}
        </p>
      </div>

      {lendersLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 py-16 text-xs text-slate-500 dark:border-slate-800">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading lenders...
        </div>
      ) : !lenders.length ? (
        <EmptyTab
          message={
            debouncedLenderSearch
              ? `No lenders found for "${debouncedLenderSearch}".`
              : "No lenders assigned to this broker yet."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {["Lender", "Email", "Source", "Lender Status", "Connected", "Linked", "Actions"].map((header) => (
                    <th key={header} className="px-3 py-2.5 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lenders.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                      {row.lender?.name || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {row.lender?.email || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {formatLenderSource(row.source)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={statusBadge(row.lender?.status)}>
                        {row.lender?.status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={statusBadge(row.isActive ? "ACTIVE" : "INACTIVE")}>
                        {row.isActive ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        data-lender-menu-trigger
                        title="More actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setLenderMenuPos({ top: rect.bottom + 4, left: rect.right - 168 });
                          setActiveLenderMenuId(activeLenderMenuId === row.id ? null : row.id);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lenderTotalPages > 1 && (
            <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <p className="text-[10px] text-slate-500">
                Page {lenderPage} of {lenderTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={lenderPage <= 1 || lendersLoading}
                  onClick={() => setLenderPage((p) => Math.max(p - 1, 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700"
                >
                  <ChevronLeft size={13} />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={lenderPage >= lenderTotalPages || lendersLoading}
                  onClick={() => setLenderPage((p) => Math.min(p + 1, lenderTotalPages))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700"
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderApplications = () => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          View all loan applications submitted for this broker organization.
        </p>
        {appTotalAmount > 0 ? (
          <div className="rounded-lg border border-[#13538A]/20 bg-[#13538A]/5 px-3 py-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#13538A]/70">
              Total requested amount
            </p>
            <p className="text-sm font-bold text-[#13538A]">${appTotalAmount.toLocaleString()}</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={appSearch}
            onChange={(e) => setAppSearch(e.target.value)}
            placeholder="Search application #, borrower, product, status..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <p className="text-[10px] text-slate-400">
          {appTotal} application{appTotal === 1 ? "" : "s"}
          {debouncedAppSearch ? ` matching "${debouncedAppSearch}"` : ""}
        </p>
      </div>

      {applicationsLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 py-16 text-xs text-slate-500 dark:border-slate-800">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading applications...
        </div>
      ) : !applications.length ? (
        <EmptyTab
          message={
            debouncedAppSearch
              ? `No applications found for "${debouncedAppSearch}".`
              : "No applications yet for this broker."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="max-h-[58vh] overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/95 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {["Application", "Borrower", "Product", "Loan Amount Requested", "Status", "Created"].map((header) => (
                    <th key={header} className="px-3 py-2.5 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {applications.map((row) => (
                  <tr
                    key={row.applicationId}
                    className="cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    onClick={() => setViewApplicationId(row.applicationId)}
                  >
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewApplicationId(row.applicationId);
                        }}
                        className="group text-left"
                        title="View application details"
                      >
                        <p className="inline-flex items-center gap-1 font-semibold text-[#13538A] group-hover:underline">
                          {row.applicationNumber || row.applicationId}
                          <ExternalLink size={11} className="opacity-70" />
                        </p>
                        {row.purpose ? (
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">{row.purpose}</p>
                        ) : null}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-slate-800">
                          <User size={12} />
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          {row.borrowerName || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      <span className="line-clamp-2" title={row.loanProductCode || undefined}>
                        {formatProductCode(row.loanProductCode)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                      {row.amountRequested != null
                        ? `$${Number(row.amountRequested).toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={statusBadge(row.status)}>{row.status?.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {formatDate(row.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {appTotalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
              <p className="text-[10px] text-slate-500">
                Showing {(appPage - 1) * appLimit + 1}–{Math.min(appPage * appLimit, appTotal)} of {appTotal}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAppPage((current) => Math.max(current - 1, 1))}
                  disabled={appPage <= 1 || applicationsLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronLeft size={13} />
                  Prev
                </button>
                <span className="text-[10px] font-medium text-slate-500">
                  Page {appPage} of {appTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setAppPage((current) => Math.min(current + 1, appTotalPages))}
                  disabled={appPage >= appTotalPages || applicationsLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  const renderSubscription = () => {
    if (!subscription?.subscription) {
      return (
        <EmptyTab message="This broker does not have an active subscription assigned." />
      );
    }

    const sub = subscription.subscription;
    const price =
      sub.billingCycle === "YEARLY"
        ? sub.package.priceYearly
        : sub.package.priceMonthly;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Current Plan
          </h2>
          <p className="text-lg font-bold">{sub.package.name}</p>
          <p className="text-xs text-slate-500 mt-1">{sub.package.code}</p>
          <p className="mt-3 text-2xl font-extrabold text-[#13538A]">
            {formatPrice(price)}
            <span className="text-xs font-normal text-slate-500 ml-1">
              / {sub.billingCycle === "YEARLY" ? "year" : "month"}
            </span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={statusBadge(sub.status)}>{sub.status}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
              {sub.billingCycle}
            </span>
          </div>
          <InfoRow label="Started" value={formatDate(sub.currentPeriodStart)} />
          <InfoRow label="Renews" value={formatDate(sub.currentPeriodEnd)} />
          <InfoRow label="Trial ends" value={formatDate(sub.trialEndsAt)} />
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Recent History
          </h2>
          {(subscription.history || []).length === 0 ? (
            <p className="text-xs text-slate-500">No subscription history yet.</p>
          ) : (
            <div className="space-y-3">
              {subscription.history.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3"
                >
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100">
                    {item.package.name} · {item.status}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{formatDate(item.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    if (tabLoading && !["overview", "lenders", "contacts", "loan-officers", "sub-brokers", "clients", "applications"].includes(activeTab)) {
      return (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading {TABS.find((tab) => tab.key === activeTab)?.label.toLowerCase()}...
        </div>
      );
    }

    switch (activeTab) {
      case "overview":
        return renderOverview();
      case "contacts":
        return renderContacts();
      case "loan-officers":
        return renderLoanOfficers();
      case "sub-brokers":
        return renderSubBrokers();
      case "clients":
        return renderClients();
      case "lenders":
        return renderLenders();
      case "applications":
        return renderApplications();
      case "subscription":
        return renderSubscription();
      default:
        return null;
    }
  };

  return (
    <>
      <PageMeta
        title={`${resolveBrokerOrganizationName(broker)} | Broker Details`}
        description="Broker organization details"
      />

      <div className="px-4 sm:px-6 py-6 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen">
        <Link
          to="/all-brokers-database"
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-[#13538A] mb-4"
        >
          <ArrowLeft size={13} />
          Back to brokers
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#18B6B4] mb-0.5">
                Broker Organization
              </p>
              <h1 className="text-xl font-bold text-[#13538A] dark:text-indigo-400">
                {resolveBrokerOrganizationName(broker)}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {broker.email || "—"} ·{" "}
                {broker.phone ? formatContactPhoneValue(broker.phone) : "—"}
              </p>
              {primaryAdmin ? (
                <p className="text-[10px] text-slate-400 mt-1">
                  Primary admin: {personName(primaryAdmin.firstName, primaryAdmin.lastName)} ·{" "}
                  {primaryAdmin.email || "—"}
                </p>
              ) : null}
              <div className="mt-3">
                <span className={statusBadge(broker.status)}>{broker.status}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={loadAll}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap gap-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                    isActive
                      ? "bg-[#13538A] text-white ring-1 ring-[#13538A]/20"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md ${
                      isActive
                        ? "bg-white/15 text-white"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {renderTabContent()}
      </div>

      {editingBroker && (
        <EditBrokerModal
          isOpen={Boolean(editingBroker)}
          broker={editingBroker}
          onClose={() => setEditingBroker(null)}
          onSave={handleEditBrokerSave}
        />
      )}

      {activeMenuContact &&
        activeContactMenuId &&
        createPortal(
          <div
            ref={contactMenuRef}
            style={{ position: "fixed", top: contactMenuPos.top, left: contactMenuPos.left }}
            className="z-[1250] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-white">
                {personName(
                  activeMenuContact.firstName,
                  activeMenuContact.lastName,
                  activeMenuContact.email || undefined,
                )}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {activeMenuContact.email || activeMenuContact.companyName || "—"}
              </p>
            </div>

            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  closeContactMenu();
                  setViewContact(activeMenuContact);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Eye size={13} className="text-[#13538A]" />
                View details
              </button>
              <button
                type="button"
                onClick={() => {
                  closeContactMenu();
                  openEditContactModal(activeMenuContact);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Pencil size={13} className="text-amber-600" />
                Edit
              </button>
            </div>

            <div className="border-t border-slate-100 py-0.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  closeContactMenu();
                  handleDeleteContact(activeMenuContact);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>,
          document.body,
        )}

      {viewContact && (
        <ViewBrokerContactModal
          contact={viewContact}
          onClose={() => setViewContact(null)}
          formatContactType={formatContactType}
          formatDate={formatDate}
        />
      )}

      {activeMenuLoanOfficer &&
        activeLoMenuId &&
        createPortal(
          <div
            ref={loMenuRef}
            style={{ position: "fixed", top: loMenuPos.top, left: loMenuPos.left }}
            className="z-[1250] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-white">
                {personName(
                  activeMenuLoanOfficer.firstName,
                  activeMenuLoanOfficer.lastName,
                  activeMenuLoanOfficer.email,
                )}
              </p>
              <p className="truncate text-[10px] text-slate-500">{activeMenuLoanOfficer.email || "—"}</p>
            </div>
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  closeLoMenu();
                  setViewLoanOfficer(activeMenuLoanOfficer);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Eye size={13} className="text-[#13538A]" />
                View details
              </button>
              <button
                type="button"
                onClick={() => {
                  closeLoMenu();
                  openEditLoModal(activeMenuLoanOfficer);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Pencil size={13} className="text-amber-600" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  closeLoMenu();
                  openLoActivity(activeMenuLoanOfficer);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Activity size={13} className="text-violet-600" />
                View activity
              </button>
              <button
                type="button"
                onClick={() => {
                  closeLoMenu();
                  handleToggleLoStatus(activeMenuLoanOfficer);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Briefcase size={13} className="text-emerald-600" />
                {activeMenuLoanOfficer.status === "ACTIVE" ? "Disable" : "Activate"}
              </button>
            </div>
            <div className="border-t border-slate-100 py-0.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  closeLoMenu();
                  handleDeleteLoanOfficer(activeMenuLoanOfficer);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>,
          document.body,
        )}

      {activeMenuSubBroker &&
        activeSbMenuId &&
        createPortal(
          <div
            ref={sbMenuRef}
            style={{ position: "fixed", top: sbMenuPos.top, left: sbMenuPos.left }}
            className="z-[1250] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-white">
                {personName(
                  activeMenuSubBroker.firstName,
                  activeMenuSubBroker.lastName,
                  activeMenuSubBroker.email,
                )}
              </p>
              <p className="truncate text-[10px] text-slate-500">{activeMenuSubBroker.email || "—"}</p>
            </div>
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  closeSbMenu();
                  setViewSubBroker(activeMenuSubBroker);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Eye size={13} className="text-[#13538A]" />
                View details
              </button>
              <button
                type="button"
                onClick={() => {
                  closeSbMenu();
                  openEditSbModal(activeMenuSubBroker);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Pencil size={13} className="text-amber-600" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  closeSbMenu();
                  handleToggleSbStatus(activeMenuSubBroker);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <UsersRound size={13} className="text-emerald-600" />
                {activeMenuSubBroker.status === "ACTIVE" ? "Disable" : "Activate"}
              </button>
            </div>
            <div className="border-t border-slate-100 py-0.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  closeSbMenu();
                  handleDeleteSubBroker(activeMenuSubBroker);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>,
          document.body,
        )}

      {activeMenuClient &&
        activeClientMenuId &&
        createPortal(
          <div
            ref={clientMenuRef}
            style={{ position: "fixed", top: clientMenuPos.top, left: clientMenuPos.left }}
            className="z-[1250] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-white">
                {clientName(activeMenuClient)}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {activeMenuClient.primaryContact?.email || "—"}
              </p>
            </div>
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  closeClientMenu();
                  setViewClient(activeMenuClient);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Eye size={13} className="text-[#13538A]" />
                View details
              </button>
              <button
                type="button"
                onClick={() => {
                  closeClientMenu();
                  setAppsClient(activeMenuClient);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FileText size={13} className="text-cyan-600" />
                View applications
              </button>
              <button
                type="button"
                onClick={() => {
                  closeClientMenu();
                  handleToggleClientStatus(activeMenuClient);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Users size={13} className="text-emerald-600" />
                {activeMenuClient.isActive ? "Suspend" : "Activate"}
              </button>
            </div>
            <div className="border-t border-slate-100 py-0.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  closeClientMenu();
                  handleDeleteClient(activeMenuClient);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>,
          document.body,
        )}

      {activeMenuLender &&
        activeLenderMenuId &&
        createPortal(
          <div
            ref={lenderMenuRef}
            style={{ position: "fixed", top: lenderMenuPos.top, left: lenderMenuPos.left }}
            className="z-[1250] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-white">
                {activeMenuLender.lender?.name || "Lender"}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {activeMenuLender.lender?.email || "—"}
              </p>
            </div>
            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  closeLenderMenu();
                  setViewLender(activeMenuLender);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Eye size={13} className="text-[#13538A]" />
                View details
              </button>
              <button
                type="button"
                onClick={() => {
                  closeLenderMenu();
                  handleToggleLenderStatus(activeMenuLender);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Link2 size={13} className="text-emerald-600" />
                {activeMenuLender.isActive ? "Disconnect" : "Reconnect"}
              </button>
            </div>
            <div className="border-t border-slate-100 py-0.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  closeLenderMenu();
                  handleRemoveLender(activeMenuLender);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 size={13} />
                Remove
              </button>
            </div>
          </div>,
          document.body,
        )}

      {loActivityOpen && brokerId && (
        <LoanOfficerActivityModal
          brokerId={brokerId}
          initialOfficerId={loActivityOfficer?.id}
          initialOfficerName={
            loActivityOfficer
              ? personName(
                  loActivityOfficer.firstName,
                  loActivityOfficer.lastName,
                  loActivityOfficer.email,
                )
              : undefined
          }
          onClose={closeLoActivity}
        />
      )}

      {appsSubBroker && brokerId && (
        <SubBrokerAppsModal
          brokerId={brokerId}
          subBroker={appsSubBroker}
          onClose={() => setAppsSubBroker(null)}
          formatDate={formatDate}
          statusBadge={statusBadge}
        />
      )}

      {viewApplicationId && (
        <ApplicationDetailModal
          applicationId={viewApplicationId}
          onClose={() => setViewApplicationId(null)}
        />
      )}

      {appsClient && brokerId && (
        <ClientAppsModal
          brokerId={brokerId}
          client={appsClient}
          onClose={() => setAppsClient(null)}
          formatDate={formatDate}
          statusBadge={statusBadge}
        />
      )}

      {viewClient && brokerId && (
        <ViewBrokerClientModal
          brokerId={brokerId}
          client={viewClient}
          onClose={() => setViewClient(null)}
          formatDate={formatDate}
        />
      )}

      {viewLender && brokerId && (
        <ViewBrokerLenderModal
          brokerId={brokerId}
          access={viewLender}
          onClose={() => setViewLender(null)}
          formatDate={formatDate}
          formatSource={formatLenderSource}
        />
      )}

      {assignLenderOpen && brokerId && (
        <AssignBrokerLenderModal
          brokerId={brokerId}
          onClose={() => setAssignLenderOpen(false)}
          onAssigned={async () => {
            await loadLenders(lenderPage, debouncedLenderSearch);
            await loadCore();
          }}
        />
      )}

      {dealsOfficer && brokerId && (
        <LoanOfficerDealsModal
          brokerId={brokerId}
          officer={dealsOfficer}
          onClose={() => setDealsOfficer(null)}
          formatDate={formatDate}
          statusBadge={statusBadge}
        />
      )}

      {viewLoanOfficer && brokerId && (
        <ViewBrokerLoanOfficerModal
          brokerId={brokerId}
          officer={viewLoanOfficer}
          onClose={() => setViewLoanOfficer(null)}
          formatDate={formatDate}
          formatLastLogin={formatLastLogin}
        />
      )}

      {brokerId ? (
        <BrokerLoanOfficerModal
          isOpen={loModalOpen}
          mode={loModalMode}
          brokerId={brokerId}
          officerId={editingLoId}
          onClose={closeLoModal}
          onSaved={() => loadLoanOfficers(loPage, debouncedLoSearch)}
        />
      ) : null}

      {viewSubBroker && brokerId && (
        <ViewBrokerSubBrokerModal
          brokerId={brokerId}
          subBroker={viewSubBroker}
          onClose={() => setViewSubBroker(null)}
          formatDate={formatDate}
          formatLastLogin={formatLastLogin}
        />
      )}

      {brokerId ? (
        <BrokerSubBrokerModal
          isOpen={sbModalOpen}
          mode={sbModalMode}
          brokerId={brokerId}
          subBrokerId={editingSbId}
          onClose={closeSbModal}
          onSaved={() => loadSubBrokers(sbPage, debouncedSbSearch)}
        />
      ) : null}

      {contactModalOpen && (
        <div className="fixed inset-0 z-[999999999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {contactModalMode === "create" ? "Add Contact" : "Edit Contact"}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Broker organization contact record.
                </p>
              </div>
              <button
                type="button"
                onClick={closeContactModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="px-5 py-4">
              {contactFormError ? (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                  {contactFormError}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ContactFormField label="Contact type" required error={contactFormErrors.contactType}>
                  <select
                    value={contactForm.contactType}
                    onChange={(e) =>
                      updateContactField("contactType", e.target.value as BrokerContactInput["contactType"])
                    }
                    className={contactInputClass(Boolean(contactFormErrors.contactType))}
                  >
                    {BROKER_CONTACT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {formatContactType(type)}
                      </option>
                    ))}
                  </select>
                </ContactFormField>

                <ContactFormField label="First name" required error={contactFormErrors.firstName}>
                  <input
                    value={contactForm.firstName || ""}
                    onChange={(e) => updateContactField("firstName", e.target.value)}
                    placeholder="Enter first name"
                    className={contactInputClass(Boolean(contactFormErrors.firstName))}
                  />
                </ContactFormField>

                <ContactFormField label="Last name" required error={contactFormErrors.lastName}>
                  <input
                    value={contactForm.lastName || ""}
                    onChange={(e) => updateContactField("lastName", e.target.value)}
                    placeholder="Enter last name"
                    className={contactInputClass(Boolean(contactFormErrors.lastName))}
                  />
                </ContactFormField>

                <ContactFormField label="Email" required error={contactFormErrors.email}>
                  <input
                    type="email"
                    value={contactForm.email || ""}
                    onChange={(e) => updateContactField("email", e.target.value)}
                    placeholder="Enter email"
                    className={contactInputClass(Boolean(contactFormErrors.email))}
                  />
                </ContactFormField>

                <ContactFormField label="Company name" required error={contactFormErrors.companyName}>
                  <input
                    value={contactForm.companyName || ""}
                    onChange={(e) => updateContactField("companyName", e.target.value)}
                    placeholder="Enter company name"
                    className={contactInputClass(Boolean(contactFormErrors.companyName))}
                  />
                </ContactFormField>

                <ContactFormField label="Website" required error={contactFormErrors.website}>
                  <input
                    value={contactForm.website || ""}
                    onChange={(e) => updateContactField("website", e.target.value)}
                    placeholder="Enter website"
                    className={contactInputClass(Boolean(contactFormErrors.website))}
                  />
                </ContactFormField>

                <ContactFormField label="Phone" required error={contactFormErrors.phone}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={contactForm.phone || ""}
                    onChange={(e) => updateContactField("phone", e.target.value)}
                    placeholder="123-456-7890"
                    className={contactInputClass(Boolean(contactFormErrors.phone))}
                  />
                </ContactFormField>

                <ContactFormField label="Cell number" required error={contactFormErrors.cellNumber}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={contactForm.cellNumber || ""}
                    onChange={(e) => updateContactField("cellNumber", e.target.value)}
                    placeholder="Enter cell number"
                    className={contactInputClass(Boolean(contactFormErrors.cellNumber))}
                  />
                </ContactFormField>

                <ContactFormField label="Toll free" required error={contactFormErrors.tollFree}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={contactForm.tollFree || ""}
                    onChange={(e) => updateContactField("tollFree", e.target.value)}
                    placeholder="Enter toll free"
                    className={contactInputClass(Boolean(contactFormErrors.tollFree))}
                  />
                </ContactFormField>

                <ContactFormField label="Fax number" required error={contactFormErrors.faxNumber}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={contactForm.faxNumber || ""}
                    onChange={(e) => updateContactField("faxNumber", e.target.value)}
                    placeholder="Enter fax number"
                    className={contactInputClass(Boolean(contactFormErrors.faxNumber))}
                  />
                </ContactFormField>

                <ContactFormField label="Address" required error={contactFormErrors.address}>
                  <input
                    value={contactForm.address || ""}
                    onChange={(e) => updateContactField("address", e.target.value)}
                    placeholder="Enter address"
                    className={contactInputClass(Boolean(contactFormErrors.address))}
                  />
                </ContactFormField>

                <ContactFormField label="City" required error={contactFormErrors.city}>
                  <input
                    value={contactForm.city || ""}
                    onChange={(e) => updateContactField("city", e.target.value)}
                    placeholder="Enter city"
                    className={contactInputClass(Boolean(contactFormErrors.city))}
                  />
                </ContactFormField>

                <ContactFormField label="State" required error={contactFormErrors.state}>
                  <select
                    value={contactForm.state || ""}
                    onChange={(e) => updateContactField("state", e.target.value)}
                    className={contactInputClass(Boolean(contactFormErrors.state))}
                  >
                    <option value="">Select</option>
                    {CONTACT_US_STATES.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </ContactFormField>

                <ContactFormField label="Zip code" required error={contactFormErrors.zipCode}>
                  <input
                    inputMode="numeric"
                    value={contactForm.zipCode || ""}
                    onChange={(e) => updateContactField("zipCode", e.target.value)}
                    placeholder="Enter zip code"
                    className={contactInputClass(Boolean(contactFormErrors.zipCode))}
                  />
                </ContactFormField>

                <ContactFormField label="State of formation" required error={contactFormErrors.stateOfFormation}>
                  <select
                    value={contactForm.stateOfFormation || ""}
                    onChange={(e) => updateContactField("stateOfFormation", e.target.value)}
                    className={contactInputClass(Boolean(contactFormErrors.stateOfFormation))}
                  >
                    <option value="">Select</option>
                    {CONTACT_US_STATES.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </ContactFormField>

                <ContactFormField label="Entity type" required error={contactFormErrors.entityType}>
                  <select
                    value={contactForm.entityType || ""}
                    onChange={(e) => updateContactField("entityType", e.target.value)}
                    className={contactInputClass(Boolean(contactFormErrors.entityType))}
                  >
                    <option value="">Select</option>
                    {CONTACT_ENTITY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </ContactFormField>

                <div className="sm:col-span-2">
                  <ContactFormField label="Description" error={contactFormErrors.description}>
                    <textarea
                      value={contactForm.description || ""}
                      onChange={(e) => updateContactField("description", e.target.value)}
                      rows={5}
                      placeholder="Enter description"
                      className={contactInputClass(Boolean(contactFormErrors.description))}
                    />
                  </ContactFormField>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeContactModal}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contactSaving}
                  className="rounded-lg bg-[#13538A] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {contactSaving
                    ? "Saving..."
                    : contactModalMode === "create"
                      ? "Create Contact"
                      : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
