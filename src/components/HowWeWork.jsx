import { PhoneCall, ClipboardCheck, Wrench } from 'lucide-react';

const steps = [
  {
    title: "1. Book or Walk In",
    desc: "Schedule online or visit our Ibadan center.",
    icon: <PhoneCall className="w-6 h-6" />,
  },
  {
    title: "2. Free Diagnosis",
    desc: "We inspect your device and give a quote.",
    icon: <ClipboardCheck className="w-6 h-6" />,
  },
  {
    title: "3. Fast Repair",
    desc: "Most repairs are done in under 60 minutes.",
    icon: <Wrench className="w-6 h-6" />,
  },
];

const HowWeWork = () => {
  return (
    <section className="py-20 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            
            {/* Left Text */}
            <div>
                <span className="text-purple-600 font-bold tracking-wider uppercase text-sm">Our Process</span>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-2 mb-6">Simple, Transparent, & Fast.</h2>
                <p className="text-lg text-slate-600 mb-8">
                    We know how important your device is. That’s why we’ve streamlined our repair process to get it back in your hands as quickly as possible.
                </p>
            </div>

            {/* Right Steps */}
            <div className="space-y-6">
                {steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-6 p-6 rounded-xl bg-slate-50 border border-slate-100 hover:border-purple-200 transition">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-purple-600 shrink-0">
                            {step.icon}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                            <p className="text-slate-500">{step.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

        </div>
      </div>
    </section>
  );
};

export default HowWeWork;