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
        { name: "Proof of work", path: "/proof-of-work", type: "route" },
        { name: "Track Order", path: "/track-order", type: "route" },
    ];

    return (
        <nav 
            className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
                scrolled 
                ? "bg-purple-900/95 backdrop-blur-md shadow-lg py-3" 
                : "bg-purple-900 py-5 shadow-md"
            }`}
        >
            <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                
                {/* Logo Area */}
                <Link to="/" className="flex items-center gap-2 group" onClick={() => window.scrollTo(0, 0)}>
                    {/* Using brightness-0 invert filter to make logo white if it's dark */}
                    <span className="font-black text-xl text-white tracking-tight group-hover:text-purple-200 transition">
                        FaroukTech<span className="text-purple-300 group-hover:text-white transition">World</span>
                    </span>
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        link.type === 'scroll' ? (
                            <button 
                                key={link.name}
                                onClick={() => handleScrollLink(link.path)}
                                className="text-sm font-bold text-purple-100 hover:text-white transition uppercase tracking-wide hover:scale-105 transform"
                            >
                                {link.name}
                            </button>
                        ) : (
                            <NavLink 
                                key={link.name}
                                to={link.path}
                                className={({ isActive }) => 
                                    `text-sm font-bold uppercase tracking-wide transition hover:scale-105 transform ${
                                        isActive ? "text-white border-b-2 border-white" : "text-purple-100 hover:text-white"
                                    }`
                                }
                            >
                                {link.name}
                            </NavLink>
                        )
                    ))}
                    
                    {/* CTA Button (White on Purple) */}
                    <Link 
                        to="/pricing" 
                        className="bg-white text-purple-900 px-6 py-2.5 rounded-full font-bold text-sm hover:bg-purple-100 transition shadow-lg hover:shadow-purple-500/20 transform hover:-translate-y-0.5"
                    >
                        Get a Quote
                    </Link>
                </div>

                {/* Mobile Toggle */}
                <button 
                    className="md:hidden text-white focus:outline-none p-2 rounded-lg hover:bg-purple-800"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
            </div>

            {/* Mobile Menu Dropdown */}
            {isOpen && (
                <div className="md:hidden absolute top-full left-0 w-full bg-purple-900 border-t border-purple-800 shadow-xl flex flex-col p-6 space-y-4 animate-in slide-in-from-top-5">
                    {navLinks.map((link) => (
                        link.type === 'scroll' ? (
                            <button 
                                key={link.name}
                                onClick={() => handleScrollLink(link.path)}
                                className="text-left text-lg font-bold text-purple-100 hover:text-white py-3 border-b border-purple-800 last:border-0"
                            >
                                {link.name}
                            </button>
                        ) : (
                            <NavLink 
                                key={link.name}
                                to={link.path}
                                onClick={() => setIsOpen(false)}
                                className={({ isActive }) => 
                                    `text-lg font-bold py-3 border-b border-purple-800 flex items-center justify-between ${
                                        isActive ? "text-white pl-2 border-l-4 border-white bg-purple-800/50" : "text-purple-100"
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
                        className="bg-white text-purple-900 text-center py-4 rounded-xl font-bold text-lg shadow-md mt-4 active:scale-95 transition hover:bg-purple-50"
                    >
                        Get a Quote Now
                    </Link>
                </div>
            )}
        </nav>
    );
};

export default NavBar;