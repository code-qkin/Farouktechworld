import React, { useState, useEffect, useMemo } from 'react';
import { 
    TrendingUp, TrendingDown, Clock, Activity, 
    Wrench, Package, ArrowLeft, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';
import { db } from '../../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { useData } from '../DataContext';

const TrendAnalysis = () => {
    const navigate = useNavigate();
    const { orders, inventory, loading: globalLoading, fetchAllOrders } = useData();
    const [timeframe, setTimeframe] = useState('30'); // '7', '30', '90', 'all'

    // Re-fetch all orders if timeframe is set to 'all'
    useEffect(() => {
        if (timeframe === 'all') {
            fetchAllOrders();
        }
    }, [timeframe]);

    // Filter orders by timeframe
    const filteredOrders = useMemo(() => {
        if (timeframe === 'all') return orders;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - parseInt(timeframe));
        return orders.filter(o => o.createdAt && (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) >= cutoff);
    }, [orders, timeframe]);

    // Analyze Data
    const { 
        fastParts, slowParts, fastServices, slowServices 
    } = useMemo(() => {
        const partCounts = {};
        const serviceCounts = {};

        // Aggregate usage from filtered orders
        filteredOrders.forEach(order => {
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    // Count Parts (part_usage and direct product sales)
                    if (item.type === 'part_usage' || item.type === 'product') {
                        let name = item.name || 'Unknown Part';
                        if (name.startsWith('Used: ')) name = name.replace('Used: ', '').split(' (')[0];
                        if (name.startsWith('Log: No Part Needed')) return; // ignore these logs

                        partCounts[name] = (partCounts[name] || 0) + (item.qty || 1);
                    }

                    // Count Services (repairs)
                    if (item.type === 'repair' && item.services) {
                        item.services.forEach(svc => {
                            // Only count if it's not Void
                            if (svc.status !== 'Void') {
                                const svcName = svc.service || 'Unknown Service';
                                serviceCounts[svcName] = (serviceCounts[svcName] || 0) + 1;
                            }
                        });
                    }
                });
            }
        });

        // Ensure all inventory items are represented in partCounts (even if 0)
        inventory.forEach(invItem => {
            if (invItem.name && partCounts[invItem.name] === undefined) {
                partCounts[invItem.name] = 0;
            }
        });

        // Convert to arrays and sort
        const partsArr = Object.keys(partCounts).map(name => ({ name, count: partCounts[name] }));
        partsArr.sort((a, b) => b.count - a.count);

        const servicesArr = Object.keys(serviceCounts).map(name => ({ name, count: serviceCounts[name] }));
        servicesArr.sort((a, b) => b.count - a.count);

        // Classify Fast vs Slow
        const fastP = partsArr.filter(p => p.count > 0).slice(0, 10);
        // Take the bottom 10, then sort them highest to lowest
        const slowP = [...partsArr].reverse().slice(0, 10).sort((a, b) => b.count - a.count);

        const fastS = servicesArr.filter(s => s.count > 0).slice(0, 10);
        const slowS = [...servicesArr].reverse().slice(0, 10).sort((a, b) => b.count - a.count);

        return { fastParts: fastP, slowParts: slowP, fastServices: fastS, slowServices: slowS };
    }, [filteredOrders, inventory]);

    if (globalLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-purple-600" size={40} /></div>;
    }

    return (
        <div className="p-6 lg:p-10 bg-slate-50 min-h-screen space-y-8">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="bg-white p-2 rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 text-gray-600">
                        <ArrowLeft size={24}/>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                            <Activity className="text-purple-600" size={32}/> Trend Analysis
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">Identify fast-moving vs slow-moving parts and services.</p>
                    </div>
                </div>

                <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
                    {[ {label: '7 Days', val: '7'}, {label: '30 Days', val: '30'}, {label: '90 Days', val: '90'}, {label: 'All Time', val: 'all'} ].map(opt => (
                        <button 
                            key={opt.val}
                            onClick={() => setTimeframe(opt.val)}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition ${timeframe === opt.val ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* DASHBOARD GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* FAST MOVING PARTS */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="bg-green-50 p-4 border-b border-green-100 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-green-900 flex items-center gap-2">
                            <TrendingUp className="text-green-600"/> Fast-Moving Parts
                        </h2>
                        <Package className="text-green-300"/>
                    </div>
                    <div className="p-0">
                        {fastParts.length === 0 ? (
                            <p className="p-6 text-center text-gray-500">No data for this period.</p>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <tbody>
                                    {fastParts.map((item, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="p-4 font-bold text-gray-700">{item.name}</td>
                                            <td className="p-4 text-right">
                                                <span className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full text-xs">
                                                    {item.count} sales
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* FAST MOVING SERVICES */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="bg-blue-50 p-4 border-b border-blue-100 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                            <TrendingUp className="text-blue-600"/> High-Demand Services
                        </h2>
                        <Wrench className="text-blue-300"/>
                    </div>
                    <div className="p-0">
                        {fastServices.length === 0 ? (
                            <p className="p-6 text-center text-gray-500">No data for this period.</p>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <tbody>
                                    {fastServices.map((item, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="p-4 font-bold text-gray-700">{item.name}</td>
                                            <td className="p-4 text-right">
                                                <span className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full text-xs">
                                                    {item.count} requests
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* SLOW MOVING PARTS */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="bg-red-50 p-4 border-b border-red-100 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-red-900 flex items-center gap-2">
                            <TrendingDown className="text-red-600"/> Slow-Moving / Dead Stock (Parts)
                        </h2>
                        <AlertCircle className="text-red-300"/>
                    </div>
                    <div className="p-0">
                        {slowParts.length === 0 ? (
                            <p className="p-6 text-center text-gray-500">No data available.</p>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <tbody>
                                    {slowParts.map((item, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="p-4 font-bold text-gray-700">{item.name}</td>
                                            <td className="p-4 text-right">
                                                <span className={`font-bold px-3 py-1 rounded-full text-xs ${item.count === 0 ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                                                    {item.count} sales
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* SLOW MOVING SERVICES */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="bg-orange-50 p-4 border-b border-orange-100 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-orange-900 flex items-center gap-2">
                            <TrendingDown className="text-orange-600"/> Low-Demand Services
                        </h2>
                        <Clock className="text-orange-300"/>
                    </div>
                    <div className="p-0">
                        {slowServices.length === 0 ? (
                            <p className="p-6 text-center text-gray-500">No data available.</p>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <tbody>
                                    {slowServices.map((item, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="p-4 font-bold text-gray-700">{item.name}</td>
                                            <td className="p-4 text-right">
                                                <span className="bg-orange-100 text-orange-800 font-bold px-3 py-1 rounded-full text-xs">
                                                    {item.count} requests
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TrendAnalysis;
