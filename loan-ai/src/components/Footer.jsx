import { FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { useAuth } from "../context/AuthContext";
import { getCtaSectionTitle } from "../lib/authCta";
import LoanAutomationLogo from "./LoanAutomationLogo";
import MarketingCtaButtons from "./MarketingCtaButtons";

const SOCIAL = [
  { Icon: FaFacebookF, label: "Facebook" },
  { Icon: FaXTwitter, label: "X" },
  { Icon: FaLinkedinIn, label: "LinkedIn" },
];

const LEGAL = [
  "Privacy Policy",
  "Terms of Use",
  "Electronic Disclosures",
  "Referral Program",
];

const COMPANY = ["Resources", "FAQ", "Help", "About Us"];

const Footer = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const auth = {
    isAuthenticated,
    hasBrokerSubscription: Boolean(user?.hasBrokerSubscription),
  };

  return (
    <footer
      id="contact"
      className="scroll-mt-24 relative overflow-hidden border-t border-white/10 bg-black px-6 py-20 text-gray-300"
    >
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#4B83FF]/15 blur-[100px]"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 md:grid-cols-4">
        <div>
          <LoanAutomationLogo size="md" className="mb-5" />
          <p className="mb-6 text-sm leading-relaxed text-gray-400">
            Smart lending automation built for commercial mortgage brokers —
            match lenders, collect docs, and close faster.
          </p>

          <div className="mb-6 flex gap-3">
            {SOCIAL.map(({ Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition hover:scale-110 hover:border-[#4B83FF]/40 hover:bg-[#4B83FF]/10"
              >
                <Icon size={14} />
              </a>
            ))}
          </div>

          <p className="text-sm leading-relaxed text-gray-400">
            66 Franklin Street, Norwich, CT 06360
            <br />
            <a
              href="mailto:contact@loanai.com"
              className="underline decoration-white/20 underline-offset-2 transition hover:text-white"
            >
              contact@loanai.com
            </a>
            <br />
            <a href="tel:8555960900" className="transition hover:text-white">
              855-596-0900
            </a>
          </p>
        </div>

        <div>
          <h4 className="mb-4 font-semibold text-white">Legal</h4>
          <ul className="space-y-3 text-sm">
            {LEGAL.map((item) => (
              <li key={item}>
                <span className="cursor-pointer transition hover:text-white">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-semibold text-white">Company</h4>
          <ul className="space-y-3 text-sm">
            {COMPANY.map((item) => (
              <li key={item}>
                <span className="cursor-pointer transition hover:text-white">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-semibold text-white">
            {loading ? "Get Started" : getCtaSectionTitle(auth)}
          </h4>

          {!loading && isAuthenticated && (
            <p className="mb-4 text-sm text-gray-400">
              {user?.hasBrokerSubscription
                ? "Manage your brokerage from the dashboard."
                : "Finish subscription to unlock your broker dashboard."}
            </p>
          )}

          <MarketingCtaButtons variant="footer" />
        </div>
      </div>

      <div className="relative mx-auto mt-14 max-w-6xl border-t border-white/10 pt-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Loan Automation · Vibrantick Infotech
        Solutions
      </div>
    </footer>
  );
};

export default Footer;
