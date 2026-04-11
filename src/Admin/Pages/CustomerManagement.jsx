import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, Search, UserPlus, Trash2, CheckCircle, X, 
    Phone, Mail, FileText, Clock, AlertCircle, ArrowLeft,
    Filter, Download, ExternalLink, MessageSquare, History, Edit2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
    collection, onSnapshot, query, orderBy, doc, 
    addDoc, updateDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../AdminContext';
import { Toast, ConfirmModal } from '../Components/Feedback';

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

const CustomerManagement = () => {
    const { role, user: currentUser } = useAuth();
    const navigate = useNavigate();

    const [customers, setCustomers] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    // Form States
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', notes: '', tags: [] });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

    const isAdmin = role === 'admin' || role === 'ceo';
    const isSecretary = role === 'secretary';

    useEffect(() => {
        const unsubCustomers = onSnapshot(query(collection(db, "Customers"), orderBy("name")), (snap) => {
            setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        let unsubRequests = () => {};
        if (isAdmin || isSecretary) {
            unsubRequests = onSnapshot(query(collection(db, "CustomerRequests"), orderBy("requestedAt", "desc")), (snap) => {
                setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            });
        }

        return () => { unsubCustomers(); unsubRequests(); };
    }, [isAdmin, isSecretary]);

    const filteredCustomers = useMemo(() => {
        return customers.filter(c => {
            const matchesSearch = 
                c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                c.phone?.includes(searchTerm) || 
                c.email?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });
    }, [customers, searchTerm]);

    const handleCreateCustomer = async (e) => {
        if (e) e.preventDefault();
        if (!formData.name || !formData.phone) return setToast({ message: "Name and Phone required", type: "error" });
        setIsSubmitting(true);
        try {
            if (isEditing && editingId) {
                await updateDoc(doc(db, "Customers", editingId), {
                    ...formData,
                    lastUpdated: serverTimestamp()
                });
                setToast({ message: "Customer updated successfully!", type: "success" });
            } else {
                await addDoc(collection(db, "Customers"), {
                    ...formData,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.uid,
                    totalSpent: 0,
                    ticketCount: 0
                });
                setToast({ message: "Customer created successfully!", type: "success" });
            }
            setShowCreateModal(false);
            resetForm();
        } catch (_err) { setToast({ message: "Operation failed", type: "error" }); }
        setIsSubmitting(false);
    };

    const resetForm = () => {
        setFormData({ name: '', phone: '', email: '', notes: '', tags: [] });
        setIsEditing(false);
        setEditingId(null);
    };

    const handleEditCustomer = (customer) => {
        setFormData({
            name: customer.name || '',
            phone: customer.phone || '',
            email: customer.email || '',
            notes: customer.notes || '',
            tags: customer.tags || []
        });
        setIsEditing(true);
        setEditingId(customer.id);
        setShowCreateModal(true);
    };

    const handleRequestCustomer = async (e) => {
        if (e) e.preventDefault();
        if (!formData.name || !formData.phone) return setToast({ message: "Name and Phone required", type: "error" });
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "CustomerRequests"), {
                ...formData,
                status: 'pending',
                requestedAt: serverTimestamp(),
                requestedBy: currentUser.name || currentUser.email,
                requesterId: currentUser.uid
            });
            setToast({ message: "Request sent to Admin", type: "success" });
            setShowRequestModal(false);
            resetForm();
        } catch (err) { setToast({ message: "Failed to send request", type: "error" }); }
        setIsSubmitting(false);
    };

    const handleApproveRequest = async (request) => {
        setConfirmConfig({
            isOpen: true,
            title: "Approve Request?",
            message: `Create customer profile for ${request.name}?`,
            confirmText: "Approve",
            confirmColor: "bg-green-600",
            action: async () => {
                try {
                    // 1. Create Customer
                    await addDoc(collection(db, "Customers"), {
                        name: request.name,
                        phone: request.phone,
                        email: request.email || '',
                        notes: request.notes || '',
                        tags: request.tags || [],
                        createdAt: serverTimestamp(),
                        createdBy: request.requesterId,
                        totalSpent: 0,
                        ticketCount: 0
                    });
                    // 2. Update Request Status
                    await updateDoc(doc(db, "CustomerRequests", request.id), { 
                        status: 'approved',
                        approvedAt: serverTimestamp(),
                        approvedBy: currentUser.name || currentUser.email
                    });
                    setToast({ message: "Customer Approved & Created", type: "success" });
                } catch (err) { setToast({ message: "Approval failed", type: "error" }); }
                setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    const handleDeleteCustomer = (id, name) => {
        if (!isAdmin) return;
        setConfirmConfig({
            isOpen: true,
            title: "Delete Customer?",
            message: `Permanently delete ${name}? History will be unlinked.`,
            confirmText: "Delete",
            confirmColor: "bg-red-600",
            action: async () => {
                try {
                    await deleteDoc(doc(db, "Customers", id));
                    setToast({ message: "Customer deleted", type: "success" });
                } catch (err) { setToast({ message: "Failed", type: "error" }); }
                setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-700"></div></div>;

    return (
        <div className="p-6 lg:p-10 bg-slate-50 min-h-screen">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={confirmConfig.action} />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-100 text-slate-600">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                            <Users className="text-purple-600" size={32} /> Customer Base
                        </h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">Manage profiles, track loyalty, and view history.</p>
                    </div>
                </div>
                
                <div className="flex gap-3">
                    {isAdmin ? (
                        <button onClick={() => { resetForm(); setShowCreateModal(true); }} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition shadow-lg shadow-slate-200">
                            <UserPlus size={20} /> Create Profile
                        </button>
                    ) : isSecretary ? (
                        <button onClick={() => { resetForm(); setShowRequestModal(true); }} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-700 transition shadow-lg shadow-purple-200">
                            <MessageSquare size={20} /> Request Profile
                        </button>
                    ) : null}
                </div>
            </div>

            {/* Admin: Pending Requests Section */}
            {isAdmin && requests.filter(r => r.status === 'pending').length > 0 && (
                <div className="mb-10 animate-in slide-in-from-top-4">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Clock size={16} /> Pending Requests ({requests.filter(r => r.status === 'pending').length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {requests.filter(r => r.status === 'pending').map(req => (
                            <div key={req.id} className="bg-white p-5 rounded-2xl border-2 border-purple-100 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-black text-slate-800 text-lg">{req.name}</h3>
                                        <span className="text-[10px] font-bold bg-purple-50 text-purple-600 px-2 py-1 rounded-full uppercase">Request</span>
                                    </div>
                                    <div className="space-y-1 text-sm text-slate-500">
                                        <p className="flex items-center gap-2 font-medium"><Phone size={14}/> {req.phone}</p>
                                        {req.email && <p className="flex items-center gap-2 font-medium"><Mail size={14}/> {req.email}</p>}
                                        <p className="text-[10px] mt-2 italic">Requested by {req.requestedBy}</p>
                                    </div>
                                </div>
                                <div className="mt-6 flex gap-2">
                                    <button onClick={() => handleApproveRequest(req)} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-xs hover:bg-green-700 transition">Approve</button>
                                    <button onClick={async () => await updateDoc(doc(db, "CustomerRequests", req.id), { status: 'rejected' })} className="flex-1 bg-slate-100 text-slate-500 py-2 rounded-lg font-bold text-xs hover:bg-slate-200 transition">Reject</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Content: Customer List */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-4 top-3 text-slate-400" size={18}/>
                        <input 
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-medium transition text-sm" 
                            placeholder="Search by name, phone or email..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                         <span className="text-xs font-bold text-slate-400 bg-slate-200/50 px-3 py-1.5 rounded-lg">{filteredCustomers.length} Total Customers</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-8 py-4">Customer Details</th>
                                <th className="px-8 py-4">Contact</th>
                                <th className="px-8 py-4 text-center">Activity</th>
                                <th className="px-8 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCustomers.map(customer => (
                                <tr key={customer.id} className="hover:bg-slate-50 transition group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/admin/customers/${customer.id}`)}>
                                            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700 font-black text-lg border border-purple-100 shadow-sm">
                                                {customer.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-800 text-base group-hover:text-purple-700 transition">{customer.name}</div>
                                                <div className="flex gap-1 mt-1">
                                                    {(customer.tags || []).map(t => (
                                                        <span key={t} className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{t}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-slate-700 font-bold"><Phone size={14} className="text-slate-400"/> {customer.phone}</div>
                                            {customer.email && <div className="flex items-center gap-2 text-slate-500 text-xs"><Mail size={14} className="text-slate-400"/> {customer.email}</div>}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <div className="inline-flex flex-col items-center">
                                            <span className="text-xs font-black text-slate-800">{customer.ticketCount || 0} Tickets</span>
                                            <span className="text-[10px] text-purple-600 font-bold mt-0.5">{formatCurrency(customer.totalSpent || 0)} Spent</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                                            <button onClick={() => navigate(`/admin/customers/${customer.id}`)} className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition" title="View History"><History size={18}/></button>
                                            {(isAdmin || role === 'manager') && <button onClick={() => handleEditCustomer(customer)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition" title="Edit Profile"><Edit2 size={18}/></button>}
                                            {isAdmin && <button onClick={() => handleDeleteCustomer(customer.id, customer.name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition" title="Delete"><Trash2 size={18}/></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredCustomers.length === 0 && (
                                <tr><td colSpan="4" className="p-20 text-center text-slate-400 font-medium">No customers found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit/Request Modal */}
            {(showCreateModal || showRequestModal) && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
                            <div>
                                <h3 className="text-xl font-black">
                                    {showCreateModal ? (isEditing ? 'Edit Customer Profile' : 'New Customer Profile') : 'Request Profile Creation'}
                                </h3>
                                <p className="text-slate-400 text-xs mt-1">
                                    {showCreateModal ? 'Directly manage client data in the database.' : 'Submit customer details for Admin approval.'}
                                </p>
                            </div>
                            <button onClick={() => { setShowCreateModal(false); setShowRequestModal(false); resetForm(); }} className="p-2 hover:bg-white/10 rounded-xl transition"><X size={20}/></button>
                        </div>
                        <form onSubmit={showCreateModal ? handleCreateCustomer : handleRequestCustomer} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Full Name *</label>
                                    <input required className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 font-bold text-slate-800 outline-none" placeholder="Enter customer name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Phone Number *</label>
                                        <input required className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 font-bold text-slate-800 outline-none" placeholder="080XXXXXXXX" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                                        <input className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 font-bold text-slate-800 outline-none" placeholder="optional@mail.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Internal Notes</label>
                                    <textarea className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 font-bold text-slate-800 outline-none h-24 resize-none" placeholder="Add preferences or history notes..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                                </div>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-black transition flex items-center justify-center gap-3 shadow-xl">
                                {isSubmitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : (showCreateModal ? (isEditing ? 'Update Profile' : 'Create Profile') : 'Send Request')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerManagement;