import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
    {
        question: "How long does a screen repair take?",
        answer: "Most iPhone and Samsung screen replacements are completed within 45 to 60 minutes. iPad and more complex repairs may take 24-48 hours."
    },
    {
        question: "Will I lose my data?",
        answer: "No, in 99% of cases (screens, batteries, charging ports), your data remains safe. However, we always recommend backing up your device before any repair."
    },
    {
        question: "Do you offer a warranty?",
        answer: "Yes! We offer a 5-day warranty on all parts and labor. If the part fails due to a manufacturing defect, we will replace it for free."
    },
    {
        question: "Do I need an appointment?",
        answer: "Appointments are recommended to ensure the fastest service, but walk-ins are always welcome at our Mokola Hill center."
    }
];

const FAQ = () => {
    const [openIndex, setOpenIndex] = useState(null);

    return (
        <section className="py-20 bg-slate-50">
            <div className="max-w-3xl mx-auto px-6">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-black text-slate-900 mb-4">Frequently Asked Questions</h2>
                    <p className="text-slate-600">Got questions? We’ve got answers.</p>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, idx) => (
                        <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300 hover:shadow-md">
                            <button 
                                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                            >
                                <span className="font-bold text-slate-800 text-lg">{faq.question}</span>
                                {openIndex === idx ? <Minus className="text-purple-600" /> : <Plus className="text-slate-400" />}
                            </button>
                            
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openIndex === idx ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="p-6 pt-0 text-slate-600 leading-relaxed">
                                    {faq.answer}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FAQ;