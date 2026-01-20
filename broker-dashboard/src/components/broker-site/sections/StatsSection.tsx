const BrokerStats = () => {
  // Broker-specific stats data
  const stats = [
    { 
      label: "Loan Approval Rate", 
      value: "99%", 
      description: "Highest in the market" 
    },
    { 
      label: "Disbursed Daily", 
      value: "$90K+", 
      description: "Quick turnaround time" 
    },
    { 
      label: "Verified Borrowers", 
      value: "8,900", 
      description: "Trusting our expertise" 
    },
    { 
      label: "Expert Consultants", 
      value: "346", 
      description: "Available 24/7" 
    },
  ];

  return (
    <section className="relative w-full bg-[#0091d5] py-16 md:py-24 overflow-hidden shadow-inner">
      {/* Background Subtle Pattern - Professional look ke liye */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative flex items-center">
        {/* Stats Grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-0">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className={`relative flex flex-col items-center justify-center px-6 text-center group
                ${index !== stats.length - 1 ? 'lg:border-r lg:border-white/20' : ''}`}
            >
              {/* Value with small grow effect on hover */}
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tighter transition-transform group-hover:scale-105">
                {stat.value}
              </h2>
              
              <div className="space-y-1">
                <p className="text-white text-md font-semibold uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className="text-blue-100 text-xs font-light opacity-80 italic">
                  {stat.description}
                </p>
              </div>

              {/* Mobile Divider (Only visible on small screens) */}
              {index !== stats.length - 1 && (
                <div className="w-16 h-[1px] bg-white/20 mt-8 lg:hidden"></div>
              )}
            </div>
          ))}
        </div>
      </div>

     
    </section>
  );
};

export default BrokerStats;