import { useAuth } from "../context/AuthContext";
import { getAuthenticatedHeroMessage } from "../lib/authCta";
import MarketingCtaButtons from "./MarketingCtaButtons";

const Hero = () => {
  const { isAuthenticated, user, loading } = useAuth();

  return (
    <section className="relative overflow-hidden bg-[#0b0f2a] text-white py-28 px-6">
      <div className="absolute inset-0">
        <div className="absolute -top-37.5 left-1/2 -translate-x-1/2 w-175 h-175 bg-indigo-500/20 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-25 -right-25 w-125 h-125 bg-blue-500/20 blur-[100px] rounded-full"></div>
      </div>

      <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-size-[40px_40px]"></div>

      <div className="relative max-w-5xl mx-auto text-center">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-sm backdrop-blur-md">
          {isAuthenticated && !loading
            ? user?.hasBrokerSubscription
              ? "Welcome back"
              : "Signed in"
            : "Smart Lending Platform"}
        </div>

        <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
          Your Lending,{" "}
          <span className="bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Fully Automated
          </span>
        </h1>

        <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto mb-12">
          {isAuthenticated && !loading
            ? getAuthenticatedHeroMessage(user)
            : "Simplify loan workflows, match lenders instantly, and boost efficiency with powerful automation."}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            "Accept Applications Online",
            "Instant Lender Matching",
            "One-Click Quotes",
            "Automated Follow-ups",
          ].map((item, i) => (
            <div
              key={i}
              className="group bg-white/5 hover:bg-white/10 transition backdrop-blur-xl border border-white/10 rounded-xl px-4 py-4 text-sm md:text-base"
            >
              <p className="group-hover:scale-105 transition">{item}</p>
            </div>
          ))}
        </div>

        <MarketingCtaButtons variant="hero" />
      </div>
    </section>
  );
};

export default Hero;
