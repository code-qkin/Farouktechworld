import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Filter, Search, DollarSign, AlertCircle, CheckCircle, ArrowLeftCircle } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

const HistoryPage = () => {
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('paid'); // paid, refunded, debtors
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const filteredList = useMemo(() => {
        return orders.filter(o => {
            const matchesSearch = o.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) || o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchesTab = false;
            if (activeTab === 'paid') matchesTab = o.paymentStatus === 'Paid' && o.status !== 'Void';
            if (activeTab === 'refunded') matchesTab = o.paymentStatus === 'Refunded' || o.status === 'Void';
            if (activeTab === 'debtors') matchesTab = o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Part Payment';

            return matchesSearch && matchesTab;
        });
    }, [orders, activeTab, searchTerm]);

    return (
        <div className="p-10 min-h-screen bg-gray-50">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900">Transaction History</h1>
                <div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={18}/><input className="w-64 pl-10 p-2 border rounded-lg" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
            </div>

            <div className="flex gap-4 mb-6">
                <button onClick={() => setActiveTab('paid')} className={`px-6 py-2 rounded-full font-bold flex items-center gap-2 ${activeTab==='paid' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border'}`}><CheckCircle size={18}/> Paid History</button>
                <button onClick={() => setActiveTab('refunded')} className={`px-6 py-2 rounded-full font-bold flex items-center gap-2 ${activeTab==='refunded' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}><ArrowLeftCircle size={18}/> Refunded / Void</button>
                <button onClick={() => setActiveTab('debtors')} className={`px-6 py-2 rounded-full font-bold flex items-center gap-2 ${activeTab==='debtors' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border'}`}><AlertCircle size={18}/> Debtors (Unpaid)</button>
            </div>

            <div className="bg-white rounded-2xl shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Date</th><th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Ticket</th><th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Customer</th><th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Amount</th><th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Status</th></tr></thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredList.map(order => (
                            <tr key={order.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-500">{new Date(order.createdAt?.seconds * 1000).toLocaleDateString()}</td>
                                <td className="px-6 py-4 font-mono font-bold text-purple-700">{order.ticketId}</td>
                                <td className="px-6 py-4 font-medium text-gray-900">{order.customer?.name}</td>
                                <td className="px-6 py-4 font-bold text-gray-900">
                                    {activeTab === 'refunded' ? <span className="text-red-600">-{formatCurrency(order.refundedAmount || order.amountPaid || 0)}</span> : formatCurrency(order.amountPaid || 0)}
                                </td>
                                <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${order.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : order.paymentStatus === 'Refunded' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{order.paymentStatus}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredList.length === 0 && <div className="p-10 text-center text-gray-400">No records found.</div>}
            </div>
        </div>
    );
};

export default HistoryPage;