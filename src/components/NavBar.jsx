import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link, NavLink } from "react-router-dom";
import Logo from "../assets/images/farouklogo.png";

const NavBar = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLink = (hash) => {
    navigate(`/${hash}`);
  };

  const navLinks = [
    { name: "About us", path: "/#about" },
    { name: "Services", path: "/#services", scroll: true },
    // { name: "Proof of Work", path: "/proof-of-work" }, 
    { name: "Pricing", path: "/pricing" },
    // { name: "Contact us", path: "#contact", scroll: true },
    { name: "Track Order", path: "/track-order", },
  ];

  return (
    <nav className="bg-purple-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo Only */}
          <Link to="/" className="flex items-center">
            <img
              src={Logo}
              alt="FaroukTechWorld Logo"
              className="h-30 w-auto max-w-[160px] object-contain"
            />

          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex space-x-6">
            {navLinks.map((link) =>
              link.scroll ? (
                <a
                  key={link.name}
                  onClick={() => handleLink(link.path)}
                  className="cursor-pointer hover:font-bold transition"
                >
                  {link.name}
                </a>
              ) : (
                <NavLink
                  key={link.name}
                  to={link.path}
                  className={({ isActive }) =>
                    `hover:font-bold transition ${isActive ? "text-purple-300 font-bold" : ""}`
                  }
                >
                  {link.name}
                </NavLink>
              )
            )}
          </div>

          {/* Quote Button */}
          <div className="hidden md:block">
            <NavLink to="/pricing">
              <button className="bg-white text-purple-800 px-4 py-2 rounded hover:bg-gray-200 transition">
                Get a quote now
              </button>
            </NavLink>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)}>
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden px-4 pb-4 space-y-2">
          {navLinks.map((link) =>
            link.scroll ? (
              <a
                key={link.name}
                href={link.path}
                className="block hover:font-bold transition"
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </a>
            ) : (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) =>
                  `block hover:font-bold transition ${isActive ? "text-purple-300 font-bold" : ""}`
                }
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </NavLink>
            )
          )}
          <NavLink to="/pricing">
            <button className="w-full mt-2 bg-white text-purple-800 px-4 py-2 rounded hover:bg-gray-200 transition">
              Get a quote now
            </button>
          </NavLink>
        </div>
      )}
    </nav>
  );
};

export default NavBar;
