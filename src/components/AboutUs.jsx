import About from '../assets/images/aboutimg.png';
import Aboutim from '../assets/images/aboutimg1.png'; 
const AboutUs = () => {
    return (
        <section id="about" className="font-sans text-slate-800">
            
           
            <div className="grid grid-cols-1 md:grid-cols-2 min-h-[500px]">
                {/* Text Content */}
                <div className="flex flex-col justify-center px-6 py-16 md:px-12 lg:px-20 bg-purple-50">
                    <div className="max-w-xl mx-auto md:mx-0">
                        <div className="inline-block px-3 py-1 mb-4 text-xs font-bold tracking-wider text-purple-700 uppercase bg-purple-100 rounded-full">
                            Who We Are
                        </div>
                        <h2 className="mb-6 text-3xl font-black text-purple-900 md:text-4xl lg:text-5xl">
                            About Us.
                        </h2>
                        <div className="space-y-6 text-lg leading-relaxed text-slate-600">
                            <p>
                                At <span className="font-bold text-purple-900">FaroukTechWorld Limited</span>, we are dedicated to providing top-notch technology repair services. Our team of skilled technicians is committed to delivering fast, reliable, and affordable solutions for all your tech needs.
                            </p>
                            <p>
                                Founded with the mission to help individuals and businesses stay connected in a rapidly evolving digital world, we pride ourselves on our customer-centric approach. We understand the frustration that comes with technical issues, and we strive to make the repair process as smooth and hassle-free as possible.
                            </p>
                            <p>
                                Whether you're dealing with a cracked screen, battery problems, or software glitches, we are here to help you get back on track quickly and efficiently.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Image Side */}
                <div className="relative h-72 md:h-auto min-h-[300px]">
                    <img 
                        src={Aboutim} 
                        alt="Technician repairing a device" 
                        className="absolute inset-0 w-full h-full object-cover" 
                    />
                </div>
            </div>

            {/* SECTION 2: Image Left, Text Right (Desktop) | Text Top, Image Bottom (Mobile) */}
            <div className="grid grid-cols-1 md:grid-cols-2 min-h-[500px]">
                
                {/* Text Content (Appears first on Mobile, Second on Desktop) */}
                <div className="flex flex-col justify-center px-6 py-16 md:px-12 lg:px-20 bg-white md:order-last">
                    <div className="max-w-xl mx-auto md:mx-0">
                        <div className="inline-block px-3 py-1 mb-4 text-xs font-bold tracking-wider text-indigo-700 uppercase bg-indigo-100 rounded-full">
                            Our Vision
                        </div>
                        <h2 className="mb-6 text-3xl font-black text-purple-900 md:text-4xl lg:text-5xl">
                            Our Mission.
                        </h2>
                        <div className="space-y-6 text-lg leading-relaxed text-slate-600">
                            <p>
                                Our mission is to provide exceptional technology repair services that exceed our customers' expectations. We are committed to using high-quality parts and the latest techniques to ensure that every repair is done right the first time.
                            </p>
                            <p>
                                We aim to build lasting relationships with our clients by offering transparent pricing, timely service, and unparalleled customer support. Our goal is to be the go-to destination for all technology repair needs.
                            </p>
                            <p>
                                At <span className="font-bold text-purple-900">FaroukTechWorld Limited</span>, we believe that technology should enhance your life, not complicate it. That's why we are dedicated to providing solutions that are not only effective but also convenient and affordable.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Image Side (Appears second on Mobile, First on Desktop) */}
                <div className="relative h-72 md:h-auto min-h-[300px] md:order-first">
                    <img 
                        src={About} 
                        alt="FaroukTechWorld Mission" 
                        className="absolute inset-0 w-full h-full object-cover" 
                    />
                </div>
            </div> 
        </section>
    );
};

export default AboutUs;