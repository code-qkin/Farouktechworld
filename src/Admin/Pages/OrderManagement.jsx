import React, { useState, useEffect, useMemo } from 'react';
import { 
    ClipboardList, Wrench, Search, Filter, PlusCircle, 
    Trash2, Package, User, Phone, X, 
    Printer, ShoppingBag, Plus, Minus, Save, XCircle, 
    Edit2, Download, MinusCircle, Grid, Calendar, CheckSquare, Square, UserPlus, AlertTriangle, Ban, RefreshCw, ArrowLeft, CheckCircle, ShoppingCart, Menu
} from 'lucide-react';
import { useAuth } from '../AdminContext.jsx'; 
import { db, auth } from '../../firebaseConfig.js';
import { signOut } from 'firebase/auth'; 
import { useNavigate, Link } from 'react-router-dom'; 
import { 
    collection, doc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, 
    serverTimestamp, runTransaction, updateDoc, Timestamp, addDoc, increment 
} from 'firebase/firestore';
import { repairPricing } from '../../Data/PriceData.js';
import * as XLSX from 'xlsx';
import { Toast, ConfirmModal } from '../Components/Feedback.jsx';

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

const getStatusBadge = (status) => {
    switch (status) {
        case 'In Progress': return 'bg-purple-100 text-purple-700';
        case 'Ready for Pickup': return 'bg-indigo-100 text-indigo-700';
        case 'Completed': return 'bg-green-100 text-green-700';
        case 'Pending': return 'bg-yellow-100 text-yellow-700';
        case 'Issue Reported': return 'bg-red-100 text-red-700';
        case 'Collected': return 'bg-gray-800 text-white';
        case 'Void': return 'bg-gray-200 text-gray-500 line-through';
        default: return 'bg-gray-100 text-gray-700';
    }
};

const getPaymentBadge = (status) => {
    switch (status) {
        case 'Paid': return 'bg-green-100 text-green-700 border border-green-200';
        case 'Part Payment': return 'bg-orange-100 text-orange-700 border border-orange-200';
        case 'Unpaid': return 'bg-red-100 text-red-700 border border-red-200';
        case 'Refunded': return 'bg-blue-100 text-blue-700 border border-blue-200';
        case 'Store Credit': return 'bg-purple-100 text-purple-700 border border-purple-200';
        case 'Voided': return 'bg-gray-100 text-gray-500 border border-gray-300';
        default: return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
};

const OrdersManagement = () => {
    const { role, user } = useAuth(); 
    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);
    const [inventory, setInventory] = useState([]); 
    const [loading, setLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterType, setFilterType] = useState('All');
    const [dateRange, setDateRange] = useState('30');
    
    const [showPOS, setShowPOS] = useState(false);
    const [activeTab, setActiveTab] = useState('repair'); 
    const [isSubmitting, setIsSubmitting] = useState(false);

    // NEW: Mobile POS State
    const [mobilePosTab, setMobilePosTab] = useState('input'); // 'input' or 'cart'

    const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
    const [cart, setCart] = useState([]); 
    
    const [repairInput, setRepairInput] = useState({ deviceModel: '', imei: '', passcode: '', condition: '' });
    const [serviceInput, setServiceInput] = useState({ type: '', cost: '' });
    const [currentDeviceServices, setCurrentDeviceServices] = useState([]); 

    const [warrantyTicketSearch, setWarrantyTicketSearch] = useState('');
    const [returnOrder, setReturnOrder] = useState(null);
    const [selectedReturnItems, setSelectedReturnItems] = useState([]);

    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

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

    const handleTabSwitch = (tab) => {
        setActiveTab(tab);
        setReturnOrder(null);
        setWarrantyTicketSearch('');
        setSelectedReturnItems([]);
    };

    const fillWalkIn = () => setCustomer({ name: 'Walk-in Guest', phone: '', email: '' });

    const addServiceToDevice = () => {
        if (!serviceInput.type || !serviceInput.cost) return setToast({message: "Select service and cost.", type: "error"});
        setCurrentDeviceServices([...currentDeviceServices, { 
            id: Date.now(), service: serviceInput.type, cost: Number(serviceInput.cost),
            worker: 'Unassigned', status: 'Pending'
        }]);
        setServiceInput({ type: '', cost: '' });
    };

    const addDeviceToCart = () => {
        if (!repairInput.deviceModel) return setToast({message: "Select Device Model.", type: "error"});
        setCart([...cart, { 
            type: 'repair', id: `rep-${Date.now()}`, 
            deviceModel: repairInput.deviceModel, imei: repairInput.imei, passcode: repairInput.passcode, condition: repairInput.condition, 
            services: currentDeviceServices, qty: 1, total: currentDeviceServices.reduce((sum, s) => sum + s.cost, 0)
        }]);
        setRepairInput({ deviceModel: '', imei: '', passcode: '', condition: '' });
        setCurrentDeviceServices([]);
        // On mobile, auto-switch to cart to show confirmation
        if (window.innerWidth < 1024) setMobilePosTab('cart');
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
        if (!customer.name || cart.length === 0) return setToast({message: "Fill details!", type: "error"});
        setIsSubmitting(true);
        
        const ticketId = `FTW-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
        const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);
        const orderType = cart.some(i => i.type === 'repair') ? 'repair' : 'store_sale';
        const warrantyDate = new Date();
        warrantyDate.setDate(warrantyDate.getDate() + 7);

        try {
            await runTransaction(db, async (t) => {
                const productUpdates = [];
                for (const item of cart) {
                    if (item.type === 'product') {
                        const ref = doc(db, "Inventory", item.productId);
                        productUpdates.push({ ref, item });
                    }
                }
                const snaps = await Promise.all(productUpdates.map(p => t.get(p.ref)));
                snaps.forEach((snap, idx) => {
                    if (!snap.exists() || snap.data().stock < productUpdates[idx].item.qty) throw `Stock Error: ${productUpdates[idx].item.name}`;
                });
                snaps.forEach((snap, idx) => t.update(productUpdates[idx].ref, { stock: snap.data().stock - productUpdates[idx].item.qty }));
                const newOrderRef = doc(collection(db, "Orders"));
                t.set(newOrderRef, {
                    ticketId, customer, orderType, 
                    items: cart, totalCost: cartTotal, amountPaid: 0, balance: cartTotal,
                    paymentStatus: 'Unpaid', paymentMethod: null, paid: false,
                    status: orderType === 'repair' ? 'Pending' : 'Completed',
                    createdAt: serverTimestamp(), warrantyExpiry: Timestamp.fromDate(warrantyDate)
                });
            });
            setShowPOS(false); setCart([]); setCustomer({ name: '', phone: '', email: '' });
            setToast({message: `Order ${ticketId} Created!`, type: "success"});
        } catch (e) { setToast({message: `Error: ${e}`, type: "error"}); } finally { setIsSubmitting(false); }
    };

    // ... (Warranty handlers same as before)
    const handleSearchWarrantyTicket = async () => { /* ... same code ... */ };
    const createWarrantyTicket = async () => { /* ... same code ... */ }; // Placeholder for brevity
    const handleSearchReturnTicket = async () => {
        if(!warrantyTicketSearch) return;
        setLoading(true);
        const q = query(collection(db, "Orders"), 
            where("ticketId", "==", warrantyTicketSearch.trim()), 
            where("status", "in", ["Completed", "Collected"]),
            where("orderType", "in", ["repair", "warranty"])
        );
        try {
            const snap = await getDocs(q);
            if(!snap.empty) {
                const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
                setReturnOrder(data);
                setCustomer(data.customer);
            } else {
                setToast({message: "Ticket not found, is a Sale, or not eligible.", type: "error"});
                setReturnOrder(null);
            }
        } catch (e) { setToast({message: "Search failed.", type: "error"}); }
        setLoading(false);
    };
    const toggleReturnItem = (itemIdx, serviceIdx = null) => {
        if (serviceIdx === null) return;
        const key = `${itemIdx}-${serviceIdx}`;
        if (selectedReturnItems.includes(key)) setSelectedReturnItems(selectedReturnItems.filter(k => k !== key));
        else setSelectedReturnItems([...selectedReturnItems, key]);
    };
    const handleSubmitReturn = async () => { /* ... same code ... */ }; // Placeholder

    const handleExport = () => {
        const exportData = filteredOrders.map(order => ({
            "Ticket": order.ticketId, "Type": getOrderType(order), "Customer": order.customer?.name, "Total": order.totalCost, "Status": order.status
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Orders");
        XLSX.writeFile(wb, `Orders.xlsx`);
    };

    const filteredOrders = orders.filter(o => {
        const term = searchTerm.toLowerCase();
        const matchSearch = (o.ticketId || '').toLowerCase().includes(term) || (o.customer?.name || '').toLowerCase().includes(term);
        const matchStatus = filterStatus === 'All' || o.status === filterStatus;
        return matchSearch && matchStatus;
    });

    return (
        <div className="space-y-6 p-4 sm:p-10">
             <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />
             <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={() => confirmConfig.action && confirmConfig.action(true)} />

            {/* Header - Mobile Responsive */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2 rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 text-gray-600"><ArrowLeft size={24}/></button>
                    <h1 className="text-2xl sm:text-3xl font-bold text-purple-900 flex items-center gap-2"><ClipboardList/> <span className="hidden sm:inline">Order Management</span><span className="sm:hidden">Orders</span></h1>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button onClick={handleExport} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 transition text-sm"><Download size={16} /> <span className="hidden sm:inline">Export CSV</span></button>
                    {(role === 'admin' || role === 'secretary') && <button onClick={() => setShowPOS(true)} className="flex-1 sm:flex-none bg-green-600 text-white px-6 py-2 rounded-lg font-bold shadow flex gap-2 items-center justify-center"><PlusCircle size={18}/> New Order</button>}
                </div>
            </div>

            {/* Filters - Mobile Responsive */}
            <div className="flex flex-col lg:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                    <input className="w-full pl-10 p-2 border rounded-lg" placeholder="Search orders..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:flex">
                    <select className="p-2 border rounded-lg w-full" value={dateRange} onChange={e => setDateRange(e.target.value)}><option value="7">7 Days</option><option value="30">30 Days</option><option value="All">All Time</option></select>
                    <select className="p-2 border rounded-lg w-full" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="All">All Types</option>
                        <option value="Repair">🛠️ Repairs</option>
                        <option value="Sale">🛍️ Sales</option>
                        <option value="Warranty">🔄 Warranties</option>
                    </select>
                    <select className="p-2 border rounded-lg w-full col-span-2 sm:col-span-1" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="All">All Status</option><option value="Pending">Pending</option><option value="Completed">Completed</option><option value="Void">Void</option></select>
                </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-2xl shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left font-bold text-gray-500">Ticket</th><th className="px-6 py-3 text-left font-bold text-gray-500">Type</th><th className="px-6 py-3 text-left font-bold text-gray-500">Customer</th><th className="px-6 py-3 text-left font-bold text-gray-500">Total</th><th className="px-6 py-3 text-left font-bold text-gray-500">Payment</th><th className="px-6 py-3 text-left font-bold text-gray-500">Status</th></tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredOrders.map(order => (
                            <tr key={order.id} className={`hover:bg-purple-50 cursor-pointer ${order.status === 'Void' ? 'opacity-50' : ''}`} onClick={() => navigate(`/admin/orders/${order.ticketId}`)}>
                                <td className="px-6 py-4 font-bold text-purple-800">{order.ticketId}</td>
                                <td className="px-6 py-4 capitalize">{getOrderType(order)}</td>
                                <td className="px-6 py-4 max-w-[150px] truncate">{order.customer.name}</td>
                                <td className="px-6 py-4 font-bold text-green-600">{formatCurrency(order.totalCost)}</td>
                                <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${getPaymentBadge(order.paymentStatus)}`}>{order.paymentStatus}</span></td>
                                <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${getStatusBadge(order.status)}`}>{order.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* POS Modal - Responsive */}
            {showPOS && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-0 sm:p-4">
                    <div className="bg-white w-full max-w-7xl h-full sm:h-[95vh] sm:rounded-2xl shadow-2xl flex flex-col lg:flex-row overflow-hidden relative">
                        
                        {/* LEFT: Input Section (Menu/Form) */}
                        <div className={`w-full lg:w-2/3 flex flex-col lg:border-r bg-gray-50 h-full ${mobilePosTab === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
                            {/* POS Header */}
                            <div className="bg-white p-4 border-b flex justify-between items-center flex-wrap gap-2">
                                <h2 className="text-lg sm:text-xl font-black">New Order</h2>
                                <div className="flex gap-2 text-xs sm:text-sm overflow-x-auto no-scrollbar">
                                    <button onClick={() => handleTabSwitch('repair')} className={`px-3 sm:px-4 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${activeTab==='repair'?'bg-purple-900 text-white shadow-md':'bg-gray-100 hover:bg-gray-200'}`}>Repair</button>
                                    <button onClick={() => handleTabSwitch('store')} className={`px-3 sm:px-4 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${activeTab==='store'?'bg-green-700 text-white shadow-md':'bg-gray-100 hover:bg-gray-200'}`}>Store</button>
                                    <button onClick={() => handleTabSwitch('warranty')} className={`px-3 sm:px-4 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${activeTab==='warranty'?'bg-orange-600 text-white shadow-md':'bg-gray-100 hover:bg-gray-200'}`}>Warranty</button>
                                    <button onClick={()=>setShowPOS(false)} className="bg-red-50 text-red-500 p-1.5 rounded hover:bg-red-100 lg:ml-2"><X size={18}/></button>
                                </div>
                            </div>
                            
                            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6 pb-24 lg:pb-6">
                                {/* Customer Info */}
                                {activeTab !== 'warranty' && (
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="flex-1 relative">
                                            <User size={16} className="absolute left-3 top-3.5 text-gray-400"/>
                                            <input placeholder="Customer Name" className="w-full pl-10 p-3 border rounded-lg shadow-sm" value={customer.name} onChange={e=>setCustomer({...customer, name:e.target.value})}/>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1 sm:w-48 relative">
                                                <Phone size={16} className="absolute left-3 top-3.5 text-gray-400"/>
                                                <input placeholder="Phone" className="w-full pl-10 p-3 border rounded-lg shadow-sm" value={customer.phone} onChange={e=>setCustomer({...customer, phone:e.target.value})}/>
                                            </div>
                                            <button onClick={fillWalkIn} className="bg-gray-200 px-3 rounded-lg hover:bg-gray-300" title="Walk-in Guest"><UserPlus size={20}/></button>
                                        </div>
                                    </div>
                                )}

                                {/* REPAIR FORM */}
                                {activeTab === 'repair' && (
                                    <div className="bg-white p-4 sm:p-6 rounded-xl border shadow-sm space-y-4">
                                        <h3 className="font-bold text-gray-500 border-b pb-2 text-sm uppercase">Device Details</h3>
                                        <input list="models" placeholder="Device Model (e.g. iPhone 13)" className="w-full p-3 border rounded-lg font-bold text-lg" value={repairInput.deviceModel} onChange={e=>setRepairInput({...repairInput, deviceModel:e.target.value})}/>
                                        <datalist id="models">{uniqueModels.map(m=><option key={m} value={m}/>)}</datalist>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <input placeholder="IMEI / Serial (Optional)" className="p-3 border rounded-lg" value={repairInput.imei} onChange={e=>setRepairInput({...repairInput, imei:e.target.value})}/>
                                            <input placeholder="Device Passcode" className="p-3 border rounded-lg bg-yellow-50 focus:bg-white transition" value={repairInput.passcode} onChange={e=>setRepairInput({...repairInput, passcode:e.target.value})}/>
                                        </div>
                                        <input placeholder="Condition Notes (Scratches, Cracks...)" className="w-full p-3 border rounded-lg" value={repairInput.condition} onChange={e=>setRepairInput({...repairInput, condition:e.target.value})}/>
                                        
                                        {/* Service Adder */}
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                            <div className="flex flex-col sm:flex-row gap-2 mb-2">
                                                <select className="flex-1 p-2 border rounded" value={serviceInput.type} onChange={handleServiceChange}><option value="">Select Service...</option>{uniqueServices.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                                <div className="flex gap-2">
                                                    <input type="number" placeholder="Cost" className="w-full sm:w-32 p-2 border rounded" value={serviceInput.cost} onChange={e=>setServiceInput({...serviceInput, cost:e.target.value})}/>
                                                    <button onClick={addServiceToDevice} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">Add</button>
                                                </div>
                                            </div>
                                            {currentDeviceServices.map(s=><div key={s.id} className="flex justify-between bg-white p-2 mb-1 rounded shadow-sm text-sm border-l-4 border-blue-500"><span>{s.service}</span><div className="flex gap-2"><b>{formatCurrency(s.cost)}</b><button onClick={() => setCurrentDeviceServices(currentDeviceServices.filter(x => x.id !== s.id))} className="text-red-500"><MinusCircle size={14}/></button></div></div>)}
                                        </div>
                                        <button onClick={addDeviceToCart} className="w-full bg-purple-900 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-purple-800 transition transform active:scale-95">+ Add Device to Ticket</button>
                                    </div>
                                )}

                                {/* STORE GRID */}
                                {activeTab === 'store' && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pb-20">
                                        {inventory.map(p => (
                                            <button key={p.id} onClick={() => handleGridAddToCart(p)} disabled={p.stock < 1} className="p-3 sm:p-4 border rounded-xl text-left h-28 sm:h-32 flex flex-col justify-between bg-white hover:border-green-500 hover:shadow-md transition disabled:opacity-50 disabled:bg-gray-50">
                                                <span className="font-bold text-xs sm:text-sm line-clamp-2">{p.name}</span>
                                                <div className="flex justify-between items-end w-full">
                                                    <span className="text-green-700 font-bold text-sm sm:text-base">{formatCurrency(p.price)}</span>
                                                    <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded ${p.stock < 3 ? 'bg-red-100 text-red-600' : 'bg-gray-100'}`}>{p.stock} left</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* WARRANTY UI */}
                                {activeTab === 'warranty' && (
                                    <div className="space-y-6">
                                        <div className="flex gap-2">
                                            <input className="flex-1 p-3 border rounded-lg shadow-sm" placeholder="Enter Completed Ticket ID" value={warrantyTicketSearch} onChange={e => setWarrantyTicketSearch(e.target.value)} />
                                            <button onClick={handleSearchReturnTicket} className="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700">Find</button>
                                        </div>
                                        {returnOrder && (
                                            <div className="bg-orange-50 p-5 rounded-xl border border-orange-200">
                                                <h3 className="font-bold text-orange-900 mb-2">Select Services to Rework:</h3>
                                                <div className="space-y-3">
                                                    {returnOrder.items.map((item, iIdx) => (
                                                        <div key={iIdx} className="bg-white p-3 rounded border shadow-sm">
                                                            <div className="font-bold text-sm text-gray-800 mb-2">{item.name || item.deviceModel}</div>
                                                            {item.type === 'repair' && item.services.map((svc, sIdx) => (
                                                                <div key={sIdx} className={`flex items-center gap-2 ml-4 mb-1 ${svc.returned ? 'opacity-50' : ''}`}>
                                                                    <input type="checkbox" disabled={svc.returned} checked={selectedReturnItems.includes(`${iIdx}-${sIdx}`)} onChange={() => toggleReturnItem(iIdx, sIdx)} className="w-5 h-5 accent-orange-600"/>
                                                                    <span className="text-sm">{svc.service} {svc.returned && <span className="text-red-500 font-bold ml-2">(Already Reworked)</span>}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                                <button onClick={handleSubmitReturn} disabled={isSubmitting} className="w-full mt-6 bg-orange-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-orange-700">Create Warranty Ticket</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Cart Section */}
                        <div className={`w-full lg:w-1/3 bg-white shadow-xl flex flex-col border-l h-full ${mobilePosTab === 'input' ? 'hidden lg:flex' : 'flex'}`}>
                            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                <h3 className="font-bold text-gray-700 flex items-center gap-2"><ShoppingBag size={20}/> Current Ticket</h3>
                                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">{cart.length} Items</span>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 lg:pb-0 bg-white">
                                {cart.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                                        <ShoppingBag size={48} className="mb-2 opacity-20"/>
                                        <p>Cart is empty</p>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.id} className="bg-white border rounded-lg p-3 shadow-sm relative group hover:border-purple-200 transition">
                                            <button onClick={() => removeFromCart(item.id)} className="absolute top-2 right-2 text-gray-300 hover:text-red-600"><X size={16}/></button>
                                            <div className="font-bold text-sm pr-6 text-gray-800">{item.name || item.deviceModel}</div>
                                            {item.type === 'repair' && <div className="text-xs text-gray-500 mt-1">{item.services.map(s => s.service).join(', ')}</div>}
                                            <div className="flex justify-between items-center mt-3">
                                                {item.type === 'product' && (
                                                    <div className="flex items-center bg-gray-100 rounded-lg px-2 py-1 gap-3">
                                                        <button onClick={() => updateCartQty(item.id, -1)} className="hover:text-red-500 font-bold">-</button>
                                                        <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                                                        <button onClick={() => updateCartQty(item.id, 1)} className="hover:text-green-600 font-bold">+</button>
                                                    </div>
                                                )}
                                                <div className="text-right font-bold ml-auto text-purple-700">{formatCurrency(item.total)}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            <div className="p-4 border-t bg-gray-50 space-y-3 pb-24 lg:pb-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                                <div className="flex justify-between text-xl font-bold text-gray-900"><span>Total</span><span>{formatCurrency(cart.reduce((a,b)=>a+b.total,0))}</span></div>
                                <button onClick={handleCheckout} disabled={isSubmitting || cart.length === 0} className="w-full bg-black text-white py-4 rounded-xl font-bold shadow-lg hover:bg-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed">Checkout (Unpaid)</button>
                            </div>
                        </div>

                        {/* MOBILE BOTTOM NAVIGATION FOR POS */}
                        <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
                            <button 
                                onClick={() => setMobilePosTab('input')} 
                                className={`flex flex-col items-center gap-1 text-xs font-bold ${mobilePosTab === 'input' ? 'text-purple-700' : 'text-gray-400'}`}
                            >
                                <Menu size={20}/> Menu
                            </button>
                            <button 
                                onClick={() => setMobilePosTab('cart')} 
                                className={`flex flex-col items-center gap-1 text-xs font-bold relative ${mobilePosTab === 'cart' ? 'text-purple-700' : 'text-gray-400'}`}
                            >
                                <ShoppingCart size={20}/> Cart
                                {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] animate-bounce">{cart.length}</span>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrdersManagement;