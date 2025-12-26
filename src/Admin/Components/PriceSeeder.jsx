import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { Database, UploadCloud, Loader2 } from 'lucide-react';
import { generateServiceData } from '../../Data/PriceData';

const PriceSeeder = () => {
    const [loading, setLoading] = useState(false);

    const handleSeed = async () => {
        if (!window.confirm("⚠️ This will reset/upload ALL service pricing. Existing prices may be overwritten if IDs match. Continue?")) return;
        setLoading(true);

        try {
            const data = generateServiceData();
            console.log(`Generated ${data.length} items to upload...`);

            // Batch writes (limit 500 per batch)
            const batchSize = 450; 
            for (let i = 0; i < data.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = data.slice(i, i + batchSize);

                chunk.forEach(item => {
                    // Create ID like: "Screen_Baking_iPhone_X"
                    const safeService = item.service.replace(/[^a-zA-Z0-9]/g, '_');
                    const safeModel = item.model.replace(/[^a-zA-Z0-9]/g, '_');
                    const docId = `${safeService}_${safeModel}`;
                    
                    const docRef = doc(db, "Services", docId);
                    batch.set(docRef, {
                        ...item,
                        updatedAt: new Date()
                    }, { merge: true }); // Merge ensures we don't wipe existing prices if we run this again
                });

                await batch.commit();
            }

            alert(`Success! Uploaded/Updated ${data.length} service entries.`);

        } catch (error) {
            console.error("Seeding Error:", error);
            alert("Failed to upload data. Check console.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
            <div>
                <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                    <Database size={18}/> Service Database Tool
                </h3>
                <p className="text-xs text-indigo-700">Initialize the full list of services and models (6 to 17 Pro Max).</p>
            </div>
            <button 
                onClick={handleSeed} 
                disabled={loading}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 transition shadow-md"
            >
                {loading ? <Loader2 className="animate-spin" size={16}/> : <><UploadCloud size={16}/> Load Services</>}
            </button>
        </div>
    );
};

export default PriceSeeder;