import React, { useState, useEffect, useMemo } from 'react';
import {
    TrendingUp, Banknote, AlertCircle, ArrowDownLeft,
    Calendar, Filter, Download, PieChart as PieIcon, ArrowLeft, CheckCircle, Wallet,
    ChevronDown, FileText, Activity, Plus, Trash2, Eye, EyeOff
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import * as XLSX from 'xlsx';
import { useAuth } from '../AdminContext';
import { useNavigate, Navigate } from 'react-router-dom';

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);

const formatDate = (date) =>
    date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

const StatCard = ({ title, value, subtext, icon: Icon, color, hideable, onClick }) => {
    const [hidden, setHidden] = useState(hideable ? true : false);

    const colorStyles = {
        green: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600', border: 'border-emerald-100' },
        purple: { bg: 'bg-violet-50', text: 'text-violet-700', icon: 'text-violet-600', border: 'border-violet-100' },
        red: { bg: 'bg-rose-50', text: 'text-rose-700', icon: 'text-rose-600', border: 'border-rose-100' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-600', border: 'border-blue-100' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-600', border: 'border-orange-100' },
    };

    const style = colorStyles[color] || colorStyles.blue;

    return (
        <div
            onClick={onClick}
            className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group transition-all duration-200 
            ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-200 active:scale-[0.98]' : ''}`}
        >
            <div className="flex justify-between items-start z-10 relative">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
                        {hideable && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setHidden(!hidden); }}
                                className="text-slate-300 hover:text-purple-600 transition -mt-1 p-1 rounded hover:bg-slate-50"
                            >
                                {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                        )}
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {hideable && hidden ? '****' : value}
                    </h3>
                </div>
                <div className={`p-3 rounded-xl ${style.bg} ${style.icon} transition-transform group-hover:scale-110`}>
                    <Icon size={20} strokeWidth={2.5} />
                </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                    {subtext}
                </span>
            </div>

            {/* Decorator */}
            <div className={`absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-[0.03] ${style.text.replace('text-', 'bg-')} z-0`} />
        </div>
    );
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 text-xs">
                <p className="font-bold mb-1 opacity-70">{label}</p>
                <p className="text-sm font-bold">{formatCurrency(payload[0].value)}</p>
            </div>
        );
    }
    return null;
};

const PerformanceReports = () => {
    const { role } = useAuth();
    const navigate = useNavigate();

    // Data State
    const [orders, setOrders] = useState([]);
    const [expenses, setExpenses] = useState([]);

    // Filters & UI
    const [filterRange, setFilterRange] = useState('this_month');
    const [loading, setLoading] = useState(true);

    // Expense Modal
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [newExpense, setNewExpense] = useState({ desc: '', amount: '' });

    if (role !== 'admin' && role !== 'ceo') return <Navigate to="/admin/dashboard" replace />;

    // 1. FETCH DATA
    useEffect(() => {
        const qOrders = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const qExpenses = query(collection(db, "Expenses"), orderBy("date", "desc"));

        const unsubOrders = onSnapshot(qOrders,
            (snap) => {
                setOrders(snap.docs.map(d => ({ ...d.data(), id: d.id, date: d.data().createdAt?.toDate() || new Date() })));
            },
            (error) => console.error("Orders access denied:", error)
        );

        const unsubExpenses = onSnapshot(qExpenses,
            (snap) => {
                setExpenses(snap.docs.map(d => ({ ...d.data(), id: d.id, date: d.data().date?.toDate() || new Date() })));
                setLoading(false);
            },
            (error) => {
                console.error("Expenses access denied:", error);
                setExpenses([]);
                setLoading(false);
            }
        );

        return () => { unsubOrders(); unsubExpenses(); };
    }, []);

    // 2. FILTER LOGIC
    const getFilterDate = () => {
        const now = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        if (filterRange === '7_days') start.setDate(now.getDate() - 7);
        else if (filterRange === 'this_month') start.setDate(1);
        else if (filterRange === 'last_3_months') start.setMonth(now.getMonth() - 3);
        else if (filterRange === 'all') start.setFullYear(2000);

        return start;
    };

    const filteredOrders = useMemo(() => orders.filter(o => o.date >= getFilterDate()), [orders, filterRange]);
    const filteredExpenses = useMemo(() => expenses.filter(e => e.date >= getFilterDate()), [expenses, filterRange]);

    // 3. STATS CALCULATION
    const stats = useMemo(() => {
        let netRevenue = 0, refunds = 0, debt = 0, totalExpenses = 0;
        let repairRev = 0, storeRev = 0;
        const dailyMap = {};

        filteredOrders.forEach(o => {
            const paid = Number(o.amountPaid) || 0;
            netRevenue += paid;

            if (Number(o.refundedAmount) > 0) refunds += Number(o.refundedAmount);
            if (o.status !== 'Void') debt += (Number(o.balance) || 0);

            if (o.orderType === 'repair' || o.orderType === 'warranty') repairRev += paid;
            else storeRev += paid;

            const dayKey = o.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            dailyMap[dayKey] = (dailyMap[dayKey] || 0) + paid;
        });

        filteredExpenses.forEach(e => totalExpenses += (Number(e.amount) || 0));

        const netProfit = netRevenue - totalExpenses;

        const chartData = Object.keys(dailyMap)
            .map(key => ({ name: key, amount: dailyMap[key] }))
            .reverse();

        return { netRevenue, refunds, debt, totalExpenses, netProfit, repairRev, storeRev, chartData };
    }, [filteredOrders, filteredExpenses]);

    // 4. ACTIONS
    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!newExpense.desc || !newExpense.amount) return;
        try {
            await addDoc(collection(db, "Expenses"), {
                description: newExpense.desc,
                amount: Number(newExpense.amount),
                date: serverTimestamp()
            });
            setShowExpenseModal(false); setNewExpense({ desc: '', amount: '' });
        } catch (e) { alert("Error adding expense."); }
    };

    const handleDeleteExpense = async (id) => {
        if (window.confirm("Delete this expense?")) {
            try { await deleteDoc(doc(db, "Expenses", id)); }
            catch (e) { alert("Error deleting expense."); }
        }
    };

    const handleExport = () => {
        const exportData = filteredOrders.map(o => ({
            "Date": o.date.toLocaleDateString(), "Ticket": o.ticketId, "Total": o.totalCost, "Paid": o.amountPaid
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData), "Report");
        XLSX.writeFile(wb, `Financial_Report_${filterRange}.xlsx`);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-700"></div></div>;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
            {/* --- HEADER SECTION --- */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button onClick={() => navigate('/admin/dashboard')} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition"><ArrowLeft size={20} /></button>
                    <div>
                        <h1 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                            <Activity className="text-purple-600" /> Financial Performance
                        </h1>
                        <button onClick={() => navigate('/admin/payments')} className="text-xs font-bold text-blue-600 hover:underline mt-0.5">
                            View Full Payment Register →
                        </button>
                    </div>
                </div>
                
                {/* Scrollable Filters on Mobile */}
                <div className="w-full md:w-auto overflow-x-auto no-scrollbar">
                    <div className="flex bg-slate-100 p-1 rounded-xl min-w-max">
                        {['today', '7_days', 'this_month', 'all'].map(tab => (
                            <button key={tab} onClick={() => setFilterRange(tab)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${filterRange === tab ? 'bg-white shadow text-purple-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>{tab.replace('_', ' ')}</button>
                        ))}
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

                {/* --- 1. KEY METRICS --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <StatCard
                        title="Net Revenue"
                        value={formatCurrency(stats.netRevenue)}
                        subtext="Total Income"
                        icon={Wallet}
                        color="green"
                        hideable={true}
                    />
                    <StatCard
                        title="Operational Costs"
                        value={`-${formatCurrency(stats.totalExpenses)}`}
                        subtext="Expenses"
                        icon={ArrowDownLeft}
                        color="red"
                    />
                    <StatCard
                        title="Net Profit"
                        value={formatCurrency(stats.netProfit)}
                        subtext="Revenue - Expenses"
                        icon={Banknote}
                        color={stats.netProfit >= 0 ? "purple" : "orange"}
                        hideable={true}
                    />
                    {/* 🔥 HIDDEN DEBT & CLICKABLE */}
                    <StatCard
                        title="Outstanding Debt"
                        value={formatCurrency(stats.debt)}
                        subtext="Unpaid Balances (Click to View)"
                        icon={AlertCircle}
                        color="blue"
                        hideable={true}
                        onClick={() => navigate('/admin/debt-analysis')} // Navigation to Debt Page
                    />
                </div>

                {/* --- 2. VISUALIZATION --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 h-[300px] sm:h-[350px]">
                        <h3 className="font-bold text-gray-800 mb-4 text-sm sm:text-base">Revenue Trend</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.chartData}>
                                <defs><linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(val) => `₦${val / 1000}k`} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#8b5cf6', strokeWidth: 1, strokeDasharray: '5 5' }} />
                                <Area type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 h-[300px] sm:h-[350px]">
                        <h3 className="font-bold text-gray-800 mb-4 text-sm sm:text-base">Revenue Source</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={[{ name: 'Repairs', value: stats.repairRev }, { name: 'Sales', value: stats.storeRev }]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    <Cell fill="#8b5cf6" />
                                    <Cell fill="#10b981" />
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* --- 3. EXPENSES TABLE --- */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base"><FileText className="text-orange-500" /> Expenses Log</h3>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button onClick={handleExport} className="flex-1 sm:flex-none justify-center bg-white border border-gray-200 text-slate-700 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-xs font-bold transition"><Download size={14} /> Export</button>
                            <button onClick={() => setShowExpenseModal(true)} className="flex-1 sm:flex-none justify-center bg-orange-100 text-orange-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-orange-200 transition"><Plus size={14} /> Add Expense</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <tr><th className="p-3 whitespace-nowrap">Date</th><th className="p-3">Description</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Action</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredExpenses.slice(0, 50).map((exp) => (
                                    <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                                        <td className="p-3 text-slate-500 whitespace-nowrap">{formatDate(exp.date)}</td>
                                        <td className="p-3 font-medium text-slate-800">{exp.description}</td>
                                        <td className="p-3 text-right font-bold text-red-500">-{formatCurrency(exp.amount)}</td>
                                        <td className="p-3 text-right"><button onClick={() => handleDeleteExpense(exp.id)} className="text-slate-400 hover:text-red-600 transition"><Trash2 size={16} /></button></td>
                                    </tr>
                                ))}
                                {filteredExpenses.length === 0 && <tr><td colSpan="4" className="p-12 text-center text-slate-400 font-medium">No expenses recorded.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* ADD EXPENSE MODAL */}
            {showExpenseModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="font-bold text-lg mb-4 text-slate-900">Record New Expense</h3>
                        <form onSubmit={handleAddExpense} className="space-y-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Description</label><input className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g. Fuel" value={newExpense.desc} onChange={e => setNewExpense({ ...newExpense, desc: e.target.value })} autoFocus /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Amount (₦)</label><input type="number" className="w-full p-3 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-purple-500" placeholder="0" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} /></div>
                            <div className="flex gap-2 pt-2"><button type="button" onClick={() => setShowExpenseModal(false)} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200 transition">Cancel</button><button type="submit" className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition shadow-lg">Save Record</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PerformanceReports;