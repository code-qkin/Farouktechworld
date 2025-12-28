import React, { useState } from 'react';
import { Mail, MapPin, Phone, Clock, Send } from 'lucide-react';

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    window.location.href = `mailto:farouktechworld@gmail.com?subject=Inquiry from ${form.name}&body=${form.message}`;
  };

  return (
    <section id="contact" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
            
            {/* Info Side */}
            <div className="bg-purple-900 p-10 text-white flex flex-col justify-between">
                <div>
                    <h2 className="text-3xl font-black mb-6">Let's Talk Tech.</h2>
                    <p className="text-purple-200 mb-10 text-lg">Visit our service center or drop us a message. We usually reply within an hour.</p>
                    
                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <MapPin className="w-6 h-6 text-purple-300 mt-1" />
                            <div>
                                <h3 className="font-bold text-lg">Visit Us</h3>
                                <p className="text-purple-200">Mokola Rd, Mokola Hill,<br/>Ibadan 200285, Oyo State</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Phone className="w-6 h-6 text-purple-300 mt-1" />
                            <div>
                                <h3 className="font-bold text-lg">Call Us</h3>
                                <p className="text-purple-200">+234 809 511 5931</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Clock className="w-6 h-6 text-purple-300 mt-1" />
                            <div>
                                <h3 className="font-bold text-lg">Opening Hours</h3>
                                <p className="text-purple-200">Mon - Sat: 9am - 6pm</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Map Embed */}
                <div className="mt-10 rounded-xl overflow-hidden h-48 border border-purple-700/50">
                    <iframe 
                        title="Map" 
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        src="https://maps.google.com/maps?q=FaroukTechWorld%20Ibadan&t=&z=13&ie=UTF8&iwloc=&output=embed"
                    ></iframe>
                </div>
            </div>

            {/* Form Side */}
            <div className="p-10 lg:p-16">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Send a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Your Name</label>
                        <input 
                            type="text" name="name" required 
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition"
                            placeholder="John Doe"
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                        <input 
                            type="email" name="email" required 
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition"
                            placeholder="john@example.com"
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Message</label>
                        <textarea 
                            name="message" rows="4" required 
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition"
                            placeholder="How can we help you?"
                            onChange={handleChange}
                        ></textarea>
                    </div>
                    <button type="submit" className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl hover:bg-purple-700 transition shadow-lg flex items-center justify-center gap-2">
                        Send Message <Send size={18}/>
                    </button>
                </form>
            </div>

        </div>
      </div>
    </section>
  );
};

export default Contact;