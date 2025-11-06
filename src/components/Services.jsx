import screen2 from '../assets/images/screen2.jpg';
import chargingport from '../assets/images/chargingport.jpg';
import battery from '../assets/images/battery1.jpg';
import software from '../assets/images/software.jpg';
import hero1 from '../assets/images/hero1.jpg';
import phone from '../assets/images/phone.jpg';
import { Link } from 'react-router-dom';

const servicesData = [
  {
    title: 'Screen Repairs',
    description: "Restore your device's visual clarity with our expert screen replacement service.",
    image: screen2,
    tag: 'Popular',
    price: 'From ₦10,000',
  },
  {
    title: 'Charging Port Repairs',
    description: "Fix charging issues fast with our professional port repair service.",
    image: chargingport,
    tag: 'Essential',
    price: 'From ₦7,500',
  },
  {
    title: 'Battery Replacement & Boosting',
    description: "Rejuvenate your device’s power with a fresh battery.",
    image: battery,
    tag: 'New',
    price: 'From ₦8,000',
  },
  {
    title: 'Software Issues',
    description: "We resolve glitches, crashes, and software bugs with expert diagnostics.",
    image: software,
    tag: 'Tech Support',
    price: 'From ₦5,000',
  },
  {
    title: 'Data Recovery',
    description: "Recover lost or corrupted files from phones, tablets, and drives.",
    image: hero1,
    tag: 'Critical',
    price: 'From ₦12,000',
  },
  {
    title: 'We Sell Too',
    description: "Explore our collection of certified pre-owned smartphones and accessories.",
    image: phone,
    tag: 'Shop',
    price: 'See Catalog',
  },
];

export default function Services() {
  return (
    <section className="bg-purple-50 py-12" id="services">
      <div className="px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold text-purple-900 mb-10 text-center">Our Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {servicesData.map((service, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              <img src={service.image} alt={service.title} className="w-full h-56 object-cover" />
              <div className="p-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-semibold text-purple-700">{service.title}</h3>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                    {service.tag}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-4">{service.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-800">{service.price}</span>
                  <Link to="/pricing">
                    <button className="text-sm px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                      Pricing
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
