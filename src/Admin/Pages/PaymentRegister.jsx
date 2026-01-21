import React, { useState, useEffect, useMemo } from 'react';
import { 
    Calendar, Search, Filter, Download, ArrowLeft, 
    CreditCard, Banknote, DollarSign, User, FileText,
    ArrowUpRight, CheckCircle, Clock, Eye, EyeOff
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const formatCurrency = (amount) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

// DATE HELPER: Uses System Local Time
const parseDate = (dateInput) => {
    if (!dateInput) return new Date();
    if (dateInput.toDate) return dateInput.toDate(); 
    if (dateInput instanceof Date) return dateInput; 
    return new Date(dateInput); 
};

// HIDEABLE STAT CARD COMPONENT
const RegisterStatCard = ({ title, value, icon: Icon, color, isHideable, subtext }) => {
    const [hidden, setHidden] = useState(isHideable);

    const colors = {
        slate: 'bg-slate-900 text-white',
        white: 'bg-white border border-gray-200 shadow-sm text-slate-800'
    };
    
    const cardClass = colors[color] || colors.white;
    const titleClass = color === 'slate' ? 'text-slate-400' : 'text-gray-400';

    return (
        <div className={`${cardClass} p-5 rounded-2xl`}>
            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <p className={`text-xs font-bold ${titleClass} uppercase flex items-center gap-2`}>
                        {Icon && <Icon size={14}/>} {title}
                    </p>
                    <h3 className="text-2xl font-black mt-2">
                        {isHideable && hidden ? '****' : value}
                    </h3>
                    {subtext && <p className={`text-xs mt-1 ${color === 'slate' ? 'text-slate-400' : 'text-slate-500'}`}>{subtext}</p>}
                </div>
                {isHideable && (
                    <button onClick={() => setHidden(!hidden)} className={`p-1 rounded ${color === 'slate' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-400'}`}>
                        {hidden ? <Eye size={16}/> : <EyeOff size={16}/>}
                    </button>
                )}
            </div>
        </div>
    );
};

// 🔥 STATE HELPER
const getSavedState = (key, fallback) => {
    try {
        const saved = sessionStorage.getItem('pay_reg_state');
        if (!saved) return fallback;
        const parsed = JSON.parse(saved);
        return parsed[key] !== undefined ? parsed[key] : fallback;
    } catch { return fallback; }
};

const PaymentRegister = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // 🔥 PERSISTENT STATE
    const [searchTerm, setSearchTerm] = useState(() => getSavedState('searchTerm', ''));
    const [dateFilter, setDateFilter] = useState(() => getSavedState('dateFilter', 'month'));
    const [customStart, setCustomStart] = useState(() => getSavedState('customStart', ''));
    const [customEnd, setCustomEnd] = useState(() => getSavedState('customEnd', ''));
    const [methodFilter, setMethodFilter] = useState(() => getSavedState('methodFilter', 'All'));

    // 🔥 SAVE STATE ON CHANGE
    useEffect(() => {
        const stateToSave = { searchTerm, dateFilter, customStart, customEnd, methodFilter };
        sessionStorage.setItem('pay_reg_state', JSON.stringify(stateToSave));
    }, [searchTerm, dateFilter, customStart, customEnd, methodFilter]);

    // 1. FETCH ORDERS
    useEffect(() => {
        const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setOrders(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // 2. FLATTEN PAYMENTS (Strict Filter: Paid & Part Payment Only)
    const allPayments = useMemo(() => {
        let payments = [];
        orders.forEach(order => {
            const pStatus = order.paymentStatus || (order.paid ? 'Paid' : 'Unpaid');
            // Allow only valid payment statuses
            if (pStatus !== 'Paid' && pStatus !== 'Part Payment') return;

            if (order.paymentHistory && Array.isArray(order.paymentHistory)) {
                order.paymentHistory.forEach((pay, index) => {
                    payments.push({
                        id: `${order.id}_${index}`,
                        ticketId: order.ticketId,
                        customer: order.customer?.name || 'Unknown',
                        amount: Number(pay.amount),
                        method: pay.method || 'Cash',
                        receivedBy: pay.receivedBy || 'System',
                        date: parseDate(pay.date), 
                        status: pStatus
                    });
                });
            } else if (order.amountPaid > 0 && !order.paymentHistory) {
                // Fallback for legacy data
                payments.push({
                    id: `${order.id}_legacy`,
                    ticketId: order.ticketId,
                    customer: order.customer?.name || 'Unknown',
                    amount: Number(order.amountPaid),
                    method: 'Legacy',
                    receivedBy: 'System',
                    date: parseDate(order.createdAt), 
                    status: pStatus
                });
            }
        });
        return payments.sort((a, b) => b.date - a.date); 
    }, [orders]);

    // 3. APPLY FILTERS (Uses Local Browser Time)
    const filteredPayments = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay); endOfDay.setDate(startOfDay.getDate() + 1);
        
        // Start of Week (Sunday)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); 
        startOfWeek.setHours(0,0,0,0);

        // Start of Month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return allPayments.filter(p => {
            // Search
            const matchesSearch = 
                p.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                p.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.receivedBy.toLowerCase().includes(searchTerm.toLowerCase());

            // Method Filter
            const matchesMethod = methodFilter === 'All' || p.method === methodFilter;

            // Date Filter
            let matchesDate = true;
            if (dateFilter === 'today') matchesDate = p.date >= startOfDay && p.date < endOfDay; 
            else if (dateFilter === 'week') matchesDate = p.date >= startOfWeek;
            else if (dateFilter === 'month') matchesDate = p.date >= startOfMonth;
            else if (dateFilter === 'custom') {
                const start = customStart ? new Date(customStart) : new Date('1970-01-01');
                const end = customEnd ? new Date(customEnd) : new Date();
                end.setHours(23, 59, 59, 999); // Ensure end date covers the full day
                matchesDate = p.date >= start && p.date <= end;
            }

            return matchesSearch && matchesMethod && matchesDate;
        });
    }, [allPayments, searchTerm, dateFilter, methodFilter, customStart, customEnd]);

    // 4. CALCULATE STATS
    const stats = useMemo(() => {
        return filteredPayments.reduce((acc, curr) => {
            acc.total += curr.amount;
            acc[curr.method] = (acc[curr.method] || 0) + curr.amount;
            return acc;
        }, { total: 0 });
    }, [filteredPayments]);

    // 5. EXPORT
    const handleExport = () => {
        const data = filteredPayments.map(p => ({
            "Date": p.date.toLocaleDateString(),
            "Time": p.date.toLocaleTimeString(),
            "Ticket": p.ticketId,
            "Customer": p.customer,
            "Amount": p.amount,
            "Method": p.method,
            "Receiver": p.receivedBy,
            "Order Status": p.status
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Payment_Register");
        XLSX.writeFile(wb, `Payment_Register_${dateFilter}.xlsx`);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 lg:p-10 font-sans text-slate-900">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/admin/performance')} className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 text-slate-600"><ArrowLeft size={20}/></button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">Payment Register</h1>
                        <p className="text-sm text-slate-500 font-medium">Valid income only (Paid & Part Payment).</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-green-700 flex items-center gap-2">
                        <Download size={16}/> Export Excel
                    </button>
                </div>
            </div>

            {/* STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <RegisterStatCard 
                    title="Total Revenue" 
                    value={formatCurrency(stats.total)} 
                    color="slate" 
                    subtext={`${dateFilter} view`} 
                    isHideable={true} 
                />
                <RegisterStatCard 
                    title="Cash" 
                    value={formatCurrency(stats['Cash'] || 0)} 
                    icon={Banknote} 
                    color="white" 
                    isHideable={true} 
                />
                <RegisterStatCard 
                    title="POS" 
                    value={formatCurrency(stats['POS'] || 0)} 
                    icon={CreditCard} 
                    color="white" 
                    isHideable={true} 
                />
                <RegisterStatCard 
                    title="Transfer" 
                    value={formatCurrency(stats['Transfer'] || 0)} 
                    icon={ArrowUpRight} 
                    color="white" 
                    isHideable={true} 
                />
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                    <input 
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500" 
                        placeholder="Search Ticket, Customer or Staff..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <select 
                        className="px-4 py-2.5 bg-gray-50 rounded-lg text-sm font-bold text-slate-600 outline-none cursor-pointer border border-gray-200"
                        value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)}
                    >
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="custom">Custom Range</option>
                        <option value="all">All Time</option>
                    </select>

                    {/* 🔥 CUSTOM DATE INPUTS */}
                    {dateFilter === 'custom' && (
                        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200 animate-in fade-in">
                            <input 
                                type="date" 
                                className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none focus:ring-0"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                            />
                            <span className="text-slate-400">-</span>
                            <input 
                                type="date" 
                                className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none focus:ring-0"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                            />
                        </div>
                    )}

                    <select 
                        className="px-4 py-2.5 bg-gray-50 rounded-lg text-sm font-bold text-slate-600 outline-none cursor-pointer border border-gray-200"
                        value={methodFilter}
                        onChange={e => setMethodFilter(e.target.value)}
                    >
                        <option value="All">All Methods</option>
                        <option value="Cash">Cash</option>
                        <option value="POS">POS</option>
                        <option value="Transfer">Transfer</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Ticket</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Received By</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-center">Method</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredPayments.map((pay) => (
                                <tr key={pay.id} className="hover:bg-purple-50/50 transition cursor-pointer" onClick={() => navigate(`/admin/orders/${pay.ticketId}`)}>
                                    <td className="px-6 py-4 text-gray-500">
                                        <div className="font-bold text-slate-700">{pay.date.toLocaleDateString()}</div>
                                        <div className="text-xs text-gray-400">
                                            {pay.date.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit', hour12: true})}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded text-xs">{pay.ticketId}</span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-700">{pay.customer}</td>
                                    <td className="px-6 py-4 text-slate-500 flex items-center gap-2"><User size={14}/> {pay.receivedBy}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${pay.status === 'Paid' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                            {pay.status === 'Paid' ? <CheckCircle size={10} className="inline mr-1"/> : <Clock size={10} className="inline mr-1"/>}
                                            {pay.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            pay.method === 'Cash' ? 'bg-green-100 text-green-700' :
                                            pay.method === 'POS' ? 'bg-blue-100 text-blue-700' :
                                            'bg-orange-100 text-orange-700'
                                        }`}>{pay.method}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-slate-900">{formatCurrency(pay.amount)}</td>
                                </tr>
                            ))}
                            {filteredPayments.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="p-10 text-center text-gray-400 italic">No payments found for this period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PaymentRegister;