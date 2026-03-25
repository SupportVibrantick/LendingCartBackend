const Pricing = () => {
  const features = [
    {
      title: "Unlimited Applications",
      desc: "Enter as many deals as you want for one low price.",
    },
    {
      title: "Virtual Processor™",
      desc: "Automation on each application saves you time & money.",
    },
    {
      title: "No Long-Term Contract",
      desc: "Pay month-to-month or save when you enroll for a full year.",
    },
    {
      title: "No Onboarding or Setup Fees",
      desc: "Unlike others, Loan AI doesn’t charge big fees to get started.",
    },
  ];

  return (
    <div id="pricing" className="scroll-mt-24 bg-[#F2F5F8] py-20 px-5">
      <div className="max-w-4xl mx-auto text-center">
        
        {/* Heading */}
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-700">
          Pricing
        </h2>

        <h3 className="text-3xl md:text-4xl font-bold text-blue-900 mt-3">
          $99/Month Per User
        </h3>

        <p className="text-blue-900 mt-2 font-medium">
          (Seriously, no other charges!)
        </p>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mt-14">
          {features.map((item, index) => (
            <div
              key={index}
              className="bg-[#F2F5F8] rounded-2xl p-6 shadow-lg hover:shadow-lg transition duration-300"
            >
              <h4 className="text-blue-900 font-bold text-lg mb-3">
                {item.title}
              </h4>

              <p className="text-gray-600 text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          
          <button className="bg-blue-900 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-800 transition">
            Register Now
          </button>

          <button className="bg-white border border-gray-300 px-6 py-3 rounded-lg shadow-sm hover:shadow-md transition">
            Book a Demo
          </button>

        </div>
      </div>
    </div>
  );
};

export default Pricing;