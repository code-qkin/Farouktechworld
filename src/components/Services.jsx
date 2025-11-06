import {
  MonitorSmartphone,
  ScreenShare,
  PlugZap,
  Eye,
  SmartphoneCharging,
  AlertCircle,
  BatteryCharging,
  Smartphone,
  BatteryFull,
  ScanLine,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const servicesData = [
  {
    title: 'Screen Repair',
    description: 'Expert restoration of cracked or malfunctioning screens to ensure optimal display performance.',
    icon: MonitorSmartphone,
    tag: 'Popular',
    price: 'From ₦10,000',
  },
  {
    title: 'Screen Replacement',
    description: 'High-quality screen replacements using OEM-grade components for a flawless visual experience.',
    icon: ScreenShare,
    tag: 'Essential',
    price: 'From ₦12,000',
  },
  {
    title: 'Charging Port Repair',
    description: 'Precision repair of faulty charging ports to restore reliable power connectivity.',
    icon: PlugZap,
    tag: 'Essential',
    price: 'From ₦7,500',
  },
  {
    title: 'FaceID Repair',
    description: 'Secure and accurate FaceID restoration for supported iPhone models.',
    icon: Eye,
    tag: 'Security',
    price: 'From ₦15,000',
  },
  {
    title: 'Backglass Repair',
    description: 'Professional replacement of shattered or scratched backglass with premium finishes.',
    icon: SmartphoneCharging,
    tag: 'Premium',
    price: 'From ₦18,000',
  },
  {
    title: 'White Screen Repair',
    description: 'Diagnosis and resolution of persistent white screen issues caused by hardware or software faults.',
    icon: AlertCircle,
    tag: 'Critical',
    price: 'From ₦9,000',
  },
  {
    title: 'Battery Replacement',
    description: 'Installation of new, high-capacity batteries to restore full-day performance.',
    icon: BatteryCharging,
    tag: 'New',
    price: 'From ₦8,000',
  },
  {
    title: 'Casing Change',
    description: 'Refresh your device’s appearance with a complete casing replacement.',
    icon: Smartphone,
    tag: 'Style',
    price: 'From ₦10,000',
  },
  {
    title: 'Battery Boosting',
    description: 'Optimize battery health and performance through advanced calibration techniques.',
    icon: BatteryFull,
    tag: 'Performance',
    price: 'From ₦6,000',
  },
  {
    title: 'Line Removal',
    description: 'Eliminate display lines and restore screen clarity with precision repair.',
    icon: ScanLine,
    tag: 'Display',
    price: 'From ₦7,000',
  },
];

export default function Services() {
  return (
    <section className="bg-purple-50 py-16" id="services">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-extrabold text-purple-900 mb-12 text-center">Our Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {servicesData.map((service, index) => {
            const Icon = service.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 flex flex-col justify-between h-full"
              >
                <div className="flex flex-col items-center text-center mb-6">
                  <Icon size={48} className="text-purple-600 mb-4" />
                  <h3 className="text-xl font-semibold text-purple-700">{service.title}</h3>
                  <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full mt-2">
                    {service.tag}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-6">{service.description}</p>
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-sm font-medium text-purple-800">{service.price}</span>
                  <Link to="/pricing">
                    <button className="text-sm px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition">
                      Pricing
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
