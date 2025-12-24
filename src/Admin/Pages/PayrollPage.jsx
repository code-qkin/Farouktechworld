import React, { useState, useEffect, useMemo } from 'react';
import { 
    DollarSign, Calendar, Users, Download, ArrowLeft, Layers, 
    ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, 
    Clock, Eye, Printer, Plus, Trash2, X 
} from 'lucide-react';
import { collection, query, getDocs, orderBy, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AdminContext';
import { Toast, ConfirmModal } from '../Components/Feedback';

// --- COMPONENT: PAYSLIP (Printable) ---
const PayslipModal = ({ isOpen, onClose, data }) => {
    if (!isOpen || !data) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Printable Area */}
                <div className="p-8 overflow-y-auto printable-payslip bg-white" id="printable-payslip">
                    <div className="text-center border-b-2 border-gray-800 pb-6 mb-6">
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-widest">PAYSLIP</h1>
                        <p className="text-gray-500 font-mono text-sm mt-1">FaroukTechWorld Ltd.</p>
                        <p className="text-xs text-gray-400">Mokola Hill, Ibadan</p>
                    </div>

                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <p className="text-xs text-gray-400 uppercase font-bold">Employee</p>
                            <h2 className="text-xl font-bold text-gray-900">{data.name}</h2>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400 uppercase font-bold">Pay Period</p>
                            <p className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">{data.week}</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* EARNINGS */}
                        <div>
                            <h3 className="text-xs font-bold text-gray-900 uppercase border-b border-gray-200 pb-1 mb-2">Earnings</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Base Salary</span>
                                    <span className="font-medium">₦{data.baseSalary.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Job Pay ({data.jobsCount} Jobs)</span>
                                    <span className="font-medium">₦{data.fixedPay.toLocaleString()}</span>
                                </div>
                                {data.adjustments?.filter(a => a.amount > 0).map((adj, i) => (
                                    <div key={i} className="flex justify-between text-green-700">
                                        <span>{adj.reason} (Bonus)</span>
                                        <span>+₦{adj.amount.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* DEDUCTIONS */}
                        {(data.adjustments?.some(a => a.amount < 0)) && (
                            <div>
                                <h3 className="text-xs font-bold text-red-600 uppercase border-b border-red-100 pb-1 mb-2">Deductions</h3>
                                <div className="space-y-2 text-sm">
                                    {data.adjustments.filter(a => a.amount < 0).map((adj, i) => (
                                        <div key={i} className="flex justify-between text-red-600">
                                            <span>{adj.reason}</span>
                                            <span>-₦{Math.abs(adj.amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* NET PAY */}
                        <div className="border-t-2 border-gray-800 pt-4 mt-4">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold text-gray-900">NET PAY</span>
                                <span className="text-2xl font-black text-gray-900">₦{data.totalPayout.toLocaleString()}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 text-center uppercase tracking-wide">
                                Generated on {new Date().toLocaleDateString()} • Authorized by Admin
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-gray-50 border-t flex gap-3 print:hidden">
                    <button onClick={onClose} className="flex-1 py-3 rounded-lg font-bold text-gray-600 hover:bg-gray-200">Close</button>
                    <button onClick={() => window.print()} className="flex-1 py-3 rounded-lg font-bold bg-black text-white hover:bg-gray-800 flex items-center justify-center gap-2">
                        <Printer size={18}/> Print Payslip
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: ADJUSTMENT MODAL ---
const AdjustmentModal = ({ isOpen, onClose, onSave, technicianName }) => {
    const [reason, setReason] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('bonus'); // 'bonus' or 'deduction'

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const val = Number(amount);
        if (!reason || !val) return;
        onSave({ 
            reason, 
            amount: type === 'deduction' ? -val : val, 
            date: new Date().toISOString() 
        });
        setReason(''); setAmount(''); onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 animate-fade-in-up">
                <h3 className="font-bold text-lg mb-4">Adjust Pay for {technicianName}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button type="button" onClick={() => setType('bonus')} className={`flex-1 py-2 rounded-md text-sm font-bold transition ${type === 'bonus' ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}>Bonus (+)</button>
                            <button type="button" onClick={() => setType('deduction')} className={`flex-1 py-2 rounded-md text-sm font-bold transition ${type === 'deduction' ? 'bg-red-500 text-white shadow' : 'text-gray-500'}`}>Deduction (-)</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Amount (₦)</label>
                        <input type="number" autoFocus className="w-full p-3 border rounded-lg font-bold" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason</label>
                        <input type="text" className="w-full p-3 border rounded-lg" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Late Arrival, Sales Bonus" required />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button type="submit" className="flex-1 py-3 bg-purple-900 text-white font-bold rounded-lg hover:bg-purple-800">Add</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: Summary Card ---
const SummaryCard = ({ label, value, icon: Icon, color, subtext, highlight }) => (
    <div className={`bg-white p-5 rounded-xl border shadow-sm flex items-center justify-between transition-all ${highlight ? 'ring-2 ring-red-100 border-red-200' : 'border-gray-100'}`}>
        <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-3xl font-black ${color}`}>{value}</p>
            {subtext && <p className="text-[10px] text-gray-400 mt-1 font-medium">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('600', '50').replace('700', '50').replace('500', '50')}`}>
            <Icon className={`w-7 h-7 ${color}`} />
        </div>
    </div>
);

const PayrollPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // Data States
    const [allOrders, setAllOrders] = useState([]); 
    const [staffSettings, setStaffSettings] = useState({});
    const [payouts, setPayouts] = useState({}); 
    const [adjustments, setAdjustments] = useState({}); 
    const [loading, setLoading] = useState(true);
    
    // UI States
    const [viewMode, setViewMode] = useState('single'); 
    const [detailsModal, setDetailsModal] = useState({ isOpen: false, staff: null });
    const [payslipModal, setPayslipModal] = useState({ isOpen: false, data: null });
    const [adjustModal, setAdjustModal] = useState({ isOpen: false, staff: null, week: '' });

    // Feedback
    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

    // --- HELPER: Date Ranges ---
    const getCurrentWeekStr = () => {
        const date = new Date();
        const year = date.getFullYear();
        const firstJan = new Date(year, 0, 1);
        const numberOfDays = Math.floor((date - firstJan) / (24 * 60 * 60 * 1000));
        const week = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
        return `${year}-W${week.toString().padStart(2, '0')}`;
    };
    const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekStr()); 

    const getStartOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff); d.setHours(0,0,0,0); return d;
    };
    const getWeekRangeFromStr = (weekStr) => {
        const [year, week] = weekStr.split('-W');
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        const start = getStartOfWeek(simple);
        const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
        return { start, end };
    };

    // --- 1. INITIAL FETCH ---
    useEffect(() => {
        const loadAllData = async () => {
            setLoading(true);
            try {
                // A. Settings (Including Admins, Secretaries, and Workers)
                const uSnap = await getDocs(collection(db, "Users"));
                const settingsMap = {};
                uSnap.docs.forEach(doc => {
                    const u = doc.data();
                    // 🔥 UPDATED: Include Worker, Secretary, and Admin
                    if (['worker', 'secretary', 'admin'].includes(u.role)) {
                        settingsMap[u.name] = { base: Number(u.baseSalary || 0), fixed: Number(u.fixedPerJob || 0) };
                    }
                });
                setStaffSettings(settingsMap);

                // B. Orders
                const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
                const snap = await getDocs(q);
                setAllOrders(snap.docs.map(d => d.data()));

                // C. Payout Records (Snapshots)
                const pSnap = await getDocs(collection(db, "PayrollRecords"));
                const payoutMap = {};
                pSnap.docs.forEach(doc => payoutMap[doc.id] = doc.data());
                setPayouts(payoutMap);

                // D. Adjustments
                const aSnap = await getDocs(collection(db, "PayrollAdjustments"));
                const adjMap = {};
                aSnap.docs.forEach(doc => adjMap[doc.id] = doc.data().items || []);
                setAdjustments(adjMap);

            } catch (error) {
                console.error(error);
                setToast({ message: "Failed to load data", type: "error" });
            } finally {
                setLoading(false);
            }
        };
        loadAllData();
    }, []);

    // --- 2. CALCULATIONS ENGINE ---
    const calculatePayouts = (orderList, weekStr) => {
        const stats = {};
        
        // Init everyone
        Object.keys(staffSettings).forEach(name => {
            const recordId = `${weekStr}_${name}`;
            const snapshot = payouts[recordId];

            if (snapshot) {
                stats[name] = { ...snapshot, isPaid: true };
            } else {
                const userAdjustments = adjustments[recordId] || [];
                const adjustmentTotal = userAdjustments.reduce((sum, item) => sum + item.amount, 0);

                stats[name] = { 
                    name, week: weekStr, jobsCount: 0, 
                    baseSalary: staffSettings[name].base, 
                    fixedRate: staffSettings[name].fixed,
                    fixedPay: 0, 
                    adjustmentTotal,
                    adjustments: userAdjustments,
                    totalPayout: staffSettings[name].base + adjustmentTotal,
                    taskList: [],
                    isPaid: false
                };
            }
        });

        // Sum up jobs (only for unpaid weeks)
        orderList.forEach(order => {
            if (!order.items) return;
            order.items.forEach(item => {
                if (item.type === 'repair' && item.services) {
                    item.services.forEach(svc => {
                        if (svc.status === 'Completed' && svc.worker && svc.worker !== 'Unassigned') {
                            const name = svc.worker;
                            // Only update if not paid yet
                            if (stats[name] && !stats[name].isPaid) {
                                stats[name].jobsCount += 1;
                                stats[name].fixedPay += stats[name].fixedRate;
                                stats[name].totalPayout += stats[name].fixedRate;
                                stats[name].taskList.push({
                                    ticket: order.ticketId,
                                    device: item.deviceModel || item.name,
                                    service: svc.service,
                                    date: order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'N/A'
                                });
                            }
                        }
                    });
                }
            });
        });

        return Object.values(stats).filter(s => s.totalPayout !== 0 || s.jobsCount > 0 || s.isPaid);
    };

    // --- 3. DATA GROUPING ---
    const allTimeGroups = useMemo(() => {
        const groups = {};
        allOrders.forEach(order => {
            if (!order.createdAt) return;
            const d = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
            const d2 = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            const dayNum = d2.getUTCDay() || 7;
            d2.setUTCDate(d2.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d2.getUTCFullYear(),0,1));
            const weekNo = Math.ceil((((d2 - yearStart) / 86400000) + 1)/7);
            const weekKey = `${d2.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
            if (!groups[weekKey]) groups[weekKey] = [];
            groups[weekKey].push(order);
        });

        return Object.entries(groups)
            .map(([weekStr, ords]) => ({
                weekStr,
                startDate: getWeekRangeFromStr(weekStr).start,
                stats: calculatePayouts(ords, weekStr)
            }))
            .sort((a, b) => b.startDate - a.startDate);
    }, [allOrders, staffSettings, adjustments, payouts]);

    const singleWeekStats = useMemo(() => {
        const { start, end } = getWeekRangeFromStr(selectedWeek);
        const filtered = allOrders.filter(o => {
            const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
            return d >= start && d <= end;
        });
        return calculatePayouts(filtered, selectedWeek);
    }, [allOrders, selectedWeek, staffSettings, adjustments, payouts]);

    const globalSummary = useMemo(() => {
        let totalDebt = 0, totalPaid = 0;
        allTimeGroups.forEach(group => {
            group.stats.forEach(staff => {
                if (staff.isPaid) totalPaid += staff.totalPayout;
                else totalDebt += staff.totalPayout;
            });
        });
        return { totalDebt, totalPaid };
    }, [allTimeGroups]);

    // --- ACTIONS ---
    const handleAddAdjustment = async (adjData) => {
        const recordId = `${adjustModal.week}_${adjustModal.staff.name}`;
        const newItems = [...(adjustments[recordId] || []), adjData];
        
        try {
            await setDoc(doc(db, "PayrollAdjustments", recordId), { items: newItems }, { merge: true });
            setAdjustments({ ...adjustments, [recordId]: newItems });
            setToast({ message: "Adjustment added", type: "success" });
        } catch (e) { setToast({ message: "Failed to save", type: "error" }); }
    };

    const togglePaymentStatus = async (staff, weekStr) => {
        const recordId = `${weekStr}_${staff.name}`;
        
        const action = async () => {
            try {
                if (staff.isPaid) {
                    await deleteDoc(doc(db, "PayrollRecords", recordId));
                    const newP = { ...payouts }; 
                    delete newP[recordId]; 
                    setPayouts(newP);
                    setToast({ message: "Payment revoked (Re-opened)", type: "info" });
                } else {
                    const record = { 
                        name: staff.name || "Unknown",
                        week: weekStr,
                        jobsCount: Number(staff.jobsCount || 0),
                        baseSalary: Number(staff.baseSalary || 0),
                        fixedPay: Number(staff.fixedPay || 0),
                        adjustmentTotal: Number(staff.adjustmentTotal || 0),
                        adjustments: staff.adjustments || [], 
                        taskList: staff.taskList || [], 
                        totalPayout: Number(staff.totalPayout || 0),
                        paidAt: serverTimestamp(), 
                        paidBy: user?.name || "Admin", 
                        status: 'Paid',
                        isPaid: true
                    };
                    await setDoc(doc(db, "PayrollRecords", recordId), record);
                    setPayouts({ ...payouts, [recordId]: record });
                    setToast({ message: "Payment Confirmed & Locked", type: "success" });
                }
            } catch (e) { 
                console.error("PAYMENT ERROR:", e);
                setToast({ message: `Failed: ${e.message}`, type: "error" }); 
            }
            setConfirmConfig({ ...confirmConfig, isOpen: false });
        };
        
        setConfirmConfig({
            isOpen: true,
            title: staff.isPaid ? "Revoke Payment?" : "Confirm Payout",
            message: staff.isPaid 
                ? `Unlocking this record allows changes. Continue?` 
                : `Confirm ₦${staff.totalPayout.toLocaleString()} for ${staff.name}?`,
            confirmText: staff.isPaid ? "Revoke" : "Confirm",
            confirmColor: staff.isPaid ? "bg-red-600" : "bg-green-600",
            action
        });
    };

    // --- RENDER TABLE ---
    const PayrollTable = ({ stats, currentWeekStr }) => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 uppercase text-xs">
                    <tr>
                        <th className="px-6 py-4">Technician</th>
                        <th className="px-6 py-4 text-center">Jobs</th>
                        <th className="px-6 py-4 text-right">Base</th>
                        <th className="px-6 py-4 text-right">Job Pay</th>
                        <th className="px-6 py-4 text-right">Adj.</th>
                        <th className="px-6 py-4 text-right">Total</th>
                        <th className="px-6 py-4 text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {stats.map((staff) => (
                        <tr key={staff.name} className={`hover:bg-gray-50 transition ${staff.isPaid ? 'bg-green-50/40' : ''}`}>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2 font-bold text-gray-900">
                                    <div className="p-1.5 bg-gray-100 rounded-full"><Users size={14}/></div>
                                    {staff.name}
                                </div>
                                <div className="flex gap-2 ml-8 mt-1">
                                    <button onClick={() => setDetailsModal({ isOpen: true, staff })} className="text-[10px] text-purple-600 font-bold hover:underline flex items-center gap-1">
                                        <Eye size={10}/> Audit
                                    </button>
                                    {!staff.isPaid && (
                                        <button onClick={() => setAdjustModal({ isOpen: true, staff, week: currentWeekStr })} className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1">
                                            <Plus size={10}/> Adjust
                                        </button>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-gray-600">{staff.jobsCount}</td>
                            <td className="px-6 py-4 text-right text-gray-500">₦{staff.baseSalary.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right text-gray-500">₦{staff.fixedPay.toLocaleString()}</td>
                            <td className={`px-6 py-4 text-right font-bold ${staff.adjustmentTotal < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                {staff.adjustmentTotal !== 0 ? `₦${staff.adjustmentTotal.toLocaleString()}` : '-'}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-purple-700">₦{staff.totalPayout.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    {staff.isPaid && (
                                        <button onClick={() => setPayslipModal({ isOpen: true, data: staff })} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600" title="Print Payslip">
                                            <Printer size={16}/>
                                        </button>
                                    )}
                                    <button onClick={() => togglePaymentStatus(staff, currentWeekStr)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${staff.isPaid ? 'bg-white border border-gray-300 text-gray-500' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                                        {staff.isPaid ? 'Undo' : 'Pay'}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {stats.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-gray-400 italic">No payroll data for this period.</td></tr>}
                </tbody>
            </table>
        </div>
    );

    const WeeklyAccordion = ({ group }) => {
        const [isOpen, setIsOpen] = useState(false);
        const { total, paid, pending } = group.stats.reduce((acc, curr) => {
            acc.total += curr.totalPayout;
            if(curr.isPaid) acc.paid += curr.totalPayout; else acc.pending += curr.totalPayout;
            return acc;
        }, { total: 0, paid: 0, pending: 0 });
        
        return (
            <div className={`mb-4 border rounded-xl overflow-hidden shadow-sm transition ${pending === 0 && total > 0 ? 'bg-green-50/50 border-green-200' : 'bg-white border-gray-200'}`}>
                <button onClick={() => setIsOpen(!isOpen)} className="w-full p-4 flex flex-col sm:flex-row justify-between items-center hover:bg-gray-50/50 transition gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg transition ${isOpen ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</div>
                        <div className="text-left">
                            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">{group.weekStr} {pending === 0 && total > 0 && <CheckCircle size={16} className="text-green-600"/>}</h3>
                            <p className="text-xs text-gray-500">{group.startDate.toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="flex gap-8 text-right">
                        <div><p className="text-[10px] text-gray-400 uppercase font-bold">Total</p><p className="font-bold text-gray-800">₦{total.toLocaleString()}</p></div>
                        <div className="hidden sm:block"><p className="text-[10px] text-gray-400 uppercase font-bold">Paid</p><p className="font-bold text-green-600">₦{paid.toLocaleString()}</p></div>
                        <div><p className="text-[10px] text-gray-400 uppercase font-bold">Unpaid</p><p className={`font-bold ${pending > 0 ? 'text-red-500' : 'text-gray-400'}`}>₦{pending.toLocaleString()}</p></div>
                    </div>
                </button>
                {isOpen && <div className="p-4 border-t border-gray-100 bg-gray-50/30"><PayrollTable stats={group.stats} currentWeekStr={group.weekStr}/></div>}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 sm:p-10">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />
            <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={confirmConfig.action} />
            
            <PayslipModal isOpen={payslipModal.isOpen} data={payslipModal.data} onClose={() => setPayslipModal({isOpen: false, data: null})} />
            <AdjustmentModal isOpen={adjustModal.isOpen} technicianName={adjustModal.staff?.name} onClose={() => setAdjustModal({isOpen: false, staff: null})} onSave={handleAddAdjustment} />

            {/* AUDIT MODAL */}
            {detailsModal.isOpen && detailsModal.staff && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in zoom-in-95">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <div><h3 className="font-bold text-lg text-gray-900">{detailsModal.staff.name}</h3><p className="text-xs text-gray-500">Breakdown of earnings</p></div>
                            <button onClick={() => setDetailsModal({ isOpen: false, staff: null })} className="p-2 hover:bg-gray-200 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            <div className="flex justify-between items-center bg-purple-50 p-3 rounded-lg border border-purple-100 mb-4">
                                <span className="text-sm font-bold text-purple-800">Fixed Rate</span><span className="font-mono font-bold text-purple-900">₦{detailsModal.staff.fixedRate.toLocaleString()} / Job</span>
                            </div>
                            
                            {/* ADJUSTMENTS LIST */}
                            {detailsModal.staff.adjustments?.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Adjustments</h4>
                                    <div className="space-y-1">
                                        {detailsModal.staff.adjustments.map((adj, i) => (
                                            <div key={i} className={`flex justify-between text-sm p-2 rounded ${adj.amount > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                <span>{adj.reason}</span><span className="font-bold">{adj.amount > 0 ? '+' : ''}₦{adj.amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Completed Jobs ({detailsModal.staff.jobsCount})</h4>
                            <div className="space-y-2">
                                {detailsModal.staff.taskList.map((task, i) => (
                                    <div key={i} className="flex justify-between items-start text-sm border-b border-dashed border-gray-100 pb-2 last:border-0">
                                        <div><div className="font-bold text-gray-800">{task.device} - {task.service}</div><div className="text-xs text-gray-400 flex gap-2"><span>{task.date}</span><span>•</span><span className="font-mono">{task.ticket}</span></div></div>
                                        <span className="font-medium text-green-600">+₦{detailsModal.staff.fixedRate.toLocaleString()}</span>
                                    </div>
                                ))}
                                {detailsModal.staff.taskList.length === 0 && <p className="text-gray-400 italic text-sm">No jobs completed this period.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-purple-900 flex items-center gap-2"><DollarSign className="text-green-600"/> Payroll Center</h1>
                    <p className="text-gray-500 text-sm mt-1">Professional staff payout management.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => navigate('/admin/dashboard')} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 flex items-center gap-2"><ArrowLeft size={16}/> Dashboard</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <SummaryCard label="Outstanding Debt" value={`₦${globalSummary.totalDebt.toLocaleString()}`} icon={AlertCircle} color="text-red-500" subtext="Unpaid wages" highlight={globalSummary.totalDebt > 0} />
                <SummaryCard label="Total Disbursed" value={`₦${globalSummary.totalPaid.toLocaleString()}`} icon={CheckCircle} color="text-green-600" subtext="All-time paid" />
                <SummaryCard label="Pending Week" value={`₦${singleWeekStats.reduce((a,b)=>a+(!b.isPaid?b.totalPayout:0),0).toLocaleString()}`} icon={Clock} color="text-purple-600" subtext={`For ${selectedWeek}`} />
            </div>

            <div className="bg-white p-2 rounded-xl border shadow-sm mb-6 inline-flex gap-1">
                <button onClick={() => setViewMode('single')} className={`px-4 py-2 rounded-lg text-sm font-bold flex gap-2 ${viewMode === 'single' ? 'bg-purple-100 text-purple-800' : 'text-gray-500 hover:bg-gray-50'}`}><Calendar size={16}/> Current Week</button>
                <button onClick={() => setViewMode('all-time')} className={`px-4 py-2 rounded-lg text-sm font-bold flex gap-2 ${viewMode === 'all-time' ? 'bg-purple-100 text-purple-800' : 'text-gray-500 hover:bg-gray-50'}`}><Layers size={16}/> History</button>
            </div>

            {loading ? <div className="py-20 text-center text-gray-400">Loading payroll data...</div> : (
                <>
                    {viewMode === 'single' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4 max-w-sm">
                                <Calendar className="text-purple-500" size={20}/>
                                <div className="flex-1"><label className="text-xs font-bold text-gray-400 uppercase">Select Week</label><input type="week" className="w-full font-bold text-gray-700 outline-none bg-transparent" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}/></div>
                            </div>
                            <PayrollTable stats={singleWeekStats} currentWeekStr={selectedWeek} />
                        </div>
                    )}
                    {viewMode === 'all-time' && (
                        <div className="space-y-4 animate-in fade-in">{allTimeGroups.map(g => <WeeklyAccordion key={g.weekStr} group={g}/>)}</div>
                    )}
                </>
            )}
        </div>
    );
};

export default PayrollPage;