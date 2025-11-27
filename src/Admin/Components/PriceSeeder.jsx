import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { Database, UploadCloud } from 'lucide-react';

// --- YOUR PRICING DATA ---
const pricingData = {
  'Glass + OCA': [
    { model: '6G - 6S Plus', price: 2200 }, { model: '7G - 8 Plus', price: 2300 }, { model: 'X, XS, XS Max', price: 2200 },
    { model: '11 - 11 Pro Max', price: 2500 }, { model: '12 - 12 Pro Max', price: 2700 }, { model: '13 - 13 Pro Max', price: 2800 },
    { model: '14 - 14 Pro Max', price: 3000 }, { model: '15 - 15 Pro Max', price: 3100 }, { model: '16 - 16 Pro Max', price: 3500 },
    { model: '17 - 17 Pro Max', price: 6000 }
  ],
  'Frame Replacement': [
    { model: 'X - XS, XS Max', price: 2500 }, { model: '11 Pro - 11 Pro Max', price: 2700 }, { model: '12 - 12 Pro Max', price: 3000 },
    { model: '13 - 13 Pro Max', price: 3000 }, { model: '14 - 14 Pro Max', price: 3500 }, { model: '15 - 15 Pro Max', price: 3700 },
    { model: '16 - 16 Pro Max', price: 4000 }, { model: '17 - 17 Pro Max', price: 6000 }
  ],
  'Battery Replacement': [ // Renamed from 'AY Battery Tag'/Permanent Battery for clarity or merge them
    { model: '15 Pro / 15 Pro Max', price: 11800 }, { model: '15 / 15 Plus', price: 11500 }, { model: '14 / 14 Pro Max', price: 11500 },
    { model: '14 - 14 Plus', price: 11000 }, { model: '13 Pro / 13 Pro Max', price: 11000 }, { model: '13', price: 10500 },
    { model: '12 - 12 Pro Max', price: 8500 }, { model: '11 - 11 Pro Max', price: 8000 }
  ],
  'FaceID Repair': [
    { model: '15 Pro / 15 Pro Max', price: 25000 }, { model: '14 Pro / 14 Pro Max', price: 24000 }, { model: '13 Pro / 13 Pro Max', price: 24000 },
    { model: '13', price: 20000 }, { model: '12 - 12 Pro Max', price: 14500 }, { model: '11', price: 12500 }, { model: 'XS / XR / XS Max', price: 11500 }
  ],
  'OLED Screen': [
    { model: '16', price: 230000 }, { model: '15 Pro', price: 250000 }, { model: '15 Pro Max', price: 230000 },
    { model: '14 Pro Max', price: 200000 }, { model: '13 Pro Max', price: 110000 }, { model: '12 Pro Max', price: 85000 },
    { model: '11 Pro Max', price: 53000 }, { model: 'XS Max', price: 45000 }
  ],
  'Incell Screen': [
    { model: '13 Pro Max', price: 55000 }, { model: '13', price: 38000 }, { model: '12 Pro Max', price: 45000 },
    { model: '11 Pro Max', price: 25000 }, { model: 'XR / 11', price: 22000 }, { model: 'X', price: 16000 }
  ],
  // Add other categories as needed
};

const PricingSeeder = () => {
    const [loading, setLoading] = useState(false);

    // Helper to clean price strings
    const parsePrice = (p) => {
        if (typeof p === 'number') return p;
        if (typeof p === 'string') {
            const cleanStr = p.replace(/[^0-9.]/g, '');
            if (cleanStr) {
                let val = parseFloat(cleanStr);
                if (p.toLowerCase().includes('k')) val *= 1000;
                return val;
            }
        }
        return 0;
    };

    const handleSeed = async () => {
        if (!window.confirm("This will overwrite/add pricing data in Firestore. Continue?")) return;
        setLoading(true);

        try {
            const batch = writeBatch(db);
            let count = 0;

            Object.entries(pricingData).forEach(([serviceType, models]) => {
                models.forEach(item => {
                    // Create a unique ID based on service and model to avoid duplicates if run again
                    // Cleaning strings to make safe IDs
                    const safeService = serviceType.replace(/[^a-zA-Z0-9]/g, '_');
                    const safeModel = item.model.replace(/[^a-zA-Z0-9]/g, '_');
                    const docId = `${safeService}_${safeModel}`;

                    const docRef = doc(db, "Pricing", docId);
                    
                    batch.set(docRef, {
                        service: serviceType,
                        model: item.model,
                        price: parsePrice(item.price),
                        updatedAt: new Date()
                    });
                    count++;
                });
            });

            await batch.commit();
            alert(`Successfully uploaded ${count} pricing entries!`);

        } catch (error) {
            console.error("Seeding Error:", error);
            alert("Failed to upload data.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6 flex items-center justify-between">
            <div>
                <h3 className="font-bold text-blue-800 flex items-center gap-2">
                    <Database size={18}/> Pricing Data Tool
                </h3>
                <p className="text-xs text-blue-600">Upload your pricing catalog to Firestore for auto-calculations.</p>
            </div>
            <button 
                onClick={handleSeed} 
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
                {loading ? 'Uploading...' : <><UploadCloud size={16}/> Sync Pricing</>}
            </button>
        </div>
    );
};

export default PricingSeeder;