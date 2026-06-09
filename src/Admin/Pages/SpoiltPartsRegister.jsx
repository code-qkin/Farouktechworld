import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig.js';
import { AlertTriangle, Calendar, Search, ArrowLeft, Download, AlertOctagon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const formatCurrency = (amount) => `₦${Number(amount || 0).toLocaleString()}`;

const SpoiltPartsRegister = () => {
    const navigate = useNavigate();
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('All Time');

    useEffect(() => {
        const q = query(collection(db, "Incidents"), orderBy("timestamp", "desc"));
        const unsub = onSnapshot(q, snap => {
            setIncidents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const filteredIncidents = useMemo(() => {
        let result = incidents;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(i => 
                (i.worker && i.worker.toLowerCase().includes(term)) ||
                (i.ticketId && i.ticketId.toLowerCase().includes(term)) ||
                (i.partName && i.partName.toLowerCase().includes(term)) ||
                (i.reason && i.reason.toLowerCase().includes(term))
            );
        }

        if (dateFilter !== 'All Time') {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (dateFilter === 'Today') {
                result = result.filter(i => {
                    const d = i.timestamp?.toDate ? i.timestamp.toDate() : new Date(i.timestamp);
                    return d >= startOfDay;
                });
            } else if (dateFilter === 'This Week') {
                const startOfWeek = new Date(startOfDay);
                startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                result = result.filter(i => {
                    const d = i.timestamp?.toDate ? i.timestamp.toDate() : new Date(i.timestamp);
                    return d >= startOfWeek;
                });
            } else if (dateFilter === 'This Month') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                result = result.filter(i => {
                    const d = i.timestamp?.toDate ? i.timestamp.toDate() : new Date(i.timestamp);
                    return d >= startOfMonth;
                });
            }
        }

        return result;
    }, [incidents, searchTerm, dateFilter]);

    const totalLoss = filteredIncidents.reduce((sum, inc) => sum + (Number(inc.partCost) || 0), 0);

    const handleExport = () => {
        const data = filteredIncidents.map(inc => ({
            "Date": inc.timestamp?.toDate ? inc.timestamp.toDate().toLocaleString() : new Date(inc.timestamp).toLocaleString(),
            "Ticket ID": inc.ticketId,
            "Worker": inc.worker,
            "Part Name": inc.partName,
            "Cost (Loss)": Number(inc.partCost || 0),
            "Reason": inc.reason
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Spoilt Parts");
        XLSX.writeFile(wb, "FTW_Spoilt_Parts_Register.xlsx");
    };

    if (loading) return <div className="p-10 text-center text-slate-500 font-bold">Loading Incidents...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/admin/dashboard')} className="bg-white p-2 rounded-xl shadow-sm border hover:bg-gray-50 text-slate-600">
                        <ArrowLeft size={20}/>
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                            <AlertOctagon className="text-red-600"/> Spoilt Parts Register
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500">Track inventory losses from broken parts</p>
                    </div>
                </div>
                <button onClick={handleExport} className="flex items-center justify-center gap-2 bg-white border px-4 py-2 rounded-xl font-bold hover:bg-gray-50 text-sm shadow-sm">
                    <Download size={16} /> Export
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-red-100 flex flex-col justify-between h-24">
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Total Financial Loss (Filtered)</span>
                    <span className="text-2xl font-black text-red-600">{formatCurrency(totalLoss)}</span>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col justify-between h-24">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Incidents (Filtered)</span>
                    <span className="text-2xl font-black text-slate-800">{filteredIncidents.length}</span>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                    <input 
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-lg outline-none text-sm font-medium focus:ring-2 focus:ring-red-500" 
                        placeholder="Search by worker, part, or reason..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <select 
                    className="px-4 py-2.5 bg-gray-50 rounded-lg text-sm font-bold outline-none border focus:border-red-500"
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value)}
                >
                    <option>All Time</option>
                    <option>Today</option>
                    <option>This Week</option>
                    <option>This Month</option>
                </select>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b text-xs font-bold text-slate-500 uppercase">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Worker</th>
                                <th className="px-6 py-4">Ticket</th>
                                <th className="px-6 py-4">Part & Reason</th>
                                <th className="px-6 py-4 text-right">Cost (Loss)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredIncidents.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-400 text-sm">No incidents recorded.</td>
                                </tr>
                            ) : (
                                filteredIncidents.map(inc => (
                                    <tr key={inc.id} className="hover:bg-red-50/30 transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {inc.timestamp?.toDate ? inc.timestamp.toDate().toLocaleString() : new Date(inc.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-bold text-slate-800">{inc.worker}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span 
                                                className="text-purple-600 font-bold hover:underline cursor-pointer"
                                                onClick={() => navigate(`/admin/orders/${inc.ticketId}`)}
                                            >
                                                {inc.ticketId}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800 mb-1">{inc.partName}</div>
                                            <div className="text-xs text-red-600 flex items-start gap-1">
                                                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                                <span>{inc.reason}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span className="font-black text-red-600">{formatCurrency(inc.partCost)}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SpoiltPartsRegister;
