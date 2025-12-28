import React, { useState, useEffect } from 'react';
import { 
    Image as ImageIcon, Film, Trash2, Plus, Save, X, Link as LinkIcon, Loader2, Edit2
} from 'lucide-react';
import { db } from '../../firebaseConfig';
import { 
    collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Toast, ConfirmModal } from '../Components/Feedback';

const ManageProofOfWork = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    // Form State (Removed Thumbnail)
    const [formData, setFormData] = useState({
        title: '',
        category: 'screen',
        type: 'image',
        before: '',
        after: '',
        videoUrl: '',       
        videoBeforeUrl: '', 
        desc: '',
        duration: ''
    });

    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

    useEffect(() => {
        const q = query(collection(db, "ProofOfWork"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setFormData({ 
            title: '', category: 'screen', type: 'image', 
            before: '', after: '', 
            videoUrl: '', videoBeforeUrl: '', 
            desc: '', duration: '' 
        });
        setEditingId(null);
        setIsFormOpen(false);
    };

    const handleEdit = (project) => {
        setFormData({
            title: project.title || '',
            category: project.category || 'screen',
            type: project.type || 'image',
            before: project.before || '',
            after: project.after || '',
            videoUrl: project.videoUrl || '',
            videoBeforeUrl: project.videoBeforeUrl || '', 
            desc: project.desc || '',
            duration: project.duration || ''
        });
        setEditingId(project.id);
        setIsFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.desc) return setToast({ message: "Title and Description required", type: 'error' });
        
        setSubmitting(true);
        try {
            if (editingId) {
                await updateDoc(doc(db, "ProofOfWork", editingId), {
                    ...formData,
                    updatedAt: serverTimestamp()
                });
                setToast({ message: "Project Updated!", type: "success" });
            } else {
                await addDoc(collection(db, "ProofOfWork"), {
                    ...formData,
                    createdAt: serverTimestamp()
                });
                setToast({ message: "Project Added!", type: "success" });
            }
            resetForm();
        } catch (err) {
            console.error(err);
            setToast({ message: "Operation failed", type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id) => {
        setConfirmConfig({
            isOpen: true,
            title: "Delete Project?",
            message: "This will remove it from the public gallery.",
            confirmText: "Delete",
            confirmColor: "bg-red-600",
            action: async () => {
                try {
                    await deleteDoc(doc(db, "ProofOfWork", id));
                    setToast({ message: "Deleted", type: "success" });
                } catch (e) {
                    setToast({ message: "Delete failed", type: "error" });
                }
                setConfirmConfig({ ...confirmConfig, isOpen: false });
            }
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-10">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={confirmConfig.action} />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                        <ImageIcon className="text-purple-600"/> Portfolio Manager
                    </h1>
                    <p className="text-sm text-slate-500">Manage 'Before & After' showcase.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={() => navigate('/admin/dashboard')} className="flex-1 md:flex-none px-4 py-2 border rounded-lg hover:bg-white transition text-sm font-bold text-center">Dashboard</button>
                    <button onClick={() => { resetForm(); setIsFormOpen(true); }} className="flex-1 md:flex-none px-4 py-2 bg-purple-900 text-white rounded-lg hover:bg-purple-800 transition text-sm font-bold flex items-center justify-center gap-2 shadow-lg">
                        <Plus size={18}/> <span className="hidden md:inline">Add Project</span><span className="md:hidden">Add</span>
                    </button>
                </div>
            </div>

            {/* FORM */}
            {isFormOpen && (
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-xl border border-gray-200 mb-8 animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            {editingId ? <Edit2 size={20} className="text-blue-600"/> : <Plus size={20} className="text-green-600"/>}
                            {editingId ? 'Edit Project' : 'New Project'}
                        </h3>
                        <button onClick={resetForm}><X className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Title</label>
                                    <input className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm md:text-base" placeholder="e.g. iPhone 13 Pro Max Screen" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                                        <select className="w-full p-3 border rounded-xl outline-none bg-white text-sm md:text-base" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                            <option value="screen">Screen</option>
                                            <option value="battery">Battery</option>
                                            <option value="housing">Housing</option>
                                            <option value="water-damage">Water</option>
                                            <option value="charging">Charging</option>
                                            <option value="software">Software</option>
                                            <option value="camera">Camera</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                                        <select className="w-full p-3 border rounded-xl outline-none bg-white text-sm md:text-base" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                            <option value="image">Image</option>
                                            <option value="video">Video</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                    <textarea className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm md:text-base" rows="3" placeholder="Brief details about the fix..." value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})}></textarea>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Duration</label>
                                    <input className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm md:text-base" placeholder="e.g. 45 Mins" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} />
                                </div>
                            </div>

                            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                {formData.type === 'image' ? (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Before Image URL</label>
                                            <input className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="https://..." value={formData.before} onChange={e => setFormData({...formData, before: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">After Image URL</label>
                                            <input className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="https://..." value={formData.after} onChange={e => setFormData({...formData, after: e.target.value})} />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Main / After Video URL</label>
                                            <input className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="https://..." value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-purple-600 uppercase mb-1">Before Video URL (Optional)</label>
                                            <input className="w-full p-3 border-2 border-dashed border-purple-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-purple-50/50" placeholder="https://... (Optional)" value={formData.videoBeforeUrl} onChange={e => setFormData({...formData, videoBeforeUrl: e.target.value})} />
                                        </div>
                                    </>
                                )}
                                <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-xs rounded-lg leading-relaxed">
                                    <strong>Tip:</strong> Paste direct URLs. Videos will auto-generate their own preview.
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse md:flex-row justify-end gap-3 pt-4 border-t">
                            <button type="button" onClick={resetForm} className="w-full md:w-auto px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition">Cancel</button>
                            <button type="submit" disabled={submitting} className={`w-full md:w-auto px-6 py-3 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-900 hover:bg-purple-800'}`}>
                                {submitting ? <Loader2 className="animate-spin"/> : <Save size={18}/>} 
                                {editingId ? 'Update Project' : 'Save Project'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* LIST */}
            {loading ? <div className="text-center py-20 text-slate-400">Loading...</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(p => (
                        <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-all">
                            <div className="h-48 bg-slate-100 relative">
                                {p.type === 'video' ? (
                                    <video src={p.videoUrl} className="w-full h-full object-cover pointer-events-none" muted />
                                ) : (
                                    <img src={p.after} alt={p.title} className="w-full h-full object-cover"/>
                                )}
                                
                                {/* Edit/Delete Overlay */}
                                <div className="absolute top-2 right-2 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition duration-300">
                                    <button 
                                        onClick={() => handleEdit(p)} 
                                        className="bg-white text-blue-600 p-2 rounded-full shadow-lg hover:bg-blue-50 hover:text-blue-700 transition"
                                    >
                                        <Edit2 size={16}/>
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(p.id)} 
                                        className="bg-white text-red-600 p-2 rounded-full shadow-lg hover:bg-red-50 hover:text-red-700 transition"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                                
                                <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded uppercase font-bold">{p.category}</span>
                                {p.videoBeforeUrl && <span className="absolute bottom-2 right-2 bg-purple-600 text-white text-[10px] px-2 py-1 rounded uppercase font-bold">Dual Video</span>}
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-slate-800 truncate">{p.title}</h3>
                                <p className="text-xs text-slate-500 line-clamp-2 mt-1">{p.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ManageProofOfWork;