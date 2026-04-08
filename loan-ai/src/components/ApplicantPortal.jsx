import { CheckCircle } from "lucide-react";

const ApplicantPortal = () => {
  const leftFeatures = [
    "Lender matching and quote requests",
    "Works with multiple lenders",
    "Branded application page",
    "Applicant portal",
    "Term sheet distribution",
    "Financial tracking",
    "In-app communication",
    "Detailed audit history and notes",
    "Contact management",
    "Visual pipeline status",
  ];

  const rightFeatures = [
    "Automated reminders",
    "e-Signatures",
    "Reporting and business intelligence",
    "Automated task assignment",
    "Seamless document collection",
    "Custom document formats by lender",
    "Alerts and notifications",
    "Secure access from any device",
    "No long-term contracts",
    "No set-up fees",
  ];

  const highlights = [
    {
      title: "Complete Tasks Online",
      desc: "Applicants finish everything digitally without manual follow-ups.",
    },
    {
      title: "Real-Time Messaging",
      desc: "Communicate instantly with applicants for faster approvals.",
    },
    {
      title: "Works Everywhere",
      desc: "Fully responsive on mobile, tablet, and desktop devices.",
    },
  ];

  return (
    <section className="relative bg-[#0b0f2a] py-28 px-6 overflow-hidden">

      {/* Glow */}
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/20 blur-[120px] rounded-full"></div>

      <div className="relative max-w-6xl mx-auto">

        {/* Heading */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Applicant{" "}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Portal
            </span>
          </h2>

          <p className="text-gray-300 max-w-2xl mx-auto">
            Give your applicants a seamless, modern experience — complete tasks,
            upload documents, and track progress in one place.
          </p>
        </div>

        {/* Top Highlights */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {highlights.map((item, i) => (
            <div
              key={i}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition"
            >
              <h3 className="text-white font-semibold mb-2">
                {item.title}
              </h3>
              <p className="text-gray-400 text-sm">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Feature List (clean, not heavy cards) */}
        <div className="grid md:grid-cols-2 gap-12">
          
          {[leftFeatures, rightFeatures].map((list, idx) => (
            <div key={idx} className="space-y-4">
              {list.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 text-gray-300"
                >
                  <CheckCircle
                    size={18}
                    className="text-blue-400 mt-1"
                  />
                  <span className="text-sm md:text-base">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          ))}

        </div>
      </div>
    </section>
  );
};

export default ApplicantPortal;