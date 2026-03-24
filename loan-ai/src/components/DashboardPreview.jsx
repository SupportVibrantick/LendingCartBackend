const DashboardPreview = () => {
  return (
    <div className="flex flex-col justify-center items-center w-full px-5 relative bg-white overflow-hidden">
      <div className="relative w-full max-w-4xl">
        {/* Screen */}
        <div className="absolute top-[6.5%] left-[14%] w-[72%] h-[80%] overflow-hidden rounded-md z-0">
          <img
            src="/DashBoardImage.png"
            alt="dashboard"
            className="w-full h-full object-fill"
          />
        </div>

        {/* Laptop */}
        <img
          src="/HeroImage.avif"
          alt="laptop"
          className="w-full relative z-10 drop-shadow-none"
        />
      </div>

      <div className="py-16 px-5 text-center w-full">
        <h2 className="text-3xl md:text-4xl font-bold text-blue-900 mb-6">
          Built For Brokers
        </h2>

        <p className="max-w-3xl mx-auto text-gray-600 text-lg leading-relaxed">
          You’re not a lender – so why use software designed for one? Lending
          Automator was developed to help mortgage brokers manage their unique
          businesses from a single interface. Accept applications, match with
          lenders, and close deals faster with powerful automation tools.
        </p>
      </div>
    </div>
  );
};

export default DashboardPreview;
