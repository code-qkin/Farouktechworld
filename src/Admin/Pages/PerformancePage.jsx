import React, { useState, useEffect, useMemo } from 'react';
import { 
    TrendingUp, DollarSign, AlertCircle, ArrowDownLeft, 
    Calendar, Filter, Download, PieChart as PieIcon, ArrowLeft, CheckCircle
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend 
} from 'recharts';
import * as XLSX from 'xlsx';
import { useAuth } from '../AdminContext';
import { useNavigate, Navigate } from 'react-router-dom';

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

const StatCard = ({ title, value, subtext, icon: Icon, color }) => (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 relative overflow-hidden">
        <div className="flex justify-between items-start z-10">
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{value}</h3>
            </div>
            <div className={`p-2 rounded-lg ${color === 'green' ? 'bg-green-100 text-green-700' : color === 'red' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                <Icon size={20} />
            </div>
        </div>
        <p className="text-xs text-gray-400 z-10">{subtext}</p>
        <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 ${color === 'green' ? 'bg-green-500' : color === 'red' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
    </div>
);

const PerformanceReports = () => {
    const { role } = useAuth();
    const navigate = useNavigate();
    
    const [orders, setOrders] = useState([]);
    const [filterRange, setFilterRange] = useState('this_month');
    const [historyTab, setHistoryTab] = useState('all'); 
    const [loading, setLoading] = useState(true);

    // 🔒 SECURITY CHECK
    if (role !== 'admin') {
        return <Navigate to="/admin/dashboard" replace />;
    }

    // --- 1. FETCH DATA ---
    useEffect(() => {
        const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => {
                const obj = d.data();
                return {
                    ...obj,
                    id: d.id,
                    date: obj.createdAt?.toDate ? obj.createdAt.toDate() : new Date(obj.createdAt)
                };
            });
            setOrders(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // --- 2. FILTER LOGIC (Date Range) ---
    const filteredData = useMemo(() => {
        const now = new Date();
        const start = new Date();
        
        if (filterRange === 'today') start.setHours(0,0,0,0);
        else if (filterRange === '7_days') start.setDate(now.getDate() - 7);
        else if (filterRange === 'this_month') start.setDate(1); 
        else if (filterRange === 'last_3_months') start.setMonth(now.getMonth() - 3);
        else if (filterRange === 'all') start.setFullYear(2000); 

        return orders.filter(o => o.date >= start);
    }, [orders, filterRange]);

    // --- 3. FILTER LOGIC (History Tabs) ---
    const historyData = useMemo(() => {
        return filteredData.filter(o => {
            if (historyTab === 'all') return true;
            if (historyTab === 'paid') return o.paymentStatus === 'Paid';
            if (historyTab === 'refunded') return o.paymentStatus === 'Refunded' || o.status === 'Void';
            if (historyTab === 'debtors') return o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Part Payment';
            return true;
        });
    }, [filteredData, historyTab]);

    // --- 4. AGGREGATE STATS ---
    const stats = useMemo(() => {
        let cashIn = 0;
        let refunds = 0;
        let debt = 0;
        let repairRev = 0;
        let storeRev = 0;
        
        const dailyMap = {};

        filteredData.forEach(o => {
            if (o.refundedAmount && Number(o.refundedAmount) > 0) {
                refunds += Number(o.refundedAmount);
            }

            if (o.status === 'Void') return;
            
            const paid = Number(o.amountPaid) || 0;
            cashIn += paid;
            debt += (Number(o.balance) || 0);

            if (o.orderType === 'repair' || o.orderType === 'warranty') {
                repairRev += paid;
            } else {
                storeRev += paid;
            }

            const dayKey = o.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            dailyMap[dayKey] = (dailyMap[dayKey] || 0) + paid;
        });

        const chartData = Object.keys(dailyMap).map(key => ({ name: key, amount: dailyMap[key] }));
        return { cashIn, refunds, debt, repairRev, storeRev, chartData };
    }, [filteredData]);

    // --- EXPORT ---
    const handleExport = () => {
        const exportData = historyData.map(o => ({
            "Date": o.date.toLocaleDateString(),
            "Ticket": o.ticketId,
            "Type": o.orderType?.toUpperCase(),
            "Total Cost": o.totalCost || 0,
            "Amount Paid": o.amountPaid || 0,
            "Refunded Amount": o.refundedAmount || 0,
            "Balance Due": o.balance || 0,
            "Payment Status": o.paymentStatus,
            "Order Status": o.status
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Performance");
        XLSX.writeFile(workbook, `FTW_Report_${filterRange}.xlsx`);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-purple-700"></div></div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-10">
            
            {/* Header & Navigation */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2 rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 text-gray-600 flex-shrink-0">
                        <ArrowLeft size={20}/>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2 truncate">
                            <TrendingUp className="text-purple-600 hidden sm:block"/> Performance
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-500">Financial breakdown for <b>{filterRange.replace('_', ' ').toUpperCase()}</b></p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {/* Scrollable Date Filters */}
                    <div className="flex bg-white p-1 rounded-lg border shadow-sm overflow-x-auto no-scrollbar w-full lg:w-auto">
                        {['today', '7_days', 'this_month', 'all'].map(r => (
                            <button 
                                key={r}
                                onClick={() => setFilterRange(r)}
                                className={`whitespace-nowrap px-3 sm:px-4 py-2 rounded-md text-xs font-bold transition ${filterRange === r ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                {r.replace('_', ' ').toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <button onClick={handleExport} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-gray-50 shadow-sm">
                        <Download size={16}/> <span className="hidden sm:inline">Export</span>
                    </button>
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <StatCard title="Total Revenue" value={formatCurrency(stats.cashIn)} subtext="Cash collected" icon={DollarSign} color="green" />
                <StatCard title="Refunds" value={formatCurrency(stats.refunds)} subtext="Returned to customers" icon={ArrowDownLeft} color="red" />
                <StatCard title="Debt" value={formatCurrency(stats.debt)} subtext="Outstanding balance" icon={AlertCircle} color="blue" />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 h-[300px] sm:h-[350px]">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm sm:text-base">Revenue Trend</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{fontSize: 10}} />
                            <YAxis tickFormatter={(value) => `${value/1000}k`} tick={{fontSize: 10}} />
                            <Tooltip formatter={(value) => formatCurrency(value)} cursor={{fill: 'transparent'}} />
                            <Bar dataKey="amount" fill="#7e22ce" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-200 h-[300px] sm:h-[350px]">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm sm:text-base">Revenue Source</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={[{ name: 'Repairs', value: stats.repairRev }, { name: 'Sales', value: stats.storeRev }]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                <Cell fill="#9333ea" />
                                <Cell fill="#22c55e" />
                            </Pie>
                            <Tooltip formatter={(value) => formatCurrency(value)} />
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h3 className="font-bold text-gray-900 text-lg">History</h3>
                    
                    {/* Scrollable History Tabs */}
                    <div className="w-full sm:w-auto overflow-x-auto">
                        <div className="flex bg-gray-100 p-1 rounded-lg whitespace-nowrap w-max">
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'paid', label: 'Paid' },
                                { id: 'refunded', label: 'Refunded' },
                                { id: 'debtors', label: 'Unpaid' }
                            ].map(tab => (
                                <button 
                                    key={tab.id}
                                    onClick={() => setHistoryTab(tab.id)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${historyTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 min-w-[800px] sm:min-w-full">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Ticket</th>
                                <th className="p-4">Type</th>
                                <th className="p-4 text-right">Paid</th>
                                <th className="p-4 text-right text-red-500">Ref</th>
                                <th className="p-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {historyData.slice(0, 15).map(order => (
                                <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/orders/${order.ticketId}`)}>
                                    <td className="p-4 whitespace-nowrap">{order.date.toLocaleDateString()}</td>
                                    <td className="p-4 font-mono font-bold text-purple-700">{order.ticketId}</td>
                                    <td className="p-4 capitalize whitespace-nowrap">
                                        {order.orderType === 'repair' ? '🛠️ Repair' : order.orderType === 'return' ? '🔙 Return' : '🛍️ Sale'}
                                    </td>
                                    <td className="p-4 text-right font-bold text-gray-900">{formatCurrency(order.amountPaid || 0)}</td>
                                    <td className="p-4 text-right text-red-600 font-medium">
                                        {order.refundedAmount > 0 ? `-${formatCurrency(order.refundedAmount)}` : '-'}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap ${
                                            order.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 
                                            order.paymentStatus === 'Refunded' ? 'bg-blue-100 text-blue-700' : 
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {order.paymentStatus}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {historyData.length === 0 && (
                                <tr><td colSpan="6" className="p-10 text-center text-gray-400">No records found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default PerformanceReports;