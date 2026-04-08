import { Check } from "lucide-react";

const Pricing = () => {
  const features = [
    "Unlimited Applications",
    "Virtual Processor™ Automation",
    "No Long-Term Contracts",
    "No Setup Fees",
  ];

  return (
    <section
      id="pricing"
      className="scroll-mt-24 bg-[#0b0f2a] py-28 px-6 relative overflow-hidden"
    >
      {/* Glow */}
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/20 blur-[120px] rounded-full"></div>

      <div className="relative max-w-5xl mx-auto text-center">

        {/* Heading */}
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
          Simple{" "}
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Pricing
          </span>
        </h2>

        <p className="text-gray-300 mb-16">
          One plan. No hidden fees. Everything included.
        </p>

        {/* Pricing Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 max-w-xl mx-auto shadow-[0_20px_80px_rgba(0,0,0,0.7)]">

          {/* Price */}
          <h3 className="text-white text-4xl md:text-5xl font-bold mb-4">
            $99<span className="text-lg text-gray-400">/month</span>
          </h3>

          <p className="text-gray-400 mb-8">
            Per user — no extra charges
          </p>

          {/* Features */}
          <div className="space-y-4 text-left mb-10">
            {features.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <Check className="text-blue-400" size={18} />
                <span className="text-gray-200 text-sm md:text-base">
                  {item}
                </span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:scale-105 hover:shadow-blue-500/30 transition">
              Get Started
            </button>

            <button className="w-full bg-white/10 border border-white/20 text-white py-3 rounded-xl hover:bg-white/20 transition">
              Book Demo
            </button>
          </div>
        </div>

        {/* Bottom Note */}
        <p className="text-gray-400 text-sm mt-6">
          No contracts. Cancel anytime.
        </p>
      </div>
    </section>
  );
};

export default Pricing;