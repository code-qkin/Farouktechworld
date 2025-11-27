import React, { useState, useEffect } from 'react';
import { Mail, User, Lock, ArrowRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isSignInWithEmailLink, signInWithEmailLink, updatePassword, signOut } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig'; 
import { Toast } from '../Components/Feedback'; // Ensure correct path

const CompleteSignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [status, setStatus] = useState('Verifying invitation...');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [needsEmailInput, setNeedsEmailInput] = useState(false);
    const [toast, setToast] = useState({ message: '', type: '' });
    
    const navigate = useNavigate();

    useEffect(() => {
        console.log("🚀 [DEBUG] Component Mounted. Checking link...");
        
        // 1. Check if link is valid
        if (!isSignInWithEmailLink(auth, window.location.href)) {
             console.error("❌ [DEBUG] Invalid Email Link");
             setError('Invalid or expired invitation link.');
             return;
        }
        console.log("✅ [DEBUG] Link is valid.");

        // 2. Get stored email
        const savedEmail = window.localStorage.getItem('emailForSignIn');
        console.log("📦 [DEBUG] Saved Email:", savedEmail);

        if (savedEmail) {
            setEmail(savedEmail);
            setStatus(`Completing setup for ${savedEmail}`);
        } else {
            console.warn("⚠️ [DEBUG] No email in storage. User must enter it.");
            setNeedsEmailInput(true);
            setStatus('Please confirm your email address.');
        }
    }, []);

    const handleCompleteSetup = async (e) => {
        e.preventDefault();
        console.log("🔵 [DEBUG] Starting Signup Process...");
        setLoading(true);
        setError('');
        setToast({ message: '', type: '' });

        try {
            // STEP 1: SIGN IN
            console.log("1️⃣ [DEBUG] Attempting signInWithEmailLink...");
            let userCredential;
            try {
                userCredential = await signInWithEmailLink(auth, email, window.location.href);
                console.log("✅ [DEBUG] User Signed In:", userCredential.user.uid);
            } catch (authErr) {
                console.error("❌ [DEBUG] Sign In Failed:", authErr);
                throw new Error(`Sign In Failed: ${authErr.message}`);
            }
            
            const user = userCredential.user;

            // STEP 2: LOOKUP ROLE
            console.log("2️⃣ [DEBUG] Looking for Pending Invite...");
            let assignedRole = 'worker'; 
            let inviteDocRef = null;

            try {
                const q = query(collection(db, "PendingInvites"), where("email", "==", email));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const inviteData = querySnapshot.docs[0].data();
                    console.log("✅ [DEBUG] Invite Found. Role:", inviteData.role);
                    assignedRole = inviteData.role || 'worker';
                    inviteDocRef = querySnapshot.docs[0].ref;
                } else {
                    console.warn("⚠️ [DEBUG] No invite found in DB. Defaulting to 'worker'.");
                }
            } catch (readErr) {
                console.error("❌ [DEBUG] Failed to read PendingInvites (Check Permissions):", readErr);
                // Continue anyway, defaulting to worker is safer than crashing
            }

            // STEP 3: UPDATE PASSWORD
            console.log("3️⃣ [DEBUG] Updating Password...");
            await updatePassword(user, password);
            console.log("✅ [DEBUG] Password Updated.");

            // STEP 4: REFRESH TOKEN (CRITICAL FOR PERMISSIONS)
            console.log("🔄 [DEBUG] Forcing Token Refresh...");
            await user.getIdToken(true);
            console.log("✅ [DEBUG] Token Refreshed.");

            // STEP 5: CREATE USER PROFILE
            console.log("4️⃣ [DEBUG] Creating User Profile at Users/" + user.uid);
            await setDoc(doc(db, 'Users', user.uid), {
                email: user.email,
                name: name,
                role: assignedRole,
                dateJoined: new Date().toISOString(),
                uid: user.uid,
                status: 'active'
            }, { merge: true });
            console.log("✅ [DEBUG] Profile Created Successfully.");

            // STEP 6: DELETE INVITE
            if (inviteDocRef) {
                console.log("5️⃣ [DEBUG] Deleting Invite...");
                try { 
                    await deleteDoc(inviteDocRef); 
                    console.log("✅ [DEBUG] Invite Deleted.");
                } catch(e) { 
                    console.warn("⚠️ [DEBUG] Cleanup warning (Non-fatal):", e); 
                }
            }

            window.localStorage.removeItem('emailForSignIn');
            setToast({ message: `Welcome ${name}!`, type: "success" });
            
            console.log("🎉 [DEBUG] DONE. Redirecting...");
            setTimeout(() => {
                window.location.href = '/admin/dashboard';
            }, 2000);

        } catch (err) {
            console.error("🛑 [DEBUG] CRITICAL ERROR:", err);
            setError(err.message);
            setToast({ message: err.message, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-purple-50 p-4">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />

            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-2xl border-t-4 border-purple-700">
                <div className="text-center mb-6">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${error ? 'bg-red-100' : 'bg-purple-100'}`}>
                        {error ? <AlertTriangle className="w-8 h-8 text-red-600"/> : <Mail className="w-8 h-8 text-purple-700" />}
                    </div>
                    <h2 className="text-2xl font-extrabold text-purple-900">
                        {error ? "Setup Failed" : "Complete Setup"}
                    </h2>
                    <p className="text-sm mt-2 text-gray-500">{error || status}</p>
                </div>

                {!error && (
                    <form onSubmit={handleCompleteSetup} className="space-y-4">
                        {needsEmailInput && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirm Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="worker@gmail.com" />
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="John Doe" />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Create Password</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="••••••••" minLength={6} />
                        </div>

                        <button disabled={loading} className="w-full bg-purple-700 text-white font-bold py-3 rounded-lg hover:bg-purple-800 transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                            {loading ? 'Processing...' : <>Finish & Login <ArrowRight size={18}/></>}
                        </button>
                    </form>
                )}
                
                {error && (
                    <div className="space-y-3">
                        <button onClick={() => window.location.reload()} className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200 transition">
                            Try Again
                        </button>
                        <button onClick={() => navigate('/admin/login')} className="w-full text-purple-600 font-semibold text-sm hover:underline">
                            Back to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompleteSignupPage;