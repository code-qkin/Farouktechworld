import { PhoneCall, ClipboardCheck, Wrench } from 'lucide-react';

const steps = [
  {
    title: "Contact Us",
    description: "Reach out via phone, email, or our online form to discuss your tech repair needs.",
    icon: <PhoneCall className="w-8 h-8 text-purple-600" />,
    step: 1,
  },
  {
    title: "Get a Quote",
    description: "Receive a transparent and competitive quote for the repair services you need.",
    icon: <ClipboardCheck className="w-8 h-8 text-purple-600" />,
    step: 2,
  },
  {
    title: "Fast Repair",
    description: "Our skilled technicians will promptly repair your device with high-quality parts and care.",
    icon: <Wrench className="w-8 h-8 text-purple-600" />,
    step: 3,
  },
];

const HowWeWork = () => {
  return (
    <section className="bg-gradient-to-br from-purple-50 to-white text-purple-900 py-16 px-16  transition-all duration-500">
      <div className="mx-auto">
        <h2 className="text-4xl font-extrabold text-center mb-12">How We Work</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div
              key={step.step}
              className="bg-white text-purple-800 rounded-xl shadow-lg p-6 text-center hover:scale-105 transition-transform duration-300"
            >
              <div className="flex justify-center mb-4">
                <div className="bg-purple-100 p-4 rounded-full shadow-md">
                  {step.icon}
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">{step.title}</h3>
              <p className="text-gray-700">{step.description}</p>
              <div className="mt-4">
                <span className="inline-block bg-purple-600 text-white rounded-full px-3 py-1 text-sm font-semibold">
                  Step {step.step}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowWeWork;
