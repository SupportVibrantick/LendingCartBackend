import { Link } from "react-router";

interface BreadcrumbProps {
  pageTitle: string;
  pageDescription?: string;
}

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({
  pageTitle,
  pageDescription,
}) => {
  return (
    <div className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="ds-page-title">{pageTitle}</h2>
        {pageDescription ? (
          <p className="ds-page-subtitle">{pageDescription}</p>
        ) : null}
      </div>
      <nav className="min-w-0 shrink-0 pt-1">
        <ol className="flex items-center gap-1">
          <li>
            <Link
              className="inline-flex items-center gap-1 text-[12px] text-text-secondary transition hover:text-brand-500"
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
          <li className="truncate text-[12px] font-medium text-text-primary">
            {pageTitle}
          </li>
        </ol>
      </nav>
    </div>
  );
};

export default PageBreadcrumb;
