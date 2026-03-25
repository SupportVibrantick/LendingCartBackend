const Navbar = () => {
  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="flex justify-between items-center px-6 md:px-10 py-4 max-w-7xl mx-auto">
        
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
          <h1 className="font-bold text-lg text-gray-700">
            Loan AI
          </h1>
        </div>

        {/* Links */}
        <div className="hidden md:flex gap-8 text-gray-600 font-medium">
          <a href="#how-it-works" className="hover:text-blue-600 transition">
            How it Works
          </a>
          <a href="#benefits" className="hover:text-blue-600 transition">
            Benefits
          </a>
          <a href="#pricing" className="hover:text-blue-600 transition">
            Pricing
          </a>
          <a href="#" className="hover:text-blue-600 transition">
            Lenders
          </a>
          <a href="#contact" className="hover:text-blue-600 transition">
            Contact
          </a>
        </div>

        {/* Button */}
        <button className="bg-[#1F3679] text-white px-5 py-2 rounded-lg hover:bg-[#162a5c] transition">
          Login
        </button>
      </div>
    </div>
  );
};

export default Navbar;