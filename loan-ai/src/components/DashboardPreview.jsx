const DashboardPreview = () => {
  return (
    <section className="relative w-full overflow-hidden bg-[#0b0f2a] text-white py-28 px-6">
      {/* Background Glow */}
      <div className="absolute inset-0">
        <div className="absolute -top-30 left-1/2 -translate-x-1/2 w-150 h-150 bg-indigo-500/20 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-25 -right-25 w-125 h-125 bg-blue-500/20 blur-[100px] rounded-full"></div>
      </div>

      <div className="relative flex flex-col items-center">
        {/* Laptop Preview */}
        <div className="relative w-full max-w-3xl group transition duration-500">
          {/* Screen */}
          <div className="absolute top-[7%] left-[13.5%] w-[72.5%] h-[78%] overflow-hidden rounded-md z-0">
            <img
              src="/DashBoardImage.png"
              alt="dashboard"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Laptop Image */}
          <img
            src="/HeroImage.avif"
            alt="laptop"
            className="w-full relative z-10 drop-shadow-[0_20px_80px_rgba(0,0,0,0.8)] group-hover:scale-[1.02] transition duration-500"
          />

          {/* Glass reflection overlay */}
          <div className="absolute inset-0 bg-linear-to-tr from-white/5 to-transparent pointer-events-none rounded-xl"></div>
        </div>

        {/* Content */}
        <div className="mt-20 text-center max-w-3xl">
          {/* Heading */}
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Built for{" "}
            <span className="bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Brokers
            </span>
          </h2>

          {/* Description */}
          <p className="text-gray-300 text-lg leading-relaxed">
            You’re not a lender — so why use software designed for one? Loan AI
            helps mortgage brokers manage their entire workflow from a single
            dashboard. Accept applications, match with lenders, and close deals
            faster with intelligent automation.
          </p>

          {/* Optional CTA */}
          <div className="mt-8">
            <button className="bg-linear-to-r from-blue-500 to-indigo-500 px-7 py-3 rounded-xl font-semibold shadow-lg hover:scale-105 hover:shadow-blue-500/30 transition">
              Explore Dashboard
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardPreview;
