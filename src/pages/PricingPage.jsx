import React, { useState, useEffect, useMemo } from 'react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import { 
    Search, Smartphone, ChevronRight, Filter, 
    MonitorSmartphone, BatteryCharging, PlugZap, Eye, 
    Wrench, ArrowLeft, Grid
} from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, query, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

// Helper to assign icons dynamically based on service name
const getServiceIcon = (name) => {
    const n = name.toLowerCase();
    if (n.includes('screen') || n.includes('display') || n.includes('touch')) return MonitorSmartphone;
    if (n.includes('battery') || n.includes('power')) return BatteryCharging;
    if (n.includes('charging') || n.includes('port')) return PlugZap;
    if (n.includes('face') || n.includes('camera') || n.includes('lens')) return Eye;
    if (n.includes('housing') || n.includes('glass') || n.includes('frame')) return Smartphone;
    return Wrench;
};

const PricingPage = () => {
    const [pricingData, setPricingData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Overview'); // Default is Overview (Categories Grid)

    useEffect(() => {
        const fetchPrices = async () => {
            try {
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

    // 1. Extract Categories
    const categories = useMemo(() => [...new Set(pricingData.map(item => item.service))].sort(), [pricingData]);

    // 2. Filter Logic
    const filteredData = useMemo(() => {
        return pricingData.filter(item => {
            const matchesSearch = item.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  item.service.toLowerCase().includes(searchTerm.toLowerCase());
            
            // If searching, search EVERYTHING. If not, respect category.
            const matchesCategory = searchTerm ? true : (activeCategory === 'Overview' ? true : item.service === activeCategory);
            
            return matchesSearch && matchesCategory;
        });
    }, [pricingData, searchTerm, activeCategory]);

    // 3. Group Data (For both Grid and List views)
    const groupedData = useMemo(() => {
        return filteredData.reduce((acc, item) => {
            if (!acc[item.service]) acc[item.service] = [];
            acc[item.service].push(item);
            return acc;
        }, {});
    }, [filteredData]);

    // 4. Calculate Stats for Grid View (Overview)
    const categoryStats = useMemo(() => {
        return categories.map(cat => {
            const items = pricingData.filter(i => i.service === cat);
            const minPrice = Math.min(...items.map(i => i.price).filter(p => p > 0));
            return {
                name: cat,
                count: items.length,
                startingPrice: isFinite(minPrice) ? minPrice : 0,
                icon: getServiceIcon(cat)
            };
        });
    }, [categories, pricingData]);

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-900">
            
            {/* --- HEADER --- */}
            <div className="bg-slate-900 text-white pt-32 pb-16 px-6 text-center relative overflow-hidden">
                <div className="relative z-10 max-w-4xl mx-auto">
                    <h1 className="text-3xl md:text-5xl font-black mb-4">Service Pricing</h1>
                    <p className="text-slate-400 max-w-xl mx-auto text-lg mb-8">Transparent repair costs for every iPhone model.</p>
                    
                    {/* Search Bar */}
                    <div className="max-w-md mx-auto relative">
                        <Search className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                        <input 
                            className="w-full pl-12 pr-6 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/20 transition font-bold"
                            placeholder="Search your model (e.g. iPhone 13 Pro)..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col lg:flex-row gap-8">
                
                {/* --- SIDEBAR (Desktop) --- */}
                <div className="hidden lg:block w-72 shrink-0 space-y-2 sticky top-28 h-fit">
                    <h3 className="font-bold mb-4 flex items-center gap-2 px-2 uppercase text-xs tracking-wider text-slate-500">
                        <Filter size={14}/> Categories
                    </h3>
                    
                    {/* Overview Button */}
                    <button 
                        onClick={() => { setActiveCategory('Overview'); setSearchTerm(''); }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition flex justify-between items-center ${activeCategory === 'Overview' && !searchTerm ? 'bg-purple-900 text-white shadow-md' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
                    >
                        <span className="flex items-center gap-2"><Grid size={16}/> Overview</span>
                        {activeCategory === 'Overview' && !searchTerm && <ChevronRight size={16}/>}
                    </button>

                    {/* Category List */}
                    {categories.map(cat => (
                        <button 
                            key={cat}
                            onClick={() => { setActiveCategory(cat); setSearchTerm(''); }}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition flex justify-between items-center ${activeCategory === cat && !searchTerm ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
                        >
                            {cat}
                            {activeCategory === cat && !searchTerm && <ChevronRight size={16}/>}
                        </button>
                    ))}
                </div>

                {/* --- MOBILE NAV (Dropdown) --- */}
                <div className="lg:hidden sticky top-20 z-20 bg-slate-50 py-2">
                    <div className="relative">
                        <Filter className="absolute left-4 top-3.5 text-purple-600 pointer-events-none" size={18}/>
                        <select 
                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-white font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500 shadow-sm appearance-none"
                            value={activeCategory}
                            onChange={e => { setActiveCategory(e.target.value); setSearchTerm(''); }}
                        >
                            <option value="Overview">📂 Service Overview</option>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <ChevronRight className="absolute right-4 top-4 text-gray-400 rotate-90 pointer-events-none" size={16}/>
                    </div>
                </div>

                {/* --- MAIN CONTENT --- */}
                <div className="flex-1">
                    {loading ? (
                        <div className="text-center py-20 text-slate-400 font-medium">Loading price list...</div>
                    ) : (
                        <div className="space-y-8">

                            {/* VIEW 1: CATEGORY GRID (Overview) - Only show if NO search & 'Overview' selected */}
                            {activeCategory === 'Overview' && !searchTerm ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                                    {categoryStats.map((stat) => (
                                        <div 
                                            key={stat.name} 
                                            onClick={() => setActiveCategory(stat.name)}
                                            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-purple-300 hover:shadow-xl cursor-pointer transition-all group relative overflow-hidden"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="bg-purple-50 w-12 h-12 rounded-xl flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                                    <stat.icon size={24} />
                                                </div>
                                                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                                                    {stat.count} Models
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-black text-slate-900 mb-1">{stat.name}</h3>
                                            <p className="text-sm text-slate-500 font-medium">
                                                {stat.startingPrice > 0 ? `From ${formatCurrency(stat.startingPrice)}` : 'Contact for Price'}
                                            </p>
                                            
                                            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                                <ChevronRight className="text-purple-600" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* VIEW 2: DETAILED LIST (Specific Category OR Search Results) */
                                <div className="animate-in fade-in slide-in-from-bottom-2">
                                    {/* Back Button (Only if not searching) */}
                                    {!searchTerm && (
                                        <button 
                                            onClick={() => setActiveCategory('Overview')}
                                            className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-purple-700 transition w-fit"
                                        >
                                            <ArrowLeft size={16}/> Back to Categories
                                        </button>
                                    )}

                                    {/* Search Results Header */}
                                    {searchTerm && (
                                        <div className="mb-6 pb-4 border-b border-slate-200">
                                            <h2 className="text-xl font-bold text-slate-900">
                                                Search Results for <span className="text-purple-600">"{searchTerm}"</span>
                                            </h2>
                                            <p className="text-sm text-slate-500">Found {filteredData.length} matches</p>
                                        </div>
                                    )}

                                    {/* Price Tables */}
                                    {Object.keys(groupedData).length === 0 ? (
                                        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-200">
                                            <Smartphone size={48} className="mx-auto text-slate-300 mb-4"/>
                                            <p className="text-slate-500 font-medium">No services found matching your criteria.</p>
                                            <button onClick={() => { setSearchTerm(''); setActiveCategory('Overview'); }} className="mt-4 text-purple-600 font-bold hover:underline">Clear Filters</button>
                                        </div>
                                    ) : (
                                        <div className="space-y-8">
                                            {Object.entries(groupedData).map(([serviceName, items]) => {
                                                const ServiceIcon = getServiceIcon(serviceName); // 🔥 FIXED: Capitalized component for rendering
                                                return (
                                                    <div key={serviceName} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                                            <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                                                <ServiceIcon size={18} className="text-purple-600" />
                                                                {serviceName}
                                                            </h3>
                                                            <span className="text-xs font-bold bg-white border border-gray-200 px-3 py-1 rounded-full text-slate-500">{items.length} Models</span>
                                                        </div>
                                                        <div className="divide-y divide-gray-50">
                                                            {items.map((item, idx) => (
                                                                <div key={idx} className="px-6 py-4 flex justify-between items-center hover:bg-purple-50/30 transition group">
                                                                    <span className="font-medium text-slate-700 flex items-center gap-2">
                                                                        <Smartphone size={16} className="text-slate-300 group-hover:text-purple-500 transition"/> {item.model}
                                                                    </span>
                                                                    
                                                                    {/* 🔥 CONDITIONALLY RENDER PRICE OR CONTACT LINK */}
                                                                    {item.price > 0 ? (
                                                                        <span className="font-mono font-bold text-slate-900 group-hover:text-purple-700 transition">
                                                                            {formatCurrency(item.price)}
                                                                        </span>
                                                                    ) : (
                                                                        <Link 
                                                                            to="/#contact" 
                                                                            className="text-xs font-bold bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full hover:bg-purple-600 hover:text-white transition shadow-sm uppercase tracking-wide"
                                                                        >
                                                                            Contact Us
                                                                        </Link>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
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