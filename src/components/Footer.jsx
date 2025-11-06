import {
  Facebook,
  Instagram,
  Twitter,
  Mail,
  Phone,
  MessageCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-purple-900 text-white pt-16 pb-8 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        {/* Company Info */}
        <div>
          <h3 className="text-3xl font-bold mb-4 text-white">FaroukTechWorld</h3>
          <p className="text-purple-200 text-sm leading-relaxed">
            Your trusted partner for fast, reliable phone repairs and tech solutions across Nigeria.
            We combine expertise, speed, and care to keep you connected.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-xl font-semibold mb-4 text-white">Quick Links</h4>
          <ul className="space-y-3 text-sm text-purple-200">
            <li><Link to="/#services" className="hover:text-white transition">Services</Link></li>
            <li><Link to="/#about" className="hover:text-white transition">About Us</Link></li>
            <li><Link to="/#contact" className="hover:text-white transition">Contact</Link></li>
          </ul>
        </div>

        {/* Services Section */}
        <div>
          <h4 className="text-xl font-semibold mb-4 text-white">Our Services</h4>
          <ul className="space-y-3 text-sm text-purple-200">
            <li><Link to="/#services" className="hover:text-white transition">Screen Repairs</Link></li>
            <li><Link to="/#services" className="hover:text-white transition">Charging Port Repairs</Link></li>
            <li><Link to="/#services" className="hover:text-white transition">Battery Replacement</Link></li>
            <li><Link to="/#services" className="hover:text-white transition">Software Issues</Link></li>
            <li><Link to="/#services" className="hover:text-white transition">Data Recovery</Link></li>
            <li><Link to="/#services" className="hover:text-white transition">We Sell Too</Link></li>
          </ul>
        </div>

        {/* Contact Info */}
        <div>
          <h4 className="text-xl font-semibold mb-4 text-white">Contact Us</h4>
          <ul className="space-y-3 text-sm text-purple-200">
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4" /> +234 809 511 5931
            </li>
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4" /> farouktechworld@gmail.com
            </li>
            <li>Mokola Rd, Mokola Hill, Ibadan 200285, Oyo State</li>
          </ul>

          {/* Social Icons */}
          <div className="flex gap-4 mt-6">
            <a
              href="https://facebook.com/farouktechworld"
              target="_blank"
              rel="noopener noreferrer"
              title="Facebook"
              className="bg-white text-purple-900 p-2 rounded-full hover:bg-purple-700 hover:text-white transition"
            >
              <Facebook className="w-5 h-5" />
            </a>
            <a
              href="https://instagram.com/farouktechworld"
              target="_blank"
              rel="noopener noreferrer"
              title="Instagram"
              className="bg-white text-purple-900 p-2 rounded-full hover:bg-purple-700 hover:text-white transition"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://twitter.com/farouktechworld"
              target="_blank"
              rel="noopener noreferrer"
              title="Twitter"
              className="bg-white text-purple-900 p-2 rounded-full hover:bg-purple-700 hover:text-white transition"
            >
              <Twitter className="w-5 h-5" />
            </a>
            <a
              href="https://wa.me/2348095115931"
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp"
              className="bg-white text-purple-900 p-2 rounded-full hover:bg-green-500 hover:text-white transition"
            >
              <MessageCircle className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="mt-12 border-t border-purple-700 pt-6 text-center text-sm text-purple-300">
        &copy; {new Date().getFullYear()} FaroukTechWorld Limited. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
