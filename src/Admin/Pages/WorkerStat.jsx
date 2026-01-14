import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, Calendar, Filter, ChevronRight, CheckCircle, 
    Clock, AlertCircle, Search, ArrowLeft, Wrench, X
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../AdminContext';

const WorkerStats = () => {
    const { role } = useAuth();
    const navigate = useNavigate();
    
    // Data State
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filter State
    const [timeFilter, setTimeFilter] = useState('month'); 
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Detail View State
    const [selectedWorker, setSelectedWorker] = useState(null);

    // 🔥 SECURITY: Only Admin & CEO
    if (role !== 'admin' && role !== 'ceo') return <Navigate to="/admin/dashboard" replace />;

    // 1. FETCH DATA
    useEffect(() => {
        const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // 2. FLATTEN TASKS & FILTER BY DATE
    const filteredTasks = useMemo(() => {
        let tasks = [];
        
        // Date Logic
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        let endDate = null;

        if (timeFilter === 'day') { /* Keep today */ }
        else if (timeFilter === 'week') startDate.setDate(startDate.getDate() - startDate.getDay());
        else if (timeFilter === 'month') startDate.setDate(1);
        else if (timeFilter === 'all') startDate = null;
        else if (timeFilter === 'custom') {
            if (customStart) startDate = new Date(customStart);
            if (customEnd) {
                endDate = new Date(customEnd);
                endDate.setHours(23, 59, 59, 999);
            }
        }

        orders.forEach(order => {
            if (!order.items) return;
            const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
            
            // Apply Date Filter
            if (startDate && orderDate < startDate) return;
            if (endDate && orderDate > endDate) return;

            order.items.forEach((item, iIdx) => {
                if (item.type === 'repair' && item.services) {
                    item.services.forEach((svc, sIdx) => {
                        if (svc.worker && svc.worker !== 'Unassigned' && svc.status !== 'Void') {
                            tasks.push({
                                uniqueId: `${order.id}-${iIdx}-${sIdx}`,
                                worker: svc.worker,
                                ticketId: order.ticketId,
                                device: item.deviceModel || item.name,
                                service: svc.service,
                                status: svc.status,
                                date: orderDate,
                                customer: order.customer?.name
                            });
                        }
                    });
                }
            });
        });
        
        return tasks;
    }, [orders, timeFilter, customStart, customEnd]);

    // 3. GROUP BY WORKER
    const workerStats = useMemo(() => {
        const stats = {};
        
        filteredTasks.forEach(task => {
            if (!stats[task.worker]) {
                stats[task.worker] = { 
                    name: task.worker, 
                    total: 0, 
                    completed: 0, 
                    pending: 0,
                    tasks: [] 
                };
            }
            stats[task.worker].total++;
            if (task.status === 'Completed') stats[task.worker].completed++;
            else stats[task.worker].pending++;
            stats[task.worker].tasks.push(task);
        });

        // Convert to array and filter by search
        return Object.values(stats)
            .filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => b.total - a.total);

    }, [filteredTasks, searchTerm]);

    return (
        <div className="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans text-slate-800">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-100 transition text-slate-600"><ArrowLeft size={20}/></button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Users className="text-purple-600"/> Worker Statistics</h1>
                        <p className="text-sm text-slate-500 font-medium">Performance tracking & job history.</p>
                    </div>
                </div>
            </div>

            {/* CONTROLS */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                    <input 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none" 
                        placeholder="Search technician name..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                
                {/* SMART FILTER */}
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">
                    <Calendar size={18} className="text-slate-400"/>
                    <select className="bg-transparent font-bold text-sm text-slate-600 outline-none cursor-pointer py-1.5" value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
                        <option value="day">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="custom">Custom Range</option>
                        <option value="all">All Time</option>
                    </select>
                    {timeFilter === 'custom' && (
                        <div className="flex items-center gap-2 ml-2 animate-in fade-in slide-in-from-left-4">
                            <input type="date" className="text-xs border rounded p-1 bg-white" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                            <span className="text-slate-400">-</span>
                            <input type="date" className="text-xs border rounded p-1 bg-white" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                        </div>
                    )}
                </div>
            </div>

            {/* WORKER GRID */}
            {loading ? <div className="text-center py-20 text-slate-400">Loading stats...</div> : 
             workerStats.length === 0 ? <div className="text-center py-20 text-slate-400">No data found for this period.</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {workerStats.map(stat => (
                        <div 
                            key={stat.name} 
                            onClick={() => setSelectedWorker(stat)}
                            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-purple-300 transition cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-purple-700 transition">{stat.name}</h3>
                                    <p className="text-xs text-slate-500 font-medium">{stat.total} Total Jobs</p>
                                </div>
                                <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-purple-50 group-hover:text-purple-600 transition">
                                    <ChevronRight size={20}/>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                                    <div className="flex items-center gap-2 text-green-700 text-xs font-bold uppercase mb-1">
                                        <CheckCircle size={14}/> Completed
                                    </div>
                                    <span className="text-2xl font-black text-slate-800">{stat.completed}</span>
                                </div>
                                <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                                    <div className="flex items-center gap-2 text-orange-700 text-xs font-bold uppercase mb-1">
                                        <Clock size={14}/> Pending
                                    </div>
                                    <span className="text-2xl font-black text-slate-800">{stat.pending}</span>
                                </div>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="mt-4">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                                    <span>Completion Rate</span>
                                    <span>{Math.round((stat.completed / stat.total) * 100)}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-purple-600 rounded-full" 
                                        style={{ width: `${(stat.completed / stat.total) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* DETAIL MODAL */}
            {selectedWorker && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">{selectedWorker.name}</h2>
                                <p className="text-sm text-slate-500 font-medium">Work Log • {timeFilter === 'custom' ? 'Custom Range' : timeFilter}</p>
                            </div>
                            <button onClick={() => setSelectedWorker(null)} className="p-2 hover:bg-gray-200 rounded-full text-slate-500"><X size={20}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-0">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white text-slate-400 font-bold uppercase text-xs border-b border-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Ticket / Device</th>
                                        <th className="px-6 py-4">Service</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {selectedWorker.tasks.map(task => (
                                        <tr key={task.uniqueId} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => navigate(`/admin/orders/${task.ticketId}`)}>
                                            <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                                {task.date.toLocaleDateString()}
                                                <div className="text-[10px]">{task.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded w-fit mb-1">{task.ticketId}</div>
                                                <div className="font-bold text-slate-800">{task.device}</div>
                                                <div className="text-xs text-slate-400">{task.customer}</div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-600">{task.service}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                    task.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {task.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkerStats;