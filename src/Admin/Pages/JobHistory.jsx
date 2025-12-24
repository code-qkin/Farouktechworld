import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Search, User, Filter, Wrench, CheckCircle, XCircle, Clock } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNavigate } from 'react-router-dom';

const JobHistoryPage = () => {
    const [rawOrders, setRawOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterWorker, setFilterWorker] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const navigate = useNavigate();

    // 1. Fetch all orders real-time
    useEffect(() => {
        const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRawOrders(orders);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // 2. Flatten Orders into "Tasks"
    // This allows us to see individual technician contributions per device
    const flatTaskList = useMemo(() => {
        let tasks = [];
        rawOrders.forEach(order => {
            if (!order.items) return;
            order.items.forEach((item, itemIdx) => {
                if (item.type === 'repair' && item.services) {
                    item.services.forEach((svc, svcIdx) => {
                        tasks.push({
                            id: `${order.ticketId}-${itemIdx}-${svcIdx}`,
                            ticketId: order.ticketId,
                            date: order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt),
                            customer: order.customer?.name || 'Unknown',
                            device: item.deviceModel || item.name,
                            service: svc.service,
                            cost: svc.cost,
                            worker: svc.worker || 'Unassigned',
                            status: svc.status || 'Pending',
                            orderId: order.id // For navigation
                        });
                    });
                }
            });
        });
        return tasks;
    }, [rawOrders]);

    // 3. Filter Logic
    const filteredTasks = flatTaskList.filter(task => {
        const matchesSearch = 
            task.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) || 
            task.device.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.customer.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesWorker = filterWorker === 'All' || task.worker === filterWorker;
        const matchesStatus = filterStatus === 'All' || task.status === filterStatus;
        return matchesSearch && matchesWorker && matchesStatus;
    });

    // Extract unique workers for filter dropdown
    const uniqueWorkers = [...new Set(flatTaskList.map(t => t.worker))].sort();

    return (
        <div className="min-h-screen bg-gray-50 p-6 sm:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-purple-900 flex items-center gap-3">
                        <Wrench className="text-purple-600"/> Job History Log
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Detailed breakdown of every repair task performed.</p>
                </div>
                <button onClick={() => navigate('/admin/dashboard')} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50">Back to Dashboard</button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                    <input 
                        className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" 
                        placeholder="Search Ticket, Device or Customer..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-gray-400" size={18}/>
                        <select 
                            className="pl-10 p-2.5 border rounded-lg bg-white outline-none cursor-pointer"
                            value={filterWorker}
                            onChange={e => setFilterWorker(e.target.value)}
                        >
                            <option value="All">All Technicians</option>
                            {uniqueWorkers.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-3 text-gray-400" size={18}/>
                        <select 
                            className="pl-10 p-2.5 border rounded-lg bg-white outline-none cursor-pointer"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Completed">Completed</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Pending">Pending</option>
                            <option value="Void">Void</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <tr>
                                <th className="p-4 border-b">Date</th>
                                <th className="p-4 border-b">Ticket / Customer</th>
                                <th className="p-4 border-b">Device Info</th>
                                <th className="p-4 border-b">Technician</th>
                                <th className="p-4 border-b text-right">Service Cost</th>
                                <th className="p-4 border-b text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredTasks.length > 0 ? filteredTasks.map((task) => (
                                <tr key={task.id} className="hover:bg-purple-50 transition cursor-pointer" onClick={() => navigate(`/admin/orders/${task.ticketId}`)}>
                                    <td className="p-4 text-gray-500 whitespace-nowrap">
                                        {task.date.toLocaleDateString()}
                                        <div className="text-[10px]">{task.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className="font-mono font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded text-xs">{task.ticketId}</span>
                                        <div className="font-bold text-gray-800 mt-1">{task.customer}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-gray-700">{task.device}</div>
                                        <div className="text-gray-500 text-xs">{task.service}</div>
                                    </td>
                                    <td className="p-4">
                                        {task.worker === 'Unassigned' ? (
                                            <span className="text-gray-400 italic">Unassigned</span>
                                        ) : (
                                            <span className="flex items-center gap-1 font-bold text-gray-700">
                                                <User size={14} className="text-blue-500"/> {task.worker}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-gray-700">
                                        ₦{Number(task.cost).toLocaleString()}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                            task.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                            task.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                            task.status === 'Void' ? 'bg-red-100 text-red-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {task.status === 'Completed' ? <CheckCircle size={12}/> : 
                                             task.status === 'Void' ? <XCircle size={12}/> :
                                             <Clock size={12}/>}
                                            {task.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-400">No records found matching filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default JobHistoryPage;