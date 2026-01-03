import React, { useState, useEffect, useMemo } from 'react';
import { 
    Smartphone, Search, Hash, Lock, AlertTriangle, 
    ArrowRight, Copy, Check, Filter, X, Save, Loader2, Calendar,
    ChevronLeft, ChevronRight, ArrowLeft
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../AdminContext';
import { useNavigate } from 'react-router-dom';
import { Toast } from '../Components/Feedback';

const DeviceManager = () => {
    const { role } = useAuth();
    const navigate = useNavigate();

    // Data State
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Active'); // 'Active', 'All'

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 24;

    // Edit State
    const [editingDevice, setEditingDevice] = useState(null);
    const [editForm, setEditForm] = useState({ deviceModel: '', imei: '', passcode: '', condition: '' });
    const [isSaving, setIsSaving] = useState(false);

    // Feedback
    const [toast, setToast] = useState({ message: '', type: '' });
    const [copiedId, setCopiedId] = useState(null);

    // 1. FETCH ORDERS
    useEffect(() => {
        const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date()
            }));
            setOrders(fetchedOrders);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. FLATTEN DEVICES (Extract 'repair' items from orders)
    const devices = useMemo(() => {
        const allDevices = [];
        orders.forEach(order => {
            if (!order.items || order.status === 'Void') return;
            
            order.items.forEach((item, index) => {
                if (item.type === 'repair') {
                    allDevices.push({
                        // Device Specifics
                        ...item,
                        uniqueId: `${order.id}-${index}`, // Unique Key for List
                        
                        // Order Context (Required for updates/linking)
                        orderId: order.id,
                        orderTicket: order.ticketId,
                        orderDate: order.createdAt,
                        customerName: order.customer?.name || 'Unknown',
                        orderStatus: order.status,
                        itemIndex: index // Important for updating specific item in array
                    });
                }
            });
        });
        return allDevices;
    }, [orders]);

    // 3. FILTERING
    const filteredDevices = useMemo(() => {
        return devices.filter(device => {
            // Search Filter
            const search = searchTerm.toLowerCase();
            const matchesSearch = 
                (device.deviceModel || '').toLowerCase().includes(search) ||
                (device.imei || '').toLowerCase().includes(search) ||
                (device.orderTicket || '').toLowerCase().includes(search) ||
                (device.customerName || '').toLowerCase().includes(search);

            // Status Filter
            const isActive = device.orderStatus !== 'Collected' && device.orderStatus !== 'Completed';
            const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' && isActive);

            return matchesSearch && matchesStatus;
        });
    }, [devices, searchTerm, statusFilter]);

    // 4. PAGINATION LOGIC
    useEffect(() => {
        setCurrentPage(1); // Reset to page 1 on filter change
    }, [searchTerm, statusFilter]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentDevices = filteredDevices.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);

    // --- ACTIONS ---

    const handleCopy = (text, id) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        setToast({ message: "Copied to clipboard", type: "success" });
    };

    const openEditModal = (device) => {
        setEditingDevice(device);
        setEditForm({
            deviceModel: device.deviceModel || '',
            imei: device.imei || '',
            passcode: device.passcode || '',
            condition: device.condition || ''
        });
    };

    const handleSaveChanges = async () => {
        if (!editingDevice) return;
        setIsSaving(true);
        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "Orders", editingDevice.orderId);
                const docSnap = await t.get(ref);
                if (!docSnap.exists()) throw "Order not found";

                const data = docSnap.data();
                const newItems = [...data.items];
                
                // Update the specific item at the index
                if (newItems[editingDevice.itemIndex]) {
                    newItems[editingDevice.itemIndex] = {
                        ...newItems[editingDevice.itemIndex],
                        ...editForm // Spread new values (model, imei, etc.)
                    };
                }

                t.update(ref, { items: newItems });
            });
            setToast({ message: "Device Details Updated", type: "success" });
            setEditingDevice(null);
        } catch (error) {
            console.error(error);
            setToast({ message: "Update Failed", type: "error" });
        }
        setIsSaving(false);
    };

    // --- RENDER ---

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-purple-600"/></div>;

    return (
        <div className="min-h-screen bg-gray-50 p-6 lg:p-10 font-sans text-slate-800">
            {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />}

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/admin/dashboard')} 
                        className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 text-slate-600 transition"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <Smartphone className="text-purple-600" /> Device Manager
                        </h1>
                        <p className="text-sm text-slate-500 font-medium">Track IMEI, Passcodes & Conditions across all repairs.</p>
                    </div>
                </div>
                <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                    <button onClick={() => setStatusFilter('Active')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${statusFilter === 'Active' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-gray-50'}`}>In Shop</button>
                    <button onClick={() => setStatusFilter('All')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${statusFilter === 'All' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-gray-50'}`}>All History</button>
                </div>
            </div>

            {/* SEARCH BAR */}
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 mb-6 flex">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    <input 
                        className="w-full pl-10 pr-4 py-3 bg-transparent outline-none text-sm text-slate-700 font-medium placeholder-slate-400" 
                        placeholder="Search by Model, IMEI, Ticket ID or Customer..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* DEVICE GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {currentDevices.map((device) => (
                    <div key={device.uniqueId} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group overflow-hidden flex flex-col">
                        
                        {/* Card Header */}
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-[10px] font-bold bg-white border border-gray-200 px-1.5 py-0.5 rounded text-slate-500">{device.orderTicket}</span>
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Calendar size={10}/> {device.orderDate.toLocaleDateString()}</span>
                                </div>
                                <h3 className="font-bold text-slate-900 text-lg leading-tight">{device.deviceModel}</h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">{device.customerName}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase border ${
                                device.orderStatus === 'Collected' ? 'bg-gray-100 text-gray-500 border-gray-200' : 
                                device.orderStatus === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                                {device.orderStatus}
                            </span>
                        </div>

                        {/* Card Body - Details */}
                        <div className="p-4 space-y-3 flex-1">
                            
                            {/* IMEI */}
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 group/item">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Hash size={14} className="text-slate-400 flex-shrink-0"/>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">IMEI</span>
                                        <span className="text-sm font-mono font-bold text-slate-700 truncate select-all">{device.imei || "N/A"}</span>
                                    </div>
                                </div>
                                {device.imei && (
                                    <button onClick={() => handleCopy(device.imei, `imei-${device.uniqueId}`)} className="p-1.5 hover:bg-white rounded-md transition text-slate-400 hover:text-purple-600 shadow-sm">
                                        {copiedId === `imei-${device.uniqueId}` ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
                                    </button>
                                )}
                            </div>

                            {/* Passcode */}
                            <div className="flex items-center justify-between p-2 bg-yellow-50/50 rounded-lg border border-yellow-100 group/item">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Lock size={14} className="text-yellow-600 flex-shrink-0"/>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[9px] font-bold text-yellow-600/70 uppercase">Passcode</span>
                                        <span className="text-sm font-mono font-bold text-slate-800 truncate select-all">{device.passcode || "None"}</span>
                                    </div>
                                </div>
                                {device.passcode && (
                                    <button onClick={() => handleCopy(device.passcode, `pass-${device.uniqueId}`)} className="p-1.5 hover:bg-white rounded-md transition text-yellow-600/60 hover:text-yellow-700 shadow-sm">
                                        {copiedId === `pass-${device.uniqueId}` ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
                                    </button>
                                )}
                            </div>

                            {/* Condition */}
                            {device.condition && (
                                <div className="p-2 rounded-lg bg-orange-50 border border-orange-100">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <AlertTriangle size={12} className="text-orange-500"/>
                                        <span className="text-[10px] font-bold text-orange-700 uppercase">Condition Note</span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-snug">{device.condition}</p>
                                </div>
                            )}
                        </div>

                        {/* Card Footer - Actions */}
                        <div className="p-3 border-t border-gray-100 bg-gray-50/30 flex gap-2">
                            <button 
                                onClick={() => openEditModal(device)}
                                className="flex-1 bg-white border border-gray-200 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition shadow-sm"
                            >
                                Quick Edit
                            </button>
                            <button 
                                onClick={() => navigate(`/admin/orders/${device.orderTicket}`)}
                                className="flex-1 bg-slate-900 text-white py-2 rounded-lg text-xs font-bold hover:bg-slate-800 transition shadow-md flex items-center justify-center gap-1"
                            >
                                View Order <ArrowRight size={12}/>
                            </button>
                        </div>
                    </div>
                ))}
                
                {filteredDevices.length === 0 && (
                    <div className="col-span-full py-20 text-center text-slate-400">
                        <Smartphone size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-bold">No devices found</p>
                        <p className="text-sm">Try adjusting your search filters.</p>
                    </div>
                )}
            </div>

            {/* PAGINATION CONTROLS */}
            {filteredDevices.length > 0 && (
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <button 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 disabled:opacity-50 disabled:hover:bg-transparent transition text-slate-600"
                    >
                        <ChevronLeft size={20}/>
                    </button>
                    
                    <span className="text-sm font-bold text-slate-600">
                        Page {currentPage} of {totalPages}
                    </span>
                    
                    <button 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 disabled:opacity-50 disabled:hover:bg-transparent transition text-slate-600"
                    >
                        <ChevronRight size={20}/>
                    </button>
                </div>
            )}

            {/* EDIT MODAL */}
            {editingDevice && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-800 text-lg">Edit Device Details</h3>
                            <button onClick={() => setEditingDevice(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Device Model</label>
                                <input 
                                    className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold"
                                    value={editForm.deviceModel}
                                    onChange={e => setEditForm({...editForm, deviceModel: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">IMEI</label>
                                    <input 
                                        className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono"
                                        value={editForm.imei}
                                        onChange={e => setEditForm({...editForm, imei: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Passcode</label>
                                    <input 
                                        className="w-full p-3 border rounded-xl bg-yellow-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none text-sm font-mono text-slate-800"
                                        value={editForm.passcode}
                                        onChange={e => setEditForm({...editForm, passcode: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Condition Notes</label>
                                <textarea 
                                    className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                    rows="3"
                                    value={editForm.condition}
                                    onChange={e => setEditForm({...editForm, condition: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 flex gap-3">
                            <button onClick={() => setEditingDevice(null)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-gray-50 rounded-xl transition">Cancel</button>
                            <button 
                                onClick={handleSaveChanges} 
                                disabled={isSaving}
                                className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-lg transition flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeviceManager;