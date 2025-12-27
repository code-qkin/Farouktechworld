import heroBg from '../assets/images/hero.jpeg';
import { Link } from "react-router-dom";

const Hero = () => {
  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <img 
        src={heroBg} 
        alt="Technician repairing electronics background" 
        className="absolute inset-0 w-full h-full object-cover" 
      />
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/70"></div>

      {/* Content Container */}
      <div className="relative z-10 px-6 text-center max-w-4xl mx-auto">
        
        {/* Main Heading - White for impact */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 leading-tight">
          Welcome to <span className="text-purple-400">FaroukTechWorld</span>
        </h1>

        {/* Subheading - Purple Accent */}
        <p className="text-xl md:text-3xl font-bold text-purple-300 mb-6">
          Don't Delay, Repair Today.
        </p>

        {/* Description - Lighter gray/white for readability */}
        <p className="text-base md:text-lg text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
          Don't let technical troubles slow you down. We breathe new life into your devices swiftly & seamlessly with expert care.
        </p>

        {/* CTA Button - Styled Link */}
        <Link 
          to="/pricing" 
          className="inline-block bg-purple-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-purple-700 hover:scale-105 transition-all shadow-lg hover:shadow-purple-500/30"
        >
          Get a Free Quote
        </Link>
      </div>
    </section>
  );
}

export default Hero;