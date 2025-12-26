import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig'; // Ensure this path is correct
import { writeBatch, doc, collection, getDocs, increment } from 'firebase/firestore';
import { generateStoreData } from '../../Data/StoreData'; // Retained your import
import { Database, UploadCloud, Loader2, RefreshCw, CheckSquare, Save } from 'lucide-react';

const InventorySeeder = () => {
    // --- State ---
    const [inventory, setInventory] = useState([]); // Stores data fetched from Firebase
    const [loadingSeed, setLoadingSeed] = useState(false); // For the original "Load/Seed" button
    const [loadingFetch, setLoadingFetch] = useState(false); // For fetching data to view
    const [isUpdating, setIsUpdating] = useState(false); // For pushing stock updates

    // --- Smart Selection State ---
    const [selectedIds, setSelectedIds] = useState([]);
    const [stockInput, setStockInput] = useState(10); 

    // ------------------------------------------------------------------
    // 1. ORIGINAL FUNCTIONALITY: Seed/Initialize Database
    // ------------------------------------------------------------------
    const handleSeedUpload = async () => {
        if (!window.confirm("⚠️ This will generate and upload ALL inventory items. This may overwrite existing data. Continue?")) return;
        setLoadingSeed(true);

        try {
            const data = generateStoreData();
            console.log(`Generated ${data.length} inventory items...`);

            const batchSize = 450;
            let count = 0;

            for (let i = 0; i < data.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = data.slice(i, i + batchSize);

                chunk.forEach(item => {
                    const safeName = item.name.replace(/[^a-zA-Z0-9]/g, '_');
                    const docRef = doc(db, "Inventory", safeName);
                    
                    batch.set(docRef, {
                        ...item,
                        // Ensure we have a default stock field if not present
                        stock: item.stock || item.currentStock || 0, 
                        createdAt: new Date()
                    }, { merge: true }); 
                });

                await batch.commit();
                count += chunk.length;
            }

            alert(`Success! Uploaded ${count} items.`);
            // Automatically fetch the new data so the table updates
            fetchInventory();

        } catch (error) {
            console.error("Upload failed:", error);
            alert("Error uploading data. Check console.");
        } finally {
            setLoadingSeed(false);
        }
    };

    // ------------------------------------------------------------------
    // 2. NEW FUNCTIONALITY: Fetch Data (Read from Firebase)
    // ------------------------------------------------------------------
    const fetchInventory = async () => {
        setLoadingFetch(true);
        try {
            const querySnapshot = await getDocs(collection(db, "Inventory"));
            const items = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setInventory(items);
            // Clear selection on re-fetch
            setSelectedIds([]); 
        } catch (error) {
            console.error("Error fetching inventory:", error);
            alert("Failed to load inventory list.");
        } finally {
            setLoadingFetch(false);
        }
    };

    // ------------------------------------------------------------------
    // 3. NEW FUNCTIONALITY: Push Stock Update (Write to Firebase)
    // ------------------------------------------------------------------
    const handlePushStock = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Add ${stockInput} stock to ${selectedIds.length} selected items?`)) return;

        setIsUpdating(true);
        try {
            // Firestore limits batches to 500 operations. 
            // If you select more than 500, we need to loop (handling simplified here for <500)
            const batch = writeBatch(db);

            selectedIds.forEach(id => {
                const docRef = doc(db, "Inventory", id);
                // Atomically increment the stock
                batch.update(docRef, {
                    stock: increment(Number(stockInput))
                });
            });

            await batch.commit();
            
            alert("Stock updated successfully!");
            fetchInventory(); // Refresh table to show new numbers
        } catch (error) {
            console.error("Error updating stock:", error);
            alert("Failed to update stock.");
        } finally {
            setIsUpdating(false);
        }
    };

    // --- Selection Helpers ---
    const allSelected = inventory.length > 0 && selectedIds.length === inventory.length;

    const handleSelectAll = () => {
        if (allSelected) setSelectedIds([]);
        else setSelectedIds(inventory.map(item => item.id));
    };

    const handleSelectOne = (id) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(sid => sid !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    return (
        <div className="space-y-6">
            {/* --- Original Card: Initialization --- */}
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between shadow-sm">
                <div className="mb-4 sm:mb-0">
                    <h3 className="font-bold text-purple-900 flex items-center gap-2">
                        <Database size={18}/> Store Inventory Tool
                    </h3>
                    <p className="text-xs text-purple-700">Initialize store products (JCID, Screens, Batteries 6-17PM).</p>
                </div>
                <div className="flex gap-2">
                     {/* View/Refresh Button */}
                     <button 
                        onClick={fetchInventory} 
                        disabled={loadingFetch || loadingSeed}
                        className="bg-white text-purple-700 border border-purple-200 px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-purple-100 flex items-center gap-2 transition"
                    >
                        {loadingFetch ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
                        {inventory.length > 0 ? "Refresh List" : "View Inventory"}
                    </button>

                    {/* Original Seed Button */}
                    <button 
                        onClick={handleSeedUpload} 
                        disabled={loadingSeed}
                        className="bg-purple-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50 transition shadow-md"
                    >
                        {loadingSeed ? <Loader2 className="animate-spin" size={16}/> : <><UploadCloud size={16}/> Initialize DB</>}
                    </button>
                </div>
            </div>

            {/* --- New Section: Smart Stock Push --- */}
            {inventory.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    
                    {/* Control Bar */}
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-end gap-4">
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1">Stock Amount to Add</label>
                            <input
                                type="number"
                                value={stockInput}
                                onChange={(e) => setStockInput(Number(e.target.value))}
                                className="border border-gray-300 rounded-md px-3 py-2 w-32 focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={handlePushStock}
                            disabled={selectedIds.length === 0 || isUpdating}
                            className={`flex items-center px-4 py-2 rounded-md font-bold text-sm text-white transition-all
                                ${selectedIds.length === 0 
                                    ? 'bg-gray-300 cursor-not-allowed' 
                                    : 'bg-green-600 hover:bg-green-700 shadow-sm'}`}
                        >
                            {isUpdating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
                            Push Stock to ({selectedIds.length}) Items
                        </button>
                        <span className="text-xs text-gray-400 ml-auto self-center">
                            {allSelected ? "All items selected" : `${selectedIds.length} / ${inventory.length} selected`}
                        </span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 w-10">
                                        <input 
                                            type="checkbox" 
                                            checked={allSelected} 
                                            onChange={handleSelectAll}
                                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="p-3 text-xs font-bold text-gray-500 uppercase">Item Name</th>
                                    <th className="p-3 text-xs font-bold text-gray-500 uppercase">Category</th>
                                    <th className="p-3 text-xs font-bold text-gray-500 uppercase">Current Stock</th>
                                    <th className="p-3 text-xs font-bold text-gray-500 uppercase">Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {inventory.map((item) => {
                                    const isSelected = selectedIds.includes(item.id);
                                    return (
                                        <tr 
                                            key={item.id} 
                                            onClick={() => handleSelectOne(item.id)}
                                            className={`cursor-pointer transition-colors hover:bg-gray-50 ${isSelected ? 'bg-purple-50' : ''}`}
                                        >
                                            <td className="p-3">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected} 
                                                    onChange={() => handleSelectOne(item.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-3 text-sm font-medium text-gray-900">{item.name}</td>
                                            <td className="p-3 text-sm text-gray-500">{item.category || "-"}</td>
                                            <td className="p-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                                    ${(item.stock || 0) > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {item.stock || 0}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm text-gray-500">
                                                ${item.price || item.cost || 0}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventorySeeder;