const Stats = () => {
    const stats = [
        { number: '10+', label: 'Years Experience' },
        { number: '3k+', label: 'Devices Fixed' },
        { number: '99%', label: 'Success Rate' },
        { number: '24/7', label: 'Support' },
    ];

    return (
        <section className="bg-purple-900 text-white py-12 relative z-20 -mt-2">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-purple-800/50">
                    {stats.map((stat, index) => (
                        <div key={index} className="p-4">
                            <h3 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-purple-200 mb-2">
                                {stat.number}
                            </h3>
                            <p className="text-sm md:text-base font-medium text-purple-200 uppercase tracking-widest">
                                {stat.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Stats;