import React, { useState, useEffect, useMemo } from 'react';
import { 
    Banknote, Users, Wrench, LogOut, ArrowRight, 
    Package, TrendingUp, AlertTriangle, 
    ShoppingCart, Activity, Wallet, Smartphone, Settings,
    XCircle, AlertCircle, CheckCircle, ChevronRight, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../AdminContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../../firebaseConfig'; 
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'; 
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
};

// --- COMPONENTS ---

// 🔥 NEW PREMIUM CARD STYLE CONSTANT
// This combines a very light slate border with a diffused, soft shadow for a modern look.
const CARD_STYLE = "bg-white rounded-2xl border border-slate-100 shadow-[0_4px_12px_-4px_rgba(64,78,99,0.08)] transition-all duration-300 hover:shadow-[0_8px_20px_-4px_rgba(64,78,99,0.12)] overflow-hidden";

const StatusBadge = ({ status }) => {
    const styles = {
        'In Progress': 'bg-purple-100 text-purple-700 border-purple-200',
        'Ready for Pickup': 'bg-indigo-100 text-indigo-700 border-indigo-200',
        'Completed': 'bg-green-100 text-green-700 border-green-200',
        'Pending': 'bg-yellow-100 text-yellow-700 border-yellow-200',
        'Collected': 'bg-slate-800 text-white border-slate-700',
        'Void': 'bg-slate-100 text-slate-500 border-slate-200 line-through'
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
            {status}
        </span>
    );
};

const MetricCard = ({ title, value, icon: Icon, color, subtext, onClick, isAlert }) => (
    <div 
        onClick={onClick} 
        // Applied new beautiful card style here, with specific hover tints based on type
        className={`${CARD_STYLE} p-6 cursor-pointer group relative
        ${isAlert ? 'hover:border-red-200/60' : 
          color === 'green' ? 'hover:border-green-200/60' : 
          color === 'purple' ? 'hover:border-purple-200/60' : 
          'hover:border-blue-200/60'}`}
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
            {isAlert && <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 animate-pulse">Action Required</span>}
        </div>
        <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
            <h3 className={`text-3xl font-black mt-1 ${isAlert ? 'text-red-700' : 'text-slate-900'}`}>{value}</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">{subtext}</p>
        </div>
    </div>
);

const Dashboard = () => {
    const { role } = useAuth();
    const navigate = useNavigate();
    
    // State
    const [stats, setStats] = useState({
        netRevenue: 0, activeOrders: 0, 
        inventoryCount: 0
    });
    const [recentOrders, setRecentOrders] = useState([]);
    
    // Smart Inventory Lists
    const [inventoryData, setInventoryData] = useState({ critical: [], low: [], highValue: [] });
    const [alertTab, setAlertTab] = useState('critical'); 

    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);

    const welcomeName = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Admin';

    // 1. FETCH DATA
    useEffect(() => {
        // A. Orders
        const qOrders = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsubOrders = onSnapshot(qOrders, (snapshot) => {
            let net = 0; let active = 0;
            const recent = [];
            const salesMap = {}; 

            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                const paid = Number(data.amountPaid || 0);
                net += paid;
                
                if (data.status === 'In Progress' || data.status === 'Pending') active++;
                
                if (recent.length < 5) {
                    recent.push({
                        id: data.ticketId, docId: doc.id, 
                        device: data.items?.[0]?.deviceModel || 'Unknown Device',
                        status: data.status, customer: data.customer?.name || 'Guest', cost: data.totalCost
                    });
                }

                if (data.createdAt && paid > 0) {
                    const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                    const key = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                    salesMap[key] = (salesMap[key] || 0) + paid;
                }
            });

            const sortedChart = Object.keys(salesMap).map(key => ({ name: key, sales: salesMap[key] })).slice(-7);
            setStats(prev => ({ ...prev, netRevenue: net, activeOrders: active }));
            setRecentOrders(recent);
            setChartData(sortedChart.length > 0 ? sortedChart : [{name: 'Today', sales: 0}]);
            setLoading(false);
        });

        // B. Smart Inventory Logic
        const unsubInventory = onSnapshot(collection(db, "Inventory"), (snap) => {
            const items = snap.docs.map(d => ({id: d.id, ...d.data()}));
            
            const critical = items.filter(i => i.stock === 0);
            const low = items.filter(i => i.stock > 0 && i.stock <= 5);
            const highValue = items.filter(i => i.stock <= 3 && i.price > 50000).sort((a,b) => b.price - a.price);

            setInventoryData({ critical, low, highValue });
            setStats(prev => ({ ...prev, inventoryCount: items.length }));
        });

        return () => { unsubOrders(); unsubInventory(); };
    }, []);

    const handleLogout = async () => { await signOut(auth); navigate('/admin/login'); };

    const currentAlerts = useMemo(() => {
        if (alertTab === 'critical') return inventoryData.critical;
        if (alertTab === 'low') return inventoryData.low;
        return inventoryData.highValue;
    }, [alertTab, inventoryData]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading Dashboard...</div>;

    const totalAlerts = inventoryData.critical.length + inventoryData.low.length;

    return (
        <div className="min-h-screen bg-[#fafafa] font-sans text-gray-900">
            {/* Header */}
            <header className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                <div>
                    <h1 className="text-xl font-black flex items-center gap-2 text-slate-800"><Activity className="text-purple-600"/> Admin Console</h1>
                    <p className="text-xs font-medium text-slate-400 hidden sm:block">Overview for {new Date().toDateString()}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block"><p className="text-sm font-bold text-slate-700">{welcomeName}</p><p className="text-xs font-medium text-slate-400">Administrator</p></div>
                    <div className="h-8 w-px bg-slate-100 mx-2"></div>
                    <button onClick={handleLogout} className="text-slate-400 hover:text-red-600 transition p-2 rounded-xl hover:bg-slate-50"><LogOut size={20} /></button>
                </div>
            </header>

            <main className="p-6 max-w-[1600px] mx-auto">
                
                {/* 1. TOP METRICS (3 COLUMNS) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <MetricCard 
                        title="Net Revenue" 
                        value={formatCurrency(stats.netRevenue)} 
                        icon={Wallet} 
                        color="green" 
                        subtext="Total Cash In Hand"
                        onClick={() => navigate('/admin/performance')}
                    />
                    <MetricCard 
                        title="Active Jobs" 
                        value={stats.activeOrders} 
                        icon={Wrench} 
                        color="purple" 
                        subtext="Repairs In Progress"
                        onClick={() => navigate('/admin/orders')}
                    />
                    {totalAlerts > 0 ? (
                        <MetricCard 
                            title="Inventory Alert" 
                            value={totalAlerts} 
                            icon={AlertTriangle} 
                            color="red" 
                            isAlert={true}
                            subtext="Items Low or Out of Stock"
                            onClick={() => navigate('/admin/store')} 
                        />
                    ) : (
                        <MetricCard 
                            title="Inventory Count" 
                            value={stats.inventoryCount} 
                            icon={Package} 
                            color="blue" 
                            subtext="Total Items in Stock"
                            onClick={() => navigate('/admin/store')} 
                        />
                    )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    
                    {/* LEFT COLUMN: INTELLIGENCE & CHARTS */}
                    <div className="xl:col-span-2 space-y-8">
                        
                        {/* REVENUE CHART - Applied new CARD_STYLE */}
                        <div className={`${CARD_STYLE} p-6`}>
                            <div className="flex justify-between items-center mb-6">
                                <div><h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><TrendingUp size={18} className="text-purple-600"/> Revenue Trend</h3><p className="text-xs font-medium text-slate-400">7 Day Performance</p></div>
                                <button onClick={() => navigate('/admin/performance')} className="text-xs font-bold text-purple-700 bg-purple-50 px-4 py-2 rounded-xl hover:bg-purple-100 transition shadow-sm">View Report</button>
                            </div>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs><linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7e22ce" stopOpacity={0.1}/><stop offset="95%" stopColor="#7e22ce" stopOpacity={0}/></linearGradient></defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:11, fontWeight: 600, fill:'#94a3b8'}} dy={10}/>
                                        <YAxis axisLine={false} tickLine={false} tick={{fontSize:11, fontWeight: 600, fill:'#94a3b8'}} tickFormatter={(val)=>`₦${val/1000}k`}/>
                                        <Tooltip cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4'}} contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding:'12px'}} formatter={(value) => [<span className="font-bold text-slate-800">{formatCurrency(value)}</span>, <span className="text-xs text-slate-400">Revenue</span>]} labelStyle={{color:'#64748b', fontSize:'12px', fontWeight:'bold', marginBottom:'4px'}}/>
                                        <Area type="monotone" dataKey="sales" stroke="#7e22ce" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* SMART INVENTORY INTELLIGENCE WIDGET - Applied new CARD_STYLE */}
                        <div className={CARD_STYLE}>
                            {/* Widget Header with subtle gradient */}
                            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                        <ShieldAlert size={18} className="text-orange-500"/> Inventory
                                    </h3>
                                    <p className="text-xs font-medium text-slate-400">Real-time stock monitoring</p>
                                </div>
                                {/* Tabs */}
                                <div className="flex bg-white p-1.5 rounded-xl border border-slate-100 shadow-sm">
                                    <button onClick={()=>setAlertTab('critical')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${alertTab === 'critical' ? 'bg-red-50 text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Critical ({inventoryData.critical.length})</button>
                                    <button onClick={()=>setAlertTab('low')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${alertTab === 'low' ? 'bg-orange-50 text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Low ({inventoryData.low.length})</button>
                                    <button onClick={()=>setAlertTab('highValue')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${alertTab === 'highValue' ? 'bg-purple-50 text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>High Value</button>
                                </div>
                            </div>

                            {/* Widget Content */}
                            <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto custom-scrollbar bg-white">
                                {currentAlerts.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                                        <CheckCircle size={32} className="text-green-400 mb-2 opacity-50"/>
                                        <p className="text-sm font-bold">No items in this category.</p>
                                    </div>
                                ) : (
                                    currentAlerts.map(item => (
                                        <div key={item.id} className="px-5 py-3 flex justify-between items-center hover:bg-slate-50/80 transition group">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl shadow-sm ${alertTab === 'critical' ? 'bg-red-100 text-red-600' : alertTab === 'highValue' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                                    {alertTab === 'critical' ? <XCircle size={16}/> : <AlertCircle size={16}/>}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">{item.name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {item.price > 50000 && <span className="text-[9px] font-black bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">HIGH VALUE</span>}
                                                        <span className="text-[10px] font-medium text-slate-400">{item.category}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className={`block text-xs font-black ${alertTab === 'critical' ? 'text-red-600' : 'text-slate-700'}`}>
                                                        {item.stock} Left
                                                    </span>
                                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden ml-auto shadow-inner">
                                                        <div className={`h-full rounded-full ${item.stock === 0 ? 'bg-red-500 w-0' : 'bg-gradient-to-r from-orange-400 to-orange-500'}`} style={{ width: `${(item.stock / 5) * 100}%` }}></div>
                                                    </div>
                                                </div>
                                                <button onClick={() => navigate('/admin/store')} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-blue-100 shadow-sm">Restock</button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <button onClick={() => navigate('/admin/store')} className="w-full py-3 bg-slate-50/50 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition border-t border-slate-100">
                                Manage Full Inventory
                            </button>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: RECENT & HR */}
                    <div className="space-y-8">
                        {/* Recent Activity - Applied new CARD_STYLE */}
                        <div className={`${CARD_STYLE} p-6 h-[420px] flex flex-col`}>
                            <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2"><ShoppingCart size={18} className="text-blue-600"/> Recent Activity</h3>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                {recentOrders.length === 0 ? <div className="text-center text-slate-400 py-10 text-sm font-medium">No activity today.</div> : 
                                    recentOrders.map(order => (
                                        <div key={order.id} onClick={() => navigate(`/admin/orders/${order.ticketId}`)} className="group flex flex-col gap-2 p-3 rounded-xl bg-slate-50/50 hover:bg-white cursor-pointer border border-slate-100 hover:border-blue-100 hover:shadow-sm transition">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-900 truncate">{order.customer}</p><p className="text-xs font-medium text-slate-500 truncate">{order.device}</p></div>
                                                <p className="text-sm font-bold text-purple-700">{formatCurrency(order.cost)}</p>
                                            </div>
                                            <div className="flex justify-between items-center"><span className="font-mono text-[10px] text-slate-400">{order.id}</span><StatusBadge status={order.status} /></div>
                                        </div>
                                    ))
                                }
                            </div>
                            <button onClick={() => navigate('/admin/orders')} className="mt-4 w-full py-2.5 text-sm font-bold text-slate-600 bg-slate-50 rounded-xl hover:bg-slate-100 transition flex items-center justify-center gap-2 shadow-sm">View All Activity <ArrowRight size={14}/></button>
                        </div>

                        {/* HR Console - Applied new CARD_STYLE */}
                        <div className={CARD_STYLE}>
                            <div className="bg-slate-900 px-5 py-4 border-b border-slate-800 flex items-center justify-between"><h3 className="font-bold text-white text-sm uppercase tracking-wide flex items-center gap-2"><Settings size={16} className="text-slate-400"/> HR & Admin</h3></div>
                            <div className="divide-y divide-slate-50 bg-white">
                                <button onClick={() => navigate('/admin/payroll')} className="w-full p-4 flex items-center justify-between hover:bg-green-50/50 transition group">
                                    <div className="flex items-center gap-4"><div className="p-2 bg-green-100 text-green-700 rounded-xl group-hover:scale-110 transition shadow-sm"><Banknote size={20}/></div><div className="text-left"><p className="font-bold text-slate-900 text-sm">Payroll System</p><p className="text-xs font-medium text-slate-500">Salaries & Commissions</p></div></div>
                                    <ChevronRight size={16} className="text-slate-300 group-hover:text-green-600 transition"/>
                                </button>
                                <button onClick={() => navigate('/admin/users')} className="w-full p-4 flex items-center justify-between hover:bg-purple-50/50 transition group">
                                    <div className="flex items-center gap-4"><div className="p-2 bg-purple-100 text-purple-700 rounded-xl group-hover:scale-110 transition shadow-sm"><Users size={20}/></div><div className="text-left"><p className="font-bold text-slate-900 text-sm">Staff Management</p><p className="text-xs font-medium text-slate-500">Roles & Access</p></div></div>
                                    <ChevronRight size={16} className="text-slate-300 group-hover:text-purple-600 transition"/>
                                </button>
                                <button onClick={() => navigate('/admin/pricing')} className="w-full p-4 flex items-center justify-between hover:bg-blue-50/50 transition group">
                                    <div className="flex items-center gap-4"><div className="p-2 bg-blue-100 text-blue-700 rounded-xl group-hover:scale-110 transition shadow-sm"><Smartphone size={20}/></div><div className="text-left"><p className="font-bold text-slate-900 text-sm">Service Pricing</p><p className="text-xs font-medium text-slate-500">Update Repair Costs</p></div></div>
                                    <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-600 transition"/>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;