import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Printer, DollarSign, 
    CheckCircle, Wrench, Ban, PlusCircle, 
    X, RotateCcw, RefreshCw, Lock, Smartphone, Edit2, Trash2, AlertTriangle, Package, Save,
    Send, Loader2, Calendar, User, ShoppingBag
} from 'lucide-react';
import { 
    collection, query, where, getDocs, doc, 
    updateDoc, runTransaction, addDoc, serverTimestamp, Timestamp, onSnapshot, deleteDoc, arrayRemove, increment 
} from 'firebase/firestore'; 
import { db } from '../../firebaseConfig.js';
import { useAuth } from '../AdminContext';
import { Toast, ConfirmModal, PromptModal } from '../Components/Feedback.jsx';

const OrderDetails = () => {
    const { orderId } = useParams(); 
    const id = orderId;
    const navigate = useNavigate();
    const { role, user } = useAuth();
    
    // ✅ Defined Categories
    const storeCategories = [
        "Accessories", "Phones", "Laptops", "Chargers", 
        "Screen Guards", "Audio", "Parts", "Services", "Others"
    ];

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [workers, setWorkers] = useState([]);
    const [isUpdating, setIsUpdating] = useState(false);
    
    // UI
    const [showReceipt, setShowReceipt] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentInput, setPaymentInput] = useState('');
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [discountInput, setDiscountInput] = useState('');
    
    // Condition Editing State
    const [editingCondition, setEditingCondition] = useState({ index: -1, value: '' });

    // Delete Request State
    const [requestModalOpen, setRequestModalOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });
    const [promptConfig, setPromptConfig] = useState({ isOpen: false, title: '', message: '', max: 1, action: null });

    // 🔥 FIX: Auto-Dismiss Toast after 3 seconds
    useEffect(() => {
        if (toast.message) {
            const timer = setTimeout(() => {
                setToast({ message: '', type: '' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [toast.message]);

    // 1. FETCH ORDER DATA (Real-time)
    useEffect(() => {
        let unsubscribe;
        const fetchData = async () => {
            try {
                let docId = id;
                if (id.startsWith('FTW')) {
                    const q = query(collection(db, "Orders"), where("ticketId", "==", id));
                    const snap = await getDocs(q);
                    if (!snap.empty) docId = snap.docs[0].id;
                }

                unsubscribe = onSnapshot(doc(db, "Orders", docId), (docSnap) => {
                    if (docSnap.exists()) {
                        setOrder({ id: docSnap.id, ...docSnap.data() });
                    } else {
                        navigate('/admin/orders');
                    }
                    setLoading(false);
                });

            } catch (e) { console.error(e); setLoading(false); }
        };
        fetchData();
        return () => unsubscribe && unsubscribe();
    }, [id, navigate]);

    // 2. FETCH WORKERS
    useEffect(() => {
        const unsubUsers = onSnapshot(collection(db, "Users"), (snapshot) => {
            const eligible = snapshot.docs
                .map(doc => {
                    const u = doc.data();
                    const safeName = u.name && u.name.trim() !== "" ? u.name : u.email;
                    return {
                        value: safeName, 
                        label: `${safeName} ${u.role !== 'worker' ? `(${u.role})` : ''}`,
                        isTechnician: u.isTechnician || u.role === 'worker'
                    };
                })
                .filter(u => u.isTechnician)
                .sort((a, b) => a.label.localeCompare(b.label));

            setWorkers(eligible);
        });
        return () => unsubUsers();
    }, []);

    // --- HANDLERS ---
    
    const handleServiceAssign = async (i, s, newWorker) => {
        setIsUpdating(true);
        try {
            const newItems = JSON.parse(JSON.stringify(order.items));
            newItems[i].services[s].worker = newWorker;
            let newOrderStatus = order.status; 
            if (newWorker === 'Unassigned') {
                newItems[i].services[s].status = 'Pending';
            } else {
                newItems[i].services[s].status = 'In Progress';
                if (order.status === 'Pending') {
                    newOrderStatus = 'In Progress';
                }
            }
            await updateDoc(doc(db, "Orders", order.id), { items: newItems, status: newOrderStatus });
            setToast({message: `Assigned to ${newWorker}`, type: 'success'});
        } catch(e) { console.error(e); setToast({message: "Assignment Failed", type: 'error'}); }
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
                const newDiscount = val;
                const newTotalCost = Math.max(0, currentSubtotal - newDiscount);
                let finalPaid = data.amountPaid || 0;
                let newRefunded = data.refundedAmount || 0;
                if (finalPaid > newTotalCost) {
                    const diff = finalPaid - newTotalCost;
                    finalPaid = newTotalCost;
                    newRefunded += diff; 
                }
                const newBalance = newTotalCost - finalPaid;
                t.update(ref, {
                    subtotal: currentSubtotal, discount: newDiscount, totalCost: newTotalCost,
                    amountPaid: finalPaid, refundedAmount: newRefunded, balance: newBalance,
                    paymentStatus: finalPaid >= newTotalCost ? 'Paid' : (finalPaid > 0 ? 'Part Payment' : 'Unpaid'),
                    paid: finalPaid >= newTotalCost
                });
            });
            setToast({ message: "Discount Applied", type: "success" });
            setShowDiscountModal(false);
        } catch (e) { console.error(e); setToast({ message: "Update Failed", type: "error" }); } finally { setIsUpdating(false); }
    };

    const handleVoidProductTrigger = (i) => {
        const item = order.items[i];
        if (item.returned) return;
        if (item.qty > 1) {
            setPromptConfig({
                isOpen: true, title: "Partial Return", message: `Return quantity? (Max: ${item.qty})`, max: item.qty,
                action: (qty) => executeVoidProduct(i, qty)
            });
        } else {
            setConfirmConfig({
                isOpen: true, title: "Return Product?", message: "Restores stock & updates refund.", confirmText: "Return", confirmColor: "bg-red-600",
                action: () => executeVoidProduct(i, 1)
            });
        }
    };

    const executeVoidProduct = async (i, returnQty) => {
        setConfirmConfig({...confirmConfig, isOpen: false});
        setPromptConfig({...promptConfig, isOpen: false});
        setIsUpdating(true);
        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "Orders", order.id);
                const data = (await t.get(ref)).data();
                const newItems = JSON.parse(JSON.stringify(data.items));
                const item = newItems[i];
                if(item.returned) throw "Already returned";
                if (item.productId) {
                    const invRef = doc(db, "Inventory", item.productId);
                    const invSnap = await t.get(invRef);
                    if(invSnap.exists()) t.update(invRef, { stock: (invSnap.data().stock || 0) + returnQty });
                }
                if (returnQty === item.qty) { newItems[i].returned = true; } 
                else { 
                    newItems[i].qty -= returnQty; 
                    newItems[i].total = newItems[i].price * newItems[i].qty; 
                    newItems.push({ ...item, qty: returnQty, total: item.price * returnQty, returned: true }); 
                }
                const deduction = item.price * returnQty;
                const currentDiscount = data.discount || 0;
                const newSubtotal = (data.subtotal || data.totalCost) - deduction;
                const newTotalCost = Math.max(0, newSubtotal - currentDiscount);
                let newAmountPaid = data.amountPaid || 0;
                let newRefundedAmount = data.refundedAmount || 0;
                if (newAmountPaid > newTotalCost) { newAmountPaid = newTotalCost; newRefundedAmount += (data.amountPaid - newTotalCost); }
                const newBalance = newTotalCost - newAmountPaid;
                t.update(ref, { items: newItems, subtotal: newSubtotal, totalCost: newTotalCost, amountPaid: newAmountPaid, refundedAmount: newRefundedAmount, balance: newBalance });
            });
            setToast({message: "Item Returned", type: 'success'});
        } catch(e) { setToast({message: "Failed", type: 'error'}); }
        setIsUpdating(false);
    };

    const handleVoidService = async (i, s) => {
        setConfirmConfig({
            isOpen: true, title: "Void Service?", message: "This removes the service cost from the ticket.", confirmText: "Void Service", confirmColor: "bg-red-600",
            action: async () => {
                setIsUpdating(true);
                try {
                    await runTransaction(db, async (t) => {
                        const ref = doc(db, "Orders", order.id);
                        const data = (await t.get(ref)).data();
                        const newItems = JSON.parse(JSON.stringify(data.items));
                        const svc = newItems[i].services[s];
                        if (svc.status === 'Void') throw "Already voided"; 
                        svc.status = 'Void'; svc.worker = 'Unassigned';
                        if (newItems[i].type === 'repair') {
                             newItems[i].total = newItems[i].services.reduce((acc, curr) => acc + (curr.status !== 'Void' ? Number(curr.cost || 0) : 0), 0);
                        }
                        const newSubtotal = newItems.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
                        const currentDiscount = data.discount || 0;
                        const newTotalCost = Math.max(0, newSubtotal - currentDiscount);
                        let newAmountPaid = data.amountPaid || 0;
                        let newRefundedAmount = data.refundedAmount || 0;
                        if (newAmountPaid > newTotalCost) { newAmountPaid = newTotalCost; newRefundedAmount += (data.amountPaid - newTotalCost); }
                        const newBalance = newTotalCost - newAmountPaid;
                        t.update(ref, { items: newItems, subtotal: newSubtotal, totalCost: newTotalCost, amountPaid: newAmountPaid, refundedAmount: newRefundedAmount, balance: newBalance });
                    });
                    setToast({message: "Service Voided", type: 'success'});
                } catch(e) { setToast({message: "Failed", type: 'error'}); }
                setIsUpdating(false);
                setConfirmConfig({...confirmConfig, isOpen: false});
            }
        });
    };

    const handleAddPayment = async () => {
        const amt = Number(paymentInput);
        if(!amt) return;
        setIsUpdating(true);
        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "Orders", order.id);
                const data = (await t.get(ref)).data();
                const newPaid = (data.amountPaid || 0) + amt;
                const newBal = data.totalCost - newPaid;
                t.update(ref, { amountPaid: newPaid, balance: newBal, paymentStatus: newBal <= 0 ? 'Paid' : 'Part Payment', paid: newBal <= 0 });
            });
            setToast({ message: "Payment Recorded", type: "success" }); 
        } catch(e) { setToast({ message: "Payment Failed", type: "error" }); }
        setIsUpdating(false);
        setShowPaymentModal(false); // ✅ Closes Payment Modal
    };

    const handleVoidOrder = async () => {
         setIsUpdating(true);
         try {
            await updateDoc(doc(db, "Orders", order.id), { status: 'Void', paymentStatus: 'Voided', balance: 0 });
            navigate('/admin/orders');
         } catch(e) { setToast({message: "Void Failed", type: 'error'}); }
         setIsUpdating(false);
         setConfirmConfig({...confirmConfig, isOpen: false}); // ✅ Ensures Modal Closes
    };

    const handleProcessRefund = async () => {
        setIsUpdating(true);
        await updateDoc(doc(db, "Orders", order.id), { amountPaid: 0, refundedAmount: order.amountPaid, paymentStatus: 'Refunded', balance: 0 });
        setToast({ message: "Refund Processed", type: "success" });
        setIsUpdating(false);
        setConfirmConfig({...confirmConfig, isOpen: false}); // ✅ Ensures Modal Closes
    };

    const handleResetPayment = async () => {
         setIsUpdating(true);
         await updateDoc(doc(db, "Orders", order.id), { amountPaid: 0, balance: order.totalCost, paymentStatus: 'Unpaid', paid: false });
         setToast({ message: "Payment Reset", type: "success" });
         setIsUpdating(false);
         setConfirmConfig({...confirmConfig, isOpen: false}); // ✅ Ensures Modal Closes
    };
    
    const handleStatusChange = async (e) => {
        const newStatus = e.target.value;
        if (newStatus === 'Void') {
            setConfirmConfig({ isOpen: true, title: "Void Order?", message: "This cancels everything and zeros the balance. Continue?", confirmText: "Void", confirmColor: "bg-red-600", action: handleVoidOrder });
            return;
        }
        setIsUpdating(true);
        await updateDoc(doc(db, "Orders", order.id), { status: newStatus });
        setToast({ message: "Status Updated", type: "success" });
        setIsUpdating(false);
    };

    const handleCollectionToggle = async () => {
        const next = order.status === 'Collected' ? 'Ready for Pickup' : 'Collected';
        setIsUpdating(true);
        await updateDoc(doc(db, "Orders", order.id), { status: next });
        setToast({ message: `Marked as ${next}`, type: "success" });
        setIsUpdating(false);
        setConfirmConfig({...confirmConfig, isOpen: false}); // ✅ Ensures Modal Closes
    };

    const handleRemovePart = (partItem) => {
        setConfirmConfig({
            isOpen: true, title: "Remove Part?", message: `Remove "${partItem.name}" and restore stock?`, confirmText: "Remove & Restore", confirmColor: "bg-red-600",
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
                } catch (e) { console.error(e); setToast({ message: "Failed to remove part", type: "error" }); } 
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
        } catch(e) { console.error(e); setToast({ message: "Update failed", type: "error" }); } 
        finally { setIsUpdating(false); }
    };

    const handleWarrantyReturn = async (item) => {
        setIsUpdating(true);
        const newId = `FTW-RMA-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
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

    // 🔥 HANDLE DELETE CLICK
    const handleDeleteClick = () => {
        if (!order) return;
        if (role === 'secretary') {
            setRequestModalOpen(true);
            return;
        }
        setConfirmConfig({
            isOpen: true,
            title: "Delete Order?",
            message: "This action is permanent. Are you sure?",
            confirmText: "Delete Forever",
            confirmColor: "bg-red-600",
            action: async () => {
                try {
                    await deleteDoc(doc(db, "Orders", order.id));
                    setToast({ message: "Order Deleted", type: "success" });
                    setTimeout(() => navigate('/admin/orders'), 1000);
                } catch (e) {
                    setToast({ message: "Delete failed", type: "error" });
                }
                setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    // 🔥 SUBMIT DELETION REQUEST
    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        if (!deleteReason.trim()) return setToast({ message: "Reason required", type: "error" });

        setIsSubmittingRequest(true);
        try {
            await addDoc(collection(db, "DeletionRequests"), {
                orderId: order.id,
                ticketId: order.ticketId,
                customer: order.customer?.name || "Unknown",
                reason: deleteReason,
                requestedBy: user?.name || user?.email || "Secretary",
                requestedAt: serverTimestamp(),
                status: 'pending'
            });
            setToast({ message: "Request sent to Admin", type: "success" });
            setRequestModalOpen(false);
            setDeleteReason('');
        } catch (error) {
            console.error(error);
            setToast({ message: "Failed to send request", type: "error" });
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    const formatCurrency = (amount) => {
        const num = Number(amount);
        return isNaN(num) ? '₦0.00' : `₦${num.toLocaleString()}`;
    };
    
    const formatDate = (date) => (!date ? '' : new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
    const isReturn = order?.orderType === 'return';
    const partsUsed = order?.items?.filter(i => i.type === 'part_usage') || [];

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-purple-900"></div></div>;
    if (!order) return <div className="p-10 text-center text-gray-500 font-bold">Order not found.</div>;

    const dateStr = order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleString() : 'N/A';

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
             <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />
             <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={() => confirmConfig.action && confirmConfig.action(true)} />
             <PromptModal isOpen={promptConfig.isOpen} title={promptConfig.title} message={promptConfig.message} max={promptConfig.max} onCancel={() => setPromptConfig({...promptConfig, isOpen: false})} onConfirm={promptConfig.action} />

            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-purple-700 transition bg-white px-4 py-2 rounded-lg shadow-sm border"><ArrowLeft size={20} className="mr-2"/> Back</button>
                <div className="flex flex-wrap gap-2 no-print">
                    
                    {/* 🔥 DELETE BUTTON */}
                    {(role === 'admin' || role === 'secretary') && (
                        <button onClick={handleDeleteClick} disabled={isUpdating} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition ${role === 'secretary' ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}>
                            {role === 'secretary' ? <AlertTriangle size={16}/> : <Trash2 size={16}/>}
                            {role === 'secretary' ? 'Request Delete' : 'Delete'}
                        </button>
                    )}
                    
                    {order.status !== 'Void' && <button onClick={() => setConfirmConfig({isOpen:true, title:"Void Order?", message:"This cancels everything.", confirmText:"Void", confirmColor:"bg-red-600", action: handleVoidOrder})} disabled={isUpdating} className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm font-bold"><Ban size={16}/> Void</button>}
                    <button onClick={() => setShowReceipt(true)} className="flex items-center gap-2 bg-purple-900 text-white px-4 py-2 rounded-lg hover:bg-purple-800 text-sm font-bold"><Printer size={16}/> Receipt</button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT COLUMN */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
                        {/* Status Bar */}
                        <div className="bg-slate-900 p-6 sm:p-8 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                            <div>
                                <h1 className="text-3xl font-mono font-black tracking-tight">{order.ticketId}</h1>
                                <p className="text-slate-400 text-sm mt-1 flex items-center gap-2"><Calendar size={14}/> {dateStr}</p>
                            </div>
                            <div className="bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                                <select value={order.status} onChange={handleStatusChange} disabled={isUpdating || order.status === 'Void'} className="bg-transparent text-white font-bold outline-none cursor-pointer disabled:opacity-80">
                                    <option className="text-black">Pending</option>
                                    <option className="text-black">In Progress</option>
                                    <option className="text-black">Ready for Pickup</option>
                                    <option className="text-black">Completed</option>
                                    <option className="text-black">Collected</option>
                                    <option className="text-black">Void</option>
                                </select>
                            </div>
                        </div>

                        {/* Order Items Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                    <tr><th className="px-6 py-3 text-left">Item / Service</th><th className="px-6 py-3 text-right">Cost</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {order.items.map((item, i) => {
                                        if (item.type === 'part_usage') return null;
                                        return (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <div className="font-bold text-gray-900 text-base flex items-center gap-2">
                                                            {item.name || item.deviceModel}
                                                            {item.returned && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded border border-red-200">Returned</span>}
                                                            {item.type === 'product' && !item.returned && !isReturn && order.status !== 'Void' && (
                                                                <button onClick={() => handleVoidProductTrigger(i)} disabled={isUpdating} className="text-red-500 hover:bg-red-50 p-1 rounded ml-auto" title="Return Product"><RotateCcw size={16}/></button>
                                                            )}
                                                            {item.type === 'repair' && !isReturn && !item.returned && (order.status === 'Completed' || order.status === 'Collected') && (
                                                                <button onClick={() => handleWarrantyReturn(item)} className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded ml-auto flex items-center gap-1"><RefreshCw size={12}/> Warranty</button>
                                                            )}
                                                        </div>

                                                        {item.type === 'repair' && (
                                                            <div className="flex flex-wrap gap-3 text-xs mt-1 text-gray-500 items-center">
                                                                {item.imei && <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded"><Smartphone size={10}/> IMEI: {item.imei}</span>}
                                                                {item.passcode && <span className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-100 font-bold"><Lock size={10}/> Pass: {item.passcode}</span>}
                                                                
                                                                {/* CONDITION DISPLAY & EDITING */}
                                                                <div className="flex items-center gap-2 group">
                                                                    {editingCondition.index === i ? (
                                                                        <div className="flex items-center gap-1 animate-in fade-in">
                                                                            <input 
                                                                                className="border border-purple-300 rounded px-2 py-0.5 text-xs focus:ring-1 focus:ring-purple-500 outline-none w-32"
                                                                                value={editingCondition.value}
                                                                                onChange={(e) => setEditingCondition({ ...editingCondition, value: e.target.value })}
                                                                                placeholder="Condition..."
                                                                                autoFocus
                                                                            />
                                                                            <button onClick={() => handleSaveCondition(i)} className="text-green-600 hover:bg-green-50 p-1 rounded"><CheckCircle size={14}/></button>
                                                                            <button onClick={() => setEditingCondition({ index: -1, value: '' })} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={14}/></button>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            {item.condition ? (
                                                                                <span className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100 font-medium">
                                                                                    <AlertTriangle size={10}/> Cond: {item.condition}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs text-gray-300 italic flex items-center gap-1"><AlertTriangle size={10}/> No condition notes</span>
                                                                            )}
                                                                            {!isReturn && order.status !== 'Void' && (
                                                                                <button 
                                                                                    onClick={() => setEditingCondition({ index: i, value: item.condition || '' })}
                                                                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-purple-600 transition p-1"
                                                                                    title="Edit Condition"
                                                                                >
                                                                                    <Edit2 size={12}/>
                                                                                </button>
                                                                            )}
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
                                                                    <Wrench size={16} className="text-gray-400"/>
                                                                    <span className="font-medium text-gray-700">{svc.service}</span>
                                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${svc.status === 'Completed' ? 'bg-green-100 text-green-700' : svc.status === 'In Progress' ? 'bg-purple-100 text-purple-700' : svc.status === 'Void' ? 'bg-red-100 text-red-700 line-through' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                        {svc.status}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {svc.status !== 'Void' && order.status !== 'Void' && <button onClick={() => handleVoidService(i, sIdx)} disabled={isUpdating} className="text-gray-400 hover:text-red-500"><Ban size={14}/></button>}
                                                                    <select className="bg-white border text-xs p-1.5 rounded font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500" value={svc.worker || "Unassigned"} onChange={(e) => handleServiceAssign(i, sIdx, e.target.value)} disabled={order.status === 'Void' || svc.status === 'Void'}>
                                                                        <option value="Unassigned">Unassigned</option>
                                                                        {workers.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-gray-800 align-top">
                                                    {formatCurrency(item.total ?? item.cost ?? 0)}
                                                </td>
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
                             <div className="bg-yellow-50 px-6 py-3 border-b border-yellow-100 flex items-center gap-2">
                                <Package size={18} className="text-yellow-700"/>
                                <h3 className="font-bold text-yellow-900 text-sm uppercase">Parts & Materials Used</h3>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {partsUsed.map((part, idx) => (
                                    <div key={idx} className="px-6 py-3 flex justify-between items-center hover:bg-gray-50">
                                        <div>
                                            <span className="text-sm font-bold text-slate-700">{part.name.replace('Used: ', '')}</span>
                                            <div className="text-xs text-slate-400">By {part.worker || 'Unknown'} • {part.usedAt ? new Date(part.usedAt).toLocaleString() : ''}</div>
                                        </div>
                                        <button onClick={() => handleRemovePart(part)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition" title="Remove Part & Restore Stock" disabled={isUpdating}>
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                    
                    {/* CUSTOMER CARD */}
                    <div className="bg-purple-50 p-6 rounded-2xl h-fit border border-purple-100">
                        <h3 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-4 flex items-center gap-2"><User size={16}/> Customer</h3>
                        <div className="space-y-4">
                            <div><p className="text-xs text-purple-400 font-bold uppercase">Name</p><p className="font-bold text-slate-800 text-lg">{order.customer?.name}</p></div>
                            <div><p className="text-xs text-purple-400 font-bold uppercase">Phone</p><p className="font-bold text-slate-800">{order.customer?.phone || 'N/A'}</p></div>
                            <div><p className="text-xs text-purple-400 font-bold uppercase">Email</p><p className="font-bold text-slate-800 text-sm">{order.customer?.email || 'N/A'}</p></div>
                        </div>
                    </div>

                    {/* PAYMENT SUMMARY */}
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm h-fit">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><DollarSign size={18}/> Payment Summary</h3>
                        <div className="space-y-3 text-sm mb-6">
                            
                            <div className="flex justify-between text-slate-500">
                                <span>Subtotal</span>
                                <span>{formatCurrency(order.subtotal || (order.totalCost + (order.discount || 0)))}</span>
                            </div>
                            
                            <div className="flex justify-between items-center text-red-500 my-1">
                                <div className="flex items-center gap-2">
                                    <span>Discount</span>
                                    {order.status !== 'Void' && (
                                        <button 
                                            onClick={() => { setDiscountInput(order.discount || ''); setShowDiscountModal(true); }}
                                            className="bg-red-50 text-red-600 p-1 rounded hover:bg-red-100 transition"
                                            title="Edit Discount"
                                        >
                                            <Edit2 size={12}/>
                                        </button>
                                    )}
                                </div>
                                <span>-{formatCurrency(order.discount || 0)}</span>
                            </div>

                            <div className="flex justify-between border-t border-dashed border-gray-200 pt-2">
                                <span>Total Cost</span>
                                <span className="font-bold">{formatCurrency(order.totalCost)}</span>
                            </div>
                            <div className="flex justify-between text-green-600"><span>Amount Paid</span><span className="font-bold">-{formatCurrency(order.amountPaid || 0)}</span></div>
                            
                            {order.refundedAmount > 0 && (
                                <div className="flex justify-between text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                    <span>Refunded</span><span className="font-bold">+{formatCurrency(order.refundedAmount)}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex justify-between items-center border-t border-gray-200 pt-4 mb-6">
                            <span className="font-bold text-gray-600">Balance Due</span>
                            <span className={`text-2xl font-extrabold ${order.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(order.balance <= 0 ? 0 : order.balance)}</span>
                        </div>

                        <div className="space-y-3">
                            {(order.status === 'Void' || isReturn) && order.amountPaid > 0 && order.paymentStatus !== 'Refunded' && (
                                <button onClick={() => setConfirmConfig({isOpen:true, title:"Refund Payment?", message:"Mark as Refunded.", confirmText:"Refund", confirmColor:"bg-blue-600", action: handleProcessRefund})} disabled={isUpdating} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold shadow-sm hover:bg-red-700 transition">Process Refund</button>
                            )}
                            
                            {order.balance > 0 && order.status !== 'Void' && !isReturn && (
                                <button onClick={() => setShowPaymentModal(true)} className="w-full bg-black text-white py-3 rounded-lg font-bold shadow-lg hover:bg-gray-800 transition flex items-center justify-center gap-2"><PlusCircle size={18}/> Record Payment</button>
                            )}
                            
                            {order.amountPaid > 0 && order.status !== 'Void' && (
                                <button onClick={() => setConfirmConfig({isOpen:true, title:"Reset Payment?", message:"Clear payment history?", confirmText:"Reset", action: handleResetPayment})} className="w-full text-gray-400 text-xs hover:text-red-600 py-2">Undo Payment</button>
                            )}
                             
                             {!isReturn && (
                                 <button onClick={() => setConfirmConfig({isOpen:true, title:"Update Status", message:`Mark as ${order.status === 'Collected' ? 'Ready' : 'Collected'}?`, confirmText:"Yes", action: handleCollectionToggle})} className={`w-full py-3 rounded-lg font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition border ${order.status === 'Collected' ? 'bg-white text-green-700 border-green-300' : 'bg-blue-600 text-white border-transparent hover:bg-blue-700'}`}>
                                     {order.status === 'Collected' ? 'Undo Collection' : <>Mark COLLECTED <CheckCircle size={16}/></>}
                                 </button>
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
                        <input type="number" autoFocus className="w-full p-4 border-2 border-gray-200 rounded-xl font-bold text-2xl mb-6 focus:border-purple-600 outline-none text-center" value={paymentInput} onChange={e => setPaymentInput(e.target.value)} placeholder="0.00" />
                        <button onClick={handleAddPayment} disabled={isUpdating} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg mb-3">Confirm Payment</button>
                        <button onClick={() => setShowPaymentModal(false)} className="w-full text-gray-500 font-bold hover:bg-gray-100 py-3 rounded-lg">Cancel</button>
                    </div>
                </div>
            )}

            {/* Discount Modal */}
            {showDiscountModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
                        <h3 className="font-bold text-xl mb-4 text-gray-900">Manage Discount</h3>
                        <p className="text-xs text-gray-500 mb-4">Enter amount to deduct from subtotal.</p>
                        <div className="relative mb-6">
                            <span className="absolute left-4 top-3.5 text-gray-400 font-bold">₦</span>
                            <input 
                                type="number" 
                                autoFocus 
                                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl font-bold text-lg focus:border-purple-600 outline-none" 
                                value={discountInput} 
                                onChange={e => setDiscountInput(e.target.value)} 
                                placeholder="0.00" 
                            />
                        </div>
                        <button onClick={handleUpdateDiscount} disabled={isUpdating} className="w-full bg-purple-900 text-white py-3 rounded-lg font-bold hover:bg-purple-800 transition shadow-lg mb-3">Apply Discount</button>
                        <button onClick={() => setShowDiscountModal(false)} className="w-full text-gray-500 font-bold hover:bg-gray-100 py-3 rounded-lg">Cancel</button>
                    </div>
                </div>
            )}

            {/* 🔥 SECRETARY REQUEST MODAL */}
            {requestModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="text-orange-500"/> Request Deletion</h3>
                            <button onClick={() => setRequestModalOpen(false)}><X size={20} className="text-slate-400"/></button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">State reason for deleting ticket <b>{order.ticketId}</b>:</p>
                        <form onSubmit={handleSubmitRequest}>
                            <textarea className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm mb-4" rows="3" placeholder="Reason..." value={deleteReason} onChange={e => setDeleteReason(e.target.value)} required autoFocus />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setRequestModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold bg-gray-100 rounded-xl">Cancel</button>
                                <button type="submit" disabled={isSubmittingRequest} className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl flex items-center justify-center gap-2">
                                    {isSubmittingRequest ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>} Send
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 🔥 FIXED & SCROLLABLE RECEIPT MODAL */}
            {showReceipt && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md p-8 rounded shadow-2xl relative printable-receipt max-h-[90vh] overflow-y-auto">
                        <button onClick={() => setShowReceipt(false)} className="absolute top-2 right-2 text-gray-400 print:hidden hover:text-gray-600"><X/></button>
                        
                        <div className="text-center border-b-2 border-black pb-4 mb-4">
                            <h2 className="text-2xl font-extrabold uppercase tracking-tight">Farouk Techworld</h2>
                            <p className="text-xs font-mono">Mokola Rd, Ibadan</p>
                            <div className="mt-4 border-2 border-black inline-block px-4 py-1 font-bold text-sm">TICKET: {order.ticketId}</div>
                        </div>
                        
                        <div className="flex justify-between text-xs mb-4 font-mono border-b border-dashed border-gray-300 pb-2">
                            <span>{formatDate(new Date())}</span>
                            <span>{new Date().toLocaleTimeString()}</span>
                        </div>
                        
                        <div className="mb-6 text-sm font-bold uppercase border-b border-black pb-2">Customer: {order.customer.name}</div>
                        
                        <table className="w-full text-xs mb-6 font-mono">
                            <tbody>
                                {order.items.map((item, i) => { 
                                    if(item.type==='part_usage') return null; 
                                    return (
                                        <tr key={i}>
                                            <td className="py-1 pr-2 align-top"><div className="font-bold">{item.name || item.deviceModel}</div></td>
                                            <td className="text-right align-top whitespace-nowrap">{formatCurrency(item.total ?? item.cost ?? 0)}</td>
                                        </tr>
                                    ) 
                                })}
                            </tbody>
                        </table>
                        
                        <div className="flex justify-between text-lg font-bold border-t-2 border-black pt-2 mb-1">
                            <span>SUBTOTAL:</span>
                            <span>{formatCurrency(order.subtotal || (order.totalCost + (order.discount || 0)))}</span>
                        </div>
                        {order.discount > 0 && (
                            <div className="flex justify-between text-sm font-medium mb-1">
                                <span>DISCOUNT:</span>
                                <span>-{formatCurrency(order.discount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-lg font-bold border-t-2 border-black pt-2 mb-1">
                            <span>TOTAL:</span>
                            <span>{formatCurrency(order.totalCost)}</span>
                        </div>

                        <div className="space-y-1 text-sm font-mono mb-6 border-b border-black pb-4">
                            <div className="flex justify-between"><span>Paid:</span><span>{formatCurrency(order.amountPaid || 0)}</span></div>
                            <div className="flex justify-between font-bold"><span>Balance:</span><span>{formatCurrency(order.balance)}</span></div>
                        </div>
                        
                        <div className="text-center font-bold border-2 border-black p-2 mb-6 text-sm uppercase">{order.paymentStatus === 'Paid' ? 'PAYMENT COMPLETE' : 'PAYMENT PENDING'}</div>
                        
                        <div className="text-center text-[10px] font-mono uppercase">
                            <p>No Refund after payment</p>
                            <p>Warranty covers repair only</p>
                            <p className="mt-2 font-bold">Thank you for your patronage!</p>
                        </div>
                        
                        <button onClick={() => window.print()} className="w-full mt-6 bg-black text-white py-3 font-bold uppercase rounded hover:bg-gray-800 print:hidden flex items-center justify-center gap-2"><Printer size={18}/> Print Now</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderDetails;