import React, { useState } from 'react';
import { User, Lock, Save, AlertCircle } from 'lucide-react';
import { useAuth } from '../AdminContext';
import { updateProfile, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

const Settings = () => {
    const { user, setUser } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            // 1. Update Auth Profile (DisplayName)
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: name });
            }

            // 2. Update Firestore User Document
            const userRef = doc(db, "Users", user.uid);
            await updateDoc(userRef, { name: name });

            // 3. Update Password (if provided)
            if (newPassword) {
                await updatePassword(auth.currentUser, newPassword);
            }

            // 4. Update Local Context
            setUser({ ...user, name: name });
            
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setNewPassword(''); // Clear password field for security

        } catch (error) {
            console.error("Update Error:", error);
            // Handle "Requires Recent Login" error for password changes
            if (error.code === 'auth/requires-recent-login') {
                setMessage({ type: 'error', text: 'For security, please logout and login again to change your password.' });
            } else {
                setMessage({ type: 'error', text: error.message });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg mt-10">
            <h2 className="text-2xl font-bold text-purple-900 mb-6 flex items-center gap-2">
                <User className="w-6 h-6"/> Account Settings
            </h2>

            {message.text && (
                <div className={`p-3 mb-6 rounded-lg text-sm flex items-center ${
                    message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                    {message.type === 'error' && <AlertCircle size={16} className="mr-2" />}
                    {message.text}
                </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Display Name</label>
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-gray-400" size={18}/>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)}
                            className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                            placeholder="Your Name"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">New Password (Optional)</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-gray-400" size={18}/>
                        <input 
                            type="password" 
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                            placeholder="Leave blank to keep current password"
                            minLength={6}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters.</p>
                </div>

                <div className="pt-4 border-t">
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-purple-900 text-white font-bold py-3 rounded-lg hover:bg-purple-800 transition flex justify-center items-center gap-2"
                    >
                        {loading ? 'Saving...' : <><Save size={20}/> Save Changes</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Settings;