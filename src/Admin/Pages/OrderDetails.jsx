import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Printer, DollarSign, CheckCircle, Wrench, Ban, PlusCircle,
    X, RotateCcw, RefreshCw, Lock, Smartphone, Edit2, Trash2, AlertTriangle, Package,
    Loader2, Calendar, User, Mail
} from 'lucide-react';
import {
    collection, query, where, getDocs, doc,
    updateDoc, runTransaction, addDoc, serverTimestamp, Timestamp, onSnapshot, deleteDoc, arrayRemove, increment, arrayUnion
} from 'firebase/firestore';
import { db } from '../../firebaseConfig.js';
import { useAuth } from '../AdminContext';
import { Toast, ConfirmModal, PromptModal } from '../Components/Feedback.jsx';

const OrderDetails = () => {
    const { orderId } = useParams();
    const id = orderId;
    const navigate = useNavigate();
    const { role, user } = useAuth();

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [workers, setWorkers] = useState([]);
    const [isUpdating, setIsUpdating] = useState(false);

    // UI State
    const [showReceipt, setShowReceipt] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Payment State
    const [paymentInput, setPaymentInput] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('POS');

    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [discountInput, setDiscountInput] = useState('');
    const [editingCondition, setEditingCondition] = useState({ index: -1, value: '' });

    // Delete Request
    const [requestModalOpen, setRequestModalOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });
    const [promptConfig, setPromptConfig] = useState({ isOpen: false, title: '', message: '', max: 1, action: null });

    useEffect(() => { if (toast.message) setTimeout(() => setToast({ message: '', type: '' }), 3000); }, [toast.message]);

    // 1. FETCH ORDER
    useEffect(() => {
        const fetchData = async () => {
            let docId = id;
            if (id.startsWith('FTW')) {
                const q = query(collection(db, "Orders"), where("ticketId", "==", id));
                const snap = await getDocs(q);
                if (!snap.empty) docId = snap.docs[0].id;
            }
            onSnapshot(doc(db, "Orders", docId), (docSnap) => {
                if (docSnap.exists()) setOrder({ id: docSnap.id, ...docSnap.data() });
                else navigate('/admin/orders');
                setLoading(false);
            });
        };
        fetchData();
    }, [id, navigate]);

    // 2. FETCH WORKERS
    useEffect(() => {
        onSnapshot(collection(db, "Users"), (snap) => setWorkers(snap.docs.map(d => ({ value: d.data().name || d.data().email, label: d.data().name || d.data().email, isTechnician: d.data().isTechnician || d.data().role === 'worker' })).filter(u => u.isTechnician)));
    }, []);

    // --- HANDLERS ---

    const isLocked = order?.status === 'Collected' || (order?.amountPaid >= order?.totalCost && order?.totalCost > 0) || order?.status === 'Void';

    const handleEditOrder = () => {
        if (isLocked) return setToast({ message: "Order is locked (Paid/Collected)", type: "error" });
        const safeOrder = {
            id: order.id, ticketId: order.ticketId, discount: order.discount || 0,
            customer: { ...order.customer },
            items: (order.items || []).filter(i => i.type === 'repair' || i.type === 'product').map(item => ({
                ...item, qty: Number(item.qty || 1), total: Number(item.total || 0), price: Number(item.price || 0),
                collected: item.collected || false, services: item.services ? item.services.map(s => ({ ...s })) : []
            }))
        };
        navigate('/admin/orders', { state: { orderToEdit: safeOrder } });
    };

    // Add Payment
    const handleAddPayment = async () => {
        const amt = Number(paymentInput);
        if (!amt) return;
        setIsUpdating(true);
        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "Orders", order.id);
                const data = (await t.get(ref)).data();
                const newPaid = (data.amountPaid || 0) + amt;
                const newBal = data.totalCost - newPaid;

                const paymentRecord = {
                    amount: amt,
                    method: paymentMethod,
                    date: new Date().toISOString(),
                    receivedBy: user?.name || "Admin"
                };

                t.update(ref, {
                    amountPaid: newPaid, balance: newBal,
                    paymentStatus: newBal <= 0 ? 'Paid' : 'Part Payment', paid: newBal <= 0,
                    paymentHistory: arrayUnion(paymentRecord)
                });
            });
            setToast({ message: "Payment Recorded", type: "success" });
        } catch (e) { setToast({ message: "Failed", type: "error" }); }
        setIsUpdating(false); setShowPaymentModal(false); setPaymentInput('');
    };

    // Remove Single Payment
    const handleRemovePayment = async (index) => {
        setConfirmConfig({
            isOpen: true, title: "Remove Entry?", message: "Delete this specific payment?", confirmText: "Delete", confirmColor: "bg-red-600",
            action: async () => {
                setIsUpdating(true);
                try {
                    await runTransaction(db, async (t) => {
                        const ref = doc(db, "Orders", order.id);
                        const docSnap = await t.get(ref);
                        if (!docSnap.exists()) throw "Order not found";
                        const data = docSnap.data();

                        const newHistory = [...(data.paymentHistory || [])];
                        newHistory.splice(index, 1); // Remove item

                        const newPaid = newHistory.reduce((sum, p) => sum + Number(p.amount), 0);
                        const newBalance = data.totalCost - newPaid;
                        const newStatus = newBalance <= 0 && data.totalCost > 0 ? 'Paid' : (newPaid > 0 ? 'Part Payment' : 'Unpaid');

                        t.update(ref, {
                            paymentHistory: newHistory,
                            amountPaid: newPaid,
                            balance: newBalance,
                            paymentStatus: newStatus,
                            paid: newBalance <= 0
                        });
                    });
                    setToast({ message: "Entry Removed", type: "success" });
                } catch (e) { setToast({ message: "Failed", type: "error" }); }
                setIsUpdating(false); setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    // Reset ALL Payments
    const handleResetPayment = async () => {
        setIsUpdating(true);
        await updateDoc(doc(db, "Orders", order.id), { amountPaid: 0, balance: order.totalCost, paymentStatus: 'Unpaid', paid: false, paymentHistory: [] });
        setToast({ message: "All Payments Reset", type: "success" });
        setIsUpdating(false);
        setConfirmConfig({ ...confirmConfig, isOpen: false });
    };



    const handleProcessRefund = async () => {
        const reason = prompt("Enter reason for refund:");
        if (!reason) return;
        setIsUpdating(true);
        await updateDoc(doc(db, "Orders", order.id), { amountPaid: 0, refundedAmount: order.amountPaid, paymentStatus: 'Refunded', balance: 0, refundReason: reason });
        setToast({ message: "Refund Processed", type: "success" });
        setIsUpdating(false); setConfirmConfig({ ...confirmConfig, isOpen: false });
    };

    const toggleItemCollected = async (index) => {
        const item = order.items[index];
        const newStatus = !item.collected;

        // 🔥 VALIDATION: Check if item services are completed before collection (Ignore Void)
        if (newStatus && item.type === 'repair' && item.services?.some(s => s.status !== 'Completed' && s.status !== 'Void')) {
            return setToast({ message: "Cannot collect: Repairs not completed!", type: "error" });
        }

        setConfirmConfig({
            isOpen: true, title: newStatus ? "Mark Collected?" : "Undo Collection?",
            message: newStatus ? `Customer received "${item.name || item.deviceModel}"?` : "Mark as NOT collected?",
            confirmText: "Yes, Update", confirmColor: newStatus ? "bg-green-600" : "bg-orange-500",
            action: async () => {
                setIsUpdating(true);
                try {
                    const newItems = [...order.items];
                    newItems[index] = { ...newItems[index], collected: newStatus };
                    const allCollected = newItems.every(i => i.collected || i.type === 'part_usage');
                    const updates = { items: newItems };
                    if (allCollected && order.status !== 'Collected') updates.status = 'Collected';
                    else if (!allCollected && order.status === 'Collected') updates.status = 'Ready for Pickup';
                    await updateDoc(doc(db, "Orders", order.id), updates);
                    setToast({ message: "Item updated", type: "success" });
                } catch (e) { setToast({ message: "Failed", type: "error" }); } finally { setIsUpdating(false); setConfirmConfig({ ...confirmConfig, isOpen: false }); }
            }
        });
    };

    const handleServiceAssign = async (i, s, newWorker) => {
        setIsUpdating(true);
        try {
            const newItems = JSON.parse(JSON.stringify(order.items));
            newItems[i].services[s].worker = newWorker;
            let newStatus = newWorker === 'Unassigned' ? 'Pending' : 'In Progress';
            newItems[i].services[s].status = newStatus;
            let newOrderStatus = order.status === 'Pending' && newStatus === 'In Progress' ? 'In Progress' : order.status;
            await updateDoc(doc(db, "Orders", order.id), { items: newItems, status: newOrderStatus });
            setToast({ message: `Assigned to ${newWorker}`, type: 'success' });
        } catch (e) { setToast({ message: "Failed", type: 'error' }); }
        setIsUpdating(false);
    };

    const handleUpdateDiscount = async () => {
        const val = Number(discountInput);
        if (val < 0) return;
        setIsUpdating(true);
        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "Orders", order.id);
                const data = (await t.get(ref)).data();
                const currentSubtotal = data.subtotal || (data.totalCost + (data.discount || 0));
                const newTotalCost = Math.max(0, currentSubtotal - val);
                let finalPaid = data.amountPaid || 0;
                let newRefunded = data.refundedAmount || 0;
                if (finalPaid > newTotalCost) { newRefunded += (finalPaid - newTotalCost); finalPaid = newTotalCost; }
                const newBalance = newTotalCost - finalPaid;
                t.update(ref, { discount: val, totalCost: newTotalCost, amountPaid: finalPaid, refundedAmount: newRefunded, balance: newBalance, paymentStatus: finalPaid >= newTotalCost ? 'Paid' : (finalPaid > 0 ? 'Part Payment' : 'Unpaid'), paid: finalPaid >= newTotalCost });
            });
            setToast({ message: "Discount Applied", type: "success" });
            setShowDiscountModal(false);
        } catch (e) { setToast({ message: "Failed", type: "error" }); } finally { setIsUpdating(false); }
    };

    const handleVoidProductTrigger = (i) => {
        const item = order.items[i];
        if (item.returned) return;
        if (item.qty > 1) {
            setPromptConfig({ isOpen: true, title: "Partial Return", message: `Return quantity? (Max: ${item.qty})`, max: item.qty, action: (qty) => executeVoidProduct(i, qty) });
        } else {
            setConfirmConfig({ isOpen: true, title: "Return Product?", message: "Restores stock & updates refund.", confirmText: "Return", confirmColor: "bg-red-600", action: () => executeVoidProduct(i, 1) });
        }
    };

    const executeVoidProduct = async (i, returnQty) => {
        setConfirmConfig({ ...confirmConfig, isOpen: false });
        setPromptConfig({ ...promptConfig, isOpen: false });
        setIsUpdating(true);
        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "Orders", order.id);
                const data = (await t.get(ref)).data();
                const newItems = JSON.parse(JSON.stringify(data.items));
                const item = newItems[i];
                if (item.returned) throw "Already returned";

                // Restock Inventory
                if (item.productId) {
                    const invRef = doc(db, "Inventory", item.productId);
                    t.update(invRef, { stock: increment(returnQty) });
                }

                if (returnQty === item.qty) {
                    newItems[i].returned = true;
                } else {
                    newItems[i].qty -= returnQty;
                    newItems[i].total = newItems[i].price * newItems[i].qty;
                    newItems.push({ ...item, qty: returnQty, total: item.price * returnQty, returned: true });
                }

                const deduction = item.price * returnQty;
                const newTotalCost = Math.max(0, (data.totalCost) - deduction);
                const newBalance = newTotalCost - (data.amountPaid || 0);

                t.update(ref, {
                    items: newItems,
                    totalCost: newTotalCost,
                    balance: newBalance,
                    paymentStatus: newBalance < 0 ? 'Refund Due' : (newBalance === 0 ? 'Paid' : 'Part Payment')
                });
            });
            setToast({ message: "Item Returned & Restocked", type: 'success' });
        } catch (e) { setToast({ message: "Failed", type: 'error' }); }
        setIsUpdating(false);
    };

    const handleVoidService = async (i, s) => {
        setConfirmConfig({
            isOpen: true, title: "Void Service?", message: "Removes cost from ticket.", confirmText: "Void", confirmColor: "bg-red-600",
            action: async () => {
                setIsUpdating(true);
                try {
                    await runTransaction(db, async (t) => {
                        const ref = doc(db, "Orders", order.id);
                        const data = (await t.get(ref)).data();
                        const newItems = JSON.parse(JSON.stringify(data.items));
                        newItems[i].services[s].status = 'Void';
                        newItems[i].services[s].worker = 'Unassigned';
                        if (newItems[i].type === 'repair') newItems[i].total = newItems[i].services.reduce((acc, curr) => acc + (curr.status !== 'Void' ? Number(curr.cost || 0) : 0), 0);
                        const newSubtotal = newItems.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
                        const currentDiscount = data.discount || 0;
                        const newTotalCost = Math.max(0, newSubtotal - currentDiscount);
                        let newAmountPaid = data.amountPaid || 0;
                        let newRefundedAmount = data.refundedAmount || 0;
                        if (newAmountPaid > newTotalCost) { newRefundedAmount += (data.amountPaid - newTotalCost); newAmountPaid = newTotalCost; }
                        const newBalance = newTotalCost - newAmountPaid;
                        t.update(ref, { items: newItems, subtotal: newSubtotal, totalCost: newTotalCost, amountPaid: newAmountPaid, refundedAmount: newRefundedAmount, balance: newBalance });
                    });
                    setToast({ message: "Service Voided", type: 'success' });
                } catch (e) { setToast({ message: "Failed", type: 'error' }); }
                setIsUpdating(false);
                setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    const handleVoidOrder = async () => {
        setIsUpdating(true);
        try { await updateDoc(doc(db, "Orders", order.id), { status: 'Void', paymentStatus: 'Voided', balance: 0 }); navigate('/admin/orders'); }
        catch (e) { setToast({ message: "Void Failed", type: 'error' }); }
        setIsUpdating(false);
        setConfirmConfig({ ...confirmConfig, isOpen: false });
    };

    // 🔥 UPDATED: Strict Validation for Collection
    const handleStatusChange = async (e) => {
        const newStatus = e.target.value;
        if (newStatus === 'Void') { setConfirmConfig({ isOpen: true, title: "Void Order?", message: "Cancels order & zeros balance.", confirmText: "Void", confirmColor: "bg-red-600", action: handleVoidOrder }); return; }

        // 🔥 BLOCK COLLECTION IF WORK NOT DONE
        if (newStatus === 'Collected') {
            const hasPendingRepairs = order.items?.some(item =>
                item.type === 'repair' &&
                item.services?.some(s => s.status !== 'Completed' && s.status !== 'Void')
            );

            if (hasPendingRepairs) {
                setToast({ message: "Cannot collect: Repairs not completed!", type: "error" });
                return;
            }
        }

        setIsUpdating(true);
        try {
            const updates = { status: newStatus };

            // If collected, update items to collected=true
            if (newStatus === 'Collected' && order.items) {
                updates.items = order.items.map(item => ({
                    ...item,
                    collected: true
                }));
            }

            await updateDoc(doc(db, "Orders", order.id), updates);
            setToast({ message: "Status Updated", type: "success" });
        } catch (e) {
            setToast({ message: "Update Failed", type: "error" });
        }
        setIsUpdating(false);
    };

    const handleRemovePart = (partItem) => {
        setConfirmConfig({
            isOpen: true, title: "Remove Part?", message: "Remove and restore stock?", confirmText: "Remove", confirmColor: "bg-red-600",
            action: async () => {
                setIsUpdating(true);
                try {
                    await runTransaction(db, async (t) => {
                        if (partItem.partId) {
                            const partRef = doc(db, "Inventory", partItem.partId);
                            const partDoc = await t.get(partRef);
                            if (partDoc.exists()) t.update(partRef, { stock: increment(1) });
                        }
                        t.update(doc(db, "Orders", order.id), { items: arrayRemove(partItem) });
                    });
                    setToast({ message: "Part Removed", type: "success" });
                } catch (e) { setToast({ message: "Failed", type: "error" }); }
                finally { setIsUpdating(false); setConfirmConfig({ ...confirmConfig, isOpen: false }); }
            }
        });
    };

    const handleSaveCondition = async (itemIndex) => {
        setIsUpdating(true);
        try {
            const newItems = JSON.parse(JSON.stringify(order.items));
            newItems[itemIndex].condition = editingCondition.value;
            await updateDoc(doc(db, "Orders", order.id), { items: newItems });
            setToast({ message: "Condition updated", type: "success" });
            setEditingCondition({ index: -1, value: '' });
        } catch (e) { setToast({ message: "Failed", type: "error" }); }
        finally { setIsUpdating(false); }
    };

    const handleWarrantyReturn = async (item) => {
        setIsUpdating(true);
        const newId = `FTW-RMA-${Date.now().toString().slice(-6)}`;
        const warrantyItem = { ...item, services: item.services.map(s => ({ ...s, status: 'Pending', worker: 'Unassigned', cost: 0 })), total: 0, isWarranty: true };
        await addDoc(collection(db, "Orders"), {
            ticketId: newId, originalTicketId: order.ticketId, customer: order.customer, orderType: 'warranty',
            items: [warrantyItem], totalCost: 0, amountPaid: 0, balance: 0, paymentStatus: 'Paid', paid: true, status: 'Pending',
            createdAt: serverTimestamp(), warrantyExpiry: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
        });
        alert(`Warranty Created: ${newId}`);
        navigate('/admin/orders');
        setIsUpdating(false);
    };

    const handleDeleteClick = () => {
        if (role === 'secretary') { setRequestModalOpen(true); return; }
        setConfirmConfig({ isOpen: true, title: "Delete Order?", message: "Permanent.", confirmText: "Delete", confirmColor: "bg-red-600", action: async () => { try { await deleteDoc(doc(db, "Orders", order.id)); setToast({ message: "Deleted", type: "success" }); setTimeout(() => navigate('/admin/orders'), 1000); } catch (e) { setToast({ message: "Failed", type: "error" }); } setConfirmConfig({ ...confirmConfig, isOpen: false }); } });
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        setIsSubmittingRequest(true);
        try { await addDoc(collection(db, "DeletionRequests"), { orderId: order.id, ticketId: order.ticketId, customer: order.customer?.name, reason: deleteReason, requestedBy: user?.name, requestedAt: serverTimestamp(), status: 'pending' }); setToast({ message: "Request Sent", type: "success" }); setRequestModalOpen(false); setDeleteReason(''); } catch (error) { setToast({ message: "Failed", type: "error" }); } finally { setIsSubmittingRequest(false); }
    };

    const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

    // 🔥 FIXED DATE DISPLAY (DD/MM/YYYY)
    const dateStr = order?.createdAt?.seconds
        ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        })
        : 'N/A';

    const isReturn = order?.orderType === 'return';
    const partsUsed = order?.items?.filter(i => i.type === 'part_usage') || [];

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
    if (!order) return <div className="p-10 text-center font-bold">Order not found.</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} onConfirm={() => confirmConfig.action && confirmConfig.action(true)} />
            <PromptModal isOpen={promptConfig.isOpen} title={promptConfig.title} message={promptConfig.message} max={promptConfig.max} onCancel={() => setPromptConfig({ ...promptConfig, isOpen: false })} onConfirm={promptConfig.action} />

            {/* HEADER */}
            <div className="max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-purple-700 transition bg-white px-4 py-2 rounded-lg shadow-sm border"><ArrowLeft size={20} className="mr-2" /> Back</button>
                <div className="flex flex-wrap gap-2 no-print">
                    {(role === 'admin' || role === 'secretary' || role === 'ceo') && (
                        <button onClick={handleDeleteClick} disabled={isUpdating} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition ${role === 'secretary' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {role === 'secretary' ? <AlertTriangle size={16} /> : <Trash2 size={16} />} {role === 'secretary' ? 'Request Delete' : 'Delete'}
                        </button>
                    )}
                    <button onClick={() => setShowReceipt(true)} className="flex items-center gap-2 bg-purple-900 text-white px-4 py-2 rounded-lg hover:bg-purple-800 text-sm font-bold"><Printer size={16} /> Receipt</button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LEFT COLUMN - Order Items */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
                        {/* Status Bar */}
                        <div className="bg-slate-900 p-6 sm:p-8 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                            <div><h1 className="text-3xl font-mono font-black tracking-tight">{order.ticketId}</h1><p className="text-slate-400 text-sm mt-1 flex items-center gap-2"><Calendar size={14} /> {dateStr}</p></div>
                            <div className="bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                                <select value={order.status} onChange={handleStatusChange} disabled={isUpdating || order.status === 'Void'} className="bg-transparent text-white font-bold outline-none cursor-pointer disabled:opacity-80">
                                    {['Pending', 'In Progress', 'Ready for Pickup', 'Completed', 'Collected', 'Void'].map(s => <option key={s} className="text-black">{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-gray-500 uppercase">Items & Services</h3>
                            {!isLocked && (
                                <button onClick={handleEditOrder} className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-200 transition flex items-center gap-1">
                                    <Edit2 size={14} /> Edit Order
                                </button>
                            )}
                        </div>
                        {/* Items Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 uppercase text-xs hidden sm:table-header-group">
                                    <tr><th className="px-6 py-3 text-left">Description</th><th className="px-6 py-3 text-right">Cost</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {order.items.map((item, i) => {
                                        if (item.type === 'part_usage') return null;
                                        return (
                                            <tr key={i} className={`hover:bg-gray-50 transition ${item.collected ? 'bg-green-50/50' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <div className="font-bold text-gray-900 text-base flex items-center gap-2">
                                                            {item.name || item.deviceModel}
                                                            {item.returned && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded border border-red-200">Returned</span>}
                                                            {/* Collected Badge */}
                                                            {item.collected && (
                                                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200 font-bold flex items-center gap-1">
                                                                    <CheckCircle size={10} /> Collected
                                                                </span>
                                                            )}
                                                            {/* Partial Collect Toggle */}
                                                            {order.status !== 'Void' && !isReturn && !item.returned && (
                                                                <button onClick={() => toggleItemCollected(i)} disabled={isUpdating} className={`ml-auto text-[10px] px-2 py-1 rounded border font-bold transition flex items-center gap-1 ${item.collected ? 'text-gray-400 border-gray-200 hover:bg-gray-100' : 'text-green-700 border-green-200 bg-green-50 hover:bg-green-100'}`}>
                                                                    {item.collected ? "Undo Collect" : "Mark Collected"}
                                                                </button>
                                                            )}
                                                            {/* Return Button */}
                                                            {item.type === 'product' && !item.returned && !isReturn && (
                                                                <button onClick={() => handleVoidProductTrigger(i)} disabled={isUpdating} className="text-red-500 hover:bg-red-50 p-1 rounded ml-2" title="Return Product"><RotateCcw size={16} /></button>
                                                            )}
                                                            {item.type === 'repair' && !isReturn && !item.returned && (item.collected || order.status === 'Completed' || order.status === 'Collected') && (
                                                                <div className="ml-2"><button onClick={() => handleWarrantyReturn(item)} className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded border border-orange-200 flex items-center gap-1 w-fit"><RefreshCw size={10} /> Warranty</button></div>
                                                            )}
                                                        </div>
                                                        {item.type === 'repair' && !isReturn && !item.returned && (
                                                            <div className="flex flex-wrap gap-3 text-xs mt-2 text-gray-500 items-center">
                                                                {item.imei && <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded"><Smartphone size={10} /> {item.imei}</span>}
                                                                <div className="flex items-center gap-2 group">
                                                                    {editingCondition.index === i ? (
                                                                        <div className="flex items-center gap-1 animate-in fade-in">
                                                                            <input className="border border-purple-300 rounded px-2 py-0.5 text-xs focus:ring-1 focus:ring-purple-500 outline-none w-32" value={editingCondition.value} onChange={(e) => setEditingCondition({ ...editingCondition, value: e.target.value })} placeholder="Condition..." autoFocus />
                                                                            <button onClick={() => handleSaveCondition(i)} className="text-green-600 hover:bg-green-50 p-1 rounded"><CheckCircle size={14} /></button>
                                                                            <button onClick={() => setEditingCondition({ index: -1, value: '' })} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={14} /></button>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            {item.condition ? <span className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100 font-medium"><AlertTriangle size={10} /> Cond: {item.condition}</span> : <span className="text-xs text-gray-300 italic flex items-center gap-1"><AlertTriangle size={10} /> No condition notes</span>}
                                                                            {!isLocked && <button onClick={() => setEditingCondition({ index: i, value: item.condition || '' })} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-purple-600 transition p-1" title="Edit Condition"><Edit2 size={12} /></button>}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {item.type === 'repair' && <div className="mt-3 space-y-2">
                                                        {item.services?.map((svc, sIdx) => (
                                                            <div key={sIdx} className="p-3 rounded-lg border flex flex-col sm:flex-row justify-between gap-3 bg-gray-50 border-gray-100">
                                                                <div className="flex items-center gap-2">
                                                                    <Wrench size={16} className="text-gray-400" />
                                                                    <span className="font-medium text-gray-700">{svc.service}</span>
                                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${svc.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{svc.status}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {svc.status !== 'Void' && !isLocked && <button onClick={() => handleVoidService(i, sIdx)} disabled={isUpdating} className="text-gray-400 hover:text-red-500"><Ban size={14} /></button>}
                                                                    <select className="bg-white border text-xs p-1.5 rounded font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50" value={svc.worker || "Unassigned"} onChange={(e) => handleServiceAssign(i, sIdx, e.target.value)} disabled={isLocked || svc.status === 'Void'}>
                                                                        <option value="Unassigned">Unassigned</option>
                                                                        {workers.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-gray-800 align-top">{formatCurrency(item.total ?? item.cost ?? 0)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* PARTS USED SECTION */}
                    {partsUsed.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-yellow-50 px-6 py-3 border-b border-yellow-100 flex items-center gap-2"><Package size={18} className="text-yellow-700" /><h3 className="font-bold text-yellow-900 text-sm uppercase">Parts Used</h3></div>
                            <div className="divide-y divide-gray-50">
                                {partsUsed.map((part, idx) => (
                                    <div key={idx} className="px-6 py-3 flex justify-between items-center hover:bg-gray-50">
                                        <div><span className="text-sm font-bold text-slate-700">{part.name.replace('Used: ', '')}</span><div className="text-xs text-slate-400">By {part.worker || 'Unknown'} • {part.usedAt ? new Date(part.usedAt).toLocaleString() : ''}</div></div>
                                        <button onClick={() => handleRemovePart(part)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition disabled:opacity-30" title="Remove Part" disabled={isUpdating || isLocked}><Trash2 size={16} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN - Payment */}
                <div className="space-y-6">
                    <div className="bg-purple-50 p-6 rounded-2xl h-fit border border-purple-100">
                        <h3 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-4 flex items-center gap-2"><User size={16} /> Customer</h3>
                        <div className="space-y-4">
                            <div><p className="text-xs text-purple-400 font-bold uppercase">Name</p><p className="font-bold text-slate-800 text-lg">{order.customer?.name}</p></div>
                            <div><p className="text-xs text-purple-400 font-bold uppercase">Phone</p><p className="font-bold text-slate-800">{order.customer?.phone || 'N/A'}</p></div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm h-fit">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><DollarSign size={18} /> Payment Summary</h3>

                        {/* Financial Breakdown */}
                        <div className="space-y-3 text-sm mb-6">
                            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatCurrency(order.subtotal || (order.totalCost + (order.discount || 0)))}</span></div>
                            <div className="flex justify-between items-center text-red-500 my-1">
                                <div className="flex items-center gap-2"><span>Discount</span>{!isLocked && <button onClick={() => { setDiscountInput(order.discount || ''); setShowDiscountModal(true); }} className="bg-red-50 text-red-600 p-1 rounded hover:bg-red-100 transition" title="Edit Discount"><Edit2 size={12} /></button>}</div>
                                <span>-{formatCurrency(order.discount || 0)}</span>
                            </div>
                            <div className="flex justify-between border-t border-dashed border-gray-200 pt-2"><span>Total Cost</span><span className="font-bold">{formatCurrency(order.totalCost)}</span></div>
                        </div>

                        <div className="flex justify-between items-center border-t border-gray-200 pt-4 mb-6">
                            <span className="font-bold text-gray-600">Balance</span>
                            <span className={`text-2xl font-extrabold ${order.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(order.balance)}</span>
                        </div>

                        {/* Payment History Log */}
                        {order.paymentHistory && order.paymentHistory.length > 0 && (
                            <div className="mb-6 bg-white p-3 rounded-lg border border-gray-200 text-xs">
                                <p className="font-bold text-gray-400 uppercase mb-2">History</p>
                                {order.paymentHistory.map((pay, idx) => (
                                    <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0 group">
                                        <div className="flex flex-col">
                                            <span>{pay.method}</span>
                                            <span className="text-[9px] text-gray-400">{new Date(pay.date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-green-600">+{formatCurrency(pay.amount)}</span>
                                            {/* 🔥 UNDO SINGLE PAYMENT */}
                                            <button
                                                onClick={() => handleRemovePayment(idx)}
                                                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1"
                                                title="Delete Payment"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-3">
                            {(order.status === 'Void' || isReturn) && order.amountPaid > 0 && order.paymentStatus !== 'Refunded' && (
                                <button onClick={() => setConfirmConfig({ isOpen: true, title: "Refund Payment?", message: "Mark as Refunded.", confirmText: "Refund", confirmColor: "bg-blue-600", action: handleProcessRefund })} disabled={isUpdating} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold shadow-sm hover:bg-red-700 transition">Process Refund</button>
                            )}

                            {order.balance > 0 && order.status !== 'Void' && !isReturn && (
                                <button onClick={() => setShowPaymentModal(true)} className="w-full bg-black text-white py-3 rounded-lg font-bold shadow-lg hover:bg-gray-800 transition flex items-center justify-center gap-2"><PlusCircle size={18} /> Record Payment</button>
                            )}

                            {/* 🔥 RESET PAYMENT (Undo All) */}
                            {order.amountPaid > 0 && order.status !== 'Void' && (
                                <button onClick={() => setConfirmConfig({ isOpen: true, title: "Reset Payment?", message: "Clear payment history?", confirmText: "Reset", action: handleResetPayment })} className="w-full text-gray-400 text-xs hover:text-red-600 py-2">Undo All Payments</button>
                            )}

                            {/* Refund Button */}
                            {(order.balance < 0 || order.paymentStatus === 'Refund Due' || (order.amountPaid > 0 && order.status === 'Void')) && (
                                <button onClick={() => setConfirmConfig({ isOpen: true, title: "Process Refund?", message: `Refund ${formatCurrency(Math.abs(order.balance))}?`, confirmText: "Refund", confirmColor: "bg-red-600", action: handleProcessRefund })} disabled={isUpdating} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold shadow-sm hover:bg-red-700 transition">Process Refund</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
                        <h3 className="font-bold text-xl mb-4 text-gray-900">Record Payment</h3>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {['Cash', 'POS', 'Transfer'].map(m => (
                                <button key={m} onClick={() => setPaymentMethod(m)} className={`py-2 text-xs font-bold rounded-lg border transition ${paymentMethod === m ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>{m}</button>
                            ))}
                        </div>
                        <input type="number" autoFocus className="w-full p-4 border-2 border-gray-200 rounded-xl font-bold text-2xl mb-6 focus:border-purple-600 outline-none text-center" value={paymentInput} onChange={e => setPaymentInput(e.target.value)} placeholder="0.00" />
                        <button onClick={handleAddPayment} disabled={isUpdating} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg mb-3">Confirm</button>
                        <button onClick={() => setShowPaymentModal(false)} className="w-full text-gray-500 font-bold hover:bg-gray-100 py-3 rounded-lg">Cancel</button>
                    </div>
                </div>
            )}

            {/* Discount Modal */}
            {showDiscountModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
                        <h3 className="font-bold text-xl mb-4 text-gray-900">Manage Discount</h3>
                        <div className="relative mb-6">
                            <span className="absolute left-4 top-3.5 text-gray-400 font-bold">₦</span>
                            <input type="number" autoFocus className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl font-bold text-lg focus:border-purple-600 outline-none" value={discountInput} onChange={e => setDiscountInput(e.target.value)} placeholder="0.00" />
                        </div>
                        <button onClick={handleUpdateDiscount} disabled={isUpdating} className="w-full bg-purple-900 text-white py-3 rounded-lg font-bold hover:bg-purple-800 transition shadow-lg mb-3">Apply Discount</button>
                        <button onClick={() => setShowDiscountModal(false)} className="w-full text-gray-500 font-bold hover:bg-gray-100 py-3 rounded-lg">Cancel</button>
                    </div>
                </div>
            )}

            {/* Receipt Modal - 🔥 FIXED STRUCTURE FOR PRINTING 🔥 */}
            {showReceipt && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
                    {/* Scroll Wrapper: This gets hidden during print via CSS. 
                        The child .printable-receipt becomes fixed/absolute.
                    */}
                    <div className="max-h-[90vh] overflow-y-auto w-full max-w-md rounded-lg no-scrollbar-print">

                        {/* Printable Content */}
                        <div className="bg-white w-full p-8 rounded shadow-2xl relative printable-receipt">
                            <button onClick={() => setShowReceipt(false)} className="absolute top-2 right-2 text-gray-400 print:hidden hover:text-gray-600"><X /></button>
                            <div className="text-center border-b-2 border-black pb-4 mb-4">
                                <h2 className="text-2xl font-extrabold uppercase tracking-tight">Farouk Techworld</h2>
                                <p className="text-xs font-mono">Mokola Rd, Ibadan</p>
                                <div className="mt-4 border-2 border-black inline-block px-4 py-1 font-bold text-sm">TICKET: {order.ticketId}</div>
                            </div>
                            <div className="flex justify-between text-xs mb-4 font-mono border-b border-dashed border-gray-300 pb-2"><span>{new Date().toLocaleDateString('en-GB')}</span><span>{new Date().toLocaleTimeString()}</span></div>
                            <div className="mb-6 text-sm font-bold uppercase border-b border-black pb-2">Customer: {order.customer.name}</div>
                            <table className="w-full text-xs mb-6 font-mono"><tbody>{order.items.map((item, i) => { if (item.type === 'part_usage') return null; return (<tr key={i}><td className="py-1 pr-2 align-top"><div className="font-bold">{item.name || item.deviceModel}</div></td><td className="text-right align-top whitespace-nowrap">{formatCurrency(item.total ?? item.cost ?? 0)}</td></tr>) })}</tbody></table>
                            <div className="flex justify-between text-lg font-bold border-t-2 border-black pt-2 mb-1"><span>TOTAL:</span><span>{formatCurrency(order.totalCost)}</span></div>
                            <div className="space-y-1 text-sm font-mono mb-6 border-b border-black pb-4"><div className="flex justify-between"><span>Paid:</span><span>{formatCurrency(order.amountPaid || 0)}</span></div><div className="flex justify-between font-bold"><span>Balance:</span><span>{formatCurrency(order.balance)}</span></div></div>
                            <div className="text-center text-[10px] font-mono uppercase"><p>No Refund after payment</p><p>Warranty covers repair only</p><p className="mt-2 font-bold">Thank you!</p></div>
                            <button onClick={() => window.print()} className="w-full mt-6 bg-black text-white py-3 font-bold uppercase rounded hover:bg-gray-800 print:hidden flex items-center justify-center gap-2"><Printer size={18} /> Print Now</button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderDetails;