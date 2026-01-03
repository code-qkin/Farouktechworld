import React, { useState, useEffect } from 'react';
import {
    Banknote, Users, Wrench, LogOut, Package, TrendingUp, AlertTriangle,
    ShoppingCart, Activity, Wallet, Smartphone, Settings,
    XCircle, AlertCircle, CheckCircle, ShieldAlert,
    TrendingDown, Image as ImageIcon, Trash2, X
} from 'lucide-react';
import { useAuth } from '../../AdminContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Toast } from '../../Components/Feedback';

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
};

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
        className={`${CARD_STYLE} p-6 cursor-pointer group relative
        ${isAlert ? 'hover:border-red-200/60 ring-1 ring-red-50' : 
          color === 'green' ? 'hover:border-green-200/60' : 
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
            {isAlert && <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 animate-pulse">Action Required</span>}
        </div>
        <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
            <h3 className={`text-2xl font-black mt-1 ${isAlert ? 'text-red-700' : 'text-slate-900'}`}>{value}</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">{subtext}</p>
        </div>
    </div>
);

const Dashboard = () => {
    const { role } = useAuth();
    const navigate = useNavigate();

    // Stats State
    const [stats, setStats] = useState({ netRevenue: 0, activeOrders: 0, activeDevices: 0, inventoryCount: 0 });
    const [recentOrders, setRecentOrders] = useState([]);
    const [inventoryData, setInventoryData] = useState({ critical: [], low: [], highValue: [], all: [] });
    const [alertTab, setAlertTab] = useState('critical');
    const [intelligence, setIntelligence] = useState({ topRepairs: [], lowRepairs: [], topProducts: [], lowProducts: [] });
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Deletion Requests State
    const [deletionRequests, setDeletionRequests] = useState([]);
    const [toast, setToast] = useState({ message: '', type: '' });

    const welcomeName = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Admin';

    // 1. FETCH DELETION REQUESTS (Admin Only)
    useEffect(() => {
        if (role === 'admin') {
            const q = query(collection(db, "DeletionRequests"), orderBy("requestedAt", "desc"));
            const unsub = onSnapshot(q, (snap) => {
                setDeletionRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            });
            return () => unsub();
        }
    }, [role]);

    // 2. FETCH DASHBOARD DATA
    useEffect(() => {
        const qOrders = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsubOrders = onSnapshot(qOrders, (snapshot) => {
            let net = 0; 
            let activeTickets = 0;
            let devicesInShop = 0; // 🔥 New Counter
            
            const recent = [];
            const salesMap = {};
            const repairCounts = {};
            const productCounts = {};

            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                
                // Financials
                const paid = Number(data.amountPaid || 0);
                net += paid;

                // Active Tickets Count
                if (['In Progress', 'Pending', 'Ready for Pickup'].includes(data.status)) {
                    activeTickets++;
                }

                // 🔥 Active Devices Count (Detailed)
                if (data.status !== 'Collected' && data.status !== 'Void') {
                    const repairItems = data.items?.filter(i => i.type === 'repair' && !i.collected) || [];
                    devicesInShop += repairItems.length;
                }

                // Recent Activity Feed
                if (recent.length < 5) {
                    recent.push({
                        id: data.ticketId, docId: doc.id,
                        device: data.items?.[0]?.deviceModel || 'Unknown Device',
                        status: data.status, customer: data.customer?.name || 'Guest', cost: data.totalCost
                    });
                }

                // Chart Data
                if (data.createdAt && paid > 0) {
                    const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                    const key = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                    salesMap[key] = (salesMap[key] || 0) + paid;
                }

                // Intelligence Data
                if (data.items) {
                    data.items.forEach(item => {
                        if (item.type === 'repair' && item.services) {
                            item.services.forEach(s => { const key = s.service; repairCounts[key] = (repairCounts[key] || 0) + 1; });
                        }
                        if (item.type === 'product' && item.name) {
                            productCounts[item.name] = (productCounts[item.name] || 0) + (item.qty || 1);
                        }
                    });
                }
            });

            const sortedRepairs = Object.entries(repairCounts).sort((a,b) => b[1] - a[1]).slice(0,5);
            const lowRepairs = Object.entries(repairCounts).sort((a,b) => a[1] - b[1]).slice(0,5);
            const sortedProducts = Object.entries(productCounts).sort((a,b) => b[1] - a[1]).slice(0,5);

            setIntelligence(prev => ({ ...prev, topRepairs: sortedRepairs, lowRepairs, topProducts: sortedProducts }));
            const sortedChart = Object.keys(salesMap).map(key => ({ name: key, sales: salesMap[key] })).slice(-7);
            
            setStats(prev => ({ ...prev, netRevenue: net, activeOrders: activeTickets, activeDevices: devicesInShop }));
            setRecentOrders(recent);
            setChartData(sortedChart.length > 0 ? sortedChart : [{ name: 'Today', sales: 0 }]);
            setLoading(false);
        });

        const unsubInventory = onSnapshot(collection(db, "Inventory"), (snap) => {
            const items = snap.docs.map(d => ({id:d.id, ...d.data()}));
            const critical = items.filter(i => i.stock === 0);
            const low = items.filter(i => i.stock > 0 && i.stock <= 5);
            const highValue = items.filter(i => i.stock <= 3 && i.price > 50000).sort((a,b) => b.price - a.price);
            setInventoryData({ critical, low, highValue, all: items });
            setStats(prev => ({ ...prev, inventoryCount: items.length }));
        });

        return () => { unsubOrders(); unsubInventory(); };
    }, []);

    const handleLogout = async () => { await signOut(auth); navigate('/admin/login'); };

    const handleApproveDelete = async (req) => {
        try {
            await deleteDoc(doc(db, "Orders", req.orderId));
            await deleteDoc(doc(db, "DeletionRequests", req.id));
            setToast({ message: `Order ${req.ticketId} Deleted`, type: 'success' });
        } catch (e) {
            setToast({ message: "Operation failed", type: 'error' });
        }
    };

    const handleRejectDelete = async (reqId) => {
        try {
            await deleteDoc(doc(db, "DeletionRequests", reqId));
            setToast({ message: "Request Cancelled", type: 'info' });
        } catch (e) {
            setToast({ message: "Failed to reject", type: 'error' });
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading Dashboard...</div>;

    const currentAlerts = alertTab === 'critical' ? inventoryData.critical : alertTab === 'low' ? inventoryData.low : inventoryData.highValue;
    const totalAlerts = inventoryData.critical.length + inventoryData.low.length;

    return (
        <div className="min-h-screen bg-[#fafafa] font-sans text-gray-900 pb-20">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            
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

            <main className="p-6 max-w-[1600px] mx-auto space-y-8">
                
                {/* PENDING DELETION REQUESTS */}
                {deletionRequests.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-3 mb-4 text-red-800">
                            <AlertTriangle size={24} className="fill-red-200 text-red-600"/>
                            <h2 className="text-lg font-black">Pending Deletion Requests ({deletionRequests.length})</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {deletionRequests.map(req => (
                                <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm border border-red-100 flex flex-col justify-between">
                                    <div className="mb-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">{req.ticketId}</span>
                                            <span className="text-[10px] font-bold text-gray-400">{new Date(req.requestedAt?.seconds * 1000).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm font-bold text-gray-800 mb-1">Requested by: <span className="text-purple-600">{req.requestedBy}</span></p>
                                        <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded border border-gray-100">"{req.reason}"</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleRejectDelete(req.id)} className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-1 transition"><X size={14}/> Reject</button>
                                        <button onClick={() => handleApproveDelete(req)} className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center gap-1 transition shadow-sm"><Trash2 size={14}/> Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 1. TOP METRICS & QUICK ACCESS */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
                    
                    {/* Financials */}
                    <MetricCard title="Net Revenue" value={formatCurrency(stats.netRevenue)} icon={Wallet} color="green" subtext="Total Cash In Hand" onClick={() => navigate('/admin/performance')} />
                    
                    {/* Active Tickets */}
                    <MetricCard title="Active Tickets" value={stats.activeOrders} icon={Wrench} color="purple" subtext="Open Orders" onClick={() => navigate('/admin/orders')} />
                    
                    {/* 🔥 NEW: Active Devices Manager */}
                    <MetricCard title="Device Manager" value={stats.activeDevices} icon={Smartphone} color="blue" subtext="Devices Currently In Shop" onClick={() => navigate('/admin/devices')} />

                    {/* Inventory Alert */}
                    {totalAlerts > 0 ? (
                        <MetricCard title="Inventory Alert" value={totalAlerts} icon={AlertTriangle} color="red" isAlert={true} subtext="Items Low or Out of Stock" onClick={() => navigate('/admin/store')} />
                    ) : (
                        <MetricCard title="Inventory Count" value={stats.inventoryCount} icon={Package} color="blue" subtext="Total Items in Stock" onClick={() => navigate('/admin/store')} />
                    )}

                    {/* Quick Actions */}
                    <div className={`${CARD_STYLE} p-5 flex flex-col justify-between h-full bg-slate-900 border-slate-900 group hover:shadow-xl`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</span>
                            <Settings size={18} className="text-slate-500 group-hover:text-white transition-colors duration-500"/>
                        </div>
                        <div className="grid grid-cols-2 gap-2 h-full items-center">
                            <button onClick={() => navigate('/admin/users')} className="flex flex-col items-center justify-center gap-1.5 p-2 bg-slate-800 rounded-xl hover:bg-purple-600 text-slate-300 hover:text-white transition-all duration-300 h-full border border-slate-700 hover:border-purple-500 hover:shadow-lg">
                                <Users size={18}/> <span className="text-[10px] font-bold">Staff</span>
                            </button>
                            <button onClick={() => navigate('/admin/payroll')} className="flex flex-col items-center justify-center gap-1.5 p-2 bg-slate-800 rounded-xl hover:bg-green-600 text-slate-300 hover:text-white transition-all duration-300 h-full border border-slate-700 hover:border-green-500 hover:shadow-lg">
                                <Banknote size={18}/> <span className="text-[10px] font-bold">Payroll</span>
                            </button>
                            <button onClick={() => navigate('/admin/pricing')} className="flex flex-col items-center justify-center gap-1.5 p-2 bg-slate-800 rounded-xl hover:bg-blue-600 text-slate-300 hover:text-white transition-all duration-300 h-full border border-slate-700 hover:border-blue-500 hover:shadow-lg">
                                <Smartphone size={18}/> <span className="text-[10px] font-bold">Services</span>
                            </button>
                            <button onClick={() => navigate('/admin/manage-proof-of-work')} className="flex flex-col items-center justify-center gap-1.5 p-2 bg-slate-800 rounded-xl hover:bg-orange-600 text-slate-300 hover:text-white transition-all duration-300 h-full border border-slate-700 hover:border-orange-500 hover:shadow-lg">
                                <ImageIcon size={18}/> <span className="text-[10px] font-bold">Portfolio</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. BUSINESS INTELLIGENCE CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className={`${CARD_STYLE} p-5`}>
                        <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-3">
                            <TrendingUp className="text-green-500" size={20}/>
                            <h3 className="font-bold text-slate-700">Top Repairs</h3>
                        </div>
                        <ul className="space-y-3">
                            {intelligence.topRepairs?.length === 0 ? <p className="text-xs text-slate-400 italic">No data yet.</p> : 
                                intelligence.topRepairs?.map(([name, count], i) => (
                                    <li key={i} className="flex justify-between text-sm">
                                        <span className="text-slate-600 truncate max-w-[150px]">{name}</span>
                                        <span className="font-bold text-slate-900 bg-slate-50 px-2 rounded">{count}</span>
                                    </li>
                                ))
                            }
                        </ul>
                    </div>
                    
                    <div className={`${CARD_STYLE} p-5`}>
                        <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-3">
                            <Package className="text-blue-500" size={20}/>
                            <h3 className="font-bold text-slate-700">Top Sellers</h3>
                        </div>
                        <ul className="space-y-3">
                            {intelligence.topProducts?.length === 0 ? <p className="text-xs text-slate-400 italic">No sales data.</p> : 
                                intelligence.topProducts?.map(([name, count], i) => (
                                    <li key={i} className="flex justify-between text-sm">
                                        <span className="text-slate-600 truncate max-w-[150px]">{name}</span>
                                        <span className="font-bold text-slate-900 bg-slate-50 px-2 rounded">{count}</span>
                                    </li>
                                ))
                            }
                        </ul>
                    </div>

                    <div className={`${CARD_STYLE} p-5`}>
                        <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-3">
                            <TrendingDown className="text-orange-500" size={20}/>
                            <h3 className="font-bold text-slate-700">Rare Repairs</h3>
                        </div>
                        <ul className="space-y-3">
                            {intelligence.lowRepairs?.length === 0 ? <p className="text-xs text-slate-400 italic">Not enough data.</p> : 
                                intelligence.lowRepairs?.map(([name, count], i) => (
                                    <li key={i} className="flex justify-between text-sm">
                                        <span className="text-slate-600 truncate max-w-[150px]">{name}</span>
                                        <span className="font-bold text-slate-400 bg-slate-50 px-2 rounded">{count}</span>
                                    </li>
                                ))
                            }
                        </ul>
                    </div>

                    <div className={`${CARD_STYLE} p-5`}>
                        <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-3">
                            <AlertCircle className="text-red-500" size={20}/>
                            <h3 className="font-bold text-slate-700">Slow Movers (High Stock)</h3>
                        </div>
                        <ul className="space-y-3">
                            {intelligence.lowProducts?.length === 0 ? <p className="text-xs text-slate-400 italic">Inventory balanced.</p> : 
                                intelligence.lowProducts?.map((item, i) => (
                                    <li key={i} className="flex justify-between text-sm">
                                        <span className="text-slate-600 truncate max-w-[150px]">{item.name}</span>
                                        <span className="font-bold text-red-600 bg-red-50 px-2 rounded">{item.stock}</span>
                                    </li>
                                ))
                            }
                        </ul>
                    </div>
                </div>

                {/* 3. CHART & ACTIVITY */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    <div className={`${CARD_STYLE} p-6 xl:col-span-2`}>
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

                    <div className={`${CARD_STYLE} p-5 flex flex-col h-full max-h-[400px]`}>
                        <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2"><ShoppingCart size={16} className="text-blue-600"/> Recent Activity</h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {recentOrders?.length === 0 ? <div className="text-center text-slate-400 py-10 text-xs font-medium">No activity today.</div> : 
                                recentOrders?.map(order => (
                                    <div key={order.id} onClick={() => navigate(`/admin/orders/${order.ticketId}`)} className="group flex flex-col gap-1 p-3 rounded-xl bg-slate-50/50 hover:bg-white cursor-pointer border border-slate-100 hover:border-blue-100 hover:shadow-sm transition">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0"><p className="text-xs font-bold text-slate-900 truncate">{order.customer}</p><p className="text-[10px] font-medium text-slate-500 truncate">{order.device}</p></div>
                                            <p className="text-xs font-bold text-purple-700">{formatCurrency(order.cost)}</p>
                                        </div>
                                        <div className="flex justify-between items-center mt-1"><span className="font-mono text-[9px] text-slate-400">{order.id}</span><StatusBadge status={order.status} /></div>
                                    </div>
                                ))
                            }
                        </div>
                        <button onClick={() => navigate('/admin/orders')} className="mt-3 w-full py-2 text-xs font-bold text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition flex items-center justify-center gap-2 shadow-sm">View All</button>
                    </div>
                </div>

                <div className={CARD_STYLE}>
                    <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div><h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><ShieldAlert size={18} className="text-orange-500"/> Inventory</h3><p className="text-xs font-medium text-slate-400">Real-time stock monitoring</p></div>
                        <div className="flex bg-white p-1.5 rounded-xl border border-slate-100 shadow-sm">
                            <button onClick={()=>setAlertTab('critical')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${alertTab === 'critical' ? 'bg-red-50 text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Critical ({inventoryData.critical?.length || 0})</button>
                            <button onClick={()=>setAlertTab('low')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${alertTab === 'low' ? 'bg-orange-50 text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Low ({inventoryData.low?.length || 0})</button>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto custom-scrollbar bg-white">
                        {currentAlerts?.length === 0 ? <div className="p-8 text-center text-slate-400 flex flex-col items-center"><CheckCircle size={32} className="text-green-400 mb-2 opacity-50"/><p className="text-sm font-bold">No items in this category.</p></div> : 
                            currentAlerts?.map(item => (
                                <div key={item.id} className="px-5 py-3 flex justify-between items-center hover:bg-slate-50/80 transition group">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl shadow-sm ${alertTab === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{alertTab === 'critical' ? <XCircle size={16}/> : <AlertCircle size={16}/>}</div>
                                        <div><p className="text-xs font-bold text-slate-800">{item.name}</p><div className="flex items-center gap-2 mt-1">{item.price > 50000 && <span className="text-[9px] font-black bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">HIGH VALUE</span>}<span className="text-[10px] font-medium text-slate-400">{item.category}</span></div></div>
                                    </div>
                                    <div className="flex items-center gap-4"><div className="text-right"><span className={`block text-xs font-black ${alertTab === 'critical' ? 'text-red-600' : 'text-slate-700'}`}>{item.stock} Left</span><div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden ml-auto shadow-inner"><div className={`h-full rounded-full ${item.stock === 0 ? 'bg-red-500 w-0' : 'bg-gradient-to-r from-orange-400 to-orange-500'}`} style={{ width: `${(item.stock / 5) * 100}%` }}></div></div></div><button onClick={() => navigate('/admin/store')} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-blue-100 shadow-sm">Restock</button></div>
                                </div>
                            ))
                        }
                    </div>
                    <button onClick={() => navigate('/admin/store')} className="w-full py-3 bg-slate-50/50 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition border-t border-slate-100">Manage Full Inventory</button>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;