const VirtualProcessor = () => {
  return (
    <div className="bg-gray-100 py-20 px-5">
      
      {/* Top Content */}
      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        
        {/* Left Text */}
        <div>
          <h3 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
            Virtual Processor™ Technology
          </h3>

          <p className="text-gray-700 leading-relaxed">
            Lending Automator’s patent-pending Virtual Processor™ technology
            works 24/7 to keep your loans moving forward, automatically assigning
            tasks, sending notifications and reminders, collecting documents,
            and helping your clients e-sign right in the platform.
          </p>
        </div>

        {/* Right Image */}
        <div>
          <img
            src="https://static.wixstatic.com/media/4cbb8e_625e5b1ddeea43cea1aaf999401ce55a~mv2.png/v1/fill/w_1028,h_482,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/Screenshot%202026-03-19%20at%208_35_31%E2%80%AFAM.png"
            alt="virtual processor"
            className="w-full rounded-xl shadow"
          />
        </div>
      </div>

      {/* Feature Cards */}
      <div className="max-w-4xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        
        {[
          "It’s Working – Even When You Aren’t.",
          "Custom Tasks Based on the Lender",
          "Automated Notifications",
          "E-sign Documents from Any Device",
        ].map((item, index) => (
          
          <div
            key={index}
            className="bg-white py-5 px-5 rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition duration-300 flex flex-col items-center"
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
            <p className="text-gray-800 font-medium leading-snug text-sm md:text-base">
              {item}
            </p>

          </div>

        ))}
      </div>

    </div>
  );
};

export default VirtualProcessor;