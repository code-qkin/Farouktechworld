import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Hero from '../components/Hero.jsx';
import AboutUs from '../components/AboutUs.jsx';
import Services from '../components/Services.jsx';
import HowWeWork from '../components/HowWeWork.jsx';
import Stats from '../components/Stats.jsx';
import Contact from '../components/Contact.jsx';
// import Testimonials from '../components/Testimonals.jsx'; // Uncommented for a full feel

const Homepage = () => {
  const location = useLocation();

  // Handle smooth scroll for anchor links
  useEffect(() => {
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [location]);

  return (
    <div className="font-sans antialiased text-slate-800 bg-slate-50">
      <Hero />
      <Stats />
      <AboutUs />
      <Services />
      <HowWeWork />
      {/* <Testimonials />  -- Optional: Enable if you have content */}
      <Contact />
    </div>
  );
};

export default Homepage;