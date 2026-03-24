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

  return (
    <div className="bg-white py-20 px-5">
      <div className="max-w-4xl mx-auto text-center">
        {/* Heading */}
        <h2 className="text-3xl md:text-4xl font-bold text-blue-900 mb-6">
          Applicant Portal Included
        </h2>

        {/* Description */}
        <p className="text-gray-700 max-w-2xl mx-auto leading-relaxed mb-12">
          Give your applicants a seamless experience with a fully-featured
          portal. They can complete tasks, upload documents, and track progress
          — all in one place. No confusion, no delays.
        </p>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {[
            {
              title: "Complete Tasks Online",
              desc: "Applicants can finish all required steps digitally without manual follow-ups.",
            },
            {
              title: "Two-Way Messaging",
              desc: "Communicate directly with applicants in real-time for faster processing.",
            },
            {
              title: "Works On Any Device",
              desc: "Fully responsive portal accessible on mobile, tablet, and desktop.",
            },
          ].map((item, index) => (
            <div
              key={index}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition duration-300 text-left flex flex-col justify-center items-center"
            >
              {/* Icon */}
              <div className="w-12 h-12 mb-5">
                <img
                  src="https://static.wixstatic.com/media/4cbb8e_71e372ebba94426fb075f5fe43e5f8f3~mv2.png"
                  alt="icon"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>

              {/* Desc */}
              <p className="text-gray-600 text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto pt-14">
        {/* Heading */}
        <h2 className="text-3xl md:text-4xl font-bold text-center text-blue-900 mb-14">
          Comprehensive Feature Set
        </h2>

        {/* Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Card */}
          <div className="bg-[#F2F5F8] rounded-xl p-8 shadow-xl hover:shadow-2xl transition">
            <ul className="space-y-5">
              {leftFeatures.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-1">
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                  </div>

                  {/* Text */}
                  <p className="text-gray-700 text-sm md:text-base">{item}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Card */}
          <div className="bg-[#F2F5F8] rounded-2xl p-8 shadow-xl hover:shadow-2xl transition">
            <ul className="space-y-5">
              {rightFeatures.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-1">
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                  </div>

                  {/* Text */}
                  <p className="text-gray-700 text-sm md:text-base">{item}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicantPortal;
