import React, { useState, useEffect } from 'react';
import { Users, Trash2, Edit, ShieldAlert, CheckCircle, Lock, Unlock, AlertOctagon, ArrowLeft } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useNavigate as UseNavigate } from 'react-router-dom';
import { useAuth } from '../AdminContext.jsx'; 
// import Invitation from '../Components/Invitation.jsx'; 
import { db } from '../../firebaseConfig.js';
import { collection, onSnapshot, deleteDoc, updateDoc, doc } from 'firebase/firestore';

const getRoleBadge = (role) => {
    switch (role) {
        case 'admin': return 'bg-red-100 text-red-700 border border-red-200';
        case 'secretary': return 'bg-purple-100 text-purple-700 border border-purple-200';
        default: return 'bg-blue-100 text-blue-700 border border-blue-200';
    }
};

const UserManagement = () => {
    const { role, user: currentUser } = useAuth(); 
    const [activeUsers, setActiveUsers] = useState([]);
    const [pendingInvites, setPendingInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null); 
    const navigate = UseNavigate();
    
    if (role !== 'admin') return <Navigate to="/admin/dashboard" replace />;

    // 1. Real-Time Fetch
    useEffect(() => {
        const unsubUsers = onSnapshot(collection(db, "Users"), (snap) => 
            setActiveUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );
        const unsubInvites = onSnapshot(collection(db, "PendingInvites"), (snap) => 
            setPendingInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );
        setLoading(false);
        return () => { unsubUsers(); unsubInvites(); };
    }, []);

    // ✅ FIXED: Suspend / Activate User
    const toggleUserStatus = async (user) => {
        if (user.id === currentUser.uid) return alert("You cannot suspend yourself.");
        
        // Logic: If currently 'suspended', set to 'active'. Otherwise, set to 'suspended'.
        const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
        const actionName = user.status === 'suspended' ? "Re-activate" : "Suspend";

        if (window.confirm(`${actionName} ${user.name}?`)) {
            try {
                // Direct Firestore Update
                await updateDoc(doc(db, "Users", user.id), { 
                    status: newStatus 
                });
            } catch (error) {
                console.error("Error updating status:", error);
                alert(`Failed to update status: ${error.message}`);
            }
        }
    };

    // 3. Update Role
    const handleRoleUpdate = async (userId, newRole) => {
        try {
            await updateDoc(doc(db, "Users", userId), { role: newRole });
            setEditingUser(null);
        } catch (error) { console.error("Error updating role:", error); }
    };

    // 4. Delete User
    const handleDelete = async (id, collectionName) => {
        if (id === currentUser.uid) return alert("You cannot delete your own admin account!");
        if (window.confirm(`Permanently delete this record?`)) {
            try { await deleteDoc(doc(db, collectionName, id)); } 
            catch (error) { console.error(error); alert("Failed to delete."); }
        }
    };

    return (
        <div className="space-y-8 p-10">
            <div className="flex  items-center border-b pb-4">
                <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2 rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 text-gray-600"><ArrowLeft size={24}/></button>
                <h1 className="text-3xl font-extrabold text-purple-900 flex items-center gap-2">
                    <Users className="w-8 h-8 text-indigo-600"/> Team Management
                </h1>
            </div>

            {/* <Invitation /> */}

            {/* ACTIVE USERS TABLE */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-purple-900">Active Team Members</h2>
                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">{activeUsers.length} Users</span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name / Email</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {activeUsers.map((member) => (
                                <tr key={member.id} className={`hover:bg-gray-50 transition ${member.status === 'suspended' ? 'bg-red-50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className={`font-bold ${member.status === 'suspended' ? 'text-gray-400' : 'text-gray-900'}`}>{member.name}</div>
                                        <div className="text-xs text-gray-500">{member.email}</div>
                                    </td>

                                    <td className="px-6 py-4">
                                        {editingUser === member.id ? (
                                            <select className="p-1 border rounded text-sm" defaultValue={member.role} onChange={(e) => handleRoleUpdate(member.id, e.target.value)} autoFocus onBlur={() => setEditingUser(null)}>
                                                <option value="worker">Worker</option><option value="secretary">Secretary</option><option value="admin">Admin</option>
                                            </select>
                                        ) : (
                                            <span onClick={() => setEditingUser(member.id)} className={`px-2 py-1 rounded text-xs font-bold uppercase cursor-pointer hover:opacity-80 ${getRoleBadge(member.role)}`}>
                                                {member.role}
                                            </span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4">
                                        {member.status === 'suspended' ? (
                                            <span className="flex items-center gap-1 text-red-600 text-xs font-bold"><AlertOctagon size={14}/> Suspended</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-green-600 text-xs font-bold"><CheckCircle size={14}/> Active</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 flex gap-2">
                                        {/* Suspend Toggle Button */}
                                        {member.id !== currentUser.uid && (
                                            <button 
                                                onClick={() => toggleUserStatus(member)} 
                                                className={`p-2 rounded-full transition ${member.status === 'suspended' ? 'text-green-600 hover:bg-green-100' : 'text-orange-600 hover:bg-orange-100'}`}
                                                title={member.status === 'suspended' ? "Re-activate Account" : "Suspend Account"}
                                            >
                                                {member.status === 'suspended' ? <Unlock size={18}/> : <Lock size={18}/>}
                                            </button>
                                        )}
                                        {member.id !== currentUser.uid && (
                                            <button onClick={() => handleDelete(member.id, "Users")} className="text-red-600 hover:bg-red-100 p-2 rounded-full" title="Delete User">
                                                <Trash2 size={18}/>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;