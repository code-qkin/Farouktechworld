import React, { useState } from 'react';
import { Lock, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

// 🔥 ADDED 'manager'
const ALLOWED_DASHBOARD_ROLES = ['admin', 'secretary', 'worker', 'ceo', 'manager'];
const googleProvider = new GoogleAuthProvider();

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const checkUserAccess = async (user) => {
    try {
      const userDocRef = doc(db, 'Users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();

        if (userData.status === 'suspended') {
          await auth.signOut();
          setError("🚫 Access Denied: Your account has been suspended. Contact Admin.");
          return false;
        }

        if (ALLOWED_DASHBOARD_ROLES.includes(userData.role)) {
          navigate('/admin/dashboard', { replace: true });
          return true;
        } else {
          setError("Access Denied: Insufficient permissions.");
        }
      } else {
        setError("Account not found. Please contact Admin.");
      }
    } catch (dbError) {
      console.error("Role Check Error:", dbError);
      setError("Failed to verify account permissions.");
    }

    await auth.signOut();
    return false;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await checkUserAccess(userCredential.user);
    } catch (err) {
      console.error(err);
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      await checkUserAccess(userCredential.user);
    } catch (err) {
      console.error(err);
      setError("Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-50 p-4 sm:p-6">
      <div className="w-full max-w-sm sm:max-w-md bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border-t-4 border-purple-700">
        <div className="text-center mb-6 sm:mb-8">
          <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-purple-700 mx-auto mb-2 sm:mb-3" />
          <h2 className="text-2xl sm:text-3xl font-extrabold text-purple-900">FTW Admin Access</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Sign in as Admin, Secretary, or Worker</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
          {error && (
            <div className="p-3 text-sm font-bold text-red-800 bg-red-100 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500 text-sm" placeholder="user@farouktechworld.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border border-gray-300 rounded-lg p-3 focus:ring-purple-500 focus:border-purple-500 text-sm" placeholder="••••••••" />
          </div>

          <button type="submit" disabled={loading} className={`w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg shadow-md text-sm font-medium text-white ${loading ? 'bg-purple-400' : 'bg-purple-700 hover:bg-purple-800'} transition`}>
            {loading ? 'Checking...' : <><LogIn size={18} /> Sign In</>}
          </button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="px-3 text-sm text-gray-400 font-medium">OR</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        <button onClick={handleGoogleSignIn} disabled={loading} type="button" className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg border border-gray-300 shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage;