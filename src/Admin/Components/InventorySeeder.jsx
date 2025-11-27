import React, { useState } from 'react';
import { db } from '../../firebaseConfig'; // Adjust path to your config
import { writeBatch, doc, collection } from 'firebase/firestore';
import { storeData } from '../../Data/storeData'; // Import the file you made in Step 1

const InventorySeeder = () => {
    const [loading, setLoading] = useState(false);

    const handleUpload = async () => {
        if (!window.confirm("This will upload ALL items to Firebase. Continue?")) return;
        setLoading(true);

        try {
            const batch = writeBatch(db);
            let count = 0;

            // Loop through your categories
            Object.entries(storeData).forEach(([categoryName, items]) => {
                items.forEach((item) => {
                    // Create a reference for a new document
                    const docRef = doc(collection(db, "Inventory"));
                    
                    // Parse Price (Handle '450K', 'Available', numbers)
                    let price = 0;
                    if (typeof item.price === 'number') {
                        price = item.price;
                    } else if (typeof item.price === 'string') {
                        // Simple parser: Remove non-digits, multiply if 'K' exists
                        const numStr = item.price.replace(/[^0-9.]/g, '');
                        if (numStr) {
                            price = parseFloat(numStr) * (item.price.toLowerCase().includes('k') ? 1000 : 1);
                        }
                    }

                    // Prepare the Data Object
                    const inventoryItem = {
                        name: `${categoryName} - ${item.model}`, // e.g. "OLED Screen - iPhone X"
                        category: categoryName,
                        model: item.model,
                        price: price,
                        stock: 0, // Default starting stock (you can edit later)
                        createdAt: new Date()
                    };

                    batch.set(docRef, inventoryItem);
                    count++;
                });
            });

            await batch.commit();
            alert(`Success! Uploaded ${count} items to Firestore.`);

        } catch (error) {
            console.error("Upload failed:", error);
            alert("Error uploading data. Check console.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 bg-gray-100 rounded-lg my-4 border border-gray-300">
            <h3 className="font-bold text-gray-700 mb-2">⚠️ Admin Data Tool</h3>
            <button 
                onClick={handleUpload} 
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
                {loading ? "Uploading..." : "Upload All Store Data to Firebase"}
            </button>
        </div>
    );
};

export default InventorySeeder;