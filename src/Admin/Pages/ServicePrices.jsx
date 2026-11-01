import React, { useState, useEffect, useMemo, useRef } from 'react';
import NairaSign from '../Components/NairaSign';
import SideDrawer from '../Components/SideDrawer';
import { 
    Search, Save, Filter, ChevronDown, ChevronRight,
    ArrowLeft, Smartphone, Loader2, ChevronLeft,
    Plus, X, Wrench, Layers, Trash2, Tablet, Watch, 
    Pencil, AlertCircle, RefreshCw, Check
} from 'lucide-react';
import { db } from '../../firebaseConfig';
import { 
    collection, doc, updateDoc, addDoc, serverTimestamp, 
    writeBatch, deleteDoc 
} from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AdminContext';
import { useData } from '../DataContext';
import { Toast, ConfirmModal } from '../Components/Feedback';

const formatCurrency = (amount) => `₦${Number(amount || 0).toLocaleString()}`;

// --- MODEL DATABASE ---
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
    ],
    Samsung: [
        'Samsung S20', 'Samsung S20+', 'Samsung S20 Ultra',
        'Samsung S21', 'Samsung S21+', 'Samsung S21 Ultra',
        'Samsung S22', 'Samsung S22+', 'Samsung S22 Ultra',
        'Samsung S23', 'Samsung S23+', 'Samsung S23 Ultra',
        'Samsung S24', 'Samsung S24+', 'Samsung S24 Ultra',
        'Samsung Note 10', 'Samsung Note 10+', 'Samsung Note 20', 'Samsung Note 20 Ultra',
        'Samsung A13', 'Samsung A14', 'Samsung A15', 'Samsung A33', 'Samsung A34', 'Samsung A35', 'Samsung A53', 'Samsung A54', 'Samsung A55'
    ]
};

const getModelRange = (type, start, end) => {
    const list = MODEL_DB[type] || [];
    const sIdx = list.indexOf(start);
    const eIdx = list.indexOf(end);
    if (sIdx === -1 || eIdx === -1) return [];
    const from = Math.min(sIdx, eIdx);
    const to = Math.max(sIdx, eIdx);
    return list.slice(from, to + 1);
};

const detectDeviceType = (item) => {
    if (item.type && MODEL_DB[item.type]) return item.type;
    if (item.category && MODEL_DB[item.category]) return item.category;
    const m = (item.model || '').toLowerCase();
    if (m.includes('ipad')) return 'iPad';
    if (m.includes('watch') || m.includes('series') || m.includes('ultra') || m.includes('se (')) return 'Watch';
    if (m.includes('samsung') || m.startsWith('galaxy')) return 'Samsung';
    return 'iPhone';
};

const ServicePrices = () => {
    const { role } = useAuth();
    const navigate = useNavigate();
    
    // --- Data State from Context ---
    const { services: globalServices, loading: globalLoading } = useData();
    const [services, setServices] = useState([]);
    
    // --- Filter & Search State ---
    const [searchTerm, setSearchTerm] = useState('');
    const [filterService, setFilterService] = useState('All');
    const [filterDeviceType, setFilterDeviceType] = useState('All'); 
    
    // --- Pagination State ---
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // --- Inline Edit State ---
    const [editingId, setEditingId] = useState(null);
    const [editPrice, setEditPrice] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const editInputRef = useRef(null);
    
    // --- Toast & Confirm Dialog State ---
    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ 
        isOpen: false, 
        title: '', 
        message: '', 
        confirmText: 'Delete', 
        confirmColor: 'bg-red-600',
        action: null 
    });

    // --- "Manage Services" Side Drawer State ---
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerSearch, setDrawerSearch] = useState('');
    const [expandedServices, setExpandedServices] = useState({});

    // --- New/Edit Service Modal State ---
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [serviceModalLoading, setServiceModalLoading] = useState(false);
    const [serviceModalData, setServiceModalData] = useState({
        isEdit: false,
        originalName: '',
        name: '',
        price: ''
    });

    // --- Add Model Price Rule Modal State ---
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [activeTab, setActiveTab] = useState('single'); // 'single' or 'bulk'
    const [addForm, setAddForm] = useState({
        deviceType: 'iPhone',
        service: '',
        model: MODEL_DB.iPhone[0],
        startModel: MODEL_DB.iPhone[0],
        endModel: MODEL_DB.iPhone[MODEL_DB.iPhone.length - 1],
        price: ''
    });

    const isEditor = role === 'admin' || role === 'ceo';
    const isViewer = role === 'content_creator' || role === 'manager';

    // Sync Firestore data
    useEffect(() => {
        if (globalServices) {
            setServices(globalServices);
        }
    }, [globalServices]);

    // Focus input on edit
    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    // Group services for the Manage Services Side Drawer
    const groupedServices = useMemo(() => {
        const groups = {};
        services.forEach(item => {
            const svcName = item.service?.trim() || 'Uncategorized';
            if (!groups[svcName]) {
                groups[svcName] = {
                    name: svcName,
                    rules: [],
                    basePrice: item.isBase ? item.price : 0
                };
            }
            if (item.isBase) {
                groups[svcName].basePrice = item.price;
            }
            groups[svcName].rules.push(item);
        });

        return Object.values(groups).map(g => {
            const validPrices = g.rules.map(r => Number(r.price) || 0).filter(p => p > 0);
            const minPrice = validPrices.length ? Math.min(...validPrices) : (g.basePrice || 0);
            return {
                ...g,
                minPrice,
                ruleCount: g.rules.filter(r => !r.isBase).length
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [services]);

    // Drawer Filtered Services
    const drawerFilteredServices = useMemo(() => {
        if (!drawerSearch.trim()) return groupedServices;
        const q = drawerSearch.toLowerCase();
        return groupedServices.filter(s => 
            s.name.toLowerCase().includes(q) || 
            s.rules.some(r => (r.model || '').toLowerCase().includes(q))
        );
    }, [groupedServices, drawerSearch]);

    // Unique Service Names for Dropdown Filter
    const uniqueServiceNames = useMemo(() => {
        return ['All', ...new Set(groupedServices.map(s => s.name))];
    }, [groupedServices]);

    // Filtered List for Main Table
    const filteredList = useMemo(() => {
        return services.filter(item => {
            if (item.isBase && !item.model) return false; // Hide pure base service placeholders from general matrix table
            const model = item.model || '';
            const service = item.service || '';
            const type = detectDeviceType(item);

            const matchSearch = model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                service.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchService = filterService === 'All' || service === filterService;
            const matchDevice = filterDeviceType === 'All' || type === filterDeviceType;

            return matchSearch && matchService && matchDevice;
        });
    }, [services, searchTerm, filterService, filterDeviceType]);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1); 
    }, [searchTerm, filterService, filterDeviceType]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredList.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;

    // Toggle drawer accordion
    const toggleServiceExpand = (svcName) => {
        setExpandedServices(prev => ({
            ...prev,
            [svcName]: !prev[svcName]
        }));
    };

    // --- ACTION: Save Inline Edit ---
    const handleSaveEdit = async (id) => {
        if (editPrice === '' || savingEdit) return;
        setSavingEdit(true);
        try {
            const priceNum = parseFloat(String(editPrice).replace(/[^0-9.]/g, '')) || 0;
            await updateDoc(doc(db, "Services", id), { price: priceNum });
            setToast({ message: "Price updated successfully!", type: 'success' });
            setEditingId(null);
        } catch (e) {
            console.error("Failed to update price:", e);
            setToast({ message: "Failed to update price", type: 'error' });
        } finally {
            setSavingEdit(false);
        }
    };

    // --- ACTION: Open Add Price Modal Pre-filled ---
    const handleOpenAddModel = (serviceName = '') => {
        const defaultType = 'iPhone';
        const models = MODEL_DB[defaultType];
        setAddForm({
            deviceType: defaultType,
            service: serviceName,
            tab: 'single',
            model: models[0],
            startModel: models[0],
            endModel: models[models.length - 1],
            price: ''
        });
        setIsAddModalOpen(true);
    };

    // Handle device type change in Add Modal
    const handleDeviceTypeChange = (newType) => {
        const list = MODEL_DB[newType] || MODEL_DB.iPhone;
        setAddForm(prev => ({
            ...prev,
            deviceType: newType,
            model: list[0] || '',
            startModel: list[0] || '',
            endModel: list[list.length - 1] || ''
        }));
    };

    // --- ACTION: Submit Add Price Rule (Single or Bulk) ---
    const handleAddPriceRule = async (e) => {
        e.preventDefault();
        const svc = addForm.service.trim();
        if (!svc) {
            setToast({ message: "Please specify a service type", type: 'error' });
            return;
        }

        setIsAdding(true);
        try {
            const priceNum = Number(addForm.price) || 0;

            if (addForm.tab === 'bulk') {
                const models = getModelRange(addForm.deviceType, addForm.startModel, addForm.endModel);
                if (models.length === 0) throw new Error("Invalid model range selected.");

                // Batch write up to 400 per commit
                const batch = writeBatch(db);
                models.forEach(model => {
                    const docId = `${svc}_${model}`.replace(/[^a-zA-Z0-9]/g, '_');
                    const docRef = doc(db, "Services", docId);
                    batch.set(docRef, {
                        model: model,
                        service: svc,
                        price: priceNum,
                        type: addForm.deviceType,
                        active: true,
                        createdAt: serverTimestamp()
                    }, { merge: true });
                });

                await batch.commit();
                setToast({ message: `Successfully generated ${models.length} price rules!`, type: 'success' });
            } else {
                if (!addForm.model) throw new Error("Please select or enter a device model.");
                const docId = `${svc}_${addForm.model}`.replace(/[^a-zA-Z0-9]/g, '_');
                const docRef = doc(db, "Services", docId);
                
                const batch = writeBatch(db);
                batch.set(docRef, {
                    model: addForm.model,
                    service: svc,
                    price: priceNum,
                    type: addForm.deviceType,
                    active: true,
                    createdAt: serverTimestamp()
                }, { merge: true });
                await batch.commit();

                setToast({ message: `Price rule for "${svc} - ${addForm.model}" saved!`, type: 'success' });
            }

            setIsAddModalOpen(false);
        } catch (error) {
            console.error("Error saving price rule:", error);
            setToast({ message: error.message || "Failed to save price rule", type: 'error' });
        } finally {
            setIsAdding(false);
        }
    };

    // --- ACTION: Delete Single Price Rule with Confirmation Popup ---
    const handleDeleteRule = (item) => {
        setConfirmConfig({
            isOpen: true,
            title: "Delete Price Rule?",
            message: `Are you sure you want to delete the price rule for "${item.service}" (${item.model})?`,
            confirmText: "Delete Rule",
            confirmColor: "bg-red-600 hover:bg-red-700",
            action: async () => {
                try {
                    await deleteDoc(doc(db, "Services", item.id));
                    setToast({ message: "Price rule deleted", type: "success" });
                } catch (error) {
                    console.error("Error deleting rule:", error);
                    setToast({ message: "Failed to delete rule", type: "error" });
                } finally {
                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    // --- ACTION: Delete Entire Service with Confirmation Popup ---
    const handleDeleteEntireService = (serviceGroup) => {
        const count = serviceGroup.rules.length;
        setConfirmConfig({
            isOpen: true,
            title: `Delete Service "${serviceGroup.name}"?`,
            message: `Are you sure you want to permanently delete "${serviceGroup.name}"? This will delete all ${count} associated model pricing rules. This action cannot be undone.`,
            confirmText: `Delete Service & ${count} Rules`,
            confirmColor: "bg-red-600 hover:bg-red-700",
            action: async () => {
                try {
                    const batch = writeBatch(db);
                    serviceGroup.rules.forEach(rule => {
                        batch.delete(doc(db, "Services", rule.id));
                    });
                    await batch.commit();
                    setToast({ message: `Service "${serviceGroup.name}" and ${count} price rules deleted!`, type: "success" });
                } catch (error) {
                    console.error("Error deleting service:", error);
                    setToast({ message: "Failed to delete service", type: "error" });
                } finally {
                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    // --- ACTION: Open New / Edit Service Modal ---
    const handleOpenServiceModal = (svc = null) => {
        if (svc) {
            setServiceModalData({
                isEdit: true,
                originalName: svc.name,
                name: svc.name,
                price: svc.basePrice || svc.minPrice || ''
            });
        } else {
            setServiceModalData({
                isEdit: false,
                originalName: '',
                name: '',
                price: ''
            });
        }
        setIsServiceModalOpen(true);
    };

    // --- ACTION: Submit New / Edit Service ---
    const handleSubmitServiceModal = async (e) => {
        e.preventDefault();
        const newName = serviceModalData.name.trim();
        if (!newName) return;

        setServiceModalLoading(true);
        try {
            const basePrice = Number(serviceModalData.price) || 0;

            if (serviceModalData.isEdit) {
                // Rename all records with the original service name
                const matchingRules = services.filter(s => s.service === serviceModalData.originalName);
                if (matchingRules.length > 0) {
                    const batch = writeBatch(db);
                    matchingRules.forEach(rule => {
                        batch.update(doc(db, "Services", rule.id), { service: newName });
                    });
                    await batch.commit();
                }
                setToast({ message: `Service renamed to "${newName}" across ${matchingRules.length} rules!`, type: 'success' });
            } else {
                // Check if already exists
                const existing = services.find(s => s.service?.toLowerCase() === newName.toLowerCase());
                if (existing) {
                    setToast({ message: `Service "${newName}" already exists!`, type: 'error' });
                    setServiceModalLoading(false);
                    return;
                }

                // Create a base service record
                const docId = `base_${newName}`.replace(/[^a-zA-Z0-9]/g, '_');
                const docRef = doc(db, "Services", docId);
                const batch = writeBatch(db);
                batch.set(docRef, {
                    service: newName,
                    model: 'Standard',
                    price: basePrice,
                    isBase: true,
                    type: 'iPhone',
                    active: true,
                    createdAt: serverTimestamp()
                });
                await batch.commit();

                setToast({ message: `New service "${newName}" created!`, type: 'success' });
            }

            setIsServiceModalOpen(false);
        } catch (error) {
            console.error("Failed to save service:", error);
            setToast({ message: error.message || "Failed to save service", type: 'error' });
        } finally {
            setServiceModalLoading(false);
        }
    };

    if (!isEditor && !isViewer) {
        return (
            <div className="min-h-screen flex items-center justify-center p-10 bg-slate-50 text-slate-600 font-bold">
                Access Denied: You do not have permissions to view this page.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
            {/* Toast Feedback */}
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />

            {/* Confirmation Modal */}
            <ConfirmModal 
                isOpen={confirmConfig.isOpen} 
                title={confirmConfig.title} 
                message={confirmConfig.message} 
                confirmText={confirmConfig.confirmText} 
                confirmColor={confirmConfig.confirmColor} 
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} 
                onConfirm={confirmConfig.action} 
            />

            {/* ======================================================== */}
            {/* SIDE DRAWER: MANAGE REPAIR SERVICES (v2 ARCHITECTURE)     */}
            {/* ======================================================== */}
            <SideDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title="Manage Repair Services"
                subtitle="Configure services, supported device models & per-model prices"
                width="640px"
            >
                {/* Drawer Top Controls */}
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            value={drawerSearch}
                            onChange={e => setDrawerSearch(e.target.value)}
                            placeholder="Filter services or models in drawer..."
                            className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-purple-500 bg-white shadow-sm"
                        />
                    </div>
                    {isEditor && (
                        <button
                            onClick={() => handleOpenServiceModal()}
                            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 shadow-sm transition shrink-0"
                        >
                            <Plus size={14} /> New Service
                        </button>
                    )}
                </div>

                {/* Service Cards List */}
                <div className="space-y-3">
                    {drawerFilteredServices.length > 0 ? (
                        drawerFilteredServices.map(svc => {
                            const isExpanded = !!expandedServices[svc.name];
                            return (
                                <div key={svc.name} className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm hover:border-slate-300 transition">
                                    {/* Service Header Row */}
                                    <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-3">
                                        <div 
                                            onClick={() => toggleServiceExpand(svc.name)}
                                            className="flex items-center gap-2.5 flex-1 cursor-pointer select-none"
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-slate-200/60 flex items-center justify-center text-slate-600 hover:bg-slate-300 transition">
                                                {isExpanded ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-extrabold text-slate-900">{svc.name}</h4>
                                                <p className="text-[11px] text-slate-500 font-medium">
                                                    {svc.ruleCount} supported models • Starting from <strong className="text-purple-700 font-mono">{formatCurrency(svc.minPrice)}</strong>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions on Service Card */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {isEditor && (
                                                <>
                                                    <button
                                                        onClick={() => handleOpenAddModel(svc.name)}
                                                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-bold flex items-center gap-1 transition"
                                                        title="Add supported model rule"
                                                    >
                                                        <Plus size={12} /> Model
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenServiceModal(svc)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 border border-slate-200 transition"
                                                        title="Rename Service"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteEntireService(svc)}
                                                        className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 transition"
                                                        title={`Delete entire service "${svc.name}"`}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Model Rules Table */}
                                    {isExpanded && (
                                        <div className="p-3 bg-white">
                                            {svc.rules.length > 0 ? (
                                                <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-xl">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] sticky top-0">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left">Device Model</th>
                                                                <th className="px-3 py-2 text-right">Price (₦)</th>
                                                                <th className="px-3 py-2 text-right w-16"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {svc.rules.map(rule => (
                                                                <tr key={rule.id} className="hover:bg-slate-50/70 transition">
                                                                    <td className="px-3 py-2 font-bold text-slate-700">
                                                                        {rule.model || 'Standard'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                                                                        {editingId === rule.id && isEditor ? (
                                                                            <input
                                                                                ref={editInputRef}
                                                                                type="number"
                                                                                min="0"
                                                                                value={editPrice}
                                                                                onChange={e => setEditPrice(e.target.value)}
                                                                                onKeyDown={e => {
                                                                                    if (e.key === 'Enter') handleSaveEdit(rule.id);
                                                                                    if (e.key === 'Escape') setEditingId(null);
                                                                                }}
                                                                                className="w-20 px-2 py-1 text-right border-2 border-purple-500 rounded-lg outline-none font-bold text-xs"
                                                                            />
                                                                        ) : (
                                                                            <span
                                                                                onClick={() => {
                                                                                    if (isEditor) {
                                                                                        setEditingId(rule.id);
                                                                                        setEditPrice(rule.price?.toString() || '0');
                                                                                    }
                                                                                }}
                                                                                className={`${isEditor ? 'cursor-pointer hover:text-purple-600 border-b border-dashed border-slate-300' : ''}`}
                                                                                title={isEditor ? "Click to edit price" : ""}
                                                                            >
                                                                                {formatCurrency(rule.price)}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right">
                                                                        <div className="flex items-center justify-end gap-1">
                                                                            {editingId === rule.id && isEditor ? (
                                                                                <button
                                                                                    onClick={() => handleSaveEdit(rule.id)}
                                                                                    disabled={savingEdit}
                                                                                    className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
                                                                                    title="Save (Enter)"
                                                                                >
                                                                                    {savingEdit ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}
                                                                                </button>
                                                                            ) : (
                                                                                isEditor && (
                                                                                    <button
                                                                                        onClick={() => handleDeleteRule(rule)}
                                                                                        className="p-1 text-slate-300 hover:text-red-600 rounded transition"
                                                                                        title="Delete model rule"
                                                                                    >
                                                                                        <Trash2 size={13} />
                                                                                    </button>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                    No model rules attached yet. Click "+ Model" to set device prices.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-8 text-center text-slate-400 text-xs">
                            No services match "{drawerSearch}".
                        </div>
                    )}
                </div>
            </SideDrawer>

            {/* ======================================================== */}
            {/* NEW / EDIT SERVICE MODAL                                 */}
            {/* ======================================================== */}
            {isServiceModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900">
                                    {serviceModalData.isEdit ? 'Edit Repair Service' : 'New Repair Service'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">e.g. Back Glass Repair, OLED Screen Replacement</p>
                            </div>
                            <button 
                                onClick={() => setIsServiceModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 rounded-full p-1"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitServiceModal} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Service Name *</label>
                                <input
                                    required
                                    value={serviceModalData.name}
                                    onChange={e => setServiceModalData({ ...serviceModalData, name: e.target.value })}
                                    placeholder="e.g. Screen Replacement, Battery Replacement"
                                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm font-semibold text-slate-900"
                                />
                            </div>

                            {!serviceModalData.isEdit && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Default Base Price (₦) - Optional</label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₦</div>
                                        <input
                                            type="number"
                                            min="0"
                                            value={serviceModalData.price}
                                            onChange={e => setServiceModalData({ ...serviceModalData, price: e.target.value })}
                                            placeholder="e.g. 15000"
                                            className="w-full pl-9 pr-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-semibold"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsServiceModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold text-xs transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={serviceModalLoading}
                                    className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition shadow-sm flex items-center justify-center gap-2"
                                >
                                    {serviceModalLoading ? <Loader2 size={15} className="animate-spin"/> : (serviceModalData.isEdit ? 'Save Changes' : 'Create Service')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* ADD PRICE RULE MODAL (SINGLE VS BULK RANGE)              */}
            {/* ======================================================== */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900">Add Model Repair Price</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Set repair pricing for a single model or whole series range</p>
                            </div>
                            <button 
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 rounded-full p-1"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAddPriceRule} className="p-6 space-y-4 overflow-y-auto">
                            {/* Service Selection */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Repair Service *</label>
                                <div className="relative">
                                    <Wrench className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                    <input 
                                        list="serviceOptionsList"
                                        required
                                        placeholder="e.g. Screen Replacement, Battery, Back Glass"
                                        value={addForm.service}
                                        onChange={e => setAddForm({ ...addForm, service: e.target.value })}
                                        className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-semibold"
                                    />
                                    <datalist id="serviceOptionsList">
                                        {uniqueServiceNames.filter(s => s !== 'All').map(s => (
                                            <option key={s} value={s} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>

                            {/* Device Type Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Device Type</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['iPhone', 'iPad', 'Watch', 'Samsung'].map(type => {
                                        const isSel = addForm.deviceType === type;
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => handleDeviceTypeChange(type)}
                                                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                                                    isSel 
                                                    ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm' 
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                {type === 'iPhone' ? <Smartphone size={13}/> :
                                                 type === 'iPad' ? <Tablet size={13}/> :
                                                 type === 'Watch' ? <Watch size={13}/> :
                                                 <Smartphone size={13}/>}
                                                <span>{type}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Single vs Bulk Mode Toggle */}
                            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setAddForm({ ...addForm, tab: 'single' })}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                                        addForm.tab === 'single'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Single Model
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAddForm({ ...addForm, tab: 'bulk' })}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                                        addForm.tab === 'bulk'
                                        ? 'bg-white text-purple-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Model Range (Bulk)
                                </button>
                            </div>

                            {/* Conditional Model Pickers */}
                            {addForm.tab === 'single' ? (
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Device Model *</label>
                                    <select
                                        required
                                        value={addForm.model}
                                        onChange={e => setAddForm({ ...addForm, model: e.target.value })}
                                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 outline-none text-sm font-semibold"
                                    >
                                        {(MODEL_DB[addForm.deviceType] || []).map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">From Model</label>
                                            <select
                                                value={addForm.startModel}
                                                onChange={e => setAddForm({ ...addForm, startModel: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 outline-none text-xs font-semibold"
                                            >
                                                {(MODEL_DB[addForm.deviceType] || []).map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">To Model</label>
                                            <select
                                                value={addForm.endModel}
                                                onChange={e => setAddForm({ ...addForm, endModel: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 outline-none text-xs font-semibold"
                                            >
                                                {(MODEL_DB[addForm.deviceType] || []).map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="text-xs text-purple-700 bg-purple-50 p-2.5 rounded-xl border border-purple-200 flex items-center justify-center gap-2 font-medium">
                                        <Layers size={14} className="text-purple-600"/> 
                                        <span>Will generate entries for <strong>{getModelRange(addForm.deviceType, addForm.startModel, addForm.endModel).length}</strong> models.</span>
                                    </div>
                                </div>
                            )}

                            {/* Price Input */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Price (₦) *</label>
                                <div className="relative">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₦</div>
                                    <input 
                                        type="number"
                                        required
                                        min="0"
                                        placeholder="e.g. 25000"
                                        value={addForm.price}
                                        onChange={e => setAddForm({ ...addForm, price: e.target.value })}
                                        className="w-full pl-9 pr-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-semibold"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-2 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold text-xs transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isAdding}
                                    className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition flex justify-center items-center gap-2 shadow-sm"
                                >
                                    {isAdding ? <Loader2 className="animate-spin" size={15}/> : "Save Price Rule"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* MAIN VIEW: TOP HEADER                                    */}
            {/* ======================================================== */}
            <div className="bg-white border-b border-slate-200 px-6 py-5 mb-8">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/admin/dashboard')} 
                            className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-600 transition"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft size={18}/>
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <Wrench size={22} className="text-purple-600" />
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Service Prices Management</h1>
                            </div>
                            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                                Manage repair prices per device model & configure full service catalogs.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => setIsDrawerOpen(true)}
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm"
                        >
                            <Wrench size={15} />
                            <span>Manage Services ({groupedServices.length})</span>
                        </button>

                        {isEditor && (
                            <button 
                                onClick={() => handleOpenAddModel()}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md hover:shadow-purple-500/20 transition"
                            >
                                <Plus size={15} /> Add Price Rule
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ======================================================== */}
            {/* MAIN CONTENT CONTAINER                                   */}
            {/* ======================================================== */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6">

                {/* Filter Toolbar */}
                <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row gap-2.5">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input 
                            className="w-full pl-10 pr-4 py-2 text-xs font-semibold text-slate-700 placeholder-slate-400 rounded-xl outline-none focus:bg-slate-50/80" 
                            placeholder="Search device model (e.g. iPhone 13 Pro Max) or service name..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    {/* Device Filter */}
                    <div className="relative min-w-[150px]">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            {filterDeviceType === 'iPhone' ? <Smartphone size={14}/> : 
                             filterDeviceType === 'iPad' ? <Tablet size={14}/> : 
                             filterDeviceType === 'Watch' ? <Watch size={14}/> : 
                             filterDeviceType === 'Samsung' ? <Smartphone size={14}/> :
                             <Filter size={14}/>}
                        </div>
                        <select 
                            className="w-full pl-8 pr-7 py-2 bg-slate-50 rounded-xl border-none outline-none text-xs font-bold text-slate-700 cursor-pointer appearance-none"
                            value={filterDeviceType}
                            onChange={e => setFilterDeviceType(e.target.value)}
                        >
                            <option value="All">All Devices</option>
                            <option value="iPhone">iPhone</option>
                            <option value="iPad">iPad</option>
                            <option value="Watch">Apple Watch</option>
                            <option value="Samsung">Samsung</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13}/>
                    </div>

                    {/* Service Category Filter */}
                    <div className="relative min-w-[210px]">
                        <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                        <select 
                            className="w-full pl-8 pr-7 py-2 bg-slate-50 rounded-xl border-none outline-none text-xs font-bold text-slate-700 cursor-pointer appearance-none"
                            value={filterService}
                            onChange={e => setFilterService(e.target.value)}
                        >
                            {uniqueServiceNames.map(s => (
                                <option key={s} value={s}>{s === 'All' ? 'All Services' : s}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13}/>
                    </div>
                </div>

                {/* Table Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    {globalLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                            <Loader2 size={28} className="animate-spin text-purple-600" />
                            <span className="text-xs font-bold text-slate-500">Loading service prices...</span>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-3.5 w-16">Type</th>
                                            <th className="px-6 py-3.5">Service Name</th>
                                            <th className="px-6 py-3.5">Device Model</th>
                                            <th className="px-6 py-3.5 text-right">Price (₦)</th>
                                            <th className="px-6 py-3.5 text-right w-24">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {currentItems.length > 0 ? (
                                            currentItems.map(item => {
                                                const devType = detectDeviceType(item);
                                                return (
                                                    <tr key={item.id} className="hover:bg-purple-50/40 transition">
                                                        <td className="px-6 py-3.5 text-slate-400">
                                                            {devType === 'iPad' ? <Tablet size={16} className="text-blue-500"/> : 
                                                             devType === 'Watch' ? <Watch size={16} className="text-amber-500"/> : 
                                                             devType === 'Samsung' ? <Smartphone size={16} className="text-emerald-500"/> :
                                                             <Smartphone size={16} className="text-purple-500"/>}
                                                        </td>
                                                        <td className="px-6 py-3.5 font-bold text-slate-900">
                                                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                                                                {item.service}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3.5 font-bold text-slate-700">
                                                            {item.model}
                                                        </td>
                                                        <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                                                            {editingId === item.id && isEditor ? (
                                                                <input 
                                                                    ref={editInputRef}
                                                                    type="number"
                                                                    min="0"
                                                                    className="w-24 px-2 py-1 border-2 border-purple-500 rounded-lg text-right outline-none bg-white font-mono text-xs font-bold"
                                                                    value={editPrice}
                                                                    onChange={e => setEditPrice(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') handleSaveEdit(item.id);
                                                                        if (e.key === 'Escape') setEditingId(null);
                                                                    }}
                                                                />
                                                            ) : (
                                                                <span 
                                                                    onClick={() => {
                                                                        if (isEditor) {
                                                                            setEditingId(item.id);
                                                                            setEditPrice(item.price?.toString() || '0');
                                                                        }
                                                                    }} 
                                                                    className={`${isEditor ? 'cursor-pointer hover:text-purple-600 border-b border-dashed border-slate-300' : ''}`}
                                                                    title={isEditor ? "Click to quick edit price" : ""}
                                                                >
                                                                    {formatCurrency(item.price)}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-3.5 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                {isEditor ? (
                                                                    <>
                                                                        {editingId === item.id ? (
                                                                            <button 
                                                                                onClick={() => handleSaveEdit(item.id)} 
                                                                                disabled={savingEdit} 
                                                                                className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 p-1.5 rounded-lg transition"
                                                                                title="Save (Enter)"
                                                                            >
                                                                                {savingEdit ? <Loader2 className="animate-spin" size={15}/> : <Check size={15}/>}
                                                                            </button>
                                                                        ) : (
                                                                            <button 
                                                                                onClick={() => {
                                                                                    setEditingId(item.id);
                                                                                    setEditPrice(item.price?.toString() || '0');
                                                                                }} 
                                                                                className="text-slate-400 hover:text-purple-600 p-1.5 hover:bg-purple-50 rounded-lg transition"
                                                                                title="Edit price"
                                                                            >
                                                                                <NairaSign size={14}/>
                                                                            </button>
                                                                        )}
                                                                        <button 
                                                                            onClick={() => handleDeleteRule(item)} 
                                                                            className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition"
                                                                            title="Delete price rule"
                                                                        >
                                                                            <Trash2 size={14}/>
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400 italic">View Only</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan="5" className="p-12 text-center text-slate-400">
                                                    <Wrench size={30} className="mx-auto mb-2 text-slate-300 opacity-60" />
                                                    No service price entries match your current search and filter criteria.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {filteredList.length > 0 && (
                                <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between">
                                    <span className="text-xs text-slate-500 font-medium">
                                        Showing <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> to <span className="font-bold text-slate-800">{Math.min(indexOfLastItem, filteredList.length)}</span> of <span className="font-bold text-slate-800">{filteredList.length}</span> results
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                                            disabled={currentPage === 1}
                                            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition"
                                        >
                                            <ChevronLeft size={16}/>
                                        </button>
                                        <span className="text-xs font-bold bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm text-slate-700">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                                            disabled={currentPage === totalPages}
                                            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition"
                                        >
                                            <ChevronRight size={16}/>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ServicePrices;
