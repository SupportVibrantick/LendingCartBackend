import { BarChart3, Zap, SlidersHorizontal, Filter } from "lucide-react";

const InstantBusinessIntelligence = () => {
  const features = [
    {
      title: "Real-Time Intelligence",
      icon: <BarChart3 size={20} />,
    },
    {
      title: "Faster Decisions",
      icon: <Zap size={20} />,
    },
    {
      title: "Customizable UI",
      icon: <SlidersHorizontal size={20} />,
    },
    {
      title: "Advanced Filtering",
      icon: <Filter size={20} />,
    },
  ];

  return (
    <section className="relative bg-[#0b0f2a] py-28 px-6 overflow-hidden">

      {/* Background Glow */}
      <div className="absolute top-[-120px] left-[-100px] w-[500px] h-[500px] bg-indigo-500/20 blur-[120px] rounded-full"></div>

      <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">

        {/* LEFT: Content */}
        <div>
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Instant{" "}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Business Intelligence
            </span>
          </h3>

          <p className="text-gray-300 leading-relaxed mb-8">
            Loan AI’s reporting interface gives you complete visibility into
            your pipeline and performance. Track applications, revenue,
            referral sources, and more — with powerful filtering and a fully
            customizable dashboard.
          </p>

          {/* Feature Pills */}
          <div className="grid grid-cols-2 gap-4">
            {features.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 backdrop-blur-xl hover:bg-white/10 transition"
              >
                <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                  {item.icon}
                </div>

                <span className="text-gray-200 text-sm font-medium">
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Image */}
        <div className="group">
          <img
            src="/InstantBusinessIntelligence.png"
            alt="business intelligence"
            className="w-full rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.7)] group-hover:scale-105 transition duration-500"
          />
        </div>
      </div>
    </section>
  );
};

export default InstantBusinessIntelligence;