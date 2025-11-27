import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Search, Edit, Trash2, Smartphone, RefreshCw, Layers, ShoppingBag, ArrowLeft, Box, ArrowUpCircle, Save, X } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AdminContext';
import { db } from '../../firebaseConfig'; 
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, increment } from 'firebase/firestore';

const StoreInventory = () => {
    const { role } = useAuth(); 
    const navigate = useNavigate();
    
    if (role !== 'admin') {
        return <Navigate to="/admin/dashboard" replace />;
    }

    // --- State ---
    const [activeTab, setActiveTab] = useState('inventory'); 
    const [products, setProducts] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');

    // Restock Modal State
    const [restockItem, setRestockItem] = useState(null); 
    const [restockQty, setRestockQty] = useState('');

    // New Product Form State
    const [newProduct, setNewProduct] = useState({
        name: '', category: '', type: '', model: '', stock: ''
    });

    // 1. LIVE FETCH
    useEffect(() => {
        const q = query(collection(db, "Inventory"), orderBy("category"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const inventoryList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProducts(inventoryList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching inventory:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. 🔥 DYNAMIC CATEGORIES (The Magic Part)
    // This automatically calculates the list of categories from your actual data
    const dynamicCategories = useMemo(() => {
        // Get all categories from products, remove nulls/undefined
        const allCats = products.map(p => p.category).filter(Boolean);
        // Remove duplicates using Set and sort A-Z
        return [...new Set(allCats)].sort();
    }, [products]);

    // 3. CREATE PRODUCT
    const handleCreateProduct = async (e) => {
        e.preventDefault();
        if (!newProduct.name || !newProduct.category) return;

        try {
            await addDoc(collection(db, "Inventory"), {
                name: newProduct.name,
                category: newProduct.category, // Saves whatever you typed or selected
                type: newProduct.type,
                model: newProduct.model,
                stock: 0, 
                lastUpdated: new Date()
            });

            setNewProduct({ name: '', category: '', type: '', model: '', stock: '' });
            alert(`Success! Added new product to "${newProduct.category}"`);
            setActiveTab('inventory'); 

        } catch (error) {
            console.error("Error:", error);
            alert("Failed to create product.");
        }
    };

    // 4. RESTOCK
    const handleRestock = async (e) => {
        e.preventDefault();
        if (!restockItem || !restockQty) return;

        try {
            const itemRef = doc(db, "Inventory", restockItem.id);
            await updateDoc(itemRef, { stock: increment(parseInt(restockQty)) });
            setRestockItem(null);
            setRestockQty('');
        } catch (error) {
            console.error("Restock failed:", error);
            alert("Failed to update stock.");
        }
    };

    const handleDeleteProduct = async (id) => {
        if (!window.confirm("Delete this product definition permanently?")) return;
        try { await deleteDoc(doc(db, "Inventory", id)); } catch (e) { console.error(e); }
    };

    const filteredProducts = products.filter(product => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = product.name.toLowerCase().includes(term) || product.model.toLowerCase().includes(term);
        const matchesCategory = filterCategory === 'All' || product.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-6 p-10 relative">
            
            {/* Header & Tabs */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2 rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 text-gray-600"><ArrowLeft size={24}/></button>
                    <h1 className="text-3xl font-extrabold text-purple-900 flex items-center gap-2">
                        <Package className="w-8 h-8 text-indigo-600"/> Store Management
                    </h1>
                </div>

                <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
                    <button onClick={() => setActiveTab('inventory')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'inventory' ? 'bg-white text-purple-900 shadow-md' : 'text-gray-500'}`}>
                        <Layers size={18} /> Inventory List
                    </button>
                    <button onClick={() => setActiveTab('create')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-white text-purple-900 shadow-md' : 'text-gray-500'}`}>
                        <Plus size={18} /> Define New Product
                    </button>
                </div>
            </div>

            {/* --- TAB 1: INVENTORY LIST --- */}
            {activeTab === 'inventory' && (
                <div className="space-y-6 animate-in fade-in">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                            <input type="text" placeholder="Search 'iPhone 13', 'OLED'..." className="w-full pl-10 p-2 border rounded-lg" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                        </div>
                        
                        {/* 🔥 DYNAMIC FILTER DROPDOWN */}
                        <select className="p-2 border rounded-lg bg-white max-w-[200px]" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                            <option value="All">All Categories</option>
                            {dynamicCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl shadow-xl overflow-x-auto border border-gray-100">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Level</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-purple-50 transition">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{product.name}</div>
                                            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded w-fit mt-1">{product.category}</div>
                                        </td>
                                        <td className="px-6 py-4 flex items-center gap-2">
                                            <Smartphone size={16} className="text-purple-500"/> <span className="text-sm">{product.model}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <span className={`text-lg font-bold ${product.stock === 0 ? 'text-red-500' : 'text-gray-700'}`}>{product.stock}</span>
                                                <button onClick={() => setRestockItem(product)} className="bg-green-100 hover:bg-green-200 text-green-700 p-1 rounded-full transition" title="Add Stock">
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                            {product.stock === 0 && <span className="text-[10px] text-red-500 font-bold uppercase">Out of Stock</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-3">
                                            <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:bg-red-50 p-2 rounded-full"><Trash2 size={18}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- TAB 2: CREATE PRODUCT --- */}
            {activeTab === 'create' && (
                <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl border-t-4 border-purple-600">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-extrabold text-gray-900">Define New Product</h2>
                            <p className="text-gray-500">Create a new item. You can select an existing category or type a new one.</p>
                        </div>

                        <form onSubmit={handleCreateProduct} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Product Name</label>
                                    <input type="text" placeholder="e.g., Samsung S24 Ultra Screen" required className="w-full p-3 border rounded-lg" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                                </div>
                                
                                {/* 🔥 SMART CATEGORY INPUT (Select or Type) */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                                    <input 
                                        list="category-options" 
                                        type="text" 
                                        placeholder="Select or Type New..." 
                                        required
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                        value={newProduct.category} 
                                        onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                                    />
                                    {/* Datalist powers the dropdown suggestions */}
                                    <datalist id="category-options">
                                        {dynamicCategories.map(cat => <option key={cat} value={cat} />)}
                                    </datalist>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Type / Sub-category</label>
                                    <input type="text" placeholder="e.g. OLED" required className="w-full p-3 border rounded-lg" value={newProduct.type} onChange={e => setNewProduct({...newProduct, type: e.target.value})} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Compatible Models</label>
                                    <input type="text" placeholder="e.g., S24 Ultra" required className="w-full p-3 border rounded-lg" value={newProduct.model} onChange={e => setNewProduct({...newProduct, model: e.target.value})} />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-purple-900 text-white font-bold py-4 rounded-xl hover:bg-purple-800 shadow-lg flex justify-center items-center gap-2">
                                <Save size={20} /> Create Product Entry
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- RESTOCK MODAL --- */}
            {restockItem && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold text-purple-900">Add Stock</h3>
                            <button onClick={() => setRestockItem(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>
                        <div className="mb-4">
                            <p className="text-sm text-gray-500">Product:</p>
                            <p className="font-bold text-gray-800">{restockItem.name}</p>
                            <p className="text-xs text-gray-500">{restockItem.model}</p>
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Quantity Received</label>
                            <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
                                <div className="bg-gray-100 p-3 border-r"><ArrowUpCircle size={20} className="text-green-600"/></div>
                                <input type="number" placeholder="0" autoFocus className="w-full p-3 outline-none font-bold text-lg" value={restockQty} onChange={e => setRestockQty(e.target.value)} />
                            </div>
                        </div>
                        <button onClick={handleRestock} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 shadow-lg">Confirm Update</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoreInventory;