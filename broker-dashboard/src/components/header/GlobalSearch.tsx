import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useNavigate } from "react-router";
import {
  Building2,
  FileText,
  Loader2,
  Search,
  UserCircle,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";
import {
  runGlobalSearch,
  type GlobalSearchApplication,
  type GlobalSearchClient,
  type GlobalSearchContact,
  type GlobalSearchLender,
  type GlobalSearchPerson,
  type GlobalSearchViewAllSection,
} from "../../lib/globalSearch";

type SearchResultItem =
  | GlobalSearchPerson
  | GlobalSearchClient
  | GlobalSearchContact
  | GlobalSearchLender
  | GlobalSearchApplication;

type SearchItem =
  | SearchResultItem
  | {
      kind: "view-all";
      section: GlobalSearchViewAllSection;
      id: string;
      label: string;
    };

type GlobalSearchContextValue = {
  query: string;
  setQuery: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  loading: boolean;
  items: SearchItem[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  registerFocus: (ref: RefObject<HTMLInputElement | null>) => void;
  focusedRef: RefObject<HTMLInputElement | null> | null;
  selectItem: (item: SearchItem) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(null);

function useGlobalSearchContext() {
  const ctx = useContext(GlobalSearchContext);
  if (!ctx) {
    throw new Error("GlobalSearchField must be used within GlobalSearchProvider");
  }
  return ctx;
}

const SECTION_ORDER: GlobalSearchViewAllSection[] = [
  "applications",
  "clients",
  "contacts",
  "subBrokers",
  "loanOfficers",
  "lenders",
];

const SECTION_LABELS: Record<GlobalSearchViewAllSection, string> = {
  subBrokers: "Sub Brokers",
  loanOfficers: "Loan Officers",
  clients: "Clients",
  contacts: "Contacts",
  lenders: "Lenders",
  applications: "Pipeline",
};

const VIEW_ALL_LABELS: Record<GlobalSearchViewAllSection, string> = {
  subBrokers: "View all sub brokers",
  loanOfficers: "View all loan officers",
  clients: "View all clients in pipeline",
  contacts: "View all contacts",
  lenders: "View all lenders",
  applications: "View all pipeline results",
};

function getItemSection(item: SearchResultItem): GlobalSearchViewAllSection {
  if (item.kind === "subBroker") return "subBrokers";
  if (item.kind === "loanOfficer") return "loanOfficers";
  if (item.kind === "client") return "clients";
  if (item.kind === "contact") return "contacts";
  if (item.kind === "lender") return "lenders";
  return "applications";
}

function buildItems(
  results: Awaited<ReturnType<typeof runGlobalSearch>>,
  query: string,
): SearchItem[] {
  const grouped: Record<GlobalSearchViewAllSection, SearchResultItem[]> = {
    subBrokers: results.subBrokers,
    loanOfficers: results.loanOfficers,
    clients: results.clients,
    contacts: results.contacts,
    lenders: results.lenders,
    applications: results.applications,
  };

  const items: SearchItem[] = [];

  for (const section of SECTION_ORDER) {
    const sectionItems = grouped[section];
    if (!sectionItems.length) continue;

    items.push(...sectionItems);
    items.push({
      kind: "view-all",
      section,
      id: `view-all-${section}`,
      label: `${VIEW_ALL_LABELS[section]} for "${query}"`,
    });
  }

  return items;
}

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof runGlobalSearch>>>(
    () => ({
      subBrokers: [],
      loanOfficers: [],
      clients: [],
      contacts: [],
      lenders: [],
      applications: [],
    }),
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focusedRef, setFocusedRef] =
    useState<RefObject<HTMLInputElement | null> | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults({
        subBrokers: [],
        loanOfficers: [],
        clients: [],
        contacts: [],
        lenders: [],
        applications: [],
      });
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    runGlobalSearch(debouncedQuery, 5)
      .then((next) => {
        if (requestId !== requestIdRef.current) return;
        setResults(next);
        setActiveIndex(-1);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      });
  }, [debouncedQuery]);

  const items = useMemo(
    () => buildItems(results, debouncedQuery),
    [results, debouncedQuery],
  );

  const navigateToSection = useCallback(
    (section: GlobalSearchViewAllSection, q: string) => {
      const encoded = encodeURIComponent(q);
      switch (section) {
        case "subBrokers":
          navigate(`/sub-brokers?q=${encoded}`);
          break;
        case "loanOfficers":
          navigate(`/loan-officers?q=${encoded}`);
          break;
        case "clients":
        case "applications":
          navigate(`/submit-applications?q=${encoded}`);
          break;
        case "contacts":
          navigate(`/contacts-list?q=${encoded}`);
          break;
        case "lenders":
          navigate(`/find-lenders?q=${encoded}`);
          break;
      }
    },
    [navigate],
  );

  const selectItem = useCallback(
    (item: SearchItem) => {
      const q = debouncedQuery || query.trim();
      const encoded = encodeURIComponent(q);

      if (item.kind === "view-all") {
        navigateToSection(item.section, q);
      } else if (item.kind === "subBroker") {
        navigate(`/sub-brokers?q=${encoded}`);
      } else if (item.kind === "loanOfficer") {
        navigate(`/loan-officers?q=${encoded}`);
      } else if (item.kind === "client") {
        if (item.submissionId) {
          navigate("/loan-preview", { state: { submissionId: item.submissionId } });
        } else {
          navigate(`/submit-applications?q=${encodeURIComponent(item.label || q)}`);
        }
      } else if (item.kind === "contact") {
        navigate(`/contacts-list?q=${encoded}`);
      } else if (item.kind === "lender") {
        navigate(
          item.isConnected
            ? `/my-lenders?q=${encoded}`
            : `/find-lenders?q=${encoded}`,
        );
      } else if (item.kind === "application") {
        navigate("/loan-preview", { state: { submissionId: item.submissionId } });
      }

      setIsOpen(false);
      setQuery("");
      setDebouncedQuery("");
      focusedRef?.current?.blur();
    },
    [debouncedQuery, focusedRef, navigate, navigateToSection, query],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen && event.key !== "Escape") return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!items.length) return;
        setActiveIndex((prev) => (prev + 1) % items.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!items.length) return;
        setActiveIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          selectItem(items[activeIndex]);
          return;
        }
        if (debouncedQuery) {
          navigateToSection("applications", debouncedQuery);
          setIsOpen(false);
          setQuery("");
          setDebouncedQuery("");
          focusedRef?.current?.blur();
        }
        return;
      }

      if (event.key === "Escape") {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    },
    [
      activeIndex,
      debouncedQuery,
      focusedRef,
      isOpen,
      items,
      navigateToSection,
      selectItem,
    ],
  );

  const registerFocus = useCallback(
    (ref: RefObject<HTMLInputElement | null>) => {
      setFocusedRef(ref);
    },
    [],
  );

  const value = useMemo(
    () => ({
      query,
      setQuery,
      isOpen,
      setIsOpen,
      loading,
      items,
      activeIndex,
      setActiveIndex,
      registerFocus,
      focusedRef,
      selectItem,
      handleKeyDown,
    }),
    [
      query,
      isOpen,
      loading,
      items,
      activeIndex,
      registerFocus,
      focusedRef,
      selectItem,
      handleKeyDown,
    ],
  );

  return (
    <GlobalSearchContext.Provider value={value}>
      {children}
    </GlobalSearchContext.Provider>
  );
}

function ResultIcon({ kind }: { kind: SearchItem["kind"] }) {
  switch (kind) {
    case "subBroker":
      return <UsersRound size={15} className="shrink-0 text-orange-600" />;
    case "loanOfficer":
      return <UserCog size={15} className="shrink-0 text-sky-600" />;
    case "client":
      return <UserCircle size={15} className="shrink-0 text-indigo-600" />;
    case "contact":
      return <Users size={15} className="shrink-0 text-emerald-600" />;
    case "lender":
      return <Building2 size={15} className="shrink-0 text-[#13538A]" />;
    case "application":
      return <FileText size={15} className="shrink-0 text-slate-600" />;
    default:
      return <Search size={15} className="shrink-0 text-gray-400" />;
  }
}

function SearchResultsDropdown() {
  const { query, isOpen, loading, items, activeIndex, selectItem } =
    useGlobalSearchContext();

  if (!isOpen || !query.trim()) return null;

  const hasResults = items.length > 0;

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[1000] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
      {loading && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          Searching...
        </div>
      )}

      {!loading && !hasResults && (
        <div className="px-4 py-6 text-center text-sm text-gray-500">
          No results for &ldquo;{query.trim()}&rdquo;
          <p className="mt-1 text-xs text-gray-400">
            Try a borrower name, app number, contact, or team member
          </p>
        </div>
      )}

      {!loading && hasResults && (
        <ul className="max-h-[min(480px,65vh)] overflow-y-auto py-1">
          {renderGroupedItems(items, activeIndex, selectItem)}
        </ul>
      )}
    </div>
  );
}

function renderGroupedItems(
  items: SearchItem[],
  activeIndex: number,
  selectItem: (item: SearchItem) => void,
) {
  const seenSections = new Set<GlobalSearchViewAllSection>();
  const nodes: React.ReactNode[] = [];

  items.forEach((item, index) => {
    const isViewAll = item.kind === "view-all";

    if (!isViewAll) {
      const section = getItemSection(item);
      if (!seenSections.has(section)) {
        seenSections.add(section);
        nodes.push(
          <li
            key={`heading-${section}`}
            className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400"
          >
            {SECTION_LABELS[section]}
          </li>,
        );
      }
    }

    nodes.push(
      <li key={isViewAll ? item.id : `${item.kind}-${item.id}`}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => selectItem(item)}
          className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition ${
            index === activeIndex
              ? "bg-[#13538A]/8 dark:bg-[#13538A]/20"
              : "hover:bg-gray-50 dark:hover:bg-gray-800/80"
          } ${isViewAll ? "border-t border-gray-100 text-xs font-medium text-[#13538A] dark:border-gray-800" : ""}`}
        >
          {!isViewAll && <ResultIcon kind={item.kind} />}
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate ${isViewAll ? "" : "text-sm font-medium text-gray-900 dark:text-white"}`}
            >
              {!isViewAll && item.kind === "lender" && item.isConnected
                ? `${item.label} · Connected`
                : item.label}
            </span>
            {!isViewAll && item.subtitle && (
              <span className="mt-0.5 block truncate text-xs text-gray-500">
                {item.subtitle}
              </span>
            )}
          </span>
        </button>
      </li>,
    );
  });

  return nodes;
}

export function GlobalSearchField({
  inputRef,
  className = "",
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    query,
    setQuery,
    isOpen,
    setIsOpen,
    registerFocus,
    focusedRef,
    handleKeyDown,
  } = useGlobalSearchContext();

  const showDropdown = isOpen && focusedRef === inputRef;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        if (focusedRef === inputRef) {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [focusedRef, inputRef, setIsOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search pipeline, contacts, lenders, team..."
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          registerFocus(inputRef);
          if (query.trim()) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="h-10 w-full rounded-xl border border-gray-200/90 bg-gray-50/90 pl-10 pr-12 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-[#13538A]/35 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-800/90 dark:text-white dark:focus:bg-gray-900"
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:border-gray-600 dark:bg-gray-800 sm:inline-flex">
        ⌘K
      </kbd>
      {showDropdown && <SearchResultsDropdown />}
    </div>
  );
}
