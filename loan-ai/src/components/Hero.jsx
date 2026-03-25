const Hero = () => {
  return (
    <div className="relative bg-gradient-to-br from-[#2f3ea8] to-[#1c2a7a] text-white py-24 px-5 text-center overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/20 blur-3xl rounded-full"></div>

      <div className="relative max-w-4xl mx-auto">
        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          Your Lending, <span className="text-blue-300">Automated</span>
        </h1>

        {/* Sub Text */}
        <p className="text-blue-100 text-lg md:text-xl mb-10">
          Streamline your lending process with powerful automation tools
        </p>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm md:text-base font-medium mb-10">
          {[
            "Accept Applications Online",
            "Instant Lender Matching",
            "One-Click Quote Requests",
            "Automated Reminders",
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white/10 backdrop-blur-md rounded-lg px-4 py-3 border border-white/10"
            >
              {item}
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button className="bg-white text-black px-7 py-3 rounded-xl font-semibold shadow-lg hover:scale-105 hover:bg-gray-200 transition">
            Register Now
          </button>

          <button className="bg-[#1F3679] px-7 py-3 rounded-xl font-semibold shadow-lg hover:scale-105 transition">
            Book a Demo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Hero;
