import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Hero from '../components/Hero.jsx';
import Stats from '../components/Stats.jsx';
import WhyChooseUs from '../components/WhyChooseUs.jsx'; 
import Services from '../components/Services.jsx';
import HowWeWork from '../components/HowWeWork.jsx';
// import Testimonials from '../components/Testimonals.jsx';
import FAQ from '../components/FAQ.jsx'; 
import Contact from '../components/Contact.jsx';


const Homepage = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  return (
    <div className="font-sans antialiased text-slate-800 bg-slate-50">
      <Hero />
      <Stats />
      <WhyChooseUs /> 
      <Services />
      <HowWeWork />
      {/* <Testimonials /> */}
      <FAQ /> 
      <Contact />
    </div>
  );
};

export default Homepage;