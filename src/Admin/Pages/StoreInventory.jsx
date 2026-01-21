import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Package, Plus, Search, Edit2, Trash2, Smartphone, 
    ArrowLeft, ArrowUpCircle, Save, X, 
    AlertTriangle, ClipboardEdit, Loader2,
    Download, Filter, ChevronLeft, ChevronRight, History, Layers, Palette, List, Wrench,
    Eye, EyeOff, Tablet, Watch, ChevronDown, Calendar, Check
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AdminContext.jsx';
import { db } from '../../firebaseConfig.js'; 
import { 
    collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, increment, serverTimestamp, writeBatch 
} from 'firebase/firestore';
import { Toast, ConfirmModal } from '../Components/Feedback.jsx';
import * as XLSX from 'xlsx';

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

// --- HELPER: Smart Type Detection ---
const getDeviceType = (item) => {
    if (item.type) return item.type;
    if (item.deviceType) return item.deviceType; 
    const text = (item.name || item.model || '').toLowerCase();
    if (text.includes('ipad')) return 'iPad';
    if (text.includes('watch') || text.includes('series') || text.includes('ultra')) return 'Watch';
    return 'iPhone';
};

// --- HELPER: Flexible String Matching (Removes spaces for comparison) ---
const normalizeStr = (str) => str ? str.toLowerCase().replace(/\s+/g, '') : '';

const MODEL_DB = {
    iPhone: [
        'iPhone 6', 'iPhone 6 Plus', 'iPhone 6s', 'iPhone 6s Plus', 
        'iPhone 7', 'iPhone 7 Plus', 'iPhone 8', 'iPhone 8 Plus', 
        'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max',
        'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
        'iPhone 12', 'iPhone 12 Mini', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
        'iPhone 13', 'iPhone 13 Mini', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
        'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
        'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
        'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
        'iPhone 17', 'iPhone 17 Plus', 'iPhone 17 Pro', 'iPhone 17 Pro Max'
    ],
    iPad: [
        'iPad (9th Gen)', 'iPad (10th Gen)', 'iPad (11th Gen)',
        'iPad mini 5', 'iPad mini 6', 'iPad mini 7',
        'iPad Air 3', 'iPad Air 4', 'iPad Air 5', 'iPad Air 11" (M2)', 'iPad Air 13" (M2)',
        'iPad Pro 11" (1st Gen)', 'iPad Pro 11" (2nd Gen)', 'iPad Pro 11" (3rd Gen)', 'iPad Pro 11" (4th Gen)', 'iPad Pro 11" (M4)',
        'iPad Pro 12.9" (3rd Gen)', 'iPad Pro 12.9" (4th Gen)', 'iPad Pro 12.9" (5th Gen)', 'iPad Pro 12.9" (6th Gen)', 'iPad Pro 13" (M4)'
    ],
    Watch: [
        'Series 1', 'Series 2', 'Series 3', 'Series 4', 'Series 5', 'Series 6', 'Series 7', 'Series 8', 'Series 9', 'Series 10', 'Series 11',
        'SE (1st Gen)', 'SE (2nd Gen)', 'SE (3rd Gen)',
        'Ultra', 'Ultra 2', 'Ultra 3'
    ]
};

const getModelRange = (type, start, end) => {
    const list = MODEL_DB[type] || [];
    const sIdx = list.indexOf(start);
    const eIdx = list.indexOf(end);
    if (sIdx === -1 || eIdx === -1 || sIdx > eIdx) return [];
    return list.slice(sIdx, eIdx + 1);
};

const safeParseFloat = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const clean = String(val).replace(/[^0-9.-]/g, ''); 
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

const safeParseInt = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const clean = String(val).replace(/[^0-9-]/g, ''); 
    const num = parseInt(clean, 10);
    return isNaN(num) ? 0 : num;
};

const StockHealth = ({ stock }) => {
    let color = 'bg-green-500';
    let width = '100%';
    let label = 'In Stock';

    if (stock <= 0) { color = 'bg-red-500'; width = '5%'; label = 'Out'; } 
    else if (stock < 5) { color = 'bg-orange-500'; width = '30%'; label = 'Low'; } 
    else if (stock < 20) { color = 'bg-blue-500'; width = '60%'; }

    return (
        <div className="w-full max-w-[100px] md:max-w-[120px]">
            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 mb-1">
                <span>{stock}</span>
                <span className={stock <= 0 ? 'text-red-500' : stock < 5 ? 'text-orange-500' : 'text-green-600'}>{label}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all duration-500`} style={{ width }}></div>
            </div>
        </div>
    );
};

// CUSTOM SEARCHABLE DROPDOWN COMPONENT
const SearchableDropdown = ({ options, value, onChange, placeholder = "Select..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef(null);

    const filteredOptions = options.filter(opt => 
        opt.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative w-full md:w-48" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg text-sm font-bold border border-transparent focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition text-left"
            >
                <span className={value === 'All' ? 'text-gray-500' : 'text-slate-800 truncate'}>
                    {value === 'All' ? placeholder : value}
                </span>
                <ChevronDown size={16} className="text-gray-400"/>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 border-b border-gray-50">
                        <input 
                            autoFocus
                            className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold outline-none"
                            placeholder="Search category..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        <button 
                            onClick={() => { onChange('All'); setIsOpen(false); }}
                            className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-purple-50 transition ${value === 'All' ? 'text-purple-600 bg-purple-50' : 'text-slate-600'}`}
                        >
                            All Categories
                        </button>
                        {filteredOptions.map(opt => (
                            <button 
                                key={opt}
                                onClick={() => { onChange(opt); setIsOpen(false); }}
                                className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-purple-50 transition ${value === opt ? 'text-purple-600 bg-purple-50' : 'text-slate-600'}`}
                            >
                                {opt}
                            </button>
                        ))}
                        {filteredOptions.length === 0 && <div className="p-4 text-center text-xs text-gray-400">No matches</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

// 🔥 STATE PERSISTENCE HELPER
const getSavedState = (key, fallback) => {
    try {
        const saved = sessionStorage.getItem('store_inv_state');
        if (!saved) return fallback;
        const parsed = JSON.parse(saved);
        return parsed[key] !== undefined ? parsed[key] : fallback;
    } catch { return fallback; }
};

const StoreInventory = () => {
    const { role } = useAuth(); 
    const navigate = useNavigate();
    
    // PERMISSION: Manager CANNOT see prices
    const canSeePrice = role !== 'manager';

    // UI State
    const [isCreating, setIsCreating] = useState(false); 
    const [showValue, setShowValue] = useState(false); 

    // Data State
    const [products, setProducts] = useState([]); 
    const [salesHistory, setSalesHistory] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    // 🔥 INITIALIZE STATE FROM SESSION STORAGE
    const [activeTab, setActiveTab] = useState(() => getSavedState('activeTab', 'products'));
    const [searchTerm, setSearchTerm] = useState(() => getSavedState('searchTerm', ''));
    const [filterCategory, setFilterCategory] = useState(() => getSavedState('filterCategory', 'All'));
    const [filterStock, setFilterStock] = useState(() => getSavedState('filterStock', 'All'));
    const [filterDeviceType, setFilterDeviceType] = useState(() => getSavedState('filterDeviceType', 'All'));
    
    // History Filters
    const [historySearch, setHistorySearch] = useState(() => getSavedState('historySearch', ''));
    const [historyTypeFilter, setHistoryTypeFilter] = useState(() => getSavedState('historyTypeFilter', 'All'));
    const [historyTimeFilter, setHistoryTimeFilter] = useState(() => getSavedState('historyTimeFilter', 'all'));
    const [historyCategoryFilter, setHistoryCategoryFilter] = useState(() => getSavedState('historyCategoryFilter', 'All'));
    const [historyCustomStart, setHistoryCustomStart] = useState(() => getSavedState('historyCustomStart', ''));
    const [historyCustomEnd, setHistoryCustomEnd] = useState(() => getSavedState('historyCustomEnd', ''));

    // Pagination
    const [currentPage, setCurrentPage] = useState(() => getSavedState('currentPage', 1));
    const [historyPage, setHistoryPage] = useState(() => getSavedState('historyPage', 1));

    const itemsPerPage = 50;
    const historyPerPage = 20;

    // 🔥 SAVE STATE ON CHANGE
    useEffect(() => {
        const stateToSave = {
            activeTab, searchTerm, filterCategory, filterStock, filterDeviceType,
            historySearch, historyTypeFilter, historyTimeFilter, historyCategoryFilter, historyCustomStart, historyCustomEnd,
            currentPage, historyPage
        };
        sessionStorage.setItem('store_inv_state', JSON.stringify(stateToSave));
    }, [
        activeTab, searchTerm, filterCategory, filterStock, filterDeviceType,
        historySearch, historyTypeFilter, historyTimeFilter, historyCategoryFilter, historyCustomStart, historyCustomEnd,
        currentPage, historyPage
    ]);

    // Bulk Selection State
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkStockInput, setBulkStockInput] = useState(10);
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
    const [bulkEditData, setBulkEditData] = useState({ price: '', category: '', stock: '', color: '' });

    // Custom Color per Model State
    const [isCustomColorMode, setIsCustomColorMode] = useState(false);
    const [modelSpecificColors, setModelSpecificColors] = useState({});

    // Modals
    const [restockItem, setRestockItem] = useState(null); 
    const [restockQty, setRestockQty] = useState('');
    const [editingItem, setEditingItem] = useState(null); 
    const [isBulkMode, setIsBulkMode] = useState(false); 
    const [deviceType, setDeviceType] = useState('iPhone');
    
    const [newProduct, setNewProduct] = useState({ 
        name: '', category: '', type: '', model: '', price: '', stock: 0, color: '',
        rangeStart: '', rangeEnd: '' 
    });

    useEffect(() => {
        setNewProduct(prev => ({
            ...prev,
            rangeStart: MODEL_DB[deviceType][0] || '',
            rangeEnd: MODEL_DB[deviceType][MODEL_DB[deviceType].length - 1] || ''
        }));
    }, [deviceType]);

    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

    // 1. DATA
    useEffect(() => {
        const q = query(collection(db, "Inventory"), orderBy("category"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. HISTORY
    useEffect(() => {
        if (activeTab === 'history') {
            const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
            const unsub = onSnapshot(q, (snapshot) => {
                const sales = [];
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const historyItems = data.items?.filter(i => i.type === 'product' || i.type === 'part_usage') || [];
                    if (historyItems.length > 0) {
                        sales.push({
                            id: doc.id,
                            ticketId: data.ticketId,
                            customer: data.orderType === 'repair' ? (data.items.find(i=>i.type==='part_usage')?.worker || 'Technician') : (data.customer?.name || 'Walk-in'),
                            type: data.orderType === 'repair' ? 'Internal Use' : 'Store Sale',
                            date: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                            items: historyItems,
                            total: historyItems.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0)
                        });
                    }
                });
                setSalesHistory(sales);
            });
            return () => unsub();
        }
    }, [activeTab]);

    // 3. FILTERING PRODUCTS
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const term = normalizeStr(searchTerm);
            const pName = normalizeStr(product.name);
            const pModel = normalizeStr(product.model);
            const pColor = normalizeStr(product.color);
            const type = getDeviceType(product);
            
            const matchesSearch = pName.includes(term) || pModel.includes(term) || pColor.includes(term);
            const matchesCategory = filterCategory === 'All' || product.category === filterCategory;
            const matchesStock = filterStock === 'All' || (filterStock === 'Low' && product.stock < 5 && product.stock > 0) || (filterStock === 'Out' && product.stock <= 0);
            const matchesDevice = filterDeviceType === 'All' || type === filterDeviceType;

            return matchesSearch && matchesCategory && matchesStock && matchesDevice;
        });
    }, [products, searchTerm, filterCategory, filterStock, filterDeviceType]);

    // 🔥 SMART HISTORY FILTERING (Search + Type + Category + Time)
    const filteredHistory = useMemo(() => {
        let data = salesHistory;
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay); endOfDay.setDate(startOfDay.getDate() + 1);
        
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); 
        startOfWeek.setHours(0,0,0,0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // 1. Search Filter (Customer, Ticket, or Item Name)
        if (historySearch) {
            const term = normalizeStr(historySearch);
            data = data.filter(s => 
                normalizeStr(s.customer).includes(term) || 
                normalizeStr(s.ticketId).includes(term) ||
                s.items.some(i => normalizeStr(i.name).includes(term))
            );
        }

        // 2. Type Filter
        if (historyTypeFilter !== 'All') {
            data = data.filter(s => s.type === historyTypeFilter);
        }

        // 3. Category Filter
        if (historyCategoryFilter !== 'All') {
            data = data.filter(s => s.items.some(i => {
                const product = products.find(p => p.id === i.productId || p.id === i.partId || p.name === i.name);
                return product && product.category === historyCategoryFilter;
            }));
        }

        // 4. Time Filter
        if (historyTimeFilter === 'today') {
            data = data.filter(s => s.date >= startOfDay && s.date < endOfDay);
        } else if (historyTimeFilter === 'week') {
            data = data.filter(s => s.date >= startOfWeek);
        } else if (historyTimeFilter === 'month') {
            data = data.filter(s => s.date >= startOfMonth);
        } else if (historyTimeFilter === 'custom') {
            const start = historyCustomStart ? new Date(historyCustomStart) : new Date('1970-01-01');
            const end = historyCustomEnd ? new Date(historyCustomEnd) : new Date();
            end.setHours(23, 59, 59, 999);
            data = data.filter(s => s.date >= start && s.date <= end);
        }

        return data;
    }, [salesHistory, historySearch, historyTypeFilter, historyCategoryFilter, historyTimeFilter, historyCustomStart, historyCustomEnd, products]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterCategory, filterStock, filterDeviceType]);
    useEffect(() => { setHistoryPage(1); }, [historySearch, historyTypeFilter, historyTimeFilter, historyCustomStart, historyCustomEnd]);

    // 4. METRICS
    const dynamicCategories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))].sort(), [products]);
    const stats = useMemo(() => {
        const sourceData = filteredProducts;
        const totalValue = sourceData.reduce((sum, p) => sum + (safeParseFloat(p.price) * Math.max(0, safeParseInt(p.stock))), 0);
        return { 
            totalItems: sourceData.length, 
            lowStock: sourceData.filter(p => p.stock > 0 && p.stock < 5).length,
            outOfStock: sourceData.filter(p => p.stock <= 0).length,
            totalValue 
        };
    }, [filteredProducts]);

    // 5. PAGINATION
    const currentProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    
    // History Pagination
    const currentHistory = filteredHistory.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage);
    const totalHistoryPages = Math.ceil(filteredHistory.length / historyPerPage);

    // Helpers for Bulk Models
    const activeModelsInRange = useMemo(() => {
        if (!isBulkMode) return [];
        return getModelRange(deviceType, newProduct.rangeStart, newProduct.rangeEnd);
    }, [isBulkMode, deviceType, newProduct.rangeStart, newProduct.rangeEnd]);

    // BULK SELECTION HANDLERS
    const isAllSelected = currentProducts.length > 0 && currentProducts.every(p => selectedIds.includes(p.id));

    const handleSelectAll = () => {
        if (isAllSelected) {
            const currentIds = currentProducts.map(p => p.id);
            setSelectedIds(prev => prev.filter(id => !currentIds.includes(id)));
        } else {
            const currentIds = currentProducts.map(p => p.id);
            const combined = new Set([...selectedIds, ...currentIds]);
            setSelectedIds(Array.from(combined));
        }
    };

    const handleSelectOne = (id) => {
        if (selectedIds.includes(id)) setSelectedIds(prev => prev.filter(sid => sid !== id));
        else setSelectedIds(prev => [...prev, id]);
    };

    // Bulk Actions
    const handleBulkPushStock = async () => {
        if (selectedIds.length === 0) return;
        setConfirmConfig({
            isOpen: true, title: "Bulk Stock Push", message: `Add +${bulkStockInput} stock to ${selectedIds.length} items?`, confirmText: "Push Stock", confirmColor: "bg-green-600",
            action: async () => {
                setActionLoading(true);
                try {
                    const batch = writeBatch(db);
                    selectedIds.forEach(id => {
                        const docRef = doc(db, "Inventory", id);
                        batch.update(docRef, { stock: increment(Number(bulkStockInput)) });
                    });
                    await batch.commit();
                    setToast({ message: "Bulk stock updated!", type: "success" });
                    setSelectedIds([]);
                } catch (e) { setToast({ message: "Bulk update failed", type: "error" }); }
                setActionLoading(false); setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        setConfirmConfig({
            isOpen: true, title: "Delete All Selected?", message: `You are about to PERMANENTLY delete ${selectedIds.length} items.`, confirmText: "Delete All", confirmColor: "bg-red-600",
            action: async () => {
                setActionLoading(true);
                try {
                    const batch = writeBatch(db);
                    selectedIds.forEach(id => { const docRef = doc(db, "Inventory", id); batch.delete(docRef); });
                    await batch.commit();
                    setToast({ message: `Deleted ${selectedIds.length} items.`, type: "success" });
                    setSelectedIds([]);
                } catch (e) { setToast({ message: "Bulk delete failed.", type: "error" }); }
                setActionLoading(false); setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    const handleBulkEditSave = async (e) => {
        e.preventDefault();
        if (selectedIds.length === 0) return;
        const updates = {};
        if (bulkEditData.price && canSeePrice) updates.price = safeParseFloat(bulkEditData.price);
        if (bulkEditData.stock) updates.stock = safeParseInt(bulkEditData.stock);
        if (bulkEditData.category) updates.category = bulkEditData.category.trim();
        if (bulkEditData.color) updates.color = bulkEditData.color.trim();

        if (Object.keys(updates).length === 0) { setToast({ message: "No fields to update.", type: "error" }); return; }
        setActionLoading(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => { const docRef = doc(db, "Inventory", id); batch.update(docRef, { ...updates, lastUpdated: serverTimestamp() }); });
            await batch.commit();
            setToast({ message: `Updated ${selectedIds.length} items!`, type: "success" });
            setIsBulkEditOpen(false); setBulkEditData({ price: '', category: '', stock: '', color: '' }); setSelectedIds([]);
        } catch (e) { setToast({ message: "Bulk update failed.", type: "error" }); }
        setActionLoading(false);
    };

    // Actions
    const handleCreateProduct = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const safePrice = canSeePrice ? safeParseFloat(newProduct.price) : 0;
            const safeStock = safeParseInt(newProduct.stock);
            if (isBulkMode) {
                const models = getModelRange(deviceType, newProduct.rangeStart, newProduct.rangeEnd);
                if (models.length === 0) throw new Error("Invalid Range");
                let itemsToCreate = [];
                models.forEach(model => {
                    let colorsString = isCustomColorMode ? (modelSpecificColors[model] || "") : newProduct.color;
                    const colorList = colorsString ? colorsString.split(',').map(c => c.trim()).filter(c => c !== "") : [];
                    if (colorList.length > 0) { colorList.forEach(color => itemsToCreate.push({ name: `${newProduct.name} - ${model} - ${color}`, model, color })); } 
                    else { itemsToCreate.push({ name: `${newProduct.name} - ${model}`, model, color: "" }); }
                });
                const BATCH_SIZE = 450;
                for (let i = 0; i < itemsToCreate.length; i += BATCH_SIZE) {
                    const batch = writeBatch(db);
                    const chunk = itemsToCreate.slice(i, i + BATCH_SIZE);
                    chunk.forEach(item => {
                        const safeId = item.name.replace(/[^a-zA-Z0-9]/g, '_'); 
                        const docRef = doc(db, "Inventory", safeId);
                        batch.set(docRef, { 
                            name: item.name, 
                            category: newProduct.category.trim(), 
                            model: item.model, 
                            price: safePrice, 
                            stock: safeStock, 
                            color: item.color, 
                            type: deviceType,
                            lastUpdated: serverTimestamp() 
                        }, { merge: true });
                    });
                    await batch.commit();
                }
                setToast({ message: `Added ${itemsToCreate.length} items!`, type: "success" });
            } else {
                const safeColor = newProduct.color ? newProduct.color.trim() : "";
                await addDoc(collection(db, "Inventory"), { 
                    name: newProduct.name.trim(), 
                    category: newProduct.category.trim(), 
                    model: newProduct.model || "", 
                    price: safePrice, 
                    stock: safeStock, 
                    color: safeColor, 
                    type: deviceType, 
                    lastUpdated: serverTimestamp() 
                });
                setToast({ message: "Product Added", type: "success" });
            }
            setNewProduct(prev => ({ ...prev, name: '', model: '', price: '', stock: 0, color: '' }));
            setIsCreating(false); setIsCustomColorMode(false); setModelSpecificColors({});
        } catch (e) { setToast({ message: "Failed to add product", type: "error" }); }
        setActionLoading(false);
    };

    const handleUpdateProduct = async (e) => {
        e.preventDefault();
        if (!editingItem) return;
        setActionLoading(true);
        try {
            const updates = {
                name: editingItem.name, category: editingItem.category, model: editingItem.model,
                stock: safeParseInt(editingItem.stock), color: editingItem.color || "", lastUpdated: serverTimestamp()
            };
            if (canSeePrice) updates.price = safeParseFloat(editingItem.price);

            await updateDoc(doc(db, "Inventory", editingItem.id), updates);
            setToast({ message: "Saved", type: "success" }); setEditingItem(null);
        } catch (e) { setToast({ message: "Update Failed", type: "error" }); }
        setActionLoading(false);
    };

    const handleRestock = async () => {
        if (!restockItem || !restockQty) return;
        setActionLoading(true);
        try {
            const qty = safeParseInt(restockQty);
            if(qty !== 0) { 
                await updateDoc(doc(db, "Inventory", restockItem.id), { stock: increment(qty) });
                setToast({ message: "Stock Updated", type: "success" }); setRestockItem(null); setRestockQty('');
            }
        } catch (e) { setToast({ message: "Failed", type: "error" }); }
        setActionLoading(false);
    };

    const handleDelete = (item) => {
        setConfirmConfig({
            isOpen: true, title: "Delete Item?", message: `Delete "${item.name}"?`, confirmText: "Delete", confirmColor: "bg-red-600",
            action: async () => { try { await deleteDoc(doc(db, "Inventory", item.id)); setToast({ message: "Deleted.", type: "success" }); } catch(e) { setToast({message: "Delete Failed", type: "error"}); } setConfirmConfig({ ...confirmConfig, isOpen: false }); }
        });
    };

    const handleExport = () => {
        const data = products.map(p => {
            const row = {
                "Product": p.name, "Category": p.category, "Model": p.model, "Color": p.color || '', "Stock": safeParseInt(p.stock)
            };
            if (canSeePrice) {
                row["Price"] = safeParseFloat(p.price);
                row["Value"] = safeParseFloat(p.price) * Math.max(0, safeParseInt(p.stock));
            }
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventory");
        XLSX.writeFile(wb, "FTW_Inventory.xlsx");
    };

    if (role !== 'admin' && role !== 'manager' && role !== 'ceo') return <Navigate to="/admin/dashboard" replace />;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans text-slate-900">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={confirmConfig.action} />
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2 rounded-xl shadow-sm border hover:bg-gray-50 text-slate-600"><ArrowLeft size={20}/></button>
                    <div><h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">Store Inventory</h1><p className="text-xs sm:text-sm text-slate-500">Manage products & view usage</p></div>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto"><button onClick={handleExport} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border px-4 py-2 rounded-xl font-bold hover:bg-gray-50 text-sm shadow-sm"><Download size={16} /> Export</button></div>
            </div>

            {/* METRICS */}
            {activeTab === 'products' && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    {/* 🔥 HIDE VALUE CARD FOR MANAGERS */}
                    {canSeePrice && (
                        <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col justify-between h-24">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Value (Current View)</span>
                                <button onClick={() => setShowValue(!showValue)} className="text-gray-400 hover:text-purple-600 transition">
                                    {showValue ? <Eye size={14}/> : <EyeOff size={14}/>}
                                </button>
                            </div>
                            <span className="text-lg sm:text-xl font-black text-slate-900">
                                {showValue ? formatCurrency(stats.totalValue) : '****'}
                            </span>
                        </div>
                    )}

                    <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col justify-between h-24"><span className="text-[10px] font-bold text-gray-400 uppercase">Visible Stock</span><span className="text-lg sm:text-xl font-black text-slate-900">{stats.totalItems} Items</span></div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col justify-between h-24"><span className="text-[10px] font-bold text-gray-400 uppercase">Low</span><span className="text-lg sm:text-xl font-black text-orange-600">{stats.lowStock} Items</span></div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col justify-between h-24"><span className="text-[10px] font-bold text-gray-400 uppercase">Out</span><span className="text-lg sm:text-xl font-black text-red-600">{stats.outOfStock} Items</span></div>
                </div>
            )}

            {/* TABS */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto no-scrollbar">
                <button onClick={() => {setActiveTab('products'); setIsCreating(false)}} className={`whitespace-nowrap px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'products' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Products</button>
                <button onClick={() => {setActiveTab('history'); setIsCreating(false)}} className={`whitespace-nowrap px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'history' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Sales History</button>
            </div>

            {/* PRODUCTS TAB */}
            {activeTab === 'products' && !isCreating && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="bg-white p-3 rounded-xl shadow-sm border flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1"><Search className="absolute left-3 top-3 text-gray-400" size={18}/><input className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-lg outline-none text-sm font-medium focus:ring-2 focus:ring-purple-500" placeholder="Search loaded items..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                        <div className="grid grid-cols-2 md:flex gap-2 items-center">
                            
                            {/* 🔥 REPLACED WITH SEARCHABLE DROPDOWN */}
                            <SearchableDropdown 
                                options={dynamicCategories} 
                                value={filterCategory} 
                                onChange={setFilterCategory} 
                                placeholder="All Categories" 
                            />

                            <select className="px-3 py-2.5 bg-gray-50 rounded-lg text-sm font-bold outline-none border border-transparent focus:border-purple-500" value={filterStock} onChange={e => setFilterStock(e.target.value)}><option value="All">All Stock</option><option value="Low">Low</option><option value="Out">Out</option></select>
                            <button onClick={() => setIsCreating(true)} className="col-span-2 md:col-span-1 bg-purple-900 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-purple-800 transition flex items-center justify-center gap-2 shadow-sm"><Plus size={18}/> Add</button>
                        </div>
                         {/* DEVICE FILTER DROPDOWN */}
                         <div className="relative min-w-[140px]">
                            <div className="absolute left-3 top-3.5 text-gray-400 pointer-events-none">
                                {filterDeviceType === 'iPhone' ? <Smartphone size={16}/> : 
                                 filterDeviceType === 'iPad' ? <Tablet size={16}/> : 
                                 filterDeviceType === 'Watch' ? <Watch size={16}/> : 
                                 <Filter size={16}/>}
                            </div>
                            <select 
                                className="w-full pl-9 pr-8 py-2.5 bg-gray-50 rounded-lg border-none outline-none text-sm font-bold text-slate-600 cursor-pointer appearance-none"
                                value={filterDeviceType}
                                onChange={e => setFilterDeviceType(e.target.value)}
                            >
                                <option value="All">All Devices</option>
                                <option value="iPhone">iPhone</option>
                                <option value="iPad">iPad</option>
                                <option value="Watch">Watch</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={14}/>
                        </div>
                    </div>
                    
                    {/* BULK ACTION BAR */}
                    {selectedIds.length > 0 && (
                        <div className="bg-purple-50 border border-purple-100 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in shadow-sm mb-4">
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <span className="text-xs font-bold text-purple-700 bg-purple-100 px-3 py-1 rounded-full whitespace-nowrap">{selectedIds.length} Selected</span>
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="text-xs font-bold text-purple-700 whitespace-nowrap">Add Stock:</span>
                                    <input 
                                        type="number" 
                                        className="w-16 p-1 text-center border border-purple-200 rounded text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500" 
                                        value={bulkStockInput} 
                                        onChange={e => setBulkStockInput(e.target.value)} 
                                    />
                                    <button onClick={handleBulkPushStock} className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-700 shadow-sm flex items-center gap-1">
                                        <ArrowUpCircle size={14}/> Push
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={() => setIsBulkEditOpen(true)} className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2">
                                    <Edit2 size={14}/> Bulk Edit
                                </button>
                                <button onClick={handleBulkDelete} className="flex-1 sm:flex-none bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 shadow-sm flex items-center justify-center gap-2">
                                    <Trash2 size={14}/> Delete All
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TABLE (Desktop) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b text-xs font-bold text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-6 py-4 w-10"><input type="checkbox" className="w-4 h-4 accent-purple-600 cursor-pointer" checked={isAllSelected} onChange={handleSelectAll} /></th>
                                        <th className="px-6 py-4">Product</th>
                                        <th className="px-6 py-4">Category</th>
                                        {/* 🔥 HIDE PRICE HEADER */}
                                        {canSeePrice && <th className="px-6 py-4 text-right">Price</th>}
                                        <th className="px-6 py-4 w-32">Stock</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {currentProducts.map((p) => { 
                                        const isSelected = selectedIds.includes(p.id); 
                                        return (
                                            <tr key={p.id} onClick={() => handleSelectOne(p.id)} className={`transition group cursor-pointer ${isSelected ? 'bg-purple-50/60' : 'hover:bg-gray-50'}`}>
                                                <td className="px-6 py-4" onClick={e => e.stopPropagation()}><input type="checkbox" className="w-4 h-4 accent-purple-600 cursor-pointer" checked={isSelected} onChange={() => handleSelectOne(p.id)} /></td>
                                                <td className="px-6 py-4"><div className="font-bold text-slate-900">{p.name}</div><div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Smartphone size={10}/> {p.model}{p.color && <span className="ml-2 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-200"><Palette size={8}/> {p.color}</span>}</div></td>
                                                <td className="px-6 py-4"><span className="px-2 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border">{p.category}</span></td>
                                                {/* 🔥 HIDE PRICE CELL */}
                                                {canSeePrice && <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">{formatCurrency(p.price)}</td>}
                                                <td className="px-6 py-4"><StockHealth stock={p.stock}/></td>
                                                <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}><div className="flex items-center justify-end gap-2"><button onClick={() => setRestockItem(p)} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"><ArrowUpCircle size={16}/></button><button onClick={() => setEditingItem(p)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size={16}/></button><button onClick={() => handleDelete(p)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button></div></td>
                                            </tr>
                                        ); 
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-gray-100">{currentProducts.map((p) => { const isSelected = selectedIds.includes(p.id); return (<div key={p.id} onClick={() => handleSelectOne(p.id)} className={`p-4 flex flex-col gap-3 cursor-pointer ${isSelected ? 'bg-purple-50' : ''}`}><div className="flex justify-between items-start"><div className="flex gap-3"><input type="checkbox" className="w-5 h-5 accent-purple-600 mt-1" checked={isSelected} onChange={() => handleSelectOne(p.id)} onClick={e => e.stopPropagation()} /><div><h4 className="font-bold text-slate-900 text-sm">{p.name}</h4><div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Smartphone size={10}/> {p.model}{p.color && <span className="ml-1 bg-slate-100 px-1 rounded flex items-center gap-0.5"><Palette size={8}/> {p.color}</span>}</div></div></div><div className="text-right">{/* 🔥 HIDE MOBILE PRICE */}{canSeePrice && <p className="font-mono font-bold text-slate-800 text-sm">{formatCurrency(p.price)}</p>}<span className="text-[10px] font-bold text-slate-400 uppercase">{p.category}</span></div></div><div className="flex items-center gap-4 pl-8"><div className="flex-1"><StockHealth stock={p.stock}/></div><div className="flex gap-2" onClick={e => e.stopPropagation()}><button onClick={() => setRestockItem(p)} className="p-2 bg-green-50 text-green-600 rounded-lg"><ArrowUpCircle size={16}/></button><button onClick={() => setEditingItem(p)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit2 size={16}/></button><button onClick={() => handleDelete(p)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={16}/></button></div></div></div>); })}</div>
                        {/* Pagination */}
                        {filteredProducts.length > 0 && (<div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between"><span className="text-sm text-gray-500 hidden sm:block">Showing <span className="font-bold">{currentPage}</span> of <span className="font-bold">{totalPages}</span> pages</span><div className="flex items-center gap-2"><button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition"><ChevronLeft size={18}/></button><span className="text-xs font-bold bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">Page {currentPage} of {totalPages}</span><button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition"><ChevronRight size={18}/></button></div></div>)}
                    </div>
                </div>
            )}

            {/* --- TAB: HISTORY --- */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in">
                    
                    {/* 🔥 HISTORY HEADER + FILTERS */}
                    <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <History className="text-purple-600" size={20}/>
                            <h3 className="font-bold text-slate-800 text-lg">Sales & Usage History</h3>
                            <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">{filteredHistory.length}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            {/* 🔥 SEARCH BAR */}
                            <div className="relative flex-1 md:flex-none">
                                <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14}/>
                                <input 
                                    className="w-full md:w-48 pl-8 pr-3 py-2 bg-gray-50 rounded-lg text-xs font-bold focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition" 
                                    placeholder="Search customer, item..." 
                                    value={historySearch} 
                                    onChange={e => setHistorySearch(e.target.value)}
                                />
                            </div>

                            {/* 🔥 TYPE FILTER */}
                            <select 
                                className="px-3 py-2 bg-gray-50 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer border border-transparent hover:bg-gray-100"
                                value={historyTypeFilter}
                                onChange={e => setHistoryTypeFilter(e.target.value)}
                            >
                                <option value="All">All Types</option>
                                <option value="Store Sale">Store Sales</option>
                                <option value="Internal Use">Internal Usage</option>
                            </select>

                            {/* 🔥 CATEGORY FILTER (NEW) */}
                            <SearchableDropdown 
                                options={dynamicCategories} 
                                value={historyCategoryFilter} 
                                onChange={setHistoryCategoryFilter} 
                                placeholder="All Categories" 
                            />

                            <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                                {['all', 'today', 'week', 'month', 'custom'].map(t => (
                                    <button 
                                        key={t}
                                        onClick={() => setHistoryTimeFilter(t)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize transition ${historyTimeFilter === t ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                            
                            {historyTimeFilter === 'custom' && (
                                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200 animate-in fade-in">
                                    <input type="date" className="bg-transparent text-xs font-bold text-slate-600 outline-none" value={historyCustomStart} onChange={e => setHistoryCustomStart(e.target.value)} />
                                    <span className="text-slate-400">-</span>
                                    <input type="date" className="bg-transparent text-xs font-bold text-slate-600 outline-none" value={historyCustomEnd} onChange={e => setHistoryCustomEnd(e.target.value)} />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b text-xs font-bold text-slate-500 uppercase">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Ticket</th>
                                    <th className="px-6 py-4">Primary User</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Items Used ( & Who Used It)</th>
                                    {/* 🔥 HIDE HISTORY VALUE */}
                                    {canSeePrice && <th className="px-6 py-4 text-right">Value</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {currentHistory.map(sale => {
                                    // 🔥 FILTER ITEMS FOR DISPLAY
                                    const visibleItems = sale.items.filter(item => {
                                        const term = normalizeStr(historySearch);
                                        const matchesSearch = !term || normalizeStr(item.name).includes(term) || normalizeStr(sale.ticketId).includes(term) || normalizeStr(sale.customer).includes(term);

                                        const product = products.find(p => p.id === item.productId || p.id === item.partId || p.name === item.name);
                                        const itemCategory = product ? product.category : 'Uncategorized';
                                        const matchesCategory = historyCategoryFilter === 'All' || itemCategory === historyCategoryFilter;

                                        return matchesSearch && matchesCategory;
                                    });

                                    if (visibleItems.length === 0) return null;

                                    return (
                                        <tr key={sale.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/orders/${sale.ticketId}`)}>
                                            <td className="px-6 py-4 text-gray-500">{sale.date.toLocaleDateString()}</td>
                                            <td className="px-6 py-4 font-mono font-bold text-purple-700">{sale.ticketId}</td>
                                            <td className="px-6 py-4 font-medium">{sale.customer}</td>
                                            <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${sale.type === 'Internal Use' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{sale.type}</span></td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {visibleItems.map((item, idx) => (
                                                        <div key={idx} className="text-xs text-slate-600 flex items-center gap-1">
                                                            {item.type === 'part_usage' ? <Wrench size={12} className="text-blue-500"/> : <Package size={12} className="text-green-500"/>}
                                                            <span className="font-medium">{item.name.replace('Used: ', '')}</span> 
                                                            <span className="font-bold text-slate-800">x{item.qty || 1}</span>
                                                            
                                                            {item.type === 'part_usage' && item.worker && (
                                                                <span className="ml-1 text-[10px] text-gray-400 bg-gray-100 px-1.5 rounded border border-gray-200">
                                                                    by {item.worker.split(' ')[0]}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            {/* 🔥 HIDE HISTORY VALUE CELL */}
                                            {canSeePrice && <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(sale.total)}</td>}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards (With Item Details) */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {currentHistory.map(sale => {
                             // 🔥 FILTER ITEMS FOR DISPLAY (MOBILE)
                             const visibleItems = sale.items.filter(item => {
                                const term = normalizeStr(historySearch);
                                const matchesSearch = !term || normalizeStr(item.name).includes(term) || normalizeStr(sale.ticketId).includes(term) || normalizeStr(sale.customer).includes(term);

                                const product = products.find(p => p.id === item.productId || p.id === item.partId || p.name === item.name);
                                const itemCategory = product ? product.category : 'Uncategorized';
                                const matchesCategory = historyCategoryFilter === 'All' || itemCategory === historyCategoryFilter;

                                return matchesSearch && matchesCategory;
                            });

                            if (visibleItems.length === 0) return null;

                            return (
                                <div key={sale.id} className="p-4 flex flex-col gap-2 cursor-pointer active:bg-gray-50" onClick={() => navigate(`/admin/orders/${sale.ticketId}`)}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{sale.ticketId}</span>
                                            <p className="text-sm font-bold text-slate-800 mt-1">{sale.customer}</p>
                                        </div>
                                        <div className="text-right">
                                            {/* 🔥 HIDE MOBILE HISTORY VALUE */}
                                            {canSeePrice && <p className="font-bold text-slate-900">{formatCurrency(sale.total)}</p>}
                                            <span className="text-[10px] text-gray-400">{sale.date.toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        {visibleItems.map((item, idx) => (
                                            <div key={idx} className="text-xs text-slate-500 flex justify-between">
                                                <span>{item.name} (x{item.qty||1})</span>
                                                {item.worker && <span className="text-[9px] bg-slate-100 px-1 rounded">{item.worker.split(' ')[0]}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {salesHistory.length > 0 && (
                        <div className="bg-gray-50 border-t px-6 py-4 flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500">Page {historyPage} of {totalHistoryPages}</span>
                            <div className="flex gap-2">
                                <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="p-2 bg-white border rounded-lg disabled:opacity-50"><ChevronLeft size={16}/></button>
                                <button onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))} disabled={historyPage === totalHistoryPages} className="p-2 bg-white border rounded-lg disabled:opacity-50"><ChevronRight size={16}/></button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- ADD FORM (Responsive) --- */}
            {isCreating && activeTab === 'products' && (
                <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 mt-6">
                    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-200">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><Package className="text-purple-600"/> Add Product</h2>
                            <div className="flex bg-gray-100 p-1 rounded-lg self-start">
                                <button onClick={() => setIsBulkMode(false)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${!isBulkMode ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Single</button>
                                <button onClick={() => setIsBulkMode(true)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${isBulkMode ? 'bg-white shadow text-purple-700' : 'text-slate-500'}`}>Bulk</button>
                            </div>
                        </div>
                        <form onSubmit={handleCreateProduct} className="space-y-6">
                            
                            {/* 🔥 DEVICE TYPE SELECTOR */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Device Type</label>
                                <div className="flex gap-2">
                                    {['iPhone', 'iPad', 'Watch'].map(type => (
                                        <button 
                                            key={type} 
                                            type="button"
                                            onClick={() => setDeviceType(type)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition ${
                                                deviceType === type 
                                                ? 'bg-purple-50 border-purple-200 text-purple-700' 
                                                : 'bg-white border-gray-200 text-slate-500 hover:bg-gray-50'
                                            }`}
                                        >
                                            {type === 'iPhone' ? <Smartphone size={14}/> : type === 'iPad' ? <Tablet size={14}/> : <Watch size={14}/>}
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isBulkMode ? "Base Name" : "Item Name"}</label>
                                    <input className="w-full p-3 border rounded-xl font-bold bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none" placeholder={isBulkMode ? "e.g. JCID Tag" : "e.g. Screen"} value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} required />
                                </div>
                                <div className={isBulkMode ? "col-span-1 md:col-span-2" : ""}>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Category</label>
                                    <input list="catList" className="w-full p-3 border rounded-xl outline-none focus:border-purple-500" placeholder="Type or Select..." value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} required />
                                    <datalist id="catList">{dynamicCategories.map(c => <option key={c} value={c}/>)}</datalist>
                                </div>
                                {isBulkMode ? (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Start</label>
                                            <select className="w-full p-3 border rounded-xl" value={newProduct.rangeStart} onChange={e => setNewProduct({...newProduct, rangeStart: e.target.value})}>
                                                {MODEL_DB[deviceType].map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">End</label>
                                            <select className="w-full p-3 border rounded-xl" value={newProduct.rangeEnd} onChange={e => setNewProduct({...newProduct, rangeEnd: e.target.value})}>
                                                {MODEL_DB[deviceType].map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Model</label>
                                        <input list="modelList" className="w-full p-3 border rounded-xl" placeholder={`e.g. ${MODEL_DB[deviceType][0]}`} value={newProduct.model} onChange={e => setNewProduct({...newProduct, model: e.target.value})} />
                                        <datalist id="modelList">
                                            {MODEL_DB[deviceType].map(m => <option key={m} value={m} />)}
                                        </datalist>
                                    </div>
                                )}
                                
                                <div className="col-span-1 md:col-span-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase">
                                            {isBulkMode && isCustomColorMode ? "Color Configuration" : "Colors (Comma Separated)"}
                                        </label>
                                        {isBulkMode && (
                                            <button type="button" onClick={() => setIsCustomColorMode(!isCustomColorMode)} className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 transition ${isCustomColorMode ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}><List size={14}/> {isCustomColorMode ? "Simple Mode" : "Customize per Model"}</button>
                                        )}
                                    </div>
                                    {isBulkMode && isCustomColorMode ? (
                                        <div className="border rounded-xl p-3 bg-gray-50 max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                                            {activeModelsInRange.map(m => (
                                                <div key={m} className="flex items-center gap-2"><span className="text-xs font-bold text-slate-600 w-28 shrink-0">{m}</span><input className="w-full p-2 text-xs border rounded bg-white outline-none focus:border-purple-500" placeholder="e.g. Black, White" value={modelSpecificColors[m] || ""} onChange={e => setModelSpecificColors({...modelSpecificColors, [m]: e.target.value})}/></div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="relative"><input className="w-full p-3 border rounded-xl outline-none" placeholder={isBulkMode ? "e.g. Black, White, Gold (Applies to all)" : "e.g. Black"} value={newProduct.color} onChange={e => setNewProduct({...newProduct, color: e.target.value})} />{isBulkMode && <p className="text-[10px] text-gray-400 mt-1 ml-1">Example: "Red, Blue" will create 2 items for each selected model.</p>}</div>
                                    )}
                                </div>

                                {/* 🔥 HIDE PRICE INPUT */}
                                {canSeePrice && <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Price</label><input type="text" className="w-full p-3 border rounded-xl font-mono font-bold" placeholder="0.00" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} required /></div>}
                                
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Stock</label><input type="number" className="w-full p-3 border rounded-xl font-bold" placeholder="0" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} /></div>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-3 font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
                                <button type="submit" disabled={actionLoading} className="flex-[2] bg-purple-900 text-white font-bold py-3 rounded-xl hover:bg-purple-800 shadow-lg flex justify-center items-center gap-2">{actionLoading ? <Loader2 className="animate-spin"/> : <Save size={20}/>} Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- RESTOCK & EDIT MODALS --- */}
             {restockItem && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-900">Add Stock</h3><button onClick={() => setRestockItem(null)}><X size={20}/></button></div>
                        <div className="bg-gray-50 p-4 rounded-xl mb-6 text-center"><p className="font-bold text-slate-700 line-clamp-1">{restockItem.name}</p><p className="text-xs text-slate-500 mt-1">Current: {restockItem.stock}</p></div>
                        <div className="relative mb-6"><ArrowUpCircle className="absolute left-4 top-3.5 text-green-500"/><input type="number" autoFocus className="w-full pl-12 pr-4 py-3 border-2 border-green-100 rounded-xl font-bold text-center" placeholder="Qty" value={restockQty} onChange={e => setRestockQty(e.target.value)}/></div>
                        <button onClick={handleRestock} disabled={actionLoading} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 shadow-lg">Confirm</button>
                    </div>
                </div>
            )}
            
            {/* SINGLE EDIT MODAL */}
            {editingItem && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><ClipboardEdit className="text-blue-600"/> Edit Product</h3><button onClick={() => setEditingItem(null)}><X size={20}/></button></div>
                        <form onSubmit={handleUpdateProduct} className="space-y-4">
                            <div><label className="text-xs font-bold text-slate-400 uppercase">Name</label><input className="w-full p-3 border rounded-xl font-bold bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})}/></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Category</label>
                                    <input 
                                        list="editCatList"
                                        className="w-full p-3 border rounded-xl outline-none" 
                                        value={editingItem.category} 
                                        onChange={e => setEditingItem({...editingItem, category: e.target.value})}
                                    />
                                    <datalist id="editCatList">
                                        {dynamicCategories.map(c => <option key={c} value={c}/>)}
                                    </datalist>
                                </div>
                                <div><label className="text-xs font-bold text-slate-400 uppercase">Model</label><input className="w-full p-3 border rounded-xl outline-none" value={editingItem.model} onChange={e => setEditingItem({...editingItem, model: e.target.value})}/></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-400 uppercase">Color</label><input className="w-full p-3 border rounded-xl outline-none" value={editingItem.color} onChange={e => setEditingItem({...editingItem, color: e.target.value})}/></div>
                                {/* 🔥 HIDE EDIT PRICE */}
                                {canSeePrice && <div><label className="text-xs font-bold text-slate-400 uppercase">Price</label><input type="text" className="w-full p-3 border rounded-xl outline-none font-mono font-bold" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: e.target.value})}/></div>}
                            </div>
                            <div><label className="text-xs font-bold text-red-400 uppercase flex gap-1"><AlertTriangle size={12}/> Manual Stock</label><input type="number" className="w-full p-3 border border-red-100 bg-red-50 rounded-xl outline-none font-bold text-red-900" value={editingItem.stock} onChange={e => setEditingItem({...editingItem, stock: e.target.value})}/></div>
                            <button type="submit" disabled={actionLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-lg mt-4">Save Changes</button>
                        </form>
                    </div>
                </div>
            )}

            {/* BULK EDIT MODAL */}
            {isBulkEditOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><Layers className="text-blue-600"/> Bulk Edit</h3>
                                <p className="text-xs text-gray-500">Updating {selectedIds.length} items</p>
                            </div>
                            <button onClick={() => setIsBulkEditOpen(false)}><X size={20}/></button>
                        </div>
                        <form onSubmit={handleBulkEditSave} className="space-y-4">
                            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 mb-4">
                                Only fields you fill in will be updated. Leave blank to keep existing values.
                            </div>
                            
                            {/* 🔥 HIDE BULK PRICE */}
                            {canSeePrice && (
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">New Price (Optional)</label>
                                    <input type="number" className="w-full p-3 border rounded-xl font-mono font-bold" placeholder="Leave blank to keep current" value={bulkEditData.price} onChange={e => setBulkEditData({...bulkEditData, price: e.target.value})}/>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">New Category</label>
                                    <input 
                                        list="bulkCatList"
                                        className="w-full p-3 border rounded-xl" 
                                        placeholder="Optional" 
                                        value={bulkEditData.category} 
                                        onChange={e => setBulkEditData({...bulkEditData, category: e.target.value})}
                                    />
                                    <datalist id="bulkCatList">
                                        {dynamicCategories.map(c => <option key={c} value={c}/>)}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">New Color</label>
                                    <input 
                                        className="w-full p-3 border rounded-xl" 
                                        placeholder="Optional" 
                                        value={bulkEditData.color} 
                                        onChange={e => setBulkEditData({...bulkEditData, color: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase">Set Exact Stock (Optional)</label>
                                <input type="number" className="w-full p-3 border rounded-xl font-bold" placeholder="Leave blank to keep current" value={bulkEditData.stock} onChange={e => setBulkEditData({...bulkEditData, stock: e.target.value})}/>
                            </div>

                            <button type="submit" disabled={actionLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-lg mt-2">
                                {actionLoading ? <Loader2 className="animate-spin mx-auto"/> : "Update All Items"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoreInventory;