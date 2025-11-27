import React, { useState, useEffect, useMemo } from 'react';
import { 
    ClipboardList, Wrench, Search, Filter, PlusCircle, 
    Trash2, Package, User, Phone, X, 
    Printer, ShoppingBag, Plus, Minus, Save, XCircle, 
    Edit2, Download, MinusCircle, Grid, Calendar, CheckSquare, Square, UserPlus, AlertTriangle, Ban, RefreshCw, ArrowLeft, CheckCircle
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
    };

    const handleGridAddToCart = (product) => {
        if (product.stock < 1) return setToast({message: "Out of Stock!", type: "error"});
        setCart([...cart, { type: 'product', id: `prod-${Date.now()}`, productId: product.id, name: product.name, price: product.price, qty: 1, total: product.price }]);
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

    const handleSearchWarrantyTicket = async () => {
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
                setToast({message: "Ticket not found, is a Sale (use Order Details), or not eligible.", type: "error"});
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

    const handleSubmitReturn = async () => {
        if (selectedReturnItems.length === 0) return alert("Select services.");
        setIsSubmitting(true);
        try {
            await runTransaction(db, async (t) => {
                const returnCart = [];
                const originalOrderRef = doc(db, "Orders", returnOrder.id);
                const originalOrderSnap = await t.get(originalOrderRef);
                const originalItems = originalOrderSnap.data().items;
                const updatedOriginalItems = JSON.parse(JSON.stringify(originalItems));

                returnOrder.items.forEach((item, iIdx) => {
                    if (item.type === 'repair') {
                        const selectedServices = item.services.filter((_, sIdx) => selectedReturnItems.includes(`${iIdx}-${sIdx}`));
                        if (selectedServices.length > 0) {
                            returnCart.push({
                                ...item,
                                services: selectedServices.map(s => ({ ...s, status: 'Pending', worker: 'Unassigned', cost: 0 })),
                                total: 0, isWarranty: true
                            });
                            item.services.forEach((_, sIdx) => { 
                                if (selectedReturnItems.includes(`${iIdx}-${sIdx}`)) updatedOriginalItems[iIdx].services[sIdx].returned = true; 
                            });
                        }
                    }
                });

                t.update(originalOrderRef, { items: updatedOriginalItems });

                const newTicketId = `FTW-RMA-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
                const newOrderRef = doc(collection(db, "Orders"));

                t.set(newOrderRef, {
                    ticketId: newTicketId, originalTicketId: returnOrder.ticketId, customer: returnOrder.customer,
                    orderType: 'warranty', items: returnCart, totalCost: 0, amountPaid: 0, balance: 0,
                    paymentStatus: 'Paid', paid: true,
                    status: 'Pending',
                    createdAt: serverTimestamp(),
                    notes: `Warranty from Ticket #${returnOrder.ticketId}`
                });
            });
            setToast({message: "Warranty Ticket Created!", type: "success"});
            setShowPOS(false); setReturnOrder(null); setSelectedReturnItems([]);
        } catch (e) { setToast({message: "Failed: " + e, type: "error"}); } finally { setIsSubmitting(false); }
    };

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
        <div className="space-y-6 p-10">
             <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />
             <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={() => confirmConfig.action && confirmConfig.action(true)} />

            <div className="flex justify-between items-center border-b pb-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2 rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 text-gray-600"><ArrowLeft size={24}/></button>
                    <h1 className="text-3xl font-bold text-purple-900 flex items-center gap-2"><ClipboardList/> Order Management</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExport} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 transition text-sm"><Download size={16} /> Export CSV</button>
                    {(role === 'admin' || role === 'secretary') && <button onClick={() => setShowPOS(true)} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold shadow flex gap-2 items-center"><PlusCircle/> New Order</button>}
                </div>
            </div>

            {/* Filters & Table Omitted for brevity (Same as before) */}
            <div className="flex gap-4 bg-white p-4 rounded-xl shadow-sm border">
                <div className="relative flex-1"><Search className="absolute left-3 top-3 text-gray-400" size={18}/><input className="w-full pl-10 p-2 border rounded-lg" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                <select className="p-2 border rounded-lg" value={dateRange} onChange={e => setDateRange(e.target.value)}><option value="7">7 Days</option><option value="30">30 Days</option><option value="All">All Time</option></select>
                <div className="flex items-center gap-2 bg-gray-50 px-3 rounded-lg border"><Filter size={16} className="text-gray-500"/><select className="p-2 bg-transparent outline-none" value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="All">All Types</option>
                    <option value="Repair">🛠️ Repairs</option>
                    <option value="Sale">🛍️ Sales</option>
                    <option value="Warranty">🔄 Warranties</option>
                    <option value="Return">🔙 Returns</option>
                </select></div>
                <select className="p-2 border rounded-lg" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="All">Status</option><option value="Pending">Pending</option><option value="Completed">Completed</option><option value="Void">Void</option></select>
            </div>

            <div className="bg-white rounded-2xl shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left font-bold text-gray-500">Ticket</th><th className="px-6 py-3 text-left font-bold text-gray-500">Type</th><th className="px-6 py-3 text-left font-bold text-gray-500">Customer</th><th className="px-6 py-3 text-left font-bold text-gray-500">Total</th><th className="px-6 py-3 text-left font-bold text-gray-500">Payment</th><th className="px-6 py-3 text-left font-bold text-gray-500">Status</th></tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredOrders.map(order => (
                            <tr key={order.id} className={`hover:bg-purple-50 cursor-pointer ${order.status === 'Void' ? 'opacity-50' : ''}`} onClick={() => navigate(`/admin/orders/${order.ticketId}`)}>
                                <td className="px-6 py-4 font-bold text-purple-800">{order.ticketId}</td>
                                <td className="px-6 py-4 capitalize">{getOrderType(order)}</td>
                                <td className="px-6 py-4">{order.customer.name}</td>
                                <td className="px-6 py-4 font-bold text-green-600">{formatCurrency(order.totalCost)}</td>
                                <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${getPaymentBadge(order.paymentStatus)}`}>{order.paymentStatus}</span></td>
                                <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${getStatusBadge(order.status)}`}>{order.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showPOS && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-7xl h-[95vh] rounded-2xl shadow-2xl flex overflow-hidden">
                        <div className="w-2/3 flex flex-col border-r bg-gray-50">
                            <div className="bg-white p-4 border-b flex justify-between items-center">
                                <h2 className="text-xl font-black">New Order</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => handleTabSwitch('repair')} className={`px-4 py-1 rounded font-bold ${activeTab==='repair'?'bg-purple-900 text-white':'bg-gray-200'}`}>Repair</button>
                                    <button onClick={() => handleTabSwitch('store')} className={`px-4 py-1 rounded font-bold ${activeTab==='store'?'bg-green-700 text-white':'bg-gray-200'}`}>Store</button>
                                    <button onClick={() => handleTabSwitch('warranty')} className={`px-4 py-1 rounded font-bold ${activeTab==='warranty'?'bg-orange-600 text-white':'bg-gray-200'}`}>Warranty</button>
                                    <button onClick={()=>setShowPOS(false)}><X/></button>
                                </div>
                            </div>
                            
                            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                                {/* ... Customer/Repair/Store UI same as before ... */}
                                {activeTab !== 'warranty' && (
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative"><User size={16} className="absolute left-3 top-3 text-gray-400"/><input placeholder="Customer Name" className="w-full pl-10 p-3 border rounded-lg" value={customer.name} onChange={e=>setCustomer({...customer, name:e.target.value})}/></div>
                                        <div className="w-48 relative"><Phone size={16} className="absolute left-3 top-3 text-gray-400"/><input placeholder="Phone" className="w-full pl-10 p-3 border rounded-lg" value={customer.phone} onChange={e=>setCustomer({...customer, phone:e.target.value})}/></div>
                                        <button onClick={fillWalkIn} className="bg-gray-200 px-3 rounded-lg"><UserPlus size={20}/></button>
                                    </div>
                                )}

                                {activeTab === 'repair' && (
                                    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                                        <h3 className="font-bold text-gray-500 border-b pb-2">Device Details</h3>
                                        <input list="models" placeholder="Device Model" className="w-full p-3 border rounded-lg font-bold text-lg" value={repairInput.deviceModel} onChange={e=>setRepairInput({...repairInput, deviceModel:e.target.value})}/>
                                        <datalist id="models">{uniqueModels.map(m=><option key={m} value={m}/>)}</datalist>
                                        <div className="grid grid-cols-2 gap-4">
                                            <input placeholder="IMEI" className="p-3 border rounded-lg" value={repairInput.imei} onChange={e=>setRepairInput({...repairInput, imei:e.target.value})}/>
                                            <input placeholder="Passcode" className="p-3 border rounded-lg bg-yellow-50" value={repairInput.passcode} onChange={e=>setRepairInput({...repairInput, passcode:e.target.value})}/>
                                        </div>
                                        <input placeholder="Condition Notes" className="w-full p-3 border rounded-lg" value={repairInput.condition} onChange={e=>setRepairInput({...repairInput, condition:e.target.value})}/>
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                            <div className="flex gap-2 mb-2">
                                                <select className="flex-1 p-2 border rounded" value={serviceInput.type} onChange={handleServiceChange}><option value="">Select Service...</option>{uniqueServices.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                                <input type="number" placeholder="Cost" className="w-32 p-2 border rounded" value={serviceInput.cost} onChange={e=>setServiceInput({...serviceInput, cost:e.target.value})}/>
                                                <button onClick={addServiceToDevice} className="bg-blue-600 text-white px-4 rounded font-bold">Add</button>
                                            </div>
                                            {currentDeviceServices.map(s=><div key={s.id} className="flex justify-between bg-white p-2 mb-1 rounded shadow-sm text-sm"><span>{s.service}</span><div className="flex gap-2"><b>{formatCurrency(s.cost)}</b><button onClick={() => setCurrentDeviceServices(currentDeviceServices.filter(x => x.id !== s.id))} className="text-red-500"><MinusCircle size={14}/></button></div></div>)}
                                        </div>
                                        <button onClick={addDeviceToCart} className="w-full bg-purple-900 text-white py-3 rounded-lg font-bold shadow-lg">+ Add Device to Ticket</button>
                                    </div>
                                )}
                                {activeTab === 'store' && (
                                    <div className="grid grid-cols-4 gap-4">{inventory.map(p => <button key={p.id} onClick={() => handleGridAddToCart(p)} disabled={p.stock < 1} className="p-4 border rounded-xl text-left h-32 flex flex-col justify-between bg-white hover:border-green-500 disabled:opacity-50"><span className="font-bold text-sm line-clamp-2">{p.name}</span><div className="flex justify-between items-end"><span className="text-green-700 font-bold">{formatCurrency(p.price)}</span><span className="text-xs bg-gray-100 px-2 rounded">{p.stock}</span></div></button>)}</div>
                                )}

                                {activeTab === 'warranty' && (
                                    <div className="space-y-6">
                                        <div className="flex gap-2">
                                            <input className="flex-1 p-3 border rounded-lg" placeholder="Enter Completed Repair Ticket ID" value={warrantyTicketSearch} onChange={e => setWarrantyTicketSearch(e.target.value)} />
                                            <button onClick={handleSearchReturnTicket} className="bg-blue-600 text-white px-6 rounded-lg font-bold">Find</button>
                                        </div>
                                        {returnOrder && (
                                            <div className="bg-orange-50 p-5 rounded-xl border border-orange-200">
                                                <h3 className="font-bold text-orange-900 mb-2">Select Services to Rework:</h3>
                                                <div className="space-y-3">
                                                    {returnOrder.items.map((item, iIdx) => (
                                                        <div key={iIdx} className="bg-white p-3 rounded border">
                                                            <div className="font-bold text-sm text-gray-800 mb-2">{item.name || item.deviceModel}</div>
                                                            {item.type === 'repair' && item.services.map((svc, sIdx) => (
                                                                <div key={sIdx} className={`flex items-center gap-2 ml-4 mb-1 ${svc.returned ? 'opacity-50' : ''}`}>
                                                                    <input type="checkbox" disabled={svc.returned} checked={selectedReturnItems.includes(`${iIdx}-${sIdx}`)} onChange={() => toggleReturnItem(iIdx, sIdx)}/>
                                                                    <span className="text-sm">{svc.service} {svc.returned && <span className="text-red-500 font-bold">(Already Reworked)</span>}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                                <button onClick={createWarrantyTicket} disabled={isSubmitting} className="w-full mt-6 bg-orange-600 text-white py-3 rounded-lg font-bold shadow-lg">Create Warranty Ticket</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                         </div>

                        {/* RIGHT: CART */}
                        {activeTab !== 'warranty' && (
                            <div className="w-1/3 bg-white shadow-xl flex flex-col border-l">
                                <div className="p-4 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700">Current Ticket</h3><span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">{cart.length} Items</span></div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                    {cart.map(item => (
                                        <div key={item.id} className="bg-white border rounded-lg p-3 shadow-sm relative group">
                                            <button onClick={() => removeFromCart(item.id)} className="absolute top-2 right-2 text-red-300 hover:text-red-600"><X size={16}/></button>
                                            <div className="font-bold text-sm pr-6">{item.name || item.deviceModel}</div>
                                            {item.type === 'repair' && <div className="text-xs text-gray-500 mt-1">{item.services.map(s => s.service).join(', ')}</div>}
                                            <div className="flex justify-between items-center mt-2">
                                                {item.type === 'product' && <div className="flex items-center bg-gray-100 rounded px-2"><button onClick={() => updateCartQty(item.id, -1)}>-</button><span className="px-2 text-xs font-bold">{item.qty}</span><button onClick={() => updateCartQty(item.id, 1)}>+</button></div>}
                                                <div className="text-right font-bold ml-auto">{formatCurrency(item.total)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 border-t bg-gray-50 space-y-3">
                                    <div className="flex justify-between text-xl font-bold"><span>Total</span><span>{formatCurrency(cart.reduce((a,b)=>a+b.total,0))}</span></div>
                                    <button onClick={handleCheckout} disabled={isSubmitting} className="w-full bg-black text-white py-4 rounded-xl font-bold shadow-lg">Checkout (Unpaid)</button>
                                    <button onClick={()=>setShowPOS(false)} className="w-full text-gray-400 text-xs mt-2">Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrdersManagement;