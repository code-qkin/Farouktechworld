import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Smartphone, Package, FileText, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useStore } from '../../store/useStore';

const GlobalSearch = () => {
    const { isGlobalSearchOpen, toggleGlobalSearch } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState({ orders: [], inventory: [], customers: [] });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const inputRef = useRef(null);

    // Ctrl+K Shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                toggleGlobalSearch();
            }
            if (e.key === 'Escape' && isGlobalSearchOpen) {
                toggleGlobalSearch();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isGlobalSearchOpen, toggleGlobalSearch]);

    // Focus input when opened
    useEffect(() => {
        if (isGlobalSearchOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setSearchTerm('');
            setResults({ orders: [], inventory: [], customers: [] });
        }
    }, [isGlobalSearchOpen]);

    // Handle Search Logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.trim().length < 2) {
                setResults({ orders: [], inventory: [], customers: [] });
                return;
            }
            
            setLoading(true);
            const term = searchTerm.trim();
            const termLower = term.toLowerCase();

            try {
                // We'll perform multiple targeted queries. 
                const qOrderTicket = query(
                    collection(db, "Orders"), 
                    where("ticketId", ">=", term), 
                    where("ticketId", "<=", term + "\uf8ff"), 
                    limit(20)
                );
                const [orderTicketSnap] = await Promise.all([ getDocs(qOrderTicket) ]);
                
                // Sort orders by createdAt (descending) manually as composite indexes might be missing for complex where/orderBy combos
                const orderResults = orderTicketSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => {
                        const timeA = a.createdAt?.seconds || 0;
                        const timeB = b.createdAt?.seconds || 0;
                        return timeB - timeA;
                    });

                // Fetch a small chunk of inventory and customers for local filtering (since we can't full text search easily)
                const qInv = query(collection(db, "Inventory"), limit(50));
                const invSnap = await getDocs(qInv);
                const invResults = invSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(i => i.name?.toLowerCase().includes(termLower) || i.model?.toLowerCase().includes(termLower))
                    .slice(0, 5);

                const qCust = query(collection(db, "Customers"), limit(50));
                const custSnap = await getDocs(qCust);
                const custResults = custSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(c => c.name?.toLowerCase().includes(termLower) || c.phone?.includes(term))
                    .slice(0, 5);

                setResults({ orders: orderResults, inventory: invResults, customers: custResults });
            } catch (e) {
                console.error("Search error", e);
            }
            setLoading(false);
        }, 400); // 400ms debounce

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleNavigate = (path) => {
        navigate(path);
        toggleGlobalSearch();
    };

    if (!isGlobalSearchOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-start justify-center pt-20 px-4">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
                >
                    <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                        <Search size={20} className="text-slate-400" />
                        <input 
                            ref={inputRef}
                            type="text" 
                            className="flex-1 bg-transparent border-none outline-none font-bold text-slate-800 placeholder-slate-400 text-lg"
                            placeholder="Search orders, customers, inventory..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <button onClick={toggleGlobalSearch} className="p-1 text-slate-400 hover:text-slate-600 bg-white rounded-md border border-slate-200 shadow-sm"><X size={18} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {loading && <div className="p-4 text-center text-sm font-bold text-slate-400 animate-pulse">Searching...</div>}
                        
                        {!loading && searchTerm.length >= 2 && results.orders.length === 0 && results.inventory.length === 0 && results.customers.length === 0 && (
                            <div className="p-8 text-center text-sm text-slate-500">No results found for "{searchTerm}"</div>
                        )}

                        {!loading && results.orders.length > 0 && (
                            <div className="mb-4">
                                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Orders</div>
                                {results.orders.map(o => (
                                    <button key={o.id} onClick={() => handleNavigate(`/admin/orders/${o.ticketId}`)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition text-left group">
                                        <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-100"><FileText size={18}/></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{o.ticketId} - {o.customer?.name}</p>
                                            <p className="text-xs text-slate-500 truncate">{o.status}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {!loading && results.inventory.length > 0 && (
                            <div className="mb-4">
                                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Inventory</div>
                                {results.inventory.map(i => (
                                    <button key={i.id} onClick={() => handleNavigate('/admin/store')} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition text-left group">
                                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100"><Package size={18}/></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{i.name}</p>
                                            <p className="text-xs text-slate-500 truncate">Stock: {i.stock}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {!loading && results.customers.length > 0 && (
                            <div className="mb-2">
                                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Customers</div>
                                {results.customers.map(c => (
                                    <button key={c.id} onClick={() => handleNavigate('/admin/orders')} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition text-left group">
                                        <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 group-hover:bg-orange-100"><User size={18}/></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{c.name}</p>
                                            <p className="text-xs text-slate-500 truncate">{c.phone || c.email}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="border-t border-slate-100 bg-slate-50 p-2 flex justify-center gap-4 text-[10px] font-medium text-slate-400">
                        <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 px-1 rounded shadow-sm">↑</kbd> <kbd className="bg-white border border-slate-200 px-1 rounded shadow-sm">↓</kbd> to navigate</span>
                        <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 px-1 rounded shadow-sm">Enter</kbd> to select</span>
                        <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 px-1 rounded shadow-sm">Esc</kbd> to close</span>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default GlobalSearch;