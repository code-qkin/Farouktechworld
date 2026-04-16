import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    CreditCard, TrendingDown, Users, Search, ArrowLeft, 
    AlertCircle, Clock, AlertTriangle, CheckCircle2, Download,
    Eye, EyeOff, ChevronLeft, ChevronRight, RotateCcw, Wallet,
    FileText, Printer, X
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
import html2pdf from 'html2pdf.js';

const formatCurrency = (amount) => 
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);

const getTimeDifference = (date) => {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
};

// Reusable Hideable Card Component
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

// 🔥 STATE HELPER
const getSavedState = (key, fallback) => {
    try {
        const saved = sessionStorage.getItem('debt_ana_state');
        if (!saved) return fallback;
        const parsed = JSON.parse(saved);
        return parsed[key] !== undefined ? parsed[key] : fallback;
    } catch { return fallback; }
};

const DebtAnalysis = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [allOrders, setAllOrders] = useState([]); // Store all for full extraction
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]); // Multi-select state
    
    // 🔥 PERSISTENT STATE
    const [searchTerm, setSearchTerm] = useState(() => getSavedState('searchTerm', ''));
    const [filterRisk, setFilterRisk] = useState(() => getSavedState('filterRisk', 'All'));
    const [currentPage, setCurrentPage] = useState(() => getSavedState('currentPage', 1));

    const itemsPerPage = 10;

    // Feedback
    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

    // Statement Print State
    const [showStatement, setShowStatement] = useState(false);
    const [statementData, setStatementData] = useState({ customer: '', orders: [], summary: {} });

    // Multi-select Logic
    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = (items) => {
        const allSelected = items.length > 0 && items.every(item => selectedIds.includes(item.id));
        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !items.some(item => item.id === id)));
        } else {
            const newIds = items.map(item => item.id);
            setSelectedIds(prev => [...new Set([...prev, ...newIds])]);
        }
    };

    // 🔥 SAVE STATE
    useEffect(() => {
        const stateToSave = { searchTerm, filterRisk, currentPage };
        sessionStorage.setItem('debt_ana_state', JSON.stringify(stateToSave));
    }, [searchTerm, filterRisk, currentPage]);

    // 1. FETCH DATA
    useEffect(() => {
        const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ 
                ...d.data(), 
                id: d.id, 
                date: d.data().createdAt?.toDate() || new Date() 
            }));
            
            setAllOrders(data); // Store all orders for full extraction

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
    // Removed automatic reset to allow persistence
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredList.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredList.length / itemsPerPage);

    const isAllSelectedOnPage = currentItems.length > 0 && currentItems.every(item => selectedIds.includes(item.id));

    // Auto-correct page if out of bounds
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
    }, [filteredList.length, totalPages, currentPage]);

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

    // 🔥 PREPARE DATA FOR STATEMENT (Precise Matching)
    const getTargetOrders = (targetOrder = null, forceIds = null) => {
        let targetList = allOrders.filter(o => o.status !== 'Void');

        // 0. If bulk IDs are provided
        if (forceIds && forceIds.length > 0) {
            return targetList.filter(o => forceIds.includes(o.id))
                .map(o => ({
                    ...o,
                    date: o.createdAt?.toDate ? o.createdAt.toDate() : (o.date instanceof Date ? o.date : new Date())
                }))
                .sort((a, b) => b.date - a.date);
        }

        // 1. If a specific row button was clicked
        if (targetOrder) {
            const phone = targetOrder.customer?.phone?.trim();
            const name = targetOrder.customer?.name?.trim();

            if (phone && phone.length > 2) {
                // Match by Phone (Strongest link)
                return targetList.filter(o => o.customer?.phone?.trim() === phone);
            } else if (name && name.length > 1) {
                // Match by Name (Fallback)
                return targetList.filter(o => o.customer?.name?.trim() === name);
            } else {
                // No customer info: Only return THIS specific ticket
                return targetList.filter(o => o.ticketId === targetOrder.ticketId);
            }
        } 
        
        // 2. If the top Search-based extract was used
        if (searchTerm) {
            const term = searchTerm.toLowerCase().trim();
            // First, see if we are searching for a specific Ticket ID
            const exactTicket = targetList.find(o => o.ticketId?.toLowerCase() === term);
            if (exactTicket) return getTargetOrders(exactTicket);

            // Otherwise, extract EXACTLY what is visible in the filtered results
            // but grouped by their actual identities to avoid "adding stuffs"
            return targetList.filter(o => 
                o.customer?.name?.toLowerCase().includes(term) || 
                o.customer?.phone?.includes(term) ||
                o.ticketId?.toLowerCase().includes(term)
            );
        }

        return [];
    };

    // 🔥 FULL CUSTOMER EXTRACTION (DETAILED LEDGER)
    const handleCustomerExtract = (targetOrder = null, forceIds = null) => {
        const customerOrders = getTargetOrders(targetOrder, forceIds);
        if (customerOrders.length === 0) {
            setToast({ message: "No records found", type: "error" });
            return;
        }

        const exportData = [];
        const lead = customerOrders[0];
        const clientName = forceIds ? "Multiple Selection" : (lead.customer?.name || "Customer");
        
        exportData.push({ "STATEMENT OF ACCOUNT": `Identity: ${clientName}` });
        if (!forceIds && lead.customer?.phone) exportData.push({ "STATEMENT OF ACCOUNT": `Phone: ${lead.customer.phone}` });
        exportData.push({ "STATEMENT OF ACCOUNT": `Generated: ${new Date().toLocaleString()}` });
        exportData.push({}); // Spacer

        // Summary of this specific set
        const totalBilled = customerOrders.reduce((s, o) => s + (Number(o.totalCost) || 0), 0);
        const totalPaid = customerOrders.reduce((s, o) => s + (Number(o.amountPaid) || 0), 0);
        
        exportData.push({ 
            "Date": "SUMMARY", "Ticket ID": "TOTALS", "Details": "Current Selection", 
            "Order Total": totalBilled, "Amount Paid": totalPaid, "Balance": totalBilled - totalPaid 
        });
        exportData.push({});

        customerOrders.forEach(order => {
            exportData.push({
                "Date": order.date.toLocaleDateString(),
                "Ticket ID": order.ticketId,
                "Details": "ORDER RECORD",
                "Order Total": order.totalCost,
                "Amount Paid": order.amountPaid,
                "Balance": order.balance,
                "Status": order.status
            });

            (order.items || []).forEach(item => {
                exportData.push({
                    "Details": item.type === 'repair' ? `   • ${item.deviceModel} (${item.services?.[0]?.service || 'Repair'})` : `   • ${item.name} (x${item.qty})`,
                    "Item Price": item.total || item.price
                });
            });
            exportData.push({});
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData, { skipHeader: false });
        XLSX.utils.book_append_sheet(wb, ws, "Statement");
        XLSX.writeFile(wb, `Statement_${clientName.replace(/\s+/g, '_')}.xlsx`);
        setSelectedIds([]);
    };

    // 🔥 PRINTABLE PDF HANDLER
    const handlePrepareStatement = (targetOrder = null, forceIds = null) => {
        const customerOrders = getTargetOrders(targetOrder, forceIds);
        if (customerOrders.length === 0) {
            setToast({ message: "No records found", type: "error" });
            return;
        }

        const totalBilled = customerOrders.reduce((s, o) => s + (Number(o.totalCost) || 0), 0);
        const totalPaid = customerOrders.reduce((s, o) => s + (Number(o.amountPaid) || 0), 0);

        setStatementData({
            customer: forceIds ? { name: 'Multiple Selection', phone: 'Various' } : (customerOrders[0].customer || { name: 'Customer', phone: 'N/A' }),
            orders: customerOrders,
            summary: { totalBilled, totalPaid, netBalance: totalBilled - totalPaid }
        });
        setShowStatement(true);
        setSelectedIds([]);
    };

    // --- SUB-COMPONENT: PRINTABLE STATEMENT ---
    const PrintableStatement = ({ data, onClose }) => {
        const { customer, orders, summary } = data;
        const printRef = useRef();
        const [isDownloading, setIsDownloading] = useState(false);

        const handleDownloadPDF = async () => {
            if (!printRef.current) return;
            setIsDownloading(true);
            
            try {
                const element = printRef.current;
                const opt = {
                    margin: [15, 15, 15, 15],
                    filename: `Statement_${customer?.name?.replace(/\s+/g, '_') || 'Customer'}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { 
                        scale: 2, 
                        useCORS: true, 
                        letterRendering: true,
                        logging: false
                    },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
                };
                
                await html2pdf().from(element).set(opt).save();
                setToast({ message: "PDF Downloaded Successfully", type: "success" });
            } catch (error) {
                console.error("PDF Export Error:", error);
                setToast({ message: "Failed to generate PDF", type: "error" });
            } finally {
                setIsDownloading(false);
            }
        };
        
        return (
            <div className="fixed inset-0 bg-black/80 z-[60] flex justify-center p-4 overflow-y-auto no-scrollbar">
                <div className="bg-white w-full max-w-4xl min-h-[90vh] rounded-lg shadow-2xl relative flex flex-col no-scrollbar-print my-auto">
                    {/* Header Controls */}
                    <div className="p-4 border-b flex justify-between items-center print:hidden bg-slate-50 rounded-t-lg">
                        <div className="flex flex-col">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={18}/> Statement Preview</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">View and download your statement</p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleDownloadPDF} 
                                disabled={isDownloading}
                                className="bg-purple-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-purple-800 transition disabled:opacity-50"
                            >
                                {isDownloading ? <><RotateCcw size={18} className="animate-spin"/> Generating...</> : <><Download size={18}/> Download PDF</>}
                            </button>
                            <button onClick={onClose} className="bg-white border text-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-100 transition">
                                <X size={18}/> Close
                            </button>
                        </div>
                    </div>

                    {/* Actual Paper Content */}
                    <div ref={printRef} className="p-8 md:p-12 printable-receipt font-sans text-slate-900 bg-white">
                        {/* Letterhead */}
                        <div className="flex flex-col md:flex-row justify-between items-start border-b-[6px] border-slate-900 pb-10 mb-12" style={{ pageBreakInside: 'avoid' }}>
                            <div className="mb-6 md:mb-0">
                                <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900">Farouk Techworld</h1>
                                <div className="mt-6 text-base space-y-2 text-slate-600 font-medium">
                                    <p className="flex items-center gap-2">Anjola House beside Gastab filling station Mokola Ibadan</p>
                                    <p>Phone: +234 812 345 6789</p>
                                    <p>Email: farouktechworld@gmail.com</p>
                                </div>
                            </div>
                            <div className="text-left md:text-right w-full md:w-auto">
                                <h2 className="text-4xl font-black text-slate-300 uppercase tracking-tighter leading-none mb-2">Statement</h2>
                                <p className="text-lg font-bold text-slate-500 mb-8">Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                <div className="p-6 border-2 border-slate-200 rounded-2xl bg-slate-50 text-left min-w-[280px]">
                                    <p className="text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">Account Holder</p>
                                    <p className="text-2xl font-black uppercase tracking-tight text-slate-900">{customer?.name || 'Walk-in Client'}</p>
                                    <p className="text-lg font-bold text-slate-600 mt-1">{customer?.phone || 'No Phone Registered'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Summary Section - Bold & High Contrast */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16" style={{ pageBreakInside: 'avoid' }}>
                            <div className="p-8 bg-white border-2 border-slate-100 rounded-3xl shadow-sm">
                                <p className="text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">Total Billed</p>
                                <p className="text-3xl font-black text-slate-900">{formatCurrency(summary.totalBilled || 0)}</p>
                            </div>
                            <div className="p-8 bg-green-50/50 border-2 border-green-100 rounded-3xl shadow-sm">
                                <p className="text-xs font-black text-green-600/60 uppercase mb-2 tracking-widest">Total Paid</p>
                                <p className="text-3xl font-black text-green-700">{formatCurrency(summary.totalPaid || 0)}</p>
                            </div>
                            <div className="p-8 bg-slate-900 rounded-3xl shadow-xl shadow-slate-200">
                                <p className="text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">Outstanding Balance</p>
                                <p className="text-3xl font-black text-white">{formatCurrency(summary.netBalance || 0)}</p>
                            </div>
                        </div>

                        {/* Transaction Table - Clean & Wide */}
                        <div className="mb-16">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-4 border-slate-900 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                                        <th className="py-6 px-4">Date</th>
                                        <th className="py-6 px-4">Transaction Details</th>
                                        <th className="py-6 px-4 text-right">Debit</th>
                                        <th className="py-6 px-4 text-right">Credit</th>
                                        <th className="py-6 px-4 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="text-base">
                                    {orders.map(order => (
                                        <React.Fragment key={order.id}>
                                            {/* Order Entry */}
                                            <tr className="bg-slate-50/50" style={{ pageBreakInside: 'avoid' }}>
                                                <td className="py-8 px-4 font-bold text-slate-500 align-top">{order.date ? order.date.toLocaleDateString() : 'N/A'}</td>
                                                <td className="py-8 px-4 align-top">
                                                    <p className="font-black text-lg tracking-tight text-slate-900 mb-2">TICKET: {order.ticketId || 'NO_ID'}</p>
                                                    <div className="space-y-1">
                                                        {(order.items || [])
                                                            .filter(item => item.type !== 'part_usage' && !item.name?.includes('Used:'))
                                                            .map((item, idx) => (
                                                                <p key={idx} className="text-sm font-bold text-slate-500 uppercase tracking-tight">
                                                                    {item.type === 'repair' ? 
                                                                        `• ${item.deviceModel || 'Unknown Device'} Repair` : 
                                                                        `• ${item.name || 'Unknown Product'} (x${item.qty || 1})`
                                                                    }
                                                                </p>
                                                            ))}
                                                        {(!order.items || order.items.filter(item => item.type !== 'part_usage' && !item.name?.includes('Used:')).length === 0) && (
                                                            <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">• Service Transaction</p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-8 px-4 text-right font-black text-lg text-slate-900 align-top">{formatCurrency(order.totalCost || 0)}</td>
                                                <td className="py-8 px-4 text-right font-bold text-slate-200 align-top">-</td>
                                                <td className="py-8 px-4 text-right font-black text-lg text-slate-900 align-top">{formatCurrency(order.totalCost || 0)}</td>
                                            </tr>
                                            {/* Payments for this order */}
                                            {(order.paymentHistory || []).map((p, idx) => (
                                                <tr key={`${order.id}-pay-${idx}`} className="border-b border-slate-100" style={{ pageBreakInside: 'avoid' }}>
                                                    <td className="py-6 px-4 text-sm text-green-600 font-black italic">{p.date ? new Date(p.date).toLocaleDateString() : 'N/A'}</td>
                                                    <td className="py-6 px-8 text-green-700 font-black uppercase text-sm tracking-wide">
                                                        Payment Received — {p.method || 'General'}
                                                    </td>
                                                    <td className="py-6 px-4 text-right text-slate-200 font-bold">-</td>
                                                    <td className="py-6 px-4 text-right font-black text-green-600 text-lg">{formatCurrency(p.amount || 0)}</td>
                                                    <td className="py-6 px-4 text-right font-black text-slate-500 text-lg">
                                                        {formatCurrency((order.totalCost || 0) - (order.paymentHistory.slice(0, idx+1).reduce((s, pay) => s + (pay.amount || 0), 0)))}
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Initial payment fallback */}
                                            {(!order.paymentHistory || order.paymentHistory.length === 0) && order.amountPaid > 0 && (
                                                <tr className="border-b border-slate-100" style={{ pageBreakInside: 'avoid' }}>
                                                    <td className="py-6 px-4 text-sm text-green-600 font-black italic">{order.date ? order.date.toLocaleDateString() : 'N/A'}</td>
                                                    <td className="py-6 px-8 text-green-700 font-black uppercase text-sm tracking-wide">Initial Payment Received</td>
                                                    <td className="py-6 px-4 text-right text-slate-200 font-bold">-</td>
                                                    <td className="py-6 px-4 text-right font-black text-green-600 text-lg">{formatCurrency(order.amountPaid || 0)}</td>
                                                    <td className="py-6 px-4 text-right font-black text-slate-500 text-lg">{formatCurrency(order.balance || 0)}</td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer Notes */}
                        <div className="mt-32 border-t-2 border-slate-100 pt-12 text-center" style={{ pageBreakInside: 'avoid' }}>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Official Computer Generated Statement</p>
                            <p className="text-sm font-bold text-slate-500 max-w-2xl mx-auto leading-relaxed">This is a formal record of your transactions. Please ensure all payments are verified against your receipts. Report any discrepancies within 48 hours.</p>
                            
                            <div className="flex flex-col md:flex-row justify-center gap-16 mt-24 text-slate-900">
                                <div className="text-center">
                                    <div className="w-48 border-b-2 border-slate-900 h-12 mb-4 mx-auto"></div>
                                    <p className="text-xs font-black uppercase tracking-widest">Authorized Signature</p>
                                </div>
                                <div className="text-center">
                                    <div className="w-48 border-b-2 border-slate-900 h-12 mb-4 mx-auto"></div>
                                    <p className="text-xs font-black uppercase tracking-widest">Customer Acknowledgement</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
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
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                        <div className="relative flex-1 sm:max-w-72">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                            <input 
                                className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm" 
                                placeholder="Search customer or ticket..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        {/* Action Buttons: Priority to Selection */}
                        {selectedIds.length > 0 ? (
                            <div className="flex gap-2 items-center bg-purple-50 p-1 rounded-xl border border-purple-100 animate-fade-in">
                                <span className="text-[10px] font-black text-purple-700 px-2 uppercase">{selectedIds.length} Selected</span>
                                <button 
                                    onClick={() => handleCustomerExtract(null, selectedIds)}
                                    className="bg-white border border-purple-200 text-purple-700 px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1.5 hover:bg-purple-100 transition-all"
                                >
                                    <Download size={12}/> Excel
                                </button>
                                <button 
                                    onClick={() => handlePrepareStatement(null, selectedIds)}
                                    className="bg-purple-700 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1.5 hover:bg-purple-800 shadow-sm transition-all"
                                >
                                    <Printer size={12}/> Print Selection
                                </button>
                                <button 
                                    onClick={() => setSelectedIds([])}
                                    className="text-slate-400 hover:text-red-500 p-1.5 transition"
                                    title="Clear Selection"
                                >
                                    <X size={14}/>
                                </button>
                            </div>
                        ) : searchTerm && (
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleCustomerExtract()}
                                    className="bg-white border border-gray-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-gray-50 shadow-sm whitespace-nowrap transition-all"
                                    title="Export Search to Excel"
                                >
                                    <Download size={14}/> Excel
                                </button>
                                <button 
                                    onClick={() => handlePrepareStatement()}
                                    className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-800 shadow-lg shadow-slate-200 whitespace-nowrap transition-all"
                                    title="Print Search results"
                                >
                                    <FileText size={14}/> Print PDF
                                </button>
                            </div>
                        )}
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

                {/* Statement Modal */}
                {showStatement && <PrintableStatement data={statementData} onClose={() => setShowStatement(false)} />}

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 w-10">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                        checked={isAllSelectedOnPage}
                                        onChange={() => toggleSelectAll(currentItems)}
                                    />
                                </th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Ticket</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-right">Balance</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {currentItems.map(order => (
                                <tr key={order.id} className={`hover:bg-slate-50/80 transition group ${selectedIds.includes(order.id) ? 'bg-purple-50/50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                            checked={selectedIds.includes(order.id)}
                                            onChange={() => toggleSelect(order.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{order.customer?.name}</div>
                                        <div className="text-xs text-slate-500">{order.customer?.phone}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">{order.ticketId}</span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{order.date.toLocaleDateString()}</td>
                                    <td className={`px-6 py-4 text-right font-black ${order.balance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {order.balance < 0 ? '+' : ''}{formatCurrency(Math.abs(order.balance))}
                                    </td>
                                    <td className="px-6 py-4 text-center flex items-center justify-center gap-1">
                                        <button 
                                            onClick={() => navigate(`/admin/orders/${order.ticketId}`)} 
                                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                                            title="View Details"
                                        >
                                            <Search size={14}/>
                                        </button>

                                        {/* Per-row Extraction */}
                                        <button 
                                            onClick={() => handlePrepareStatement(order)} 
                                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                            title="Print Statement (PDF)"
                                        >
                                            <Printer size={14}/>
                                        </button>
                                        <button 
                                            onClick={() => handleCustomerExtract(order)} 
                                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                            title="Export History (Excel)"
                                        >
                                            <Download size={14}/>
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
                                <tr><td colSpan="7" className="p-12 text-center text-slate-400">No records found.</td></tr>
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