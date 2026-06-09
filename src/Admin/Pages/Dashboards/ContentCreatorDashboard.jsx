import React, { useState, useEffect } from 'react';
import NairaSign from '../../Components/NairaSign';
import {
    Package, Smartphone, Activity, Search, Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../../AdminContext';
import { db } from '../../../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';

const CARD_STYLE = "bg-white rounded-2xl border border-slate-100 shadow-[0_4px_12px_-4px_rgba(64,78,99,0.08)] transition-all duration-300 hover:shadow-[0_8px_20px_-4px_rgba(64,78,99,0.12)] overflow-hidden";

const MetricCard = ({ title, value, icon: Icon, color, subtext, onClick }) => {
    return (
        <div 
            onClick={onClick} 
            className={`${CARD_STYLE} p-6 cursor-pointer group relative
            ${color === 'green' ? 'hover:border-green-200/60' : 
              color === 'purple' ? 'hover:border-purple-200/60' : 
              color === 'blue' ? 'hover:border-blue-200/60' : 
              'hover:border-gray-200/60'}`}
        >
            <div className={`absolute top-0 right-0 p-3 opacity-[0.08] transform translate-x-2 -translate-y-2 group-hover:scale-110 transition duration-500 ${color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : color === 'purple' ? 'text-purple-600' : 'text-blue-600'}`}>
                <Icon size={100} />
            </div>
            <div className="flex items-center gap-4 mb-3 relative z-10">
                <div className={`p-3 rounded-xl shadow-sm ${
                    color === 'green' ? 'bg-green-50 text-green-600' :
                    color === 'red' ? 'bg-red-50 text-red-600' :
                    color === 'blue' ? 'bg-blue-50 text-blue-600' :
                    'bg-purple-50 text-purple-600'
                }`}>
                    <Icon size={24} />
                </div>
            </div>
            <div className="relative z-10">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-black mt-1 text-slate-900">{value}</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">{subtext}</p>
            </div>
        </div>
    );
};

const ContentCreatorDashboard = () => {
    const { role, user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ inventoryCount: 0, servicesCount: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubInventory = onSnapshot(collection(db, "Inventory"), (snap) => {
            setStats(prev => ({ ...prev, inventoryCount: snap.docs.length }));
            setLoading(false);
        });

        const unsubPricing = onSnapshot(collection(db, "ServicePrices"), (snap) => {
            setStats(prev => ({ ...prev, servicesCount: snap.docs.length }));
        });

        return () => { unsubInventory(); unsubPricing(); };
    }, []);

    if (loading) return (
        <div className="min-h-screen bg-[#fafafa] p-6 max-w-[1600px] mx-auto space-y-8 animate-pulse">
            <div className="h-16 bg-slate-200 rounded-xl w-full mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl"></div>)}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#fafafa] font-sans text-gray-900 pb-20">
            <header className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                <div>
                    <h1 className="text-xl font-black flex items-center gap-2 text-slate-800"><Activity className="text-purple-600"/> Creator Hub</h1>
                    <p className="text-xs font-medium text-slate-400">Content & Pricing Overview</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-700">{user?.name || 'Creator'}</p>
                        <p className="text-xs font-medium text-slate-400">CONTENT CREATOR</p>
                    </div>
                </div>
            </header>

            <main className="p-6 max-w-[1600px] mx-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricCard 
                        title="Inventory" 
                        value={stats.inventoryCount} 
                        icon={Package} 
                        color="blue" 
                        subtext="View Items & Prices" 
                        onClick={() => navigate('/admin/store')} 
                    />
                    <MetricCard 
                        title="Services" 
                        value={stats.servicesCount} 
                        icon={NairaSign} 
                        color="green" 
                        subtext="Repair Price List" 
                        onClick={() => navigate('/admin/pricing')} 
                    />
                    {/* <MetricCard 
                        title="Portfolio" 
                        value="Manage" 
                        icon={ImageIcon} 
                        color="purple" 
                        subtext="Proof of Work Gallery" 
                        onClick={() => navigate('/admin/manage-proof-of-work')} 
                    /> */}
                </div>

                <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
                    <h3 className="text-blue-800 font-bold flex items-center gap-2 mb-2">
                        <Activity size={18}/> Welcome to the Creator Hub
                    </h3>
                    <p className="text-blue-700 text-sm">
                        As a Content Creator, you can view all inventory prices and repair service costs to help you create accurate content. You also have access to manage the Portfolio/Proof of Work gallery.
                    </p>
                </div>
            </main>
        </div>
    );
};

export default ContentCreatorDashboard;