import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, runTransaction } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { ClipboardCheck, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { Toast, ConfirmModal } from '../Components/Feedback';

const PendingApprovals = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });
    const [activeTab, setActiveTab] = useState('pending');

    useEffect(() => {
        const q = query(
            collection(db, 'ApprovalRequests'),
            orderBy('requestedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRequests(reqs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching requests:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleApprove = async (request) => {
        setIsProcessing(true);
        try {
            if (request.type === 'edit_order') {
                await updateDoc(doc(db, 'Orders', request.orderId), {
                    editUnlocked: true
                });
                await updateDoc(doc(db, 'ApprovalRequests', request.id), { status: 'approved' });
                setToast({ message: "Edit unlocked successfully", type: "success" });
            } else if (request.type === 'reset_payment') {
                await runTransaction(db, async (t) => {
                    const orderRef = doc(db, 'Orders', request.orderId);
                    const orderSnap = await t.get(orderRef);
                    if (!orderSnap.exists()) throw "Order not found";
                    
                    const orderData = orderSnap.data();
                    t.update(orderRef, {
                        amountPaid: 0,
                        balance: orderData.totalCost,
                        paymentStatus: 'Unpaid',
                        paid: false,
                        paymentHistory: []
                    });
                    t.update(doc(db, 'ApprovalRequests', request.id), { status: 'approved' });
                });
                setToast({ message: "Payments reset successfully", type: "success" });
            } else if (request.type === 'no_part_needed') {
                const usageEntry = {
                    type: 'part_usage',
                    name: `Log: No Part Needed (${request.deviceName})`,
                    worker: request.requestedBy,
                    cost: 0,
                    partId: 'no-part-log',
                    usedAt: new Date().toISOString()
                };
                await updateDoc(doc(db, 'Orders', request.orderId), {
                    items: arrayUnion(usageEntry)
                });
                await updateDoc(doc(db, 'ApprovalRequests', request.id), { status: 'approved' });
                setToast({ message: "No Part log added to order", type: "success" });
            }
        } catch (error) {
            console.error("Approval error:", error);
            setToast({ message: "Failed to approve request", type: "error" });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (requestId) => {
        setIsProcessing(true);
        try {
            await updateDoc(doc(db, 'ApprovalRequests', requestId), { status: 'rejected' });
            setToast({ message: "Request rejected", type: "success" });
        } catch (error) {
            console.error("Rejection error:", error);
            setToast({ message: "Failed to reject request", type: "error" });
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmApprove = (req) => {
        setConfirmConfig({
            isOpen: true,
            title: "Approve Request?",
            message: `Are you sure you want to approve this ${req.type.replace('_', ' ')} request?`,
            confirmText: "Approve",
            action: () => handleApprove(req)
        });
    };

    const confirmReject = (reqId) => {
        setConfirmConfig({
            isOpen: true,
            title: "Reject Request?",
            message: "Are you sure you want to reject this request?",
            confirmText: "Reject",
            confirmColor: "bg-red-600 hover:bg-red-700",
            action: () => handleReject(reqId)
        });
    };

    const getBadgeStyle = (type) => {
        switch (type) {
            case 'edit_order': return 'bg-purple-100 text-purple-700';
            case 'reset_payment': return 'bg-red-100 text-red-700';
            case 'no_part_needed': return 'bg-orange-100 text-orange-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const formatType = (type) => {
        return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-purple-600" size={40} /></div>;
    }

    const pendingRequests = requests.filter(r => r.status === 'pending');
    const historyRequests = requests.filter(r => r.status !== 'pending');
    const displayRequests = activeTab === 'pending' ? pendingRequests : historyRequests;

    return (
        <div className="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans text-slate-800">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            <ConfirmModal 
                isOpen={confirmConfig.isOpen} 
                title={confirmConfig.title} 
                message={confirmConfig.message} 
                confirmText={confirmConfig.confirmText} 
                confirmColor={confirmConfig.confirmColor} 
                onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} 
                onConfirm={() => {
                    setConfirmConfig({ ...confirmConfig, isOpen: false });
                    if (confirmConfig.action) confirmConfig.action();
                }} 
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-600 text-white rounded-xl shadow-lg">
                        <ClipboardCheck size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Approvals</h1>
                        <p className="text-sm text-slate-500 font-medium">Review restricted actions requested by staff.</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                    <button 
                        onClick={() => setActiveTab('pending')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${activeTab === 'pending' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Pending <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-xs">{pendingRequests.length}</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${activeTab === 'history' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        History
                    </button>
                </div>
            </div>

            {displayRequests.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <Check className="text-gray-400" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">All caught up!</h3>
                    <p className="text-slate-500 text-sm mt-1">There are no {activeTab} requests to display.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayRequests.map((req) => (
                        <div key={req.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${getBadgeStyle(req.type)}`}>
                                        {formatType(req.type)}
                                    </span>
                                    {activeTab === 'history' && (
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {req.status}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                    {req.ticketId}
                                </span>
                            </div>
                            
                            <div className="flex-1 mb-6">
                                <p className="text-sm text-slate-500 mb-1">Requested by <b>{req.requestedBy}</b> ({req.role})</p>
                                {req.customer && <p className="text-xs text-slate-400 mb-4">Customer: {req.customer}</p>}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                                    <AlertCircle size={16} className="text-slate-400 absolute top-4 left-4" />
                                    <p className="text-sm text-slate-700 pl-6 font-medium italic">"{req.reason}"</p>
                                </div>
                                {req.editsMade && (
                                    <div className="mt-4 bg-purple-50 p-3 rounded-xl border border-purple-100">
                                        <p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider mb-1">Edits Logged:</p>
                                        <p className="text-sm text-purple-900 font-medium">{req.editsMade}</p>
                                    </div>
                                )}
                            </div>

                            {activeTab === 'pending' ? (
                                <div className="flex gap-3 mt-auto">
                                    <button 
                                        onClick={() => confirmReject(req.id)}
                                        disabled={isProcessing}
                                        className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition disabled:opacity-50"
                                    >
                                        <X size={16} /> Reject
                                    </button>
                                    <button 
                                        onClick={() => confirmApprove(req)}
                                        disabled={isProcessing}
                                        className="flex-1 py-2.5 bg-purple-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-purple-700 shadow-lg transition disabled:opacity-50"
                                    >
                                        <Check size={16} /> Approve
                                    </button>
                                </div>
                            ) : (
                                <div className="mt-auto pt-4 border-t border-slate-100">
                                    <p className="text-xs text-slate-400 font-bold text-center">
                                        Processed on {req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleDateString() : 'Unknown'}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PendingApprovals;
