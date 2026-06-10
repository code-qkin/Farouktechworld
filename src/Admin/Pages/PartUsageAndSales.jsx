import React, { useState, useEffect, useMemo } from 'react';
import { 
    History, Search, Download, Filter, Loader2, ArrowLeft,
    Wrench, ShoppingCart, Calendar, Smartphone
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig.js'; 
import { collection, onSnapshot, query, orderBy, limit, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const formatCurrency = (amount) => `₦${(Number(amount) || 0).toLocaleString()}`;
const normalizeStr = (str) => str ? str.toLowerCase().replace(/\s+/g, '') : '';

const PartUsageAndSales = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('part_usage'); // 'part_usage' or 'direct_sales'
    const [loading, setLoading] = useState(true);
    
    // Data States
    const [partUsages, setPartUsages] = useState([]);
    const [directSales, setDirectSales] = useState([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTime, setFilterTime] = useState('All');

    useEffect(() => {
        let unsubscribeOrders;
        
        const fetchCategoriesAndListen = async () => {
            // 1. Build Category Map for legacy items
            const invMap = {};
            try {
                const invSnap = await getDocs(collection(db, "Inventory"));
                invSnap.docs.forEach(d => {
                    const data = d.data();
                    if (data.name) invMap[data.name.toLowerCase()] = data.category || 'Uncategorized';
                });
            } catch (e) {
                console.error("Failed to fetch inventory categories", e);
            }

            // 2. Listen to Orders
            const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"), limit(1500));
            unsubscribeOrders = onSnapshot(q, (snapshot) => {
            const usages = [];
            const sales = [];

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const date = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : new Date();
                
                if (data.items && Array.isArray(data.items)) {
                    data.items.forEach(item => {
                        let extractedName = item.name || 'Unknown Item';
                        if (extractedName.startsWith('Used: ')) {
                            extractedName = extractedName.replace('Used: ', '').split(' (')[0];
                        }
                        const mappedCategory = invMap[extractedName.toLowerCase()] || 'Uncategorized';

                        const baseData = {
                            id: `${doc.id}-${item.id || Math.random()}`,
                            orderId: doc.id,
                            ticketId: data.ticketId,
                            date: date,
                            itemName: item.name || 'Unknown Item',
                            category: item.category || mappedCategory,
                            qty: item.qty || 1,
                            price: item.price || 0,
                            total: item.total !== undefined ? item.total : ((item.qty || 1) * (item.price || 0)),
                            deviceInfo: item.deviceType ? `${item.deviceType}` : (data.items[0]?.name || 'N/A')
                        };

                        if (item.type === 'part_usage') {
                            usages.push({
                                ...baseData,
                                technician: item.worker || 'Unknown Technician',
                                customerName: data.customer?.name || 'Walk-in'
                            });
                        } else if (item.type === 'product' || data.orderType === 'sale') {
                            sales.push({
                                ...baseData,
                                customerName: data.customer?.name || 'Walk-in',
                                seller: data.createdBy || 'Store'
                            });
                        }
                    });
                }
            });

            setPartUsages(usages);
            setDirectSales(sales);
            setLoading(false);
        });
        };
        
        fetchCategoriesAndListen();

        return () => {
            if (unsubscribeOrders) unsubscribeOrders();
        };
    }, []);

    // Filter Logic
    const filterData = (dataArray) => {
        return dataArray.filter(item => {
            const term = normalizeStr(searchTerm);
            const matchesSearch = 
                normalizeStr(item.itemName).includes(term) ||
                normalizeStr(item.ticketId).includes(term) ||
                normalizeStr(item.customerName).includes(term) ||
                (item.technician && normalizeStr(item.technician).includes(term)) ||
                (item.seller && normalizeStr(item.seller).includes(term));
            
            // Time filtering
            let matchesTime = true;
            if (filterTime !== 'All') {
                const now = new Date();
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const itemDate = new Date(item.date);
                
                if (filterTime === 'Today') {
                    matchesTime = itemDate >= startOfDay;
                } else if (filterTime === 'This Week') {
                    const startOfWeek = new Date(startOfDay);
                    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                    matchesTime = itemDate >= startOfWeek;
                } else if (filterTime === 'This Month') {
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    matchesTime = itemDate >= startOfMonth;
                }
            }

            return matchesSearch && matchesTime;
        });
    };

    const displayData = activeTab === 'part_usage' ? filterData(partUsages) : filterData(directSales);

    const handleExport = () => {
        const exportData = displayData.map(item => ({
            Date: item.date.toLocaleString(),
            "Ticket ID": item.ticketId,
            "Item Name": item.itemName,
            Category: item.category,
            "Quantity": item.qty,
            "Unit Price": item.price,
            "Total": item.total,
            [activeTab === 'part_usage' ? 'Technician' : 'Seller']: activeTab === 'part_usage' ? item.technician : item.seller,
            Customer: item.customerName,
            Device: item.deviceInfo
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, activeTab === 'part_usage' ? "Part Usage" : "Direct Sales");
        XLSX.writeFile(wb, `${activeTab === 'part_usage' ? 'Part_Usage' : 'Direct_Sales'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="min-h-screen bg-[#fafafa] font-sans text-gray-900 pb-20">
            {/* Header */}
            <header className="bg-white border-b border-slate-100 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-20 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <History className="text-purple-600"/> Part Usage & Sales
                        </h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">Detailed history of inventory consumption.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExport} className="bg-white border border-gray-200 text-slate-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-50 flex items-center gap-2 shadow-sm">
                        <Download size={16}/> Export Excel
                    </button>
                </div>
            </header>

            <main className="p-6 max-w-[1600px] mx-auto space-y-6">
                
                {/* Tabs */}
                <div className="flex gap-4 border-b border-gray-200">
                    <button 
                        onClick={() => setActiveTab('part_usage')} 
                        className={`pb-4 px-2 text-sm font-black flex items-center gap-2 border-b-2 transition ${activeTab === 'part_usage' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Wrench size={18}/> Part Usage
                    </button>
                    <button 
                        onClick={() => setActiveTab('direct_sales')} 
                        className={`pb-4 px-2 text-sm font-black flex items-center gap-2 border-b-2 transition ${activeTab === 'direct_sales' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <ShoppingCart size={18}/> Direct Sales
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Filters */}
                    <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 bg-gray-50/50">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                            <input 
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition" 
                                placeholder="Search ticket, item, name..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 text-gray-400" size={16}/>
                                <select 
                                    className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-slate-600 outline-none cursor-pointer"
                                    value={filterTime}
                                    onChange={e => setFilterTime(e.target.value)}
                                >
                                    <option value="All">All Time</option>
                                    <option value="Today">Today</option>
                                    <option value="This Week">This Week</option>
                                    <option value="This Month">This Month</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-white text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4">Date & Ticket</th>
                                    <th className="px-6 py-4">Item Details</th>
                                    <th className="px-6 py-4">{activeTab === 'part_usage' ? 'Technician' : 'Seller'}</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4 text-center">Qty</th>
                                    <th className="px-6 py-4 text-right">Unit Price</th>
                                    <th className="px-6 py-4 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading && (
                                    <tr>
                                        <td colSpan="7" className="p-12 text-center text-purple-600">
                                            <div className="flex justify-center items-center gap-2">
                                                <Loader2 size={24} className="animate-spin"/> 
                                                <span className="font-bold">Loading records...</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {!loading && displayData.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="p-12 text-center text-slate-400 font-medium">
                                            No records found matching your filters.
                                        </td>
                                    </tr>
                                )}
                                {!loading && displayData.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => navigate(`/admin/orders/${item.ticketId}`)}>
                                        <td className="px-6 py-4">
                                            <div className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded w-fit mb-1">
                                                {item.ticketId}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400">
                                                {item.date && item.date instanceof Date && !isNaN(item.date) ? item.date.toLocaleString() : 'Unknown Date'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-black text-slate-800">{item.itemName}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">{item.category}</span>
                                                <span className="text-[10px] font-medium text-slate-500">{item.deviceInfo}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-700">{activeTab === 'part_usage' ? item.technician : item.seller}</p>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700">
                                            {item.customerName}
                                        </td>
                                        <td className="px-6 py-4 text-center font-black text-slate-900">
                                            {item.qty}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-slate-500">
                                            {formatCurrency(item.price)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-purple-700">
                                            {formatCurrency(item.total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PartUsageAndSales;
