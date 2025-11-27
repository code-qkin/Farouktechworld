import React, { useState, useEffect } from 'react';
import { DollarSign, ClipboardList, Users, Wrench, LogOut, ArrowRight, Package, Calendar } from 'lucide-react';
import { useAuth } from '../../AdminContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../../firebaseConfig'; 
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore'; 
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
};

// --- Metric Card Component ---
const MetricCard = ({ title, value, icon: Icon, colorClass, desc, onClick }) => (
    <div
        onClick={onClick}
        className={`bg-white p-5 rounded-xl shadow-md border-t-4 transition-all duration-200 
    ${onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-95' : ''}`}
        style={{ borderColor: colorClass }}
    >
        <div className="flex justify-between items-start">
            <div className="overflow-hidden">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider truncate">{title}</h3>
                <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-gray-900 truncate">
                    {value}
                </p>
            </div>
            <div className={`p-2.5 rounded-full shrink-0 ${colorClass.replace('bg-', 'text-')} ${colorClass.replace('700', '100')}`}>
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 truncate">{desc}</p>
        {onClick && (
            <div className="mt-2 text-xs font-bold text-purple-600 flex items-center gap-1">
                View <ArrowRight size={12} />
            </div>
        )}
    </div>
);

const Dashboard = () => {
    const { role } = useAuth();
    const navigate = useNavigate();
    
    // State
    const [stats, setStats] = useState({
        totalRevenue: 0,
        activeOrders: 0,
        pendingOrders: 0,
        inventoryCount: 0,
        workerCount: 0
    });
    const [recentOrders, setRecentOrders] = useState([]);
    const [chartData, setChartData] = useState([]);

    const welcomeName = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Team Member';

    // 1. FETCH REAL DATA
    useEffect(() => {
        const qOrders = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsubOrders = onSnapshot(qOrders, (snapshot) => {
            let revenue = 0;
            let active = 0;
            let pending = 0;
            const recent = [];
            const salesMap = {}; 

            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                
                if (data.paid) revenue += Number(data.totalCost || 0);
                if (data.status === 'In Progress') active++;
                if (data.status === 'Pending') pending++;

                if (recent.length < 6) {
                    recent.push({
                        id: data.ticketId,
                        docId: doc.id, 
                        device: data.items && data.items[0] ? (data.items[0].deviceModel || data.items[0].name) : 'Unknown',
                        status: data.status,
                        customer: data.customer?.name || 'Guest'
                    });
                }

                if (data.createdAt && data.paid) {
                    const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                    const month = date.toLocaleString('default', { month: 'short' });
                    salesMap[month] = (salesMap[month] || 0) + Number(data.totalCost || 0);
                }
            });

            const formattedChart = Object.keys(salesMap).map(key => ({ name: key, sales: salesMap[key] }));
            
            setStats(prev => ({ ...prev, totalRevenue: revenue, activeOrders: active, pendingOrders: pending }));
            setRecentOrders(recent);
            setChartData(formattedChart.length > 0 ? formattedChart : [{name: 'No Data', sales: 0}]);
        });

        const unsubInventory = onSnapshot(collection(db, "Inventory"), (snap) => {
            setStats(prev => ({ ...prev, inventoryCount: snap.size }));
        });

        const qWorkers = query(collection(db, "Users"), where("role", "==", "worker"));
        const unsubWorkers = onSnapshot(qWorkers, (snap) => {
             setStats(prev => ({ ...prev, workerCount: snap.size }));
        });

        return () => { unsubOrders(); unsubInventory(); unsubWorkers(); };
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/admin/login');
        } catch (error) {
            console.error("Error signing out: ", error);
        }
    };

    return (
        <div className="min-h-screen bg-purple-50 p-4 sm:p-6 lg:p-10">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 border-b border-purple-200 pb-4 gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-purple-900">
                        🚀 Welcome, {welcomeName}!
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Here is what's happening today.</p>
                </div>

                <div className="w-full sm:w-auto">
                    <button onClick={handleLogout} className="w-full sm:w-auto flex justify-center items-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 px-5 py-2.5 rounded-xl font-bold transition shadow-sm">
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </div>

            {/* 1. Responsive Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
                <MetricCard
                    title="Inventory"
                    value={stats.inventoryCount}
                    icon={Package}
                    colorClass="bg-orange-600"
                    desc="Total items in stock"
                    onClick={() => navigate('/admin/store')}
                />
                <MetricCard
                    title="Active Jobs"
                    value={stats.activeOrders + stats.pendingOrders}
                    icon={ClipboardList}
                    colorClass="bg-indigo-700"
                    desc={`${stats.activeOrders} In Progress`}
                    onClick={() => navigate('/admin/orders')}
                />
                <MetricCard
                    title="Revenue"
                    value={formatCurrency(stats.totalRevenue)}
                    icon={DollarSign}
                    colorClass="bg-purple-700"
                    desc="Total cash collected"
                    onClick={role === 'admin' ? () => navigate('/admin/performance') : undefined}
                />
                <MetricCard
                    title="Technicians"
                    value={stats.workerCount}
                    icon={Users}
                    colorClass="bg-green-600"
                    desc="Active staff"
                    onClick={role === 'admin' ? () => navigate('/admin/users') : undefined}
                />
            </div>

            {/* 2. Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Sales Chart */}
                <div className="xl:col-span-2 bg-white p-4 sm:p-6 rounded-xl shadow-lg flex flex-col h-[350px] sm:h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg sm:text-xl font-bold text-purple-900">Revenue Trends</h2>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1.5 border border-gray-200">
                            <Calendar size={14} className="text-gray-500 ml-1" />
                            <span className="text-xs text-gray-500 font-medium pr-1">Monthly</span>
                        </div>
                    </div>

                    <div className="flex-grow w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#7e22ce" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#7e22ce" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis
                                    stroke="#9ca3af"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `₦${value / 1000}k`}
                                />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value) => [formatCurrency(value), 'Revenue']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sales"
                                    stroke="#7e22ce"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorSales)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Orders List */}
                <div className="xl:col-span-1 bg-white p-4 sm:p-6 rounded-xl shadow-lg flex flex-col h-[400px]">
                    <h2 className="text-lg sm:text-xl font-bold text-purple-900 mb-4">Recent Activity</h2>
                    <div className="overflow-y-auto flex-grow pr-1 space-y-1">
                        {recentOrders.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">No recent orders.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {recentOrders.map((order) => (
                                    <li 
                                        key={order.id} 
                                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                                        className="py-3 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition px-3 rounded-lg group"
                                    >
                                        <div className="min-w-0 flex-1 mr-3">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-gray-900 truncate">{order.id}</p>
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">{order.device}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                                                order.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                order.status === 'In Progress' ? 'bg-purple-100 text-purple-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {order.status}
                                            </span>
                                            <p className="text-[10px] text-gray-400 mt-1 font-medium">{order.customer}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <button
                        onClick={() => navigate('/admin/orders')}
                        className="mt-4 w-full bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-900 font-bold py-2.5 rounded-lg transition duration-150 border border-purple-100"
                    >
                        View All Orders
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;