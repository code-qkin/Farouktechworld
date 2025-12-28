import { ShieldCheck, Zap, Award, Lock } from 'lucide-react';

const features = [
   
    {
        icon: <Zap size={32} />,
        title: "Same Day Repair",
        desc: "Most repairs, like screens and batteries, are completed in under 60 minutes."
    },
    {
        icon: <Award size={32} />,
        title: "Expert Technicians",
        desc: "Our team has over 10 years of experience handling complex board-level repairs."
    },
    {
        icon: <Lock size={32} />,
        title: "Data Privacy",
        desc: "Your data is safe with us. We adhere to strict privacy protocols during every repair."
    }
];

const WhyChooseUs = () => {
    return (
        <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Why Choose FaroukTechWorld?</h2>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        We combine speed, quality, and transparency to deliver the best repair experience in Ibadan.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, idx) => (
                        <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-purple-200 hover:shadow-lg transition-all duration-300 group text-center">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                            <p className="text-slate-500 leading-relaxed text-sm">
                                {feature.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default WhyChooseUs;