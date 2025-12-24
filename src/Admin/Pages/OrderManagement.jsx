import React, { useState, useEffect, useMemo } from 'react';
import { 
    ClipboardList, Search, PlusCircle, 
    Trash2, User, Phone, X, 
    ShoppingBag, MinusCircle, Download, 
    ArrowLeft, ShoppingCart, Menu, UserPlus,
    Filter, Calendar, ChevronDown, CheckCircle, AlertCircle, Wrench, ArrowRight,
    RotateCcw, ChevronLeft, ChevronRight, Plus, Minus
} from 'lucide-react';
import { useAuth } from '../AdminContext.jsx'; 
import { db } from '../../firebaseConfig.js';
import { useNavigate } from 'react-router-dom'; 
import { 
    collection, doc, onSnapshot, query, orderBy, where, getDocs, 
    serverTimestamp, runTransaction, Timestamp, addDoc, updateDoc, increment 
} from 'firebase/firestore';
import { repairPricing } from '../../Data/PriceData.js';
import * as XLSX from 'xlsx';
import { Toast, ConfirmModal } from '../Components/Feedback.jsx';

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

// --- Standardized Badges ---
const StatusBadge = ({ status }) => {
    const styles = {
        'In Progress': 'bg-purple-100 text-purple-700 border-purple-200',
        'Ready for Pickup': 'bg-indigo-100 text-indigo-700 border-indigo-200',
        'Completed': 'bg-green-100 text-green-700 border-green-200',
        'Pending': 'bg-yellow-100 text-yellow-700 border-yellow-200',
        'Issue Reported': 'bg-red-100 text-red-700 border-red-200',
        'Collected': 'bg-slate-800 text-white border-slate-700',
        'Void': 'bg-slate-100 text-slate-500 border-slate-200 line-through'
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
            {status}
        </span>
    );
};

const PaymentBadge = ({ status }) => {
    const styles = {
        'Paid': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Part Payment': 'bg-orange-50 text-orange-700 border-orange-200',
        'Unpaid': 'bg-red-50 text-red-700 border-red-200',
        'Refunded': 'bg-blue-50 text-blue-700 border-blue-200',
        'Voided': 'bg-gray-100 text-gray-500 border-gray-200'
    };
    return (
        <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold border ${styles[status] || 'bg-gray-50'}`}>
            {status === 'Paid' && <CheckCircle size={10} />}
            {status === 'Unpaid' && <AlertCircle size={10} />}
            {status}
        </span>
    );
};

const OrdersManagement = () => {
    const { role } = useAuth(); 
    const navigate = useNavigate();

    // Data State
    const [orders, setOrders] = useState([]);
    const [inventory, setInventory] = useState([]); 
    const [loading, setLoading] = useState(true);
    
    // Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterType, setFilterType] = useState('All');
    const [dateRange, setDateRange] = useState('30');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    // UI State
    const [showPOS, setShowPOS] = useState(false);
    const [activeTab, setActiveTab] = useState('repair'); 
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mobilePosTab, setMobilePosTab] = useState('input'); // 'input' or 'cart'

    // POS Data
    const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
    const [cart, setCart] = useState([]); 
    const [repairInput, setRepairInput] = useState({ deviceModel: '', imei: '', passcode: '', condition: '' });
    const [serviceInput, setServiceInput] = useState({ type: '', cost: '' });
    const [currentDeviceServices, setCurrentDeviceServices] = useState([]); 

    // Warranty/Return
    const [warrantyTicketSearch, setWarrantyTicketSearch] = useState('');
    const [returnOrder, setReturnOrder] = useState(null);
    const [selectedReturnItems, setSelectedReturnItems] = useState([]);

    // Feedback
    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

    // --- 1. DATA FETCHING ---
    useEffect(() => {
        let q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsubOrders = onSnapshot(q, (snap) => {
            setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        const unsubInventory = onSnapshot(query(collection(db, "Inventory"), orderBy("name")), (snap) => {
            setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => { unsubOrders(); unsubInventory(); };
    }, []);

    const getOrderType = (order) => {
        if (!order) return 'store_sale';
        if (order.orderType) return order.orderType.toLowerCase(); 
        if (order.items && order.items.some(i => i.type === 'repair')) return 'repair';
        return 'store_sale';
    };

    // --- 2. FILTERING LOGIC ---
    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            const term = searchTerm.toLowerCase();
            const matchSearch = (o.ticketId || '').toLowerCase().includes(term) || (o.customer?.name || '').toLowerCase().includes(term);
            const matchStatus = filterStatus === 'All' || o.status === filterStatus;
            
            let matchType = true;
            if (filterType !== 'All') {
                const type = getOrderType(o); 
                if (filterType === 'Repair') matchType = type === 'repair';
                if (filterType === 'Sale') matchType = type === 'store_sale';
                if (filterType === 'Warranty') matchType = type === 'warranty';
                if (filterType === 'Return') matchType = type === 'return';
            }
    
            let matchDate = true;
            if (dateRange !== 'All' && o.createdAt) {
                const date = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - parseInt(dateRange)); 
                matchDate = date >= cutoff;
            }
    
            return matchSearch && matchStatus && matchType && matchDate;
        });
    }, [orders, searchTerm, filterStatus, filterType, dateRange]);

    // --- PAGINATION LOGIC ---
    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, filterType, dateRange]);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

    // --- POS HANDLERS ---
    const uniqueServices = useMemo(() => [...new Set(repairPricing.map(p => p.service))].sort(), []);
    const uniqueModels = useMemo(() => {
        const dbModels = repairPricing.map(p => p.model).filter(Boolean);
        return [...new Set([...dbModels, "iPhone 11", "iPhone 12", "iPhone 13", "Samsung", "Android"])].sort();
    }, []);

    const handleServiceChange = (e) => {
        const service = e.target.value;
        const match = repairPricing.find(p => p.service === service && (p.model === repairInput.deviceModel || repairInput.deviceModel?.includes(p.model)));
        setServiceInput({ ...serviceInput, type: service, cost: match ? match.price : '' });
    };

    const handleTabSwitch = (tab) => { setActiveTab(tab); setReturnOrder(null); setWarrantyTicketSearch(''); setSelectedReturnItems([]); };
    const fillWalkIn = () => setCustomer({ name: 'Walk-in Guest', phone: '', email: '' });
    
    const addServiceToDevice = () => {
        if (!serviceInput.type || !serviceInput.cost) return setToast({message: "Select service and cost.", type: "error"});
        setCurrentDeviceServices([...currentDeviceServices, { id: Date.now(), service: serviceInput.type, cost: Number(serviceInput.cost), worker: 'Unassigned', status: 'Pending' }]);
        setServiceInput({ type: '', cost: '' });
    };
    
    const addDeviceToCart = () => {
        if (!repairInput.deviceModel) return setToast({message: "Select Device Model.", type: "error"});
        setCart([...cart, { type: 'repair', id: `rep-${Date.now()}`, deviceModel: repairInput.deviceModel, imei: repairInput.imei, passcode: repairInput.passcode, condition: repairInput.condition, services: currentDeviceServices, qty: 1, total: currentDeviceServices.reduce((sum, s) => sum + s.cost, 0) }]);
        setRepairInput({ deviceModel: '', imei: '', passcode: '', condition: '' });
        setCurrentDeviceServices([]);
        if (window.innerWidth < 1024) setMobilePosTab('cart');
        setToast({message: "Device added to order", type: "success"});
    };
    
    const handleGridAddToCart = (product) => {
        if (product.stock < 1) return setToast({message: "Out of Stock!", type: "error"});
        setCart([...cart, { type: 'product', id: `prod-${Date.now()}`, productId: product.id, name: product.name, price: product.price, qty: 1, total: product.price }]);
        setToast({message: "Added to cart", type: "success"});
    };
    
    const updateCartQty = (itemId, change) => {
        const item = cart.find(i => i.id === itemId);
        if (!item) return;
        if (item.type === 'product') {
            const product = inventory.find(p => p.id === item.productId);
            const newQty = item.qty + change;
            if (newQty < 1) { setCart(cart.filter(i => i.id !== itemId)); return; }
            if (product && newQty > product.stock) return setToast({message: "Stock limit reached!", type: "error"});
            setCart(cart.map(i => i.id === itemId ? { ...i, qty: newQty, total: newQty * item.price } : i));
        }
    };
    
    const removeFromCart = (id) => setCart(cart.filter(item => item.id !== id));
    
    const handleCheckout = async () => {
        if (isSubmitting) return;
        if (!customer.name || cart.length === 0) return setToast({message: "Fill details & add items!", type: "error"});
        setIsSubmitting(true);
        const ticketId = `FTW-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
        const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);
        const orderType = cart.some(i => i.type === 'repair') ? 'repair' : 'store_sale';
        const warrantyDate = new Date(); warrantyDate.setDate(warrantyDate.getDate() + 7);
        try {
            await runTransaction(db, async (t) => {
                const productUpdates = [];
                for (const item of cart) { if (item.type === 'product') { const ref = doc(db, "Inventory", item.productId); productUpdates.push({ ref, item }); } }
                const snaps = await Promise.all(productUpdates.map(p => t.get(p.ref)));
                snaps.forEach((snap, idx) => { if (!snap.exists() || snap.data().stock < productUpdates[idx].item.qty) throw `Stock Error: ${productUpdates[idx].item.name}`; });
                snaps.forEach((snap, idx) => t.update(productUpdates[idx].ref, { stock: snap.data().stock - productUpdates[idx].item.qty }));
                const newOrderRef = doc(collection(db, "Orders"));
                t.set(newOrderRef, { ticketId, customer, orderType, items: cart, totalCost: cartTotal, amountPaid: 0, balance: cartTotal, paymentStatus: 'Unpaid', paymentMethod: null, paid: false, status: orderType === 'repair' ? 'Pending' : 'Completed', createdAt: serverTimestamp(), warrantyExpiry: Timestamp.fromDate(warrantyDate) });
            });
            setShowPOS(false); setCart([]); setCustomer({ name: '', phone: '', email: '' }); setToast({message: `Order ${ticketId} Created!`, type: "success"});
        } catch (e) { setToast({message: `Error: ${e}`, type: "error"}); } finally { setIsSubmitting(false); }
    };

    // --- 4. WARRANTY / RETURN HANDLERS ---
    const handleSearchReturnTicket = async () => {
        if(!warrantyTicketSearch) return;
        setLoading(true);
        const q = query(collection(db, "Orders"), where("ticketId", "==", warrantyTicketSearch.trim()));
        try {
            const snap = await getDocs(q);
            if(!snap.empty) {
                const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
                setReturnOrder(data);
                setCustomer(data.customer);
                setToast({message: "Ticket Found", type: "success"});
            } else { setToast({message: "Ticket not found.", type: "error"}); setReturnOrder(null); }
        } catch (e) { setToast({message: "Search failed.", type: "error"}); }
        setLoading(false);
    };

    const toggleReturnItem = (itemIdx, serviceIdx = null) => {
        const key = serviceIdx !== null ? `${itemIdx}-${serviceIdx}` : `${itemIdx}-product`;
        if (selectedReturnItems.includes(key)) setSelectedReturnItems(selectedReturnItems.filter(k => k !== key));
        else setSelectedReturnItems([...selectedReturnItems, key]);
    };

    const handleSubmitReturn = async () => {
        if (selectedReturnItems.length === 0) return setToast({message: "Select items.", type: "error"});
        setIsSubmitting(true);
        try {
            const isRepairReturn = selectedReturnItems.some(k => !k.includes('product'));
            const typeLabel = isRepairReturn ? 'WAR' : 'RET';
            const newTicketId = `FTW-${typeLabel}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
            const returnItems = [];
            let refundValue = 0;
            const inventoryUpdates = [];
            
            returnOrder.items.forEach((item, iIdx) => {
                if (item.type === 'repair') {
                    const selectedServices = item.services.filter((svc, sIdx) => selectedReturnItems.includes(`${iIdx}-${sIdx}`));
                    if (selectedServices.length > 0) {
                        returnItems.push({
                            ...item,
                            services: selectedServices.map(s => ({ ...s, status: 'Pending', worker: 'Unassigned', cost: 0 })), 
                            total: 0
                        });
                    }
                }
                else if (item.type === 'product') {
                    if (selectedReturnItems.includes(`${iIdx}-product`)) {
                        refundValue += Number(item.total || 0);
                        returnItems.push({
                            ...item,
                            returned: true,
                            total: 0
                        });
                        if (item.productId) {
                            inventoryUpdates.push({ id: item.productId, qty: item.qty || 1 });
                        }
                    }
                }
            });
    
            if (returnItems.length === 0) throw "No valid items selected";
            
            const warrantyDate = new Date(); warrantyDate.setDate(warrantyDate.getDate() + 7); 
            
            await addDoc(collection(db, "Orders"), {
                ticketId: newTicketId, originalTicketId: returnOrder.ticketId, customer: returnOrder.customer, orderType: isRepairReturn ? 'warranty' : 'return',
                items: returnItems, totalCost: 0, amountPaid: 0, balance: 0, refundedAmount: refundValue, 
                paymentStatus: refundValue > 0 ? 'Refunded' : 'Paid', status: isRepairReturn ? 'Pending' : 'Completed',
                createdAt: serverTimestamp(), warrantyExpiry: Timestamp.fromDate(warrantyDate)
            });

            if (inventoryUpdates.length > 0) {
                await Promise.all(inventoryUpdates.map(p => updateDoc(doc(db, "Inventory", p.id), { stock: increment(p.qty) })));
            }

            setToast({ message: `Return Ticket ${newTicketId} Created.`, type: 'success' });
            setShowPOS(false); setActiveTab('repair'); setReturnOrder(null); setSelectedReturnItems([]);
        } catch (e) { console.error(e); setToast({ message: "Failed.", type: 'error' }); } finally { setIsSubmitting(false); }
    };

    const handleExport = () => {
        const exportData = filteredOrders.map(order => ({
            "Ticket": order.ticketId, "Type": getOrderType(order), "Customer": order.customer?.name, 
            "Total": order.totalCost, "Status": order.status, "Date": new Date(order.createdAt?.seconds*1000).toLocaleDateString()
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Orders");
        XLSX.writeFile(wb, `Orders_Export.xlsx`);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 lg:p-10 font-sans text-slate-900">
             <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />
             <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={() => confirmConfig.action && confirmConfig.action(true)} />

            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-100 transition text-slate-600"><ArrowLeft size={20}/></button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">Order Management</h1>
                        <p className="text-sm text-slate-500 font-medium">Manage repairs, sales, and warranties.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExport} className="flex items-center gap-2 bg-white border border-gray-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition text-sm shadow-sm"><Download size={16} /> Export</button>
                    {(role === 'admin' || role === 'secretary') && <button onClick={() => setShowPOS(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md shadow-purple-200 flex gap-2 items-center justify-center transition"><PlusCircle size={18}/> New Order</button>}
                </div>
            </div>

            {/* CONTROL BAR */}
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 mb-6 flex flex-col lg:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                    <input className="w-full pl-10 pr-4 py-3 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400" placeholder="Search by Ticket ID or Customer Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
                <div className="h-auto w-px bg-gray-200 mx-2 hidden lg:block"></div>
                <div className="flex gap-2 overflow-x-auto p-1 lg:p-0">
                    <div className="relative min-w-[140px]">
                        <Filter className="absolute left-3 top-3.5 text-gray-400" size={16}/>
                        <select className="w-full pl-9 pr-8 py-3 bg-gray-50 rounded-xl border-none outline-none text-sm font-bold text-slate-600 cursor-pointer appearance-none" value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="All">All Types</option>
                            <option value="Repair">Repairs</option>
                            <option value="Sale">Sales</option>
                            <option value="Warranty">Warranty</option>
                            <option value="Return">Returns</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={14}/>
                    </div>
                    {/* ... (Other filters remain same) ... */}
                </div>
            </div>

            {/* DATA GRID */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket / Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Payment</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentOrders.map(order => (
                                <tr key={order.id} className="hover:bg-purple-50/50 cursor-pointer transition group" onClick={() => navigate(`/admin/orders/${order.ticketId}`)}>
                                    <td className="px-6 py-4">
                                        <div className="font-mono font-bold text-slate-800 group-hover:text-purple-700">{order.ticketId}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">{new Date(order.createdAt?.seconds*1000).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700">{order.customer?.name}</div>
                                        <div className="text-xs text-slate-400">{order.customer?.phone || 'No Phone'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 capitalize">
                                            {getOrderType(order) === 'repair' && <Wrench size={12}/>}
                                            {getOrderType(order) === 'store_sale' && <ShoppingBag size={12}/>}
                                            {getOrderType(order) === 'return' && <RotateCcw size={12} className="text-red-500"/>}
                                            {getOrderType(order)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">{formatCurrency(order.totalCost)}</td>
                                    <td className="px-6 py-4 text-center"><PaymentBadge status={order.paymentStatus} /></td>
                                    <td className="px-6 py-4 text-center"><StatusBadge status={order.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {/* PAGINATION */}
                {filteredOrders.length > 0 && (
                    <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                        <span className="text-sm text-gray-500 hidden sm:block">
                            Showing <span className="font-bold">{indexOfFirstItem + 1}</span> to <span className="font-bold">{Math.min(indexOfLastItem, filteredOrders.length)}</span> of <span className="font-bold">{filteredOrders.length}</span> results
                        </span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition"><ChevronLeft size={18}/></button>
                            <span className="text-xs font-bold bg-white px-3 py-1.5 rounded-lg border border-gray-200">Page {currentPage} of {totalPages}</span>
                            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition"><ChevronRight size={18}/></button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- 4. RESPONSIVE POS MODAL --- */}
            {showPOS && (
                <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-[1400px] h-[100dvh] sm:h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col lg:flex-row overflow-hidden relative">
                        
                        {/* LEFT: INPUTS */}
                        <div className={`w-full lg:w-[65%] flex flex-col bg-gray-50 h-full ${mobilePosTab === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
                            {/* Toolbar */}
                            <div className="bg-white px-4 sm:px-6 py-3 border-b border-gray-200 flex justify-between items-center shadow-sm z-10 shrink-0">
                                <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">New Order</h2>
                                <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-none">
                                    {['repair', 'store', 'warranty'].map(tab => (
                                        <button 
                                            key={tab}
                                            onClick={() => handleTabSwitch(tab)} 
                                            className={`px-4 sm:px-6 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-bold capitalize transition whitespace-nowrap ${activeTab === tab ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            {tab === 'warranty' ? 'Returns' : tab}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={()=>setShowPOS(false)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition"><X size={20}/></button>
                            </div>
                            
                            <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar pb-24 lg:pb-6">
                                {/* Customer Form */}
                                {activeTab !== 'warranty' && (
                                    <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm mb-6">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Customer Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="relative">
                                                <User size={18} className="absolute left-3 top-3 text-slate-400"/>
                                                <input placeholder="Full Name" className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium" value={customer.name} onChange={e=>setCustomer({...customer, name:e.target.value})}/>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Phone size={18} className="absolute left-3 top-3 text-slate-400"/>
                                                    <input placeholder="Phone" className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium" value={customer.phone} onChange={e=>setCustomer({...customer, phone:e.target.value})}/>
                                                </div>
                                                <button onClick={fillWalkIn} className="px-4 bg-gray-100 text-slate-600 font-bold rounded-lg hover:bg-gray-200 text-xs uppercase tracking-wide whitespace-nowrap">Walk-In</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* REPAIR INPUTS */}
                                {activeTab === 'repair' && (
                                    <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Device Info</h3>
                                        <input list="models" placeholder="Device Model (e.g. iPhone 13 Pro)" className="w-full p-3 border rounded-lg font-bold text-base text-slate-800 placeholder-slate-300 focus:ring-2 focus:ring-purple-500 outline-none" value={repairInput.deviceModel} onChange={e=>setRepairInput({...repairInput, deviceModel:e.target.value})}/>
                                        <datalist id="models">{uniqueModels.map(m=><option key={m} value={m}/>)}</datalist>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <input placeholder="IMEI / Serial" className="p-3 border rounded-lg text-sm" value={repairInput.imei} onChange={e=>setRepairInput({...repairInput, imei:e.target.value})}/>
                                            <input placeholder="Passcode" className="p-3 border rounded-lg text-sm bg-yellow-50 focus:bg-white" value={repairInput.passcode} onChange={e=>setRepairInput({...repairInput, passcode:e.target.value})}/>
                                        </div>
                                        
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Add Services</label>
                                            <div className="flex flex-col md:flex-row gap-3 mb-3">
                                                <select className="flex-1 p-3 border rounded-lg text-sm bg-white" value={serviceInput.type} onChange={handleServiceChange}>
                                                    <option value="">Select Service...</option>
                                                    {uniqueServices.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <div className="flex gap-2">
                                                    <input type="number" placeholder="Cost" className="w-24 sm:w-32 p-3 border rounded-lg text-sm font-mono" value={serviceInput.cost} onChange={e=>setServiceInput({...serviceInput, cost:e.target.value})}/>
                                                    <button onClick={addServiceToDevice} className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition">Add</button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {currentDeviceServices.map(s=>(
                                                    <div key={s.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm">
                                                        <span className="font-medium text-slate-700">{s.service}</span>
                                                        <div className="flex items-center gap-4">
                                                            <span className="font-mono font-bold text-slate-900">{formatCurrency(s.cost)}</span>
                                                            <button onClick={() => setCurrentDeviceServices(currentDeviceServices.filter(x => x.id !== s.id))} className="text-red-400 hover:text-red-600"><MinusCircle size={16}/></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={addDeviceToCart} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-black transition flex justify-center gap-2 items-center">
                                            <PlusCircle size={20}/> Add Device to Order
                                        </button>
                                    </div>
                                )}

                                {/* STORE GRID */}
                                {activeTab === 'store' && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-20">
                                        {inventory.map(p => (
                                            <button key={p.id} onClick={() => handleGridAddToCart(p)} disabled={p.stock < 1} className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl text-left h-32 flex flex-col justify-between hover:border-purple-500 hover:shadow-md transition group disabled:opacity-50 disabled:bg-gray-100">
                                                <span className="font-bold text-xs sm:text-sm text-slate-700 line-clamp-2 group-hover:text-purple-700 transition">{p.name}</span>
                                                <div className="flex justify-between items-end w-full">
                                                    <span className="text-slate-900 font-black text-base sm:text-lg">{formatCurrency(p.price)}</span>
                                                    <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded ${p.stock < 3 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{p.stock} left</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* WARRANTY UI */}
                                {activeTab === 'warranty' && (
                                    <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                                        <div className="flex gap-2">
                                            <input className="flex-1 p-3 border rounded-lg bg-gray-50 focus:bg-white transition outline-none text-sm" placeholder="Ticket ID (FTW-123...)" value={warrantyTicketSearch} onChange={e => setWarrantyTicketSearch(e.target.value)} />
                                            <button onClick={handleSearchReturnTicket} className="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700 shadow-md">Search</button>
                                        </div>
                                        {returnOrder && (
                                            <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                                                <h3 className="font-bold text-orange-900 mb-4 text-sm uppercase tracking-wide">Select Items to Return</h3>
                                                <div className="space-y-3">
                                                    {returnOrder.items.map((item, iIdx) => (
                                                        <div key={iIdx} className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm">
                                                            <div className="font-bold text-slate-800 mb-2 border-b border-gray-100 pb-2">{item.name || item.deviceModel}</div>
                                                            {item.type === 'repair' && item.services.map((svc, sIdx) => (
                                                                <label key={sIdx} className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer ${svc.returned ? 'opacity-50 pointer-events-none' : ''}`}>
                                                                    <input type="checkbox" disabled={svc.returned} checked={selectedReturnItems.includes(`${iIdx}-${sIdx}`)} onChange={() => toggleReturnItem(iIdx, sIdx)} className="w-5 h-5 accent-orange-600"/>
                                                                    <span className="text-sm font-medium text-slate-700">{svc.service}</span>
                                                                    {svc.returned && <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">Returned</span>}
                                                                </label>
                                                            ))}
                                                            {item.type === 'product' && (
                                                                <label className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer ${item.returned ? 'opacity-50 pointer-events-none' : ''}`}>
                                                                    <input type="checkbox" disabled={item.returned} checked={selectedReturnItems.includes(`${iIdx}-product`)} onChange={() => toggleReturnItem(iIdx)} className="w-5 h-5 accent-orange-600"/>
                                                                    <span className="text-sm font-medium text-slate-700">Return Item</span>
                                                                    {item.returned && <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">Returned</span>}
                                                                </label>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <button onClick={handleSubmitReturn} disabled={isSubmitting} className="w-full mt-6 bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-orange-700 transition">Generate Return Ticket</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: CART PANEL */}
                        <div className={`w-full lg:w-[35%] bg-white shadow-xl flex flex-col border-l border-gray-200 h-full ${mobilePosTab === 'input' ? 'hidden lg:flex' : 'flex'}`}>
                            <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
                                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2"><ShoppingCart className="text-purple-600"/> Order Items</h3>
                                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">{cart.length} Items</span>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-white custom-scrollbar pb-24 lg:pb-5">
                                {cart.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                        <ShoppingBag size={64} className="mb-4 opacity-20"/>
                                        <p className="font-bold">Cart is empty</p>
                                        <p className="text-sm">Add items to start</p>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.id} className="group bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm relative">
                                            <button onClick={() => removeFromCart(item.id)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition bg-gray-50 p-1.5 rounded-full"><Trash2 size={16}/></button>
                                            <div className="font-bold text-slate-800 pr-8 text-sm sm:text-base">{item.name || item.deviceModel}</div>
                                            {item.type === 'repair' && <div className="text-xs text-slate-500 mt-1">{item.services.map(s => s.service).join(', ')}</div>}
                                            
                                            <div className="flex justify-between items-end mt-4">
                                                {item.type === 'product' && (
                                                    <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-3">
                                                        <button onClick={() => updateCartQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 font-bold active:scale-90 transition"><Minus size={14}/></button>
                                                        <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
                                                        <button onClick={() => updateCartQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 font-bold active:scale-90 transition"><Plus size={14}/></button>
                                                    </div>
                                                )}
                                                <div className="text-right font-mono font-bold text-lg text-purple-700 ml-auto">{formatCurrency(item.total)}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 shrink-0 mb-16 lg:mb-0">
                                <div className="flex justify-between text-slate-500 mb-2 text-sm"><span>Subtotal</span><span>{formatCurrency(cart.reduce((a,b)=>a+b.total,0))}</span></div>
                                <div className="flex justify-between text-2xl font-black text-slate-900 mb-6"><span>Total</span><span>{formatCurrency(cart.reduce((a,b)=>a+b.total,0))}</span></div>
                                <button onClick={handleCheckout} disabled={isSubmitting || cart.length === 0} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 active:scale-95">
                                    Create Ticket <ArrowRight size={18}/>
                                </button>
                            </div>
                        </div>

                        {/* MOBILE BOTTOM NAV */}
                        <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                            <button onClick={() => setMobilePosTab('input')} className={`flex flex-col items-center gap-1 text-xs font-bold w-1/2 ${mobilePosTab === 'input' ? 'text-purple-700' : 'text-gray-400'}`}>
                                <Menu size={20}/> Inputs
                            </button>
                            <div className="w-px bg-gray-200 mx-2"></div>
                            <button onClick={() => setMobilePosTab('cart')} className={`flex flex-col items-center gap-1 text-xs font-bold w-1/2 relative ${mobilePosTab === 'cart' ? 'text-purple-700' : 'text-gray-400'}`}>
                                <ShoppingCart size={20}/> Cart 
                                {cart.length > 0 && <span className="absolute top-0 ml-4 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] animate-bounce">{cart.length}</span>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrdersManagement;