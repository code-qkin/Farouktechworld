import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, Trash2, CheckCircle, Lock, Unlock, 
    ArrowLeft, DollarSign, Save, X, Wrench, Shield, Edit2,
    UserPlus, Crown, Briefcase, Mail, Key
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AdminContext.jsx'; 
import { db, auth } from '../../firebaseConfig.js';
import { collection, onSnapshot, deleteDoc, updateDoc, doc, query } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Toast, ConfirmModal } from '../Components/Feedback.jsx';

const getRoleBadge = (role) => {
    switch (role) {
        case 'ceo': return 'bg-slate-900 text-yellow-400 border border-yellow-600 flex items-center gap-1'; 
        case 'admin': return 'bg-red-100 text-red-700 border border-red-200';
        case 'manager': return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
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
    
    // Inline Editing States
    const [editingNameId, setEditingNameId] = useState(null);
    const [newName, setNewName] = useState("");
    const [editingEmailId, setEditingEmailId] = useState(null);
    const [newEmail, setNewEmail] = useState("");

    // Payroll Modal
    const [payrollModal, setPayrollModal] = useState({ isOpen: false, userId: null, name: '' });
    const [payrollConfig, setPayrollConfig] = useState({ baseSalary: 0, fixedPerJob: 0 });

    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });
    
    const isManager = role === 'manager';
    if (role !== 'admin' && role !== 'ceo' && role !== 'manager') return <Navigate to="/admin/dashboard" replace />;

    // 1. FETCH & SORT USERS
    useEffect(() => {
        const q = query(collection(db, "Users")); 
        const unsubUsers = onSnapshot(q, (snap) => {
            const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            fetched.sort((a, b) => {
                if (a.role === 'ceo') return -1;
                if (b.role === 'ceo') return 1;
                return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
            });
            setAllUsers(fetched);
        });
        return () => unsubUsers();
    }, []);

    // 🔥 UPDATED FILTER: Only show Pending users who are VERIFIED
    const pendingUsers = useMemo(() => allUsers.filter(u => u.role === 'pending' && u.isVerified), [allUsers]);
    
    const activeStaff = useMemo(() => allUsers.filter(u => u.role !== 'pending'), [allUsers]);
    const existingCEO = useMemo(() => allUsers.find(u => u.role === 'ceo'), [allUsers]);

    // --- ACTIONS ---

    const handleSendPasswordReset = async (email) => {
        if (!email) return setToast({ message: "No email found.", type: "error" });
        setConfirmConfig({
            isOpen: true,
            title: "Send Password Reset?",
            message: `Send a password reset link to ${email}?`,
            confirmText: "Send Email",
            confirmColor: "bg-blue-600",
            action: async () => {
                try {
                    await sendPasswordResetEmail(auth, email);
                    setToast({ message: "Reset email sent!", type: "success" });
                } catch (e) {
                    setToast({ message: "Failed to send email.", type: "error" });
                }
                setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    const handleRoleUpdate = async (userId, newRole) => {
        if (userId === currentUser.uid) {
            setToast({ message: "You cannot change your own role.", type: "error" });
            setEditingUser(null);
            return;
        }
        if (newRole === 'ceo' && existingCEO && existingCEO.id !== userId) {
            setToast({ message: "There can only be one CEO.", type: "error" });
            setEditingUser(null);
            return;
        }
        if (isManager && (newRole === 'admin' || newRole === 'ceo')) {
            setToast({ message: "Managers cannot assign Admin or CEO roles.", type: "error" });
            return;
        }

        try { 
            const updates = { role: newRole };
            if (newRole === 'worker') updates.isTechnician = true;
            if (newRole === 'ceo' || newRole === 'admin') updates.isAdminAccess = true; 
            await updateDoc(doc(db, "Users", userId), updates); 
            setEditingUser(null); 
            setToast({ message: "Role updated!", type: 'success' }); 
        } 
        catch (error) { setToast({ message: "Failed.", type: 'error' }); }
    };

    // --- NAME EDITING ---
    const startNameEdit = (user) => { 
        if (user.role === 'ceo' && currentUser.uid !== user.id) return;
        if (isManager && (user.role === 'admin' || user.role === 'ceo')) return;
        setEditingNameId(user.id); setNewName(user.name || ""); 
    };
    
    const saveName = async () => {
        if (!newName.trim() || !editingNameId) {
            setEditingNameId(null);
            return;
        }
        try {
            await updateDoc(doc(db, "Users", editingNameId), { name: newName.trim() });
            setToast({ message: "Name updated", type: "success" });
        } catch (e) { setToast({ message: "Failed", type: "error" }); }
        setEditingNameId(null);
    };

    // --- EMAIL EDITING ---
    const startEmailEdit = (user) => {
        if (user.role === 'ceo' && currentUser.uid !== user.id) return setToast({ message: "Cannot edit CEO email", type: "error" });
        if (isManager && (user.role === 'admin' || user.role === 'ceo')) return setToast({ message: "Insufficient permissions", type: "error" });
        setEditingEmailId(user.id); setNewEmail(user.email || "");
    };

    const saveEmail = async () => {
        if (!newEmail.trim() || !editingEmailId) {
            setEditingEmailId(null);
            return;
        }
        try {
            await updateDoc(doc(db, "Users", editingEmailId), { email: newEmail.trim() });
            setToast({ message: "Email updated (DB Only)", type: "success" });
        } catch (e) { setToast({ message: "Failed", type: "error" }); }
        setEditingEmailId(null);
    };

    const handleToggleStatus = (user) => {
        if (user.id === currentUser.uid) return setToast({message: "You cannot suspend yourself.", type: "error"});
        if (user.role === 'ceo') return setToast({message: "Cannot suspend the CEO.", type: "error"}); 
        if (isManager && user.role === 'admin') return setToast({message: "Managers cannot suspend Admins.", type: "error"});

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
        if (user.id === currentUser.uid) return setToast({message: "Cannot delete yourself.", type: "error"});
        if (user.role === 'ceo') return setToast({message: "Cannot delete CEO.", type: "error"}); 
        if (isManager && user.role === 'admin') return setToast({message: "Cannot delete Admins.", type: "error"});

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
        if (user.role === 'ceo') return;
        try { await updateDoc(doc(db, "Users", user.id), { isTechnician: !user.isTechnician }); setToast({ message: "Permissions updated", type: 'success' }); } 
        catch (e) { setToast({ message: "Failed.", type: 'error' }); }
    };

    const handleAdminToggle = async (user) => {
        if (user.role === 'ceo') return;
        if (isManager) return setToast({message: "Managers cannot grant Admin access.", type: "error"});
        try { await updateDoc(doc(db, "Users", user.id), { isAdminAccess: !user.isAdminAccess }); setToast({ message: "Permissions updated", type: 'success' }); } 
        catch (e) { setToast({ message: "Failed.", type: 'error' }); }
    };

    const openPayrollModal = (user) => {
        if (isManager) return setToast({message: "Access Denied: Managers cannot set salaries.", type: "error"});
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

    const UserRow = ({ member }) => {
        const isCEO = member.role === 'ceo';
        const isTargetAdmin = member.role === 'admin';
        const isSelf = member.id === currentUser.uid; 
        
        const canEditRole = !isCEO && !isSelf && (!isManager || !isTargetAdmin);
        const canManage = !isCEO && !isSelf && (!isManager || !isTargetAdmin);

        return (
            <tr className={`hover:bg-gray-50 transition ${member.role === 'pending' ? 'bg-yellow-50' : ''} ${isCEO ? 'bg-slate-50' : ''}`}>
                <td className="px-6 py-4">
                    {/* NAME - Click to Edit */}
                    {editingNameId === member.id ? (
                        <input 
                            className="p-1.5 border-2 border-purple-500 rounded-md text-sm font-bold w-full outline-none animate-in fade-in" 
                            value={newName} 
                            onChange={(e) => setNewName(e.target.value)} 
                            autoFocus 
                            onBlur={saveName} 
                            onKeyDown={(e) => e.key === 'Enter' && saveName()} 
                        />
                    ) : (
                        <div 
                            className={`font-bold flex items-center gap-2 cursor-pointer ${!canManage ? 'cursor-default' : 'hover:text-purple-700'}`}
                            onClick={() => canManage && startNameEdit(member)}
                            title={canManage ? "Click to edit name" : ""}
                        >
                            {isCEO && <Crown size={14} className="text-yellow-600 fill-yellow-400"/>}
                            {member.name} 
                            {isSelf && <span className="text-[10px] text-purple-600 bg-purple-100 px-1.5 rounded">(You)</span>}
                        </div>
                    )}

                    {/* EMAIL - Click to Edit */}
                    {editingEmailId === member.id ? (
                        <input 
                            className="p-1 border border-blue-400 rounded text-xs w-full outline-none mt-1 animate-in fade-in" 
                            value={newEmail} 
                            onChange={(e) => setNewEmail(e.target.value)} 
                            autoFocus 
                            onBlur={saveEmail} 
                            onKeyDown={(e) => e.key === 'Enter' && saveEmail()} 
                        />
                    ) : (
                        <div 
                            className={`text-xs text-gray-500 mt-0.5 flex items-center gap-2 ${canManage ? 'cursor-pointer hover:text-blue-600' : ''}`}
                            onClick={() => canManage && startEmailEdit(member)}
                            title={canManage ? "Click to edit email" : ""}
                        >
                            {member.email}
                        </div>
                    )}
                </td>

                {/* ROLE */}
                <td className="px-6 py-4">
                    {editingUser === member.id && canEditRole ? (
                        <select className="p-2 border rounded text-sm bg-white shadow-sm outline-none" defaultValue={member.role} onChange={(e) => handleRoleUpdate(member.id, e.target.value)} autoFocus onBlur={() => setEditingUser(null)}>
                            <option value="pending">Pending</option>
                            <option value="worker">Worker</option>
                            <option value="secretary">Secretary</option>
                            <option value="manager">Manager</option>
                            {!isManager && <option value="admin">Admin</option>}
                            {!isManager && <option value="ceo" disabled={existingCEO && existingCEO.id !== member.id}>CEO</option>}
                        </select>
                    ) : (
                        <button 
                            onClick={() => canEditRole && setEditingUser(member.id)} 
                            disabled={!canEditRole}
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition shadow-sm flex items-center gap-1 ${getRoleBadge(member.role)} ${!canEditRole ? 'cursor-default opacity-100' : 'hover:scale-105'}`}
                        >
                            {member.role === 'ceo' && <Crown size={10} className="fill-current"/>}
                            {member.role === 'manager' && <Briefcase size={10} className="fill-current"/>}
                            {member.role === 'pending' ? 'Approve' : member.role}
                        </button>
                    )}
                </td>

                {/* PERMISSIONS */}
                <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                        <button onClick={() => handleTechToggle(member)} disabled={member.role === 'worker' || isCEO || !canManage} className={`p-2 rounded-full border transition flex items-center gap-1 text-[10px] font-bold px-3 ${member.isTechnician || isCEO ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-400'}`}><Wrench size={14} /> Tech</button>
                        <button onClick={() => handleAdminToggle(member)} disabled={member.role === 'admin' || isCEO || isManager || !canManage} className={`p-2 rounded-full border transition flex items-center gap-1 text-[10px] font-bold px-3 ${member.isAdminAccess || isCEO ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-400'}`}><Shield size={14} /> Admin</button>
                    </div>
                </td>

                {/* ACTIONS */}
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                    {canManage ? (
                        <>
                            <button onClick={() => handleSendPasswordReset(member.email)} className="p-2 rounded-full text-blue-500 hover:bg-blue-50 transition" title="Send Password Reset Email">
                                <Key size={18}/>
                            </button>
                            {member.role !== 'pending' && !isManager && (
                                <button onClick={() => openPayrollModal(member)} className="p-2 rounded-full text-green-600 hover:bg-green-100 transition" title="Set Salary">
                                    ₦
                                </button>
                            )}
                            <button onClick={() => handleToggleStatus(member)} className={`p-2 rounded-full transition ${member.status === 'suspended' ? 'text-green-600 hover:bg-green-100' : 'text-orange-400 hover:bg-orange-100'}`}>
                                {member.status === 'suspended' ? <Unlock size={18}/> : <Lock size={18}/>}
                            </button>
                            <button onClick={() => handleDelete(member)} className="text-red-600 hover:bg-red-100 p-2 rounded-full"><Trash2 size={18}/></button>
                        </>
                    ) : (
                        <span className="text-xs text-gray-400 italic py-2 pr-2">{isSelf ? 'Self' : 'Protected'}</span>
                    )}
                </td>
            </tr>
        );
    };

    return (
        <div className="space-y-8 p-6 sm:p-10">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={confirmConfig.action} />

            {/* PAYROLL MODAL */}
            {payrollModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="bg-purple-900 p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold text-lg flex items-center gap-2">₦ Payroll Settings</h3>
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

            {/* PENDING REQUESTS SECTION */}
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