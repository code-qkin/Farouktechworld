import React, { useState, useEffect } from 'react';
import { 
    DollarSign, ClipboardList, Users, Wrench, LogOut, ArrowRight, 
    Package, Calendar, TrendingUp, AlertTriangle, 
    CheckCircle, ShoppingCart, Activity, Wallet
} from 'lucide-react';
import { useAuth } from '../../AdminContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../../firebaseConfig'; 
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore'; 
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
};

// --- Helper Components ---

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

const MetricCard = ({ title, value, icon: Icon, isAlert, onClick, subtext, color }) => (
    <div 
        onClick={onClick}
        className={`bg-white p-6 rounded-lg border transition-all duration-200 cursor-pointer group
        ${isAlert 
            ? 'border-l-4 border-l-orange-500 border-y-gray-200 border-r-gray-200 hover:bg-orange-50' 
            : 'border-gray-200 hover:border-purple-300 hover:shadow-md'}`}
    >
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-lg ${
                isAlert ? 'bg-orange-100 text-orange-600' : 
                color === 'red' ? 'bg-red-50 text-red-600' :
                color === 'green' ? 'bg-green-50 text-green-600' :
                color === 'purple' ? 'bg-purple-50 text-purple-600' :
                'bg-gray-50 text-gray-600 group-hover:text-purple-600 group-hover:bg-purple-50 transition'
            }`}>
                <Icon size={20} />
            </div>
            {isAlert && <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">ACTION REQUIRED</span>}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            <h3 className={`text-2xl font-bold mt-1 ${isAlert ? 'text-orange-700' : color === 'red' ? 'text-red-600' : 'text-gray-900'}`}>{value}</h3>
            <p className="text-xs text-gray-400 mt-1">{subtext}</p>
        </div>
    </div>
);

const Dashboard = () => {
    const { role } = useAuth();
    const navigate = useNavigate();
    
    // State
    const [stats, setStats] = useState({
        grossRevenue: 0,
        netRevenue: 0,
        totalRefunds: 0,
        activeOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        inventoryCount: 0,
        workerCount: 0
    });
    const [recentOrders, setRecentOrders] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);

    const welcomeName = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Admin';

    // 1. FETCH DATA
    useEffect(() => {
        // A. Orders Data
        const qOrders = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsubOrders = onSnapshot(qOrders, (snapshot) => {
            let gross = 0;
            let net = 0;
            let refunds = 0;
            let active = 0;
            let pending = 0;
            let completed = 0;
            const recent = [];
            const salesMap = {}; 

            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                
                // --- FINANCIALS CALCULATION ---
                const paid = Number(data.amountPaid || 0);
                const refunded = Number(data.refundedAmount || 0);

                // Gross = What we collected + what we had to give back (Total volume)
                // Net = What we actually have now (amountPaid)
                net += paid;
                refunds += refunded;
                gross += (paid + refunded); 
                
                // Status Counts
                if (data.status === 'In Progress') active++;
                if (data.status === 'Pending') pending++;
                if (data.status === 'Completed' || data.status === 'Collected') completed++;
                
                // Recent List
                if (recent.length < 8) {
                    recent.push({
                        id: data.ticketId,
                        docId: doc.id, 
                        device: data.items && data.items[0] ? (data.items[0].deviceModel || data.items[0].name) : 'Unknown Device',
                        status: data.status,
                        customer: data.customer?.name || 'Guest',
                        cost: data.totalCost,
                        date: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Now'
                    });
                }

                // Chart Data (Use Net Revenue)
                if (data.createdAt && paid > 0) {
                    const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                    const key = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                    salesMap[key] = (salesMap[key] || 0) + paid;
                }
            });

            const sortedChart = Object.keys(salesMap).map(key => ({ name: key, sales: salesMap[key] })).slice(-7);
            
            setStats(prev => ({ 
                ...prev, 
                grossRevenue: gross,
                netRevenue: net,
                totalRefunds: refunds,
                activeOrders: active, 
                pendingOrders: pending,
                completedOrders: completed
            }));
            setRecentOrders(recent);
            setChartData(sortedChart.length > 0 ? sortedChart : [{name: 'Today', sales: 0}]);
            setLoading(false);
        });

        // B. Inventory Data
        const unsubInventory = onSnapshot(collection(db, "Inventory"), (snap) => {
            const lowStock = [];
            snap.docs.forEach(doc => {
                const item = doc.data();
                if (item.stock < 3) lowStock.push({ id: doc.id, ...item });
            });
            setStats(prev => ({ ...prev, inventoryCount: snap.size }));
            setLowStockItems(lowStock.slice(0, 3));
        });

        return () => { unsubOrders(); unsubInventory(); };
    }, []);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/admin/login');
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading System...</div>;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            
            {/* --- TOP BAR --- */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Activity className="text-purple-700"/> Admin Console
                    </h1>
                    <p className="text-xs text-gray-500 hidden sm:block">Overview for {new Date().toDateString()}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-gray-800">{welcomeName}</p>
                        <p className="text-xs text-gray-500">Administrator</p>
                    </div>
                    <div className="h-8 w-px bg-gray-200 mx-2"></div>
                    <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 transition p-2 rounded-full hover:bg-gray-100">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <main className="p-6 max-w-[1600px] mx-auto">

                {/* --- 1. KEY METRICS GRID --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    
                    {/* NET REVENUE (Cash in Hand) */}
                    <MetricCard 
                        title="Net Revenue" 
                        value={formatCurrency(stats.netRevenue)} 
                        icon={Wallet} 
                        color="green"
                        subtext="Actual Cash In Hand"
                        onClick={() => navigate('/admin/performance')}
                    />

                    {/* GROSS SALES (Always Visible) */}
                    <MetricCard 
                        title="Gross Sales" 
                        value={formatCurrency(stats.grossRevenue)} 
                        icon={DollarSign} 
                        color="purple"
                        subtext="Total Volume (Before Refunds)"
                        onClick={() => navigate('/admin/performance')}
                    />
                    
                    <MetricCard 
                        title="Active Work" 
                        value={stats.activeOrders + stats.pendingOrders} 
                        icon={Wrench} 
                        subtext={`${stats.activeOrders} In Progress / ${stats.pendingOrders} Pending`}
                        onClick={() => navigate('/admin/orders')}
                    />

                    {lowStockItems.length > 0 ? (
                        <MetricCard 
                            title="Inventory Alert" 
                            value={lowStockItems.length} 
                            icon={AlertTriangle} 
                            isAlert={true}
                            subtext="Items below stock limit"
                            onClick={() => navigate('/admin/store')}
                        />
                    ) : (
                        <MetricCard 
                            title="Inventory Count" 
                            value={stats.inventoryCount} 
                            icon={Package} 
                            subtext="Total SKUs in store"
                            onClick={() => navigate('/admin/store')}
                        />
                    )}
                </div>

                {/* --- 2. MAIN DASHBOARD SPLIT --- */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    
                    {/* LEFT: ANALYTICS & ALERTS */}
                    <div className="xl:col-span-2 space-y-8">
                        
                        {/* CHART SECTION */}
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                        <TrendingUp size={18} className="text-purple-600"/> Revenue Trend
                                    </h3>
                                    <p className="text-xs text-gray-500">Financial performance over the last 7 entries</p>
                                </div>
                                <button onClick={() => navigate('/admin/performance')} className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded hover:bg-purple-100 transition">
                                    Full Report
                                </button>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#7e22ce" stopOpacity={0.1}/>
                                                <stop offset="95%" stopColor="#7e22ce" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#9ca3af'}} dy={10}/>
                                        <YAxis axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#9ca3af'}} tickFormatter={(val)=>`₦${val/1000}k`}/>
                                        <Tooltip 
                                            contentStyle={{borderRadius:'8px', border:'1px solid #e5e7eb', boxShadow:'0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                                            formatter={(value) => [formatCurrency(value), "Revenue"]}
                                        />
                                        <Area type="monotone" dataKey="sales" stroke="#7e22ce" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* LOW STOCK TABLE (If Any) */}
                        {lowStockItems.length > 0 && (
                            <div className="bg-white border border-orange-200 rounded-lg overflow-hidden shadow-sm">
                                <div className="bg-orange-50 px-6 py-3 border-b border-orange-100 flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                                        <AlertTriangle size={16}/> Low Stock Watchlist
                                    </h3>
                                    <button onClick={() => navigate('/admin/store')} className="text-xs font-bold text-orange-700 hover:underline">Restock Now</button>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {lowStockItems.map(item => (
                                        <div key={item.id} className="px-6 py-3 flex justify-between items-center hover:bg-orange-50/30 transition">
                                            <span className="text-sm font-medium text-gray-700">{item.name}</span>
                                            <span className="text-xs font-bold bg-white border border-orange-200 text-orange-600 px-2 py-1 rounded">
                                                {item.stock} Remaining
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: RECENT ACTIVITY & QUICK LINKS */}
                    <div className="space-y-8">
                        
                        {/* ACTIVITY FEED */}
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm h-[480px] flex flex-col">
                            <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
                                <ShoppingCart size={18} className="text-blue-600"/> Recent Activity
                            </h3>
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                {recentOrders.length === 0 ? (
                                    <div className="text-center text-gray-400 py-10 text-sm">No activity today.</div>
                                ) : (
                                    recentOrders.map(order => (
                                        <div 
                                            key={order.id} 
                                            onClick={() => navigate(`/admin/orders/${order.ticketId}`)}
                                            className="group flex flex-col gap-2 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-100 transition"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 truncate">{order.customer}</p>
                                                    <p className="text-xs text-gray-500 truncate">{order.device}</p>
                                                </div>
                                                <p className="text-sm font-bold text-purple-700">{formatCurrency(order.cost)}</p>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="font-mono text-[10px] text-gray-400">{order.id}</span>
                                                <StatusBadge status={order.status} />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <button onClick={() => navigate('/admin/orders')} className="mt-4 w-full py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex items-center justify-center gap-2">
                                View All Activity <ArrowRight size={14}/>
                            </button>
                        </div>

                        {/* QUICK LINKS */}
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => navigate('/admin/users')} className="p-4 bg-white border border-gray-200 rounded-lg text-left hover:border-purple-300 hover:shadow-md transition group">
                                <Users className="text-purple-600 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                                <p className="text-xs font-bold text-gray-500 uppercase">Manage</p>
                                <p className="font-bold text-gray-900">Users</p>
                            </button>
                            <button onClick={() => navigate('/admin/payroll')} className="p-4 bg-white border border-gray-200 rounded-lg text-left hover:border-green-300 hover:shadow-md transition group">
                                <DollarSign className="text-green-600 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                                <p className="text-xs font-bold text-gray-500 uppercase">Process</p>
                                <p className="font-bold text-gray-900">Payroll</p>
                            </button>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;