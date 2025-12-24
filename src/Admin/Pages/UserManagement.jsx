import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, Trash2, CheckCircle, Lock, Unlock, 
    ArrowLeft, DollarSign, Save, X, Wrench, Shield, Edit2, Mail,
    UserPlus
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AdminContext.jsx'; 
import { db } from '../../firebaseConfig.js';
import { collection, onSnapshot, deleteDoc, updateDoc, doc, query } from 'firebase/firestore';
import { Toast, ConfirmModal } from '../Components/Feedback.jsx';

const getRoleBadge = (role) => {
    switch (role) {
        case 'admin': return 'bg-red-100 text-red-700 border border-red-200';
        case 'secretary': return 'bg-purple-100 text-purple-700 border border-purple-200';
        case 'worker': return 'bg-blue-100 text-blue-700 border border-blue-200';
        case 'pending': return 'bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse';
        default: return 'bg-gray-100 text-gray-600 border border-gray-200';
    }
};

const UserManagement = () => {
    const { role, user: currentUser } = useAuth(); 
    const [allUsers, setAllUsers] = useState([]);
    const [editingUser, setEditingUser] = useState(null); 
    const navigate = useNavigate();
    
    // Name Editing
    const [editingNameId, setEditingNameId] = useState(null);
    const [newName, setNewName] = useState("");

    // Payroll Modal
    const [payrollModal, setPayrollModal] = useState({ isOpen: false, userId: null, name: '' });
    const [payrollConfig, setPayrollConfig] = useState({ baseSalary: 0, fixedPerJob: 0 });

    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });
    
    if (role !== 'admin') return <Navigate to="/admin/dashboard" replace />;

    // 1. FETCH & SORT USERS (Client-Side Sort to fix visibility issues)
    useEffect(() => {
        // Removed 'orderBy' from query to ensure it runs even without indexes
        const q = query(collection(db, "Users")); 
        
        const unsubUsers = onSnapshot(q, (snap) => {
            const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Sort by CreatedAt Descending (Newest First) in JS
            fetched.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });

            setAllUsers(fetched);
        });
        return () => unsubUsers();
    }, []);

    // 2. SPLIT DATA
    const pendingUsers = useMemo(() => allUsers.filter(u => u.role === 'pending'), [allUsers]);
    const activeStaff = useMemo(() => allUsers.filter(u => u.role !== 'pending'), [allUsers]);

    // --- HELPER: Send Welcome Email ---
    const sendWelcomeEmail = (email, name, role) => {
        const subject = encodeURIComponent("Welcome to FaroukTechWorld Team!");
        const body = encodeURIComponent(
            `Hi ${name},\n\n` +
            `Your account has been approved! You have been assigned the role of: ${role.toUpperCase()}.\n\n` +
            `You can now log in to the dashboard.\n\n` +
            `Regards,\nAdmin`
        );
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    };

    // --- ACTIONS ---
    const handleRoleUpdate = async (userId, newRole, userEmail, userName) => {
        try { 
            const updates = { role: newRole };
            // Auto-assign tech access if worker
            if (newRole === 'worker') updates.isTechnician = true;
            
            await updateDoc(doc(db, "Users", userId), updates); 
            setEditingUser(null); 
            setToast({ message: "Role updated!", type: 'success' }); 

            // 🔥 Prompt to send email if user is approved
            if (newRole !== 'pending' && userEmail) {
                setTimeout(() => {
                    if (window.confirm(`User Approved. Send Welcome Email to ${userEmail}?`)) {
                        sendWelcomeEmail(userEmail, userName, newRole);
                    }
                }, 500);
            }
        } 
        catch (error) { setToast({ message: "Failed.", type: 'error' }); }
    };

    const startNameEdit = (user) => { setEditingNameId(user.id); setNewName(user.name || ""); };
    
    const saveName = async () => {
        if (!newName.trim()) return setToast({ message: "Name cannot be empty", type: "error" });
        try {
            await updateDoc(doc(db, "Users", editingNameId), { name: newName.trim() });
            setToast({ message: "Name updated successfully", type: "success" });
            setEditingNameId(null);
        } catch (e) { setToast({ message: "Failed to update name", type: "error" }); }
    };

    const handleToggleStatus = (user) => {
        if (user.id === currentUser.uid) return setToast({message: "You cannot suspend yourself.", type: "error"});
        const isSuspended = user.status === 'suspended';
        setConfirmConfig({
            isOpen: true,
            title: isSuspended ? "Re-activate Account?" : "Suspend Account?",
            message: isSuspended ? `Restore access for ${user.name}?` : `Lock ${user.name} out?`,
            confirmText: isSuspended ? "Activate" : "Suspend",
            confirmColor: isSuspended ? "bg-green-600" : "bg-red-600",
            action: async () => {
                try {
                    await updateDoc(doc(db, "Users", user.id), { status: isSuspended ? 'active' : 'suspended' });
                    setToast({ message: "Status updated.", type: 'success' });
                } catch (e) { setToast({ message: "Action failed.", type: 'error' }); }
                setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    const handleDelete = (user) => {
        if (user.id === currentUser.uid) return setToast({message: "Cannot delete your own account.", type: "error"});
        setConfirmConfig({
            isOpen: true, title: "Delete User?", message: `Permanently delete ${user.name}?`, confirmText: "Delete", confirmColor: "bg-red-600",
            action: async () => {
                try { await deleteDoc(doc(db, "Users", user.id)); setToast({ message: "User deleted.", type: 'success' }); } 
                catch (e) { setToast({ message: "Delete failed.", type: 'error' }); }
                setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    const handleTechToggle = async (user) => {
        try { await updateDoc(doc(db, "Users", user.id), { isTechnician: !user.isTechnician }); setToast({ message: "Permissions updated", type: 'success' }); } 
        catch (e) { setToast({ message: "Failed.", type: 'error' }); }
    };

    const handleAdminToggle = async (user) => {
        try { await updateDoc(doc(db, "Users", user.id), { isAdminAccess: !user.isAdminAccess }); setToast({ message: "Permissions updated", type: 'success' }); } 
        catch (e) { setToast({ message: "Failed.", type: 'error' }); }
    };

    const openPayrollModal = (user) => {
        setPayrollModal({ isOpen: true, userId: user.id, name: user.name });
        setPayrollConfig({ baseSalary: user.baseSalary || 0, fixedPerJob: user.fixedPerJob || 0 });
    };

    const savePayrollConfig = async () => {
        try {
            await updateDoc(doc(db, "Users", payrollModal.userId), { baseSalary: Number(payrollConfig.baseSalary), fixedPerJob: Number(payrollConfig.fixedPerJob) });
            setToast({ message: "Payroll updated", type: 'success' });
            setPayrollModal({ isOpen: false, userId: null, name: '' });
        } catch (e) { setToast({ message: "Save failed.", type: 'error' }); }
    };

    const UserRow = ({ member }) => (
        <tr className={`hover:bg-gray-50 transition ${member.role === 'pending' ? 'bg-yellow-50' : ''}`}>
            <td className="px-6 py-4">
                {editingNameId === member.id ? (
                    <div className="flex items-center gap-2 animate-in fade-in">
                        <input className="p-1.5 border-2 border-purple-200 rounded-md text-sm font-bold w-full outline-none" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingNameId(null); }} />
                        <button onClick={saveName} className="text-green-600"><CheckCircle size={18}/></button>
                        <button onClick={() => setEditingNameId(null)} className="text-red-500"><X size={18}/></button>
                    </div>
                ) : (
                    <div className="group">
                        <div className={`font-bold flex items-center gap-2 ${member.status === 'suspended' ? 'text-gray-400' : 'text-gray-900'}`}>
                            {member.name}
                            <button onClick={() => startNameEdit(member)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-purple-600 transition" title="Edit Name"><Edit2 size={12}/></button>
                        </div>
                        <div className="text-xs text-gray-500">{member.email}</div>
                    </div>
                )}
            </td>
            <td className="px-6 py-4">
                {editingUser === member.id ? (
                    <select className="p-2 border rounded text-sm bg-white shadow-sm outline-none" defaultValue={member.role} onChange={(e) => handleRoleUpdate(member.id, e.target.value, member.email, member.name)} autoFocus onBlur={() => setEditingUser(null)}>
                        <option value="pending">Pending</option><option value="worker">Worker</option><option value="secretary">Secretary</option><option value="admin">Admin</option>
                    </select>
                ) : (
                    <button onClick={() => setEditingUser(member.id)} className={`px-3 py-1 rounded-full text-xs font-bold uppercase hover:scale-105 transition shadow-sm ${getRoleBadge(member.role)}`}>
                        {member.role === 'pending' ? 'Approve' : member.role}
                    </button>
                )}
            </td>
            <td className="px-6 py-4">
                <div className="flex justify-center gap-2">
                    <button onClick={() => handleTechToggle(member)} disabled={member.role === 'worker'} className={`p-2 rounded-full border transition flex items-center gap-1 text-[10px] font-bold px-3 ${member.isTechnician ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-400'}`}><Wrench size={14} /> Tech</button>
                    <button onClick={() => handleAdminToggle(member)} disabled={member.role === 'admin'} className={`p-2 rounded-full border transition flex items-center gap-1 text-[10px] font-bold px-3 ${member.isAdminAccess ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-400'}`}><Shield size={14} /> Admin</button>
                </div>
            </td>
            <td className="px-6 py-4 text-right flex justify-end gap-2">
                {member.role !== 'pending' && <button onClick={() => openPayrollModal(member)} className="p-2 rounded-full text-green-600 hover:bg-green-100 transition"><DollarSign size={18}/></button>}
                <button onClick={() => sendWelcomeEmail(member.email, member.name, member.role)} className="p-2 rounded-full text-blue-600 hover:bg-blue-100 transition"><Mail size={18}/></button>
                {member.id !== currentUser.uid && <button onClick={() => handleDelete(member)} className="text-red-600 hover:bg-red-100 p-2 rounded-full"><Trash2 size={18}/></button>}
            </td>
        </tr>
    );

    return (
        <div className="space-y-8 p-6 sm:p-10">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={confirmConfig.action} />

            {/* PAYROLL MODAL */}
            {payrollModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="bg-purple-900 p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold text-lg flex items-center gap-2"><DollarSign size={20}/> Payroll Settings</h3>
                            <button onClick={() => setPayrollModal({...payrollModal, isOpen: false})}><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-500 font-bold uppercase border-b pb-2">Configuring for: <span className="text-purple-700">{payrollModal.name}</span></p>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Weekly Base Salary (₦)</label><input type="number" className="w-full p-2 border rounded font-bold" value={payrollConfig.baseSalary} onChange={e=>setPayrollConfig({...payrollConfig, baseSalary: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Fixed Rate per Job (₦)</label><input type="number" className="w-full p-2 border rounded font-bold" value={payrollConfig.fixedPerJob} onChange={e=>setPayrollConfig({...payrollConfig, fixedPerJob: e.target.value})} /></div>
                            <button onClick={savePayrollConfig} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 flex justify-center items-center gap-2"><Save size={18}/> Save Configuration</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4 border-b pb-4">
                <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2 rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 text-gray-600"><ArrowLeft size={24}/></button>
                <h1 className="text-3xl font-extrabold text-purple-900 flex items-center gap-2"><Users className="w-8 h-8 text-indigo-600"/> Team Management</h1>
            </div>

            {/* 🔥 NEW: PENDING REQUESTS SECTION (Guaranteed to show) */}
            {pendingUsers.length > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-xl shadow-sm animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-3 mb-4">
                        <UserPlus className="text-yellow-600" size={24} />
                        <div>
                            <h2 className="text-xl font-bold text-yellow-800">Pending Approvals ({pendingUsers.length})</h2>
                            <p className="text-sm text-yellow-700">These users are waiting for role assignment.</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border border-yellow-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-100">
                            <tbody className="bg-white divide-y divide-gray-100">
                                {pendingUsers.map(member => <UserRow key={member.id} member={member} />)}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ACTIVE STAFF TABLE */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-purple-900">Active Team</h2>
                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">{activeStaff.length} Members</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">User</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Role</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Permissions</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {activeStaff.map(member => <UserRow key={member.id} member={member} />)}
                            {activeStaff.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-gray-400">No active staff members.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;