import { Link } from "react-router-dom";

const LoanAutomationLogo = ({
  to = "/",
  showText = true,
  size = "md",
  className = "",
}) => {
  const sizes = {
    sm: { image: "h-8 w-8", title: "text-sm", subtitle: "text-[10px]" },
    md: { image: "h-10 w-10", title: "text-base", subtitle: "text-[11px]" },
    lg: { image: "h-12 w-12", title: "text-lg", subtitle: "text-xs" },
  };

  const s = sizes[size] || sizes.md;

  const content = (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`${s.image} shrink-0 overflow-hidden rounded-full ring-2 ring-white/20 shadow-lg shadow-blue-500/20`}
      >
        <img
          src="/loanAutomation.jpeg"
          alt="Loan Automation"
          className="h-full w-full object-cover"
        />
      </div>

      {showText && (
        <div className="min-w-0 text-left">
          <p className={`truncate font-semibold text-white tracking-wide ${s.title}`}>
            Loan Automation
          </p>
          <p className={`truncate text-white/60 ${s.subtitle}`}>Loan AI</p>
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
};

export default LoanAutomationLogo;
