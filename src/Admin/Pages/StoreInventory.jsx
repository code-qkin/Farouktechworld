import React, { useState, useEffect, useMemo } from 'react';
import { 
    Package, Plus, Search, Edit2, Trash2, Smartphone, 
    ArrowLeft, ArrowUpCircle, Save, X, 
    AlertTriangle, DollarSign, CheckCircle, ClipboardEdit, Loader2,
    Download, Filter, ChevronDown
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AdminContext';
import { db } from '../../firebaseConfig'; 
import { 
    collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, increment, serverTimestamp 
} from 'firebase/firestore';
import { Toast, ConfirmModal } from '../Components/Feedback';
import * as XLSX from 'xlsx';

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

// --- HELPER: Crash-Proof Number Parsers ---
const safeParseFloat = (val) => {
    if (!val) return 0;
    // Remove everything that isn't a number or a dot (e.g. removes commas, ₦, spaces)
    const clean = String(val).replace(/[^0-9.]/g, ''); 
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

const safeParseInt = (val) => {
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9]/g, '');
    const num = parseInt(clean, 10);
    return isNaN(num) ? 0 : num;
};

// --- SUB-COMPONENT: Stock Health Bar ---
const StockHealth = ({ stock }) => {
    let color = 'bg-green-500';
    let width = '100%';
    let label = 'In Stock';

    if (stock === 0) {
        color = 'bg-red-500';
        width = '5%';
        label = 'Out of Stock';
    } else if (stock < 5) {
        color = 'bg-orange-500';
        width = '30%';
        label = 'Low Stock';
    } else if (stock < 20) {
        color = 'bg-blue-500';
        width = '60%';
    }

    return (
        <div className="w-full max-w-[120px]">
            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 mb-1">
                <span>{stock} Units</span>
                <span className={stock === 0 ? 'text-red-500' : stock < 5 ? 'text-orange-500' : 'text-green-600'}>{label}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all duration-500`} style={{ width }}></div>
            </div>
        </div>
    );
};

const StoreInventory = () => {
    const { role } = useAuth(); 
    const navigate = useNavigate();
    
    // State
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'create'
    const [products, setProducts] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterStock, setFilterStock] = useState('All'); 

    // Modals
    const [restockItem, setRestockItem] = useState(null); 
    const [restockQty, setRestockQty] = useState('');
    const [editingItem, setEditingItem] = useState(null); 

    // Forms
    const [newProduct, setNewProduct] = useState({ name: '', category: '', type: '', model: '', price: '', stock: 0 });

    // Feedback
    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

    // 1. LIVE FETCH
    useEffect(() => {
        const q = query(collection(db, "Inventory"), orderBy("category"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const inventoryList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(inventoryList);
            setLoading(false);
        }, (error) => {
            console.error("Fetch Error:", error);
            setToast({ message: "Connection Error. Check Rules.", type: "error" });
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. METRICS
    const dynamicCategories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))].sort(), [products]);
    
    const stats = useMemo(() => {
        const totalItems = products.length;
        const lowStock = products.filter(p => p.stock > 0 && p.stock < 5).length;
        const outOfStock = products.filter(p => p.stock === 0).length;
        const totalValue = products.reduce((sum, p) => sum + (Number(p.price || 0) * Number(p.stock || 0)), 0);
        return { totalItems, lowStock, outOfStock, totalValue };
    }, [products]);

    // 3. ACTIONS
    const handleExport = () => {
        const data = products.map(p => ({
            "Product": p.name, "Category": p.category, "Model": p.model,
            "Price": p.price, "Stock": p.stock, "Value": p.price * p.stock
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventory");
        XLSX.writeFile(wb, "FTW_Inventory.xlsx");
    };

    const handleCreateProduct = async (e) => {
        e.preventDefault();
        if (!newProduct.name || !newProduct.category) return setToast({ message: "Details required", type: 'error' });
        
        setActionLoading(true);
        try {
            // 🔥 CRITICAL FIX: Safe Parsing prevents "NaN" errors
            const safePrice = safeParseFloat(newProduct.price);
            const safeStock = safeParseInt(newProduct.stock);

            await addDoc(collection(db, "Inventory"), {
                name: newProduct.name.trim(),
                category: newProduct.category.trim(),
                model: newProduct.model ? newProduct.model.trim() : "",
                type: newProduct.type ? newProduct.type.trim() : "",
                price: safePrice,
                stock: safeStock,
                lastUpdated: serverTimestamp()
            });

            setNewProduct({ name: '', category: '', type: '', model: '', price: '', stock: 0 });
            setToast({ message: "Product Added Successfully", type: "success" });
            setViewMode('list');
        } catch (e) { 
            console.error("ADD ERROR:", e);
            let msg = "Failed to add product.";
            if(e.code === 'permission-denied') msg = "Permission Denied. Check Rules.";
            setToast({ message: msg, type: "error" }); 
        }
        setActionLoading(false);
    };

    const handleUpdateProduct = async (e) => {
        e.preventDefault();
        if (!editingItem) return;
        setActionLoading(true);
        try {
            await updateDoc(doc(db, "Inventory", editingItem.id), {
                name: editingItem.name,
                category: editingItem.category,
                model: editingItem.model,
                price: safeParseFloat(editingItem.price),
                stock: safeParseInt(editingItem.stock),
                lastUpdated: serverTimestamp()
            });
            setToast({ message: "Saved Changes", type: "success" });
            setEditingItem(null);
        } catch (e) { setToast({ message: "Update Failed", type: "error" }); }
        setActionLoading(false);
    };

    const handleRestock = async () => {
        if (!restockItem || !restockQty) return;
        setActionLoading(true);
        try {
            const qty = safeParseInt(restockQty);
            if(qty > 0) {
                await updateDoc(doc(db, "Inventory", restockItem.id), { stock: increment(qty) });
                setToast({ message: "Stock Added", type: "success" });
                setRestockItem(null); setRestockQty('');
            }
        } catch (e) { setToast({ message: "Failed", type: "error" }); }
        setActionLoading(false);
    };

    const handleDelete = (item) => {
        setConfirmConfig({
            isOpen: true, title: "Delete Item?", message: `Permanently delete "${item.name}"?`, confirmText: "Delete", confirmColor: "bg-red-600",
            action: async () => {
                try {
                    await deleteDoc(doc(db, "Inventory", item.id));
                    setToast({ message: "Deleted.", type: "success" });
                } catch(e) {
                    setToast({message: "Delete Failed", type: "error"});
                }
                setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    // Filter Logic
    const filteredProducts = products.filter(product => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = product.name.toLowerCase().includes(term) || product.model?.toLowerCase().includes(term);
        const matchesCategory = filterCategory === 'All' || product.category === filterCategory;
        const matchesStock = filterStock === 'All' || (filterStock === 'Low' && product.stock < 5 && product.stock > 0) || (filterStock === 'Out' && product.stock === 0);
        return matchesSearch && matchesCategory && matchesStock;
    });

    if (role !== 'admin') return <Navigate to="/admin/dashboard" replace />;

    return (
        <div className="min-h-screen bg-gray-50 p-6 sm:p-10 font-sans text-slate-900">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={confirmConfig.action} />

            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-100 text-slate-600 transition"><ArrowLeft size={20}/></button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">Inventory</h1>
                        <p className="text-sm font-medium text-slate-500">Manage stock levels & pricing</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExport} className="flex items-center gap-2 bg-white border border-gray-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition text-sm shadow-sm"><Download size={16} /> Export</button>
                    <button onClick={() => setViewMode(viewMode === 'list' ? 'create' : 'list')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold shadow-md transition text-sm ${viewMode === 'list' ? 'bg-purple-900 text-white hover:bg-purple-800' : 'bg-white text-slate-700 hover:bg-gray-50 border border-gray-200'}`}>
                        {viewMode === 'list' ? <><Plus size={18}/> Add Product</> : <><ArrowLeft size={18}/> Back to List</>}
                    </button>
                </div>
            </div>

            {/* --- STATS BAR --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between h-28">
                    <div className="flex justify-between"><span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Value</span><div className="bg-green-50 p-1.5 rounded-lg text-green-600"><DollarSign size={16}/></div></div>
                    <span className="text-2xl font-black text-slate-900">{formatCurrency(stats.totalValue)}</span>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between h-28">
                    <div className="flex justify-between"><span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Stock</span><div className="bg-blue-50 p-1.5 rounded-lg text-blue-600"><Package size={16}/></div></div>
                    <span className="text-2xl font-black text-slate-900">{stats.totalItems}</span>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between h-28">
                    <div className="flex justify-between"><span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Low Stock</span><div className="bg-orange-50 p-1.5 rounded-lg text-orange-600"><AlertTriangle size={16}/></div></div>
                    <span className="text-2xl font-black text-orange-600">{stats.lowStock} Items</span>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between h-28">
                    <div className="flex justify-between"><span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Out of Stock</span><div className="bg-red-50 p-1.5 rounded-lg text-red-600"><X size={16}/></div></div>
                    <span className="text-2xl font-black text-red-600">{stats.outOfStock} Items</span>
                </div>
            </div>

            {/* --- VIEW: INVENTORY LIST --- */}
            {viewMode === 'list' && (
                <div className="space-y-6 animate-in fade-in">
                    
                    {/* Control Bar */}
                    <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 flex flex-col lg:flex-row gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                            <input className="w-full pl-10 pr-4 py-3 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400 font-medium" placeholder="Search by Name, Model, Category..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                        </div>
                        <div className="h-auto w-px bg-gray-200 mx-2 hidden lg:block"></div>
                        <div className="flex gap-2 p-1 lg:p-0">
                            <div className="relative min-w-[160px]">
                                <Filter className="absolute left-3 top-3.5 text-gray-400" size={16}/>
                                <select className="w-full pl-9 pr-8 py-3 bg-gray-50 rounded-xl border-none outline-none text-sm font-bold text-slate-600 cursor-pointer appearance-none" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                                    <option value="All">All Categories</option>
                                    {dynamicCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={14}/>
                            </div>
                            <div className="relative min-w-[150px]">
                                <AlertTriangle className="absolute left-3 top-3.5 text-gray-400" size={16}/>
                                <select className="w-full pl-9 pr-8 py-3 bg-gray-50 rounded-xl border-none outline-none text-sm font-bold text-slate-600 cursor-pointer appearance-none" value={filterStock} onChange={e => setFilterStock(e.target.value)}>
                                    <option value="All">All Levels</option>
                                    <option value="Low">Low Stock</option>
                                    <option value="Out">Out of Stock</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={14}/>
                            </div>
                        </div>
                    </div>

                    {/* Data Grid */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Product Info</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Price</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-40">Stock Level</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredProducts.map((p) => (
                                        <tr key={p.id} className="hover:bg-purple-50/30 transition group">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900">{p.name}</div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <Smartphone size={10}/> {p.model}
                                                    {p.type && <span className="bg-gray-100 px-1.5 rounded border border-gray-200">{p.type}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">{p.category}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">{formatCurrency(p.price)}</td>
                                            <td className="px-6 py-4"><StockHealth stock={p.stock}/></td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setRestockItem(p)} className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 hover:scale-105 transition shadow-sm" title="Add Stock"><ArrowUpCircle size={16}/></button>
                                                    <button onClick={() => setEditingItem(p)} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-105 transition shadow-sm" title="Edit"><Edit2 size={16}/></button>
                                                    <button onClick={() => handleDelete(p)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:scale-105 transition shadow-sm" title="Delete"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <tr><td colSpan="5" className="p-12 text-center text-slate-400 italic">No products found matching your search.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- VIEW: CREATE PRODUCT FORM --- */}
            {viewMode === 'create' && (
                <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
                        <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2"><Package className="text-purple-600"/> Product Details</h2>
                        
                        <form onSubmit={handleCreateProduct} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Item Name</label>
                                    <input className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-bold text-slate-900 bg-gray-50 focus:bg-white transition" placeholder="e.g. iPhone 13 Pro Screen (OLED)" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Category</label>
                                    <input list="catList" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-purple-500" placeholder="Select..." value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} required />
                                    <datalist id="catList">{dynamicCategories.map(c => <option key={c} value={c}/>)}</datalist>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Model</label>
                                    <input className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-purple-500" placeholder="e.g. A2638" value={newProduct.model} onChange={e => setNewProduct({...newProduct, model: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selling Price</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-3.5 text-gray-400" size={16}/>
                                        <input type="text" className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-purple-500 font-mono font-bold" placeholder="0.00" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} required />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Initial Stock</label>
                                    <input type="number" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-purple-500 font-bold" placeholder="0" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} />
                                </div>
                            </div>
                            <button type="submit" disabled={actionLoading} className="w-full bg-purple-900 text-white font-bold py-4 rounded-xl hover:bg-purple-800 shadow-lg transition flex justify-center items-center gap-2 mt-4">
                                {actionLoading ? <Loader2 className="animate-spin"/> : <><Save size={20}/> Save to Inventory</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- RESTOCK MODAL --- */}
            {restockItem && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-900">Add Stock</h3>
                            <button onClick={() => setRestockItem(null)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6 text-center">
                            <p className="font-bold text-slate-700 line-clamp-1">{restockItem.name}</p>
                            <p className="text-xs text-slate-500 mt-1">Current: {restockItem.stock}</p>
                        </div>
                        <div className="relative mb-6">
                            <ArrowUpCircle className="absolute left-4 top-3.5 text-green-500" size={24}/>
                            <input type="number" autoFocus className="w-full pl-12 pr-4 py-3 border-2 border-green-100 rounded-xl focus:border-green-500 outline-none font-bold text-xl text-center" placeholder="Qty" value={restockQty} onChange={e => setRestockQty(e.target.value)}/>
                        </div>
                        <button onClick={handleRestock} disabled={actionLoading} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 shadow-lg transition">Confirm</button>
                    </div>
                </div>
            )}

            {/* --- EDIT MODAL --- */}
            {editingItem && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><ClipboardEdit className="text-blue-600"/> Edit Product</h3>
                            <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleUpdateProduct} className="space-y-4">
                            <div><label className="text-xs font-bold text-slate-400 uppercase">Name</label><input className="w-full p-3 border rounded-xl font-bold text-slate-800 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})}/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-400 uppercase">Category</label><input className="w-full p-3 border rounded-xl outline-none" value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-slate-400 uppercase">Model</label><input className="w-full p-3 border rounded-xl outline-none" value={editingItem.model} onChange={e => setEditingItem({...editingItem, model: e.target.value})}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-400 uppercase">Price</label><input type="text" className="w-full p-3 border rounded-xl outline-none font-mono font-bold" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-red-400 uppercase flex gap-1"><AlertTriangle size={12}/> Manual Stock</label><input type="number" className="w-full p-3 border border-red-100 bg-red-50 rounded-xl outline-none font-bold text-red-900" value={editingItem.stock} onChange={e => setEditingItem({...editingItem, stock: e.target.value})}/></div>
                            </div>
                            <button type="submit" disabled={actionLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-lg mt-4">Save Changes</button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default StoreInventory;