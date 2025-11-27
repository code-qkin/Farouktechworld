
const Stats = () => {
    const stats = [
        { number: '98%',
         label: 'Success Rate', 
         discussion: 'Our high success rate reflects our commitment to quality repairs and customer satisfaction.' 
        },
        { number: '4.5/5',
         label: 'Customer Rating', 
         discussion: 'Our customers consistently rate us highly for our professionalism, expertise, and service quality.' 
        },
        { number: '1500+', 
          label: 'Devices Repaired', 
          discussion: 'We have successfully repaired over 1500 devices, showcasing our extensive experience in tech repairs.' 
        },
        { number: '500+', 
          label: 'Happy Clients', 
          discussion: 'We take pride in our extensive client base across Nigeria, reflecting our commitment to quality service and customer satisfaction. ' 
        },
        { number: '10+', 
          label: 'Years in Business', 
          discussion: 'With over a decade of experience, we bring unparalleled expertise and know-how to every repair job, ensuring high quality and your satisfaction.'
        },
        { number: '10', 
          label: 'Expert Technicians', 
          discussion: 'With their combined expertise, we deliver superior service and technical proficiency with every repair job.' 
        },
        { number: '24/7', 
          label: 'Customer Support', 
          discussion: 'Our dedicated support team is available around the clock to assist you with any inquiries or issues you may have.' 
        },
        
        { number: '99%',
          label: 'On-Time Repairs',
          discussion: 'We pride ourselves on our punctuality, ensuring that 99% of our repairs are completed within the promised timeframe.'
        },
    ];
    return (
        <section>
            <section className="py-16 bg-purple-800">
                <div className="mx-auto  px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 text-white lg:grid-cols-4 gap-8 text-center">
                        {stats.map((stat, index) => (
                            <div key={index} className="p-6">
                                <h3 className="text-3xl md:text-4xl font-bold text-white mb-2">
                                    {stat.number}
                                </h3>
                                <p className="text-lg font-medium">
                                    {stat.label}
                                </p>
                                <p className="mt-2 text-sm">
                                    {stat.discussion}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </section>
    )
}

export default Stats
