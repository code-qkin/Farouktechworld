import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Search, User, Filter, Wrench, CheckCircle, XCircle, Clock, Activity, ArrowRightLeft, RefreshCw, Loader2 } from 'lucide-react';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNavigate } from 'react-router-dom';

const JobHistoryPage = () => {
    const [rawOrders, setRawOrders] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterWorker, setFilterWorker] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [activeTab, setActiveTab] = useState('technician'); // 'technician' or 'secretary'
    const [timeFilter, setTimeFilter] = useState('day');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const navigate = useNavigate();

    // 1. Fetch Orders and ActivityLogs on demand
    const fetchData = useCallback(async () => {
        setLoading(true);
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        let endDate = null;

        if (timeFilter === 'week') startDate.setDate(startDate.getDate() - startDate.getDay());
        else if (timeFilter === 'month') startDate.setDate(1);
        else if (timeFilter === 'all') startDate = null;
        else if (timeFilter === 'custom') {
            if (customStart) { startDate = new Date(customStart); startDate.setHours(0,0,0,0); }
            if (customEnd) { endDate = new Date(customEnd); endDate.setHours(23,59,59,999); }
        }

        try {
            let qOrders = query(collection(db, "Orders"));
            let qLogs = query(collection(db, "ActivityLogs"));

            if (startDate) {
                qOrders = query(qOrders, where("createdAt", ">=", startDate));
                qLogs = query(qLogs, where("timestamp", ">=", startDate));
            }
            if (endDate) {
                qOrders = query(qOrders, where("createdAt", "<=", endDate));
                qLogs = query(qLogs, where("timestamp", "<=", endDate));
            }

            qOrders = query(qOrders, orderBy("createdAt", "desc"));
            qLogs = query(qLogs, orderBy("timestamp", "desc"));

            const [ordersSnap, logsSnap] = await Promise.all([getDocs(qOrders), getDocs(qLogs)]);
            
            setRawOrders(ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setActivityLogs(logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Failed to fetch history:", error);
        }
        setLoading(false);
    }, [timeFilter, customStart, customEnd]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 2. Flatten Orders into "Tasks" for Technician Tab
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
                            orderId: order.id 
                        });
                    });
                }
            });
        });
        return tasks;
    }, [rawOrders]);

    // 3. Generate Secretary/Admin Activity Logs (Merging legacy with new)
    const combinedActivityLogs = useMemo(() => {
        let logs = activityLogs.map(log => {
            const order = rawOrders.find(o => o.ticketId === log.ticketId);
            return { ...log, customer: order?.customer?.name || 'Unknown' };
        });

        // Generate Legacy Logs from rawOrders
        rawOrders.forEach(order => {
            // Check if this order already has an 'ORDER_CREATED' log in activityLogs
            const hasCreateLog = activityLogs.some(log => log.ticketId === order.ticketId && log.action === 'ORDER_CREATED');
            if (!hasCreateLog && order.createdAt) {
                logs.push({
                    id: `legacy-create-${order.id}`,
                    action: 'ORDER_CREATED',
                    ticketId: order.ticketId,
                    user: 'Legacy / Secretary',
                    timestamp: order.createdAt,
                    customer: order.customer?.name || 'Unknown',
                    details: `Created legacy ticket (Total: ₦${(order.totalCost || 0).toLocaleString()})`,
                    orderId: order.id
                });
            }

            // Extract Legacy Payments
            if (order.paymentHistory) {
                order.paymentHistory.forEach((payment, pIdx) => {
                    // Approximate matching to prevent dupes if they happen to overlap, though new system logs payments accurately.
                    // Legacy payments use ISO string date
                    logs.push({
                        id: `legacy-pay-${order.id}-${pIdx}`,
                        action: 'PAYMENT_RECEIVED',
                        ticketId: order.ticketId,
                        user: payment.receivedBy || 'Secretary',
                        timestamp: { toDate: () => new Date(payment.date) }, // Mock Firestore Timestamp
                        customer: order.customer?.name || 'Unknown',
                        details: `Collected ₦${Number(payment.amount).toLocaleString()} via ${payment.method}`,
                        orderId: order.id
                    });
                });
            }
        });

        // Sort all logs by timestamp descending
        return logs.sort((a, b) => {
            const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
            const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
            return timeB - timeA;
        });
    }, [rawOrders, activityLogs]);

    // 4. Filter Logic
    const filteredTasks = flatTaskList.filter(task => {
        const matchesSearch = 
            (task.ticketId || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (task.device || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (task.customer || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesWorker = filterWorker === 'All' || task.worker === filterWorker;
        const matchesStatus = filterStatus === 'All' || task.status === filterStatus;
        return matchesSearch && matchesWorker && matchesStatus;
    });

    const filteredLogs = combinedActivityLogs.filter(log => {
        const matchesSearch = (log.ticketId || '').toLowerCase().includes(searchTerm.toLowerCase()) || (log.details || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesUser = filterWorker === 'All' || log.user === filterWorker;
        return matchesSearch && matchesUser;
    });

    const uniqueWorkers = activeTab === 'technician' 
        ? [...new Set(flatTaskList.map(t => t.worker))].sort()
        : [...new Set(combinedActivityLogs.map(l => l.user))].sort();

    // 5. Technician Stats (Leaderboard/Overview)
    const technicianStats = useMemo(() => {
        if (activeTab !== 'technician') return [];
        const statsMap = {};
        
        filteredTasks.forEach(task => {
            if (task.worker === 'Unassigned') return;
            
            if (!statsMap[task.worker]) {
                statsMap[task.worker] = {
                    name: task.worker,
                    totalJobs: 0,
                    completedJobs: 0,
                    revenue: 0
                };
            }
            
            statsMap[task.worker].totalJobs += 1;
            if (task.status === 'Completed') {
                statsMap[task.worker].completedJobs += 1;
            }
            // Only add revenue if it's completed (or should we count pending too? Let's count all to match the table, or maybe completed)
            // Actually, let's count all assigned revenue potential to match the filteredTasks list
            statsMap[task.worker].revenue += Number(task.cost) || 0;
        });

        return Object.values(statsMap).sort((a, b) => b.completedJobs - a.completedJobs);
    }, [filteredTasks, activeTab]);

    return (
        <div className="min-h-screen bg-gray-50 p-6 sm:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-purple-900 flex items-center gap-3">
                        <Activity className="text-purple-600"/> Job History & Activity
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Detailed log of repairs and administrative actions.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchData} className="px-4 py-2 bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-sm font-bold hover:bg-purple-200 flex items-center gap-2 transition">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
                    </button>
                    <button onClick={() => navigate('/admin/dashboard')} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50">Back to Dashboard</button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button 
                    onClick={() => setActiveTab('technician')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${activeTab === 'technician' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-purple-50'}`}
                >
                    <Wrench size={16} /> Technician Jobs
                </button>
                <button 
                    onClick={() => setActiveTab('secretary')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${activeTab === 'secretary' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-purple-50'}`}
                >
                    <ArrowRightLeft size={16} /> Administrative Activity
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                    <input 
                        className="w-full pl-10 p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold transition" 
                        placeholder="Search Ticket, Device or Customer..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar items-center">
                    
                    {/* SMART CALENDAR FILTER */}
                    <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1 rounded-xl">
                        <Calendar className="text-gray-400" size={16}/>
                        <select className="bg-transparent font-bold text-sm text-slate-600 outline-none cursor-pointer py-1.5" value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
                            <option value="day">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="custom">Custom Range</option>
                            <option value="all">All Time</option>
                        </select>
                        {timeFilter === 'custom' && (
                            <div className="flex items-center gap-2 ml-2 animate-in fade-in slide-in-from-left-4">
                                <input type="date" className="text-xs border rounded p-1" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                                <span className="text-slate-400">-</span>
                                <input type="date" className="text-xs border rounded p-1" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <User className="absolute left-3 top-3 text-gray-400" size={18}/>
                        <select 
                            className="pl-10 p-2.5 border border-gray-200 rounded-xl bg-white outline-none cursor-pointer text-sm font-bold text-slate-600"
                            value={filterWorker}
                            onChange={e => setFilterWorker(e.target.value)}
                        >
                            <option value="All">All Technicians</option>
                            {uniqueWorkers.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>
                    {activeTab === 'technician' && (
                        <div className="relative">
                            <Filter className="absolute left-3 top-3 text-gray-400" size={18}/>
                            <select 
                                className="pl-10 p-2.5 border border-gray-200 rounded-xl bg-white outline-none cursor-pointer text-sm font-bold text-slate-600"
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
                    )}
                </div>
            </div>

            {/* Technician Stat Cards Leaderboard */}
            {activeTab === 'technician' && !loading && technicianStats.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {technicianStats.map(stat => (
                        <div 
                            key={stat.name} 
                            onClick={() => setFilterWorker(filterWorker === stat.name ? 'All' : stat.name)}
                            className={`bg-white p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md ${filterWorker === stat.name ? 'border-purple-500 ring-2 ring-purple-100' : 'border-gray-200'}`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                                        {stat.name.charAt(0).toUpperCase()}
                                    </div>
                                    <h3 className="font-bold text-slate-800 line-clamp-1" title={stat.name}>{stat.name}</h3>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stat.completedJobs === stat.totalJobs ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {stat.completedJobs}/{stat.totalJobs} Done
                                </span>
                            </div>
                            <div className="flex items-end justify-between mt-1">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Service Value</p>
                                    <p className="text-lg font-black text-slate-900">₦{(stat.revenue).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {activeTab === 'technician' ? (
                                <tr>
                                    <th className="p-4 border-b">Date</th>
                                    <th className="p-4 border-b">Ticket / Customer</th>
                                    <th className="p-4 border-b">Device Info</th>
                                    <th className="p-4 border-b">Technician</th>
                                    <th className="p-4 border-b text-right">Service Cost</th>
                                    <th className="p-4 border-b text-center">Status</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="p-4 border-b">Date & Time</th>
                                    <th className="p-4 border-b">Ticket / Customer</th>
                                    <th className="p-4 border-b">Action Performed</th>
                                    <th className="p-4 border-b">Staff Member</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={activeTab === 'technician' ? 6 : 4} className="p-12 text-center text-purple-600">
                                        <div className="flex justify-center items-center gap-2">
                                            <Loader2 size={24} className="animate-spin"/> 
                                            <span className="font-bold">Loading history...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : activeTab === 'technician' ? (
                                filteredTasks.length > 0 ? filteredTasks.map((task) => (
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
                                        <td colSpan="6" className="p-8 text-center text-gray-400">No technician records found.</td>
                                    </tr>
                                )
                            ) : (
                                filteredLogs.length > 0 ? filteredLogs.map((log) => {
                                    const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                                    return (
                                    <tr key={log.id} className="hover:bg-purple-50 transition cursor-pointer" onClick={() => log.ticketId && navigate(`/admin/orders/${log.ticketId}`)}>
                                        <td className="p-4 text-gray-500 whitespace-nowrap">
                                            {logDate.toLocaleDateString()}
                                            <div className="text-[10px] text-gray-400 font-medium">{logDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                        </td>
                                        <td className="p-4">
                                            {log.ticketId ? (
                                                <span className="font-mono font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded text-xs">{log.ticketId}</span>
                                            ) : <span className="text-gray-400">-</span>}
                                            <div className="font-bold text-gray-800 mt-1">{log.customer}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-gray-800">{log.action.replace(/_/g, ' ')}</div>
                                            <div className="text-gray-500 text-xs mt-0.5">{log.details}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="flex items-center gap-1 font-bold text-gray-700">
                                                <User size={14} className="text-blue-500"/> {log.user}
                                            </span>
                                        </td>
                                    </tr>
                                )}) : (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-gray-400">No activity logs found.</td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default JobHistoryPage;