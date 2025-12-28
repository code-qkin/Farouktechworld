import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "../assets/images/farouklogo.png"; 

const NavBar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // 1. Handle scroll effect for navbar appearance
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // 2. Hide Navbar on Admin pages
    if (location.pathname.startsWith('/admin')) return null;

    // 3. Smart Link Handling (Scroll vs Navigate)
    const handleScrollLink = (hash) => {
        setIsOpen(false);
        if (location.pathname === '/') {
            // If already on Home, just find element and scroll
            const element = document.querySelector(hash);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else {
            // If on another page, navigate to Home + Hash
            navigate(`/${hash}`);
        }
    };

    const navLinks = [
        { name: "Home", path: "/", type: "route" },
        { name: "About Us", path: "#about", type: "scroll" },
        { name: "Services", path: "#services", type: "scroll" },
        { name: "Pricing", path: "/pricing", type: "route" },
        { name: "Track Order", path: "/track-order", type: "route" },
    ];

    return (
        <nav 
            className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
                scrolled 
                ? "bg-white/95 backdrop-blur-md shadow-md py-3" 
                : "bg-white py-5 shadow-sm"
            }`}
        >
            <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                
                {/* Logo Area */}
                <Link to="/" className="flex items-center gap-2 group" onClick={() => window.scrollTo(0, 0)}>
                    <img src={Logo} alt="FaroukTechWorld" className="h-10 w-auto object-contain" />
                    <span className="font-black text-xl text-slate-900 tracking-tight group-hover:text-purple-700 transition">
                        FaroukTech<span className="text-purple-700 group-hover:text-slate-900 transition">World</span>
                    </span>
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        link.type === 'scroll' ? (
                            <button 
                                key={link.name}
                                onClick={() => handleScrollLink(link.path)}
                                className="text-sm font-bold text-slate-600 hover:text-purple-700 transition uppercase tracking-wide"
                            >
                                {link.name}
                            </button>
                        ) : (
                            <NavLink 
                                key={link.name}
                                to={link.path}
                                className={({ isActive }) => 
                                    `text-sm font-bold uppercase tracking-wide transition ${
                                        isActive ? "text-purple-700" : "text-slate-600 hover:text-purple-700"
                                    }`
                                }
                            >
                                {link.name}
                            </NavLink>
                        )
                    ))}
                    
                    {/* CTA Button */}
                    <Link 
                        to="/pricing" 
                        className="bg-purple-900 text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-purple-700 transition shadow-lg hover:shadow-purple-200 transform hover:-translate-y-0.5"
                    >
                        Get a Quote
                    </Link>
                </div>

                {/* Mobile Toggle */}
                <button 
                    className="md:hidden text-slate-800 focus:outline-none p-2 rounded-lg hover:bg-gray-100"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
            </div>

            {/* Mobile Menu Dropdown */}
            {isOpen && (
                <div className="md:hidden absolute top-full left-0 w-full bg-white border-t border-gray-100 shadow-xl flex flex-col p-6 space-y-4 animate-in slide-in-from-top-5">
                    {navLinks.map((link) => (
                        link.type === 'scroll' ? (
                            <button 
                                key={link.name}
                                onClick={() => handleScrollLink(link.path)}
                                className="text-left text-lg font-bold text-slate-700 hover:text-purple-700 py-3 border-b border-gray-50 last:border-0"
                            >
                                {link.name}
                            </button>
                        ) : (
                            <NavLink 
                                key={link.name}
                                to={link.path}
                                onClick={() => setIsOpen(false)}
                                className={({ isActive }) => 
                                    `text-lg font-bold py-3 border-b border-gray-50 flex items-center justify-between ${
                                        isActive ? "text-purple-700 pl-2 border-l-4 border-purple-700 bg-purple-50/50" : "text-slate-700"
                                    }`
                                }
                            >
                                {link.name}
                            </NavLink>
                        )
                    ))}
                    <Link 
                        to="/pricing"
                        onClick={() => setIsOpen(false)}
                        className="bg-purple-900 text-white text-center py-4 rounded-xl font-bold text-lg shadow-md mt-4 active:scale-95 transition"
                    >
                        Get a Quote Now
                    </Link>
                </div>
            )}
        </nav>
    );
};

export default NavBar;