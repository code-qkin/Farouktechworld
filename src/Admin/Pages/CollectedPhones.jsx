import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Search, Smartphone, DollarSign, Activity, RefreshCw } from 'lucide-react';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNavigate } from 'react-router-dom';

const CollectedPhonesPage = () => {
    const [rawOrders, setRawOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [timeFilter, setTimeFilter] = useState('month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const navigate = useNavigate();

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
            if (startDate) qOrders = query(qOrders, where("createdAt", ">=", startDate));
            if (endDate) qOrders = query(qOrders, where("createdAt", "<=", endDate));
            qOrders = query(qOrders, orderBy("createdAt", "desc"));

            const ordersSnap = await getDocs(qOrders);
            setRawOrders(ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Failed to fetch collected phones:", error);
        }
        setLoading(false);
    }, [timeFilter, customStart, customEnd]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const collectedPhones = useMemo(() => {
        let phones = [];
        rawOrders.forEach(order => {
            if (!order.items) return;
            order.items.forEach((item, itemIdx) => {
                if (item.type === 'repair' && item.collected) {
                    phones.push({
                        id: `${order.ticketId}-${itemIdx}`,
                        ticketId: order.ticketId,
                        date: order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt),
                        customer: order.customer?.name || 'Unknown',
                        device: item.deviceModel || item.name,
                        cost: item.total ?? item.cost ?? 0,
                        isPaid: item.isPaid || order.balance <= 0 || order.paymentStatus === 'Paid',
                        orderId: order.id
                    });
                }
            });
        });
        return phones;
    }, [rawOrders]);

    const filteredPhones = useMemo(() => {
        if (!searchTerm) return collectedPhones;
        const term = searchTerm.toLowerCase();
        return collectedPhones.filter(p => 
            p.ticketId.toLowerCase().includes(term) ||
            p.customer.toLowerCase().includes(term) ||
            p.device.toLowerCase().includes(term)
        );
    }, [collectedPhones, searchTerm]);

    const stats = useMemo(() => {
        let totalValue = 0;
        let totalPaid = 0;
        let totalUnpaid = 0;

        filteredPhones.forEach(p => {
            totalValue += p.cost;
            if (p.isPaid) totalPaid += p.cost;
            else totalUnpaid += p.cost;
        });

        return { totalValue, totalPaid, totalUnpaid };
    }, [filteredPhones]);

    const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

    return (
        <div className="min-h-screen bg-gray-50 p-6 sm:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-purple-900 flex items-center gap-3">
                        <Smartphone className="text-purple-600"/> Collected Phones
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Track financial status of all collected repair jobs.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchData} className="px-4 py-2 bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-sm font-bold hover:bg-purple-200 flex items-center gap-2 transition">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
                    </button>
                    <button onClick={() => navigate('/admin/dashboard')} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50">Back to Dashboard</button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2"><Activity size={16}/> Total Value</p>
                    <h3 className="text-3xl font-black text-gray-900">{formatCurrency(stats.totalValue)}</h3>
                </div>
                <div className="bg-green-50 p-5 rounded-2xl border border-green-200 shadow-sm">
                    <p className="text-sm font-bold text-green-700 uppercase tracking-wider mb-1 flex items-center gap-2"><DollarSign size={16}/> Total Paid</p>
                    <h3 className="text-3xl font-black text-green-800">{formatCurrency(stats.totalPaid)}</h3>
                </div>
                <div className="bg-red-50 p-5 rounded-2xl border border-red-200 shadow-sm">
                    <p className="text-sm font-bold text-red-700 uppercase tracking-wider mb-1 flex items-center gap-2"><DollarSign size={16}/> Total Unpaid</p>
                    <h3 className="text-3xl font-black text-red-800">{formatCurrency(stats.totalUnpaid)}</h3>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search ticket, customer, or phone..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Calendar className="text-gray-400" size={18} />
                    <select 
                        value={timeFilter} 
                        onChange={(e) => setTimeFilter(e.target.value)}
                        className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg font-bold p-2 outline-none"
                    >
                        <option value="day">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="all">All Time</option>
                        <option value="custom">Custom Date</option>
                    </select>
                </div>
                {timeFilter === 'custom' && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="p-2 text-sm border rounded-lg bg-gray-50 text-gray-600 font-bold outline-none" />
                        <span className="text-gray-400">-</span>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="p-2 text-sm border rounded-lg bg-gray-50 text-gray-600 font-bold outline-none" />
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-4">Ticket</th>
                                <th className="p-4">Customer & Phone</th>
                                <th className="p-4 text-right">Cost</th>
                                <th className="p-4 text-center">Payment Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="4" className="p-8 text-center text-gray-400">Loading collected phones...</td></tr>
                            ) : filteredPhones.length > 0 ? (
                                filteredPhones.map((phone) => (
                                    <tr key={phone.id} className="hover:bg-purple-50 transition cursor-pointer" onClick={() => navigate(`/admin/orders/${phone.ticketId}`)}>
                                        <td className="p-4">
                                            <span className="font-mono font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded text-xs">{phone.ticketId}</span>
                                            <div className="text-[10px] text-gray-400 font-medium mt-2">{phone.date.toLocaleDateString()}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-gray-800">{phone.customer}</div>
                                            <div className="text-gray-500 text-xs mt-0.5">{phone.device}</div>
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold text-gray-700">
                                            {formatCurrency(phone.cost)}
                                        </td>
                                        <td className="p-4 text-center">
                                            {phone.isPaid ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                    <DollarSign size={12}/> Paid
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                                    <DollarSign size={12}/> Not Paid
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-gray-400">No collected phones found for this period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CollectedPhonesPage;
