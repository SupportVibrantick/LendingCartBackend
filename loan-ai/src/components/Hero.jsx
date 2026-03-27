const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-[#0b0f2a] text-white py-28 px-6">
      
      {/* Gradient Background Glow */}
      <div className="absolute inset-0">
        <div className="absolute top-[-150px] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-indigo-500/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-blue-500/20 blur-[100px] rounded-full"></div>
      </div>

      {/* Grid Pattern (optional premium feel) */}
      <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      <div className="relative max-w-5xl mx-auto text-center">

        {/* Badge */}
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-sm backdrop-blur-md">
          Smart Lending Platform
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
          Your Lending,{" "}
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Fully Automated
          </span>
        </h1>

        {/* Sub Text */}
        <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto mb-12">
          Simplify loan workflows, match lenders instantly, and boost efficiency with powerful automation.
        </p>

        {/* Features */}
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
              <p className="group-hover:scale-105 transition">
                {item}
              </p>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-5">
          <button className="bg-gradient-to-r from-blue-500 to-indigo-500 px-8 py-3 rounded-xl font-semibold shadow-lg hover:scale-105 hover:shadow-blue-500/30 transition">
            Register Now
          </button>

          <button className="bg-white/10 border border-white/20 px-8 py-3 rounded-xl font-semibold backdrop-blur-md hover:bg-white/20 transition">
            Book a Demo
          </button>
        </div>

      </div>
    </section>
  );
};

export default Hero;
