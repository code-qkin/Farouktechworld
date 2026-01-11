import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, AlertCircle, Wrench, ClipboardList 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig'; 

const StatCard = ({ title, value, icon: Icon, color, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all group`}
    >
        <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-2xl font-black text-slate-800 group-hover:text-purple-700 transition-colors">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
            <Icon size={24} />
        </div>
    </div>
);

const ManagerDashboard = ({ user }) => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [inventory, setInventory] = useState([]);

    useEffect(() => {
        // 1. Fetch Orders for Status Tracking
        const qOrders = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsubOrders = onSnapshot(qOrders, (snap) => {
            setOrders(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        });

        // 2. Fetch Inventory for Stock Tracking
        const qInv = query(collection(db, "Inventory"));
        const unsubInv = onSnapshot(qInv, (snap) => {
            setInventory(snap.docs.map(d => d.data()));
        });

        return () => { unsubOrders(); unsubInv(); };
    }, []);

    const stats = useMemo(() => {
        let activeJobs = 0;
        let pending = 0;
        // Count items with stock 3 or less
        let lowStockCount = inventory.filter(i => i.stock <= 3).length;

        orders.forEach(o => {
            if (['In Progress', 'Pending'].includes(o.status)) activeJobs++;
            if (o.status === 'Pending') pending++;
        });

        return { activeJobs, pending, lowStockCount };
    }, [orders, inventory]);

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 sm:p-8 font-sans text-slate-900">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Manager Overview</h1>
                    <p className="text-sm text-slate-500 font-medium">Operational Control Panel</p>
                </div>
                <div className="hidden sm:flex gap-2">
                    <button onClick={() => navigate('/admin/orders')} className="bg-purple-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-purple-200 hover:bg-purple-800 transition flex items-center gap-2">
                        <ClipboardList size={18}/> Manage Jobs
                    </button>
                </div>
            </div>

            {/* Key Metrics - PURELY OPERATIONAL (No Money) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <StatCard 
                    title="Active Repairs" 
                    value={stats.activeJobs} 
                    icon={Wrench} 
                    color="bg-blue-100 text-blue-700" 
                    onClick={() => navigate('/admin/orders')}
                />
                <StatCard 
                    title="Low Stock Alert" 
                    value={stats.lowStockCount} 
                    icon={AlertCircle} 
                    color="bg-red-100 text-red-700" 
                    onClick={() => navigate('/admin/store')}
                />
                <StatCard 
                    title="Staff" 
                    value="Manage" 
                    icon={Users} 
                    color="bg-purple-100 text-purple-700" 
                    onClick={() => navigate('/admin/users')}
                />
            </div>

            {/* Recent Pending Jobs Table (Full Width) */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <ClipboardList size={18} className="text-blue-600"/> Recent Intake
                    </h3>
                    <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">{stats.pending} Pending</span>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[400px]">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-400 font-bold uppercase bg-gray-50 sticky top-0">
                            <tr>
                                <th className="p-3">Ticket</th>
                                <th className="p-3">Customer</th>
                                <th className="p-3">Device</th>
                                <th className="p-3 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.slice(0, 10).map(order => (
                                <tr key={order.id} onClick={() => navigate(`/admin/orders/${order.ticketId}`)} className="hover:bg-gray-50 cursor-pointer transition">
                                    <td className="p-3 font-mono font-bold text-purple-700">{order.ticketId}</td>
                                    <td className="p-3 font-bold text-slate-700">{order.customer?.name}</td>
                                    <td className="p-3 text-gray-500">
                                        {order.items?.[0]?.deviceModel || order.items?.[0]?.name || 'N/A'} 
                                        {order.items?.length > 1 && <span className="text-xs ml-1 bg-gray-100 px-1 rounded">+{order.items.length - 1}</span>}
                                    </td>
                                    <td className="p-3 text-right">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                            order.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ManagerDashboard;