import { Link } from "react-router";

interface BreadcrumbProps {
  pageTitle: string;
}

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({ pageTitle }) => {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
      <h2 className="min-w-0 truncate text-base font-semibold text-gray-800 dark:text-white/90">
        {pageTitle}
      </h2>
      <nav className="min-w-0 shrink-0">
        <ol className="flex items-center gap-1">
          <li>
            <Link
              className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"
              to="/"
            >
              Home
              <svg
                className="stroke-current"
                width="14"
                height="14"
                viewBox="0 0 17 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                  stroke=""
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </li>
          <li className="truncate text-xs text-gray-800 dark:text-white/90">
            {pageTitle}
          </li>
        </ol>
      </nav>
    </div>
  );
};

export default PageBreadcrumb;
