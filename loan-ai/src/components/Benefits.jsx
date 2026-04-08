import { Zap, MousePointerClick, Phone, Trophy } from "lucide-react";

const Benefits = () => {
  const features = [
    {
      title: "Best Matches First",
      desc: "Smart AI ranks lenders so you always see the best options upfront.",
      icon: <Zap size={22} />,
    },
    {
      title: "One Click Quotes",
      desc: "Request quotes instantly without manual follow-ups or delays.",
      icon: <MousePointerClick size={22} />,
    },
    {
      title: "Direct Contact Info",
      desc: "Get instant access to lender contact details and close deals faster.",
      icon: <Phone size={22} />,
    },
    {
      title: "Lenders Compete",
      desc: "Multiple lenders compete to offer you the best possible deal.",
      icon: <Trophy size={22} />,
    },
  ];

  return (
    <section
      id="benefits"
      className="scroll-mt-24 bg-[#0b0f2a] py-28 px-6 relative overflow-hidden"
    >
      {/* Glow */}
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/20 blur-[120px] rounded-full"></div>

      <div className="relative max-w-6xl mx-auto text-center">

        {/* Heading */}
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
          Why Choose{" "}
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Loan AI
          </span>
        </h2>

        <p className="text-gray-300 max-w-2xl mx-auto mb-16">
          Powerful automation tools designed to save your time, reduce effort,
          and maximize deal success.
        </p>

        {/* Feature Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">

          {features.map((item, index) => (
            <div
              key={index}
              className="group bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-left hover:bg-white/10 hover:-translate-y-2 transition duration-300"
            >
              {/* Icon */}
              <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white mb-4 shadow-lg group-hover:shadow-blue-500/40 transition">
                {item.icon}
              </div>

              {/* Title */}
              <h3 className="text-white font-semibold text-lg mb-2">
                {item.title}
              </h3>

              {/* Description */}
              <p className="text-gray-400 text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Benefits;