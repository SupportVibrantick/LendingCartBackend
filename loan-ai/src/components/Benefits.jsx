const Benefits = () => {
  const features = [
    "Best Matches Appear First",
    "One Click Quote Requests",
    "Contact Info Provided",
    "Lenders Compete For Your Business",
  ];

  return (
    <div id="benefits" className="scroll-mt-24 bg-white py-0 px-5 mx-w-4xl mb-4">
      {/* Heading */}
      <h2 className="text-3xl md:text-4xl font-bold text-center text-blue-900 mb-12">
        Loan AI Saves You <br /> Time & Money
      </h2>

      {/* Content Row */}
      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        {/* Left Text */}
        <div>
          <h3 className="text-2xl font-semibold mb-4">
            Lender Matching/Quote Requests
          </h3>

          <p className="text-gray-800 leading-relaxed">
            Loan AI analyzes pre-application data to identify lenders
            who may be a good fit to fund your deal. We then allow you to
            request quotes with a single click! No more struggling to find
            someone who can get it done. Loan AI helps you discover
            new lenders to keep your loans moving forward.
          </p>
        </div>

        {/* Right Image */}
        <div>
          <img
            src="https://static.wixstatic.com/media/4cbb8e_a92b159bfabc44a5a5af32ce31d89fa0~mv2.png/v1/fill/w_907,h_533,al_c,q_90,enc_avif,quality_auto/4cbb8e_a92b159bfabc44a5a5af32ce31d89fa0~mv2.png"
            alt="lender matching"
            className="w-full rounded-xl shadow"
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center pb-8">
        {[
          "Best Matches Appear First",
          "One Click Quote Requests",
          "Contact Info Provided",
          "Lenders Compete For Your Business",
        ].map((item, index) => (
          <div
            key={index}
            className="bg-white shadow-2xl py-5 px-5 rounded-xl hover:shadow-xl transition duration-300 flex flex-col items-center"
          >
            {/* Icon */}
            <div className="w-12 h-12 mb-5">
              <img
                src="https://static.wixstatic.com/media/4cbb8e_71e372ebba94426fb075f5fe43e5f8f3~mv2.png"
                alt="icon"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Text */}
            <p className="text-gray-800 font-medium leading-snug text-sm">
              {item}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Benefits;
