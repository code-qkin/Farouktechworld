import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, Save, DollarSign, Filter, ChevronDown, 
    ArrowLeft, Smartphone, Loader2, ChevronLeft, ChevronRight, 
    Plus, X, Wrench, ArrowRightCircle 
} from 'lucide-react';
import { db } from '../../firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AdminContext';
import { Toast } from '../Components/Feedback';

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

const ServicePrices = () => {
    const { role } = useAuth();
    const navigate = useNavigate();
    
    // --- Data State ---
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // --- Filter State ---
    const [searchTerm, setSearchTerm] = useState('');
    const [filterService, setFilterService] = useState('All');
    
    // --- Pagination State ---
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // --- Inline Edit State ---
    const [editingId, setEditingId] = useState(null);
    const [editPrice, setEditPrice] = useState('');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ message: '', type: '' });

    // --- Add Service Modal State ---
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newServiceData, setNewServiceData] = useState({
        startModel: '',
        endModel: '',
        service: '', // Now flexible
        price: ''
    });

    // 1. Fetch Data
    useEffect(() => {
        const q = query(collection(db, "Services"), orderBy("model"));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setServices(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // 2. Filters & Search
    const uniqueServiceNames = useMemo(() => [...new Set(services.map(s => s.service))].sort(), [services]);

    const filteredList = useMemo(() => {
        return services.filter(item => {
            // Guard against missing fields
            const model = item.model || '';
            const service = item.service || '';
            
            const matchSearch = model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                service.toLowerCase().includes(searchTerm.toLowerCase());
            const matchFilter = filterService === 'All' || service === filterService;
            return matchSearch && matchFilter;
        });
    }, [services, searchTerm, filterService]);

    // 3. Pagination Logic
    useEffect(() => {
        setCurrentPage(1); 
    }, [searchTerm, filterService]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredList.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredList.length / itemsPerPage);

    // 4. Actions: Inline Edit
    const handleSave = async (id) => {
        if (!editPrice) return;
        setSaving(true);
        try {
            const priceNum = parseFloat(editPrice.replace(/[^0-9.]/g, ''));
            await updateDoc(doc(db, "Services", id), { price: priceNum });
            setToast({ message: "Price Updated!", type: 'success' });
            setEditingId(null);
        } catch (e) {
            setToast({ message: "Update Failed", type: 'error' });
        }
        setSaving(false);
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setEditPrice(item.price?.toString() || '');
    };

    // 5. Actions: Add New Service
    const handleAddService = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!newServiceData.startModel || !newServiceData.service || !newServiceData.price) {
            alert("Please fill in Start Model, Service Type, and Price");
            return;
        }

        setIsAdding(true);
        try {
            // Logic: If End Model exists, create a range string (e.g., "iPhone 6 - 8")
            // Otherwise just use Start Model (e.g., "iPhone X")
            const finalModelString = newServiceData.endModel 
                ? `${newServiceData.startModel} - ${newServiceData.endModel}`
                : newServiceData.startModel;

            await addDoc(collection(db, "Services"), {
                model: finalModelString,
                service: newServiceData.service, // Can be custom or from list
                price: Number(newServiceData.price),
                active: true,
                createdAt: serverTimestamp()
            });

            setToast({ message: "New Service Added!", type: 'success' });
            setIsAddModalOpen(false);
            // Reset Form
            setNewServiceData({ startModel: '', endModel: '', service: '', price: '' }); 
        } catch (error) {
            console.error("Error adding service:", error);
            setToast({ message: "Failed to add service", type: 'error' });
        } finally {
            setIsAdding(false);
        }
    };

    const handleNewServiceChange = (e) => {
        setNewServiceData({ ...newServiceData, [e.target.name]: e.target.value });
    };

    if (role !== 'admin') return <div className="p-10">Access Denied</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 relative">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2 rounded-xl border shadow-sm hover:bg-gray-50"><ArrowLeft size={20}/></button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Service Pricing</h1>
                        <p className="text-slate-500 text-sm">Manage repair costs for all models.</p>
                    </div>
                </div>
                
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all"
                >
                    <Plus size={18} /> Add Service
                </button>
            </div>

            {/* Controls */}
            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                    <input 
                        className="w-full pl-10 pr-4 py-2.5 outline-none text-sm text-slate-700 placeholder-slate-400 font-medium rounded-lg" 
                        placeholder="Search model or service..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="h-px sm:h-auto w-full sm:w-px bg-gray-200 mx-1"></div>
                <div className="relative min-w-[200px]">
                    <Filter className="absolute left-3 top-3 text-gray-400" size={16}/>
                    <select 
                        className="w-full pl-9 pr-8 py-2.5 bg-gray-50 rounded-lg border-none outline-none text-sm font-bold text-slate-600 cursor-pointer appearance-none"
                        value={filterService}
                        onChange={e => setFilterService(e.target.value)}
                    >
                        <option value="All">All Services</option>
                        {uniqueServiceNames.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={14}/>
                </div>
            </div>

            {/* Data Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                {loading ? (
                    <div className="p-10 text-center text-slate-400">Loading database...</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-slate-500 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Service</th>
                                        <th className="px-6 py-4">Model</th>
                                        <th className="px-6 py-4 text-right">Price (₦)</th>
                                        <th className="px-6 py-4 text-right w-24">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {currentItems.length > 0 ? currentItems.map(item => (
                                        <tr key={item.id} className="hover:bg-purple-50/50 transition">
                                            <td className="px-6 py-3 font-medium text-slate-900">{item.service}</td>
                                            <td className="px-6 py-3 flex items-center gap-2 text-slate-600">
                                                <Smartphone size={14} className="text-slate-400"/> {item.model}
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono font-bold text-slate-800">
                                                {editingId === item.id ? (
                                                    <input 
                                                        autoFocus
                                                        className="w-24 p-1.5 border-2 border-purple-500 rounded text-right outline-none bg-white"
                                                        value={editPrice}
                                                        onChange={e => setEditPrice(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleSave(item.id)}
                                                    />
                                                ) : (
                                                    <span onClick={() => startEdit(item)} className="cursor-pointer hover:text-purple-600 border-b border-transparent hover:border-purple-300">
                                                        {formatCurrency(item.price)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                {editingId === item.id ? (
                                                    <button onClick={() => handleSave(item.id)} disabled={saving} className="text-green-600 hover:text-green-700 bg-green-50 p-2 rounded-lg transition">
                                                        {saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                                                    </button>
                                                ) : (
                                                    <button onClick={() => startEdit(item)} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition">
                                                        ₦
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="4" className="p-8 text-center text-slate-400">No services found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {filteredList.length > 0 && (
                            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                                <span className="text-sm text-gray-500 hidden sm:block">
                                    Showing <span className="font-bold">{indexOfFirstItem + 1}</span> to <span className="font-bold">{Math.min(indexOfLastItem, filteredList.length)}</span> of <span className="font-bold">{filteredList.length}</span> results
                                </span>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition"
                                    >
                                        <ChevronLeft size={18}/>
                                    </button>
                                    <span className="text-xs font-bold bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button 
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition"
                                    >
                                        <ChevronRight size={18}/>
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* --- ADD SERVICE MODAL (Updated) --- */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800">Add New Service</h3>
                            <button 
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1.5 transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddService} className="p-6 space-y-4">
                            
                            {/* UPDATED: Service Type with Datalist (Allows custom entry) */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Service Type</label>
                                <div className="relative">
                                    <Wrench className="absolute left-3 top-3 text-gray-400" size={16}/>
                                    <input 
                                        list="serviceOptions"
                                        name="service"
                                        placeholder="Select or Type New Service..."
                                        value={newServiceData.service}
                                        onChange={handleNewServiceChange}
                                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium"
                                        required 
                                        autoFocus
                                    />
                                    <datalist id="serviceOptions">
                                        <option value="Screen Replacement" />
                                        <option value="Glass Replacement" />
                                        <option value="Battery Replacement" />
                                        <option value="Back Glass" />
                                        <option value="Charging Port" />
                                        <option value="Face ID Repair" />
                                        <option value="Camera Lens" />
                                        <option value="General Service" />
                                    </datalist>
                                </div>
                            </div>

                            {/* UPDATED: Start & End Model Inputs */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Start Model</label>
                                    <input 
                                        type="text" 
                                        name="startModel"
                                        placeholder="e.g. iPhone 6"
                                        value={newServiceData.startModel}
                                        onChange={handleNewServiceChange}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">End Model (Opt)</label>
                                    <input 
                                        type="text" 
                                        name="endModel"
                                        placeholder="e.g. iPhone 8"
                                        value={newServiceData.endModel}
                                        onChange={handleNewServiceChange}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium"
                                    />
                                </div>
                            </div>
                            
                            {/* Visual Preview of Result */}
                            {newServiceData.startModel && (
                                <div className="text-xs text-center text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 flex items-center justify-center gap-2">
                                    Preview: <span className="font-bold text-gray-800">
                                        {newServiceData.startModel} 
                                        {newServiceData.endModel ? ` - ${newServiceData.endModel}` : ''}
                                    </span>
                                </div>
                            )}

                            {/* Price */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Price (₦)</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-2.5 text-gray-500 font-bold">₦</div>
                                    <input 
                                        type="number" 
                                        name="price"
                                        placeholder="0"
                                        value={newServiceData.price}
                                        onChange={handleNewServiceChange}
                                        className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium"
                                        required 
                                        min="0"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-2 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-bold text-sm transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isAdding}
                                    className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold text-sm transition flex justify-center items-center gap-2 shadow-sm"
                                >
                                    {isAdding ? <Loader2 className="animate-spin" size={16}/> : "Save Service"}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicePrices;