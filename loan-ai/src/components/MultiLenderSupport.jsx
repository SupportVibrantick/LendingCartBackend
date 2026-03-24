const MultiLenderSupport = () => {
  return (
    <div className="bg-[#F2F5F8] py-20 px-5">
      
      {/* Top Content */}
      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        
        {/* Left Image */}
        <div>
          <img
            src="https://static.wixstatic.com/media/4cbb8e_feb509696b574fd7a0b6ddb298e8af1e~mv2.png/v1/fill/w_703,h_316,al_c,lg_1,q_85,enc_avif,quality_auto/Home%20page%20image%202a.png"
            alt="multi lender"
            className="w-full rounded-xl shadow"
          />
        </div>

        {/* Right Text */}
        <div>
          <h3 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
            Multi-Lender Support
          </h3>

          <p className="text-gray-700 leading-relaxed">
            Lending Automator allows you to work with virtually any private money lender,
            and supports custom document formats for each. Switching lenders midway
            through an application is simple because previously collected data can
            automatically be converted to the new lender's format, ensuring minimal
            disruption to your applicants.
          </p>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="max-w-4xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        
        {[
          "Preconfigured for the Top Lenders",
          "Custom Document Formats",
          "Easy File Exports",
          "Centralized Loan Management",
        ].map((item, index) => (
          
          <div
            key={index}
            className="bg-[#F2F5F8] py-5 px-5 rounded-xl shadow-xl hover:shadow-lg transition duration-300 flex flex-col items-center"
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

export default MultiLenderSupport;