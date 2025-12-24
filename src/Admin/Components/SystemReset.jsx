import React, { useState } from 'react';
import { useAuth } from '../AdminContext';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { Trash2, AlertTriangle, CheckCircle, Loader2, ShieldAlert } from 'lucide-react';

const SystemReset = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [completed, setCompleted] = useState(false);

    // Collections to wipe
    const COLLECTIONS = [
        'Orders', 
        'Inventory', 
        'PayrollRecords', 
        'PayrollAdjustments'
        // 'Users' is handled separately to protect YOU
    ];

    const handleFactoryReset = async () => {
        if (!window.confirm("⚠️ DANGER: This will delete ALL data (Orders, Inventory, Staff). This cannot be undone. Are you sure?")) return;
        
        const confirmText = prompt("Type 'DELETE EVERYTHING' to confirm:");
        if (confirmText !== 'DELETE EVERYTHING') return alert("Reset Cancelled.");

        setLoading(true);
        setCompleted(false);
        
        try {
            // 1. WIPE STANDARD COLLECTIONS
            for (const colName of COLLECTIONS) {
                setProgress(`Cleaning ${colName}...`);
                const snap = await getDocs(collection(db, colName));
                if (!snap.empty) {
                    const batch = writeBatch(db);
                    snap.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            }

            // 2. WIPE USERS (EXCEPT YOU)
            setProgress("Removing other users...");
            const userSnap = await getDocs(collection(db, "Users"));
            const userBatch = writeBatch(db);
            let userCount = 0;

            userSnap.docs.forEach(d => {
                // 🛑 CRITICAL: SKIP YOUR OWN ACCOUNT
                if (d.id !== user.uid) {
                    userBatch.delete(d.ref);
                    userCount++;
                }
            });

            if (userCount > 0) {
                await userBatch.commit();
            }

            setProgress("System Cleaned Successfully.");
            setCompleted(true);

        } catch (error) {
            console.error(error);
            alert("Error during reset: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border-t-8 border-red-600">
                <div className="p-8 text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert size={40} className="text-red-600" />
                    </div>
                    
                    <h1 className="text-2xl font-black text-gray-900 mb-2">Factory Reset</h1>
                    <p className="text-gray-500 text-sm mb-8">
                        This tool will wipe <b>Orders, Inventory, Payroll, and all Staff accounts</b>. 
                        <br/><br/>
                        <span className="text-green-700 font-bold bg-green-50 px-2 py-1 rounded">
                            You ({user?.email}) will NOT be deleted.
                        </span>
                    </p>

                    {loading ? (
                        <div className="bg-gray-100 p-4 rounded-xl flex items-center justify-center gap-3 text-gray-600 font-bold animate-pulse">
                            <Loader2 className="animate-spin" /> {progress}
                        </div>
                    ) : completed ? (
                        <div className="bg-green-50 p-6 rounded-xl border border-green-200">
                            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2"/>
                            <h3 className="text-green-800 font-bold text-lg">Clean Slate Ready!</h3>
                            <p className="text-green-600 text-xs">The app is now ready for the owner.</p>
                        </div>
                    ) : (
                        <button 
                            onClick={handleFactoryReset}
                            className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 shadow-lg transition flex items-center justify-center gap-2"
                        >
                            <Trash2 size={24} /> WIPE DATABASE
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SystemReset;