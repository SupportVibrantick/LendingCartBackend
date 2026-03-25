import { FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

const Footer = () => {
  return (
    <footer
      id="contact"
      className="scroll-mt-24 bg-[#1e1e1e] text-gray-300 py-16 px-5"
    >
      <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-10">
        {/* Left Section */}
        <div>
          <h2 className="text-white text-xl font-semibold mb-4">
            Lending Automator
          </h2>

          {/* Social Icons */}
          <div className="flex gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 cursor-pointer">
              <FaFacebookF />
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 cursor-pointer">
              <FaXTwitter />
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 cursor-pointer">
              <FaLinkedinIn />
            </div>
          </div>

          {/* Address */}
          <p className="text-sm leading-relaxed">
            66 Franklin Street, Norwich, CT 06360 <br />
            <span className="underline cursor-pointer">
              contact@lendingautomator.com
            </span>
            <br />
            855-596-0900
          </p>
        </div>

        {/* Links 1 */}
        <div>
          <ul className="space-y-3 text-sm">
            <li className="hover:text-white cursor-pointer">Privacy Policy</li>
            <li className="hover:text-white cursor-pointer">Terms of Use</li>
            <li className="hover:text-white cursor-pointer">
              Electronic Disclosures
            </li>
            <li className="hover:text-white cursor-pointer">
              Referral Program
            </li>
          </ul>
        </div>

        {/* Links 2 */}
        <div>
          <ul className="space-y-3 text-sm">
            <li className="hover:text-white cursor-pointer">Resources</li>
            <li className="hover:text-white cursor-pointer">FAQ</li>
            <li className="hover:text-white cursor-pointer">Help</li>
            <li className="hover:text-white cursor-pointer">About Us</li>
          </ul>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-4">
          <button className="bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition">
            Register Now
          </button>

          <button className="bg-blue-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-800 transition">
            Book a Demo
          </button>
        </div>
      </div>

      {/* Bottom Line */}
      <div className="border-t border-white/10 mt-12 pt-6 text-center text-sm text-gray-400">
        © 2026 by Vibrantick Infotech Solutions
      </div>
    </footer>
  );
};

export default Footer;
