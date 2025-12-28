import {
  MonitorSmartphone, ScreenShare, PlugZap, Eye, SmartphoneCharging,
  AlertCircle, BatteryCharging, Smartphone, BatteryFull, ScanLine, ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const servicesData = [
  { title: 'Screen Repair', desc: 'Expert restoration of cracked screens.', icon: MonitorSmartphone, price: '10,000' },
  { title: 'Battery Replacement', desc: 'New batteries for full-day power.', icon: BatteryCharging, price: '8,000' },
  { title: 'Charging Port', desc: 'Fix connectivity and charging issues.', icon: PlugZap, price: '7,500' },
  { title: 'FaceID Repair', desc: 'Restore facial recognition security.', icon: Eye, price: '15,000' },
  { title: 'Back Glass', desc: 'Laser precision back glass replacement.', icon: SmartphoneCharging, price: '18,000' },
  { title: 'Software Fixes', desc: 'Resolve boot loops and glitches.', icon: AlertCircle, price: '9,000' },
];

export default function Services() {
  return (
    <section id="services" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">World-Class Repair Services</h2>
          <p className="text-lg text-slate-600">
            We use OEM-grade parts and advanced diagnostics to bring your device back to life.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {servicesData.map((service, index) => {
            const Icon = service.icon;
            return (
              <div key={index} className="group bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors">
                  <Icon className="w-7 h-7 text-purple-600 group-hover:text-white transition-colors" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-3">{service.title}</h3>
                <p className="text-slate-500 mb-6 leading-relaxed">{service.desc}</p>
                
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                    <span className="text-sm font-bold text-slate-400">From ₦{service.price}</span>
                    <Link to="/pricing" className="text-purple-600 font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all">
                        View Pricing <ArrowRight size={16}/>
                    </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12">
            <Link to="/pricing" className="inline-block bg-slate-900 text-white px-8 py-4 rounded-full font-bold hover:bg-slate-800 transition shadow-lg">
                View Full Price List
            </Link>
        </div>
      </div>
    </section>
  );
}