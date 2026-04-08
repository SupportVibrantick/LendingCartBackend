import { FileText, Layers, Upload, Database } from "lucide-react";

const MultiLenderSupport = () => {
  const features = [
    {
      title: "Top Lenders Ready",
      icon: <Layers size={20} />,
    },
    {
      title: "Custom Formats",
      icon: <FileText size={20} />,
    },
    {
      title: "Easy Exports",
      icon: <Upload size={20} />,
    },
    {
      title: "Centralized Management",
      icon: <Database size={20} />,
    },
  ];

  return (
    <section className="relative bg-[#0b0f2a] py-28 px-6 overflow-hidden">

      {/* Background Glow */}
      <div className="absolute top-[-120px] right-[-100px] w-[500px] h-[500px] bg-blue-500/20 blur-[120px] rounded-full"></div>

      <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">

        {/* LEFT: Image */}
        <div className="group">
          <img
            src="./MultiLenderSupport.png"
            alt="multi lender"
            className="w-full rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.7)] group-hover:scale-105 transition duration-500"
          />
        </div>

        {/* RIGHT: Content */}
        <div>
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Multi-Lender{" "}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Support
            </span>
          </h3>

          <p className="text-gray-300 leading-relaxed mb-8">
            Loan AI allows you to work with virtually any private money lender,
            supporting custom document formats for each. Easily switch lenders
            mid-application while automatically converting existing data —
            ensuring zero disruption.
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
      </div>
    </section>
  );
};

export default MultiLenderSupport;