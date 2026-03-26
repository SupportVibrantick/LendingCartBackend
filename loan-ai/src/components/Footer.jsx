import { FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

const Footer = () => {
  return (
    <footer
      id="contact"
      className="scroll-mt-24 relative bg-[#0b0f2a] text-gray-300 py-20 px-6 overflow-hidden"
    >
      {/* Glow */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/20 blur-[120px] rounded-full"></div>

      <div className="relative max-w-6xl mx-auto grid md:grid-cols-4 gap-12">

        {/* Left Section */}
        <div>
          <h2 className="text-white text-2xl font-semibold mb-4">
            Loan AI
          </h2>

          <p className="text-gray-400 text-sm mb-6">
            Smart lending automation platform built for brokers.
          </p>

          {/* Social Icons */}
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

          {/* Address */}
          <p className="text-sm text-gray-400 leading-relaxed">
            66 Franklin Street, Norwich, CT 06360 <br />
            <span className="underline cursor-pointer hover:text-white">
              contact@loanai.com
            </span>
            <br />
            855-596-0900
          </p>
        </div>

        {/* Links 1 */}
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

        {/* Links 2 */}
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

        {/* CTA */}
        <div>
          <h4 className="text-white font-semibold mb-4">Get Started</h4>

          <div className="flex flex-col gap-4">
            <button className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:scale-105 hover:shadow-blue-500/30 transition">
              Register Now
            </button>

            <button className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-xl hover:bg-white/20 transition">
              Book a Demo
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Line */}
      <div className="border-t border-white/10 mt-14 pt-6 text-center text-sm text-gray-400">
        © 2026 by Vibrantick Infotech Solutions
      </div>
    </footer>
  );
};

export default Footer;