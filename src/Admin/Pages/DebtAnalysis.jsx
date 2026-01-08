import React, { useState, useEffect, useMemo } from 'react';
import { 
    CreditCard, TrendingDown, Users, Search, ArrowLeft, 
    AlertCircle, Clock, AlertTriangle, CheckCircle2, Download,
    Eye, EyeOff, ChevronLeft, ChevronRight, RotateCcw, Wallet
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import { Toast, ConfirmModal } from '../Components/Feedback';

const formatCurrency = (amount) => 
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);

const getTimeDifference = (date) => {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
};

// 🔥 Reusable Hideable Card Component
const DebtStatCard = ({ title, value, subtext, color, hideable }) => {
    const [hidden, setHidden] = useState(hideable ? true : false);

    const theme = {
        red: { border: 'border-red-100', text: 'text-red-600', bg: 'bg-red-50', label: 'text-red-400' },
        orange: { border: 'border-orange-100', text: 'text-orange-600', bg: 'bg-orange-50', label: 'text-orange-400' },
        blue: { border: 'border-blue-100', text: 'text-slate-900', bg: 'bg-blue-50', label: 'text-blue-400' },
        green: { border: 'border-green-100', text: 'text-green-600', bg: 'bg-green-50', label: 'text-green-400' },
    };

    const t = theme[color] || theme.blue;

    return (
        <div className={`bg-white p-6 rounded-2xl border ${t.border} shadow-sm relative overflow-hidden group`}>
            <div className="flex justify-between items-center z-10 relative">
                <p className={`text-xs font-bold ${t.label} uppercase tracking-wider`}>{title}</p>
                {hideable && (
                    <button 
                        onClick={() => setHidden(!hidden)} 
                        className="text-slate-300 hover:text-slate-500 transition p-1"
                    >
                        {hidden ? <Eye size={16}/> : <EyeOff size={16}/>}
                    </button>
                )}
            </div>
            <h3 className={`text-3xl font-black ${t.text} mt-2 z-10 relative`}>
                {hideable && hidden ? '****' : value}
            </h3>
            {subtext && <p className="text-sm text-slate-400 font-medium mt-1 relative z-10">{subtext}</p>}
            
            {/* Decorator Circle */}
            <div className={`absolute -bottom-6 -right-6 w-28 h-28 ${t.bg} rounded-full opacity-50 z-0`} />
        </div>
    );
};

const DebtAnalysis = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRisk, setFilterRisk] = useState('All'); // All, High, Medium, Low, Overpaid

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Feedback
    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

    // 1. FETCH DATA
    useEffect(() => {
        const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ 
                ...d.data(), 
                id: d.id, 
                date: d.data().createdAt?.toDate() || new Date() 
            }));
            
            // 🔥 Filter: Unpaid, Part Payment, OR Negative Balance (Overpaid)
            const debtData = data.filter(o => 
                o.status !== 'Void' && 
                (o.balance > 0 || o.balance < 0)
            );
            
            setOrders(debtData);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // 2. ANALYTICS ENGINE
    const analysis = useMemo(() => {
        let totalDebt = 0;
        let totalOverpaid = 0;
        let highRiskTotal = 0; // > 30 days
        let partPaymentCount = 0;
        let unpaidCount = 0;
        let overpaidCount = 0;

        const agingBuckets = {
            '0-7 Days': 0,
            '8-14 Days': 0,
            '15-30 Days': 0,
            '30+ Days': 0
        };

        orders.forEach(order => {
            const balance = Number(order.balance) || 0;
            const daysOld = getTimeDifference(order.date);
            
            if (balance > 0) {
                totalDebt += balance;
                if (order.paymentStatus === 'Part Payment') partPaymentCount++;
                else unpaidCount++;

                // Aging for Debts
                if (daysOld <= 7) agingBuckets['0-7 Days'] += balance;
                else if (daysOld <= 14) agingBuckets['8-14 Days'] += balance;
                else if (daysOld <= 30) agingBuckets['15-30 Days'] += balance;
                else {
                    agingBuckets['30+ Days'] += balance;
                    highRiskTotal += balance;
                }
                
                order.riskLevel = daysOld > 30 ? 'High' : daysOld > 14 ? 'Medium' : 'Low';
            } else {
                // Overpayment
                totalOverpaid += Math.abs(balance);
                overpaidCount++;
                order.riskLevel = 'Overpaid';
            }
            
            order.daysOld = daysOld;
        });

        const chartData = Object.keys(agingBuckets).map(key => ({
            name: key,
            amount: agingBuckets[key]
        }));

        const pieData = [
            { name: 'Partly Paid', value: partPaymentCount, color: '#f59e0b' },
            { name: 'Unpaid', value: unpaidCount, color: '#ef4444' },
            { name: 'Overpaid', value: overpaidCount, color: '#10b981' }
        ];

        return { totalDebt, totalOverpaid, highRiskTotal, chartData, pieData, debtorsCount: orders.length };
    }, [orders]);

    // 3. FILTER LIST
    const filteredList = useMemo(() => {
        return orders.filter(o => {
            const matchesSearch = 
                o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                o.ticketId?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesRisk = filterRisk === 'All' || o.riskLevel === filterRisk;
            
            return matchesSearch && matchesRisk;
        });
    }, [orders, searchTerm, filterRisk]);

    // 4. PAGINATION LOGIC
    useEffect(() => {
        setCurrentPage(1); 
    }, [searchTerm, filterRisk]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredList.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredList.length / itemsPerPage);

    const handleExport = () => {
        const data = filteredList.map(o => ({
            "Ticket": o.ticketId,
            "Customer": o.customer?.name,
            "Phone": o.customer?.phone,
            "Date": o.date.toLocaleDateString(),
            "Days Overdue": o.daysOld,
            "Total Cost": o.totalCost,
            "Paid": o.amountPaid,
            "Balance": o.balance,
            "Type": o.balance < 0 ? 'Overpaid' : 'Debt'
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Balances");
        XLSX.writeFile(wb, "Balance_Report.xlsx");
    };

    // 🔥 SMART REFUND ACTION
    const handleProcessRefund = (order) => {
        const isOverpayment = order.balance < 0;
        const excessAmount = Math.abs(order.balance);
        const paidAmount = order.amountPaid || 0;

        const title = isOverpayment ? "Refund Excess?" : "Process Full Refund?";
        const message = isOverpayment 
            ? `Customer paid more than required.\nRefund excess: ₦${excessAmount.toLocaleString()}?`
            : `Refund entire payment of ₦${paidAmount.toLocaleString()}? \nThis will clear the debt and void the payment.`;
        
        const confirmText = isOverpayment ? "Refund Excess" : "Refund All";

        setConfirmConfig({
            isOpen: true,
            title: title,
            message: message,
            confirmText: confirmText,
            confirmColor: "bg-blue-600",
            action: async () => {
                try {
                    await runTransaction(db, async (t) => {
                        const ref = doc(db, "Orders", order.id);
                        const docSnap = await t.get(ref);
                        if (!docSnap.exists()) throw "Order missing";
                        
                        const data = docSnap.data();
                        
                        if (isOverpayment) {
                            // 🔥 Refund ONLY the excess amount
                            const newPaid = data.amountPaid - excessAmount;
                            t.update(ref, {
                                amountPaid: newPaid,
                                balance: 0,
                                paymentStatus: 'Paid',
                                refundedAmount: (data.refundedAmount || 0) + excessAmount,
                                refundReason: 'Overpayment Correction',
                                lastUpdated: serverTimestamp()
                            });
                        } else {
                            // 🔥 Refund EVERYTHING (Debt Cancellation)
                            t.update(ref, {
                                amountPaid: 0,
                                refundedAmount: (data.refundedAmount || 0) + paidAmount,
                                paymentStatus: 'Refunded',
                                balance: 0,
                                refundReason: 'Debt Clearance/Cancellation',
                                lastUpdated: serverTimestamp()
                            });
                        }
                    });
                    setToast({ message: "Refund Processed Successfully", type: "success" });
                } catch (e) {
                    console.error(e);
                    setToast({ message: "Action failed", type: "error" });
                }
                setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-700"></div></div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans text-slate-800 pb-20">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={confirmConfig.action} />
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/performance')} className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 text-slate-600"><ArrowLeft size={20}/></button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <Wallet className="text-red-600" /> Balance Analysis
                        </h1>
                        <p className="text-sm text-slate-500 font-medium">Debts, Overpayments & Aging.</p>
                    </div>
                </div>
                <button onClick={handleExport} className="bg-white border border-gray-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-gray-50 shadow-sm">
                    <Download size={16}/> Export Report
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <DebtStatCard 
                    title="Total Debt (In)" 
                    value={formatCurrency(analysis.totalDebt)} 
                    color="red" 
                    hideable={true}
                />
                <DebtStatCard 
                    title="Total Overpaid (Out)" 
                    value={formatCurrency(analysis.totalOverpaid)} 
                    color="green" 
                    subtext="Refunds due to customers"
                    hideable={true}
                />
                <DebtStatCard 
                    title="Active Accounts" 
                    value={analysis.debtorsCount} 
                    subtext="Files with balance"
                    color="blue" 
                    hideable={false}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Aging Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[350px] flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Clock size={18} className="text-purple-600"/> Debt Aging (Time Overdue)</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analysis.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill:'#64748b'}} dy={10}/>
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill:'#64748b'}} tickFormatter={(val)=>`₦${val/1000}k`}/>
                                <Tooltip formatter={(value) => formatCurrency(value)} cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}/>
                                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                    {analysis.chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 3 ? '#ef4444' : index === 2 ? '#f97316' : '#8b5cf6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Composition Pie */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[350px] flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Users size={18} className="text-blue-600"/> Balance Status</h3>
                    <div className="flex-1 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={analysis.pieData} 
                                    cx="50%" cy="50%" 
                                    innerRadius={60} 
                                    outerRadius={80} 
                                    paddingAngle={5} 
                                    dataKey="value"
                                >
                                    {analysis.pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                            <span className="text-xs text-slate-400 font-bold uppercase">Files</span>
                            <span className="text-2xl font-black text-slate-800">{analysis.debtorsCount}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                        <input 
                            className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm" 
                            placeholder="Search customer or ticket..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        {['All', 'High', 'Medium', 'Low', 'Overpaid'].map(r => (
                            <button 
                                key={r} 
                                onClick={() => setFilterRisk(r)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filterRisk === r ? 'bg-slate-800 text-white' : 'bg-white border text-slate-600 hover:bg-gray-50'}`}
                            >
                                {r === 'All' ? 'All' : r}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Ticket</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Balance</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {currentItems.map(order => (
                                <tr key={order.id} className="hover:bg-slate-50/80 transition group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{order.customer?.name}</div>
                                        <div className="text-xs text-slate-500">{order.customer?.phone}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">{order.ticketId}</span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{order.date.toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                                            order.balance < 0 ? 'bg-green-100 text-green-700' :
                                            order.riskLevel === 'High' ? 'bg-red-100 text-red-700' : 
                                            order.riskLevel === 'Medium' ? 'bg-orange-100 text-orange-700' : 
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {order.balance < 0 ? 'Overpaid' : `${order.daysOld} Days`}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-black ${order.balance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {order.balance < 0 ? '+' : ''}{formatCurrency(Math.abs(order.balance))}
                                    </td>
                                    <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                                        <button 
                                            onClick={() => navigate(`/admin/orders/${order.ticketId}`)} 
                                            className="text-purple-600 hover:text-purple-800 text-xs font-bold hover:underline"
                                        >
                                            View
                                        </button>
                                        
                                        {/* 🔥 SMART REFUND BUTTON */}
                                        {(order.amountPaid > 0 || order.balance < 0) && (
                                            <button 
                                                onClick={() => handleProcessRefund(order)} 
                                                className={`p-1.5 rounded-lg transition ${order.balance < 0 ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                                title={order.balance < 0 ? "Refund Excess" : "Refund All"}
                                            >
                                                <RotateCcw size={14}/>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredList.length === 0 && (
                                <tr><td colSpan="6" className="p-12 text-center text-slate-400">No records found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredList.length > itemsPerPage && (
                    <div className="flex justify-between items-center bg-gray-50 border-t border-gray-200 px-6 py-4">
                        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-300 disabled:opacity-30 disabled:hover:bg-transparent transition"><ChevronLeft size={18} className="text-slate-600"/></button>
                        <span className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
                        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-300 disabled:opacity-30 disabled:hover:bg-transparent transition"><ChevronRight size={18} className="text-slate-600"/></button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DebtAnalysis;