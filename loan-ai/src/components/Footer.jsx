import { FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { useAuth } from "../context/AuthContext";
import { getCtaSectionTitle } from "../lib/authCta";
import MarketingCtaButtons from "./MarketingCtaButtons";

const Footer = () => {
  const { isAuthenticated, user, loading } = useAuth();

  const auth = {
    isAuthenticated,
    hasBrokerSubscription: Boolean(user?.hasBrokerSubscription),
  };

  return (
    <footer
      id="contact"
      className="scroll-mt-24 relative bg-[#0b0f2a] text-gray-300 py-20 px-6 overflow-hidden"
    >
      <div className="absolute -top-25 left-1/2 -translate-x-1/2 w-125 h-125 bg-indigo-500/20 blur-[120px] rounded-full"></div>

      <div className="relative max-w-6xl mx-auto grid md:grid-cols-4 gap-12">
        <div>
          <h2 className="text-white text-2xl font-semibold mb-4">Loan AI</h2>

          <p className="text-gray-400 text-sm mb-6">
            Smart lending automation platform built for brokers.
          </p>

          <div className="flex gap-4 mb-6">
            {[FaFacebookF, FaXTwitter, FaLinkedinIn].map((Icon, i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:scale-110 transition cursor-pointer"
              >
                <Icon />
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-400 leading-relaxed">
            66 Franklin Street, Norwich, CT 06360 <br />
            <span className="underline cursor-pointer hover:text-white">
              contact@loanai.com
            </span>
            <br />
            855-596-0900
          </p>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4">Legal</h4>
          <ul className="space-y-3 text-sm">
            {[
              "Privacy Policy",
              "Terms of Use",
              "Electronic Disclosures",
              "Referral Program",
            ].map((item, i) => (
              <li
                key={i}
                className="hover:text-white transition cursor-pointer"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4">Company</h4>
          <ul className="space-y-3 text-sm">
            {["Resources", "FAQ", "Help", "About Us"].map((item, i) => (
              <li
                key={i}
                className="hover:text-white transition cursor-pointer"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4">
            {loading ? "Get Started" : getCtaSectionTitle(auth)}
          </h4>

          {!loading && isAuthenticated && (
            <p className="text-sm text-gray-400 mb-4">
              {user?.hasBrokerSubscription
                ? "Manage your brokerage from the dashboard."
                : "Finish subscription to unlock your broker dashboard."}
            </p>
          )}

          <MarketingCtaButtons variant="footer" />
        </div>
      </div>

      <div className="border-t border-white/10 mt-14 pt-6 text-center text-sm text-gray-400">
        © 2026 by Vibrantick Infotech Solutions
      </div>
    </footer>
  );
};

export default Footer;
