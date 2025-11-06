import heroBg from '../assets/images/howwework.png'
import {Link} from "react-router-dom";
const Hero = () => {
  return (
    <>
      <section className="relative h-screen">
        <img src={heroBg} className="absolute inset-0 w-full h-full object-cover" />
        <div className="relative z-10 h-screen bg-black bg-opacity-60 flex items-center justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
            <div className="text-left col-span-2 text-white px-4">
              <p className="text-6xl font-bold mb-2 text-purple-400">
                Welcome to FaroukTechWorld Limited
              </p>
              <p className="text-lg text-2xl text-purple-400 mb-2">
                Don't Delay, Repair Today.
              </p>
              <p className="text-lg text-2xl text-purple-400 mb-2">
                Don't let technical troubles slow you down. At FaroukTechWorld, we're here to breathe new life into your devices, swiftly & seamlessly.
              </p>
              <Link to="/pricing">
                <button className="bg-purple-800 text-white px-6 py-3 rounded hover:bg-purple-700 transition">
                  Get a quote today
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default Hero
