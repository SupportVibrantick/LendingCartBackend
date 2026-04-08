import { Clock, Settings, Bell, FileSignature } from "lucide-react";

const VirtualProcessor = () => {
  const features = [
    {
      title: "Works 24/7",
      desc: "Keeps your loans moving even when you're offline.",
      icon: <Clock size={20} />,
    },
    {
      title: "Custom Task Automation",
      desc: "Tasks adapt based on lender requirements automatically.",
      icon: <Settings size={20} />,
    },
    {
      title: "Smart Notifications",
      desc: "Never miss updates with automated alerts & reminders.",
      icon: <Bell size={20} />,
    },
    {
      title: "E-sign Anywhere",
      desc: "Clients can sign documents from any device instantly.",
      icon: <FileSignature size={20} />,
    },
  ];

  return (
    <section className="relative bg-[#0b0f2a] py-28 px-6 overflow-hidden text-center">

      {/* Glow */}
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/20 blur-[120px] rounded-full"></div>

      <div className="relative max-w-6xl mx-auto">

        {/* Heading */}
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
          Virtual Processor™{" "}
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Automation
          </span>
        </h2>

        {/* Description */}
        <p className="text-gray-300 max-w-2xl mx-auto mb-16">
          Your 24/7 assistant that automates tasks, notifications, and document
          collection — so you can focus on closing deals faster.
        </p>

        {/* Center Image */}
        <div className="mb-20 group">
          <img
            src="VirtualProcessor.png"
            alt="virtual processor"
            className="mx-auto w-full max-w-4xl rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.7)] group-hover:scale-105 transition duration-500"
          />
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          {features.map((item, index) => (
            <div
              key={index}
              className="group bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:-translate-y-2 transition duration-300"
            >
              {/* Icon */}
              <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white mb-4 shadow-lg group-hover:shadow-blue-500/40 transition">
                {item.icon}
              </div>

              {/* Title */}
              <h3 className="text-white font-semibold mb-2">
                {item.title}
              </h3>

              {/* Description */}
              <p className="text-gray-400 text-sm">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default VirtualProcessor;