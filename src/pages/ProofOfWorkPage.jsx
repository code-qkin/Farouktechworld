import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, X, Phone, Quote, LogOut } from 'lucide-react';
import Proofofwork from '../assets/images/hero.png';
import { Link } from "react-router-dom";
import Stats from '../components/Stats';

const ProofOfWorkPage = () => {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedComparison, setSelectedComparison] = useState(null);
    const [visibleCount, setVisibleCount] = useState(6);

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
        {
            id: 4,
            before: '/images/repairs/ipad-before.jpg',
            after: '/images/repairs/ipad-after.jpg',
            device: 'iPad Air',
            issue: 'LCD Screen Replacement',
            time: '1 hour',
            category: 'screen'
        },
        {
            id: 5,
            before: '/images/repairs/charging-port-before.jpg',
            after: '/images/repairs/charging-port-after.jpg',
            device: 'Google Pixel 6',
            issue: 'Charging Port Replacement',
            time: '25 minutes',
            category: 'charging'
        },
        {
            id: 6,
            before: '/images/repairs/battery-before.jpg',
            after: '/images/repairs/battery-after.jpg',
            device: 'iPhone 11',
            issue: 'Battery Replacement',
            time: '20 minutes',
            category: 'battery'
        },
        {
            id: 7,
            before: '/images/repairs/iphone-before-3.jpg',
            after: '/images/repairs/iphone-after-3.jpg',
            device: 'iPhone 14 Pro',
            issue: 'Camera Repair',
            time: '40 minutes',
            category: 'camera'
        },
        {
            id: 8,
            before: '/images/repairs/samsung-before-2.jpg',
            after: '/images/repairs/samsung-after-2.jpg',
            device: 'Samsung Galaxy S23',
            issue: 'Screen & Battery',
            time: '1 hour',
            category: 'screen'
        },
        {
            id: 9,
            before: '/images/repairs/iphone-before-4.jpg',
            after: '/images/repairs/iphone-after-4.jpg',
            device: 'iPhone 15',
            issue: 'Water Damage',
            time: '2.5 hours',
            category: 'water-damage'
        },
        {
            id: 10,
            before: '/images/repairs/ipad-before-2.jpg',
            after: '/images/repairs/ipad-after-2.jpg',
            device: 'iPad Pro',
            issue: 'Screen Replacement',
            time: '1.5 hours',
            category: 'screen'
        },
        {
            id: 11,
            before: '/images/repairs/pixel-before.jpg',
            after: '/images/repairs/pixel-after.jpg',
            device: 'Google Pixel 7',
            issue: 'Back Glass',
            time: '35 minutes',
            category: 'housing'
        },
        {
            id: 12,
            before: '/images/repairs/iphone-before-5.jpg',
            after: '/images/repairs/iphone-after-5.jpg',
            device: 'iPhone 13',
            issue: 'Battery & Charging',
            time: '45 minutes',
            category: 'battery'
        }
    ];

    const categories = [
        { id: 'all', name: 'All Repairs', count: repairCases.length },
        { id: 'screen', name: 'Screen Repairs', count: repairCases.filter(item => item.category === 'screen').length },
        { id: 'battery', name: 'Battery', count: repairCases.filter(item => item.category === 'battery').length },
        { id: 'water-damage', name: 'Water Damage', count: repairCases.filter(item => item.category === 'water-damage').length },
        { id: 'housing', name: 'Housing', count: repairCases.filter(item => item.category === 'housing').length },
        { id: 'charging', name: 'Charging', count: repairCases.filter(item => item.category === 'charging').length },
        { id: 'camera', name: 'Camera', count: repairCases.filter(item => item.category === 'camera').length }
    ];

    const filteredCases = selectedCategory === 'all'
        ? repairCases
        : repairCases.filter(item => item.category === selectedCategory);

    const visibleCases = filteredCases.slice(0, visibleCount);
    const hasMore = visibleCount < filteredCases.length;
    const showLess = visibleCount > 6;

    const handleViewMore = () => {
        if (hasMore) {
            setVisibleCount(prev => prev + 6);
        } else if (showLess) {
            setVisibleCount(6);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <section className="relative">
                <img src={Proofofwork} className="absolute inset-0 w-full h-full object-cover" />
                <div className="relative z-10 h-screen bg-black bg-opacity-60 flex items-center justify-center">
                    <div className="container mx-auto px-4 text-center relative z-10">
                        <h1 className="text-5xl md:text-6xl text-purple-400 font-bold mb-6">
                            Proof Of Work
                        </h1>
                        <h1 className="text-5xl md:text-6xl text-purple-400 font-bold mb-6">
                            Before & After Repairs
                        </h1>
                        <p className="text-xl md:text-2xl text-purple-400 opacity-90 max-w-2xl mx-auto">
                            See the transformation from broken to brand new
                        </p>
                    </div>
                </div>
            </section>

            {/* Statistics */}
            <Stats />

            {/* Category Filter */}
            <section className="py-12 bg-gray-50">
                <div className="container mx-auto px-4">
                    <div className="flex flex-wrap justify-center gap-4">
                        {categories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => {
                                    setSelectedCategory(category.id);
                                    setVisibleCount(6);
                                }}
                                className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${selectedCategory === category.id
                                    ? 'bg-purple-600 text-white shadow-lg'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {category.name}
                                <span className={`ml-2 text-sm px-2 py-1  rounded-full ${selectedCategory === category.id
                                    ? 'bg-white text-purple-600' 
                                    : 'bg-gray-200'
                                    }`}>
                                    {category.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Before & After Gallery */}
            <section className="py-16 bg-gray-50">
                <div className="px-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                        {visibleCases.map((caseItem) => (
                            <div
                                key={caseItem.id}
                                className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
                                onClick={() => setSelectedComparison(caseItem)}
                            >
                                {/* Before & After Images */}
                                <div className="grid grid-cols-2 gap-0">
                                    <div className="relative group">
                                        <div className="absolute top-0 left-0 w-full bg-purple-800 text-white py-1 text-center text-sm font-semibold z-10">
                                            BEFORE
                                        </div>
                                        <img
                                            src={caseItem.before}
                                            alt={`${caseItem.device} before repair`}
                                            className="w-full h-64 object-cover group-hover:opacity-90 transition-opacity duration-300"
                                        />
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute top-0 left-0 w-full bg-purple-800 text-white py-1 text-center text-sm font-semibold z-10">
                                            AFTER
                                        </div>
                                        <img
                                            src={caseItem.after}
                                            alt={`${caseItem.device} after repair`}
                                            className="w-full h-64 object-cover group-hover:opacity-90 transition-opacity duration-300"
                                        />
                                    </div>
                                </div>

                                {/* Repair Details */}
                                <div className="p-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                                        {caseItem.device}
                                    </h3>
                                    <p className="text-gray-600 mb-3">
                                        {caseItem.issue}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="bg-gray-300 text-gray-600 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                                            {categories.find(cat => cat.id === caseItem.category)?.name}
                                        </span>
                                        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                                            
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Empty State */}
                    {filteredCases.length === 0 && (
                        <div className="text-center py-16">
                            <div className="text-6xl mb-4">🔧</div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                No repairs found
                            </h3>
                            <p className="text-gray-600">
                                Try selecting a different category
                            </p>
                        </div>
                    )}

                    {/* View More/Less Button */}
                    {(hasMore || showLess) && filteredCases.length > 0 && (
                        <div className="text-center mt-12">
                            <button
                                onClick={handleViewMore}
                                className="bg-purple-800 text-white px-8 py-3 rounded-full font-semibold hover:bg-purple-700 transition-colors duration-300 flex items-center gap-2 mx-auto"
                            >
                                {hasMore ? (
                                    <>
                                        View More <ChevronDown size={20} />
                                    </>
                                ) : (
                                    <>
                                        Show Less <ChevronUp size={20} />
                                    </>
                                )}
                            </button>
                            <p className="text-gray-600 mt-2">
                                Showing {visibleCases.length} of {filteredCases.length} repairs
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* Comparison Modal */}
            {selectedComparison && (
                <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
                        <div className="relative">
                            <button
                                onClick={() => setSelectedComparison(null)}
                                className="absolute top-12 text-white right-4 bg-purple-900 rounded-full p-2 shadow-lg hover:bg-purple-400 z-10"
                            >
                                <X size={24} />
                            </button>

                            {/* Before & After Comparison */}
                            <div className="grid grid-cols-2 gap-0">
                                <div className="relative">
                                    <div className="absolute top-0 left-0 w-full bg-purple-800 text-white py-2 text-center font-bold text-lg z-10">
                                        BEFORE REPAIR
                                    </div>
                                    <img
                                        src={selectedComparison.before}
                                        alt={`${selectedComparison.device} before repair`}
                                        className="w-full h-96 object-cover"
                                    />
                                </div>
                                <div className="relative">
                                    <div className="absolute top-0 left-0 w-full bg-purple-800 text-white py-2 text-center font-bold text-lg z-10">
                                        AFTER REPAIR
                                    </div>
                                    <img
                                        src={selectedComparison.after}
                                        alt={`${selectedComparison.device} after repair`}
                                        className="w-full h-96 object-cover"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Modal Details */}
                        <div className="p-6">
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                {selectedComparison.device}
                            </h3>
                            <p className="text-gray-600 text-lg mb-4">
                                {selectedComparison.issue}
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="bg-gray-300 text-gray-600 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                                    Category: {categories.find(cat => cat.id === selectedComparison.category)?.name}
                                </span>
                                <span className="bg-gray-100 text-gray-700 px-4 py-2 rounded-full text-sm font-medium">
                                    
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-br from-purple-100 to-gray-100 text-purple-800">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6">
                        Ready to Fix Your Device?
                    </h2>
                    <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
                        See your device in our next before & after transformation
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button className="bg-purple-800 text-white flex gap-4 items-center px-8 py-4 rounded-full font-bold text-lg hover:bg-purple-700 transition-colors duration-300 shadow-lg">                         
                                Contact Us <Phone size={20} />                            
                        </button>
                        <button className="border-2 flex gap-4 items-center border-purple-800 text-purple-800 px-8 py-4 rounded-full font-bold text-lg  hover:text-purple-600 transition-all duration-300">
                            Get a Free Quote <Quote size={20} />
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ProofOfWorkPage;