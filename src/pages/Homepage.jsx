import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Hero from '../components/Hero.jsx';
import AboutUs from '../components/AboutUs.jsx';
import Services from '../components/Services.jsx';
import HowWeWork from '../components/HowWeWork.jsx';
// import ProofOfWork from '../components/ProofOfWork.jsx';
import Stats from '../components/Stats.jsx';
// import Testimonals from '../components/Testimonals.jsx';
import Contact from '../components/Contact.jsx';

const Homepage = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [location]);
  return (
    <div>
      <Hero />
      <AboutUs />
      <Stats />
      <Services />
      <HowWeWork />
      {/* <Testimonals /> */}
      {/* <ProofOfWork /> */}
      <Contact />
    </div>
  )
}

export default Homepage
