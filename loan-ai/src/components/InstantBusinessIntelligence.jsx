const InstantBusinessIntelligence = () => {
  return (
    <div className="bg-white py-20 px-5">
      
      {/* Top Content */}
      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        
        {/* Left Text */}
        <div>
          <h3 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
            Instant Business Intelligence
          </h3>

          <p className="text-gray-700 leading-relaxed">
            Lending Automator's Reporting interface gives you instant visibility
            into your pipeline and performance. Track application volume,
            historical and projected revenue, referral sources, and other
            critical business data. Coupled with advanced filtering and a
            customizable pipeline view, you can pinpoint exactly what you need
            to know, when you need to know it.
          </p>
        </div>

        {/* Right Image */}
        <div>
          <img
            src="https://static.wixstatic.com/media/4cbb8e_c3a6db882ade4087a55d4d7bac20cb21~mv2.png/v1/fill/w_968,h_496,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/Screenshot%202026-03-13%20at%2012_26_45%E2%80%AFPM.png"
            alt="business intelligence"
            className="w-full rounded-xl shadow"
          />
        </div>
      </div>

      {/* Feature Cards */}
      <div className="max-w-4xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        
        {[
          "Real-Time Intelligence",
          "Make Faster Decisions",
          "Customizable Interface",
          "Advanced Filtering",
        ].map((item, index) => (
          
          <div
            key={index}
            className="bg-white py-5 px-5 rounded-xl shadow-2xl hover:shadow-xl transition duration-300 flex flex-col items-center"
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

export default InstantBusinessIntelligence;