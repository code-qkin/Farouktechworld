import About from '../assets/images/aboutimg.jpg';
import Aboutim from '../assets/images/aboutimg1.jpg';
const AboutUs = () => {
    return (
        <section id="about" className="bg-gradient-to-br from-purple-100 to-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <h2 className="text-3xl font-extrabold text-purple-900 mb-6">About Us.</h2>
                    <p className="text-lg text-gray-700 mb-4">
                        At FaroukTechWorld Limited, we are dedicated to providing top-notch technology repair services. Our team of skilled technicians is committed to delivering fast, reliable, and affordable solutions for all your tech needs.
                    </p>
                    <p className="text-lg text-gray-700 mb-4">
                        Founded with the mission to help individuals and businesses stay connected in a rapidly evolving digital world, we pride ourselves on our customer-centric approach. We understand the frustration that comes with technical issues, and we strive to make the repair process as smooth and hassle-free as possible.
                    </p>
                    <p className="text-lg text-gray-700">
                        Whether you're dealing with a cracked screen, battery problems, or software glitches, FaroukTechWorld Limited is here to help you get back on track quickly and efficiently.
                    </p>
                </div>
                <div>
                    <img src={Aboutim} alt="About Us" className="w-full h-full object-cover" />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
                <div>
                    <img src={About} alt="About Us" className="w-full h-full object-cover" />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <h2 className="text-3xl font-extrabold text-purple-900 mb-6">Our Mission.</h2>
                    <p className="text-lg text-gray-700 mb-4">
                        Our mission at FaroukTechWorld Limited is to provide exceptional technology repair services that exceed our customers' expectations. We are committed to using high-quality parts and the latest techniques to ensure that every repair is done right the first time.
                    </p>
                    <p className="text-lg text-gray-700 mb-4">
                        We aim to build lasting relationships with our clients by offering transparent pricing, timely service, and unparalleled customer support. Our goal is to be the go-to destination for all technology repair needs, helping our customers stay connected and productive in an increasingly digital world.
                    </p>
                    <p className="text-lg text-gray-700">
                        At FaroukTechWorld Limited, we believe that technology should enhance your life, not complicate it. That's why we are dedicated to providing solutions that are not only effective but also convenient and affordable.
                    </p>
                </div>
            </div> 
        </section>
    )
}

export default AboutUs
