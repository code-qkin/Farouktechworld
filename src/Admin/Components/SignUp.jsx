import React, { useState } from 'react';
import { UserPlus, Lock, Mail, User, ArrowLeft, Loader2, ShieldAlert, RefreshCw, CheckCircle } from 'lucide-react';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    updateProfile, 
    signOut, 
    sendEmailVerification 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig'; 
import { useNavigate, Link } from 'react-router-dom';
import { Toast } from '../Components/Feedback';

const SignupPage = () => {
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ message: '', type: '' }); 
    
    // UI State
    const [showVerification, setShowVerification] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);

    const navigate = useNavigate();

    // Helper: Create profile (Starts as Unverified)
    const createUserProfile = async (user) => {
        try {
            await setDoc(doc(db, "Users", user.uid), {
                uid: user.uid,
                name: formData.name || user.displayName || 'Staff Member',
                email: user.email,
                role: 'pending',        
                status: 'active',
                isVerified: false, 
                createdAt: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error("Database Error (Ignored for now):", error);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setToast({ message: '', type: '' });

        try {
            // 1. Create Account
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // 2. Setup Profile & DB
            await updateProfile(user, { displayName: formData.name });
            await createUserProfile(user);

            // 3. Send Verification
            try { await sendEmailVerification(user); } catch (e) { console.warn("Email send issue:", e); }
            
            // 4. SHOW SCREEN (Force this to happen)
            setShowVerification(true);
            setToast({ message: "Account created! Please verify email.", type: 'success' });

        } catch (err) {
            console.error("Signup Error:", err);

            // 🔥 RECOVERY: Handle "Email Already In Use" (Ghost Account)
            if (err.code === 'auth/email-already-in-use') {
                try {
                    // A. Login to prove ownership
                    const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
                    const user = userCredential.user;

                    // B. Check DB
                    const userDoc = await getDoc(doc(db, "Users", user.uid));
                    
                    // C. Fix Missing DB or Unverified Status
                    if (!userDoc.exists() || !user.emailVerified) {
                        // Fix DB if missing
                        if (!userDoc.exists()) await createUserProfile(user);
                        
                        // Fix Verification UI
                        if (!user.emailVerified) {
                            try { await sendEmailVerification(user); } catch (e) {}
                            
                            // 🔥 SHOW SCREEN (Do NOT redirect)
                            setShowVerification(true);
                            setToast({ message: "Account recovered. Please verify.", type: 'info' });
                            return; 
                        }
                    }

                    // D. If verified & exists, login
                    setToast({ message: "Account active. Logging in...", type: 'info' });
                    setTimeout(() => navigate('/admin/login'), 2000);

                } catch (recoveryErr) {
                    if (recoveryErr.code === 'auth/wrong-password' || recoveryErr.code === 'auth/invalid-credential') {
                        setToast({ message: "Email taken. Please Log In or Reset Password.", type: 'error' });
                    } else {
                        setToast({ message: "Error: " + recoveryErr.message, type: 'error' });
                    }
                }
            } else {
                setToast({ message: err.message, type: 'error' });
            }
        } finally {
            setLoading(false);
        }
    };

    // 🔥 "I Have Verified" Button Logic
    const checkVerificationStatus = async () => {
        setVerifying(true);
        try {
            await auth.currentUser.reload(); // Force refresh token
            if (auth.currentUser.emailVerified) {
                // SYNC: Force DB update (using setDoc merge to be safe)
                await setDoc(doc(db, "Users", auth.currentUser.uid), { isVerified: true }, { merge: true });
                
                setToast({ message: "Verified! Request sent to Admin.", type: 'success' });
                
                // Logout to clear pending session
                setTimeout(async () => {
                    await signOut(auth);
                    navigate('/admin/login');
                }, 1500);
            } else {
                setToast({ message: "Not verified yet. Check spam folder.", type: 'warning' });
            }
        } catch (e) {
            setToast({ message: "Error checking status.", type: 'error' });
        } finally {
            setVerifying(false);
        }
    };

    const handleResendLink = async () => {
        setResending(true);
        try {
            await sendEmailVerification(auth.currentUser);
            setToast({ message: "Link resent! Check inbox.", type: 'success' });
        } catch (e) {
            if(e.code === 'auth/too-many-requests') {
                setToast({ message: "Too many attempts. Wait a moment.", type: 'warning' });
            } else {
                setToast({ message: "Link sent.", type: 'success' });
            }
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-purple-50 p-4">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />

            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border-t-4 border-purple-600">
                {showVerification ? (
                    <div className="text-center">
                        <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShieldAlert className="w-8 h-8 text-yellow-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Verify Your Email</h2>
                        <p className="text-sm text-gray-500 mt-2 mb-6 px-2">
                            We sent a link to <span className="font-bold text-gray-800">{formData.email}</span>.<br/>
                            Click it to activate your account.
                        </p>

                        <div className="space-y-3">
                            <button 
                                onClick={checkVerificationStatus} 
                                disabled={verifying}
                                className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition shadow-md flex justify-center items-center gap-2"
                            >
                                {verifying ? <Loader2 className="animate-spin" size={18}/> : <><CheckCircle size={18}/> I Have Verified</>}
                            </button>

                            <button 
                                onClick={handleResendLink} 
                                disabled={resending}
                                className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-50 transition flex justify-center items-center gap-2"
                            >
                                {resending ? <Loader2 className="animate-spin" size={18}/> : <><RefreshCw size={18}/> Resend Link</>}
                            </button>
                        </div>

                        <div className="mt-6 text-center text-xs text-gray-400">
                            Wrong email? <button onClick={() => window.location.reload()} className="text-purple-600 hover:underline">Start Over</button>
                        </div>
                    </div>
                ) : (
                    <>
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
                    </>
                )}
            </div>
        </div>
    );
};

export default SignupPage;