import React, { useState } from 'react';

const Coontact = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const mailtoLink = `mailto:farouktechworld@gmail.com?subject=Repair Inquiry from ${encodeURIComponent(form.name)}&body=${encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone}\n\nMessage:\n${form.message}`
    )}`;
    window.location.href = mailtoLink;
  };

  return (
    <section id="contact" className="bg-purple-50 py-16 px-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Contact Info */}
        <div>
          <h2 className="text-4xl font-extrabold text-purple-900 mb-6">Get in Touch</h2>
          <p className="text-lg text-gray-700 mb-6">
            Whether you need a quick phone repair, have questions about our services, or want to partner with us — we’re here to help.
          </p>

          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="text-purple-800 font-semibold">📍 Address</h3>
              <p>FaroukTechWorld Limited<br />Mokola Rd, Mokola Hill, Ibadan 200285, Oyo State</p>
            </div>
            <div>
              <h3 className="text-purple-800 font-semibold">📞 Phone</h3>
              <p><a href="tel:+2348012345678" className="text-purple-600 hover:underline">+234 809 511 5931</a></p>
            </div>
            <div>
              <h3 className="text-purple-800 font-semibold">📧 Email</h3>
              <p><a href="mailto:farouktechworld@gmail.com" className="text-purple-600 hover:underline">farouktechworld@gmail.com</a></p>
            </div>
            <div>
              <h3 className="text-purple-800 font-semibold">🕒 Hours</h3>
              <p>Mon–Sat: 9am – 6pm<br />Sun: Closed</p>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h3 className="text-2xl font-bold text-purple-900 mb-6">Send Us a Message</h3>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">Your Message</label>
              <textarea
                id="message"
                name="message"
                rows="4"
                value={form.message}
                onChange={handleChange}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-purple-500 focus:border-purple-500"
              ></textarea>
            </div>
            <button
              type="submit"
              className="w-full bg-purple-700 text-white py-3 px-6 rounded-md hover:bg-purple-800 transition duration-300 font-semibold"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>

      {/* Google Map */}
      <div className="mt-10">
        <iframe
          title="FaroukTechWorld Location"
          src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d387.89319566024034!2d3.8895543017376464!3d7.407050030240789!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x10398d359b893faf%3A0x50ba61945248350f!2sFarouktechworld!5e1!3m2!1sen!2sng!4v1762162727366!5m2!1sen!2sng"
          width="100%"
          height="400"
          style={{ border: 0 }}
          allowFullScreen=""
          loading="lazy"
          className="rounded-xl shadow-md"
        ></iframe>
      </div>
    </section>
  );
};

export default Coontact;
