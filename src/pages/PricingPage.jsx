import React, { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import { Search, Smartphone, ChevronRight, Filter } from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';

const formatCurrency = (amount) => amount > 0 ? `₦${Number(amount).toLocaleString()}` : "Contact Us";

const PricingPage = () => {
    const [pricingData, setPricingData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                // Fetch ALL services from Firestore
                const q = query(collection(db, "Services"));
                const snap = await getDocs(q);
                const data = snap.docs.map(d => d.data());
                setPricingData(data);
            } catch (err) {
                console.error("Failed to load prices", err);
            } finally {
                setLoading(false);
            }
        };
        fetchPrices();
    }, []);

    // Extract unique categories dynamically
    const categories = ['All', ...new Set(pricingData.map(item => item.service))].sort();

    // Filter Logic
    const filteredData = pricingData.filter(item => {
        const matchesSearch = item.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              item.service.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'All' || item.service === activeCategory;
        return matchesSearch && matchesCategory;
    });

    // Group by Service for better display
    const groupedData = filteredData.reduce((acc, item) => {
        if (!acc[item.service]) acc[item.service] = [];
        acc[item.service].push(item);
        return acc;
    }, {});

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-900">
            
            {/* Header */}
            <div className="bg-slate-900 text-white pt-32 pb-16 px-6 text-center">
                <h1 className="text-3xl md:text-5xl font-black mb-4">Service Pricing</h1>
                <p className="text-slate-400 max-w-xl mx-auto text-lg">Transparent repair costs for every iPhone model.</p>
                
                {/* Search Bar */}
                <div className="max-w-md mx-auto mt-8 relative">
                    <Search className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                    <input 
                        className="w-full pl-12 pr-6 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/20 transition"
                        placeholder="Search your model (e.g. iPhone 13 Pro)..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col lg:flex-row gap-8">
                
                {/* Sidebar Filters (Desktop) */}
                <div className="hidden lg:block w-64 shrink-0 space-y-2">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Filter size={18}/> Categories</h3>
                    {categories.map(cat => (
                        <button 
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold transition flex justify-between items-center ${activeCategory === cat ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
                        >
                            {cat}
                            {activeCategory === cat && <ChevronRight size={16}/>}
                        </button>
                    ))}
                </div>

                {/* Mobile Filter (Dropdown) */}
                <div className="lg:hidden">
                    <select 
                        className="w-full p-3 rounded-xl border border-gray-200 bg-white font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500"
                        value={activeCategory}
                        onChange={e => setActiveCategory(e.target.value)}
                    >
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>

                {/* Content Grid */}
                <div className="flex-1">
                    {loading ? (
                        <div className="text-center py-20 text-slate-400">Loading price list...</div>
                    ) : (
                        <div className="space-y-8">
                            {Object.keys(groupedData).length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-200">
                                    <Smartphone size={48} className="mx-auto text-slate-300 mb-4"/>
                                    <p className="text-slate-500 font-medium">No services found for your search.</p>
                                </div>
                            ) : (
                                Object.entries(groupedData).map(([serviceName, items]) => (
                                    <div key={serviceName} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                            <h3 className="font-black text-slate-800 text-lg">{serviceName}</h3>
                                            <span className="text-xs font-bold bg-white border border-gray-200 px-3 py-1 rounded-full text-slate-500">{items.length} Models</span>
                                        </div>
                                        <div className="divide-y divide-gray-50">
                                            {items.map((item, idx) => (
                                                <div key={idx} className="px-6 py-4 flex justify-between items-center hover:bg-purple-50/30 transition group">
                                                    <span className="font-medium text-slate-700 flex items-center gap-2">
                                                        <Smartphone size={16} className="text-slate-300 group-hover:text-purple-500 transition"/> {item.model}
                                                    </span>
                                                    <span className="font-mono font-bold text-slate-900 group-hover:text-purple-700 transition">
                                                        {formatCurrency(item.price)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            <Footer />
        </div>
    );
};

export default PricingPage;