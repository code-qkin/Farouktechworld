import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Printer, User, Calendar, DollarSign, AlertTriangle, 
    CheckCircle, ShoppingBag, Wrench, Trash2, LogOut, PlusCircle, 
    X, RotateCcw, Ban, Clock, CheckSquare, RefreshCw, ArrowRight
} from 'lucide-react';
import { 
    collection, query, where, getDocs, doc, getDoc, 
    updateDoc, deleteDoc, runTransaction, addDoc, serverTimestamp, Timestamp
} from 'firebase/firestore'; 
import { db } from '../../firebaseConfig.js';
import { useAuth } from '../AdminContext';
import { Toast, ConfirmModal, PromptModal } from '../Components/Feedback.jsx';

const OrderDetails = () => {
    const { orderId } = useParams(); 
    const id = orderId;
    const navigate = useNavigate();
    const { role } = useAuth();
    
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [workers, setWorkers] = useState([]);
    const [isUpdating, setIsUpdating] = useState(false);
    
    // UI
    const [showReceipt, setShowReceipt] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentInput, setPaymentInput] = useState('');
    
    // Feedback
    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });
    const [promptConfig, setPromptConfig] = useState({ isOpen: false, title: '', message: '', max: 1, action: null });

    useEffect(() => {
        const fetchData = async () => {
            try {
                let foundOrder = null;
                const q = query(collection(db, "Orders"), where("ticketId", "==", id));
                const snap = await getDocs(q);
                if (!snap.empty) foundOrder = { id: snap.docs[0].id, ...snap.docs[0].data() };
                else {
                    try {
                        const docSnap = await getDoc(doc(db, "Orders", id));
                        if (docSnap.exists()) foundOrder = { id: docSnap.id, ...docSnap.data() };
                    } catch(e) {}
                }
                if (foundOrder) setOrder(foundOrder);
                else { navigate('/admin/orders'); return; }

                const wQ = query(collection(db, "Users"), where("role", "==", "worker"));
                const wSnap = await getDocs(wQ);
                setWorkers(wSnap.docs.map(doc => doc.data().name).filter(Boolean));
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchData();
    }, [id, navigate]);

    // --- HANDLERS (Smart Void, Assign, Payments) ---
    const handleVoidProductTrigger = (i) => {
        const item = order.items[i];
        if (item.returned) return;

        if (item.qty > 1) {
            setPromptConfig({
                isOpen: true, title: "Partial Return", message: `How many items to return? (Max: ${item.qty})`, max: item.qty,
                action: (qty) => executeVoidProduct(i, qty)
            });
        } else {
            setConfirmConfig({
                isOpen: true, title: "Return Product?", message: "Restores stock & updates bill.", confirmText: "Return", confirmColor: "bg-red-600",
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
                
                const invRef = doc(db, "Inventory", item.productId);
                const invSnap = await t.get(invRef);
                if(invSnap.exists()) t.update(invRef, { stock: (invSnap.data().stock || 0) + returnQty });

                if (returnQty === item.qty) {
                    newItems[i].returned = true;
                } else {
                    newItems[i].qty -= returnQty;
                    newItems[i].total = newItems[i].price * newItems[i].qty;
                    newItems.push({ ...item, qty: returnQty, total: item.price * returnQty, returned: true });
                }

                const deduction = item.price * returnQty;
                const newTotalCost = (data.totalCost || 0) - deduction;
                let newAmountPaid = data.amountPaid || 0;
                let newRefundedAmount = data.refundedAmount || 0;
                
                if (newAmountPaid > newTotalCost) {
                    const refundDue = newAmountPaid - newTotalCost;
                    newAmountPaid = newTotalCost;
                    newRefundedAmount += refundDue;
                }
                const newBalance = newTotalCost - newAmountPaid;

                t.update(ref, { items: newItems, totalCost: newTotalCost, amountPaid: newAmountPaid, refundedAmount: newRefundedAmount, balance: newBalance });
                setOrder(prev => ({ ...prev, items: newItems, totalCost: newTotalCost, amountPaid: newAmountPaid, refundedAmount: newRefundedAmount, balance: newBalance }));
            });
            setToast({message: "Item Returned", type: 'success'});
        } catch(e) { setToast({message: "Failed", type: 'error'}); }
        setIsUpdating(false);
    };

    const handleVoidService = async (i, s) => {
        setConfirmConfig({
            isOpen: true, title: "Void Service?", message: "Removes cost from bill.", confirmText: "Void", confirmColor: "bg-red-600",
            action: async () => {
                setIsUpdating(true);
                try {
                    await runTransaction(db, async (t) => {
                        const ref = doc(db, "Orders", order.id);
                        const data = (await t.get(ref)).data();
                        const newItems = JSON.parse(JSON.stringify(data.items));
                        const svc = newItems[i].services[s];
                        svc.status = 'Void'; svc.worker = 'Unassigned';
                        
                        const deduction = Number(svc.cost || 0);
                        const newTotalCost = (data.totalCost || 0) - deduction;
                        
                        let newAmountPaid = data.amountPaid || 0;
                        let newRefundedAmount = data.refundedAmount || 0;
                        if (newAmountPaid > newTotalCost) {
                            const refundDue = newAmountPaid - newTotalCost;
                            newAmountPaid = newTotalCost;
                            newRefundedAmount += refundDue;
                        }
                        const newBalance = newTotalCost - newAmountPaid;
                        
                        t.update(ref, { items: newItems, totalCost: newTotalCost, amountPaid: newAmountPaid, refundedAmount: newRefundedAmount, balance: newBalance });
                        setOrder(prev => ({ ...prev, items: newItems, totalCost: newTotalCost, amountPaid: newAmountPaid, refundedAmount: newRefundedAmount, balance: newBalance }));
                    });
                    setToast({message: "Service Voided", type: 'success'});
                } catch(e) { setToast({message: "Failed", type: 'error'}); }
                setIsUpdating(false);
                setConfirmConfig({...confirmConfig, isOpen: false});
            }
        });
    };

    const handleServiceAssign = async (i, s, newWorker) => {
        setIsUpdating(true);
        try {
            const newItems = JSON.parse(JSON.stringify(order.items));
            newItems[i].services[s].worker = newWorker;
            newItems[i].services[s].status = newWorker === 'Unassigned' ? 'Pending' : 'In Progress';
            await updateDoc(doc(db, "Orders", order.id), { items: newItems });
            setOrder(prev => ({ ...prev, items: newItems }));
            setToast({message: "Assigned", type: 'success'});
        } catch(e) {}
        setIsUpdating(false);
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

    const handleVoidOrder = async () => {
         setIsUpdating(true);
         try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "Orders", order.id);
                const data = (await t.get(ref)).data();
                const updates = [];
                data.items?.forEach(item => {
                    if(item.type==='product' && !item.returned) updates.push({ref: doc(db,"Inventory",item.productId), qty:item.qty});
                    if(item.type==='part_usage') updates.push({ref: doc(db,"Inventory",item.partId), qty:1});
                });
                const snaps = await Promise.all(updates.map(u => t.get(u.ref)));
                snaps.forEach((snap, idx) => { if(snap.exists()) t.update(updates[idx].ref, { stock: (snap.data().stock || 0) + updates[idx].qty }); });
                t.update(ref, { status: 'Void', balance: 0, paymentStatus: 'Voided' });
            });
            navigate('/admin/orders');
         } catch(e) { setToast({message: "Void Failed", type: 'error'}); }
         setIsUpdating(false);
    };

    const handleAddPayment = async () => {
        const amt = Number(paymentInput);
        if(!amt) return;
        setIsUpdating(true);
        await runTransaction(db, async (t) => {
            const ref = doc(db, "Orders", order.id);
            const data = (await t.get(ref)).data();
            const newPaid = (data.amountPaid || 0) + amt;
            const newBal = data.totalCost - newPaid;
            t.update(ref, { amountPaid: newPaid, balance: newBal, paymentStatus: newBal <= 0 ? 'Paid' : 'Part Payment', paid: newBal <= 0 });
            setOrder(prev => ({ ...prev, amountPaid: newPaid, balance: newBal, paymentStatus: newBal <= 0 ? 'Paid' : 'Part Payment', paid: newBal <= 0 }));
        });
        setIsUpdating(false);
        setShowPaymentModal(false);
    };
    
    const handleProcessRefund = async () => {
        setIsUpdating(true);
        await updateDoc(doc(db, "Orders", order.id), { amountPaid: 0, refundedAmount: order.amountPaid, paymentStatus: 'Refunded', balance: 0 });
        setOrder(prev => ({ ...prev, amountPaid: 0, paymentStatus: 'Refunded', balance: 0 }));
        setIsUpdating(false);
    };

    const handleResetPayment = async () => {
         setIsUpdating(true);
         await updateDoc(doc(db, "Orders", order.id), { amountPaid: 0, balance: order.totalCost, paymentStatus: 'Unpaid', paid: false });
         setOrder(prev => ({ ...prev, amountPaid: 0, balance: prev.totalCost, paymentStatus: 'Unpaid', paid: false }));
         setIsUpdating(false);
    };
    
    const handleStatusChange = async (e) => {
        const newStatus = e.target.value;
        setIsUpdating(true);
        await updateDoc(doc(db, "Orders", order.id), { status: newStatus });
        setOrder(prev => ({ ...prev, status: newStatus }));
        setIsUpdating(false);
    };

    const handleCollectionToggle = async () => {
        const next = order.status === 'Collected' ? 'Ready for Pickup' : 'Collected';
        setIsUpdating(true);
        await updateDoc(doc(db, "Orders", order.id), { status: next });
        setOrder(prev => ({ ...prev, status: next }));
        setIsUpdating(false);
    };

    const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;
    
    // Helper to categorize Order
    const isReturn = order?.orderType === 'return';
    const isWarranty = order?.orderType === 'warranty';
    const isSale = order?.orderType === 'store_sale';

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-purple-50">
            <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-700 mb-4"></div>
                <p className="text-purple-800 font-semibold animate-pulse">Loading...</p>
            </div>
        </div>
    );
    
    if (!order) return null;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
             <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />
             <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={() => confirmConfig.action && confirmConfig.action(true)} />
             <PromptModal isOpen={promptConfig.isOpen} title={promptConfig.title} message={promptConfig.message} max={promptConfig.max} onCancel={() => setPromptConfig({...promptConfig, isOpen: false})} onConfirm={promptConfig.action} />

            {/* Header */}
            <div className="max-w-6xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-purple-700 transition bg-white px-4 py-2 rounded-lg shadow-sm border"><ArrowLeft size={20} className="mr-2"/> Back</button>
                <div className="flex flex-wrap gap-2 no-print">
                    {order.status !== 'Void' && <button onClick={() => setConfirmConfig({isOpen:true, title:"Void Order?", message:"This cancels everything.", confirmText:"Void", confirmColor:"bg-red-600", action: handleVoidOrder})} disabled={isUpdating} className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm font-bold"><Ban size={16}/> Void</button>}
                    <button onClick={() => setShowReceipt(true)} className="flex items-center gap-2 bg-purple-900 text-white px-4 py-2 rounded-lg hover:bg-purple-800 text-sm font-bold"><Printer size={16}/> Receipt</button>
                </div>
            </div>

            {/* Status Banner */}
            <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 mb-8">
                <div className={`${isReturn ? 'bg-blue-700' : isWarranty ? 'bg-orange-600' : isSale ? 'bg-green-700' : 'bg-purple-900'} text-white p-6`}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                         <div>
                            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 flex-wrap">
                                {isReturn ? 'PRODUCT RETURN' : isWarranty ? 'WARRANTY CLAIM' : isSale ? 'STORE SALE' : 'REPAIR JOB'} 
                                <span className="opacity-80 text-lg">#{order.ticketId}</span>
                            </h1>
                         </div>
                         <div className="bg-white/20 px-3 py-1 rounded-lg border border-white/30 backdrop-blur-sm">
                             <select value={order.status} onChange={handleStatusChange} disabled={isUpdating} className="bg-transparent text-white font-bold outline-none cursor-pointer text-sm sm:text-base">
                                 <option className="text-black">Pending</option>
                                 <option className="text-black">In Progress</option>
                                 <option className="text-black">Ready for Pickup</option>
                                 <option className="text-black">Completed</option>
                                 <option className="text-black">Collected</option>
                             </select>
                         </div>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Items Table */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                            <table className="w-full text-sm min-w-[600px] sm:min-w-full">
                                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Item / Service</th>
                                        <th className="px-4 py-3 text-right">Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.items.map((item, i) => {
                                        if (item.type === 'part_usage') return null;
                                        return (
                                            <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-gray-900 text-base mb-1 flex items-center gap-2 flex-wrap">
                                                        {item.name || item.deviceModel} 
                                                        {item.returned && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded border border-red-200">Returned</span>}
                                                        
                                                        {/* Action Buttons */}
                                                        {item.type === 'product' && !item.returned && !isReturn && order.status !== 'Void' && (
                                                            <button onClick={() => handleVoidProductTrigger(i)} disabled={isUpdating} className="text-red-500 hover:bg-red-50 p-1 rounded ml-auto" title="Return Product"><RotateCcw size={16}/></button>
                                                        )}
                                                        {item.type === 'repair' && !isReturn && !isWarranty && !item.returned && (order.status === 'Completed' || order.status === 'Collected') && (
                                                            <button onClick={() => handleWarrantyReturn(item)} className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded ml-auto flex items-center gap-1"><RefreshCw size={12}/> Warranty</button>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Repair Services */}
                                                    {item.type === 'repair' && <div className="mt-2 space-y-2">
                                                        {item.services?.map((svc, sIdx) => (
                                                            <div key={sIdx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-2 rounded border gap-2">
                                                                <span className="font-medium text-gray-700">{svc.service}</span>
                                                                <div className="flex items-center gap-2 w-full sm:w-auto justify-between">
                                                                    {svc.status !== 'Void' && order.status !== 'Void' && <button onClick={() => handleVoidService(i, sIdx)} disabled={isUpdating} className="text-gray-400 hover:text-red-500"><Ban size={14}/></button>}
                                                                    <div className={`flex items-center gap-2 bg-white px-2 py-1 rounded border border-gray-200 ${svc.status === 'Completed' || svc.status === 'Void' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                                        <User size={12} className="text-gray-400"/>
                                                                        <select className="bg-transparent text-xs font-bold text-blue-600 outline-none cursor-pointer w-full" value={svc.worker || "Unassigned"} onChange={(e) => handleServiceAssign(i, sIdx, e.target.value)} disabled={order.status === 'Void' || svc.status === 'Completed' || svc.status === 'Void'}>
                                                                            <option value="Unassigned">Unassigned</option>
                                                                            {workers.map(w => <option key={w} value={w}>{w}</option>)}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold align-top text-gray-800">
                                                    {item.services?.some(s => s.status === 'Void') || item.returned 
                                                        ? <span className="text-red-500 line-through">{formatCurrency(item.total)}</span> 
                                                        : formatCurrency(item.total)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Billing Card */}
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><DollarSign size={18}/> Payment Details</h3>
                        <div className="space-y-3 text-sm mb-6">
                            <div className="flex justify-between"><span>Total Cost</span><span className="font-bold text-gray-900">{formatCurrency(order.totalCost)}</span></div>
                            <div className="flex justify-between text-green-600"><span>Amount Paid</span><span className="font-bold">-{formatCurrency(order.amountPaid || 0)}</span></div>
                            {order.refundedAmount > 0 && <div className="flex justify-between text-red-600"><span>Refunded</span><span className="font-bold">+{formatCurrency(order.refundedAmount)}</span></div>}
                        </div>
                        
                        <div className="flex justify-between items-center border-t border-gray-200 pt-4 mb-6">
                            <span className="font-bold text-gray-600">Balance Due</span>
                            <span className={`text-2xl font-extrabold ${order.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(order.balance <= 0 ? 0 : order.balance)}</span>
                        </div>

                        {/* Action Buttons */}
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

            {/* Receipt Modal */}
            {showReceipt && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md p-8 rounded shadow-2xl relative printable-receipt">
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
                                            <td className="text-right align-top whitespace-nowrap">{formatCurrency(item.total || item.cost)}</td>
                                        </tr>
                                    ) 
                                })}
                            </tbody>
                        </table>
                        
                        <div className="flex justify-between text-lg font-bold border-t-2 border-black pt-2 mb-1"><span>TOTAL:</span><span>{formatCurrency(order.totalCost)}</span></div>
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