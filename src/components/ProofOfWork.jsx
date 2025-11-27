import { Link } from "react-router-dom";

const ProofOfWork = () => {
            const repairCases = [
        {
            id: 1,
            before: '/images/repairs/iphone-before-1.jpg',
            after: '/images/repairs/iphone-after-1.jpg',
            device: 'iPhone 13 Pro',
            issue: 'Shattered Screen Replacement',
            time: '30 minutes',
            category: 'screen'
        },
        {
            id: 2,
            before: '/images/repairs/samsung-before-1.jpg',
            after: '/images/repairs/samsung-after-1.jpg',
            device: 'Samsung Galaxy S21',
            issue: 'Water Damage Repair',
            time: '2 hours',
            category: 'water-damage'
        },
        {
            id: 3,
            before: '/images/repairs/iphone-before-2.jpg',
            after: '/images/repairs/iphone-after-2.jpg',
            device: 'iPhone 12',
            issue: 'Back Glass Replacement',
            time: '45 minutes',
            category: 'housing'
        },
    ];


        return (
            <section className="py-12 bg-gradient-to-br from-purple-100 to-gray-100">
                <div className="px-10">
                    <h2 className="text-3xl font-bold text-center mb-8 text-purple-800">Proof of Work</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {repairCases.map((project, index) => (
                            <div key={index} className="border rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow duration-300">
                                <div className="">
                                </div>
                                <img src={project.image} alt={project.title} className="w-full h-48 object-cover" />
                                <div className="p-4">
                                    <h3 className="text-lg font-semibold mb-2">{project.title}</h3>
                                    <p className="text-sm text-gray-600 mb-4">{project.description}</p>
                                    <Link to={`/projects/${project.id}`} className="text-purple-600 hover:underline">
                                        View Details
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="text-center mt-8">
                        <Link to="/proof-of-work" className="inline-block bg-purple-600 text-white px-6 py-3 rounded hover:bg-purple-700 transition-colors duration-300">
                            View All Works
                        </Link>
                    </div>
                </div>
            </section>  
        );
    };

export default ProofOfWork;