const Navbar = () => {
  return (
    <header className="fixed top-0 left-0 w-full z-50 backdrop-blur-xl bg-[#0b0f2a]/70 border-b border-white/10">
      <div className="flex justify-between items-center px-6 md:px-10 py-4 max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <h1 className="font-semibold text-lg text-white tracking-wide">
            Loan AI
          </h1>
        </div>

        {/* Links */}
        <nav className="hidden md:flex gap-8 text-gray-300 font-medium">
          {[
            { name: "How it Works", link: "#how-it-works" },
            { name: "Benefits", link: "#benefits" },
            { name: "Pricing", link: "#pricing" },
            { name: "Lenders", link: "#" },
            { name: "Contact", link: "#contact" },
          ].map((item, i) => (
            <a
              key={i}
              href={item.link}
              className="relative group hover:text-white transition"
            >
              {item.name}

              {/* underline animation */}
              <span className="absolute left-0 -bottom-1 w-0 h-[2px] bg-gradient-to-r from-blue-400 to-indigo-400 transition-all group-hover:w-full"></span>
            </a>
          ))}
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center gap-4">
          {/* Sign Up (Secondary / Ghost) */}
          <button className="hidden sm:inline-flex items-center px-4 py-2 rounded-lg text-gray-300 border border-white/10 hover:border-white/30 hover:text-white hover:bg-white/5 transition">
            Sign Up
          </button>

          {/* Login (Primary) */}
          <button className="relative inline-flex items-center px-6 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/20 hover:scale-105 hover:shadow-blue-500/40 transition">
            {/* Glow effect */}
            <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 blur opacity-30"></span>

            <span className="relative z-10">Login</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
