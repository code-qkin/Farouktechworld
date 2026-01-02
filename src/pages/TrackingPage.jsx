import React, { useState } from 'react';
import { 
    Search, CheckCircle, Clock, Truck, Package, 
    Smartphone, CreditCard, User, Calendar, Wrench, ArrowRight, XCircle 
} from 'lucide-react';
import { db } from '../firebaseConfig'; 
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Toast } from '../Admin/Components/Feedback'; 

const STEPS = [
    { id: 1, label: 'Received', status: 'Pending', icon: Package },
    { id: 2, label: 'Repairing', status: 'In Progress', icon: Wrench },
    { id: 3, label: 'Ready', status: 'Ready for Pickup', icon: CheckCircle },
    { id: 4, label: 'Collected', status: 'Collected', icon: Truck },
];

const getStepIndex = (status) => {
    if (status === 'Void') return -1;
    switch (status) {
        case 'Pending': return 1;
        case 'In Progress': return 2;
        case 'Ready for Pickup': return 3;
        case 'Collected': return 4;
        case 'Completed': return 3;
        default: return 0;
    }
};

const TrackingPage = () => {
    const [ticketNumber, setTicketNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [order, setOrder] = useState(null);
    const [toast, setToast] = useState({ message: '', type: '' });

    const handleTrack = async (e) => {
        e.preventDefault();
        setOrder(null);
        setLoading(true);

        const normalizedTicket = ticketNumber.trim().toUpperCase();
        if (!normalizedTicket) { setToast({ message: "Enter Ticket ID", type: "error" }); setLoading(false); return; }

        try {
            const q = query(collection(db, "Orders"), where("ticketId", "==", normalizedTicket));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                setOrder({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });
                setToast({ message: "Order Found!", type: "success" });
            } else {
                setToast({ message: "Ticket not found.", type: "error" });
            }
        } catch (err) { setToast({ message: "System error.", type: "error" }); } finally { setLoading(false); }
    };

    const activeStep = order ? getStepIndex(order.status) : 0;
    const isVoid = order?.status === 'Void';

    // Helper to determine individual item status text/color
    const getItemStatus = (item) => {
        if (item.collected) return { label: 'Collected', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle };
        
        // If repair, check services status
        if (item.type === 'repair') {
            const services = item.services || [];
            if (services.some(s => s.status === 'In Progress')) return { label: 'In Progress', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Wrench };
            if (services.every(s => s.status === 'Completed')) return { label: 'Ready', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle };
            return { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock };
        }
        
        // If product (Store Sale)
        return { label: 'Ready', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle };
    };

    return (
        <section className="bg-slate-50 min-h-screen pt-28 pb-20 px-4">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />

            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-3xl md:text-5xl font-black text-slate-900 mb-4">Track Your Repair</h1>
                    <p className="text-slate-500 text-lg">Enter your Ticket ID below.</p>
                </div>

                <div className="bg-white p-2 rounded-2xl shadow-xl shadow-purple-900/5 max-w-2xl mx-auto mb-16 border border-slate-100">
                    <form onSubmit={handleTrack} className="relative flex items-center">
                        <Search className="absolute left-4 text-slate-400" size={24} />
                        <input className="w-full pl-14 pr-36 py-4 bg-transparent outline-none text-lg font-bold text-slate-700 uppercase font-mono" placeholder="FTW-2024..." value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} />
                        <button type="submit" disabled={loading} className="absolute right-2 bg-purple-900 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-purple-800 transition disabled:opacity-70 flex items-center gap-2">
                            {loading ? <span className="animate-pulse">Checking...</span> : <>Track <ArrowRight size={18}/></>}
                        </button>
                    </form>
                </div>

                {order && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                        {/* Status Card */}
                        <div className="bg-white rounded-t-3xl shadow-sm border border-slate-200 p-8 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500"></div>
                            {isVoid ? (
                                <div className="text-red-500 flex flex-col items-center"><XCircle size={48} className="mb-2"/><h2 className="text-2xl font-black uppercase">Cancelled</h2></div>
                            ) : (
                                <>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Overall Status</p>
                                    <h2 className="text-3xl md:text-4xl font-black text-purple-900 uppercase mb-8">{order.status}</h2>
                                    {/* Stepper */}
                                    <div className="relative flex justify-between items-center max-w-2xl mx-auto">
                                        <div className="absolute top-5 left-0 w-full h-1 bg-slate-100 -z-0 rounded-full"></div>
                                        <div className="absolute top-5 left-0 h-1 bg-purple-600 -z-0 transition-all duration-1000 rounded-full" style={{ width: `${((activeStep - 1) / (STEPS.length - 1)) * 100}%` }}></div>
                                        {STEPS.map((step) => (
                                            <div key={step.id} className="relative z-10 flex flex-col items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${activeStep >= step.id ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-200 text-slate-300'}`}>
                                                    {activeStep >= step.id ? <CheckCircle size={18} /> : <step.icon size={18} />}
                                                </div>
                                                <span className={`text-xs font-bold uppercase ${activeStep === step.id ? 'text-purple-700' : 'text-slate-300'}`}>{step.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Device Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 border-x border-b border-slate-200 rounded-b-3xl overflow-hidden">
                            
                            {/* Left: Device Info (With Smart Status) */}
                            <div className="bg-white p-8">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-6"><Smartphone className="text-purple-600" /> Device Details</h3>
                                <div className="space-y-4">
                                    {order.items?.filter(item => item.type !== 'part_usage').map((item, idx) => {
                                        const statusInfo = getItemStatus(item);
                                        const StatusIcon = statusInfo.icon;
                                        
                                        return (
                                            <div key={idx} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border gap-3 ${item.collected ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}`}>
                                                <div className="flex items-start gap-4">
                                                    <div className="bg-white p-2 rounded-lg shadow-sm"><Wrench size={20} className="text-slate-400"/></div>
                                                    <div>
                                                        <p className="font-bold text-slate-800">{item.name || item.deviceModel}</p>
                                                        {item.type === 'repair' && <span className="text-xs text-slate-500">{item.services?.map(s=>s.service).join(', ')}</span>}
                                                    </div>
                                                </div>
                                                
                                                {/* 🔥 SMART STATUS BADGE */}
                                                <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 self-start sm:self-auto border ${statusInfo.color}`}>
                                                    <StatusIcon size={12}/> {statusInfo.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right: Info & Payment */}
                            <div className="bg-white p-8 flex flex-col justify-between">
                                <div>
                                    <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-6"><User className="text-purple-600" /> Ownership</h3>
                                    <div className="space-y-4 text-sm text-slate-600">
                                        <div className="flex justify-between items-center border-b border-slate-50 pb-3"><span>Customer Name</span><span className="font-bold text-slate-900">{order.customer?.name ? `${order.customer.name.split(' ')[0]} ***` : 'Walk-In'}</span></div>
                                        <div className="flex justify-between items-center border-b border-slate-50 pb-3"><span>Date Dropped</span><span className="font-bold text-slate-900 flex items-center gap-1"><Calendar size={14}/>{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'N/A'}</span></div>
                                        <div className="flex justify-between items-center pt-2"><span>Ticket ID</span><span className="font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{order.ticketId}</span></div>
                                    </div>
                                </div>

                                <div className="mt-8 bg-purple-50 p-5 rounded-xl border border-purple-100">
                                    <h4 className="font-bold text-purple-900 flex items-center gap-2 mb-3"><CreditCard size={18}/> Payment Status</h4>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${order.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{order.paymentStatus || (order.paid ? 'Paid' : 'Unpaid')}</span>
                                        {order.balance > 0 && <span className="text-sm font-bold text-slate-600">Bal: ₦{order.balance.toLocaleString()}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Note */}
                        <div className="text-center mt-8 text-slate-400 text-sm">
                            <p>Issues with your status? Call us at <b className="text-slate-600">0809 511 5931</b></p>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default TrackingPage;