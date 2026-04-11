import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    User, Phone, Mail, FileText, History, 
    ArrowLeft, DollarSign, Calendar, Clock, 
    CheckCircle, AlertCircle, Package, Wrench, ExternalLink,
    TrendingUp, ShoppingBag, Edit2, MessageSquare, ArrowRight
} from 'lucide-react';
import { 
    doc, getDoc, collection, query, where, orderBy, onSnapshot 
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../AdminContext';
import { motion } from 'framer-motion';

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

const CustomerProfile = () => {
    const { customerId } = useParams();
    const navigate = useNavigate();
    const { role } = useAuth();

    const [customer, setCustomer] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCustomerData = async () => {
            try {
                const docRef = doc(db, "Customers", customerId);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const customerData = docSnap.data();
                    setCustomer({ id: docSnap.id, ...customerData });

                    // Improved Query: Try ID first, then phone for fallback
                    const qId = query(
                        collection(db, "Orders"), 
                        where("customer.id", "==", customerId),
                        orderBy("createdAt", "desc")
                    );

                    const qPhone = query(
                        collection(db, "Orders"), 
                        where("customer.phone", "==", customerData.phone),
                        orderBy("createdAt", "desc")
                    );
                    
                    const handleSnaps = (snaps) => {
                        const allOrders = [];
                        const seenIds = new Set();
                        
                        snaps.forEach(snap => {
                            snap.docs.forEach(doc => {
                                if (!seenIds.has(doc.id)) {
                                    allOrders.push({ id: doc.id, ...doc.data() });
                                    seenIds.add(doc.id);
                                }
                            });
                        });
                        
                        // Sort by date descending
                        allOrders.sort((a, b) => {
                            const dateA = a.createdAt?.seconds || 0;
                            const dateB = b.createdAt?.seconds || 0;
                            return dateB - dateA;
                        });
                        
                        setOrders(allOrders);
                        setLoading(false);
                    };

                    const unsubId = onSnapshot(qId, (snapId) => {
                        const unsubPhone = onSnapshot(qPhone, (snapPhone) => {
                            handleSnaps([snapId, snapPhone]);
                        }, (err) => console.error("Phone query error:", err));
                        
                        return () => unsubPhone();
                    }, (err) => console.error("ID query error:", err));

                    return () => unsubId();
                } else {
                    navigate('/admin/customers');
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
                setLoading(false);
            }
        };

        fetchCustomerData();
    }, [customerId, navigate]);

    const stats = useMemo(() => {
        // 🔥 EXCLUDE VOID ORDERS FROM STATS
        const validOrders = orders.filter(o => o.status !== 'Void');
        
        const total = validOrders.reduce((acc, o) => acc + (o.totalCost || 0), 0);
        const paid = validOrders.reduce((acc, o) => acc + (o.amountPaid || 0), 0);
        const balance = Math.max(0, total - paid);
        const activeRepairs = validOrders.filter(o => o.status === 'Pending' || o.status === 'In Progress').length;
        const unpaidOrders = validOrders.filter(o => (o.totalCost - (o.amountPaid || 0)) > 0);
        
        return { total, paid, balance, count: validOrders.length, activeRepairs, unpaidOrders };
    }, [orders]);

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-700"></div>
        </div>
    );

    if (!customer) return null;

    return (
        <div className="p-6 lg:p-10 bg-slate-50 min-h-screen font-sans">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-10">
                <button 
                    onClick={() => navigate('/admin/customers')} 
                    className="flex items-center gap-2 text-slate-500 hover:text-purple-700 font-bold transition mb-6 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 w-fit"
                >
                    <ArrowLeft size={18} /> Back to Customers
                </button>

                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-3xl bg-white border-4 border-purple-100 flex items-center justify-center text-purple-700 text-3xl font-black shadow-xl shadow-purple-900/5">
                            {customer.name?.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-4xl font-black text-slate-900">{customer.name}</h1>
                                {stats.balance > 0 && (
                                    <span className="flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border border-red-200 animate-pulse">
                                        <AlertCircle size={14}/> Debt: {formatCurrency(stats.balance)}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-4 mt-2">
                                <span className="flex items-center gap-1.5 text-slate-500 font-bold text-sm hover:text-purple-600 cursor-pointer transition"><Phone size={14} className="text-purple-500"/> {customer.phone}</span>
                                {customer.email && <span className="flex items-center gap-1.5 text-slate-500 font-bold text-sm"><Mail size={14} className="text-purple-500"/> {customer.email}</span>}
                                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Client Since {new Date(customer.createdAt?.seconds * 1000).getFullYear() || '2026'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <a 
                            href={`https://wa.me/${customer.phone.replace(/\D/g,'')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="bg-green-50 text-green-700 border border-green-200 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-100 transition shadow-sm"
                        >
                            <MessageSquare size={18} /> WhatsApp
                        </a>
                        {(role === 'admin' || role === 'ceo') && (
                            <button className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-black transition shadow-lg shadow-slate-200">
                                <Edit2 size={18} /> Edit Profile
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left Sidebar: Stats & Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                        {stats.balance > 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -mr-16 -mt-16 pointer-events-none" />}
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 relative z-10">Financial Summary</h3>
                        <div className="space-y-6 relative z-10">
                            <div>
                                <p className="text-xs font-bold text-slate-500 mb-1">Lifetime Value</p>
                                <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.total)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 mb-1">Unpaid Debt</p>
                                <p className={`text-2xl font-black ${stats.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(stats.balance)}</p>
                                {stats.unpaidOrders.length > 0 && <p className="text-[10px] font-bold text-red-400 uppercase mt-1">Across {stats.unpaidOrders.length} Tickets</p>}
                            </div>
                            <div className="pt-6 border-t border-slate-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-500">Payment Health</span>
                                    <span className="text-sm font-black text-slate-900">
                                        {Math.round((stats.paid / stats.total) * 100) || 0}%
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div 
                                        className={`${stats.balance > 0 ? 'bg-red-500' : 'bg-green-500'} h-full transition-all duration-1000`} 
                                        style={{ width: `${(stats.paid / stats.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Internal Notes</h3>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed italic">
                            {customer.notes || "No custom notes recorded for this client yet."}
                        </p>
                    </div>
                </div>

                {/* Right Content: Timeline */}
                <div className="lg:col-span-3 space-y-8">
                    
                    {/* UNPAID SECTION (High Visibility) */}
                    {stats.unpaidOrders.length > 0 && (
                        <div className="animate-in slide-in-from-top-4">
                            <h2 className="text-sm font-black text-red-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <DollarSign size={18}/> Unpaid Invoices ({stats.unpaidOrders.length})
                            </h2>
                            <div className="grid gap-4">
                                {stats.unpaidOrders.map(order => (
                                    <div key={order.id} className="bg-red-50/50 border border-red-100 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 hover:border-red-200 transition-colors">
                                        <div className="flex items-center gap-4 w-full">
                                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                                                <History size={18}/>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black text-slate-900">{order.ticketId}</p>
                                                <p className="text-xs font-bold text-slate-500 truncate">{order.items?.map(i => i.name || i.deviceModel).join(', ')}</p>
                                            </div>
                                            <div className="text-right px-4 border-x border-red-100">
                                                <p className="text-[10px] font-black text-red-400 uppercase">Balance Due</p>
                                                <p className="text-base font-black text-red-600">{formatCurrency(order.totalCost - order.amountPaid)}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => navigate(`/admin/orders/${order.ticketId}`)}
                                            className="w-full md:w-auto bg-red-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-red-700 transition shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                                        >
                                            Record Payment <ArrowRight size={14}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <History className="text-purple-600" size={24}/> All Transactions
                            </h2>
                            <span className="text-xs font-bold text-slate-400">{orders.length} Records Found</span>
                        </div>

                        <div className="space-y-4">
                            {orders.map((order, idx) => (
                                <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    key={order.id} 
                                    onClick={() => navigate(`/admin/orders/${order.ticketId}`)}
                                    className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-purple-300 hover:shadow-md transition group cursor-pointer"
                                >
                                    <div className="flex flex-col md:flex-row justify-between gap-4">
                                        <div className="flex gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${order.orderType === 'repair' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                                {order.orderType === 'repair' ? <Wrench size={20}/> : <ShoppingBag size={20}/>}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono font-black text-slate-900 text-sm group-hover:text-purple-700 transition">{order.ticketId}</span>
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                        order.status === 'Completed' || order.status === 'Collected' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-600">
                                                    {order.items?.map(i => i.name || i.deviceModel).join(', ')}
                                                </p>
                                                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                    <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(order.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                                                    <span className="flex items-center gap-1"><DollarSign size={12}/> {formatCurrency(order.totalCost)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center md:items-end flex-col justify-center">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Payment</p>
                                                <p className={`text-sm font-black ${order.paid || order.paymentStatus === 'Paid' ? 'text-green-600' : 'text-red-500'}`}>
                                                    {order.paid || order.paymentStatus === 'Paid' ? 'Fully Paid' : `Owes ${formatCurrency(order.balance || (order.totalCost - order.amountPaid))}`}
                                                </p>
                                            </div>
                                            <ExternalLink size={14} className="text-slate-300 group-hover:text-purple-400 mt-2 transition"/>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {orders.length === 0 && (
                                <div className="bg-white p-20 rounded-3xl border border-slate-200 border-dashed text-center">
                                    <FileText size={48} className="mx-auto text-slate-200 mb-4"/>
                                    <p className="font-bold text-slate-400">No ticket history found for this customer.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerProfile;