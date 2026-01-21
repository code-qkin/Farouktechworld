import React, { useState, useEffect, useMemo } from 'react';
import { 
    ClipboardList, Search, PlusCircle, Trash2, User, Phone, X, 
    ShoppingBag, Download, ArrowLeft, ShoppingCart, 
    Filter, ChevronDown, CheckCircle, AlertCircle, Wrench, ArrowRight,
    ChevronLeft, ChevronRight, Plus, Minus, AlertTriangle, Send,
    Loader2, Calendar, DollarSign, Activity, Clock, Layers, Palette
} from 'lucide-react';
import { useAuth } from '../AdminContext.jsx'; 
import { db } from '../../firebaseConfig.js';
import { useNavigate, useLocation } from 'react-router-dom'; 
import { 
    collection, doc, onSnapshot, query, orderBy, getDocs, 
    serverTimestamp, runTransaction, Timestamp, addDoc, updateDoc, deleteDoc, 
    limit, where, increment 
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Toast, ConfirmModal } from '../Components/Feedback.jsx';

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

// --- COMPONENTS ---

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
        <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
            {status}
        </span>
    );
};

const PaymentBadge = ({ status }) => {
    const styles = {
        'Paid': 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-100',
        'Part Payment': 'bg-orange-50 text-orange-700 border-orange-200 ring-1 ring-orange-100',
        'Unpaid': 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-100',
        'Refunded': 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-100',
        'Voided': 'bg-gray-100 text-gray-500 border-gray-200'
    };
    return (
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border w-fit ${styles[status] || 'bg-gray-50'}`}>
            {status === 'Paid' && <CheckCircle size={10} />}
            {status === 'Unpaid' && <AlertCircle size={10} />}
            {status || 'Unpaid'}
        </span>
    );
};

const QuickStat = ({ label, value, icon: Icon, color }) => (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 min-w-[200px] flex-1">
        <div className={`p-3 rounded-xl ${color}`}>
            <Icon size={20} />
        </div>
        <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="text-xl font-black text-slate-800">{value}</p>
        </div>
    </div>
);

// 🔥 STATE PERSISTENCE HELPER
const getSavedState = (key, fallback) => {
    try {
        const saved = sessionStorage.getItem('order_man_state');
        if (!saved) return fallback;
        const parsed = JSON.parse(saved);
        return parsed[key] !== undefined ? parsed[key] : fallback;
    } catch { return fallback; }
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
    
    // 🔥 INITIALIZE STATE FROM SESSION STORAGE
    const [searchTerm, setSearchTerm] = useState(() => getSavedState('searchTerm', ''));
    const [timeFilter, setTimeFilter] = useState(() => getSavedState('timeFilter', 'day')); 
    const [customStart, setCustomStart] = useState(() => getSavedState('customStart', ''));
    const [customEnd, setCustomEnd] = useState(() => getSavedState('customEnd', ''));
    const [filterStatus, setFilterStatus] = useState(() => getSavedState('filterStatus', 'All'));
    const [filterType, setFilterType] = useState(() => getSavedState('filterType', 'All'));
    const [filterPayment, setFilterPayment] = useState(() => getSavedState('filterPayment', 'All')); 
    const [currentPage, setCurrentPage] = useState(() => getSavedState('currentPage', 1));

    // POS State (Persist store search/page too)
    const [storeSearch, setStoreSearch] = useState(() => getSavedState('storeSearch', ''));
    const [storeCategory, setStoreCategory] = useState(() => getSavedState('storeCategory', 'All'));
    const [storePage, setStorePage] = useState(() => getSavedState('storePage', 1));
    const itemsPerStorePage = 24;

    const itemsPerPage = 15; 
    
    // UI State
    const [showPOS, setShowPOS] = useState(false);
    const [activeTab, setActiveTab] = useState('repair'); 
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mobilePosTab, setMobilePosTab] = useState('input'); 

    // POS Data
    const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
    const [cart, setCart] = useState([]); 
    const [discount, setDiscount] = useState(0); 
    const [repairInput, setRepairInput] = useState({ deviceModel: '', deviceColor: '', imei: '', passcode: '', condition: '' });
    const [serviceInput, setServiceInput] = useState({ type: '', cost: '' });
    const [currentDeviceServices, setCurrentDeviceServices] = useState([]); 
    const [editOrderId, setEditOrderId] = useState(null);

    // Warranty/Return
    const [warrantyTicketSearch, setWarrantyTicketSearch] = useState('');
    const [returnOrder, setReturnOrder] = useState(null);
    const [selectedReturnItems, setSelectedReturnItems] = useState([]);

    // Modals
    const [requestModal, setRequestModal] = useState({ isOpen: false, order: null });
    const [deleteReason, setDeleteReason] = useState('');

    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

    // PERMISSION CHECK
    const isManager = role === 'manager';

    // 🔥 SAVE STATE ON CHANGE
    useEffect(() => {
        const stateToSave = {
            searchTerm, timeFilter, customStart, customEnd, 
            filterStatus, filterType, filterPayment, currentPage,
            storeSearch, storeCategory, storePage
        };
        sessionStorage.setItem('order_man_state', JSON.stringify(stateToSave));
    }, [searchTerm, timeFilter, customStart, customEnd, filterStatus, filterType, filterPayment, currentPage, storeSearch, storeCategory, storePage]);

    // --- DATA LOGIC ---
    
    const dynamicCategories = useMemo(() => {
        const cats = new Set(inventory.map(i => i.category).filter(Boolean));
        return ['All', ...Array.from(cats).sort()];
    }, [inventory]);

    useEffect(() => {
        setLoading(true);
        let unsubOrders = () => {}; 

        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        let endDate = null;

        if (timeFilter === 'week') startDate.setDate(startDate.getDate() - startDate.getDay());
        else if (timeFilter === 'month') startDate.setDate(1);
        else if (timeFilter === 'all') startDate = null;
        else if (timeFilter === 'custom') {
            if (customStart) {
                startDate = new Date(customStart);
                startDate.setHours(0,0,0,0);
            }
            if (customEnd) {
                endDate = new Date(customEnd);
                endDate.setHours(23,59,59,999);
            }
        }

        if (searchTerm.length >= 3) {
            const term = searchTerm.trim();
            const fetchSearch = async () => {
                const qTicket = query(collection(db, "Orders"), where("ticketId", ">=", term), where("ticketId", "<=", term + "\uf8ff"), limit(50));
                const qName = query(collection(db, "Orders"), where("customer.name", ">=", term), where("customer.name", "<=", term + "\uf8ff"), limit(50));
                const [ts, ns] = await Promise.all([getDocs(qTicket), getDocs(qName)]);
                const res = new Map();
                [...ts.docs, ...ns.docs].forEach(d => res.set(d.id, { id: d.id, ...d.data() }));
                setOrders(Array.from(res.values()));
                setLoading(false);
            };
            fetchSearch();
        } else {
            let q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
            
            if (startDate) {
                q = query(q, where("createdAt", ">=", startDate));
            }
            if (endDate) {
                q = query(q, where("createdAt", "<=", endDate));
            }
            
            unsubOrders = onSnapshot(q, (snap) => {
                setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setLoading(false);
            });
        }
        
        const unsubInv = onSnapshot(query(collection(db, "Inventory"), orderBy("name")), snap => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubCust = onSnapshot(query(collection(db, "Customers"), orderBy("name")), snap => setSavedCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        getDocs(collection(db, "Services")).then(snap => setDbServices(snap.docs.map(d => d.data())));

        return () => { unsubOrders(); unsubInv(); unsubCust(); };
    }, [timeFilter, searchTerm, customStart, customEnd]);

    useEffect(() => {
        if (location.state?.orderToEdit) {
            const o = location.state.orderToEdit;
            setEditOrderId(o.id);
            setCustomer(o.customer || { name: '', phone: '', email: '' });
            setCart(o.items || []);
            setDiscount(o.discount || 0);
            setShowPOS(true);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    // --- FILTERING & COMPUTED ---

    const getOrderType = (o) => {
        if (!o) return 'Store';
        if (o.orderType) return o.orderType;
        return o.items?.some(i => i.type === 'repair') ? 'repair' : 'store_sale';
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            const term = searchTerm.toLowerCase();
            const matchSearch = (o.ticketId || '').toLowerCase().includes(term) || (o.customer?.name || '').toLowerCase().includes(term);
            const matchStatus = filterStatus === 'All' || o.status === filterStatus;
            
            let matchType = true;
            const type = getOrderType(o);
            if (filterType === 'Repair') matchType = type === 'repair';
            if (filterType === 'Sale') matchType = type === 'store_sale';

            const currentPayment = o.paymentStatus || (o.paid ? 'Paid' : 'Unpaid');
            const matchPayment = filterPayment === 'All' || currentPayment === filterPayment;

            return matchSearch && matchStatus && matchType && matchPayment;
        });
    }, [orders, searchTerm, filterStatus, filterType, filterPayment]);

    const filteredInventory = useMemo(() => {
        return inventory.filter(i => {
            const term = storeSearch.toLowerCase();
            return (i.name.toLowerCase().includes(term) || i.model?.toLowerCase().includes(term)) &&
                   (storeCategory === 'All' || i.category === storeCategory);
        });
    }, [inventory, storeSearch, storeCategory]);

    // Summary Stats
    const stats = useMemo(() => {
        const totalRev = filteredOrders.reduce((acc, o) => acc + (o.amountPaid || 0), 0);
        const pending = filteredOrders.filter(o => o.status === 'Pending').length;
        return { total: filteredOrders.length, revenue: totalRev, pending };
    }, [filteredOrders]);

    // Pagination
    const currentOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
    }, [filteredOrders.length, totalPages, currentPage]);

    // Pagination (Store Inventory)
    const totalStorePages = Math.ceil(filteredInventory.length / itemsPerStorePage);

    // --- HANDLERS ---
    
    const handleOpenNewOrder = () => {
        setEditOrderId(null);
        setCustomer({ name: '', phone: '', email: '' });
        setCart([]);
        setDiscount(0);
        setRepairInput({ deviceModel: '', deviceColor: '', imei: '', passcode: '', condition: '' });
        setCurrentDeviceServices([]);
        setActiveTab('repair');
        setShowPOS(true);
    };

    const fillWalkIn = () => {
        setCustomer({ name: 'Walk-in Guest', phone: '', email: '' });
    };
    
    const handleCustomerNameChange = (val) => {
        setCustomer({ ...customer, name: val });
        const match = savedCustomers.find(c => c.name.toLowerCase() === val.toLowerCase());
        if (match) {
            setCustomer({ name: match.name, phone: match.phone || '', email: match.email || '' });
        }
    };
    
    const handleServiceChange = (e) => {
        const svc = e.target.value;
        const model = repairInput.deviceModel.trim().toLowerCase();
        const match = dbServices.find(p => p.service === svc && p.model.trim().toLowerCase() === model);
        setServiceInput({ type: svc, cost: match ? match.price : '' });
    };

    const handleTabSwitch = (tab) => { setActiveTab(tab); setReturnOrder(null); setWarrantyTicketSearch(''); setSelectedReturnItems([]); };

    const addServiceToDevice = () => {
        if (!serviceInput.type || !serviceInput.cost) return setToast({message: "Select service and cost.", type: "error"});
        setCurrentDeviceServices([...currentDeviceServices, { id: Date.now(), service: serviceInput.type, cost: Number(serviceInput.cost), worker: 'Unassigned', status: 'Pending' }]);
        setServiceInput({ type: '', cost: '' });
    };

    const addDeviceToCart = () => {
        if (!repairInput.deviceModel) return setToast({message: "Select Device Model.", type: "error"});
        if (currentDeviceServices.length === 0) return setToast({message: "Please add at least one service.", type: "error"});

        setCart([...cart, { type: 'repair', id: `rep-${Date.now()}`, ...repairInput, services: currentDeviceServices, qty: 1, total: currentDeviceServices.reduce((s, c) => s + c.cost, 0) }]);
        setRepairInput({ deviceModel: '', deviceColor: '', imei: '', passcode: '', condition: '' }); 
        setCurrentDeviceServices([]);
        if (window.innerWidth < 1024) setMobilePosTab('cart');
        setToast({message: "Device added", type: "success"});
    };

    // 🔥 FIXED: MERGE ITEMS IN CART
    const handleGridAddToCart = (p) => {
        if (p.stock < 1) return setToast({message: "Out of Stock!", type: "error"});
        
        setCart(prevCart => {
            // Check if item exists in cart
            const existingIndex = prevCart.findIndex(item => item.productId === p.id && item.type === 'product');
            
            if (existingIndex >= 0) {
                // Check if adding 1 exceeds stock
                if (prevCart[existingIndex].qty + 1 > p.stock) {
                    setToast({message: "Stock limit reached!", type: "error"});
                    return prevCart;
                }

                // MERGE: Update Quantity
                const newCart = [...prevCart];
                const item = newCart[existingIndex];
                newCart[existingIndex] = {
                    ...item,
                    qty: item.qty + 1,
                    total: (item.qty + 1) * item.price
                };
                setToast({message: `Updated to x${item.qty + 1}`, type: "success"});
                return newCart;
            } else {
                // Add New Item
                setToast({message: "Added to cart", type: "success"});
                return [...prevCart, { 
                    type: 'product', 
                    id: `prod-${Date.now()}`, 
                    productId: p.id, 
                    name: p.name, 
                    price: p.price, 
                    qty: 1, 
                    total: p.price 
                }];
            }
        });
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

    const handleEditCartItem = (item) => {
        if (item.type === 'repair') {
            setRepairInput({
                deviceModel: item.deviceModel || '',
                deviceColor: item.deviceColor || '',
                imei: item.imei || '',
                passcode: item.passcode || '',
                condition: item.condition || ''
            });
            setCurrentDeviceServices(item.services || []);
            setActiveTab('repair');
        } else {
            setActiveTab('store');
        }
        setCart(prev => prev.filter(i => i.id !== item.id));
        setMobilePosTab('input');
        setToast({ message: "Item loaded for editing", type: "info" });
    };

    // GENERATE UNIQUE TICKET ID
    const generateTicketId = () => {
        const now = new Date();
        const datePart = now.toISOString().slice(2, 10).replace(/-/g, ''); 
        const timePart = now.toTimeString().slice(0, 8).replace(/:/g, ''); 
        const randomPart = Math.floor(100 + Math.random() * 900); 
        return `FTW-${datePart}-${timePart}${randomPart}`;
    };

    const handleCheckout = async () => {
        if (isSubmitting || !customer.name || cart.length === 0) return setToast({message: "Details missing!", type: "error"});
        setIsSubmitting(true);
        try {
            await runTransaction(db, async (t) => {
                let oldOrderData = null;
                const inventoryChanges = new Map();

                if (editOrderId) {
                    const oldRef = doc(db, "Orders", editOrderId);
                    const oldSnap = await t.get(oldRef);
                    if (!oldSnap.exists()) throw "Order not found";
                    oldOrderData = oldSnap.data();

                    if (oldOrderData.items) {
                        oldOrderData.items.forEach(item => {
                            if (item.type === 'product' && item.productId) {
                                const current = inventoryChanges.get(item.productId) || 0;
                                inventoryChanges.set(item.productId, current + (Number(item.qty) || 1));
                            }
                        });
                    }
                }

                cart.forEach(item => {
                    if (item.type === 'product' && item.productId) {
                        const current = inventoryChanges.get(item.productId) || 0;
                        inventoryChanges.set(item.productId, current - (Number(item.qty) || 1));
                    }
                });

                const productIds = Array.from(inventoryChanges.keys());
                for (const pid of productIds) {
                    const change = inventoryChanges.get(pid);
                    if (change < 0) {
                        const invRef = doc(db, "Inventory", pid);
                        const invSnap = await t.get(invRef);
                        if (!invSnap.exists()) throw `Product ${pid} not found`;
                        
                        const currentStock = invSnap.data().stock || 0;
                        if (currentStock + change < 0) {
                            throw `Insufficient stock for ${invSnap.data().name}. Available: ${currentStock}, Need: ${Math.abs(change)}`;
                        }
                    }
                }

                for (const pid of productIds) {
                    const change = inventoryChanges.get(pid);
                    if (change !== 0) {
                        t.update(doc(db, "Inventory", pid), { stock: increment(change) });
                    }
                }

                const subtotal = cart.reduce((s, i) => s + (i.total || 0), 0);
                const totalCost = Math.max(0, subtotal - (Number(discount) || 0));
                
                const orderData = { 
                    customer, items: cart.map(i => ({...i, collected: i.collected || false})), 
                    subtotal, discount: Number(discount), totalCost, 
                    lastUpdated: serverTimestamp() 
                };

                if (editOrderId) {
                    let finalItems = orderData.items;
                    if (oldOrderData && oldOrderData.items) {
                        const hiddenItems = oldOrderData.items.filter(i => i.type !== 'product' && i.type !== 'repair');
                        finalItems = [...finalItems, ...hiddenItems];
                    }

                    const oldPaid = oldOrderData.amountPaid || 0;
                    const balance = totalCost - oldPaid;
                    t.update(doc(db, "Orders", editOrderId), { 
                        ...orderData, 
                        items: finalItems,
                        balance, 
                        paymentStatus: balance <= 0 ? 'Paid' : (oldPaid > 0 ? 'Part Payment' : 'Unpaid'), 
                        paid: balance <= 0 
                    });
                } else {
                    const ticketId = generateTicketId();
                    const newRef = doc(collection(db, "Orders"));
                    t.set(newRef, { 
                        ticketId, ...orderData, amountPaid: 0, balance: totalCost, 
                        paymentStatus: 'Unpaid', status: cart.some(i=>i.type==='repair') ? 'Pending' : 'Completed', 
                        createdAt: serverTimestamp(), orderType: cart.some(i=>i.type==='repair') ? 'repair' : 'store_sale',
                        warrantyExpiry: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
                    });
                }
            });

            setToast({message: editOrderId ? "Order Updated" : "Order Created!", type: "success"});
            setShowPOS(false); setCart([]); setCustomer({ name: '', phone: '', email: '' }); setDiscount(0); setEditOrderId(null);
        } catch (e) { 
            console.error("Transaction Error:", e);
            setToast({message: typeof e === 'string' ? e : "Transaction Failed.", type: "error"}); 
        } 
        finally { setIsSubmitting(false); }
    };

    const handleSearchReturnTicket = async () => {
        if (!warrantyTicketSearch) return;
        const q = query(collection(db, "Orders"), where("ticketId", "==", warrantyTicketSearch.trim()));
        const snap = await getDocs(q);
        if (snap.empty) setToast({message: "Not Found", type: "error"});
        else setReturnOrder({ id: snap.docs[0].id, ...snap.docs[0].data() });
    };

    const handleSubmitReturn = async () => {
        if (!returnOrder || selectedReturnItems.length === 0) return;
        setIsSubmitting(true);
        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "Orders", returnOrder.id);
                const data = (await t.get(ref)).data();
                const newItems = JSON.parse(JSON.stringify(data.items));
                let refund = 0;

                selectedReturnItems.forEach(key => {
                    const [i, s] = key.split('-');
                    const idx = parseInt(i);
                    if (s === 'product') {
                        if (!newItems[idx].returned) {
                            newItems[idx].returned = true;
                            refund += Number(newItems[idx].total || 0);
                            if (newItems[idx].productId) t.update(doc(db, "Inventory", newItems[idx].productId), { stock: increment(newItems[idx].qty) });
                        }
                    } else {
                        const sIdx = parseInt(s);
                        if (!newItems[idx].services[sIdx].returned) {
                            newItems[idx].services[sIdx].returned = true;
                            newItems[idx].services[sIdx].status = 'Void';
                            refund += Number(newItems[idx].services[sIdx].cost || 0);
                        }
                    }
                });
                
                const retId = `FTW-RET-${Date.now().toString().slice(-6)}`;
                t.set(doc(collection(db, "Orders")), { ticketId: retId, originalTicketId: returnOrder.ticketId, customer: returnOrder.customer, orderType: 'return', items: selectedReturnItems.map(k => ({ key: k, note: "Returned" })), totalCost: -refund, status: 'Completed', createdAt: serverTimestamp() });
                t.update(ref, { items: newItems, lastUpdated: serverTimestamp() });
            });
            setToast({message: "Return Processed", type: "success"});
            setReturnOrder(null); setSelectedReturnItems([]);
        } catch (e) { setToast({message: "Failed", type: "error"}); }
        setIsSubmitting(false);
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

    const toggleReturnItem = (iIdx, sIdx) => {
        const key = sIdx !== undefined ? `${iIdx}-${sIdx}` : `${iIdx}-product`;
        setSelectedReturnItems(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const handleExport = () => {
        const data = filteredOrders.map(o => ({ "Ticket": o.ticketId, "Customer": o.customer?.name, "Total": o.totalCost, "Date": new Date(o.createdAt?.seconds*1000).toLocaleDateString() }));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Orders"); XLSX.writeFile(wb, "Orders.xlsx");
    };

    const canAdd = ['admin', 'secretary', 'ceo', 'manager'].includes(role);

    return (
        <div className="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans text-slate-800">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />
            <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={() => confirmConfig.action && confirmConfig.action(true)} />

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div className="flex items-center gap-3">
                    {/* 🔥 ADDED BACK BUTTON */}
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-100 transition text-slate-600">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><ClipboardList className="text-purple-600"/> Order Management</h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">Track repairs, sales, and warranties in one place.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExport} className="bg-white border border-gray-200 text-slate-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-50 flex items-center gap-2 shadow-sm"><Download size={16}/> Export</button>
                    {canAdd && <button onClick={handleOpenNewOrder} className="bg-slate-900 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-slate-800 flex items-center gap-2 shadow-lg shadow-slate-200"><PlusCircle size={18}/> New Order</button>}
                </div>
            </div>

            {/* QUICK STATS - 🔥 REVENUE REMOVED FOR MANAGER */}
            <div className="flex flex-wrap gap-4 mb-8">
                <QuickStat label="Orders Found" value={stats.total} icon={Layers} color="bg-blue-50 text-blue-600"/>
                <QuickStat label="Pending Jobs" value={stats.pending} icon={Clock} color="bg-orange-50 text-orange-600"/>
                {!isManager && <QuickStat label="View Revenue" value={formatCurrency(stats.revenue)} icon={DollarSign} color="bg-green-50 text-green-600"/>}
            </div>

            {/* FILTERS & TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Controls */}
                <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row gap-4 bg-gray-50/50">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                        <input className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition" placeholder="Search ticket, name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar items-center">
                        
                        {/* SMART CALENDAR FILTER */}
                        <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1 rounded-xl">
                            <select className="bg-transparent font-bold text-sm text-slate-600 outline-none cursor-pointer py-1.5" value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
                                <option value="day">Today</option>
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                                <option value="custom">Custom Range</option>
                                <option value="all">All Time</option>
                            </select>
                            {timeFilter === 'custom' && (
                                <div className="flex items-center gap-2 ml-2 animate-in fade-in slide-in-from-left-4">
                                    <input type="date" className="text-xs border rounded p-1" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                                    <span className="text-slate-400">-</span>
                                    <input type="date" className="text-xs border rounded p-1" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                                </div>
                            )}
                        </div>

                        <select className="bg-white border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 outline-none cursor-pointer hover:bg-gray-50" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="All">All Statuses</option>
                            {['Pending','In Progress','Ready for Pickup','Completed','Collected','Void'].map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                        <select className="bg-white border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 outline-none cursor-pointer hover:bg-gray-50" value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="All">All Types</option>
                            <option value="Repair">Repairs</option>
                            <option value="Sale">Sales</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-slate-400 font-bold uppercase text-xs border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Ticket Info</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Type</th>
                                {/* 🔥 HIDE TOTAL FOR MANAGER */}
                                {!isManager && <th className="px-6 py-4 text-right">Total</th>}
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-center">Payment</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {currentOrders.map(order => (
                                <tr key={order.id} className="hover:bg-slate-50 transition group cursor-pointer" onClick={() => navigate(`/admin/orders/${order.ticketId}`)}>
                                    <td className="px-6 py-4">
                                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded text-xs">{order.ticketId}</span>
                                        <div className="text-[10px] text-slate-400 mt-1 font-medium">{order.createdAt?.seconds ? new Date(order.createdAt.seconds*1000).toLocaleString() : 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-800">{order.customer?.name}</td>
                                    <td className="px-6 py-4"><span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${getOrderType(order)==='repair' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{getOrderType(order)}</span></td>
                                    {/* 🔥 HIDE TOTAL CELL FOR MANAGER */}
                                    {!isManager && <td className="px-6 py-4 text-right font-black text-slate-900">{formatCurrency(order.totalCost)}</td>}
                                    <td className="px-6 py-4 text-center"><StatusBadge status={order.status}/></td>
                                    <td className="px-6 py-4 flex justify-center"><PaymentBadge status={order.paymentStatus || (order.paid ? 'Paid' : 'Unpaid')}/></td>
                                    <td className="px-6 py-4 text-right"><button className="text-xs font-bold text-purple-600 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition">View</button></td>
                                </tr>
                            ))}
                            {currentOrders.length === 0 && <tr><td colSpan={isManager ? 6 : 7} className="p-12 text-center text-slate-400 font-medium">No orders found matching your filters.</td></tr>}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredOrders.length > itemsPerPage && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={16}/></button>
                        <span className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={16}/></button>
                    </div>
                )}
            </div>

            {/* --- POS MODAL (REDESIGNED) --- */}
            {showPOS && (
                <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-[1400px] h-[95vh] sm:h-[90vh] rounded-2xl shadow-2xl flex flex-col lg:flex-row overflow-hidden relative">
                        
                        {/* LEFT: SELECTION AREA */}
                        <div className={`w-full lg:w-[65%] flex flex-col bg-slate-50 h-full ${mobilePosTab === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
                             <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shadow-sm z-10 shrink-0">
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">{editOrderId ? 'Edit Order' : 'New Order'}</h2>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    {['repair', 'store', 'warranty'].map(tab => (
                                        <button key={tab} onClick={() => handleTabSwitch(tab)} className={`px-5 py-2 rounded-md text-xs font-bold capitalize transition ${activeTab === tab ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab === 'warranty' ? 'Returns' : tab}</button>
                                    ))}
                                </div>
                                <button onClick={()=>setShowPOS(false)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition"><X size={20}/></button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                                {/* CUSTOMER FORM */}
                                {activeTab !== 'warranty' && (
                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-6">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><User size={14}/> Customer Information</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="relative">
                                                <input list="customers" placeholder="Full Name (Auto-fill)" className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold" value={customer.name} onChange={e=>handleCustomerNameChange(e.target.value)}/>
                                                <datalist id="customers">{savedCustomers.map(c=><option key={c.id} value={c.name}/>)}</datalist>
                                            </div>
                                            <div className="flex gap-2">
                                                <input placeholder="Phone Number" className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium" value={customer.phone} onChange={e=>setCustomer({...customer, phone:e.target.value})}/>
                                                <button onClick={fillWalkIn} className="px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 text-xs whitespace-nowrap">Walk-In</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* DYNAMIC CONTENT BASED ON TAB */}
                                {activeTab === 'repair' && (
                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input list="models" placeholder="Device Model (e.g. iPhone 13)" className="w-full p-3 border rounded-xl font-bold bg-gray-50 focus:bg-white transition" value={repairInput.deviceModel} onChange={e=>setRepairInput({...repairInput, deviceModel:e.target.value})}/>
                                            <datalist id="models">{Array.from(new Set(dbServices.map(s => s.model))).sort().map(m=><option key={m} value={m}/>)}</datalist>
                                            
                                            {/* 🔥 ADDED COLOR INPUT */}
                                            <div className="relative">
                                                <Palette className="absolute left-3 top-3.5 text-gray-400" size={16}/>
                                                <input 
                                                    placeholder="Device Color (e.g. Blue)" 
                                                    className="w-full pl-10 pr-3 py-3 border rounded-xl bg-gray-50 focus:bg-white transition"
                                                    value={repairInput.deviceColor} 
                                                    onChange={e=>setRepairInput({...repairInput, deviceColor:e.target.value})}
                                                />
                                            </div>
                                            
                                            <input placeholder="IMEI / Serial" className="p-3 border rounded-xl bg-gray-50 focus:bg-white transition" value={repairInput.imei} onChange={e=>setRepairInput({...repairInput, imei:e.target.value})}/>
                                            <input placeholder="Passcode" className="p-3 border rounded-xl bg-yellow-50 focus:bg-white transition" value={repairInput.passcode} onChange={e=>setRepairInput({...repairInput, passcode:e.target.value})}/>
                                        </div>
                                        <textarea placeholder="Condition Notes (Scratches, Cracks...)" className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white transition resize-none h-20" value={repairInput.condition} onChange={e=>setRepairInput({...repairInput, condition:e.target.value})}/>
                                        
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Add Services</h4>
                                            <div className="flex flex-col md:flex-row gap-3 mb-3">
                                                <select className="flex-1 p-3 border rounded-xl text-sm bg-white font-medium" value={serviceInput.type} onChange={handleServiceChange}>
                                                    <option value="">Select Service...</option>
                                                    {Array.from(new Set(dbServices.map(s => s.service))).sort().map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <div className="flex gap-2">
                                                    <input type="number" placeholder="Cost" className="w-32 p-3 border rounded-xl text-sm font-mono font-bold" value={serviceInput.cost} onChange={e=>setServiceInput({...serviceInput, cost:e.target.value})}/>
                                                    <button onClick={addServiceToDevice} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-sm transition">Add</button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {currentDeviceServices.map(s=>(<div key={s.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm"><span className="font-bold text-slate-700">{s.service}</span><div className="flex items-center gap-4"><span className="font-mono font-bold text-slate-900">{formatCurrency(s.cost)}</span><button onClick={() => setCurrentDeviceServices(currentDeviceServices.filter(x => x.id !== s.id))} className="text-red-400 hover:text-red-600"><Minus size={16}/></button></div></div>))}
                                            </div>
                                        </div>
                                        {/* 🔥 VALIDATED BUTTON */}
                                        <button 
                                            onClick={addDeviceToCart} 
                                            disabled={!repairInput.deviceModel || currentDeviceServices.length === 0}
                                            className={`w-full py-4 rounded-xl font-bold shadow-lg transition flex justify-center gap-2 items-center 
                                                ${!repairInput.deviceModel || currentDeviceServices.length === 0 
                                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                                    : 'bg-slate-900 text-white hover:bg-black'}`}
                                        >
                                            <PlusCircle size={20}/> Add Device to Ticket
                                        </button>
                                    </div>
                                )}
                                
                                {activeTab === 'store' && (
                                    <>
                                        <div className="flex gap-3 mb-6">
                                            <div className="relative flex-1"><Search className="absolute left-3 top-3 text-gray-400" size={18}/><input className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium shadow-sm" placeholder="Search Inventory..." value={storeSearch} onChange={e => setStoreSearch(e.target.value)} /></div>
                                            <select className="p-3 bg-white border border-gray-200 rounded-xl outline-none text-sm font-bold text-slate-700 shadow-sm" value={storeCategory} onChange={e => setStoreCategory(e.target.value)}>{dynamicCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                            {filteredInventory.slice((storePage-1)*itemsPerStorePage, storePage*itemsPerStorePage).map(p => (
                                                <button key={p.id} onClick={() => handleGridAddToCart(p)} disabled={p.stock < 1} className="p-4 bg-white border border-gray-200 rounded-xl text-left h-32 flex flex-col justify-between hover:border-purple-500 hover:shadow-md transition group disabled:opacity-50 disabled:bg-gray-50">
                                                    <span className="font-bold text-sm text-slate-700 line-clamp-2 group-hover:text-purple-700">{p.name}</span>
                                                    <div className="flex justify-between items-end w-full">
                                                        <span className="text-slate-900 font-black text-lg">{formatCurrency(p.price)}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.stock < 3 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{p.stock} left</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        
                                        {/* 🔥 STORE PAGINATION CONTROLS */}
                                        {Math.ceil(filteredInventory.length / itemsPerStorePage) > 1 && (
                                            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
                                                <button 
                                                    onClick={() => setStorePage(prev => Math.max(prev - 1, 1))} 
                                                    disabled={storePage === 1}
                                                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
                                                >
                                                    <ChevronLeft size={20}/>
                                                </button>
                                                <span className="text-xs font-bold text-slate-500">
                                                    Page {storePage} of {Math.ceil(filteredInventory.length / itemsPerStorePage)}
                                                </span>
                                                <button 
                                                    onClick={() => setStorePage(prev => Math.min(prev + 1, Math.ceil(filteredInventory.length / itemsPerStorePage)))} 
                                                    disabled={storePage === Math.ceil(filteredInventory.length / itemsPerStorePage)}
                                                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
                                                >
                                                    <ChevronRight size={20}/>
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {activeTab === 'warranty' && (
                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                                        <div className="flex gap-2">
                                            <input className="flex-1 p-3 border rounded-xl bg-gray-50 focus:bg-white transition outline-none text-sm font-bold font-mono" placeholder="Scan/Type Ticket ID (FTW-123...)" value={warrantyTicketSearch} onChange={e => setWarrantyTicketSearch(e.target.value)} />
                                            <button onClick={handleSearchReturnTicket} className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 shadow-md">Search</button>
                                        </div>
                                        {returnOrder && (
                                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                                <h3 className="font-bold text-orange-900 mb-4 text-sm uppercase tracking-wide">Select Items to Return</h3>
                                                <div className="space-y-2">
                                                    {returnOrder.items.map((item, iIdx) => (
                                                        <div key={iIdx} className="bg-white p-3 rounded-lg border border-orange-100 shadow-sm flex items-center justify-between">
                                                            <span className="font-bold text-slate-800 text-sm">{item.name || item.deviceModel}</span>
                                                            <div className="flex flex-col gap-1">
                                                                {item.type === 'repair' && item.services.map((svc, sIdx) => (
                                                                    <label key={sIdx} className={`flex items-center gap-2 text-xs cursor-pointer ${svc.returned ? 'opacity-50' : ''}`}>
                                                                        <input type="checkbox" disabled={svc.returned} checked={selectedReturnItems.includes(`${iIdx}-${sIdx}`)} onChange={() => toggleReturnItem(iIdx, sIdx)} className="accent-orange-600"/>
                                                                        <span>{svc.service}</span>
                                                                        {svc.returned && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">Returned</span>}
                                                                    </label>
                                                                ))}
                                                                {item.type === 'product' && (
                                                                    <label className={`flex items-center gap-2 text-xs cursor-pointer ${item.returned ? 'opacity-50' : ''}`}>
                                                                        <input type="checkbox" disabled={item.returned} checked={selectedReturnItems.includes(`${iIdx}-product`)} onChange={() => toggleReturnItem(iIdx)} className="accent-orange-600"/>
                                                                        <span>Return Item</span>
                                                                        {item.returned && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">Returned</span>}
                                                                    </label>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <button onClick={handleSubmitReturn} disabled={isSubmitting} className="w-full mt-6 bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-orange-700 transition">Process Return</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* RIGHT: CART PANEL */}
                        <div className={`w-full lg:w-[35%] bg-white shadow-2xl flex flex-col border-l border-gray-200 h-full ${mobilePosTab === 'input' ? 'hidden lg:flex' : 'flex'}`}>
                             <div className="p-6 border-b border-gray-100 bg-slate-50 flex justify-between items-center shrink-0">
                                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2"><ShoppingCart className="text-purple-600"/> Current Ticket</h3>
                                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">{cart.length} Items</span>
                             </div>
                             
                             <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white custom-scrollbar">
                                 {cart.length === 0 ? (
                                    <div className="text-center py-20 opacity-50">
                                        <ShoppingBag size={48} className="mx-auto mb-4 text-slate-300"/>
                                        <p className="font-bold text-slate-400">Cart is empty</p>
                                    </div>
                                 ) : cart.map(item => (
                                     <div key={item.id} className="group bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition relative">
                                         <button onClick={() => removeFromCart(item.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1"><X size={16}/></button>
                                         <div className="pr-6">
                                            <div className="font-bold text-slate-800 text-sm mb-1">
                                                {item.name || item.deviceModel} 
                                                {/* 🔥 SHOW COLOR IN CART */}
                                                {item.deviceColor && <span className="text-xs text-slate-500 font-normal ml-1">({item.deviceColor})</span>}
                                            </div>
                                            {item.type === 'repair' && <div className="text-xs text-slate-500 mb-2">{item.services.map(s=>s.service).join(', ')}</div>}
                                         </div>
                                         <div className="flex justify-between items-end border-t border-dashed border-gray-100 pt-3">
                                            {item.type === 'product' ? (
                                                <div className="flex items-center bg-gray-50 rounded-lg p-1 gap-3"><button onClick={() => updateCartQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm hover:text-purple-600"><Minus size={12}/></button><span className="text-xs font-bold w-4 text-center">{item.qty}</span><button onClick={() => updateCartQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm hover:text-purple-600"><Plus size={12}/></button></div>
                                            ) : (
                                                <button onClick={() => handleEditCartItem(item)} className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">Edit</button>
                                            )}
                                            <div className="text-right font-mono font-bold text-purple-700">{formatCurrency(item.total)}</div>
                                         </div>
                                     </div>
                                 ))}
                             </div>

                             <div className="p-6 border-t border-gray-100 bg-slate-50 shrink-0 space-y-4">
                                 <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>{formatCurrency(cart.reduce((a,b)=>a+b.total,0))}</span></div>
                                 <div className="flex justify-between text-sm text-slate-500 items-center">
                                     <span>Discount</span>
                                     <input type="number" className="w-24 p-1 text-right border rounded bg-white text-xs font-bold" placeholder="0" value={discount} onChange={e=>setDiscount(e.target.value)}/>
                                 </div>
                                 <div className="flex justify-between text-2xl font-black text-slate-900 pt-4 border-t border-gray-200"><span>Total</span><span>{formatCurrency(Math.max(0, cart.reduce((a,b)=>a+b.total,0) - discount))}</span></div>
                                 
                                 <button onClick={handleCheckout} disabled={isSubmitting || cart.length === 0} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl hover:bg-black transition flex justify-center items-center gap-2 text-lg disabled:opacity-70 disabled:cursor-not-allowed">
                                     {isSubmitting ? <Loader2 className="animate-spin"/> : <>{editOrderId ? 'Update Ticket' : 'Create Ticket'} <ArrowRight size={20}/></>}
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