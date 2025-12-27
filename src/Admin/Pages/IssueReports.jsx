import React, { useState, useEffect } from 'react';
import { AlertTriangle, Search, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { Toast } from '../Components/Feedback';

const IssueReports = () => {
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ message: '', type: '' });
    const navigate = useNavigate();

    useEffect(() => {
        const q = query(collection(db, "IssueReports"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleResolve = async (issue) => {
        try {
            // Delete report
            await deleteDoc(doc(db, "IssueReports", issue.id));
            
            // Optionally revert order status to In Progress (admin choice)
            await updateDoc(doc(db, "Orders", issue.orderId), {
                status: 'In Progress'
            });

            setToast({ message: "Issue Resolved & Cleared", type: "success" });
        } catch (e) {
            setToast({ message: "Failed to resolve", type: "error" });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 sm:p-10">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-100 text-slate-600"><ArrowLeft size={20}/></button>
                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><AlertTriangle className="text-red-600"/> Issue Reports</h1>
            </div>

            {loading ? <div className="text-center text-gray-500 py-20">Loading issues...</div> : 
             issues.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-300 mb-3"/>
                    <h3 className="text-lg font-bold text-gray-800">All Clear!</h3>
                    <p className="text-gray-400">No open issues reported by technicians.</p>
                </div>
             ) : (
                <div className="grid gap-4">
                    {issues.map(issue => (
                        <div key={issue.id} className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex flex-col sm:flex-row gap-6 justify-between items-start hover:shadow-md transition">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">{issue.ticketId}</span>
                                    <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">{issue.worker}</span>
                                    <span className="text-xs text-gray-400">{issue.createdAt?.toDate().toLocaleString()}</span>
                                </div>
                                <p className="text-red-700 font-medium text-lg leading-relaxed">"{issue.issue}"</p>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <button onClick={() => navigate(`/admin/orders/${issue.ticketId}`)} className="flex-1 sm:flex-none px-4 py-2 border rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">View Order</button>
                                <button onClick={() => handleResolve(issue)} className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 shadow-sm flex items-center justify-center gap-2">
                                    <CheckCircle size={16}/> Resolve
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default IssueReports;