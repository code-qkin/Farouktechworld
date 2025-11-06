// import { useState } from 'react';
// import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';
// import Avatar from 'boring-avatars';

// const Testimonials = () => {
//   const testimonials = [
//   {
//     id: 1,
//     name: "Aisha B.",
//     device: "iPhone 11",
//     service: "Screen Replacement",
//     text: "FaroukTechWorld replaced my cracked iPhone screen in under an hour. It looks brand new! Their service was fast, affordable, and professional. Highly recommended for any phone issues.",
//   },
//   {
//     id: 2,
//     name: "Tunde O.",
//     device: "Samsung Galaxy S10",
//     service: "Battery Boost",
//     text: "My Samsung phone barely lasted half a day. FaroukTechWorld installed a new battery and optimized the system — now it runs like new. I’m impressed by their speed and honesty.",
//   },
//   {
//     id: 3,
//     name: "Chiamaka E.",
//     device: "iPhone XR",
//     service: "Charging Port Repair",
//     text: "I thought my phone was done for when it stopped charging. FaroukTechWorld diagnosed the issue and fixed the port within 30 minutes. No more wiggling cables — just smooth charging!",
//   },
//   {
//     id: 4,
//     name: "David T.",
//     device: "Google Pixel 6",
//     service: "Software Recovery",
//     text: "My phone was stuck in a boot loop and I was panicking. FaroukTechWorld recovered my data and restored the system without losing a single file. True lifesavers!",
//   },
//   {
//     id: 5,
//     name: "Lisa A.",
//     device: "iPhone 12 Pro",
//     service: "Phone Upgrade & Trade-In",
//     text: "I traded in my old phone and got a certified pre-owned upgrade from FaroukTechWorld. Great value, great condition, and amazing customer service. They even helped me transfer everything.",
//   }
// ];


//   const [currentIndex, setCurrentIndex] = useState(0);

//   const nextSlide = () => {
//     setCurrentIndex((prev) => (prev + 1) % testimonials.length);
//   };

//   const prevSlide = () => {
//     setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
//   };

//   const goToSlide = (index) => {
//     setCurrentIndex(index);
//   };

//   const currentTestimonial = testimonials[currentIndex];

//   return (
//     <div className="min-h-screen bg-purple-800" id="testimonials">

//       {/* Hero Section */}
//       <div className="relative overflow-hidden py-20 px-4">
//         <div className="max-w-7xl mx-auto text-center">
//           <div className="inline-block mb-4 px-4 py-2 bg-purple-500/20 rounded-full border border-purple-500/30">
//             <span className="text-purple-300 font-semibold">Client Success Stories</span>
//           </div>
//           <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
//             Testimonals
//           </h1>
//           <p className="text-xl md:text-2xl text-purple-200 max-w-3xl mx-auto leading-relaxed">
//             Don't just take our word for it. Here's what our amazing clients have to say about their experience with FaroukTechWorld
//           </p>
//         </div>
//       </div>



//       {/* Main Carousel */}
//       <div className="max-w-7xl mx-auto px-4 pb-20">
//         <div className="relative">

//           {/* Main Card */}
//           <div className="bg-gradient-to-br from-white to-purple-50 rounded-3xl shadow-2xl overflow-hidden">
//             <div className="grid md:grid-cols-5 gap-0">


//               <div className="md:col-span-2 bg-gradient-to-br from-purple-600 to-purple-800 p-8 md:p-12 flex flex-col justify-center items-center text-center relative overflow-hidden">

                
//                 <div className="relative z-10">
//                   <div className="mb-6">
//                     <div className="relative inline-block">
//                       <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl">
//                         <Avatar
//                           size={160}
//                           name={currentTestimonial.name}
//                           variant="beam"
//                           colors={["#6B21A8", "#A78BFA", "#C4B5FD", "#EDE9FE", "#F3E8FF"]}
//                         />
//                       </div>
//                       <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 border-4 border-purple-600">
//                         <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
//                           <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
//                         </svg>
//                       </div>
//                     </div>
//                   </div>
//                   <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
//                     {currentTestimonial.name}
//                   </h3>
//                   <p className="font-bold text-white mb-2">{currentTestimonial.device}</p>
//                   <p className="font-bold text-white mb-2">{currentTestimonial.service}</p>
//                 </div>
//               </div>
//               <div className="md:col-span-3 p-8 md:p-12 flex flex-col justify-center">
//                 <div className="mb-6">
//                   <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full">
//                     <Quote className="w-8 h-8 text-purple-600 fill-current" />
//                   </div>
//                 </div>
//                 <blockquote className="text-gray-700 text-xl md:text-2xl leading-relaxed mb-8 font-medium">
//                   "{currentTestimonial.text}"
//                 </blockquote>
//                 <div className="flex items-center gap-4">
//                   <button
//                     onClick={prevSlide}
//                     className="group bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl"
//                     aria-label="Previous testimonial"
//                   >
//                     <ChevronLeft className="w-6 h-6" />
//                   </button>
//                   <div className="flex-1 text-center">
//                     <span className="text-gray-600 font-semibold text-lg">
//                       {currentIndex + 1} / {testimonials.length}
//                     </span>
//                   </div>

//                   <button
//                     onClick={nextSlide}
//                     className="group bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl"
//                     aria-label="Next testimonial"
//                   >
//                     <ChevronRight className="w-6 h-6" />
//                   </button>
//                 </div>
//                 <div className="flex justify-center gap-2 mt-8">
//                   {testimonials.map((_, index) => (
//                     <button
//                       key={index}
//                       onClick={() => goToSlide(index)}
//                       className={`transition-all duration-300 rounded-full ${index === currentIndex
//                         ? 'w-12 h-3 bg-purple-600'
//                         : 'w-3 h-3 bg-gray-300 hover:bg-purple-400'
//                         }`}
//                       aria-label={`Go to testimonial ${index + 1}`}
//                     />
//                   ))}
//                 </div>
//               </div>
//             </div>
//           </div>
//           <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-purple-500/20 rounded-full blur-sm hidden md:block"></div>
//           <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-purple-500/20 rounded-full blur-sm hidden md:block"></div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Testimonials;
