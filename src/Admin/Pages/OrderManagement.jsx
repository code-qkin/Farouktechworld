import React, { useState, useEffect, useMemo } from 'react';
import { 
    ClipboardList, Search, PlusCircle, 
    Trash2, User, Phone, X, 
    ShoppingBag, MinusCircle, Download, 
    ArrowLeft, ShoppingCart, Menu,
    Filter, ChevronDown, CheckCircle, AlertCircle, Wrench, ArrowRight,
    RotateCcw, ChevronLeft, ChevronRight, Plus, Minus, AlertTriangle, Send,
    DownloadCloud, Loader2, Users, Calendar, DollarSign
} from 'lucide-react';
import { useAuth } from '../AdminContext.jsx'; 
import { db } from '../../firebaseConfig.js';
import { useNavigate, useLocation } from 'react-router-dom'; 
import { 
    collection, doc, onSnapshot, query, orderBy, getDocs, 
    serverTimestamp, runTransaction, Timestamp, addDoc, updateDoc, deleteDoc, 
    arrayRemove, limit, where 
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Toast, ConfirmModal } from '../Components/Feedback.jsx';

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

// --- BADGES ---
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
        <span className={`flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold border w-fit mx-auto ${styles[status] || 'bg-gray-50'}`}>
            {status === 'Paid' && <CheckCircle size={10} />}
            {status === 'Unpaid' && <AlertCircle size={10} />}
            {status || 'Unpaid'}
        </span>
    );
};

const OrdersManagement = () => {
    const { role, user } = useAuth(); 
    const navigate = useNavigate();
    const location = useLocation();

    // Data State
    const [orders, setOrders] = useState([]);
    const [inventory, setInventory] = useState([]); 
    const [dbServices, setDbServices] = useState([]); 
    const [savedCustomers, setSavedCustomers] = useState([]); 
    const [loading, setLoading] = useState(true);
    
    // Pagination & Search State
    const [itemsToShow, setItemsToShow] = useState(50);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Filters State
    const [timeFilter, setTimeFilter] = useState('week'); // 'day', 'week', 'month', 'all'
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterType, setFilterType] = useState('All');
    const [filterPayment, setFilterPayment] = useState('All'); 

    // POS Filters
    const [storeSearch, setStoreSearch] = useState('');
    const [storeCategory, setStoreCategory] = useState('All');
    const [storePage, setStorePage] = useState(1);
    const itemsPerStorePage = 24;

    // Client-side Pagination (Main List)
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    
    // UI State
    const [showPOS, setShowPOS] = useState(false);
    const [activeTab, setActiveTab] = useState('repair'); 
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mobilePosTab, setMobilePosTab] = useState('input'); 

    // POS Data
    const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
    const [cart, setCart] = useState([]); 
    const [discount, setDiscount] = useState(0); 
    const [repairInput, setRepairInput] = useState({ deviceModel: '', imei: '', passcode: '', condition: '' });
    const [serviceInput, setServiceInput] = useState({ type: '', cost: '' });
    const [currentDeviceServices, setCurrentDeviceServices] = useState([]); 
    const [editOrderId, setEditOrderId] = useState(null);

    // Warranty/Return
    const [warrantyTicketSearch, setWarrantyTicketSearch] = useState('');
    const [returnOrder, setReturnOrder] = useState(null);
    const [selectedReturnItems, setSelectedReturnItems] = useState([]);

    // Secretay Modal
    const [requestModal, setRequestModal] = useState({ isOpen: false, order: null });
    const [deleteReason, setDeleteReason] = useState('');

    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

    const storeCategories = ["Accessories", "Phones", "Laptops", "Chargers", "Screen Guards", "Audio", "Parts", "Services", "Others"];

    // 1. DATA FETCHING (SMART TIME FILTER)
    useEffect(() => {
        setLoading(true);
        let q;

        if (searchTerm.length >= 3) {
            const term = searchTerm.trim(); 
            q = query(
                collection(db, "Orders"),
                where("ticketId", ">=", term),
                where("ticketId", "<=", term + "\uf8ff"),
                limit(50)
            );
        } else {
            let startDate = new Date();
            startDate.setHours(0, 0, 0, 0);

            if (timeFilter === 'day') {
                // Today (start date is already set)
            } else if (timeFilter === 'week') {
                startDate.setDate(startDate.getDate() - 7);
            } else if (timeFilter === 'month') {
                startDate.setMonth(startDate.getMonth() - 1);
            } else {
                startDate = null; // 'all'
            }

            if (startDate) {
                q = query(
                    collection(db, "Orders"), 
                    where("createdAt", ">=", startDate),
                    orderBy("createdAt", "desc")
                );
            } else {
                q = query(collection(db, "Orders"), orderBy("createdAt", "desc"), limit(100));
            }
        }
        
        const unsubOrders = onSnapshot(q, (snap) => {
            const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setOrders(fetched);
            setLoading(false);
        });
        
        const unsubInventory = onSnapshot(query(collection(db, "Inventory"), orderBy("name")), (snap) => {
            setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubCustomers = onSnapshot(query(collection(db, "Customers"), orderBy("name")), (snap) => {
            setSavedCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const fetchServices = async () => {
            const snap = await getDocs(collection(db, "Services"));
            setDbServices(snap.docs.map(d => d.data()));
        };
        fetchServices();

        return () => { unsubOrders(); unsubInventory(); unsubCustomers(); };
    }, [timeFilter, searchTerm]);

    // CHECK FOR EDIT MODE
    useEffect(() => {
        if (location.state && location.state.orderToEdit) {
            const order = location.state.orderToEdit;
            setEditOrderId(order.id);
            setCustomer(order.customer || { name: '', phone: '', email: '' });
            setCart(order.items || []);
            setDiscount(order.discount || 0);
            setShowPOS(true);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const getOrderType = (order) => {
        if (!order) return 'store_sale';
        if (order.orderType) return order.orderType.toLowerCase(); 
        if (order.items && order.items.some(i => i.type === 'repair')) return 'repair';
        return 'store_sale';
    };

    // 2. FILTERING
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
            }

            // MATCH PAYMENT FILTER
            const currentPayment = o.paymentStatus || (o.paid ? 'Paid' : 'Unpaid');
            const matchPayment = filterPayment === 'All' || currentPayment === filterPayment;

            return matchSearch && matchStatus && matchType && matchPayment;
        });
    }, [orders, searchTerm, filterStatus, filterType, filterPayment]);

    // 🔥 STORE SEARCH & FILTERING (Fixed Pagination Reset)
    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const term = storeSearch.toLowerCase();
            // Safe checks for missing fields
            const itemName = (item.name || '').toLowerCase();
            const itemModel = (item.model || '').toLowerCase();
            
            const matchSearch = itemName.includes(term) || itemModel.includes(term);
            const matchCategory = storeCategory === 'All' || item.category === storeCategory;
            
            return matchSearch && matchCategory;
        });
    }, [inventory, storeSearch, storeCategory]);

    // 🔥 AUTO-RESET PAGINATION FOR STORE GRID
    useEffect(() => {
        setStorePage(1);
    }, [storeSearch, storeCategory]);

    // Pagination Calculations (Main Orders)
    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, filterType, timeFilter, filterPayment]);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

    // 3. HANDLERS
    const handleServiceChange = (e) => {
        const service = e.target.value;
        const match = dbServices.find(p => p.service === service && (p.model === repairInput.deviceModel || repairInput.deviceModel?.includes(p.model)));
        setServiceInput({ ...serviceInput, type: service, cost: match ? match.price : '' });
    };

    const handleTabSwitch = (tab) => { setActiveTab(tab); setReturnOrder(null); setWarrantyTicketSearch(''); setSelectedReturnItems([]); };
    const fillWalkIn = () => setCustomer({ name: 'Walk-in Guest', phone: '', email: '' });
    
    const handleCustomerNameChange = (val) => {
        setCustomer({ ...customer, name: val });
        const match = savedCustomers.find(c => c.name.toLowerCase() === val.toLowerCase());
        if (match) {
            setCustomer({ name: match.name, phone: match.phone || '', email: match.email || '' });
        }
    };

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
        try {
            await runTransaction(db, async (t) => {
                if (!editOrderId) {
                    const productUpdates = [];
                    for (const item of cart) { if (item.type === 'product') { const ref = doc(db, "Inventory", item.productId); productUpdates.push({ ref, item }); } }
                    const snaps = await Promise.all(productUpdates.map(p => t.get(p.ref)));
                    snaps.forEach((snap, idx) => { 
                        if (!snap.exists() || snap.data().stock < productUpdates[idx].item.qty) throw `Stock Error: ${productUpdates[idx].item.name}`; 
                        t.update(productUpdates[idx].ref, { stock: snap.data().stock - productUpdates[idx].item.qty }); 
                    });
                }

                const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
                const discountAmount = Number(discount) || 0;
                const totalCost = Math.max(0, subtotal - discountAmount);
                const orderType = cart.some(i => i.type === 'repair') ? 'repair' : 'store_sale';

                // PRESERVE COLLECTED STATUS ON EDIT
                const processedItems = cart.map(item => ({
                    ...item,
                    collected: item.collected || false 
                }));

                if (editOrderId) {
                    const ref = doc(db, "Orders", editOrderId);
                    const oldDoc = (await t.get(ref)).data();
                    const paid = oldDoc.amountPaid || 0;
                    t.update(ref, {
                        customer, 
                        items: processedItems, 
                        subtotal, discount: discountAmount, totalCost,
                        balance: totalCost - paid,
                        paymentStatus: paid >= totalCost ? 'Paid' : (paid > 0 ? 'Part Payment' : 'Unpaid'),
                        paid: paid >= totalCost,
                        lastUpdated: serverTimestamp()
                    });
                    setToast({message: "Order Updated!", type: "success"});
                } else {
                    const ticketId = `FTW-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
                    const warrantyDate = new Date(); warrantyDate.setDate(warrantyDate.getDate() + 7);
                    const newOrderRef = doc(collection(db, "Orders"));
                    t.set(newOrderRef, { 
                        ticketId, customer, orderType, 
                        items: processedItems, // Save new items
                        subtotal, discount: discountAmount, totalCost,
                        amountPaid: 0, balance: totalCost, paymentStatus: 'Unpaid', paymentMethod: null, paid: false, 
                        status: orderType === 'repair' ? 'Pending' : 'Completed', createdAt: serverTimestamp(), warrantyExpiry: Timestamp.fromDate(warrantyDate) 
                    });
                    setToast({message: `Order ${ticketId} Created!`, type: "success"});
                }
            });
            setShowPOS(false); setCart([]); setCustomer({ name: '', phone: '', email: '' }); setDiscount(0); setEditOrderId(null);
            if (editOrderId) navigate(`/admin/orders/${orders.find(o=>o.id===editOrderId)?.ticketId || ''}`);
        } catch (e) { setToast({message: `Error: ${e}`, type: "error"}); } finally { setIsSubmitting(false); }
    };

    const handleDeleteOrder = (order) => {
        if (role === 'secretary') { setRequestModal({ isOpen: true, order }); return; }
        setConfirmConfig({
            isOpen: true, title: "Delete Order?", message: `Delete Ticket ${order.ticketId}? Cannot be undone.`, confirmText: "Delete Forever", confirmColor: "bg-red-600",
            action: async () => {
                await deleteDoc(doc(db, "Orders", order.id));
                setToast({ message: "Deleted", type: "success" });
                setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        await addDoc(collection(db, "DeletionRequests"), { orderId: requestModal.order.id, ticketId: requestModal.order.ticketId, customer: requestModal.order.customer?.name, reason: deleteReason, requestedBy: user?.name || "Secretary", requestedAt: serverTimestamp(), status: 'pending' });
        setToast({ message: "Request Sent", type: "success" });
        setRequestModal({ isOpen: false, order: null }); setDeleteReason(''); setIsSubmitting(false);
    };

    const handleSearchReturnTicket = async () => {
        if (!warrantyTicketSearch) return setToast({message: "Enter Ticket ID", type: "error"});
        setIsSubmitting(true);
        try {
            const q = query(collection(db, "Orders"), where("ticketId", "==", warrantyTicketSearch.trim()));
            const snap = await getDocs(q);
            if (snap.empty) {
                setToast({message: "Ticket not found", type: "error"});
                setReturnOrder(null);
            } else {
                setReturnOrder({ id: snap.docs[0].id, ...snap.docs[0].data() });
                setToast({message: "Ticket Found", type: "success"});
            }
        } catch (e) { console.error(e); setToast({message: "Search failed", type: "error"}); }
        setIsSubmitting(false);
    };

    const toggleReturnItem = (iIdx, sIdx) => {
        const key = sIdx !== undefined ? `${iIdx}-${sIdx}` : `${iIdx}-product`;
        setSelectedReturnItems(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const handleSubmitReturn = async () => {
        if (!returnOrder || selectedReturnItems.length === 0) return setToast({message: "Select items to return", type: "error"});
        setIsSubmitting(true);
        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "Orders", returnOrder.id);
                const data = (await t.get(ref)).data();
                const newItems = JSON.parse(JSON.stringify(data.items));
                let refundTotal = 0;

                selectedReturnItems.forEach(key => {
                    const [iIdxStr, sIdxStr] = key.split('-');
                    const iIdx = parseInt(iIdxStr);
                    if (sIdxStr === 'product') {
                        if (!newItems[iIdx].returned) {
                            newItems[iIdx].returned = true;
                            refundTotal += Number(newItems[iIdx].total || newItems[iIdx].cost || 0);
                        }
                    } else {
                        const sIdx = parseInt(sIdxStr);
                        if (newItems[iIdx].services && newItems[iIdx].services[sIdx] && !newItems[iIdx].services[sIdx].returned) {
                            newItems[iIdx].services[sIdx].returned = true;
                            newItems[iIdx].services[sIdx].status = 'Void';
                            refundTotal += Number(newItems[iIdx].services[sIdx].cost || 0);
                        }
                    }
                });

                const returnId = `FTW-RET-${Date.now().toString().slice(-6)}`;
                const newReturnRef = doc(collection(db, "Orders"));
                t.set(newReturnRef, { ticketId: returnId, originalTicketId: returnOrder.ticketId, customer: returnOrder.customer, orderType: 'return', items: selectedReturnItems.map(k => ({ key: k, note: "Returned Item" })), totalCost: -refundTotal, status: 'Completed', createdAt: serverTimestamp() });
                t.update(ref, { items: newItems, lastUpdated: serverTimestamp() });
            });
            setToast({message: "Return Processed!", type: "success"});
            setReturnOrder(null); setSelectedReturnItems([]); setWarrantyTicketSearch('');
        } catch (e) { setToast({message: "Return Failed", type: "error"}); } finally { setIsSubmitting(false); }
    };

    const handleExport = () => {
        const data = filteredOrders.map(o => ({ "Ticket": o.ticketId, "Customer": o.customer?.name, "Total": o.totalCost, "Date": new Date(o.createdAt?.seconds*1000).toLocaleDateString() }));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Orders"); XLSX.writeFile(wb, "Orders.xlsx");
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 lg:p-10 font-sans text-slate-900">
             <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />
             <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={() => confirmConfig.action && confirmConfig.action(true)} />

             {/* HEADER */}
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-100 transition text-slate-600"><ArrowLeft size={20}/></button>
                    <div><h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">Order Management</h1><p className="text-sm text-slate-500 font-medium">Manage repairs, sales, and warranties.</p></div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => navigate('/admin/customers')} className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-100 transition text-sm shadow-sm"><Users size={16} /> Customers</button>
                    <button onClick={handleExport} className="flex items-center gap-2 bg-white border border-gray-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition text-sm shadow-sm"><Download size={16} /> Export</button>
                    {(role === 'admin' || role === 'secretary') && <button onClick={() => { setEditOrderId(null); setShowPOS(true); }} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md shadow-purple-200 flex gap-2 items-center justify-center transition"><PlusCircle size={18}/> New Order</button>}
                </div>
            </div>

            {/* CONTROL BAR */}
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 mb-6 flex flex-col lg:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                    <input 
                        className="w-full pl-10 pr-4 py-3 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400" 
                        placeholder="Search Ticket ID (e.g. FTW-2024...) or Type 3+ chars" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto p-1 lg:p-0">
                    
                    {/* TIME FILTER */}
                    <div className="relative min-w-[120px]">
                        <Calendar className="absolute left-3 top-3.5 text-gray-400" size={16}/>
                        <select className="w-full pl-9 pr-8 py-3 bg-gray-50 rounded-xl border-none outline-none text-sm font-bold text-slate-600 cursor-pointer appearance-none" value={timeFilter} onChange={e => { setTimeFilter(e.target.value); setCurrentPage(1); }}>
                            <option value="day">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="all">All Time</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={14}/>
                    </div>

                    {/* PAYMENT FILTER */}
                    <div className="relative min-w-[140px]">
                        <DollarSign className="absolute left-3 top-3.5 text-gray-400" size={16}/>
                        <select className="w-full pl-9 pr-8 py-3 bg-gray-50 rounded-xl border-none outline-none text-sm font-bold text-slate-600 cursor-pointer appearance-none" value={filterPayment} onChange={e => { setFilterPayment(e.target.value); setCurrentPage(1); }}>
                            <option value="All">All Payments</option>
                            <option value="Paid">Paid</option>
                            <option value="Unpaid">Unpaid</option>
                            <option value="Part Payment">Part Payment</option>
                            <option value="Refunded">Refunded</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={14}/>
                    </div>

                    {/* TYPE FILTER */}
                    <div className="relative min-w-[140px]">
                        <Filter className="absolute left-3 top-3.5 text-gray-400" size={16}/>
                        <select className="w-full pl-9 pr-8 py-3 bg-gray-50 rounded-xl border-none outline-none text-sm font-bold text-slate-600 cursor-pointer appearance-none" value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}>
                            <option value="All">All Types</option>
                            <option value="Repair">Repairs</option>
                            <option value="Sale">Sales</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={14}/>
                    </div>
                </div>
            </div>

            {/* DATA GRID */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Ticket</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Customer</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Total</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Payment</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {currentOrders.map(order => (
                                <tr key={order.id} className="hover:bg-purple-50/50 cursor-pointer transition group" onClick={() => navigate(`/admin/orders/${order.ticketId}`)}>
                                    <td className="px-6 py-4"><div className="font-mono font-bold text-slate-800">{order.ticketId}</div><div className="text-xs text-slate-400 mt-0.5">{new Date(order.createdAt?.seconds*1000).toLocaleDateString()}</div></td>
                                    <td className="px-6 py-4"><div className="font-bold text-slate-700">{order.customer?.name}</div></td>
                                    <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 capitalize">{getOrderType(order)}</span></td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">{formatCurrency(order.totalCost)}</td>
                                    <td className="px-6 py-4 text-center"><StatusBadge status={order.status} /></td>
                                    <td className="px-6 py-4 text-center"><PaymentBadge status={order.paymentStatus || (order.paid ? 'Paid' : 'Unpaid')} /></td>
                                </tr>
                           ))}
                           {currentOrders.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-400 italic">No orders found for this period.</td></tr>}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                {filteredOrders.length > itemsPerPage && (
                    <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">Page {currentPage} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-white border rounded-lg disabled:opacity-50 hover:bg-gray-100"><ChevronLeft size={16}/></button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-white border rounded-lg disabled:opacity-50 hover:bg-gray-100"><ChevronRight size={16}/></button>
                        </div>
                    </div>
                )}
            </div>

            {/* Request Deletion Modal */}
            {requestModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/80 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="text-orange-500"/> Request Deletion</h3><button onClick={() => setRequestModal({ isOpen: false, order: null })}><X size={20} className="text-slate-400"/></button></div>
                        <p className="text-sm text-slate-500 mb-4">State reason for deleting ticket <b>{requestModal.order?.ticketId}</b>:</p>
                        <form onSubmit={handleSubmitRequest}>
                            <textarea className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm mb-4" rows="3" placeholder="Reason..." value={deleteReason} onChange={e => setDeleteReason(e.target.value)} required autoFocus />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setRequestModal({ isOpen: false, order: null })} className="flex-1 py-3 text-slate-500 font-bold bg-gray-100 rounded-xl">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>} Send</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* POS MODAL */}
            {showPOS && (
                <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-[1400px] h-[100dvh] sm:h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col lg:flex-row overflow-hidden relative">
                        {/* LEFT: INPUTS */}
                        <div className={`w-full lg:w-[65%] flex flex-col bg-gray-50 h-full ${mobilePosTab === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
                             <div className="bg-white px-4 sm:px-6 py-3 border-b border-gray-200 flex justify-between items-center shadow-sm z-10 shrink-0">
                                <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">{editOrderId ? 'Edit Order' : 'New Order'}</h2>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    {['repair', 'store', 'warranty'].map(tab => (
                                        <button key={tab} onClick={() => handleTabSwitch(tab)} className={`px-4 sm:px-6 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-bold capitalize transition ${activeTab === tab ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>{tab === 'warranty' ? 'Returns' : tab}</button>
                                    ))}
                                </div>
                                <button onClick={()=>setShowPOS(false)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition"><X size={20}/></button>
                            </div>

                            <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar pb-24 lg:pb-6">
                                {/* CUSTOMER FORM (Auto-Suggest) */}
                                {activeTab !== 'warranty' && (
                                    <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm mb-6">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Customer Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="relative">
                                                <User size={18} className="absolute left-3 top-3 text-slate-400"/>
                                                <input list="customers" placeholder="Full Name (Auto-fill)" className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium" value={customer.name} onChange={e=>handleCustomerNameChange(e.target.value)}/>
                                                <datalist id="customers">{savedCustomers.map(c=><option key={c.id} value={c.name}/>)}</datalist>
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
                                {/* STORE GRID */}
                                {activeTab === 'store' && (
                                    <>
                                        {/* Store Filters */}
                                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                                                <input 
                                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-purple-500 text-sm" 
                                                    placeholder="Search item..." 
                                                    value={storeSearch} 
                                                    onChange={e => setStoreSearch(e.target.value)} 
                                                />
                                            </div>
                                            <div className="relative min-w-[150px]">
                                                <select className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none text-sm font-bold text-slate-700 appearance-none" value={storeCategory} onChange={e => setStoreCategory(e.target.value)}>
                                                    <option value="All">All Categories</option>
                                                    {storeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                                <Filter className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={16}/>
                                            </div>
                                        </div>

                                        {/* Store Items */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
                                            {filteredInventory.slice((storePage-1)*itemsPerStorePage, storePage*itemsPerStorePage).map(p => (
                                                <button key={p.id} onClick={() => handleGridAddToCart(p)} disabled={p.stock < 1} className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl text-left h-32 flex flex-col justify-between hover:border-purple-500 hover:shadow-md transition group disabled:opacity-50 disabled:bg-gray-100">
                                                    <span className="font-bold text-xs sm:text-sm text-slate-700 line-clamp-2 group-hover:text-purple-700 transition">{p.name}</span>
                                                    <div className="flex justify-between items-end w-full">
                                                        <span className="text-slate-900 font-black text-base sm:text-lg">{formatCurrency(p.price)}</span>
                                                        <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded ${p.stock < 3 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{p.stock} left</span>
                                                    </div>
                                                </button>
                                            ))}
                                            {filteredInventory.length === 0 && (
                                                <div className="col-span-full py-10 text-center text-slate-400">
                                                    <ShoppingBag size={48} className="mx-auto mb-2 opacity-20"/>
                                                    <p className="font-medium">No items found.</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Store Pagination */}
                                        {filteredInventory.length > itemsPerStorePage && (
                                            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 mb-20">
                                                <button onClick={() => setStorePage(p => Math.max(1, p - 1))} disabled={storePage === 1} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"><ChevronLeft size={20}/></button>
                                                <span className="text-xs font-bold text-slate-500">Page {storePage} of {Math.ceil(filteredInventory.length / itemsPerStorePage)}</span>
                                                <button onClick={() => setStorePage(p => Math.min(Math.ceil(filteredInventory.length / itemsPerStorePage), p + 1))} disabled={storePage === Math.ceil(filteredInventory.length / itemsPerStorePage)} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"><ChevronRight size={20}/></button>
                                            </div>
                                        )}
                                    </>
                                )}
                                {/* REPAIR INPUTS */}
                                {activeTab === 'repair' && (
                                    <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
                                        <input list="models" placeholder="Device Model" className="w-full p-3 border rounded-lg font-bold" value={repairInput.deviceModel} onChange={e=>setRepairInput({...repairInput, deviceModel:e.target.value})}/>
                                        <datalist id="models">{Array.from(new Set(dbServices.map(s => s.model))).sort().map(m=><option key={m} value={m}/>)}</datalist>
                                        <div className="grid grid-cols-2 gap-4">
                                            <input placeholder="IMEI" className="p-3 border rounded-lg" value={repairInput.imei} onChange={e=>setRepairInput({...repairInput, imei:e.target.value})}/>
                                            <input placeholder="Passcode" className="p-3 border rounded-lg bg-yellow-50" value={repairInput.passcode} onChange={e=>setRepairInput({...repairInput, passcode:e.target.value})}/>
                                        </div>
                                        <input placeholder="Condition" className="w-full p-3 border rounded-lg" value={repairInput.condition} onChange={e=>setRepairInput({...repairInput, condition:e.target.value})}/>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                                            <div className="flex flex-col md:flex-row gap-3 mb-3">
                                                <select className="flex-1 p-3 border rounded-lg text-sm bg-white" value={serviceInput.type} onChange={handleServiceChange}>
                                                    <option value="">Select Service...</option>
                                                    {Array.from(new Set(dbServices.map(s => s.service))).sort().map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <div className="flex gap-2">
                                                    <input type="number" placeholder="Cost" className="w-24 sm:w-32 p-3 border rounded-lg text-sm font-mono" value={serviceInput.cost} onChange={e=>setServiceInput({...serviceInput, cost:e.target.value})}/>
                                                    <button onClick={addServiceToDevice} className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition">Add</button>
                                                </div>
                                            </div>
                                            {currentDeviceServices.map(s=>(<div key={s.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm"><span className="font-medium text-slate-700">{s.service}</span><div className="flex items-center gap-4"><span className="font-mono font-bold text-slate-900">{formatCurrency(s.cost)}</span><button onClick={() => setCurrentDeviceServices(currentDeviceServices.filter(x => x.id !== s.id))} className="text-red-400 hover:text-red-600"><MinusCircle size={16}/></button></div></div>))}
                                        </div>
                                        <button onClick={addDeviceToCart} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-black transition flex justify-center gap-2 items-center"><PlusCircle size={20}/> Add Device</button>
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
                                 {cart.map(item => (
                                     <div key={item.id} className="group bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm relative">
                                         <button onClick={() => removeFromCart(item.id)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition bg-gray-50 p-1.5 rounded-full"><Trash2 size={16}/></button>
                                         <div className="font-bold text-slate-800 pr-8 text-sm sm:text-base">{item.name || item.deviceModel}</div>
                                         <div className="flex justify-between items-end mt-4">
                                            {item.type === 'product' && <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-3"><button onClick={() => updateCartQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm"><Minus size={14}/></button><span className="text-sm font-bold w-4 text-center">{item.qty}</span><button onClick={() => updateCartQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm"><Plus size={14}/></button></div>}
                                            <div className="text-right font-mono font-bold text-lg text-purple-700 ml-auto">{formatCurrency(item.total)}</div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                             <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 shrink-0 mb-16 lg:mb-0">
                                 <div className="flex justify-between text-2xl font-black text-slate-900 mb-6"><span>Total</span><span>{formatCurrency(Math.max(0, cart.reduce((a,b)=>a+b.total,0) - discount))}</span></div>
                                 <button onClick={handleCheckout} disabled={isSubmitting || cart.length === 0} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-black transition flex justify-center items-center gap-2">
                                     {editOrderId ? 'Update Order' : 'Create Ticket'} <ArrowRight size={18}/>
                                 </button>
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrdersManagement;