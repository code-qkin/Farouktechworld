import React, { useState } from 'react';
import { UserPlus, Lock, Mail, User, ArrowLeft, Loader2 } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig'; 
import { useNavigate, Link } from 'react-router-dom';
import { Toast } from '../Components/Feedback';

const SignupPage = () => {
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ message: '', type: '' }); 
    const navigate = useNavigate();

    // Helper: Create the user profile in Database
    const createUserProfile = async (user) => {
        await setDoc(doc(db, "Users", user.uid), {
            uid: user.uid,
            name: formData.name || user.displayName || 'Staff Member',
            email: user.email,
            role: 'pending',        
            status: 'active',
            createdAt: serverTimestamp() // Timestamps are vital for sorting!
        }, { merge: true });
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setToast({ message: '', type: '' });

        try {
            // 1. Try to Create New Account
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // 2. Setup Profile
            await updateProfile(user, { displayName: formData.name });
            await createUserProfile(user);
            
            // 3. Logout & Success
            await signOut(auth);
            setToast({ message: "Request sent! Please wait for Admin approval.", type: 'success' });
            setTimeout(() => navigate('/admin/login'), 2000);

        } catch (err) {
            console.error("Signup Error:", err);

            // 🔥 THE FIX: Handle "Email Already In Use" (Ghost Accounts)
            if (err.code === 'auth/email-already-in-use') {
                try {
                    // A. Try to Log In with the password they just typed
                    const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
                    const user = userCredential.user;

                    // B. Check if their database profile is missing (The "Deleted" User issue)
                    const userDoc = await getDoc(doc(db, "Users", user.uid));
                    
                    if (!userDoc.exists()) {
                        // C. It's missing! Re-create it (Recover the account)
                        await createUserProfile(user);
                        await signOut(auth);
                        setToast({ message: "Account recovered! Request sent to Admin.", type: 'success' });
                        setTimeout(() => navigate('/admin/login'), 2000);
                    } else {
                        // D. Profile exists -> Just tell them to login
                        setToast({ message: "Account already exists. Please Log In.", type: 'info' });
                        setTimeout(() => navigate('/admin/login'), 2000);
                    }
                } catch (loginErr) {
                    // Password didn't match, so it's a real "Taken" email
                    setToast({ message: "Email is registered. Please Log In or Reset Password.", type: 'error' });
                }
            } 
            else if (err.code === 'auth/weak-password') {
                setToast({ message: "Password must be at least 6 characters.", type: 'error' });
            } else {
                setToast({ message: "Failed to create account. Try again.", type: 'error' });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-purple-50 p-4">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />

            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border-t-4 border-purple-600">
                <div className="text-center mb-6">
                    <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus className="w-8 h-8 text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Staff Registration</h2>
                    <p className="text-sm text-gray-500 mt-2">Request access to the Admin Panel.</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                    <div className="relative">
                        <User className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        <input 
                            type="text" placeholder="Full Name" required 
                            className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        <input 
                            type="email" placeholder="Email Address" required 
                            className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                            value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        <input 
                            type="password" placeholder="Password (Min 6 chars)" required minLength={6}
                            className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                            value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                        />
                    </div>

                    <button disabled={loading} className="w-full bg-purple-700 text-white font-bold py-3 rounded-lg hover:bg-purple-800 transition shadow-lg disabled:opacity-70 flex justify-center items-center gap-2">
                        {loading ? <Loader2 className="animate-spin" /> : 'Request Access'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm border-t pt-4">
                    <Link to="/admin/login" className="text-gray-500 hover:text-purple-700 flex items-center justify-center gap-2 transition">
                         <ArrowLeft size={14}/> Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;